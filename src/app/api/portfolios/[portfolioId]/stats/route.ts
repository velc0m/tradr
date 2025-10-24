import {NextRequest, NextResponse} from 'next/server';
import {getServerSession} from 'next-auth';
import {authOptions} from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import Trade from '@/models/Trade';
import Portfolio from '@/models/Portfolio';
import {
    ApiResponse,
    CoinPerformance,
    CumulativeProfitPoint,
    ITrade,
    PortfolioStatistics,
    TradeStatus,
    TradeType,
    TradeWithProfit,
} from '@/types';

interface RouteParams {
    params: Promise<{
        portfolioId: string;
    }>;
}

/**
 * Calculate Profit % for a trade
 * For LONG: ((exitPrice / entryPrice - 1) * 100) - entryFee - exitFee
 * For SHORT: ((coinsBoughtBack / soldAmount - 1) * 100)
 * This gives the NET profit percentage AFTER all fees
 */
const calculateProfitPercent = (trade: ITrade): number => {
    if (!trade.exitPrice) return 0;

    if (trade.tradeType === TradeType.SHORT) {
        // SHORT: profit % based on coins gained
        const exitFeeVal = trade.exitFee || 0;
        const buyBackPriceWithFee = trade.exitPrice * (100 + exitFeeVal) / 100;
        const coinsBoughtBack = trade.sumPlusFee / buyBackPriceWithFee;
        return ((coinsBoughtBack / trade.amount - 1) * 100);
    }

    // LONG: existing logic
    const priceChange = ((trade.exitPrice / trade.entryPrice - 1) * 100);
    const totalFees = trade.entryFee + (trade.exitFee || 0);
    const netProfitPercent = priceChange - totalFees;

    return netProfitPercent;
};

/**
 * Calculate Profit in Coins for SHORT trades
 * Formula: (netReceived / buyBackPriceWithFee) - soldAmount
 * This gives the NET profit in coins AFTER entry and exit fees
 *
 * IMPORTANT: sumPlusFee is now GROSS amount (before entry fee deduction)
 * So we calculate: netReceived = sumPlusFee * (100 - entryFee) / 100
 */
const calculateProfitCoins = (trade: ITrade): number => {
    if (!trade.exitPrice || trade.tradeType !== TradeType.SHORT) return 0;

    // Calculate net received after entry fee (sale fee)
    const entryFeeVal = trade.entryFee || 0;
    const netReceived = trade.sumPlusFee * (100 - entryFeeVal) / 100;

    // Calculate buy back price with exit fee
    const exitFeeVal = trade.exitFee || 0;
    const buyBackPriceWithFee = trade.exitPrice * (100 + exitFeeVal) / 100;

    // Calculate coins bought back
    const coinsBoughtBack = netReceived / buyBackPriceWithFee;

    // Profit is the difference
    const profitCoins = coinsBoughtBack - trade.amount;

    return profitCoins;
};

/**
 * Calculate Profit USD for a closed trade (LONG only)
 * Formula: (amount × exitPrice × (100 - exitFee) / 100) - sumPlusFee
 * This gives the NET profit in USD AFTER exit fees
 */
const calculateProfitUSD = (trade: ITrade): number => {
    if (!trade.exitPrice) return 0;

    const exitFeePercent = trade.exitFee || 0;
    const exitFeeMultiplier = (100 - exitFeePercent) / 100;
    const grossExitValue = trade.amount * trade.exitPrice;
    const netExitValue = grossExitValue * exitFeeMultiplier;
    const profitUSD = netExitValue - trade.sumPlusFee;

    return profitUSD;
};

/**
 * GET /api/portfolios/[portfolioId]/stats
 * Returns portfolio statistics
 */
export async function GET(
    request: NextRequest,
    {params}: RouteParams
): Promise<NextResponse<ApiResponse<PortfolioStatistics>>> {
    try {
        const session = await getServerSession(authOptions);

        if (!session?.user?.id) {
            return NextResponse.json(
                {success: false, error: 'Unauthorized'},
                {status: 401}
            );
        }

        const {portfolioId} = await params;

        await connectDB();

        // Verify portfolio exists and user owns it
        const portfolio = await Portfolio.findById(portfolioId);

        if (!portfolio) {
            return NextResponse.json(
                {success: false, error: 'Portfolio not found'},
                {status: 404}
            );
        }

        if (portfolio.userId !== session.user.id) {
            return NextResponse.json(
                {success: false, error: 'Forbidden'},
                {status: 403}
            );
        }

        // Get all trades for counting (exclude split originals)
        const allTrades = await Trade.find({portfolioId, isSplit: {$ne: true}});

        // Get only closed trades for statistics (exclude split originals)
        const closedTrades = await Trade.find({
            portfolioId,
            status: TradeStatus.CLOSED,
            isSplit: {$ne: true},
        }).sort({closeDate: 1});

        // Calculate profits for each closed trade
        const tradesWithProfit: TradeWithProfit[] = closedTrades.map((trade) => {
            const profitUSD = trade.tradeType === TradeType.LONG ? calculateProfitUSD(trade) : 0;
            const profitPercent = calculateProfitPercent(trade);

            return {
                ...trade.toObject(),
                profitUSD,
                profitPercent,
            };
        });

        // Separate LONG and SHORT trades
        const longTrades = tradesWithProfit.filter(t => t.tradeType === TradeType.LONG);
        const shortTrades = tradesWithProfit.filter(t => t.tradeType === TradeType.SHORT);

        // Separate averaging SHORT trades (internal operations - excluded from USD statistics)
        const averagingShortTrades = shortTrades.filter(t => t.isAveragingShort);
        const standardShortTrades = shortTrades.filter(t => !t.isAveragingShort);

        // Only include LONG and standard SHORT in USD statistics (exclude averaging SHORT)
        const tradesForUSDStats = tradesWithProfit.filter(t =>
            t.tradeType === TradeType.LONG || !t.isAveragingShort
        );

        // 1. Total Profit/Loss (exclude averaging SHORT)
        const totalProfitUSD = tradesForUSDStats.reduce(
            (sum, trade) => sum + trade.profitUSD,
            0
        );

        const sumOfProfitPercents = tradesForUSDStats.reduce((sum, trade) => sum + trade.profitPercent, 0);
        const avgProfitPercent =
            tradesForUSDStats.length > 0
                ? sumOfProfitPercents / tradesForUSDStats.length
                : 0;

        // Calculate Total Fees Paid (separate standard vs averaging)
        let standardFees = 0;
        let averagingFees = 0;

        closedTrades.forEach((trade) => {
            let tradeFees = 0;

            // Entry fee: always present
            const entryFee = (trade.sumPlusFee * trade.entryFee) / 100;
            tradeFees += entryFee;

            // Exit fee: only for closed trades with exitPrice
            if (trade.exitPrice && trade.exitFee !== undefined) {
                const exitFee = (trade.amount * trade.exitPrice * trade.exitFee) / 100;
                tradeFees += exitFee;
            }

            if (trade.isAveragingShort) {
                averagingFees += tradeFees;
            } else {
                standardFees += tradeFees;
            }
        });

        const totalFeesPaid = standardFees + averagingFees;

        // 2. Win Rate (exclude averaging SHORT)
        // For LONG: check profitUSD > 0
        // For SHORT: check profitCoins > 0 (since profitUSD is always 0 for SHORT)
        const profitableTrades = tradesForUSDStats.filter((t) => {
            if (t.tradeType === TradeType.SHORT) {
                const profitCoins = calculateProfitCoins(t);
                return profitCoins > 0;
            }
            return t.profitUSD > 0;
        });
        const winRate =
            tradesForUSDStats.length > 0
                ? (profitableTrades.length / tradesForUSDStats.length) * 100
                : 0;

        // 3. Average Profit (exclude averaging SHORT)
        const avgProfitUSD =
            tradesForUSDStats.length > 0
                ? totalProfitUSD / tradesForUSDStats.length
                : 0;

        // 4. Total ROI (exclude averaging SHORT)
        const totalInvestment = tradesForUSDStats.reduce(
            (sum, trade) => sum + trade.sumPlusFee,
            0
        );
        const totalROI =
            totalInvestment > 0 ? (totalProfitUSD / totalInvestment) * 100 : 0;

        // 5. Total Trades by Status (exclude averaging SHORT)
        const standardTrades = allTrades.filter((t) => !t.isAveragingShort);
        const openTrades = standardTrades.filter((t) => t.status === TradeStatus.OPEN);
        const filledTrades = standardTrades.filter((t) => t.status === TradeStatus.FILLED);
        const closedStandardTrades = closedTrades.filter((t) => !t.isAveragingShort);

        const totalTrades = {
            open: openTrades.length,
            filled: filledTrades.length,
            closed: closedStandardTrades.length,
        };

        // 6. Best/Worst Trade (by Profit USD) (exclude averaging SHORT)
        let bestTrade = null;
        let worstTrade = null;

        if (tradesForUSDStats.length > 0) {
            const sortedByProfitUSD = [...tradesForUSDStats].sort(
                (a, b) => b.profitUSD - a.profitUSD
            );
            bestTrade = {trade: sortedByProfitUSD[0]};
            worstTrade = {trade: sortedByProfitUSD[sortedByProfitUSD.length - 1]};
        }

        // 7. Performance by Coin (exclude averaging SHORT)
        const coinGroups = new Map<string, TradeWithProfit[]>();
        tradesForUSDStats.forEach((trade) => {
            if (!coinGroups.has(trade.coinSymbol)) {
                coinGroups.set(trade.coinSymbol, []);
            }
            coinGroups.get(trade.coinSymbol)!.push(trade);
        });

        const performanceByCoin: CoinPerformance[] = Array.from(
            coinGroups.entries()
        ).map(([coinSymbol, trades]) => {
            // For LONG: check profitUSD > 0, For SHORT: check profitCoins > 0
            const coinProfitableTrades = trades.filter((t) => {
                if (t.tradeType === TradeType.SHORT) {
                    const profitCoins = calculateProfitCoins(t);
                    return profitCoins > 0;
                }
                return t.profitUSD > 0;
            });
            const coinWinRate =
                trades.length > 0 ? (coinProfitableTrades.length / trades.length) * 100 : 0;

            const coinTotalProfitUSD = trades.reduce(
                (sum, trade) => sum + trade.profitUSD,
                0
            );

            const coinAvgProfitPercent =
                trades.length > 0
                    ? trades.reduce((sum, trade) => sum + trade.profitPercent, 0) /
                    trades.length
                    : 0;

            const sortedCoinTrades = [...trades].sort(
                (a, b) => b.profitUSD - a.profitUSD
            );

            return {
                coinSymbol,
                tradesCount: trades.length,
                winRate: coinWinRate,
                totalProfitUSD: coinTotalProfitUSD,
                avgProfitPercent: coinAvgProfitPercent,
                bestTrade:
                    trades.length > 0
                        ? {
                            profitUSD: sortedCoinTrades[0].profitUSD,
                            profitPercent: sortedCoinTrades[0].profitPercent,
                        }
                        : null,
                worstTrade:
                    trades.length > 0
                        ? {
                            profitUSD: sortedCoinTrades[sortedCoinTrades.length - 1].profitUSD,
                            profitPercent:
                            sortedCoinTrades[sortedCoinTrades.length - 1].profitPercent,
                        }
                        : null,
            };
        });

        // Sort by total profit USD descending
        performanceByCoin.sort((a, b) => b.totalProfitUSD - a.totalProfitUSD);

        // 8. Top 5 Profitable and Losing Trades (exclude averaging SHORT)
        const sortedByProfit = [...tradesForUSDStats].sort(
            (a, b) => b.profitUSD - a.profitUSD
        );

        const topProfitableTrades = sortedByProfit.slice(0, 5);
        const topLosingTrades = sortedByProfit.slice(-5).reverse();

        // 9. Cumulative Profit Over Time (exclude averaging SHORT)
        const cumulativeProfit: CumulativeProfitPoint[] = [];
        let runningTotal = 0;

        tradesForUSDStats.forEach((trade) => {
            runningTotal += trade.profitUSD;

            if (trade.closeDate) {
                cumulativeProfit.push({
                    date: new Date(trade.closeDate).toISOString().split('T')[0],
                    profit: runningTotal,
                });
            }
        });

        // 10. LONG-specific metrics
        const longProfitableTrades = longTrades.filter(t => t.profitUSD > 0);
        const longTotalProfitUSD = longTrades.reduce((sum, t) => sum + t.profitUSD, 0);
        const longTotalProfitPercent = longTrades.length > 0
            ? longTrades.reduce((sum, t) => sum + t.profitPercent, 0) / longTrades.length
            : 0;
        const longWinRate = longTrades.length > 0
            ? (longProfitableTrades.length / longTrades.length) * 100
            : 0;
        const longAvgProfitUSD = longTrades.length > 0
            ? longTotalProfitUSD / longTrades.length
            : 0;
        const longAvgProfitPercent = longTotalProfitPercent;

        // 11. SHORT-specific metrics (only standard SHORT, exclude averaging)
        const shortProfitCoins: Record<string, number> = {};
        const shortAvgProfitCoins: Record<string, number> = {};

        standardShortTrades.forEach(trade => {
            const profitCoins = calculateProfitCoins(trade);
            if (!shortProfitCoins[trade.coinSymbol]) {
                shortProfitCoins[trade.coinSymbol] = 0;
            }
            shortProfitCoins[trade.coinSymbol] += profitCoins;
        });

        // Calculate average profit per coin
        const shortCoinCounts: Record<string, number> = {};
        standardShortTrades.forEach(trade => {
            if (!shortCoinCounts[trade.coinSymbol]) {
                shortCoinCounts[trade.coinSymbol] = 0;
            }
            shortCoinCounts[trade.coinSymbol]++;
        });

        Object.keys(shortProfitCoins).forEach(coinSymbol => {
            shortAvgProfitCoins[coinSymbol] = shortProfitCoins[coinSymbol] / shortCoinCounts[coinSymbol];
        });

        const shortProfitableTrades = standardShortTrades.filter(t => calculateProfitCoins(t) > 0);
        const shortTotalProfitPercent = standardShortTrades.length > 0
            ? standardShortTrades.reduce((sum, t) => sum + t.profitPercent, 0) / standardShortTrades.length
            : 0;
        const shortWinRate = standardShortTrades.length > 0
            ? (shortProfitableTrades.length / standardShortTrades.length) * 100
            : 0;
        const shortAvgProfitPercent = shortTotalProfitPercent;

        // 12. Averaging SHORT metrics (internal operations)
        const avgShortProfitCoins: Record<string, number> = {};
        averagingShortTrades.forEach(trade => {
            const profitCoins = calculateProfitCoins(trade);
            if (!avgShortProfitCoins[trade.coinSymbol]) {
                avgShortProfitCoins[trade.coinSymbol] = 0;
            }
            avgShortProfitCoins[trade.coinSymbol] += profitCoins;
        });

        const avgShortProfitableTrades = averagingShortTrades.filter(t => calculateProfitCoins(t) > 0);
        const avgShortWinRate = averagingShortTrades.length > 0
            ? (avgShortProfitableTrades.length / averagingShortTrades.length) * 100
            : 0;
        const avgShortTotalProfitPercent = averagingShortTrades.length > 0
            ? averagingShortTrades.reduce((sum, t) => sum + t.profitPercent, 0) / averagingShortTrades.length
            : 0;

        const statistics: PortfolioStatistics = {
            totalProfitUSD,
            totalProfitPercent: avgProfitPercent,
            totalFeesPaid,
            standardFees,
            averagingFees,
            winRate,
            avgProfitUSD,
            avgProfitPercent,
            totalROI,
            totalTrades,
            bestTrade,
            worstTrade,
            performanceByCoin,
            topProfitableTrades,
            topLosingTrades,
            cumulativeProfit,
            long: {
                totalProfitUSD: longTotalProfitUSD,
                totalProfitPercent: longTotalProfitPercent,
                winRate: longWinRate,
                avgProfitUSD: longAvgProfitUSD,
                avgProfitPercent: longAvgProfitPercent,
                totalTrades: longTrades.length,
            },
            short: {
                totalProfitCoins: shortProfitCoins,
                totalProfitPercent: shortTotalProfitPercent,
                winRate: shortWinRate,
                avgProfitCoins: shortAvgProfitCoins,
                avgProfitPercent: shortAvgProfitPercent,
                totalTrades: standardShortTrades.length,
            },
            averaging: {
                totalProfitCoins: avgShortProfitCoins,
                totalProfitPercent: avgShortTotalProfitPercent,
                winRate: avgShortWinRate,
                totalTrades: averagingShortTrades.length,
            },
        };

        return NextResponse.json({
            success: true,
            data: statistics,
        });
    } catch (error) {
        console.error('Error calculating portfolio statistics:', error);
        return NextResponse.json(
            {
                success: false,
                error: 'Failed to calculate statistics',
            },
            {status: 500}
        );
    }
}
