import {clearTestDB, closeTestDB, connectTestDB} from '../helpers/db';
import Trade from '@/models/Trade';
import Portfolio from '@/models/Portfolio';
import {TradeStatus, TradeType} from '@/types';
import {calculateLongProfitPercent, calculateLongProfitUSD, calculateShortProfitCoins,} from '@/lib/calculations';

/**
 * Portfolio Statistics Tests
 *
 * Tests aggregation and calculation of portfolio-level statistics:
 * - LONG statistics: total profit USD, win rate, average profit
 * - SHORT statistics: total profit coins (by symbol), win rate
 * - Performance by coin
 * - Best/worst trades
 */
describe('Portfolio Statistics', () => {
    let testPortfolioId: string;

    beforeAll(async () => {
        await connectTestDB();
    });

    afterAll(async () => {
        await closeTestDB();
    });

    beforeEach(async () => {
        // Create test portfolio
        const portfolio = await Portfolio.create({
            userId: 'test-user-id',
            name: 'Test Portfolio',
            totalDeposit: 10000,
            coins: [
                {symbol: 'BTC', percentage: 50, decimalPlaces: 8},
                {symbol: 'ETH', percentage: 50, decimalPlaces: 6},
            ],
        });
        testPortfolioId = portfolio._id.toString();
    });

    afterEach(async () => {
        await clearTestDB();
    });

    describe('LONG Position Statistics', () => {
        // ⚠️ CRITICAL TEST - Verifies total profit aggregation for LONG
        // Why: Users need to see their total profit across all LONG positions
        // If this breaks: Portfolio performance will be incorrect
        it('should calculate total profit USD for all LONG trades', async () => {
            // Create 3 closed LONG trades
            // Trade 1: +78.11 USD profit
            await Trade.create({
                portfolioId: testPortfolioId,
                coinSymbol: 'BTC',
                tradeType: TradeType.LONG,
                status: TradeStatus.CLOSED,
                entryPrice: 100000,
                depositPercent: 10,
                entryFee: 1,
                sumPlusFee: 1000,
                amount: 0.0099,
                initialEntryPrice: 100000,
                initialAmount: 0.0099,
                exitPrice: 110000,
                exitFee: 1,
                openDate: new Date(),
                filledDate: new Date(),
                closeDate: new Date(),
            });

            // Trade 2: -117.91 USD loss
            await Trade.create({
                portfolioId: testPortfolioId,
                coinSymbol: 'BTC',
                tradeType: TradeType.LONG,
                status: TradeStatus.CLOSED,
                entryPrice: 100000,
                depositPercent: 10,
                entryFee: 1,
                sumPlusFee: 1000,
                amount: 0.0099,
                initialEntryPrice: 100000,
                initialAmount: 0.0099,
                exitPrice: 90000,
                exitFee: 1,
                openDate: new Date(),
                filledDate: new Date(),
                closeDate: new Date(),
            });

            // Trade 3: +34.55 USD profit (high exit fee)
            await Trade.create({
                portfolioId: testPortfolioId,
                coinSymbol: 'ETH',
                tradeType: TradeType.LONG,
                status: TradeStatus.CLOSED,
                entryPrice: 100000,
                depositPercent: 10,
                entryFee: 1,
                sumPlusFee: 1000,
                amount: 0.0099,
                initialEntryPrice: 100000,
                initialAmount: 0.0099,
                exitPrice: 110000,
                exitFee: 5,
                openDate: new Date(),
                filledDate: new Date(),
                closeDate: new Date(),
            });

            // Calculate total profit
            const closedLongs = await Trade.find({
                portfolioId: testPortfolioId,
                tradeType: TradeType.LONG,
                status: TradeStatus.CLOSED,
            });

            const totalProfitUSD = closedLongs.reduce((sum, trade) => {
                const profit = calculateLongProfitUSD(
                    trade.amount,
                    trade.sumPlusFee,
                    trade.exitPrice!,
                    trade.exitFee!
                );
                return sum + profit;
            }, 0);

            // Total: 78.11 - 117.91 + 34.55 = -5.25 USD
            expect(totalProfitUSD).toBeCloseTo(-5.25, 1);
        });

        // ⚠️ CRITICAL TEST - Win rate calculation
        // Why: Key metric for portfolio performance evaluation
        // If this breaks: Users won't know their success rate
        it('should calculate win rate for LONG trades', async () => {
            // Create 5 trades: 3 profitable, 2 losing
            const trades = [
                {exitPrice: 110000, exitFee: 1}, // Profit
                {exitPrice: 90000, exitFee: 1}, // Loss
                {exitPrice: 105000, exitFee: 1}, // Profit
                {exitPrice: 95000, exitFee: 1}, // Loss
                {exitPrice: 120000, exitFee: 1}, // Profit
            ];

            for (const tradeData of trades) {
                await Trade.create({
                    portfolioId: testPortfolioId,
                    coinSymbol: 'BTC',
                    tradeType: TradeType.LONG,
                    status: TradeStatus.CLOSED,
                    entryPrice: 100000,
                    depositPercent: 10,
                    entryFee: 1,
                    sumPlusFee: 1000,
                    amount: 0.0099,
                    initialEntryPrice: 100000,
                    initialAmount: 0.0099,
                    exitPrice: tradeData.exitPrice,
                    exitFee: tradeData.exitFee,
                    openDate: new Date(),
                    filledDate: new Date(),
                    closeDate: new Date(),
                });
            }

            // Calculate win rate
            const closedLongs = await Trade.find({
                portfolioId: testPortfolioId,
                tradeType: TradeType.LONG,
                status: TradeStatus.CLOSED,
            });

            const profitableTrades = closedLongs.filter((trade) => {
                const profit = calculateLongProfitUSD(
                    trade.amount,
                    trade.sumPlusFee,
                    trade.exitPrice!,
                    trade.exitFee!
                );
                return profit > 0;
            });

            const winRate = (profitableTrades.length / closedLongs.length) * 100;

            // 3 profitable out of 5 = 60%
            expect(winRate).toBe(60);
            expect(profitableTrades.length).toBe(3);
            expect(closedLongs.length).toBe(5);
        });

        it('should calculate average profit USD for LONG trades', async () => {
            // Create 3 trades with different profits
            await Trade.create({
                portfolioId: testPortfolioId,
                coinSymbol: 'BTC',
                tradeType: TradeType.LONG,
                status: TradeStatus.CLOSED,
                entryPrice: 100000,
                depositPercent: 10,
                entryFee: 1,
                sumPlusFee: 1000,
                amount: 0.0099,
                initialEntryPrice: 100000,
                initialAmount: 0.0099,
                exitPrice: 110000,
                exitFee: 1,
                openDate: new Date(),
                filledDate: new Date(),
                closeDate: new Date(),
            });

            await Trade.create({
                portfolioId: testPortfolioId,
                coinSymbol: 'BTC',
                tradeType: TradeType.LONG,
                status: TradeStatus.CLOSED,
                entryPrice: 100000,
                depositPercent: 10,
                entryFee: 1,
                sumPlusFee: 1000,
                amount: 0.0099,
                initialEntryPrice: 100000,
                initialAmount: 0.0099,
                exitPrice: 120000,
                exitFee: 1,
                openDate: new Date(),
                filledDate: new Date(),
                closeDate: new Date(),
            });

            await Trade.create({
                portfolioId: testPortfolioId,
                coinSymbol: 'BTC',
                tradeType: TradeType.LONG,
                status: TradeStatus.CLOSED,
                entryPrice: 100000,
                depositPercent: 10,
                entryFee: 1,
                sumPlusFee: 1000,
                amount: 0.0099,
                initialEntryPrice: 100000,
                initialAmount: 0.0099,
                exitPrice: 90000,
                exitFee: 1,
                openDate: new Date(),
                filledDate: new Date(),
                closeDate: new Date(),
            });

            const closedLongs = await Trade.find({
                portfolioId: testPortfolioId,
                tradeType: TradeType.LONG,
                status: TradeStatus.CLOSED,
            });

            const totalProfit = closedLongs.reduce((sum, trade) => {
                const profit = calculateLongProfitUSD(
                    trade.amount,
                    trade.sumPlusFee,
                    trade.exitPrice!,
                    trade.exitFee!
                );
                return sum + profit;
            }, 0);

            const avgProfitUSD = totalProfit / closedLongs.length;

            // Profits: 78.11 + 176.12 - 117.91 = 136.32 USD total
            // Average: 136.32 / 3 = 45.44 USD
            expect(avgProfitUSD).toBeCloseTo(45.44, 0);
        });

        it('should calculate average profit percent for LONG trades', async () => {
            // Create 3 trades
            const tradesData = [
                {exitPrice: 110000}, // +8% (10% - 1% - 1%)
                {exitPrice: 120000}, // +18% (20% - 1% - 1%)
                {exitPrice: 90000}, // -12% (-10% - 1% - 1%)
            ];

            for (const tradeData of tradesData) {
                await Trade.create({
                    portfolioId: testPortfolioId,
                    coinSymbol: 'BTC',
                    tradeType: TradeType.LONG,
                    status: TradeStatus.CLOSED,
                    entryPrice: 100000,
                    depositPercent: 10,
                    entryFee: 1,
                    sumPlusFee: 1000,
                    amount: 0.0099,
                    initialEntryPrice: 100000,
                    initialAmount: 0.0099,
                    exitPrice: tradeData.exitPrice,
                    exitFee: 1,
                    openDate: new Date(),
                    filledDate: new Date(),
                    closeDate: new Date(),
                });
            }

            const closedLongs = await Trade.find({
                portfolioId: testPortfolioId,
                tradeType: TradeType.LONG,
                status: TradeStatus.CLOSED,
            });

            const totalPercent = closedLongs.reduce((sum, trade) => {
                const profitPercent = calculateLongProfitPercent(
                    trade.entryPrice,
                    trade.exitPrice!,
                    trade.entryFee,
                    trade.exitFee!
                );
                return sum + profitPercent;
            }, 0);

            const avgProfitPercent = totalPercent / closedLongs.length;

            // Average: (8 + 18 - 12) / 3 = 4.67%
            expect(avgProfitPercent).toBeCloseTo(4.67, 1);
        });
    });

    describe('SHORT Position Statistics', () => {
        // ⚠️ CRITICAL TEST - SHORT profit is in COINS, grouped by symbol
        // Why: SHORT profits are different currency (coins, not USD)
        // If this breaks: SHORT statistics will be wrong
        it('should calculate total profit in coins for SHORT trades (by symbol)', async () => {
            // Create parent LONG for BTC
            const btcLong = await Trade.create({
                portfolioId: testPortfolioId,
                coinSymbol: 'BTC',
                tradeType: TradeType.LONG,
                status: TradeStatus.FILLED,
                entryPrice: 100000,
                depositPercent: 50,
                entryFee: 1,
                sumPlusFee: 5050,
                amount: 0.05,
                initialEntryPrice: 100000,
                initialAmount: 0.05,
                openDate: new Date(),
                filledDate: new Date(),
            });

            // Create parent LONG for ETH
            const ethLong = await Trade.create({
                portfolioId: testPortfolioId,
                coinSymbol: 'ETH',
                tradeType: TradeType.LONG,
                status: TradeStatus.FILLED,
                entryPrice: 3000,
                depositPercent: 50,
                entryFee: 1,
                sumPlusFee: 5050,
                amount: 1.68,
                initialEntryPrice: 3000,
                initialAmount: 1.68,
                openDate: new Date(),
                filledDate: new Date(),
            });

            // SHORT 1: BTC - 0.02 sold, buy back at lower price
            await Trade.create({
                portfolioId: testPortfolioId,
                parentTradeId: btcLong._id.toString(),
                coinSymbol: 'BTC',
                tradeType: TradeType.SHORT,
                status: TradeStatus.CLOSED,
                entryPrice: 110000, // Sold at 110k
                depositPercent: 40,
                entryFee: 1,
                sumPlusFee: 2178, // 0.02 × 110k × 0.99
                amount: 0.02,
                initialEntryPrice: 110000,
                initialAmount: 0.02,
                exitPrice: 100000, // Buy back at 100k
                exitFee: 1,
                openDate: new Date(),
                filledDate: new Date(),
                closeDate: new Date(),
            });

            // SHORT 2: BTC - another one
            await Trade.create({
                portfolioId: testPortfolioId,
                parentTradeId: btcLong._id.toString(),
                coinSymbol: 'BTC',
                tradeType: TradeType.SHORT,
                status: TradeStatus.CLOSED,
                entryPrice: 115000,
                depositPercent: 40,
                entryFee: 1,
                sumPlusFee: 2277, // 0.02 × 115k × 0.99
                amount: 0.02,
                initialEntryPrice: 115000,
                initialAmount: 0.02,
                exitPrice: 105000,
                exitFee: 1,
                openDate: new Date(),
                filledDate: new Date(),
                closeDate: new Date(),
            });

            // SHORT 3: ETH
            await Trade.create({
                portfolioId: testPortfolioId,
                parentTradeId: ethLong._id.toString(),
                coinSymbol: 'ETH',
                tradeType: TradeType.SHORT,
                status: TradeStatus.CLOSED,
                entryPrice: 3300,
                depositPercent: 50,
                entryFee: 1,
                sumPlusFee: 2772.6, // 0.84 × 3300 × 0.99
                amount: 0.84,
                initialEntryPrice: 3300,
                initialAmount: 0.84,
                exitPrice: 3000,
                exitFee: 1,
                openDate: new Date(),
                filledDate: new Date(),
                closeDate: new Date(),
            });

            // Calculate total profit by coin
            const closedShorts = await Trade.find({
                portfolioId: testPortfolioId,
                tradeType: TradeType.SHORT,
                status: TradeStatus.CLOSED,
            });

            const profitByCoin: Record<string, number> = {};

            closedShorts.forEach((trade) => {
                const profitCoins = calculateShortProfitCoins(
                    trade.amount,
                    trade.sumPlusFee,
                    trade.exitPrice!,
                    trade.exitFee!
                );

                if (!profitByCoin[trade.coinSymbol]) {
                    profitByCoin[trade.coinSymbol] = 0;
                }
                profitByCoin[trade.coinSymbol] += profitCoins;
            });

            // BTC SHORT 1: 2178 / 101000 - 0.02 = 0.00156 BTC
            // BTC SHORT 2: 2277 / 106050 - 0.02 = 0.00147 BTC
            // Total BTC: ~0.00303 BTC
            expect(profitByCoin['BTC']).toBeCloseTo(0.00303, 4);

            // ETH SHORT: 2772.6 / 3030 - 0.84 = 0.0749 ETH
            expect(profitByCoin['ETH']).toBeCloseTo(0.0749, 3);
        });

        it('should calculate win rate for SHORT trades', async () => {
            // Create parent LONG
            const parentLong = await Trade.create({
                portfolioId: testPortfolioId,
                coinSymbol: 'BTC',
                tradeType: TradeType.LONG,
                status: TradeStatus.FILLED,
                entryPrice: 100000,
                depositPercent: 50,
                entryFee: 1,
                sumPlusFee: 5050,
                amount: 0.05,
                initialEntryPrice: 100000,
                initialAmount: 0.05,
                openDate: new Date(),
                filledDate: new Date(),
            });

            // Create 3 SHORT: 2 profitable, 1 losing
            const shortsData = [
                {entryPrice: 110000, exitPrice: 100000}, // Profit (sold high, bought low)
                {entryPrice: 110000, exitPrice: 115000}, // Loss (price went up)
                {entryPrice: 105000, exitPrice: 95000}, // Profit (sold high, bought low)
            ];

            for (const shortData of shortsData) {
                const soldAmount = 0.01;
                const sumPlusFee = soldAmount * shortData.entryPrice * 0.99;

                await Trade.create({
                    portfolioId: testPortfolioId,
                    parentTradeId: parentLong._id.toString(),
                    coinSymbol: 'BTC',
                    tradeType: TradeType.SHORT,
                    status: TradeStatus.CLOSED,
                    entryPrice: shortData.entryPrice,
                    depositPercent: 20,
                    entryFee: 1,
                    sumPlusFee,
                    amount: soldAmount,
                    initialEntryPrice: shortData.entryPrice,
                    initialAmount: soldAmount,
                    exitPrice: shortData.exitPrice,
                    exitFee: 1,
                    openDate: new Date(),
                    filledDate: new Date(),
                    closeDate: new Date(),
                });
            }

            const closedShorts = await Trade.find({
                portfolioId: testPortfolioId,
                tradeType: TradeType.SHORT,
                status: TradeStatus.CLOSED,
            });

            const profitableShorts = closedShorts.filter((trade) => {
                const profitCoins = calculateShortProfitCoins(
                    trade.amount,
                    trade.sumPlusFee,
                    trade.exitPrice!,
                    trade.exitFee!
                );
                return profitCoins > 0;
            });

            const winRate = (profitableShorts.length / closedShorts.length) * 100;

            // 2 profitable out of 3 = 66.67%
            expect(winRate).toBeCloseTo(66.67, 1);
            expect(profitableShorts.length).toBe(2);
        });
    });

    describe('Performance by Coin', () => {
        it('should group LONG statistics by coin symbol', async () => {
            // Create BTC trades
            await Trade.create({
                portfolioId: testPortfolioId,
                coinSymbol: 'BTC',
                tradeType: TradeType.LONG,
                status: TradeStatus.CLOSED,
                entryPrice: 100000,
                depositPercent: 10,
                entryFee: 1,
                sumPlusFee: 1000,
                amount: 0.0099,
                initialEntryPrice: 100000,
                initialAmount: 0.0099,
                exitPrice: 110000,
                exitFee: 1,
                openDate: new Date(),
                filledDate: new Date(),
                closeDate: new Date(),
            });

            await Trade.create({
                portfolioId: testPortfolioId,
                coinSymbol: 'BTC',
                tradeType: TradeType.LONG,
                status: TradeStatus.CLOSED,
                entryPrice: 100000,
                depositPercent: 10,
                entryFee: 1,
                sumPlusFee: 1000,
                amount: 0.0099,
                initialEntryPrice: 100000,
                initialAmount: 0.0099,
                exitPrice: 90000,
                exitFee: 1,
                openDate: new Date(),
                filledDate: new Date(),
                closeDate: new Date(),
            });

            // Create ETH trades
            await Trade.create({
                portfolioId: testPortfolioId,
                coinSymbol: 'ETH',
                tradeType: TradeType.LONG,
                status: TradeStatus.CLOSED,
                entryPrice: 3000,
                depositPercent: 15,
                entryFee: 1,
                sumPlusFee: 1515,
                amount: 0.5,
                initialEntryPrice: 3000,
                initialAmount: 0.5,
                exitPrice: 3300,
                exitFee: 1,
                openDate: new Date(),
                filledDate: new Date(),
                closeDate: new Date(),
            });

            // Group by coin
            const closedLongs = await Trade.find({
                portfolioId: testPortfolioId,
                tradeType: TradeType.LONG,
                status: TradeStatus.CLOSED,
            });

            const performanceByCoin: Record<
                string,
                { totalProfit: number; count: number; avgProfit: number }
            > = {};

            closedLongs.forEach((trade) => {
                const profit = calculateLongProfitUSD(
                    trade.amount,
                    trade.sumPlusFee,
                    trade.exitPrice!,
                    trade.exitFee!
                );

                if (!performanceByCoin[trade.coinSymbol]) {
                    performanceByCoin[trade.coinSymbol] = {
                        totalProfit: 0,
                        count: 0,
                        avgProfit: 0,
                    };
                }

                performanceByCoin[trade.coinSymbol].totalProfit += profit;
                performanceByCoin[trade.coinSymbol].count += 1;
            });

            // Calculate averages
            Object.keys(performanceByCoin).forEach((symbol) => {
                const data = performanceByCoin[symbol];
                data.avgProfit = data.totalProfit / data.count;
            });

            // BTC: 79 - 119 = -40 USD, avg = -20 USD
            expect(performanceByCoin['BTC'].totalProfit).toBeCloseTo(-40, 0);
            expect(performanceByCoin['BTC'].count).toBe(2);
            expect(performanceByCoin['BTC'].avgProfit).toBeCloseTo(-20, 0);

            // ETH: 0.5 × 3300 × 0.99 - 1515 = 118.5 USD
            expect(performanceByCoin['ETH'].totalProfit).toBeCloseTo(118.5, 1);
            expect(performanceByCoin['ETH'].count).toBe(1);
            expect(performanceByCoin['ETH'].avgProfit).toBeCloseTo(118.5, 1);
        });
    });

    describe('Best and Worst Trades', () => {
        it('should identify best and worst LONG trades by profit USD', async () => {
            const tradesData = [
                {exitPrice: 110000}, // +78.11 USD
                {exitPrice: 90000}, // -117.91 USD (worst)
                {exitPrice: 120000}, // +176.12 USD (best)
                {exitPrice: 105000}, // +29.11 USD
            ];

            const createdTrades = [];
            for (const tradeData of tradesData) {
                const trade = await Trade.create({
                    portfolioId: testPortfolioId,
                    coinSymbol: 'BTC',
                    tradeType: TradeType.LONG,
                    status: TradeStatus.CLOSED,
                    entryPrice: 100000,
                    depositPercent: 10,
                    entryFee: 1,
                    sumPlusFee: 1000,
                    amount: 0.0099,
                    initialEntryPrice: 100000,
                    initialAmount: 0.0099,
                    exitPrice: tradeData.exitPrice,
                    exitFee: 1,
                    openDate: new Date(),
                    filledDate: new Date(),
                    closeDate: new Date(),
                });
                createdTrades.push(trade);
            }

            const closedLongs = await Trade.find({
                portfolioId: testPortfolioId,
                tradeType: TradeType.LONG,
                status: TradeStatus.CLOSED,
            });

            // Calculate profits for each trade
            const tradesWithProfit = closedLongs.map((trade) => ({
                trade,
                profit: calculateLongProfitUSD(
                    trade.amount,
                    trade.sumPlusFee,
                    trade.exitPrice!,
                    trade.exitFee!
                ),
            }));

            // Sort by profit
            tradesWithProfit.sort((a, b) => b.profit - a.profit);

            const bestTrade = tradesWithProfit[0];
            const worstTrade = tradesWithProfit[tradesWithProfit.length - 1];

            expect(bestTrade.trade.exitPrice).toBe(120000);
            expect(bestTrade.profit).toBeCloseTo(176.12, 0);

            expect(worstTrade.trade.exitPrice).toBe(90000);
            expect(worstTrade.profit).toBeCloseTo(-117.91, 0);
        });
    });

    describe('Mixed Portfolio Statistics', () => {
        it('should calculate separate statistics for LONG and SHORT in same portfolio', async () => {
            // Create parent LONG
            const parentLong = await Trade.create({
                portfolioId: testPortfolioId,
                coinSymbol: 'BTC',
                tradeType: TradeType.LONG,
                status: TradeStatus.CLOSED,
                entryPrice: 100000,
                depositPercent: 50,
                entryFee: 1,
                sumPlusFee: 5050,
                amount: 0.05,
                initialEntryPrice: 100000,
                initialAmount: 0.05,
                exitPrice: 110000,
                exitFee: 1,
                openDate: new Date(),
                filledDate: new Date(),
                closeDate: new Date(),
            });

            // Create another LONG
            await Trade.create({
                portfolioId: testPortfolioId,
                coinSymbol: 'ETH',
                tradeType: TradeType.LONG,
                status: TradeStatus.CLOSED,
                entryPrice: 3000,
                depositPercent: 30,
                entryFee: 1,
                sumPlusFee: 3030,
                amount: 1.0,
                initialEntryPrice: 3000,
                initialAmount: 1.0,
                exitPrice: 2800,
                exitFee: 1,
                openDate: new Date(),
                filledDate: new Date(),
                closeDate: new Date(),
            });

            // Create SHORT
            await Trade.create({
                portfolioId: testPortfolioId,
                parentTradeId: parentLong._id.toString(),
                coinSymbol: 'BTC',
                tradeType: TradeType.SHORT,
                status: TradeStatus.CLOSED,
                entryPrice: 110000,
                depositPercent: 40,
                entryFee: 1,
                sumPlusFee: 2178,
                amount: 0.02,
                initialEntryPrice: 110000,
                initialAmount: 0.02,
                exitPrice: 100000,
                exitFee: 1,
                openDate: new Date(),
                filledDate: new Date(),
                closeDate: new Date(),
            });

            // Calculate LONG stats
            const closedLongs = await Trade.find({
                portfolioId: testPortfolioId,
                tradeType: TradeType.LONG,
                status: TradeStatus.CLOSED,
            });

            const longTotalProfit = closedLongs.reduce((sum, trade) => {
                const profit = calculateLongProfitUSD(
                    trade.amount,
                    trade.sumPlusFee,
                    trade.exitPrice!,
                    trade.exitFee!
                );
                return sum + profit;
            }, 0);

            // Calculate SHORT stats
            const closedShorts = await Trade.find({
                portfolioId: testPortfolioId,
                tradeType: TradeType.SHORT,
                status: TradeStatus.CLOSED,
            });

            const shortTotalProfitBTC = closedShorts
                .filter((t) => t.coinSymbol === 'BTC')
                .reduce((sum, trade) => {
                    const profit = calculateShortProfitCoins(
                        trade.amount,
                        trade.sumPlusFee,
                        trade.exitPrice!,
                        trade.exitFee!
                    );
                    return sum + profit;
                }, 0);

            // LONG 1: 0.05 × 110000 × 0.99 - 5050 = 395 USD
            // LONG 2: 1.0 × 2800 × 0.99 - 3030 = -258 USD
            // Total LONG: 395 - 258 = 137 USD
            expect(longTotalProfit).toBeCloseTo(137, 0);

            // SHORT: 2178 / 101000 - 0.02 = 0.00156 BTC
            expect(shortTotalProfitBTC).toBeCloseTo(0.00156, 4);

            expect(closedLongs.length).toBe(2);
            expect(closedShorts.length).toBe(1);
        });
    });
});
