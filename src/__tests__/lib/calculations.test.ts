import {
    calculateCoinsBoughtBack,
    calculateLongProfitPercent,
    calculateLongProfitUSD,
    calculateShortProfitCoins,
    calculateShortProfitPercent,
    recalculateLongEntryPrice,
} from '@/lib/calculations';

describe('Trade Calculations', () => {
    describe('LONG Position - Profit in USD', () => {
        // ⚠️ CRITICAL TEST - Core profit calculation formula
        // Why: This is the foundation of all LONG profit calculations
        // Formula: (amount × exitPrice × (100 - exitFee) / 100) - sumPlusFee
        // If this breaks: All LONG profits will be calculated incorrectly
        it('should calculate profit for a profitable LONG trade', () => {
            // Scenario: Buy BTC at 100,000, sell at 110,000
            // Entry: 0.01 BTC for 1010 USD (1% fee included)
            // Exit: sell at 110,000 with 1% fee
            const amount = 0.01;
            const sumPlusFee = 1010; // What we spent
            const exitPrice = 110000;
            const exitFee = 1;

            const profit = calculateLongProfitUSD(amount, sumPlusFee, exitPrice, exitFee);

            // Exit value: 0.01 × 110,000 × 0.99 = 1089 USD
            // Profit: 1089 - 1010 = 79 USD
            expect(profit).toBeCloseTo(79, 1);
        });

        it('should calculate loss for an unprofitable LONG trade', () => {
            // Scenario: Buy BTC at 100,000, sell at 90,000 (price dropped)
            const amount = 0.01;
            const sumPlusFee = 1010;
            const exitPrice = 90000;
            const exitFee = 1;

            const profit = calculateLongProfitUSD(amount, sumPlusFee, exitPrice, exitFee);

            // Exit value: 0.01 × 90,000 × 0.99 = 891 USD
            // Loss: 891 - 1010 = -119 USD
            expect(profit).toBeCloseTo(-119, 1);
            expect(profit).toBeLessThan(0); // Should be negative
        });

        it('should calculate zero profit for a break-even LONG trade', () => {
            // Scenario: Buy and sell at same price, only lose on fees
            const amount = 0.01;
            const sumPlusFee = 1010;
            const exitPrice = 100000; // Same as entry
            const exitFee = 1;

            const profit = calculateLongProfitUSD(amount, sumPlusFee, exitPrice, exitFee);

            // Exit value: 0.01 × 100,000 × 0.99 = 990 USD
            // Loss: 990 - 1010 = -20 USD (lost on fees)
            expect(profit).toBeCloseTo(-20, 1);
        });

        it('should handle large amounts correctly', () => {
            // Scenario: Large BTC purchase
            const amount = 10; // 10 BTC
            const sumPlusFee = 1010000; // ~1 million USD
            const exitPrice = 110000;
            const exitFee = 1;

            const profit = calculateLongProfitUSD(amount, sumPlusFee, exitPrice, exitFee);

            // Exit value: 10 × 110,000 × 0.99 = 1,089,000 USD
            // Profit: 1,089,000 - 1,010,000 = 79,000 USD
            expect(profit).toBeCloseTo(79000, 1);
        });
    });

    describe('LONG Position - Profit in Percentage', () => {
        it('should calculate profit percentage for a profitable LONG trade', () => {
            // Scenario: BTC goes from 100,000 to 110,000 (+10%)
            // With 1% entry fee and 1% exit fee
            const entryPrice = 100000;
            const exitPrice = 110000;
            const entryFee = 1;
            const exitFee = 1;

            const profitPercent = calculateLongProfitPercent(
                entryPrice,
                exitPrice,
                entryFee,
                exitFee
            );

            // Price change: +10%
            // After fees: 10% - 1% - 1% = 8%
            expect(profitPercent).toBeCloseTo(8, 1);
        });

        it('should calculate loss percentage for an unprofitable LONG trade', () => {
            // Scenario: BTC drops from 100,000 to 90,000 (-10%)
            const entryPrice = 100000;
            const exitPrice = 90000;
            const entryFee = 1;
            const exitFee = 1;

            const profitPercent = calculateLongProfitPercent(
                entryPrice,
                exitPrice,
                entryFee,
                exitFee
            );

            // Price change: -10%
            // After fees: -10% - 1% - 1% = -12%
            expect(profitPercent).toBeCloseTo(-12, 1);
            expect(profitPercent).toBeLessThan(0);
        });

        it('should account for fees correctly in LONG percentage', () => {
            // Scenario: No price change, only fees
            const entryPrice = 100000;
            const exitPrice = 100000; // Same price
            const entryFee = 1;
            const exitFee = 1;

            const profitPercent = calculateLongProfitPercent(
                entryPrice,
                exitPrice,
                entryFee,
                exitFee
            );

            // Price change: 0%
            // After fees: 0% - 1% - 1% = -2%
            expect(profitPercent).toBeCloseTo(-2, 1);
        });

        it('should handle different fee percentages in LONG', () => {
            // Scenario: Higher fees (2% each)
            const entryPrice = 100000;
            const exitPrice = 110000;
            const entryFee = 2;
            const exitFee = 2;

            const profitPercent = calculateLongProfitPercent(
                entryPrice,
                exitPrice,
                entryFee,
                exitFee
            );

            // Price change: +10%
            // After fees: 10% - 2% - 2% = 6%
            expect(profitPercent).toBeCloseTo(6, 1);
        });
    });

    describe('SHORT Position - Profit in Coins', () => {
        // ⚠️ CRITICAL TEST - SHORT profit is in COINS, not USD!
        // Why: SHORT positions profit in crypto, not fiat currency
        // Formula: (sumPlusFee / buyBackPriceWithFee) - soldAmount
        // If this breaks: SHORT profits will be wrong, parent LONG updates will fail
        it('should calculate profit for a profitable SHORT trade', () => {
            // Scenario: Sell BTC at 110,000, buy back at 100,000
            // Sold: 0.5 BTC, received 54,450 USD (after 1% fee)
            // Buy back: at 100,000 with 1% fee
            const soldAmount = 0.5;
            const sumPlusFee = 54450; // USD received
            const buyBackPrice = 100000;
            const buyBackFee = 1;

            const profitCoins = calculateShortProfitCoins(
                soldAmount,
                sumPlusFee,
                buyBackPrice,
                buyBackFee
            );

            // Buy back price with fee: 100,000 × 1.01 = 101,000
            // Coins bought back: 54,450 / 101,000 = 0.5391 BTC
            // Profit: 0.5391 - 0.5 = 0.0391 BTC ← IN COINS!
            expect(profitCoins).toBeCloseTo(0.0391, 4);
            expect(profitCoins).toBeGreaterThan(0);
        });

        it('should calculate loss for an unprofitable SHORT trade', () => {
            // Scenario: Sell BTC at 100,000, price goes up to 110,000
            // This is a losing SHORT (price went up instead of down)
            const soldAmount = 0.5;
            const sumPlusFee = 49500; // Received from selling at 100k with 1% fee
            const buyBackPrice = 110000; // Price went up!
            const buyBackFee = 1;

            const profitCoins = calculateShortProfitCoins(
                soldAmount,
                sumPlusFee,
                buyBackPrice,
                buyBackFee
            );

            // Buy back price with fee: 110,000 × 1.01 = 111,100
            // Coins bought back: 49,500 / 111,100 = 0.4455 BTC
            // Loss: 0.4455 - 0.5 = -0.0545 BTC
            expect(profitCoins).toBeCloseTo(-0.0545, 4);
            expect(profitCoins).toBeLessThan(0);
        });

        it('should calculate zero profit for break-even SHORT trade', () => {
            // Scenario: Sell and buy back at same price (lose only on fees)
            const soldAmount = 0.5;
            const sumPlusFee = 49500; // Sold at 100k with 1% fee: 50k × 0.99
            const buyBackPrice = 100000; // Same price
            const buyBackFee = 1;

            const profitCoins = calculateShortProfitCoins(
                soldAmount,
                sumPlusFee,
                buyBackPrice,
                buyBackFee
            );

            // Buy back price with fee: 100,000 × 1.01 = 101,000
            // Coins bought back: 49,500 / 101,000 = 0.4901 BTC
            // Loss: 0.4901 - 0.5 = -0.0099 BTC (lost on fees)
            expect(profitCoins).toBeCloseTo(-0.0099, 4);
            expect(profitCoins).toBeLessThan(0);
        });

        it('should handle small amounts correctly in SHORT', () => {
            // Scenario: Small SHORT position
            const soldAmount = 0.01;
            const sumPlusFee = 1089; // Sold 0.01 BTC at 110k with 1% fee
            const buyBackPrice = 100000;
            const buyBackFee = 1;

            const profitCoins = calculateShortProfitCoins(
                soldAmount,
                sumPlusFee,
                buyBackPrice,
                buyBackFee
            );

            // Coins bought back: 1089 / 101,000 = 0.01078 BTC
            // Profit: 0.01078 - 0.01 = 0.00078 BTC
            expect(profitCoins).toBeCloseTo(0.00078, 5);
        });
    });

    describe('SHORT Position - Profit in Percentage', () => {
        it('should calculate profit percentage for a profitable SHORT trade', () => {
            // Scenario: Sold 0.5 BTC, bought back 0.52 BTC
            const soldAmount = 0.5;
            const coinsBoughtBack = 0.52;

            const profitPercent = calculateShortProfitPercent(soldAmount, coinsBoughtBack);

            // (0.52 / 0.5 - 1) × 100 = 4%
            expect(profitPercent).toBeCloseTo(4, 1);
        });

        it('should calculate loss percentage for an unprofitable SHORT trade', () => {
            // Scenario: Sold 0.5 BTC, bought back only 0.45 BTC
            const soldAmount = 0.5;
            const coinsBoughtBack = 0.45;

            const profitPercent = calculateShortProfitPercent(soldAmount, coinsBoughtBack);

            // (0.45 / 0.5 - 1) × 100 = -10%
            expect(profitPercent).toBeCloseTo(-10, 1);
            expect(profitPercent).toBeLessThan(0);
        });
    });

    describe('Helper Functions', () => {
        it('should calculate coins bought back correctly', () => {
            // Used when closing SHORT to update parent LONG
            const sumPlusFee = 54450; // USD from SHORT sale
            const buyBackPrice = 100000;
            const buyBackFee = 1;

            const coinsBoughtBack = calculateCoinsBoughtBack(
                sumPlusFee,
                buyBackPrice,
                buyBackFee
            );

            // 54,450 / 101,000 = 0.5391 BTC
            expect(coinsBoughtBack).toBeCloseTo(0.5391, 4);
        });

        // ⚠️ CRITICAL TEST - Parent LONG recalculation
        // Why: When SHORT closes, parent LONG's entry price must be recalculated
        // Formula: originalSumPlusFee / newTotalAmount
        // Use case: Bought 1 BTC for 100k, after SHORT have 1.05 BTC → new entry price = 95,238
        // If this breaks: Parent LONG won't update correctly, profit calculations will be wrong
        it('should recalculate LONG entry price after SHORT close', () => {
            // Scenario: LONG with 1.0 BTC bought for 100,000 USD
            // After SHORT close, total amount becomes 1.05 BTC (gained 0.05 BTC)
            const originalSumPlusFee = 100000;
            const newTotalAmount = 1.05;

            const newEntryPrice = recalculateLongEntryPrice(
                originalSumPlusFee,
                newTotalAmount
            );

            // 100,000 / 1.05 = 95,238.095 ← Effective entry price improved!
            expect(newEntryPrice).toBeCloseTo(95238.095, 2);
        });
    });
});
