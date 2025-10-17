import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Merge Tailwind CSS classes with clsx
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/**
 * Format currency value
 */
export function formatCurrency(value: number, decimals: number = 2): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

/**
 * Format percentage value
 */
export function formatPercent(value: number, decimals: number = 2): string {
  return `${value >= 0 ? '+' : ''}${value.toFixed(decimals)}%`;
}

/**
 * Format date to readable string
 */
export function formatDate(date: Date | string): string {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date));
}

/**
 * Calculate profit/loss from trade
 */
export function calculateProfitLoss(
  amount: number,
  entryPrice: number,
  exitPrice: number,
  entryFee: number,
  exitFee: number
): {
  profitLoss: number;
  profitLossPercent: number;
} {
  const entryValue = amount * entryPrice;
  const exitValue = amount * exitPrice;
  const totalFees = entryFee + exitFee;
  const profitLoss = exitValue - entryValue - totalFees;
  const profitLossPercent = (profitLoss / entryValue) * 100;

  return { profitLoss, profitLossPercent };
}
