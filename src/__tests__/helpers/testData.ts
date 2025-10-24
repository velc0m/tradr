import {CreatePortfolioInput, IPortfolioCoin} from '@/types';

/**
 * Create test portfolio data
 */
export const createTestPortfolioData = (
    overrides?: Partial<CreatePortfolioInput>
): CreatePortfolioInput => {
    return {
        name: 'Test Portfolio',
        totalDeposit: 1000,
        coins: [
            {symbol: 'BTC', percentage: 50, decimalPlaces: 8},
            {symbol: 'ETH', percentage: 30, decimalPlaces: 6},
            {symbol: 'ADA', percentage: 20, decimalPlaces: 2},
        ],
        ...overrides,
    };
};

/**
 * Calculate expected allocation per coin based on total deposit and percentages
 */
export const calculateExpectedAllocation = (
    totalDeposit: number,
    coins: IPortfolioCoin[]
): Record<string, number> => {
    const allocation: Record<string, number> = {};

    for (const coin of coins) {
        allocation[coin.symbol] = (totalDeposit * coin.percentage) / 100;
    }

    return allocation;
};

/**
 * Test portfolio with custom percentages
 */
export const createCustomPercentagePortfolio = (
    totalDeposit: number,
    coins: Array<{ symbol: string; percentage: number; decimalPlaces?: number }>
): CreatePortfolioInput => {
    return {
        name: 'Custom Portfolio',
        totalDeposit,
        coins: coins.map(coin => ({
            symbol: coin.symbol,
            percentage: coin.percentage,
            decimalPlaces: coin.decimalPlaces ?? 2,
        })),
    };
};
