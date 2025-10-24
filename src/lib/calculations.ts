/**
 * Calculation functions for trading profit and fees
 * These are pure functions that handle all profit calculations for LONG and SHORT positions
 */

/**
 * Calculate LONG position profit in USD
 *
 * @param amount - Amount of coins held
 * @param sumPlusFee - Total USD spent (including entry fee)
 * @param exitPrice - Price at which position is closed
 * @param exitFee - Exit fee percentage (0-100)
 * @returns Profit in USD (can be negative for losses)
 *
 * Formula: (amount × exitPrice × (100 - exitFee) / 100) - sumPlusFee
 *
 * Example:
 * - Bought 0.01 BTC for 1010 USD (including 1% fee)
 * - Sell at 110,000 USD with 1% exit fee
 * - Exit value: 0.01 × 110,000 × 0.99 = 1089 USD
 * - Profit: 1089 - 1010 = 79 USD
 */
export function calculateLongProfitUSD(
  amount: number,
  sumPlusFee: number,
  exitPrice: number,
  exitFee: number
): number {
  // Calculate exit value after exit fee
  const exitValue = amount * exitPrice * ((100 - exitFee) / 100);

  // Profit = exit value - what we spent
  const profit = exitValue - sumPlusFee;

  return profit;
}

/**
 * Calculate LONG position profit in percentage
 *
 * @param entryPrice - Entry price per coin
 * @param exitPrice - Exit price per coin
 * @param entryFee - Entry fee percentage (0-100)
 * @param exitFee - Exit fee percentage (0-100)
 * @returns Profit percentage (can be negative for losses)
 *
 * Formula: ((exitPrice / entryPrice - 1) × 100) - entryFee - exitFee
 *
 * Example:
 * - Entry: 100,000, Exit: 110,000
 * - Fees: 1% + 1%
 * - Price change: +10%
 * - After fees: 10% - 1% - 1% = 8%
 */
export function calculateLongProfitPercent(
  entryPrice: number,
  exitPrice: number,
  entryFee: number,
  exitFee: number
): number {
  // Calculate percentage change in price
  const priceChangePercent = ((exitPrice / entryPrice) - 1) * 100;

  // Subtract fees
  const profitPercent = priceChangePercent - entryFee - exitFee;

  return profitPercent;
}

/**
 * Calculate SHORT position profit in coins
 *
 * @param soldAmount - Amount of coins sold
 * @param sumPlusFee - USD received from sale (after entry fee)
 * @param buyBackPrice - Price at which coins are bought back
 * @param buyBackFee - Buy back fee percentage (0-100)
 * @returns Profit in coins (can be negative for losses)
 *
 * Formula:
 * - buyBackPriceWithFee = buyBackPrice × (100 + buyBackFee) / 100
 * - coinsBoughtBack = sumPlusFee / buyBackPriceWithFee
 * - profit = coinsBoughtBack - soldAmount
 *
 * Example:
 * - Sold 0.5 BTC, received 50,000 USD (after fee)
 * - Buy back at 45,000 USD with 1% fee
 * - Buy back price with fee: 45,450 USD per BTC
 * - Coins bought back: 50,000 / 45,450 = 1.1001 BTC
 * - Profit: 1.1001 - 0.5 = 0.6001 BTC
 */
export function calculateShortProfitCoins(
  soldAmount: number,
  sumPlusFee: number,
  buyBackPrice: number,
  buyBackFee: number
): number {
  // Calculate buy back price including fee
  const buyBackPriceWithFee = buyBackPrice * ((100 + buyBackFee) / 100);

  // Calculate how many coins we can buy back
  const coinsBoughtBack = sumPlusFee / buyBackPriceWithFee;

  // Profit = bought back - sold
  const profit = coinsBoughtBack - soldAmount;

  return profit;
}

/**
 * Calculate how many coins are bought back in a SHORT close
 * Used for updating parent LONG position
 *
 * @param sumPlusFee - USD received from sale
 * @param buyBackPrice - Price at which coins are bought back
 * @param buyBackFee - Buy back fee percentage (0-100)
 * @returns Number of coins bought back
 */
export function calculateCoinsBoughtBack(
  sumPlusFee: number,
  buyBackPrice: number,
  buyBackFee: number
): number {
  const buyBackPriceWithFee = buyBackPrice * ((100 + buyBackFee) / 100);
  return sumPlusFee / buyBackPriceWithFee;
}

/**
 * Calculate SHORT position profit in percentage
 *
 * @param soldAmount - Amount of coins sold
 * @param coinsBoughtBack - Amount of coins bought back
 * @returns Profit percentage (can be negative for losses)
 *
 * Formula: ((coinsBoughtBack / soldAmount - 1) × 100)
 *
 * Example:
 * - Sold 0.5 BTC
 * - Bought back 0.52 BTC
 * - Profit: ((0.52 / 0.5 - 1) × 100) = 4%
 */
export function calculateShortProfitPercent(
  soldAmount: number,
  coinsBoughtBack: number
): number {
  const profitPercent = ((coinsBoughtBack / soldAmount) - 1) * 100;
  return profitPercent;
}

/**
 * Recalculate LONG entry price after SHORT close
 * When a SHORT position closes, coins are bought back and added to parent LONG
 * The entry price needs to be recalculated based on total USD spent and new amount
 *
 * @param originalSumPlusFee - Original USD spent on LONG
 * @param newTotalAmount - New total amount after adding bought back coins
 * @returns New entry price
 *
 * Formula: sumPlusFee / newAmount
 *
 * Example:
 * - Originally spent 100,000 USD for 1.0 BTC (entry price: 100,000)
 * - After SHORT close, total amount: 1.05 BTC
 * - New entry price: 100,000 / 1.05 = 95,238 USD per BTC
 */
export function recalculateLongEntryPrice(
  originalSumPlusFee: number,
  newTotalAmount: number
): number {
  return originalSumPlusFee / newTotalAmount;
}
