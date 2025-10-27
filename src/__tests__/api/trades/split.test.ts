import {clearTestDB, closeTestDB, connectTestDB} from '../../helpers/db';
import Trade from '@/models/Trade';
import Portfolio from '@/models/Portfolio';
import {TradeStatus, TradeType} from '@/types';
import {NextRequest} from 'next/server';
import {POST} from '@/app/api/trades/[id]/split/route';
import {getServerSession} from 'next-auth';

// Mock next-auth
jest.mock('next-auth', () => ({
    getServerSession: jest.fn(),
}));

const mockSession = {
    user: {
        id: 'test-user-id',
        email: 'test@example.com',
    },
    expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
};

describe('Split Trade API Tests', () => {
    let testPortfolioId: string;

    beforeAll(async () => {
        await connectTestDB();
    });

    afterAll(async () => {
        await closeTestDB();
    });

    beforeEach(async () => {
        // Mock authentication
        (getServerSession as jest.Mock).mockResolvedValue(mockSession);

        // Create a test portfolio
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

    describe('Basic Split Functionality', () => {
        it('should split a FILLED trade into 2 parts', async () => {
            // Create FILLED trade
            const trade = await Trade.create({
                portfolioId: testPortfolioId,
                coinSymbol: 'BTC',
                tradeType: TradeType.LONG,
                status: TradeStatus.FILLED,
                entryPrice: 100000,
                depositPercent: 10,
                entryFee: 0.1,
                sumPlusFee: 1010,
                amount: 0.01,
                initialEntryPrice: 100000,
                initialAmount: 0.01,
            });

            const request = new NextRequest('http://localhost:3000/api/trades/' + trade._id + '/split', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({amounts: [0.006, 0.004]}),
            });

            const response = await POST(request, {params: {id: trade._id.toString()}});
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.success).toBe(true);
            expect(data.data.splitTrades).toHaveLength(2);

            // Verify split trades have correct amounts
            const splitTrades = data.data.splitTrades;
            expect(splitTrades[0].amount).toBe(0.006);
            expect(splitTrades[1].amount).toBe(0.004);

            // Verify sumPlusFee calculation: Part1 = amount × entryPrice, Part2 = remainder
            expect(splitTrades[0].sumPlusFee).toBeCloseTo(600, 0); // 0.006 × 100000
            expect(splitTrades[1].sumPlusFee).toBeCloseTo(410, 0); // 1010 - 600

            // Verify all splits have same entryPrice, fees, dates
            expect(splitTrades[0].entryPrice).toBe(100000);
            expect(splitTrades[1].entryPrice).toBe(100000);
            expect(splitTrades[0].entryFee).toBe(0.1);
            expect(splitTrades[1].entryFee).toBe(0.1);

            // Verify all have same splitGroupId
            expect(splitTrades[0].splitGroupId).toBeDefined();
            expect(splitTrades[0].splitGroupId).toBe(splitTrades[1].splitGroupId);

            // Verify all reference original trade
            expect(splitTrades[0].splitFromTradeId).toBe(trade._id.toString());
            expect(splitTrades[1].splitFromTradeId).toBe(trade._id.toString());

            // Verify original trade is marked as split and closed
            const updatedOriginal = await Trade.findById(trade._id);
            expect(updatedOriginal?.isSplit).toBe(true);
            expect(updatedOriginal?.status).toBe(TradeStatus.CLOSED);
            expect(updatedOriginal?.closeDate).toBeDefined();
        });

        it('should split a FILLED trade into 3 parts', async () => {
            const trade = await Trade.create({
                portfolioId: testPortfolioId,
                coinSymbol: 'ETH',
                tradeType: TradeType.LONG,
                status: TradeStatus.FILLED,
                entryPrice: 3000,
                depositPercent: 20,
                entryFee: 0.1,
                sumPlusFee: 2002,
                amount: 0.666,
                initialEntryPrice: 3000,
                initialAmount: 0.666,
            });

            const request = new NextRequest('http://localhost:3000/api/trades/' + trade._id + '/split', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({amounts: [0.2, 0.3, 0.166]}),
            });

            const response = await POST(request, {params: {id: trade._id.toString()}});
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.data.splitTrades).toHaveLength(3);

            const splitTrades = data.data.splitTrades;
            expect(splitTrades[0].amount).toBeCloseTo(0.2, 6);
            expect(splitTrades[1].amount).toBeCloseTo(0.3, 6);
            expect(splitTrades[2].amount).toBeCloseTo(0.166, 6);

            // Verify sumPlusFee calculation: Part1/Part2 = amount × entryPrice, Part3 = remainder
            expect(splitTrades[0].sumPlusFee).toBeCloseTo(600, 1); // 0.2 × 3000
            expect(splitTrades[1].sumPlusFee).toBeCloseTo(900, 1); // 0.3 × 3000
            expect(splitTrades[2].sumPlusFee).toBeCloseTo(502, 1); // 2002 - 600 - 900
        });

        it('should split a FILLED trade into 5 parts (maximum)', async () => {
            const trade = await Trade.create({
                portfolioId: testPortfolioId,
                coinSymbol: 'BTC',
                tradeType: TradeType.LONG,
                status: TradeStatus.FILLED,
                entryPrice: 50000,
                depositPercent: 50,
                entryFee: 0.1,
                sumPlusFee: 5005,
                amount: 0.1,
                initialEntryPrice: 50000,
                initialAmount: 0.1,
            });

            const request = new NextRequest('http://localhost:3000/api/trades/' + trade._id + '/split', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({amounts: [0.02, 0.02, 0.02, 0.02, 0.02]}),
            });

            const response = await POST(request, {params: {id: trade._id.toString()}});
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.data.splitTrades).toHaveLength(5);

            // Verify all have same splitGroupId
            const splitGroupId = data.data.splitTrades[0].splitGroupId;
            data.data.splitTrades.forEach((split: any) => {
                expect(split.splitGroupId).toBe(splitGroupId);
            });
        });
    });

    describe('Validation Tests', () => {
        it('should reject split if trade is OPEN', async () => {
            const trade = await Trade.create({
                portfolioId: testPortfolioId,
                coinSymbol: 'BTC',
                tradeType: TradeType.LONG,
                status: TradeStatus.OPEN,
                entryPrice: 100000,
                depositPercent: 10,
                entryFee: 0.1,
                sumPlusFee: 1010,
                amount: 0.01,
                initialEntryPrice: 100000,
                initialAmount: 0.01,
            });

            const request = new NextRequest('http://localhost:3000/api/trades/' + trade._id + '/split', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({amounts: [0.006, 0.004]}),
            });

            const response = await POST(request, {params: {id: trade._id.toString()}});
            const data = await response.json();

            expect(response.status).toBe(400);
            expect(data.success).toBe(false);
            expect(data.error).toContain('Only FILLED trades can be split');
        });

        it('should reject split if trade is CLOSED', async () => {
            const trade = await Trade.create({
                portfolioId: testPortfolioId,
                coinSymbol: 'BTC',
                tradeType: TradeType.LONG,
                status: TradeStatus.CLOSED,
                entryPrice: 100000,
                depositPercent: 10,
                entryFee: 0.1,
                sumPlusFee: 1010,
                amount: 0.01,
                initialEntryPrice: 100000,
                initialAmount: 0.01,
                exitPrice: 110000,
                exitFee: 0.1,
            });

            const request = new NextRequest('http://localhost:3000/api/trades/' + trade._id + '/split', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({amounts: [0.006, 0.004]}),
            });

            const response = await POST(request, {params: {id: trade._id.toString()}});
            const data = await response.json();

            expect(response.status).toBe(400);
            expect(data.success).toBe(false);
            expect(data.error).toContain('Only FILLED trades can be split');
        });

        it('should reject split if amounts do not sum to trade amount', async () => {
            const trade = await Trade.create({
                portfolioId: testPortfolioId,
                coinSymbol: 'BTC',
                tradeType: TradeType.LONG,
                status: TradeStatus.FILLED,
                entryPrice: 100000,
                depositPercent: 10,
                entryFee: 0.1,
                sumPlusFee: 1010,
                amount: 0.01,
                initialEntryPrice: 100000,
                initialAmount: 0.01,
            });

            const request = new NextRequest('http://localhost:3000/api/trades/' + trade._id + '/split', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({amounts: [0.006, 0.003]}), // Sum = 0.009, not 0.01
            });

            const response = await POST(request, {params: {id: trade._id.toString()}});
            const data = await response.json();

            expect(response.status).toBe(400);
            expect(data.success).toBe(false);
            expect(data.error).toContain('must equal trade amount');
        });

        it('should reject split with less than 2 parts', async () => {
            const trade = await Trade.create({
                portfolioId: testPortfolioId,
                coinSymbol: 'BTC',
                tradeType: TradeType.LONG,
                status: TradeStatus.FILLED,
                entryPrice: 100000,
                depositPercent: 10,
                entryFee: 0.1,
                sumPlusFee: 1010,
                amount: 0.01,
                initialEntryPrice: 100000,
                initialAmount: 0.01,
            });

            const request = new NextRequest('http://localhost:3000/api/trades/' + trade._id + '/split', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({amounts: [0.01]}), // Only 1 part
            });

            const response = await POST(request, {params: {id: trade._id.toString()}});
            const data = await response.json();

            expect(response.status).toBe(400);
            expect(data.success).toBe(false);
            expect(data.error).toContain('Must split into at least 2 parts');
        });

        it('should reject split with more than 5 parts', async () => {
            const trade = await Trade.create({
                portfolioId: testPortfolioId,
                coinSymbol: 'BTC',
                tradeType: TradeType.LONG,
                status: TradeStatus.FILLED,
                entryPrice: 100000,
                depositPercent: 10,
                entryFee: 0.1,
                sumPlusFee: 1010,
                amount: 0.06,
                initialEntryPrice: 100000,
                initialAmount: 0.06,
            });

            const request = new NextRequest('http://localhost:3000/api/trades/' + trade._id + '/split', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({amounts: [0.01, 0.01, 0.01, 0.01, 0.01, 0.01]}), // 6 parts
            });

            const response = await POST(request, {params: {id: trade._id.toString()}});
            const data = await response.json();

            expect(response.status).toBe(400);
            expect(data.success).toBe(false);
            expect(data.error).toContain('Cannot split into more than 5 parts');
        });

        it('should reject split with negative amounts', async () => {
            const trade = await Trade.create({
                portfolioId: testPortfolioId,
                coinSymbol: 'BTC',
                tradeType: TradeType.LONG,
                status: TradeStatus.FILLED,
                entryPrice: 100000,
                depositPercent: 10,
                entryFee: 0.1,
                sumPlusFee: 1010,
                amount: 0.01,
                initialEntryPrice: 100000,
                initialAmount: 0.01,
            });

            const request = new NextRequest('http://localhost:3000/api/trades/' + trade._id + '/split', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({amounts: [0.012, -0.002]}),
            });

            const response = await POST(request, {params: {id: trade._id.toString()}});
            const data = await response.json();

            expect(response.status).toBe(400);
            expect(data.success).toBe(false);
            expect(data.error).toContain('must be positive');
        });

        it('should reject split with zero amounts', async () => {
            const trade = await Trade.create({
                portfolioId: testPortfolioId,
                coinSymbol: 'BTC',
                tradeType: TradeType.LONG,
                status: TradeStatus.FILLED,
                entryPrice: 100000,
                depositPercent: 10,
                entryFee: 0.1,
                sumPlusFee: 1010,
                amount: 0.01,
                initialEntryPrice: 100000,
                initialAmount: 0.01,
            });

            const request = new NextRequest('http://localhost:3000/api/trades/' + trade._id + '/split', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({amounts: [0.01, 0]}),
            });

            const response = await POST(request, {params: {id: trade._id.toString()}});
            const data = await response.json();

            expect(response.status).toBe(400);
            expect(data.success).toBe(false);
            expect(data.error).toContain('must be positive');
        });

        it('should reject split if trade is SHORT with parentTradeId', async () => {
            // First create parent LONG
            const parentLong = await Trade.create({
                portfolioId: testPortfolioId,
                coinSymbol: 'BTC',
                tradeType: TradeType.LONG,
                status: TradeStatus.FILLED,
                entryPrice: 100000,
                depositPercent: 20,
                entryFee: 0.1,
                sumPlusFee: 2002,
                amount: 0.02,
                initialEntryPrice: 100000,
                initialAmount: 0.02,
            });

            // Create SHORT from parent LONG
            const shortTrade = await Trade.create({
                portfolioId: testPortfolioId,
                coinSymbol: 'BTC',
                tradeType: TradeType.SHORT,
                status: TradeStatus.FILLED,
                parentTradeId: parentLong._id.toString(),
                entryPrice: 110000,
                depositPercent: 50,
                entryFee: 0.1,
                sumPlusFee: 1099,
                amount: 0.01,
                initialEntryPrice: 110000,
                initialAmount: 0.01,
            });

            const request = new NextRequest('http://localhost:3000/api/trades/' + shortTrade._id + '/split', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({amounts: [0.006, 0.004]}),
            });

            const response = await POST(request, {params: {id: shortTrade._id.toString()}});
            const data = await response.json();

            expect(response.status).toBe(400);
            expect(data.success).toBe(false);
            expect(data.error).toContain('Cannot split SHORT positions that are derived from LONG positions');
        });

        it('should allow split of standalone SHORT (no parentTradeId)', async () => {
            // Create standalone SHORT (no parent)
            const shortTrade = await Trade.create({
                portfolioId: testPortfolioId,
                coinSymbol: 'BTC',
                tradeType: TradeType.SHORT,
                status: TradeStatus.FILLED,
                entryPrice: 110000,
                depositPercent: 10,
                entryFee: 0.1,
                sumPlusFee: 1099,
                amount: 0.01,
                initialEntryPrice: 110000,
                initialAmount: 0.01,
            });

            const request = new NextRequest('http://localhost:3000/api/trades/' + shortTrade._id + '/split', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({amounts: [0.006, 0.004]}),
            });

            const response = await POST(request, {params: {id: shortTrade._id.toString()}});
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.success).toBe(true);
            expect(data.data.splitTrades).toHaveLength(2);
        });

        it('should reject split if trade does not exist', async () => {
            const fakeId = '507f1f77bcf86cd799439011';

            const request = new NextRequest('http://localhost:3000/api/trades/' + fakeId + '/split', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({amounts: [0.006, 0.004]}),
            });

            const response = await POST(request, {params: {id: fakeId}});
            const data = await response.json();

            expect(response.status).toBe(404);
            expect(data.success).toBe(false);
            expect(data.error).toContain('Trade not found');
        });
    });

    describe('Data Preservation Tests', () => {
        it('should preserve all critical fields from original trade', async () => {
            const openDate = new Date('2024-01-01T10:00:00Z');
            const filledDate = new Date('2024-01-01T11:00:00Z');

            const trade = await Trade.create({
                portfolioId: testPortfolioId,
                coinSymbol: 'ETH',
                tradeType: TradeType.LONG,
                status: TradeStatus.FILLED,
                entryPrice: 3500,
                depositPercent: 15,
                entryFee: 0.15,
                sumPlusFee: 1507.5,
                amount: 0.43,
                initialEntryPrice: 3500,
                initialAmount: 0.43,
                openDate: openDate,
                filledDate: filledDate,
            });

            const request = new NextRequest('http://localhost:3000/api/trades/' + trade._id + '/split', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({amounts: [0.2, 0.23]}),
            });

            const response = await POST(request, {params: {id: trade._id.toString()}});
            const data = await response.json();

            const splitTrades = data.data.splitTrades;

            // Verify both splits preserve critical fields
            splitTrades.forEach((split: any) => {
                expect(split.portfolioId).toBe(testPortfolioId);
                expect(split.coinSymbol).toBe('ETH');
                expect(split.tradeType).toBe(TradeType.LONG);
                expect(split.status).toBe(TradeStatus.FILLED);
                expect(split.entryPrice).toBe(3500);
                expect(split.depositPercent).toBe(15);
                expect(split.entryFee).toBe(0.15);
                expect(new Date(split.openDate).getTime()).toBe(openDate.getTime());
                expect(new Date(split.filledDate).getTime()).toBe(filledDate.getTime());
                expect(split.splitFromTradeId).toBe(trade._id.toString());
            });

            // Verify initialEntryPrice and initialAmount match the NEW amounts, not original
            expect(splitTrades[0].initialEntryPrice).toBe(3500);
            expect(splitTrades[0].initialAmount).toBe(0.2);
            expect(splitTrades[1].initialEntryPrice).toBe(3500);
            expect(splitTrades[1].initialAmount).toBe(0.23);
        });

        it('should NOT have exitPrice or closeDate for split trades', async () => {
            // Create a normal FILLED trade
            const trade = await Trade.create({
                portfolioId: testPortfolioId,
                coinSymbol: 'BTC',
                tradeType: TradeType.LONG,
                status: TradeStatus.FILLED,
                entryPrice: 100000,
                depositPercent: 10,
                entryFee: 0.1,
                sumPlusFee: 1010,
                amount: 0.01,
                initialEntryPrice: 100000,
                initialAmount: 0.01,
            });

            const request = new NextRequest('http://localhost:3000/api/trades/' + trade._id + '/split', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({amounts: [0.006, 0.004]}),
            });

            const response = await POST(request, {params: {id: trade._id.toString()}});
            const data = await response.json();

            const splitTrades = data.data.splitTrades;

            // Split trades should NOT have exitPrice or closeDate (they're FILLED, not CLOSED)
            splitTrades.forEach((split: any) => {
                expect(split.exitPrice).toBeUndefined();
                expect(split.closeDate).toBeUndefined();
                expect(split.status).toBe(TradeStatus.FILLED);
            });
        });
    });

    describe('Edge Cases', () => {
        it('should handle very small amounts with precision', async () => {
            const trade = await Trade.create({
                portfolioId: testPortfolioId,
                coinSymbol: 'BTC',
                tradeType: TradeType.LONG,
                status: TradeStatus.FILLED,
                entryPrice: 100000,
                depositPercent: 1,
                entryFee: 0.1,
                sumPlusFee: 100.1,
                amount: 0.001,
                initialEntryPrice: 100000,
                initialAmount: 0.001,
            });

            const request = new NextRequest('http://localhost:3000/api/trades/' + trade._id + '/split', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({amounts: [0.0004, 0.0006]}),
            });

            const response = await POST(request, {params: {id: trade._id.toString()}});
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.data.splitTrades[0].amount).toBeCloseTo(0.0004, 8);
            expect(data.data.splitTrades[1].amount).toBeCloseTo(0.0006, 8);
        });

        it('should handle floating point rounding in sum validation', async () => {
            const trade = await Trade.create({
                portfolioId: testPortfolioId,
                coinSymbol: 'ETH',
                tradeType: TradeType.LONG,
                status: TradeStatus.FILLED,
                entryPrice: 3000,
                depositPercent: 10,
                entryFee: 0.1,
                sumPlusFee: 1001,
                amount: 0.333333,
                initialEntryPrice: 3000,
                initialAmount: 0.333333,
            });

            // Split into 3 parts that add up to 0.333333 (might have floating point issues)
            const request = new NextRequest('http://localhost:3000/api/trades/' + trade._id + '/split', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({amounts: [0.111111, 0.111111, 0.111111]}),
            });

            const response = await POST(request, {params: {id: trade._id.toString()}});
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.success).toBe(true);
        });

        it('should create unique splitGroupId for each split operation', async () => {
            // Create two trades
            const trade1 = await Trade.create({
                portfolioId: testPortfolioId,
                coinSymbol: 'BTC',
                tradeType: TradeType.LONG,
                status: TradeStatus.FILLED,
                entryPrice: 100000,
                depositPercent: 10,
                entryFee: 0.1,
                sumPlusFee: 1010,
                amount: 0.01,
                initialEntryPrice: 100000,
                initialAmount: 0.01,
            });

            const trade2 = await Trade.create({
                portfolioId: testPortfolioId,
                coinSymbol: 'ETH',
                tradeType: TradeType.LONG,
                status: TradeStatus.FILLED,
                entryPrice: 3000,
                depositPercent: 10,
                entryFee: 0.1,
                sumPlusFee: 1001,
                amount: 0.333,
                initialEntryPrice: 3000,
                initialAmount: 0.333,
            });

            // Split both
            const request1 = new NextRequest('http://localhost:3000/api/trades/' + trade1._id + '/split', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({amounts: [0.006, 0.004]}),
            });

            const request2 = new NextRequest('http://localhost:3000/api/trades/' + trade2._id + '/split', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({amounts: [0.2, 0.133]}),
            });

            const response1 = await POST(request1, {params: {id: trade1._id.toString()}});
            const response2 = await POST(request2, {params: {id: trade2._id.toString()}});

            const data1 = await response1.json();
            const data2 = await response2.json();

            const splitGroupId1 = data1.data.splitTrades[0].splitGroupId;
            const splitGroupId2 = data2.data.splitTrades[0].splitGroupId;

            // Should be different UUIDs
            expect(splitGroupId1).not.toBe(splitGroupId2);
        });
    });

    describe('Database Consistency Tests', () => {
        it('should correctly update database with all split trades', async () => {
            const trade = await Trade.create({
                portfolioId: testPortfolioId,
                coinSymbol: 'BTC',
                tradeType: TradeType.LONG,
                status: TradeStatus.FILLED,
                entryPrice: 100000,
                depositPercent: 10,
                entryFee: 0.1,
                sumPlusFee: 1010,
                amount: 0.01,
                initialEntryPrice: 100000,
                initialAmount: 0.01,
            });

            const request = new NextRequest('http://localhost:3000/api/trades/' + trade._id + '/split', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({amounts: [0.003, 0.007]}),
            });

            await POST(request, {params: {id: trade._id.toString()}});

            // Query database directly
            const allTrades = await Trade.find({portfolioId: testPortfolioId});

            // Should have 3 trades: 1 original (closed), 2 splits
            expect(allTrades).toHaveLength(3);

            const originalTrade = allTrades.find(t => t._id.toString() === trade._id.toString());
            const splitTrades = allTrades.filter(t => t.splitFromTradeId === trade._id.toString());

            expect(originalTrade?.status).toBe(TradeStatus.CLOSED);
            expect(originalTrade?.isSplit).toBe(true);
            expect(splitTrades).toHaveLength(2);

            // Verify split trades in database have correct splitGroupId
            const splitGroupId = splitTrades[0].splitGroupId;
            expect(splitTrades[1].splitGroupId).toBe(splitGroupId);
        });

        it('should rollback if error occurs during split', async () => {
            // This is hard to test without mocking, but we can verify the transaction behavior
            // by checking that if validation fails, no trades are created

            const trade = await Trade.create({
                portfolioId: testPortfolioId,
                coinSymbol: 'BTC',
                tradeType: TradeType.LONG,
                status: TradeStatus.FILLED,
                entryPrice: 100000,
                depositPercent: 10,
                entryFee: 0.1,
                sumPlusFee: 1010,
                amount: 0.01,
                initialEntryPrice: 100000,
                initialAmount: 0.01,
            });

            // Try to split with invalid data (amounts don't sum)
            const request = new NextRequest('http://localhost:3000/api/trades/' + trade._id + '/split', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({amounts: [0.003, 0.006]}), // Sum = 0.009, not 0.01
            });

            await POST(request, {params: {id: trade._id.toString()}});

            // Original trade should still be FILLED (not closed)
            const originalTrade = await Trade.findById(trade._id);
            expect(originalTrade?.status).toBe(TradeStatus.FILLED);
            expect(originalTrade?.isSplit).toBe(false);

            // No split trades should be created
            const splitTrades = await Trade.find({splitFromTradeId: trade._id.toString()});
            expect(splitTrades).toHaveLength(0);
        });
    });
});
