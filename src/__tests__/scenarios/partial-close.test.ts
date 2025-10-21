import { connectTestDB, closeTestDB, clearTestDB } from '../helpers/db';
import Trade from '@/models/Trade';
import Portfolio from '@/models/Portfolio';
import { TradeStatus, TradeType } from '@/types';
import {
  calculateLongProfitUSD,
  calculateShortProfitCoins,
  calculateCoinsBoughtBack,
  recalculateLongEntryPrice,
} from '@/lib/calculations';

/**
 * Partial Close Tests
 *
 * Tests partial closing of positions (both LONG and SHORT):
 * 1. Partial close LONG - close part of position, keep rest open
 * 2. Multiple partial closes - close position in multiple steps
 * 3. Partial close SHORT - close part of SHORT, update parent LONG proportionally
 * 4. Track remainingAmount and originalAmount correctly
 *
 * Key concept:
 * - originalAmount: Never changes, shows initial size
 * - remainingAmount: Decreases with each partial close
 * - Each partial close creates a new trade record with isPartialClose: true
 */
describe('Partial Close Tests', () => {
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

  describe('Partial Close LONG Position', () => {
    it('should create partial close record for LONG', async () => {
      // Create parent LONG with 1.0 BTC
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
        originalAmount: 1.0,
        remainingAmount: 1.0,
        initialEntryPrice: 100000,
        initialAmount: 1.0,
        filledDate: new Date(),
      });

      // Partial close: sell 0.3 BTC
      const partialClose = await Trade.create({
        portfolioId: testPortfolioId,
        coinSymbol: 'BTC',
        tradeType: TradeType.LONG,
        status: TradeStatus.CLOSED,
        parentTradeId: parentLong._id.toString(),
        isPartialClose: true,
        entryPrice: 100000, // Same as parent
        exitPrice: 110000, // Sell at 110k
        exitFee: 1,
        depositPercent: 30,
        entryFee: 1,
        sumPlusFee: 30300, // 0.3 × 101k
        amount: 0.3,
        closedAmount: 0.3, // Amount closed in this partial
        initialEntryPrice: 100000,
        initialAmount: 0.3,
        closeDate: new Date(),
      });

      expect(partialClose.isPartialClose).toBe(true);
      expect(partialClose.parentTradeId).toBe(parentLong._id.toString());
      expect(partialClose.closedAmount).toBe(0.3);

      // Calculate profit for this partial close
      const profitUSD = calculateLongProfitUSD(
        partialClose.amount,
        partialClose.sumPlusFee,
        partialClose.exitPrice,
        partialClose.exitFee
      );

      // 0.3 × 110,000 × 0.99 = 32,670
      // Profit: 32,670 - 30,300 = 2,370 USD
      expect(profitUSD).toBeCloseTo(2370, 0);
    });

    // ⚠️ CRITICAL TEST - Verifies remainingAmount tracking
    // Why: remainingAmount tracks what's left open after partial closes
    // Use case: User closes 0.3 BTC, should have 0.7 BTC remaining
    // If this breaks: Can't track what portion of position is still open
    it('should update parent LONG remainingAmount after partial close', async () => {
      // Create parent LONG with 1.0 BTC
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
        originalAmount: 1.0,
        remainingAmount: 1.0,
        initialEntryPrice: 100000,
        initialAmount: 1.0,
        filledDate: new Date(),
      });

      // Partial close 0.3 BTC
      await Trade.create({
        portfolioId: testPortfolioId,
        coinSymbol: 'BTC',
        tradeType: TradeType.LONG,
        status: TradeStatus.CLOSED,
        parentTradeId: parentLong._id.toString(),
        isPartialClose: true,
        entryPrice: 100000,
        exitPrice: 110000,
        exitFee: 1,
        depositPercent: 30,
        entryFee: 1,
        sumPlusFee: 30300,
        amount: 0.3,
        closedAmount: 0.3,
        initialEntryPrice: 100000,
        initialAmount: 0.3,
        closeDate: new Date(),
      });

      // Update parent
      parentLong.remainingAmount = 0.7; // 1.0 - 0.3
      await parentLong.save();

      const updatedParent = await Trade.findById(parentLong._id);

      // ✓ remainingAmount should decrease
      expect(updatedParent!.remainingAmount).toBe(0.7);

      // ✓ originalAmount should NOT change
      expect(updatedParent!.originalAmount).toBe(1.0);

      // ✓ amount should NOT change (it's the filled amount)
      expect(updatedParent!.amount).toBe(1.0);

      // ✓ initial values should NOT change
      expect(updatedParent!.initialEntryPrice).toBe(100000);
      expect(updatedParent!.initialAmount).toBe(1.0);
    });

    it('should handle multiple partial closes on same LONG', async () => {
      // Create parent LONG with 1.0 BTC
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
        originalAmount: 1.0,
        remainingAmount: 1.0,
        initialEntryPrice: 100000,
        initialAmount: 1.0,
        filledDate: new Date(),
      });

      const partialCloses = [
        { amount: 0.3, price: 110000 },
        { amount: 0.4, price: 115000 },
        { amount: 0.3, price: 120000 },
      ];

      let remainingAmount = 1.0;

      for (const partial of partialCloses) {
        // Create partial close
        await Trade.create({
          portfolioId: testPortfolioId,
          coinSymbol: 'BTC',
          tradeType: TradeType.LONG,
          status: TradeStatus.CLOSED,
          parentTradeId: parentLong._id.toString(),
          isPartialClose: true,
          entryPrice: 100000,
          exitPrice: partial.price,
          exitFee: 1,
          depositPercent: (partial.amount / 1.0) * 100,
          entryFee: 1,
          sumPlusFee: partial.amount * 101000,
          amount: partial.amount,
          closedAmount: partial.amount,
          initialEntryPrice: 100000,
          initialAmount: partial.amount,
          closeDate: new Date(),
        });

        // Update remaining (ensure it doesn't go negative)
        remainingAmount -= partial.amount;
        parentLong.remainingAmount = Math.max(0, remainingAmount);
        await parentLong.save();
      }

      const updatedParent = await Trade.findById(parentLong._id);

      // After closing 0.3 + 0.4 + 0.3 = 1.0 BTC, nothing left
      expect(updatedParent!.remainingAmount).toBeCloseTo(0, 4);

      // Original amount unchanged
      expect(updatedParent!.originalAmount).toBe(1.0);

      // Should mark parent as closed when remainingAmount = 0
      // (In real app, API would do this)
    });

    it('should close parent LONG when all partials complete', async () => {
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
        originalAmount: 1.0,
        remainingAmount: 1.0,
        initialEntryPrice: 100000,
        initialAmount: 1.0,
        filledDate: new Date(),
      });

      // Close all 1.0 BTC through partials
      await Trade.create({
        portfolioId: testPortfolioId,
        coinSymbol: 'BTC',
        tradeType: TradeType.LONG,
        status: TradeStatus.CLOSED,
        parentTradeId: parentLong._id.toString(),
        isPartialClose: true,
        entryPrice: 100000,
        exitPrice: 110000,
        exitFee: 1,
        depositPercent: 100,
        entryFee: 1,
        sumPlusFee: 101000,
        amount: 1.0,
        closedAmount: 1.0,
        initialEntryPrice: 100000,
        initialAmount: 1.0,
        closeDate: new Date(),
      });

      // Update parent to closed
      parentLong.remainingAmount = 0;
      parentLong.status = TradeStatus.CLOSED;
      parentLong.closeDate = new Date();
      await parentLong.save();

      const updatedParent = await Trade.findById(parentLong._id);

      expect(updatedParent!.remainingAmount).toBe(0);
      expect(updatedParent!.status).toBe(TradeStatus.CLOSED);
      expect(updatedParent!.closeDate).toBeDefined();
    });
  });

  describe('Partial Close SHORT Position', () => {
    it('should create partial close for SHORT and update parent LONG', async () => {
      // Step 1: Create parent LONG with 1.0 BTC
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
        originalAmount: 1.0,
        remainingAmount: 1.0,
        initialEntryPrice: 100000,
        initialAmount: 1.0,
        filledDate: new Date(),
      });

      // Step 2: Create SHORT (sell 0.5 BTC)
      const shortTrade = await Trade.create({
        portfolioId: testPortfolioId,
        coinSymbol: 'BTC',
        tradeType: TradeType.SHORT,
        status: TradeStatus.FILLED,
        parentTradeId: parentLong._id.toString(),
        entryPrice: 110000,
        depositPercent: 50,
        entryFee: 1,
        sumPlusFee: 54450, // 0.5 × 110k × 0.99
        amount: 0.5,
        originalAmount: 0.5,
        remainingAmount: 0.5,
        initialEntryPrice: 110000,
        initialAmount: 0.5,
        filledDate: new Date(),
      });

      // Step 3: Partial close SHORT - buy back only 0.3 BTC
      const partialClose = await Trade.create({
        portfolioId: testPortfolioId,
        coinSymbol: 'BTC',
        tradeType: TradeType.SHORT,
        status: TradeStatus.CLOSED,
        parentTradeId: shortTrade._id.toString(),
        isPartialClose: true,
        entryPrice: 110000,
        exitPrice: 100000, // Buy back at 100k
        exitFee: 1,
        depositPercent: 60, // 60% of SHORT (0.3 / 0.5)
        entryFee: 1,
        sumPlusFee: 32670, // 0.3 × 110k × 0.99
        amount: 0.3,
        closedAmount: 0.3,
        initialEntryPrice: 110000,
        initialAmount: 0.3,
        closeDate: new Date(),
      });

      // Calculate coins bought back for this partial
      const coinsBoughtBack = calculateCoinsBoughtBack(
        partialClose.sumPlusFee,
        partialClose.exitPrice,
        partialClose.exitFee
      );

      // 32,670 / 101,000 = 0.3235 BTC bought back
      expect(coinsBoughtBack).toBeCloseTo(0.3235, 4);

      // Update parent LONG (in real app, API does this)
      const remainingAfterShort = 0.5; // 1.0 - 0.5 sold
      parentLong.amount = remainingAfterShort + coinsBoughtBack;
      parentLong.entryPrice = recalculateLongEntryPrice(
        parentLong.sumPlusFee,
        parentLong.amount
      );
      await parentLong.save();

      const updatedParent = await Trade.findById(parentLong._id);

      // Parent should have: 0.5 + 0.3235 = 0.8235 BTC
      expect(updatedParent!.amount).toBeCloseTo(0.8235, 4);

      // Update SHORT remaining
      shortTrade.remainingAmount = 0.2; // 0.5 - 0.3
      await shortTrade.save();

      const updatedShort = await Trade.findById(shortTrade._id);
      expect(updatedShort!.remainingAmount).toBe(0.2);
    });

    // ⚠️ CRITICAL TEST - Verifies proportional parent LONG update
    // Why: When partially closing SHORT, only proportional amount of coins added back to parent
    // Use case: SHORT sold 0.5 BTC, partially closed 0.3 BTC → add ~0.32 BTC to parent
    // If this breaks: Parent LONG gets wrong amount of coins back
    it('should proportionally update parent LONG for partial SHORT close', async () => {
      // Parent LONG with 1.0 BTC
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

      // SHORT sells 0.5 BTC at 110k
      const shortTrade = await Trade.create({
        portfolioId: testPortfolioId,
        coinSymbol: 'BTC',
        tradeType: TradeType.SHORT,
        status: TradeStatus.FILLED,
        parentTradeId: parentLong._id.toString(),
        entryPrice: 110000,
        depositPercent: 50,
        entryFee: 1,
        sumPlusFee: 54450,
        amount: 0.5,
        remainingAmount: 0.5,
        initialEntryPrice: 110000,
        initialAmount: 0.5,
        filledDate: new Date(),
      });

      // Partial close 1: Buy back 0.2 BTC at 105k
      const partial1 = await Trade.create({
        portfolioId: testPortfolioId,
        coinSymbol: 'BTC',
        tradeType: TradeType.SHORT,
        status: TradeStatus.CLOSED,
        parentTradeId: shortTrade._id.toString(),
        isPartialClose: true,
        entryPrice: 110000,
        exitPrice: 105000,
        exitFee: 1,
        depositPercent: 40, // 40% of SHORT (0.2 / 0.5)
        entryFee: 1,
        sumPlusFee: 21780, // 0.2 × 110k × 0.99
        amount: 0.2,
        closedAmount: 0.2,
        initialEntryPrice: 110000,
        initialAmount: 0.2,
        closeDate: new Date(),
      });

      const coins1 = calculateCoinsBoughtBack(
        partial1.sumPlusFee,
        partial1.exitPrice,
        partial1.exitFee
      );

      // Update parent LONG
      let currentParentAmount = 0.5 + coins1; // 0.5 remaining + bought back
      parentLong.amount = currentParentAmount;
      parentLong.entryPrice = recalculateLongEntryPrice(
        parentLong.sumPlusFee,
        parentLong.amount
      );
      await parentLong.save();

      // Partial close 2: Buy back remaining 0.3 BTC at 100k
      const partial2 = await Trade.create({
        portfolioId: testPortfolioId,
        coinSymbol: 'BTC',
        tradeType: TradeType.SHORT,
        status: TradeStatus.CLOSED,
        parentTradeId: shortTrade._id.toString(),
        isPartialClose: true,
        entryPrice: 110000,
        exitPrice: 100000,
        exitFee: 1,
        depositPercent: 60, // 60% of SHORT (0.3 / 0.5)
        entryFee: 1,
        sumPlusFee: 32670, // 0.3 × 110k × 0.99
        amount: 0.3,
        closedAmount: 0.3,
        initialEntryPrice: 110000,
        initialAmount: 0.3,
        closeDate: new Date(),
      });

      const coins2 = calculateCoinsBoughtBack(
        partial2.sumPlusFee,
        partial2.exitPrice,
        partial2.exitFee
      );

      // Update parent LONG again
      currentParentAmount = currentParentAmount + coins2;
      parentLong.amount = currentParentAmount;
      parentLong.entryPrice = recalculateLongEntryPrice(
        parentLong.sumPlusFee,
        parentLong.amount
      );
      await parentLong.save();

      const finalParent = await Trade.findById(parentLong._id);

      // Should have more than 1.0 BTC (gained from profitable SHORT)
      expect(finalParent!.amount).toBeGreaterThan(1.0);

      // Initial values unchanged
      expect(finalParent!.initialEntryPrice).toBe(100000);
      expect(finalParent!.initialAmount).toBe(1.0);

      // Mark SHORT as closed
      shortTrade.remainingAmount = 0;
      shortTrade.status = TradeStatus.CLOSED;
      shortTrade.closeDate = new Date();
      await shortTrade.save();

      const finalShort = await Trade.findById(shortTrade._id);
      expect(finalShort!.remainingAmount).toBe(0);
      expect(finalShort!.status).toBe(TradeStatus.CLOSED);
    });
  });

  describe('Profit Calculation for Partial Closes', () => {
    it('should calculate profit only for closed portion in LONG partial', async () => {
      // LONG with 1.0 BTC, entry at 100k
      // Close 0.4 BTC at 110k

      const amount = 0.4;
      const sumPlusFee = 40400; // 0.4 × 101k
      const exitPrice = 110000;
      const exitFee = 1;

      const profitUSD = calculateLongProfitUSD(
        amount,
        sumPlusFee,
        exitPrice,
        exitFee
      );

      // 0.4 × 110,000 × 0.99 = 43,560
      // Profit: 43,560 - 40,400 = 3,160 USD
      expect(profitUSD).toBeCloseTo(3160, 0);
    });

    it('should calculate profit only for closed portion in SHORT partial', async () => {
      // SHORT sold 0.5 BTC at 110k
      // Partial close: buy back 0.3 BTC at 100k

      const soldAmount = 0.3; // This partial
      const sumPlusFee = 32670; // 0.3 × 110k × 0.99
      const buyBackPrice = 100000;
      const buyBackFee = 1;

      const profitCoins = calculateShortProfitCoins(
        soldAmount,
        sumPlusFee,
        buyBackPrice,
        buyBackFee
      );

      // 32,670 / 101,000 = 0.3235 BTC
      // Profit: 0.3235 - 0.3 = 0.0235 BTC
      expect(profitCoins).toBeCloseTo(0.0235, 4);
    });
  });

  describe('Edge Cases', () => {
    it('should handle closing exact remaining amount', async () => {
      // Parent with remainingAmount = 0.7
      // Close exactly 0.7

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
        originalAmount: 1.0,
        remainingAmount: 0.7, // Already closed 0.3
        initialEntryPrice: 100000,
        initialAmount: 1.0,
        filledDate: new Date(),
      });

      // Close remaining 0.7
      await Trade.create({
        portfolioId: testPortfolioId,
        coinSymbol: 'BTC',
        tradeType: TradeType.LONG,
        status: TradeStatus.CLOSED,
        parentTradeId: parentLong._id.toString(),
        isPartialClose: true,
        entryPrice: 100000,
        exitPrice: 110000,
        exitFee: 1,
        depositPercent: 70,
        entryFee: 1,
        sumPlusFee: 70700,
        amount: 0.7,
        closedAmount: 0.7,
        initialEntryPrice: 100000,
        initialAmount: 0.7,
        closeDate: new Date(),
      });

      // Update parent
      parentLong.remainingAmount = 0;
      parentLong.status = TradeStatus.CLOSED;
      parentLong.closeDate = new Date();
      await parentLong.save();

      const updatedParent = await Trade.findById(parentLong._id);

      expect(updatedParent!.remainingAmount).toBe(0);
      expect(updatedParent!.status).toBe(TradeStatus.CLOSED);
    });
  });
});
