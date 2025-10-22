import {clearTestDB, closeTestDB, connectTestDB} from '../helpers/db';
import Trade from '@/models/Trade';
import Portfolio from '@/models/Portfolio';
import {TradeStatus, TradeType} from '@/types';
import {calculateLongProfitPercent, calculateLongProfitUSD,} from '@/lib/calculations';

/**
 * LONG Lifecycle Tests
 *
 * Tests the complete lifecycle of a LONG position:
 * 1. Open (user plans the trade)
 * 2. Fill (user enters actual data from exchange)
 * 3. Close (user sells the position)
 *
 * Tests both profitable and unprofitable scenarios
 */
describe('LONG Position Lifecycle', () => {
    let testPortfolioId: string;

    beforeAll(async () => {
        await connectTestDB();
    });

    afterAll(async () => {
        await closeTestDB();
    });

    beforeEach(async () => {
        // Create test portfolio with 10,000 USD
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

    describe('Opening LONG Position', () => {
        it('should open a LONG position with planned data', async () => {
            // User plans to buy BTC at 100,000 with 10% of portfolio
            const trade = await Trade.create({
                portfolioId: testPortfolioId,
                coinSymbol: 'BTC',
                tradeType: TradeType.LONG,
                status: TradeStatus.OPEN,
                entryPrice: 100000,
                depositPercent: 10, // 10% of 10,000 = 1,000 USD
                entryFee: 1,
                sumPlusFee: 1000, // User enters 1000 USD (fee deducted inside)
                amount: 0.0099, // After 1% fee: 1000 * 0.99 / 100000
                initialEntryPrice: 100000,
                initialAmount: 0.0099,
            });

            expect(trade).toBeDefined();
            expect(trade.status).toBe(TradeStatus.OPEN);
            expect(trade.tradeType).toBe(TradeType.LONG);
            expect(trade.coinSymbol).toBe('BTC');
            expect(trade.entryPrice).toBe(100000);
            expect(trade.depositPercent).toBe(10);
            expect(trade.openDate).toBeDefined();
        });
    });

    describe('Filling LONG Position', () => {
        it('should fill LONG position with actual data from exchange', async () => {
            // Create OPEN trade
            const trade = await Trade.create({
                portfolioId: testPortfolioId,
                coinSymbol: 'BTC',
                tradeType: TradeType.LONG,
                status: TradeStatus.OPEN,
                entryPrice: 100000,
                depositPercent: 10,
                entryFee: 1,
                sumPlusFee: 1000,
                amount: 0.0099,
                initialEntryPrice: 100000,
                initialAmount: 0.0099,
            });

            // Fill with actual data from exchange
            trade.status = TradeStatus.FILLED;
            trade.sumPlusFee = 1012; // Actual: 1012 USD spent (from exchange)
            trade.amount = 0.010019; // Actual: 1012 * 0.99 / 100000 = 0.010019 BTC
            trade.filledDate = new Date();
            await trade.save();

            expect(trade.status).toBe(TradeStatus.FILLED);
            expect(trade.sumPlusFee).toBe(1012);
            expect(trade.amount).toBeCloseTo(0.010019, 6);
            expect(trade.filledDate).toBeDefined();

            // Initial values should remain unchanged
            expect(trade.initialEntryPrice).toBe(100000);
            expect(trade.initialAmount).toBe(0.0099);
        });
    });

    describe('Closing LONG Position - Profitable', () => {
        // ⚠️ CRITICAL TEST - Verifies profit calculation in real scenario
        // This is what users see in their portfolio
        it('should close LONG position with profit', async () => {
            // Create and fill LONG trade
            const trade = await Trade.create({
                portfolioId: testPortfolioId,
                coinSymbol: 'BTC',
                tradeType: TradeType.LONG,
                status: TradeStatus.FILLED,
                entryPrice: 100000,
                depositPercent: 10,
                entryFee: 1,
                sumPlusFee: 1000, // Spent 1000 USD
                amount: 0.0099, // Got 0.0099 BTC (after 1% fee)
                initialEntryPrice: 100000,
                initialAmount: 0.0099,
                filledDate: new Date(),
            });

            // Close position at higher price (profit!)
            trade.status = TradeStatus.CLOSED;
            trade.exitPrice = 110000; // BTC went up to 110,000
            trade.exitFee = 1; // 1% exit fee
            trade.closeDate = new Date();
            await trade.save();

            // Calculate profit using our function
            const profitUSD = calculateLongProfitUSD(
                trade.amount,
                trade.sumPlusFee,
                trade.exitPrice,
                trade.exitFee
            );

            const profitPercent = calculateLongProfitPercent(
                trade.entryPrice,
                trade.exitPrice,
                trade.entryFee,
                trade.exitFee
            );

            // Verify calculations
            // Exit value: 0.0099 × 110,000 × 0.99 = 1078.11 USD
            // Profit: 1078.11 - 1000 = 78.11 USD
            expect(profitUSD).toBeCloseTo(78.11, 1);

            // Price change: +10%, minus fees: 10% - 1% - 1% = 8%
            expect(profitPercent).toBeCloseTo(8, 1);
            expect(profitUSD).toBeGreaterThan(0);

            // Trade should be closed
            expect(trade.status).toBe(TradeStatus.CLOSED);
            expect(trade.closeDate).toBeDefined();
        });

        it('should handle large profits correctly', async () => {
            // Scenario: BTC doubles in price
            const trade = await Trade.create({
                portfolioId: testPortfolioId,
                coinSymbol: 'BTC',
                tradeType: TradeType.LONG,
                status: TradeStatus.FILLED,
                entryPrice: 50000,
                depositPercent: 20,
                entryFee: 1,
                sumPlusFee: 2000, // Spent 2000 USD
                amount: 0.0396, // Got 0.0396 BTC (2000 * 0.99 / 50000)
                initialEntryPrice: 50000,
                initialAmount: 0.0396,
                filledDate: new Date(),
            });

            // Price doubles!
            trade.status = TradeStatus.CLOSED;
            trade.exitPrice = 100000; // Doubled!
            trade.exitFee = 1;
            trade.closeDate = new Date();
            await trade.save();

            const profitUSD = calculateLongProfitUSD(
                trade.amount,
                trade.sumPlusFee,
                trade.exitPrice,
                trade.exitFee
            );

            // Exit value: 0.0396 × 100,000 × 0.99 = 3920.4 USD
            // Profit: 3920.4 - 2000 = 1920.4 USD (~96% profit)
            expect(profitUSD).toBeCloseTo(1920.4, 1);
            expect(profitUSD).toBeGreaterThan(1900); // Should be big profit
        });
    });

    describe('Closing LONG Position - Unprofitable', () => {
        it('should close LONG position with loss', async () => {
            // Create and fill LONG trade
            const trade = await Trade.create({
                portfolioId: testPortfolioId,
                coinSymbol: 'BTC',
                tradeType: TradeType.LONG,
                status: TradeStatus.FILLED,
                entryPrice: 100000,
                depositPercent: 10,
                entryFee: 1,
                sumPlusFee: 1000, // Spent 1000 USD
                amount: 0.0099, // Got 0.0099 BTC
                initialEntryPrice: 100000,
                initialAmount: 0.0099,
                filledDate: new Date(),
            });

            // Close position at lower price (loss!)
            trade.status = TradeStatus.CLOSED;
            trade.exitPrice = 90000; // BTC dropped to 90,000
            trade.exitFee = 1; // 1% exit fee
            trade.closeDate = new Date();
            await trade.save();

            // Calculate profit (will be negative)
            const profitUSD = calculateLongProfitUSD(
                trade.amount,
                trade.sumPlusFee,
                trade.exitPrice,
                trade.exitFee
            );

            const profitPercent = calculateLongProfitPercent(
                trade.entryPrice,
                trade.exitPrice,
                trade.entryFee,
                trade.exitFee
            );

            // Verify loss calculations
            // Exit value: 0.0099 × 90,000 × 0.99 = 882.09 USD
            // Loss: 882.09 - 1000 = -117.91 USD
            expect(profitUSD).toBeCloseTo(-117.91, 1);
            expect(profitUSD).toBeLessThan(0); // Should be negative

            // Price change: -10%, minus fees: -10% - 1% - 1% = -12%
            expect(profitPercent).toBeCloseTo(-12, 1);
            expect(profitPercent).toBeLessThan(0);
        });

        it('should handle break-even trades (only lose fees)', async () => {
            // Scenario: Price doesn't change, only pay fees
            const trade = await Trade.create({
                portfolioId: testPortfolioId,
                coinSymbol: 'BTC',
                tradeType: TradeType.LONG,
                status: TradeStatus.FILLED,
                entryPrice: 100000,
                depositPercent: 10,
                entryFee: 1,
                sumPlusFee: 1000,
                amount: 0.0099,
                initialEntryPrice: 100000,
                initialAmount: 0.0099,
                filledDate: new Date(),
            });

            // Close at same price
            trade.status = TradeStatus.CLOSED;
            trade.exitPrice = 100000; // Same price
            trade.exitFee = 1;
            trade.closeDate = new Date();
            await trade.save();

            const profitUSD = calculateLongProfitUSD(
                trade.amount,
                trade.sumPlusFee,
                trade.exitPrice,
                trade.exitFee
            );

            // Exit value: 0.0099 × 100,000 × 0.99 = 980.1 USD
            // Loss: 980.1 - 1000 = -19.9 USD (lost to fees)
            expect(profitUSD).toBeCloseTo(-19.9, 1);
            expect(profitUSD).toBeLessThan(0);
        });
    });

    describe('Complete Lifecycle', () => {
        it('should complete full lifecycle: Open → Fill → Close', async () => {
            // Step 1: Open
            let trade = await Trade.create({
                portfolioId: testPortfolioId,
                coinSymbol: 'ETH',
                tradeType: TradeType.LONG,
                status: TradeStatus.OPEN,
                entryPrice: 3000,
                depositPercent: 15,
                entryFee: 1,
                sumPlusFee: 1515, // Planned
                amount: 0.5, // Planned
                initialEntryPrice: 3000,
                initialAmount: 0.5,
            });

            expect(trade.status).toBe(TradeStatus.OPEN);

            // Step 2: Fill
            trade.status = TradeStatus.FILLED;
            trade.sumPlusFee = 1518; // Actual from exchange
            trade.amount = 0.506; // Actual from exchange
            trade.filledDate = new Date();
            trade = await trade.save();

            expect(trade.status).toBe(TradeStatus.FILLED);
            expect(trade.filledDate).toBeDefined();

            // Step 3: Close
            trade.status = TradeStatus.CLOSED;
            trade.exitPrice = 3300; // ETH went up
            trade.exitFee = 1;
            trade.closeDate = new Date();
            trade = await trade.save();

            expect(trade.status).toBe(TradeStatus.CLOSED);
            expect(trade.closeDate).toBeDefined();

            // Calculate final profit
            const profitUSD = calculateLongProfitUSD(
                trade.amount,
                trade.sumPlusFee,
                trade.exitPrice,
                trade.exitFee
            );

            // Exit value: 0.506 × 3300 × 0.99 = 1653.102 USD
            // Profit: 1653.102 - 1518 = 135.102 USD
            expect(profitUSD).toBeCloseTo(135.1, 1);
            expect(profitUSD).toBeGreaterThan(0);
        });
    });

    describe('Profit Calculation Edge Cases', () => {
        it('should handle very small amounts', async () => {
            const trade = await Trade.create({
                portfolioId: testPortfolioId,
                coinSymbol: 'BTC',
                tradeType: TradeType.LONG,
                status: TradeStatus.FILLED,
                entryPrice: 100000,
                depositPercent: 1,
                entryFee: 1,
                sumPlusFee: 101, // Just 101 USD
                amount: 0.001, // 0.001 BTC
                initialEntryPrice: 100000,
                initialAmount: 0.001,
                filledDate: new Date(),
            });

            trade.status = TradeStatus.CLOSED;
            trade.exitPrice = 110000;
            trade.exitFee = 1;
            trade.closeDate = new Date();
            await trade.save();

            const profitUSD = calculateLongProfitUSD(
                trade.amount,
                trade.sumPlusFee,
                trade.exitPrice,
                trade.exitFee
            );

            // Exit value: 0.001 × 110,000 × 0.99 = 108.9 USD
            // Profit: 108.9 - 101 = 7.9 USD
            expect(profitUSD).toBeCloseTo(7.9, 1);
        });

        it('should handle high exit fees correctly', async () => {
            const trade = await Trade.create({
                portfolioId: testPortfolioId,
                coinSymbol: 'BTC',
                tradeType: TradeType.LONG,
                status: TradeStatus.FILLED,
                entryPrice: 100000,
                depositPercent: 10,
                entryFee: 1,
                sumPlusFee: 1000,
                amount: 0.0099,
                initialEntryPrice: 100000,
                initialAmount: 0.0099,
                filledDate: new Date(),
            });

            trade.status = TradeStatus.CLOSED;
            trade.exitPrice = 110000;
            trade.exitFee = 5; // High fee: 5%
            trade.closeDate = new Date();
            await trade.save();

            const profitUSD = calculateLongProfitUSD(
                trade.amount,
                trade.sumPlusFee,
                trade.exitPrice,
                trade.exitFee
            );

            // Exit value: 0.0099 × 110,000 × 0.95 = 1034.55 USD
            // Profit: 1034.55 - 1000 = 34.55 USD (much less due to high fee)
            expect(profitUSD).toBeCloseTo(34.55, 1);
        });
    });
});
