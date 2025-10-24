import {ITrade, TradeType} from '@/types';

/**
 * Calculate profit percentage for a trade (LONG or SHORT)
 * @param trade - The trade to calculate profit for
 * @returns Profit percentage or null if no exit price
 */
export function calculateProfitPercent(trade: ITrade): number | null {
    if (!trade.exitPrice) return null;

    if (trade.tradeType === TradeType.SHORT) {
        // SHORT: profit % based on coins gained
        const entryFeeVal = trade.entryFee || 0;
        const netReceived = trade.sumPlusFee * (100 - entryFeeVal) / 100;
        const exitFeeVal = trade.exitFee || 0;
        const buyBackPriceWithFee = trade.exitPrice * (100 + exitFeeVal) / 100;
        const coinsBoughtBack = netReceived / buyBackPriceWithFee;
        return ((coinsBoughtBack / trade.amount - 1) * 100);
    }

    // LONG: profit % based on price change minus fees
    return (
        ((trade.exitPrice / trade.entryPrice - 1) * 100) -
        trade.entryFee -
        (trade.exitFee || 0)
    );
}

/**
 * Calculate profit in USD for LONG trades
 * @param trade - The trade to calculate profit for
 * @returns Profit in USD or null if no exit price or not a LONG trade
 */
export function calculateProfitUSD(trade: ITrade): number | null {
    if (!trade.exitPrice || trade.tradeType !== TradeType.LONG) return null;

    const exitValue = trade.amount * trade.exitPrice * (100 - (trade.exitFee || 0)) / 100;
    return exitValue - trade.sumPlusFee;
}

/**
 * Calculate profit in coins for SHORT trades
 * @param trade - The trade to calculate profit for
 * @returns Profit in coins or null if no exit price or not a SHORT trade
 */
export function calculateProfitCoins(trade: ITrade): number | null {
    if (!trade.exitPrice || trade.tradeType !== TradeType.SHORT) return null;

    const entryFeeVal = trade.entryFee || 0;
    const netReceived = trade.sumPlusFee * (100 - entryFeeVal) / 100;
    const exitFeeVal = trade.exitFee || 0;
    const buyBackPriceWithFee = trade.exitPrice * (100 + exitFeeVal) / 100;
    const coinsBoughtBack = netReceived / buyBackPriceWithFee;

    return coinsBoughtBack - trade.amount;
}

/**
 * Format USD price with 2 decimal places (removes trailing zeros)
 * @param price - The price to format
 * @returns Formatted price string
 */
export function formatPrice(price: number): string {
    const formatted = price.toFixed(2);
    const trimmed = formatted.replace(/\.?0+$/, '');
    return trimmed;
}

/**
 * Format crypto amount with max 8 decimal places (removes trailing zeros)
 * @param amount - The amount to format
 * @returns Formatted amount string
 */
export function formatAmount(amount: number): string {
    const formatted = amount.toFixed(8);
    const trimmed = formatted.replace(/\.?0+$/, '');
    return trimmed;
}
