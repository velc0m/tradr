// Coinbase fee levels based on 30-day trading volume (Maker fees only)
export interface FeeLevel {
  level: string;
  makerFee: number; // in percentage (e.g., 0.6 for 0.6%)
  minVolume: number; // in USD
}

export const COINBASE_FEE_LEVELS: FeeLevel[] = [
  { level: 'Intro 1', makerFee: 0.600, minVolume: 0 },
  { level: 'Intro 2', makerFee: 0.400, minVolume: 10000 },
  { level: 'Advanced 1', makerFee: 0.250, minVolume: 25000 },
  { level: 'Advanced 2', makerFee: 0.125, minVolume: 75000 },
  { level: 'Advanced 3', makerFee: 0.075, minVolume: 250000 },
  { level: 'VIP 1', makerFee: 0.060, minVolume: 500000 },
  { level: 'VIP 2', makerFee: 0.050, minVolume: 1000000 },
  { level: 'VIP 3', makerFee: 0.040, minVolume: 5000000 },
  { level: 'VIP 4', makerFee: 0.025, minVolume: 10000000 },
  { level: 'VIP 5', makerFee: 0.010, minVolume: 20000000 },
  { level: 'VIP 6', makerFee: 0.000, minVolume: 50000000 },
  { level: 'VIP 7', makerFee: 0.000, minVolume: 100000000 },
  { level: 'VIP 8', makerFee: 0.000, minVolume: 250000000 },
];

export interface FeeCalculationResult {
  level: string;
  feePercent: number;
  currentVolume: number;
  nextLevel: {
    level: string;
    minVolume: number;
    remaining: number;
  } | null;
}

/**
 * Calculate fee level based on 30-day volume
 * @param volume - Total 30-day trading volume in USD
 * @returns Fee calculation result with level, percentage, and next level info
 */
export function calculateFeeLevel(volume: number): FeeCalculationResult {
  // Find the highest fee level that the volume qualifies for
  // Levels are sorted by minVolume in ascending order
  let currentLevel = COINBASE_FEE_LEVELS[0];

  for (let i = COINBASE_FEE_LEVELS.length - 1; i >= 0; i--) {
    if (volume >= COINBASE_FEE_LEVELS[i].minVolume) {
      currentLevel = COINBASE_FEE_LEVELS[i];
      break;
    }
  }

  // Find next level (if exists)
  const currentIndex = COINBASE_FEE_LEVELS.findIndex(
    (level) => level.level === currentLevel.level
  );

  let nextLevel = null;
  if (currentIndex < COINBASE_FEE_LEVELS.length - 1) {
    const next = COINBASE_FEE_LEVELS[currentIndex + 1];
    nextLevel = {
      level: next.level,
      minVolume: next.minVolume,
      remaining: next.minVolume - volume,
    };
  }

  return {
    level: currentLevel.level,
    feePercent: currentLevel.makerFee,
    currentVolume: volume,
    nextLevel,
  };
}

/**
 * Format fee percent with level name for display
 * @param feePercent - Fee percentage (e.g., 0.25 for 0.25%)
 * @param level - Fee level name (e.g., "Advanced 1")
 * @returns Formatted string like "0.25% (Advanced 1)"
 */
export function formatFeeWithLevel(feePercent: number, level: string): string {
  return `${feePercent.toFixed(3)}% (${level})`;
}
