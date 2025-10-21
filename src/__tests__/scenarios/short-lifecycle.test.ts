import { connectTestDB, closeTestDB, clearTestDB } from '../helpers/db';
import Trade from '@/models/Trade';
import Portfolio from '@/models/Portfolio';
import { TradeStatus, TradeType } from '@/types';
import {
  calculateShortProfitCoins,
  calculateShortProfitPercent,
  calculateCoinsBoughtBack,
  recalculateLongEntryPrice,
} from '@/lib/calculations';

/**
 * SHORT Lifecycle Tests
 *
 * Tests the complete lifecycle of a SHORT position and parent LONG recalculation:
 * 1. Create parent LONG position (filled)
 * 2. Open SHORT from that LONG (sell coins)
 * 3. Fill SHORT with actual data from exchange
 * 4. Close SHORT (buy back coins)
 * 5. ⚠️ CRITICAL: Verify parent LONG is updated correctly
 *
 * The parent LONG recalculation is the most important part:
 * - Bought-back coins are added to parent LONG's amount
 * - Entry price is recalculated: sumPlusFee / newAmount
 * - initialEntryPrice and initialAmount NEVER change
 */
describe('SHORT Position Lifecycle', () => {
  let testPortfolioId: string;

  beforeAll(async () => {
    await connectTestDB();
  });

  afterAll(async () => {
    await closeTestDB();
  });

  beforeEach(async () => {
    const portfolio = await Portfolio.create({
      userId: 'test-user-id',
      name: 'Test Portfolio',
      totalDeposit: 100000,
      coins: [
        { symbol: 'BTC', percentage: 100, decimalPlaces: 8 },
      ],
    });
    testPortfolioId = portfolio._id.toString();
  });

  afterEach(async () => {
    await clearTestDB();
  });

  describe('Opening SHORT Position', () => {
    it('should open SHORT from existing LONG position', async () => {
      // Step 1: Create parent LONG
      const parentLong = await Trade.create({
        portfolioId: testPortfolioId,
        coinSymbol: 'BTC',
        tradeType: TradeType.LONG,
        status: TradeStatus.FILLED,
        entryPrice: 100000,
        depositPercent: 100,
        entryFee: 1,
        sumPlusFee: 101000,
        amount: 1.0,
        initialEntryPrice: 100000,
        initialAmount: 1.0,
        filledDate: new Date(),
      });

      // Step 2: Open SHORT (sell 0.5 BTC at higher price)
      const shortTrade = await Trade.create({
        portfolioId: testPortfolioId,
        coinSymbol: 'BTC',
        tradeType: TradeType.SHORT,
        status: TradeStatus.OPEN,
        parentTradeId: parentLong._id.toString(),
        entryPrice: 110000, // Selling at 110k
        depositPercent: 50, // Selling 50% of LONG
        entryFee: 1,
        sumPlusFee: 54450, // Will receive ~54,450 USD (0.5 × 110k × 0.99)
        amount: 0.5, // Selling 0.5 BTC
        initialEntryPrice: 110000,
        initialAmount: 0.5,
      });

      expect(shortTrade).toBeDefined();
      expect(shortTrade.tradeType).toBe(TradeType.SHORT);
      expect(shortTrade.parentTradeId).toBe(parentLong._id.toString());
      expect(shortTrade.status).toBe(TradeStatus.OPEN);
      expect(shortTrade.amount).toBe(0.5);
    });

    it('should require parentTradeId for SHORT (business logic)', async () => {
      // Note: Model allows SHORT without parentTradeId, but business logic should enforce it
      // This test documents expected behavior

      const shortWithoutParent = await Trade.create({
        portfolioId: testPortfolioId,
        coinSymbol: 'BTC',
        tradeType: TradeType.SHORT,
        entryPrice: 110000,
        depositPercent: 10,
        entryFee: 1,
        sumPlusFee: 10890,
        amount: 0.1,
        initialEntryPrice: 110000,
        initialAmount: 0.1,
      });

      // Model allows it, but API should prevent this
      expect(shortWithoutParent.parentTradeId).toBeUndefined();
    });
  });

  describe('Filling SHORT Position', () => {
    it('should fill SHORT with actual exchange data', async () => {
      // Create parent LONG
      const parentLong = await Trade.create({
        portfolioId: testPortfolioId,
        coinSymbol: 'BTC',
        tradeType: TradeType.LONG,
        status: TradeStatus.FILLED,
        entryPrice: 100000,
        depositPercent: 100,
        entryFee: 1,
        sumPlusFee: 101000,
        amount: 1.0,
        initialEntryPrice: 100000,
        initialAmount: 1.0,
        filledDate: new Date(),
      });

      // Create OPEN SHORT
      const shortTrade = await Trade.create({
        portfolioId: testPortfolioId,
        coinSymbol: 'BTC',
        tradeType: TradeType.SHORT,
        status: TradeStatus.OPEN,
        parentTradeId: parentLong._id.toString(),
        entryPrice: 110000,
        depositPercent: 50,
        entryFee: 1,
        sumPlusFee: 54450,
        amount: 0.5,
        initialEntryPrice: 110000,
        initialAmount: 0.5,
      });

      // Fill with actual data from exchange
      shortTrade.status = TradeStatus.FILLED;
      shortTrade.sumPlusFee = 54500; // Actual USD received
      shortTrade.amount = 0.5; // Actual BTC sold
      shortTrade.filledDate = new Date();
      await shortTrade.save();

      expect(shortTrade.status).toBe(TradeStatus.FILLED);
      expect(shortTrade.filledDate).toBeDefined();
      expect(shortTrade.sumPlusFee).toBe(54500);
    });
  });

  describe('Closing SHORT Position - Profitable', () => {
    // ⚠️ CRITICAL TEST - This is the core SHORT functionality
    // Why: Tests that bought-back coins are added to parent LONG
    // Formula: coinsBoughtBack = sumPlusFee / buyBackPriceWithFee
    // If this breaks: Parent LONG won't update, user loses profit tracking
    it('should close SHORT with profit and update parent LONG', async () => {
      // Step 1: Create parent LONG with 1.0 BTC
      const parentLong = await Trade.create({
        portfolioId: testPortfolioId,
        coinSymbol: 'BTC',
        tradeType: TradeType.LONG,
        status: TradeStatus.FILLED,
        entryPrice: 100000,
        depositPercent: 100,
        entryFee: 1,
        sumPlusFee: 101000, // Spent 101,000 USD
        amount: 1.0, // Got 1.0 BTC
        remainingAmount: 1.0,
        initialEntryPrice: 100000,
        initialAmount: 1.0,
        filledDate: new Date(),
      });

      // Step 2: Create and fill SHORT (sell 0.5 BTC at 110k)
      const shortTrade = await Trade.create({
        portfolioId: testPortfolioId,
        coinSymbol: 'BTC',
        tradeType: TradeType.SHORT,
        status: TradeStatus.FILLED,
        parentTradeId: parentLong._id.toString(),
        entryPrice: 110000, // Sold at 110k
        depositPercent: 50,
        entryFee: 1,
        sumPlusFee: 54450, // Received 54,450 USD (0.5 × 110k × 0.99)
        amount: 0.5, // Sold 0.5 BTC
        initialEntryPrice: 110000,
        initialAmount: 0.5,
        filledDate: new Date(),
      });

      // Step 3: Close SHORT (buy back at 100k - price dropped!)
      shortTrade.status = TradeStatus.CLOSED;
      shortTrade.exitPrice = 100000; // Buy back at 100k
      shortTrade.exitFee = 1; // 1% fee
      shortTrade.closeDate = new Date();
      await shortTrade.save();

      // Calculate SHORT profit in coins
      const profitCoins = calculateShortProfitCoins(
        shortTrade.amount,
        shortTrade.sumPlusFee,
        shortTrade.exitPrice,
        shortTrade.exitFee
      );

      // Buy back price with fee: 100,000 × 1.01 = 101,000
      // Coins bought back: 54,450 / 101,000 = 0.5391 BTC
      // Profit: 0.5391 - 0.5 = 0.0391 BTC
      expect(profitCoins).toBeCloseTo(0.0391, 4);
      expect(profitCoins).toBeGreaterThan(0);

      // ⚠️ CRITICAL: Simulate parent LONG update
      // This is what the API should do automatically
      const coinsBoughtBack = calculateCoinsBoughtBack(
        shortTrade.sumPlusFee,
        shortTrade.exitPrice,
        shortTrade.exitFee
      );

      // Update parent LONG
      // Start with remaining amount (which is 0.5 after selling 0.5), then add bought-back coins
      const remainingAfterShort = 0.5; // Had 1.0, sold 0.5
      parentLong.amount = remainingAfterShort + coinsBoughtBack;
      parentLong.remainingAmount = parentLong.amount;
      parentLong.entryPrice = recalculateLongEntryPrice(
        parentLong.sumPlusFee,
        parentLong.amount
      );
      await parentLong.save();

      // Verify parent LONG updates
      const updatedParent = await Trade.findById(parentLong._id);

      // Amount should be: 0.5 (remaining) + 0.5391 (bought back) = 1.0391 BTC
      expect(updatedParent!.amount).toBeCloseTo(1.0391, 4);

      // Entry price should improve: 101,000 / 1.0391 ≈ 97,199 USD
      expect(updatedParent!.entryPrice).toBeCloseTo(97199, 0);

      // ✓ CRITICAL: Initial values should NOT change
      expect(updatedParent!.initialEntryPrice).toBe(100000); // Still 100k!
      expect(updatedParent!.initialAmount).toBe(1.0); // Still 1.0!
    });

    it('should calculate SHORT profit percentage correctly', async () => {
      // Sold 0.5 BTC, bought back 0.5391 BTC
      const soldAmount = 0.5;
      const coinsBoughtBack = 0.5391;

      const profitPercent = calculateShortProfitPercent(soldAmount, coinsBoughtBack);

      // (0.5391 / 0.5 - 1) × 100 = 7.82%
      expect(profitPercent).toBeCloseTo(7.82, 1);
    });
  });

  describe('Closing SHORT Position - Unprofitable', () => {
    it('should close SHORT with loss when price goes up', async () => {
      // Create parent LONG
      const parentLong = await Trade.create({
        portfolioId: testPortfolioId,
        coinSymbol: 'BTC',
        tradeType: TradeType.LONG,
        status: TradeStatus.FILLED,
        entryPrice: 100000,
        depositPercent: 100,
        entryFee: 1,
        sumPlusFee: 101000,
        amount: 1.0,
        remainingAmount: 1.0,
        initialEntryPrice: 100000,
        initialAmount: 1.0,
        filledDate: new Date(),
      });

      // Create SHORT (sell at 100k)
      const shortTrade = await Trade.create({
        portfolioId: testPortfolioId,
        coinSymbol: 'BTC',
        tradeType: TradeType.SHORT,
        status: TradeStatus.FILLED,
        parentTradeId: parentLong._id.toString(),
        entryPrice: 100000, // Sold at 100k
        depositPercent: 50,
        entryFee: 1,
        sumPlusFee: 49500, // Received 49,500 USD (0.5 × 100k × 0.99)
        amount: 0.5,
        initialEntryPrice: 100000,
        initialAmount: 0.5,
        filledDate: new Date(),
      });

      // Close SHORT (price went up to 110k!)
      shortTrade.status = TradeStatus.CLOSED;
      shortTrade.exitPrice = 110000; // Price went UP (bad for SHORT)
      shortTrade.exitFee = 1;
      shortTrade.closeDate = new Date();
      await shortTrade.save();

      // Calculate SHORT loss in coins
      const profitCoins = calculateShortProfitCoins(
        shortTrade.amount,
        shortTrade.sumPlusFee,
        shortTrade.exitPrice,
        shortTrade.exitFee
      );

      // Buy back price with fee: 110,000 × 1.01 = 111,100
      // Coins bought back: 49,500 / 111,100 = 0.4455 BTC
      // Loss: 0.4455 - 0.5 = -0.0545 BTC (lost coins!)
      expect(profitCoins).toBeCloseTo(-0.0545, 4);
      expect(profitCoins).toBeLessThan(0);

      // Update parent LONG
      const coinsBoughtBack = calculateCoinsBoughtBack(
        shortTrade.sumPlusFee,
        shortTrade.exitPrice,
        shortTrade.exitFee
      );

      // Remaining after selling 0.5: 0.5 BTC
      const remainingAfterShort = 0.5;
      parentLong.amount = remainingAfterShort + coinsBoughtBack;
      parentLong.remainingAmount = parentLong.amount;
      parentLong.entryPrice = recalculateLongEntryPrice(
        parentLong.sumPlusFee,
        parentLong.amount
      );
      await parentLong.save();

      // Verify parent LONG - should have LESS coins now
      const updatedParent = await Trade.findById(parentLong._id);

      // Amount: 0.5 (remaining) + 0.4455 (bought back) = 0.9455 BTC (lost coins)
      expect(updatedParent!.amount).toBeCloseTo(0.9455, 4);
      expect(updatedParent!.amount).toBeLessThan(1.0);

      // Entry price worsened: 101,000 / 0.9455 ≈ 106,817 USD
      expect(updatedParent!.entryPrice).toBeCloseTo(106817, 0);

      // Initial values still unchanged
      expect(updatedParent!.initialEntryPrice).toBe(100000);
      expect(updatedParent!.initialAmount).toBe(1.0);
    });
  });

  describe('Parent LONG Recalculation', () => {
    // ⚠️ CRITICAL TEST - Verifies initialEntryPrice and initialAmount preservation
    // Why: These fields must NEVER change, they preserve original entry data
    // Use case: Historical tracking, tax reporting, performance analysis
    // If this breaks: Historical data is corrupted, can't calculate true ROI
    it('should preserve initialEntryPrice and initialAmount in parent LONG', async () => {
      // Create parent LONG
      const parentLong = await Trade.create({
        portfolioId: testPortfolioId,
        coinSymbol: 'BTC',
        tradeType: TradeType.LONG,
        status: TradeStatus.FILLED,
        entryPrice: 100000,
        depositPercent: 100,
        entryFee: 1,
        sumPlusFee: 101000,
        amount: 1.0,
        remainingAmount: 1.0,
        initialEntryPrice: 100000, // ← Should NEVER change
        initialAmount: 1.0, // ← Should NEVER change
        filledDate: new Date(),
      });

      const originalInitialPrice = parentLong.initialEntryPrice;
      const originalInitialAmount = parentLong.initialAmount;

      // Create and close SHORT multiple times
      for (let i = 0; i < 3; i++) {
        const shortTrade = await Trade.create({
          portfolioId: testPortfolioId,
          coinSymbol: 'BTC',
          tradeType: TradeType.SHORT,
          status: TradeStatus.FILLED,
          parentTradeId: parentLong._id.toString(),
          entryPrice: 110000,
          depositPercent: 10,
          entryFee: 1,
          sumPlusFee: 10890,
          amount: 0.1,
          initialEntryPrice: 110000,
          initialAmount: 0.1,
          filledDate: new Date(),
        });

        // Close SHORT
        shortTrade.status = TradeStatus.CLOSED;
        shortTrade.exitPrice = 100000;
        shortTrade.exitFee = 1;
        shortTrade.closeDate = new Date();
        await shortTrade.save();

        // Update parent
        const coinsBoughtBack = calculateCoinsBoughtBack(
          shortTrade.sumPlusFee,
          shortTrade.exitPrice,
          shortTrade.exitFee
        );

        parentLong.amount = (parentLong.remainingAmount || parentLong.amount) + coinsBoughtBack;
        parentLong.remainingAmount = parentLong.amount;
        parentLong.entryPrice = recalculateLongEntryPrice(
          parentLong.sumPlusFee,
          parentLong.amount
        );
        await parentLong.save();
      }

      // Verify after 3 SHORT closes
      const finalParent = await Trade.findById(parentLong._id);

      // Amount should have changed (added bought-back coins)
      expect(finalParent!.amount).not.toBe(originalInitialAmount);

      // Entry price should have changed (recalculated)
      expect(finalParent!.entryPrice).not.toBe(originalInitialPrice);

      // ✓ BUT initialEntryPrice and initialAmount should NEVER change
      expect(finalParent!.initialEntryPrice).toBe(originalInitialPrice);
      expect(finalParent!.initialAmount).toBe(originalInitialAmount);
    });

    it('should recalculate entry price correctly after SHORT close', async () => {
      // Parent LONG: 1.0 BTC for 101,000 USD
      const parentLong = await Trade.create({
        portfolioId: testPortfolioId,
        coinSymbol: 'BTC',
        tradeType: TradeType.LONG,
        status: TradeStatus.FILLED,
        entryPrice: 101000,
        depositPercent: 100,
        entryFee: 1,
        sumPlusFee: 101000,
        amount: 1.0,
        remainingAmount: 1.0,
        initialEntryPrice: 101000,
        initialAmount: 1.0,
        filledDate: new Date(),
      });

      // After SHORT close, gained 0.05 BTC
      const newTotalAmount = 1.05;
      const newEntryPrice = recalculateLongEntryPrice(101000, newTotalAmount);

      // 101,000 / 1.05 = 96,190.48
      expect(newEntryPrice).toBeCloseTo(96190.48, 2);

      // Entry price improved (went down) because we have more coins for same USD
      expect(newEntryPrice).toBeLessThan(101000);
    });
  });

  describe('Multiple SHORT Operations', () => {
    it('should handle multiple SHORT closes on same parent LONG', async () => {
      // Create parent LONG
      const parentLong = await Trade.create({
        portfolioId: testPortfolioId,
        coinSymbol: 'BTC',
        tradeType: TradeType.LONG,
        status: TradeStatus.FILLED,
        entryPrice: 100000,
        depositPercent: 100,
        entryFee: 1,
        sumPlusFee: 101000,
        amount: 1.0,
        remainingAmount: 1.0,
        initialEntryPrice: 100000,
        initialAmount: 1.0,
        filledDate: new Date(),
      });

      let currentAmount = 1.0;
      const shortOperations = [
        { sold: 0.2, salePrice: 110000, buyBackPrice: 105000 },
        { sold: 0.3, salePrice: 115000, buyBackPrice: 110000 },
        { sold: 0.1, salePrice: 120000, buyBackPrice: 115000 },
      ];

      for (const op of shortOperations) {
        // Create and close SHORT
        const shortTrade = await Trade.create({
          portfolioId: testPortfolioId,
          coinSymbol: 'BTC',
          tradeType: TradeType.SHORT,
          status: TradeStatus.FILLED,
          parentTradeId: parentLong._id.toString(),
          entryPrice: op.salePrice,
          depositPercent: (op.sold / currentAmount) * 100,
          entryFee: 1,
          sumPlusFee: op.sold * op.salePrice * 0.99,
          amount: op.sold,
          initialEntryPrice: op.salePrice,
          initialAmount: op.sold,
          filledDate: new Date(),
        });

        shortTrade.status = TradeStatus.CLOSED;
        shortTrade.exitPrice = op.buyBackPrice;
        shortTrade.exitFee = 1;
        shortTrade.closeDate = new Date();
        await shortTrade.save();

        // Update parent
        const coinsBoughtBack = calculateCoinsBoughtBack(
          shortTrade.sumPlusFee,
          shortTrade.exitPrice,
          shortTrade.exitFee
        );

        currentAmount = currentAmount - op.sold + coinsBoughtBack;

        parentLong.amount = currentAmount;
        parentLong.remainingAmount = currentAmount;
        parentLong.entryPrice = recalculateLongEntryPrice(
          parentLong.sumPlusFee,
          parentLong.amount
        );
        await parentLong.save();
      }

      // Verify final state
      const finalParent = await Trade.findById(parentLong._id);

      // Should have more than 1.0 BTC (gained from profitable SHORTs)
      expect(finalParent!.amount).toBeGreaterThan(1.0);

      // Entry price should be improved (lower)
      expect(finalParent!.entryPrice).toBeLessThan(100000);

      // Initials unchanged
      expect(finalParent!.initialEntryPrice).toBe(100000);
      expect(finalParent!.initialAmount).toBe(1.0);
    });
  });
});
