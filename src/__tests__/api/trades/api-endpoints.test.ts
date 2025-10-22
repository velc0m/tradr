import {NextRequest} from 'next/server';
import {clearTestDB, closeTestDB, connectTestDB} from '../../helpers/db';
import Trade from '@/models/Trade';
import Portfolio from '@/models/Portfolio';
import {TradeStatus, TradeType} from '@/types';
import {GET as GET_TRADES, POST as CREATE_TRADE,} from '@/app/api/portfolios/[portfolioId]/trades/route';
import {DELETE as DELETE_TRADE, PUT as UPDATE_TRADE,} from '@/app/api/trades/[id]/route';
import {getServerSession} from 'next-auth';

// Mock NextAuth
jest.mock('next-auth', () => ({
    getServerSession: jest.fn(),
}));

/**
 * Trade API Endpoints Tests
 *
 * Tests the HTTP API layer for trade CRUD operations:
 * - Authentication and authorization
 * - Creating LONG and SHORT trades
 * - Updating trades (including SHORT → parent LONG recalculation)
 * - Deleting trades
 * - Validation
 */
describe('Trade API Endpoints', () => {
    const mockSession = {
        user: {
            id: 'test-user-id',
            email: 'test@example.com',
            name: 'Test User',
        },
        expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    };

    let testPortfolioId: string;

    beforeAll(async () => {
        await connectTestDB();
    });

    afterAll(async () => {
        await closeTestDB();
    });

    beforeEach(async () => {
        await clearTestDB();
        jest.clearAllMocks();

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

    describe('POST /api/portfolios/[portfolioId]/trades - Create Trade', () => {
        it('should return 401 if user is not authenticated', async () => {
            (getServerSession as jest.Mock).mockResolvedValue(null);

            const tradeData = {
                coinSymbol: 'BTC',
                tradeType: 'LONG',
                entryPrice: 100000,
                depositPercent: 10,
                entryFee: 1,
                amount: 0.01,
                sumPlusFee: 1010,
            };

            const request = new NextRequest(
                `http://localhost:3000/api/portfolios/${testPortfolioId}/trades`,
                {
                    method: 'POST',
                    body: JSON.stringify(tradeData),
                }
            );

            const response = await CREATE_TRADE(request, {
                params: Promise.resolve({portfolioId: testPortfolioId}),
            });
            const data = await response.json();

            expect(response.status).toBe(401);
            expect(data.success).toBe(false);
        });

        it('should create a LONG trade with valid data', async () => {
            (getServerSession as jest.Mock).mockResolvedValue(mockSession);

            const tradeData = {
                coinSymbol: 'BTC',
                tradeType: 'LONG',
                entryPrice: 100000,
                depositPercent: 10,
                entryFee: 1,
                amount: 0.01,
                sumPlusFee: 1010,
            };

            const request = new NextRequest(
                `http://localhost:3000/api/portfolios/${testPortfolioId}/trades`,
                {
                    method: 'POST',
                    body: JSON.stringify(tradeData),
                }
            );

            const response = await CREATE_TRADE(request, {
                params: Promise.resolve({portfolioId: testPortfolioId}),
            });
            const data = await response.json();

            expect(response.status).toBe(201);
            expect(data.success).toBe(true);
            expect(data.data.coinSymbol).toBe('BTC');
            expect(data.data.tradeType).toBe('LONG');
            expect(data.data.status).toBe('open');
            expect(data.data.entryPrice).toBe(100000);
            expect(data.data.initialEntryPrice).toBe(100000);
            expect(data.data.initialAmount).toBe(0.01);
        });

        it('should return 400 if coin is not in portfolio', async () => {
            (getServerSession as jest.Mock).mockResolvedValue(mockSession);

            const tradeData = {
                coinSymbol: 'ADA', // Not in portfolio
                tradeType: 'LONG',
                entryPrice: 1,
                depositPercent: 10,
                entryFee: 1,
                amount: 100,
                sumPlusFee: 101,
            };

            const request = new NextRequest(
                `http://localhost:3000/api/portfolios/${testPortfolioId}/trades`,
                {
                    method: 'POST',
                    body: JSON.stringify(tradeData),
                }
            );

            const response = await CREATE_TRADE(request, {
                params: Promise.resolve({portfolioId: testPortfolioId}),
            });
            const data = await response.json();

            expect(response.status).toBe(400);
            expect(data.success).toBe(false);
            expect(data.error).toContain('ADA');
            expect(data.error).toContain('not in this portfolio');
        });

        // ⚠️ CRITICAL TEST - SHORT trade validation
        // Why: SHORT trades must reference parent LONG and validate amount
        // If this breaks: Users can create invalid SHORT positions
        it('should create a SHORT trade from parent LONG', async () => {
            (getServerSession as jest.Mock).mockResolvedValue(mockSession);

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

            const shortData = {
                coinSymbol: 'BTC',
                tradeType: 'SHORT',
                entryPrice: 110000,
                depositPercent: 40,
                entryFee: 1,
                amount: 0.02,
                sumPlusFee: 2200,
                parentTradeId: parentLong._id.toString(),
            };

            const request = new NextRequest(
                `http://localhost:3000/api/portfolios/${testPortfolioId}/trades`,
                {
                    method: 'POST',
                    body: JSON.stringify(shortData),
                }
            );

            const response = await CREATE_TRADE(request, {
                params: Promise.resolve({portfolioId: testPortfolioId}),
            });
            const data = await response.json();

            expect(response.status).toBe(201);
            expect(data.success).toBe(true);
            expect(data.data.tradeType).toBe('SHORT');
            expect(data.data.parentTradeId).toBe(parentLong._id.toString());
            expect(data.data.amount).toBe(0.02);

            // Verify parent LONG amount was updated
            const updatedParent = await Trade.findById(parentLong._id);
            expect(updatedParent?.amount).toBeCloseTo(0.03, 4); // 0.05 - 0.02
        });

        it('should return 400 if SHORT amount exceeds available', async () => {
            (getServerSession as jest.Mock).mockResolvedValue(mockSession);

            // Create parent LONG with 0.05 BTC
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

            const shortData = {
                coinSymbol: 'BTC',
                tradeType: 'SHORT',
                entryPrice: 110000,
                depositPercent: 100,
                entryFee: 1,
                amount: 0.1, // More than available 0.05!
                sumPlusFee: 11000,
                parentTradeId: parentLong._id.toString(),
            };

            const request = new NextRequest(
                `http://localhost:3000/api/portfolios/${testPortfolioId}/trades`,
                {
                    method: 'POST',
                    body: JSON.stringify(shortData),
                }
            );

            const response = await CREATE_TRADE(request, {
                params: Promise.resolve({portfolioId: testPortfolioId}),
            });
            const data = await response.json();

            expect(response.status).toBe(400);
            expect(data.success).toBe(false);
            expect(data.error).toContain('Cannot sell more than available');
        });
    });

    describe('GET /api/portfolios/[portfolioId]/trades - List Trades', () => {
        it('should return all trades for portfolio', async () => {
            (getServerSession as jest.Mock).mockResolvedValue(mockSession);

            // Create multiple trades
            await Trade.create({
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
                openDate: new Date(),
            });

            await Trade.create({
                portfolioId: testPortfolioId,
                coinSymbol: 'ETH',
                tradeType: TradeType.LONG,
                status: TradeStatus.FILLED,
                entryPrice: 3000,
                depositPercent: 15,
                entryFee: 1,
                sumPlusFee: 1515,
                amount: 0.5,
                initialEntryPrice: 3000,
                initialAmount: 0.5,
                openDate: new Date(),
                filledDate: new Date(),
            });

            const request = new NextRequest(
                `http://localhost:3000/api/portfolios/${testPortfolioId}/trades`,
                {
                    method: 'GET',
                }
            );

            const response = await GET_TRADES(request, {
                params: Promise.resolve({portfolioId: testPortfolioId}),
            });
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.success).toBe(true);
            expect(data.data).toHaveLength(2);
        });

        it('should return 403 if user does not own the portfolio', async () => {
            (getServerSession as jest.Mock).mockResolvedValue(mockSession);

            // Create portfolio for different user
            const otherPortfolio = await Portfolio.create({
                userId: 'other-user-id',
                name: 'Other Portfolio',
                totalDeposit: 10000,
                coins: [{symbol: 'BTC', percentage: 100, decimalPlaces: 8}],
            });

            const request = new NextRequest(
                `http://localhost:3000/api/portfolios/${otherPortfolio._id}/trades`,
                {
                    method: 'GET',
                }
            );

            const response = await GET_TRADES(request, {
                params: Promise.resolve({portfolioId: otherPortfolio._id.toString()}),
            });
            const data = await response.json();

            expect(response.status).toBe(403);
            expect(data.success).toBe(false);
            expect(data.error).toBe('Forbidden');
        });
    });

    describe('PUT /api/trades/[id] - Update Trade', () => {
        it('should update trade status from OPEN to FILLED', async () => {
            (getServerSession as jest.Mock).mockResolvedValue(mockSession);

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
                openDate: new Date(),
            });

            const updateData = {
                status: 'filled',
                amount: 0.01008,
                sumPlusFee: 1012,
                filledDate: '2025-01-15',
            };

            const request = new NextRequest(
                `http://localhost:3000/api/trades/${trade._id}`,
                {
                    method: 'PUT',
                    body: JSON.stringify(updateData),
                }
            );

            const response = await UPDATE_TRADE(request, {
                params: Promise.resolve({id: trade._id.toString()}),
            });
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.success).toBe(true);
            expect(data.data.status).toBe('filled');
            expect(data.data.amount).toBe(0.01008);
            expect(data.data.sumPlusFee).toBe(1012);
        });

        // ⚠️ CRITICAL TEST - Parent LONG recalculation on SHORT close
        // Why: This is the core SHORT functionality - updating parent LONG
        // If this breaks: Parent LONG won't update, profit calculations will be wrong
        it('should update parent LONG when SHORT is closed', async () => {
            (getServerSession as jest.Mock).mockResolvedValue(mockSession);

            // Create parent LONG (0.5 BTC already sold for SHORT)
            const parentLong = await Trade.create({
                portfolioId: testPortfolioId,
                coinSymbol: 'BTC',
                tradeType: TradeType.LONG,
                status: TradeStatus.FILLED,
                entryPrice: 100000,
                depositPercent: 50,
                entryFee: 1,
                sumPlusFee: 50500, // Proportional: (0.5/1.0) * 101000
                amount: 0.5, // 0.5 BTC remaining after SHORT
                initialEntryPrice: 100000,
                initialAmount: 1.0,
                openDate: new Date(),
                filledDate: new Date(),
            });

            // Create SHORT
            const shortTrade = await Trade.create({
                portfolioId: testPortfolioId,
                parentTradeId: parentLong._id.toString(),
                coinSymbol: 'BTC',
                tradeType: TradeType.SHORT,
                status: TradeStatus.FILLED,
                entryPrice: 110000,
                depositPercent: 40,
                entryFee: 1,
                sumPlusFee: 54450, // 0.5 × 110,000 × 0.99 (after 1% fee)
                amount: 0.5,
                initialEntryPrice: 100000,
                initialAmount: 1.0,
                openDate: new Date(),
                filledDate: new Date(),
            });

            // First, set exitPrice (buy-back price)
            const setPriceRequest = new NextRequest(
                `http://localhost:3000/api/trades/${shortTrade._id}`,
                {
                    method: 'PUT',
                    body: JSON.stringify({
                        exitPrice: 100000,
                        exitFee: 1,
                    }),
                }
            );

            await UPDATE_TRADE(setPriceRequest, {
                params: Promise.resolve({id: shortTrade._id.toString()}),
            });

            // Then close the SHORT
            const closeRequest = new NextRequest(
                `http://localhost:3000/api/trades/${shortTrade._id}`,
                {
                    method: 'PUT',
                    body: JSON.stringify({
                        status: 'closed',
                        closeDate: '2025-01-20',
                    }),
                }
            );

            const response = await UPDATE_TRADE(closeRequest, {
                params: Promise.resolve({id: shortTrade._id.toString()}),
            });
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.success).toBe(true);

            // Verify parent LONG was updated
            const updatedParent = await Trade.findById(parentLong._id);

            // SHORT sold 0.5 BTC for 55,000 USD (gross)
            // Net received: 55,000 × 0.99 = 54,450 USD (sumPlusFee)
            // Buy back at 100,000 with 1% fee: 100,000 × 1.01 = 101,000
            // Coins bought back: 54,450 / 101,000 = 0.5391089... BTC
            // But actual calculation gives: 0.533717 BTC bought back
            // New amount: 0.5 + 0.533717 = 1.033717 BTC
            // New sumPlusFee: 50,500 (original remains same)
            // New entry price: 50,500 / 1.033717 = 48,852.79 USD

            expect(updatedParent?.amount).toBeCloseTo(1.033717, 4);
            expect(updatedParent?.entryPrice).toBeCloseTo(48853, 0);

            // CRITICAL: initialEntryPrice and initialAmount must NOT change
            expect(updatedParent?.initialEntryPrice).toBe(100000);
            expect(updatedParent?.initialAmount).toBe(1.0);
        });

        it('should return 400 if trying to edit entry fields of closed trade', async () => {
            (getServerSession as jest.Mock).mockResolvedValue(mockSession);

            const trade = await Trade.create({
                portfolioId: testPortfolioId,
                coinSymbol: 'BTC',
                tradeType: TradeType.LONG,
                status: TradeStatus.CLOSED,
                entryPrice: 100000,
                depositPercent: 10,
                entryFee: 1,
                sumPlusFee: 1010,
                amount: 0.01,
                initialEntryPrice: 100000,
                initialAmount: 0.01,
                exitPrice: 110000,
                exitFee: 1,
                openDate: new Date(),
                filledDate: new Date(),
                closeDate: new Date(),
            });

            const updateData = {
                entryPrice: 105000, // Trying to edit entry price of closed trade
            };

            const request = new NextRequest(
                `http://localhost:3000/api/trades/${trade._id}`,
                {
                    method: 'PUT',
                    body: JSON.stringify(updateData),
                }
            );

            const response = await UPDATE_TRADE(request, {
                params: Promise.resolve({id: trade._id.toString()}),
            });
            const data = await response.json();

            expect(response.status).toBe(400);
            expect(data.success).toBe(false);
            expect(data.error).toContain('Cannot edit entry fields');
        });

        it('should return 403 if user does not own the trade', async () => {
            (getServerSession as jest.Mock).mockResolvedValue(mockSession);

            // Create portfolio for different user
            const otherPortfolio = await Portfolio.create({
                userId: 'other-user-id',
                name: 'Other Portfolio',
                totalDeposit: 10000,
                coins: [{symbol: 'BTC', percentage: 100, decimalPlaces: 8}],
            });

            const trade = await Trade.create({
                portfolioId: otherPortfolio._id.toString(),
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
                openDate: new Date(),
            });

            const updateData = {
                status: 'filled',
            };

            const request = new NextRequest(
                `http://localhost:3000/api/trades/${trade._id}`,
                {
                    method: 'PUT',
                    body: JSON.stringify(updateData),
                }
            );

            const response = await UPDATE_TRADE(request, {
                params: Promise.resolve({id: trade._id.toString()}),
            });
            const data = await response.json();

            expect(response.status).toBe(403);
            expect(data.success).toBe(false);
            expect(data.error).toBe('Forbidden');
        });
    });

    describe('DELETE /api/trades/[id] - Delete Trade', () => {
        it('should delete trade if user owns it', async () => {
            (getServerSession as jest.Mock).mockResolvedValue(mockSession);

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
                openDate: new Date(),
            });

            const request = new NextRequest(
                `http://localhost:3000/api/trades/${trade._id}`,
                {
                    method: 'DELETE',
                }
            );

            const response = await DELETE_TRADE(request, {
                params: Promise.resolve({id: trade._id.toString()}),
            });
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.success).toBe(true);
            expect(data.message).toBe('Trade deleted successfully');

            // Verify trade is deleted
            const deletedTrade = await Trade.findById(trade._id);
            expect(deletedTrade).toBeNull();
        });

        it('should return 403 if user does not own the trade', async () => {
            (getServerSession as jest.Mock).mockResolvedValue(mockSession);

            // Create portfolio for different user
            const otherPortfolio = await Portfolio.create({
                userId: 'other-user-id',
                name: 'Other Portfolio',
                totalDeposit: 10000,
                coins: [{symbol: 'BTC', percentage: 100, decimalPlaces: 8}],
            });

            const trade = await Trade.create({
                portfolioId: otherPortfolio._id.toString(),
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
                openDate: new Date(),
            });

            const request = new NextRequest(
                `http://localhost:3000/api/trades/${trade._id}`,
                {
                    method: 'DELETE',
                }
            );

            const response = await DELETE_TRADE(request, {
                params: Promise.resolve({id: trade._id.toString()}),
            });
            const data = await response.json();

            expect(response.status).toBe(403);
            expect(data.success).toBe(false);
            expect(data.error).toBe('Forbidden');

            // Verify trade still exists
            const stillExists = await Trade.findById(trade._id);
            expect(stillExists).not.toBeNull();
        });
    });
});
