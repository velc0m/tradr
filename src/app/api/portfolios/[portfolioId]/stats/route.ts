import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import Trade from '@/models/Trade';
import Portfolio from '@/models/Portfolio';
import {
  ApiResponse,
  PortfolioStatistics,
  TradeWithProfit,
  CoinPerformance,
  CumulativeProfitPoint,
  TradeStatus,
  TradeType,
  ITrade,
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
 *
 * IMPORTANT: Handles partial closes correctly
 * - For partial close trades: use actual amount and sumPlusFee from the trade
 * - For parent trades that were partially closed: use remainingAmount and proportional sumPlusFee
 */
const calculateProfitUSD = (trade: ITrade, logDetails: boolean = false): number => {
  if (!trade.exitPrice) return 0;

  let amountUsed = trade.amount;
  let sumPlusFeeUsed = trade.sumPlusFee;

  // For parent trades that were partially closed, we need to use remainingAmount
  // not the original amount, and proportional sumPlusFee
  if (!trade.isPartialClose && trade.remainingAmount && trade.originalAmount) {
    if (trade.remainingAmount < trade.originalAmount) {
      // This is the final close of a parent trade - use remaining amount
      amountUsed = trade.remainingAmount;
      const proportion = trade.remainingAmount / trade.originalAmount;
      sumPlusFeeUsed = trade.sumPlusFee * proportion;

      if (logDetails) {
        console.log('  [Parent Trade Final Close - Using Proportional Calculation]');
        console.log(`  - Original Amount: ${trade.originalAmount}`);
        console.log(`  - Remaining Amount: ${trade.remainingAmount}`);
        console.log(`  - Proportion: ${proportion.toFixed(4)} (${trade.remainingAmount}/${trade.originalAmount})`);
        console.log(`  - Original SumPlusFee: $${trade.sumPlusFee.toFixed(2)}`);
        console.log(`  - Proportional SumPlusFee: $${sumPlusFeeUsed.toFixed(2)}`);
      }
    }
  }

  const exitFeePercent = trade.exitFee || 0;
  const exitFeeMultiplier = (100 - exitFeePercent) / 100;
  const grossExitValue = amountUsed * trade.exitPrice;
  const netExitValue = grossExitValue * exitFeeMultiplier;
  const profitUSD = netExitValue - sumPlusFeeUsed;

  if (logDetails) {
    console.log('  [Profit USD Calculation Step-by-Step]');
    console.log(`  1. Amount Used: ${amountUsed}`);
    console.log(`  2. Exit Price: $${trade.exitPrice}`);
    console.log(`  3. Gross Exit Value: ${amountUsed} × $${trade.exitPrice} = $${grossExitValue.toFixed(2)}`);
    console.log(`  4. Exit Fee: ${exitFeePercent}%`);
    console.log(`  5. Exit Fee Multiplier: (100 - ${exitFeePercent}) / 100 = ${exitFeeMultiplier}`);
    console.log(`  6. Net Exit Value (after exit fee): $${grossExitValue.toFixed(2)} × ${exitFeeMultiplier} = $${netExitValue.toFixed(2)}`);
    console.log(`  7. Entry Cost (sumPlusFee): $${sumPlusFeeUsed.toFixed(2)}`);
    console.log(`  8. Profit USD: $${netExitValue.toFixed(2)} - $${sumPlusFeeUsed.toFixed(2)} = $${profitUSD.toFixed(2)}`);
  }

  return profitUSD;
};

/**
 * GET /api/portfolios/[portfolioId]/stats
 * Returns portfolio statistics
 */
export async function GET(
  request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse<ApiResponse<PortfolioStatistics>>> {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { portfolioId } = await params;

    await connectDB();

    // Verify portfolio exists and user owns it
    const portfolio = await Portfolio.findById(portfolioId);

    if (!portfolio) {
      return NextResponse.json(
        { success: false, error: 'Portfolio not found' },
        { status: 404 }
      );
    }

    if (portfolio.userId !== session.user.id) {
      return NextResponse.json(
        { success: false, error: 'Forbidden' },
        { status: 403 }
      );
    }

    // Get all trades for counting
    const allTrades = await Trade.find({ portfolioId });

    // Get only closed trades for statistics
    const closedTrades = await Trade.find({
      portfolioId,
      status: TradeStatus.CLOSED,
    }).sort({ closeDate: 1 });

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

    // 1. Total Profit/Loss
    const totalProfitUSD = tradesWithProfit.reduce(
      (sum, trade) => sum + trade.profitUSD,
      0
    );

    const sumOfProfitPercents = tradesWithProfit.reduce((sum, trade) => sum + trade.profitPercent, 0);
    const avgProfitPercent =
      tradesWithProfit.length > 0
        ? sumOfProfitPercents / tradesWithProfit.length
        : 0;

    // Calculate Total Fees Paid
    const totalFeesPaid = closedTrades.reduce((sum, trade) => {
      let tradeFees = 0;

      // Entry fee: always present
      const entryFee = (trade.sumPlusFee * trade.entryFee) / 100;
      tradeFees += entryFee;

      // Exit fee: only for closed trades with exitPrice
      if (trade.exitPrice && trade.exitFee !== undefined) {
        const exitFee = (trade.amount * trade.exitPrice * trade.exitFee) / 100;
        tradeFees += exitFee;
      }

      return sum + tradeFees;
    }, 0);

    // 2. Win Rate
    const profitableTrades = tradesWithProfit.filter((t) => t.profitUSD > 0);
    const winRate =
      tradesWithProfit.length > 0
        ? (profitableTrades.length / tradesWithProfit.length) * 100
        : 0;

    // 3. Average Profit
    const avgProfitUSD =
      tradesWithProfit.length > 0
        ? totalProfitUSD / tradesWithProfit.length
        : 0;

    // 4. Total ROI
    const totalInvestment = tradesWithProfit.reduce(
      (sum, trade) => sum + trade.sumPlusFee,
      0
    );
    const totalROI =
      totalInvestment > 0 ? (totalProfitUSD / totalInvestment) * 100 : 0;

    // 5. Total Trades by Status
    const openTrades = allTrades.filter((t) => t.status === TradeStatus.OPEN);
    const filledTrades = allTrades.filter((t) => t.status === TradeStatus.FILLED);

    const totalTrades = {
      open: openTrades.length,
      filled: filledTrades.length,
      closed: closedTrades.length,
    };

    // 6. Best/Worst Trade (by Profit USD)
    let bestTrade = null;
    let worstTrade = null;

    if (tradesWithProfit.length > 0) {
      const sortedByProfitUSD = [...tradesWithProfit].sort(
        (a, b) => b.profitUSD - a.profitUSD
      );
      bestTrade = { trade: sortedByProfitUSD[0] };
      worstTrade = { trade: sortedByProfitUSD[sortedByProfitUSD.length - 1] };
    }

    // 7. Performance by Coin
    const coinGroups = new Map<string, TradeWithProfit[]>();
    tradesWithProfit.forEach((trade) => {
      if (!coinGroups.has(trade.coinSymbol)) {
        coinGroups.set(trade.coinSymbol, []);
      }
      coinGroups.get(trade.coinSymbol)!.push(trade);
    });

    const performanceByCoin: CoinPerformance[] = Array.from(
      coinGroups.entries()
    ).map(([coinSymbol, trades]) => {
      const coinProfitableTrades = trades.filter((t) => t.profitUSD > 0);
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

    // 8. Top 5 Profitable and Losing Trades
    const sortedByProfit = [...tradesWithProfit].sort(
      (a, b) => b.profitUSD - a.profitUSD
    );

    const topProfitableTrades = sortedByProfit.slice(0, 5);
    const topLosingTrades = sortedByProfit.slice(-5).reverse();

    // 9. Cumulative Profit Over Time
    const cumulativeProfit: CumulativeProfitPoint[] = [];
    let runningTotal = 0;

    tradesWithProfit.forEach((trade) => {
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

    // 11. SHORT-specific metrics
    const shortProfitCoins: Record<string, number> = {};
    const shortAvgProfitCoins: Record<string, number> = {};

    shortTrades.forEach(trade => {
      const profitCoins = calculateProfitCoins(trade);
      if (!shortProfitCoins[trade.coinSymbol]) {
        shortProfitCoins[trade.coinSymbol] = 0;
      }
      shortProfitCoins[trade.coinSymbol] += profitCoins;
    });

    // Calculate average profit per coin
    const shortCoinCounts: Record<string, number> = {};
    shortTrades.forEach(trade => {
      if (!shortCoinCounts[trade.coinSymbol]) {
        shortCoinCounts[trade.coinSymbol] = 0;
      }
      shortCoinCounts[trade.coinSymbol]++;
    });

    Object.keys(shortProfitCoins).forEach(coinSymbol => {
      shortAvgProfitCoins[coinSymbol] = shortProfitCoins[coinSymbol] / shortCoinCounts[coinSymbol];
    });

    const shortProfitableTrades = shortTrades.filter(t => calculateProfitCoins(t) > 0);
    const shortTotalProfitPercent = shortTrades.length > 0
      ? shortTrades.reduce((sum, t) => sum + t.profitPercent, 0) / shortTrades.length
      : 0;
    const shortWinRate = shortTrades.length > 0
      ? (shortProfitableTrades.length / shortTrades.length) * 100
      : 0;
    const shortAvgProfitPercent = shortTotalProfitPercent;

    const statistics: PortfolioStatistics = {
      totalProfitUSD,
      totalProfitPercent: avgProfitPercent,
      totalFeesPaid,
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
        totalTrades: shortTrades.length,
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
      { status: 500 }
    );
  }
}
