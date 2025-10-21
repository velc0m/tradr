import { connectTestDB, closeTestDB, clearTestDB } from '../helpers/db';
import Trade from '@/models/Trade';
import Portfolio from '@/models/Portfolio';
import { TradeStatus, TradeType } from '@/types';

describe('Trade Model Tests', () => {
  let testPortfolioId: string;

  beforeAll(async () => {
    await connectTestDB();
  });

  afterAll(async () => {
    await closeTestDB();
  });

  beforeEach(async () => {
    // Create a test portfolio for trades
    const portfolio = await Portfolio.create({
      userId: 'test-user-id',
      name: 'Test Portfolio',
      totalDeposit: 10000,
      coins: [
        { symbol: 'BTC', percentage: 50, decimalPlaces: 8 },
        { symbol: 'ETH', percentage: 50, decimalPlaces: 6 },
      ],
    });
    testPortfolioId = portfolio._id.toString();
  });

  afterEach(async () => {
    await clearTestDB();
  });

  describe('LONG Position Creation', () => {
    it('should create a LONG trade with correct data', async () => {
      const tradeData = {
        portfolioId: testPortfolioId,
        coinSymbol: 'BTC',
        tradeType: TradeType.LONG,
        status: TradeStatus.OPEN,
        entryPrice: 100000,
        depositPercent: 10,
        entryFee: 1,
        sumPlusFee: 1010,
        amount: 0.01,
        initialEntryPrice: 100000,
        initialAmount: 0.01,
      };

      const trade = await Trade.create(tradeData);

      expect(trade).toBeDefined();
      expect(trade.coinSymbol).toBe('BTC');
      expect(trade.tradeType).toBe(TradeType.LONG);
      expect(trade.status).toBe(TradeStatus.OPEN);
      expect(trade.entryPrice).toBe(100000);
      expect(trade.amount).toBe(0.01);
      expect(trade.initialEntryPrice).toBe(100000);
      expect(trade.initialAmount).toBe(0.01);
    });

    it('should default status to OPEN if not specified', async () => {
      const tradeData = {
        portfolioId: testPortfolioId,
        coinSymbol: 'BTC',
        tradeType: TradeType.LONG,
        entryPrice: 100000,
        depositPercent: 10,
        entryFee: 1,
        sumPlusFee: 1010,
        amount: 0.01,
        initialEntryPrice: 100000,
        initialAmount: 0.01,
      };

      const trade = await Trade.create(tradeData);

      expect(trade.status).toBe(TradeStatus.OPEN);
    });

    it('should default tradeType to LONG if not specified', async () => {
      const tradeData = {
        portfolioId: testPortfolioId,
        coinSymbol: 'BTC',
        entryPrice: 100000,
        depositPercent: 10,
        entryFee: 1,
        sumPlusFee: 1010,
        amount: 0.01,
        initialEntryPrice: 100000,
        initialAmount: 0.01,
      };

      const trade = await Trade.create(tradeData);

      expect(trade.tradeType).toBe(TradeType.LONG);
    });

    it('should store coin symbols in uppercase', async () => {
      const tradeData = {
        portfolioId: testPortfolioId,
        coinSymbol: 'btc', // lowercase
        tradeType: TradeType.LONG,
        entryPrice: 100000,
        depositPercent: 10,
        entryFee: 1,
        sumPlusFee: 1010,
        amount: 0.01,
        initialEntryPrice: 100000,
        initialAmount: 0.01,
      };

      const trade = await Trade.create(tradeData);

      expect(trade.coinSymbol).toBe('BTC'); // Should be uppercase
    });
  });

  describe('SHORT Position Creation', () => {
    it('should create a SHORT trade with parentTradeId', async () => {
      // First create a parent LONG trade
      const parentTrade = await Trade.create({
        portfolioId: testPortfolioId,
        coinSymbol: 'BTC',
        tradeType: TradeType.LONG,
        status: TradeStatus.FILLED,
        entryPrice: 100000,
        depositPercent: 10,
        entryFee: 1,
        sumPlusFee: 10100,
        amount: 0.1,
        initialEntryPrice: 100000,
        initialAmount: 0.1,
      });

      // Create SHORT trade
      const shortTradeData = {
        portfolioId: testPortfolioId,
        coinSymbol: 'BTC',
        tradeType: TradeType.SHORT,
        status: TradeStatus.OPEN,
        parentTradeId: parentTrade._id.toString(),
        entryPrice: 110000, // Selling price
        depositPercent: 50, // Selling 50% of LONG
        entryFee: 1,
        sumPlusFee: 5445, // USD received from sale
        amount: 0.05, // Amount sold
        initialEntryPrice: 110000,
        initialAmount: 0.05,
      };

      const shortTrade = await Trade.create(shortTradeData);

      expect(shortTrade).toBeDefined();
      expect(shortTrade.tradeType).toBe(TradeType.SHORT);
      expect(shortTrade.parentTradeId).toBe(parentTrade._id.toString());
      expect(shortTrade.amount).toBe(0.05);
    });

    it('should allow SHORT without parentTradeId (field is optional)', async () => {
      // Note: In real app, API should enforce this, but model doesn't require it
      const shortTradeData = {
        portfolioId: testPortfolioId,
        coinSymbol: 'BTC',
        tradeType: TradeType.SHORT,
        entryPrice: 110000,
        depositPercent: 10,
        entryFee: 1,
        sumPlusFee: 1089,
        amount: 0.01,
        initialEntryPrice: 110000,
        initialAmount: 0.01,
      };

      const shortTrade = await Trade.create(shortTradeData);

      expect(shortTrade).toBeDefined();
      expect(shortTrade.tradeType).toBe(TradeType.SHORT);
      expect(shortTrade.parentTradeId).toBeUndefined();
    });
  });

  describe('Field Validation', () => {
    it('should validate status enum (only open, filled, closed)', async () => {
      const tradeData = {
        portfolioId: testPortfolioId,
        coinSymbol: 'BTC',
        tradeType: TradeType.LONG,
        status: 'invalid-status' as any, // Invalid status
        entryPrice: 100000,
        depositPercent: 10,
        entryFee: 1,
        sumPlusFee: 1010,
        amount: 0.01,
        initialEntryPrice: 100000,
        initialAmount: 0.01,
      };

      await expect(Trade.create(tradeData)).rejects.toThrow();
    });

    it('should validate tradeType enum (only LONG, SHORT)', async () => {
      const tradeData = {
        portfolioId: testPortfolioId,
        coinSymbol: 'BTC',
        tradeType: 'INVALID' as any, // Invalid type
        entryPrice: 100000,
        depositPercent: 10,
        entryFee: 1,
        sumPlusFee: 1010,
        amount: 0.01,
        initialEntryPrice: 100000,
        initialAmount: 0.01,
      };

      await expect(Trade.create(tradeData)).rejects.toThrow();
    });

    it('should require entryPrice to be >= 0', async () => {
      const tradeData = {
        portfolioId: testPortfolioId,
        coinSymbol: 'BTC',
        tradeType: TradeType.LONG,
        entryPrice: -1000, // Negative price
        depositPercent: 10,
        entryFee: 1,
        sumPlusFee: 1010,
        amount: 0.01,
        initialEntryPrice: 100000,
        initialAmount: 0.01,
      };

      await expect(Trade.create(tradeData)).rejects.toThrow();
    });

    it('should require amount to be >= 0', async () => {
      const tradeData = {
        portfolioId: testPortfolioId,
        coinSymbol: 'BTC',
        tradeType: TradeType.LONG,
        entryPrice: 100000,
        depositPercent: 10,
        entryFee: 1,
        sumPlusFee: 1010,
        amount: -0.01, // Negative amount
        initialEntryPrice: 100000,
        initialAmount: 0.01,
      };

      await expect(Trade.create(tradeData)).rejects.toThrow();
    });

    it('should require depositPercent to be between 0 and 100', async () => {
      const tradeData = {
        portfolioId: testPortfolioId,
        coinSymbol: 'BTC',
        tradeType: TradeType.LONG,
        entryPrice: 100000,
        depositPercent: 150, // Over 100%
        entryFee: 1,
        sumPlusFee: 1010,
        amount: 0.01,
        initialEntryPrice: 100000,
        initialAmount: 0.01,
      };

      await expect(Trade.create(tradeData)).rejects.toThrow();
    });
  });

  describe('Timestamps and Auto Fields', () => {
    it('should create timestamps automatically', async () => {
      const tradeData = {
        portfolioId: testPortfolioId,
        coinSymbol: 'BTC',
        tradeType: TradeType.LONG,
        entryPrice: 100000,
        depositPercent: 10,
        entryFee: 1,
        sumPlusFee: 1010,
        amount: 0.01,
        initialEntryPrice: 100000,
        initialAmount: 0.01,
      };

      const trade = await Trade.create(tradeData);

      expect(trade.createdAt).toBeDefined();
      expect(trade.updatedAt).toBeDefined();
      expect(trade.createdAt).toBeInstanceOf(Date);
      expect(trade.updatedAt).toBeInstanceOf(Date);
    });

    it('should set openDate automatically', async () => {
      const tradeData = {
        portfolioId: testPortfolioId,
        coinSymbol: 'BTC',
        tradeType: TradeType.LONG,
        entryPrice: 100000,
        depositPercent: 10,
        entryFee: 1,
        sumPlusFee: 1010,
        amount: 0.01,
        initialEntryPrice: 100000,
        initialAmount: 0.01,
      };

      const trade = await Trade.create(tradeData);

      expect(trade.openDate).toBeDefined();
      expect(trade.openDate).toBeInstanceOf(Date);
    });

    // ⚠️ CRITICAL TEST - DO NOT REMOVE
    // Why: initialEntryPrice must NEVER change, even when entryPrice is updated
    // Use case: When SHORT closes, parent LONG's entryPrice recalculates, but initialEntryPrice stays for reference
    // If this breaks: SHORT closing will corrupt historical data
    it('should preserve initialEntryPrice (never changes)', async () => {
      const tradeData = {
        portfolioId: testPortfolioId,
        coinSymbol: 'BTC',
        tradeType: TradeType.LONG,
        entryPrice: 100000,
        depositPercent: 10,
        entryFee: 1,
        sumPlusFee: 1010,
        amount: 0.01,
        initialEntryPrice: 100000,
        initialAmount: 0.01,
      };

      const trade = await Trade.create(tradeData);

      expect(trade.initialEntryPrice).toBe(100000);

      // Update entryPrice (simulates what happens when SHORT closes)
      trade.entryPrice = 95000;
      await trade.save();

      // ✓ initialEntryPrice should NOT change - this is the original entry price
      expect(trade.initialEntryPrice).toBe(100000);
      expect(trade.entryPrice).toBe(95000);
    });

    // ⚠️ CRITICAL TEST - DO NOT REMOVE
    // Why: initialAmount must NEVER change, even when amount is updated
    // Use case: When SHORT closes, bought-back coins are added to parent LONG's amount, but initialAmount stays
    // If this breaks: Historical tracking of original position size is lost
    it('should preserve initialAmount (never changes)', async () => {
      const tradeData = {
        portfolioId: testPortfolioId,
        coinSymbol: 'BTC',
        tradeType: TradeType.LONG,
        entryPrice: 100000,
        depositPercent: 10,
        entryFee: 1,
        sumPlusFee: 1010,
        amount: 0.01,
        initialEntryPrice: 100000,
        initialAmount: 0.01,
      };

      const trade = await Trade.create(tradeData);

      expect(trade.initialAmount).toBe(0.01);

      // Update amount (like after SHORT close adds bought-back coins)
      trade.amount = 0.015;
      await trade.save();

      // ✓ initialAmount should NOT change - this is the original amount
      expect(trade.initialAmount).toBe(0.01);
      expect(trade.amount).toBe(0.015);
    });
  });

  describe('Partial Close Fields', () => {
    it('should support isPartialClose flag', async () => {
      const tradeData = {
        portfolioId: testPortfolioId,
        coinSymbol: 'BTC',
        tradeType: TradeType.LONG,
        entryPrice: 100000,
        depositPercent: 10,
        entryFee: 1,
        sumPlusFee: 1010,
        amount: 0.01,
        initialEntryPrice: 100000,
        initialAmount: 0.01,
        isPartialClose: true,
        closedAmount: 0.003,
      };

      const trade = await Trade.create(tradeData);

      expect(trade.isPartialClose).toBe(true);
      expect(trade.closedAmount).toBe(0.003);
    });

    it('should support remainingAmount for partial closes', async () => {
      const tradeData = {
        portfolioId: testPortfolioId,
        coinSymbol: 'BTC',
        tradeType: TradeType.LONG,
        entryPrice: 100000,
        depositPercent: 10,
        entryFee: 1,
        sumPlusFee: 1010,
        amount: 0.01,
        initialEntryPrice: 100000,
        initialAmount: 0.01,
        originalAmount: 0.01,
        remainingAmount: 0.007, // After closing 0.003
      };

      const trade = await Trade.create(tradeData);

      expect(trade.originalAmount).toBe(0.01);
      expect(trade.remainingAmount).toBe(0.007);
    });
  });

  describe('Trade Status Transitions', () => {
    it('should transition from OPEN to FILLED to CLOSED', async () => {
      // Create OPEN trade
      const trade = await Trade.create({
        portfolioId: testPortfolioId,
        coinSymbol: 'BTC',
        tradeType: TradeType.LONG,
        status: TradeStatus.OPEN,
        entryPrice: 100000,
        depositPercent: 10,
        entryFee: 1,
        sumPlusFee: 1010,
        amount: 0.01,
        initialEntryPrice: 100000,
        initialAmount: 0.01,
      });

      expect(trade.status).toBe(TradeStatus.OPEN);

      // Update to FILLED
      trade.status = TradeStatus.FILLED;
      trade.filledDate = new Date();
      await trade.save();

      expect(trade.status).toBe(TradeStatus.FILLED);
      expect(trade.filledDate).toBeDefined();

      // Update to CLOSED
      trade.status = TradeStatus.CLOSED;
      trade.exitPrice = 110000;
      trade.exitFee = 1;
      trade.closeDate = new Date();
      await trade.save();

      expect(trade.status).toBe(TradeStatus.CLOSED);
      expect(trade.exitPrice).toBe(110000);
      expect(trade.closeDate).toBeDefined();
    });
  });
});
