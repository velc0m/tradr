import {clearTestDB, closeTestDB, connectTestDB} from '../../helpers/db';
import {
    calculateExpectedAllocation,
    createCustomPercentagePortfolio,
    createTestPortfolioData
} from '../../helpers/testData';
import Portfolio from '@/models/Portfolio';

describe('Portfolio Model Tests', () => {
    beforeAll(async () => {
        await connectTestDB();
    });

    afterAll(async () => {
        await closeTestDB();
    });

    afterEach(async () => {
        await clearTestDB();
    });

    describe('Portfolio Creation', () => {
        it('should create a portfolio with correct data', async () => {
            const portfolioData = {
                userId: 'test-user-id',
                ...createTestPortfolioData(),
            };

            const portfolio = await Portfolio.create(portfolioData);

            expect(portfolio).toBeDefined();
            expect(portfolio.name).toBe(portfolioData.name);
            expect(portfolio.totalDeposit).toBe(portfolioData.totalDeposit);
            expect(portfolio.userId).toBe(portfolioData.userId);
            expect(portfolio.coins).toHaveLength(3);
        });

        it('should validate that coin percentages sum to 100%', async () => {
            const portfolioData = {
                userId: 'test-user-id',
                ...createTestPortfolioData({
                    coins: [
                        {symbol: 'BTC', percentage: 50, decimalPlaces: 8},
                        {symbol: 'ETH', percentage: 30, decimalPlaces: 6},
                        {symbol: 'ADA', percentage: 15, decimalPlaces: 2}, // Total = 95%, should fail
                    ],
                }),
            };

            await expect(Portfolio.create(portfolioData)).rejects.toThrow();
        });

        it('should accept coin percentages that sum to exactly 100%', async () => {
            const portfolioData = {
                userId: 'test-user-id',
                ...createTestPortfolioData({
                    coins: [
                        {symbol: 'BTC', percentage: 33.33, decimalPlaces: 8},
                        {symbol: 'ETH', percentage: 33.33, decimalPlaces: 6},
                        {symbol: 'ADA', percentage: 33.34, decimalPlaces: 2}, // Total = 100%
                    ],
                }),
            };

            const portfolio = await Portfolio.create(portfolioData);

            expect(portfolio).toBeDefined();
            const totalPercentage = portfolio.coins.reduce((sum, coin) => sum + coin.percentage, 0);
            expect(totalPercentage).toBeCloseTo(100, 2);
        });

        it('should require at least one coin', async () => {
            const portfolioData = {
                userId: 'test-user-id',
                ...createTestPortfolioData({
                    coins: [],
                }),
            };

            await expect(Portfolio.create(portfolioData)).rejects.toThrow();
        });
    });

    describe('Coin Allocation Calculation', () => {
        it('should correctly calculate deposit distribution for 50-30-20 split', async () => {
            const totalDeposit = 1000;
            const portfolioData = {
                userId: 'test-user-id',
                ...createTestPortfolioData({totalDeposit}),
            };

            const portfolio = await Portfolio.create(portfolioData);

            // Calculate expected allocation
            const expectedAllocation = calculateExpectedAllocation(totalDeposit, portfolio.coins);

            // Verify allocations
            expect(expectedAllocation['BTC']).toBe(500); // 50%
            expect(expectedAllocation['ETH']).toBe(300); // 30%
            expect(expectedAllocation['ADA']).toBe(200); // 20%

            // Verify sum equals total deposit
            const totalAllocated = Object.values(expectedAllocation).reduce((sum, val) => sum + val, 0);
            expect(totalAllocated).toBe(totalDeposit);
        });

        it('should correctly calculate deposit distribution for equal split', async () => {
            const totalDeposit = 3000;
            const portfolioData = {
                userId: 'test-user-id',
                ...createCustomPercentagePortfolio(totalDeposit, [
                    {symbol: 'BTC', percentage: 33.33},
                    {symbol: 'ETH', percentage: 33.33},
                    {symbol: 'ADA', percentage: 33.34},
                ]),
            };

            const portfolio = await Portfolio.create(portfolioData);
            const expectedAllocation = calculateExpectedAllocation(totalDeposit, portfolio.coins);

            // Each should get approximately 1000
            expect(expectedAllocation['BTC']).toBeCloseTo(999.9, 1);
            expect(expectedAllocation['ETH']).toBeCloseTo(999.9, 1);
            expect(expectedAllocation['ADA']).toBeCloseTo(1000.2, 1);

            // Verify sum equals total deposit
            const totalAllocated = Object.values(expectedAllocation).reduce((sum, val) => sum + val, 0);
            expect(totalAllocated).toBeCloseTo(totalDeposit, 1);
        });

        it('should correctly calculate deposit distribution for uneven split', async () => {
            const totalDeposit = 5000;
            const portfolioData = {
                userId: 'test-user-id',
                ...createCustomPercentagePortfolio(totalDeposit, [
                    {symbol: 'BTC', percentage: 60},
                    {symbol: 'ETH', percentage: 25},
                    {symbol: 'ADA', percentage: 10},
                    {symbol: 'SOL', percentage: 5},
                ]),
            };

            const portfolio = await Portfolio.create(portfolioData);
            const expectedAllocation = calculateExpectedAllocation(totalDeposit, portfolio.coins);

            expect(expectedAllocation['BTC']).toBe(3000); // 60%
            expect(expectedAllocation['ETH']).toBe(1250); // 25%
            expect(expectedAllocation['ADA']).toBe(500);  // 10%
            expect(expectedAllocation['SOL']).toBe(250);  // 5%

            // Verify sum equals total deposit
            const totalAllocated = Object.values(expectedAllocation).reduce((sum, val) => sum + val, 0);
            expect(totalAllocated).toBe(totalDeposit);
        });

        it('should handle decimal percentages correctly', async () => {
            const totalDeposit = 10000;
            const portfolioData = {
                userId: 'test-user-id',
                ...createCustomPercentagePortfolio(totalDeposit, [
                    {symbol: 'BTC', percentage: 47.5},
                    {symbol: 'ETH', percentage: 32.25},
                    {symbol: 'ADA', percentage: 20.25},
                ]),
            };

            const portfolio = await Portfolio.create(portfolioData);
            const expectedAllocation = calculateExpectedAllocation(totalDeposit, portfolio.coins);

            expect(expectedAllocation['BTC']).toBe(4750);  // 47.5%
            expect(expectedAllocation['ETH']).toBe(3225);  // 32.25%
            expect(expectedAllocation['ADA']).toBe(2025);  // 20.25%

            // Verify sum equals total deposit
            const totalAllocated = Object.values(expectedAllocation).reduce((sum, val) => sum + val, 0);
            expect(totalAllocated).toBe(totalDeposit);
        });

        it('should work with small deposits', async () => {
            const totalDeposit = 100;
            const portfolioData = {
                userId: 'test-user-id',
                ...createCustomPercentagePortfolio(totalDeposit, [
                    {symbol: 'BTC', percentage: 50},
                    {symbol: 'ETH', percentage: 50},
                ]),
            };

            const portfolio = await Portfolio.create(portfolioData);
            const expectedAllocation = calculateExpectedAllocation(totalDeposit, portfolio.coins);

            expect(expectedAllocation['BTC']).toBe(50);
            expect(expectedAllocation['ETH']).toBe(50);

            const totalAllocated = Object.values(expectedAllocation).reduce((sum, val) => sum + val, 0);
            expect(totalAllocated).toBe(totalDeposit);
        });

        it('should work with large deposits', async () => {
            const totalDeposit = 1000000; // 1 million
            const portfolioData = {
                userId: 'test-user-id',
                ...createCustomPercentagePortfolio(totalDeposit, [
                    {symbol: 'BTC', percentage: 40},
                    {symbol: 'ETH', percentage: 35},
                    {symbol: 'ADA', percentage: 15},
                    {symbol: 'SOL', percentage: 10},
                ]),
            };

            const portfolio = await Portfolio.create(portfolioData);
            const expectedAllocation = calculateExpectedAllocation(totalDeposit, portfolio.coins);

            expect(expectedAllocation['BTC']).toBe(400000);  // 40%
            expect(expectedAllocation['ETH']).toBe(350000);  // 35%
            expect(expectedAllocation['ADA']).toBe(150000);  // 15%
            expect(expectedAllocation['SOL']).toBe(100000);  // 10%

            const totalAllocated = Object.values(expectedAllocation).reduce((sum, val) => sum + val, 0);
            expect(totalAllocated).toBe(totalDeposit);
        });
    });

    describe('Portfolio Fields', () => {
        it('should store coin symbols in uppercase', async () => {
            const portfolioData = {
                userId: 'test-user-id',
                ...createTestPortfolioData({
                    coins: [
                        {symbol: 'btc', percentage: 50, decimalPlaces: 8},
                        {symbol: 'eth', percentage: 50, decimalPlaces: 6},
                    ],
                }),
            };

            const portfolio = await Portfolio.create(portfolioData);

            expect(portfolio.coins[0].symbol).toBe('BTC');
            expect(portfolio.coins[1].symbol).toBe('ETH');
        });

        it('should store decimal places for each coin', async () => {
            const portfolioData = {
                userId: 'test-user-id',
                ...createTestPortfolioData(),
            };

            const portfolio = await Portfolio.create(portfolioData);

            const btcCoin = portfolio.coins.find(c => c.symbol === 'BTC');
            const ethCoin = portfolio.coins.find(c => c.symbol === 'ETH');
            const adaCoin = portfolio.coins.find(c => c.symbol === 'ADA');

            expect(btcCoin?.decimalPlaces).toBe(8);
            expect(ethCoin?.decimalPlaces).toBe(6);
            expect(adaCoin?.decimalPlaces).toBe(2);
        });

        it('should have timestamps', async () => {
            const portfolioData = {
                userId: 'test-user-id',
                ...createTestPortfolioData(),
            };

            const portfolio = await Portfolio.create(portfolioData);

            expect(portfolio.createdAt).toBeDefined();
            expect(portfolio.updatedAt).toBeDefined();
            expect(portfolio.createdAt).toBeInstanceOf(Date);
            expect(portfolio.updatedAt).toBeInstanceOf(Date);
        });

        it('should support optional initialCoins field', async () => {
            const portfolioData = {
                userId: 'test-user-id',
                ...createTestPortfolioData({
                    initialCoins: [
                        {symbol: 'BTC', amount: 0.5},
                        {symbol: 'ETH', amount: 10},
                    ],
                }),
            };

            const portfolio = await Portfolio.create(portfolioData);

            expect(portfolio.initialCoins).toBeDefined();
            expect(portfolio.initialCoins).toHaveLength(2);
            expect(portfolio.initialCoins?.[0].symbol).toBe('BTC');
            expect(portfolio.initialCoins?.[0].amount).toBe(0.5);
        });
    });
});
