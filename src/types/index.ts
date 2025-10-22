import { Document } from 'mongoose';

// User types
export interface IUser extends Document {
  _id: string;
  email: string;
  password: string;
  createdAt: Date;
}

// Cryptocurrency types
export interface ICryptocurrency extends Document {
  _id: string;
  symbol: string;
  name: string;
  decimalPlaces: number;
  isDefault: boolean;
  userId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// Portfolio types
export interface IPortfolioCoin {
  symbol: string;
  percentage: number;
  decimalPlaces: number;
}

export interface IInitialCoin {
  symbol: string;
  amount: number;
}

export interface IPortfolio extends Document {
  _id: string;
  userId: string;
  name: string;
  totalDeposit: number;
  coins: IPortfolioCoin[];
  initialCoins?: IInitialCoin[];
  createdAt: Date;
  updatedAt: Date;
}

// Trade types
export enum TradeStatus {
  OPEN = 'open',
  FILLED = 'filled',
  CLOSED = 'closed',
}

export enum TradeType {
  LONG = 'LONG',
  SHORT = 'SHORT',
}

export interface ITrade extends Document {
  _id: string;
  portfolioId: string;
  coinSymbol: string;
  status: TradeStatus;
  tradeType: TradeType; // LONG or SHORT
  entryPrice: number;
  depositPercent: number;
  entryFee: number;
  sumPlusFee: number; // Amount in USD that user inputs manually from exchange
  exitPrice?: number;
  exitFee?: number;
  amount: number; // Amount in coins (manual input from exchange)
  initialEntryPrice: number; // Initial entry price from LONG position (never changes)
  initialAmount: number; // Initial amount from LONG position (never changes)
  parentTradeId?: string; // Reference to parent LONG trade for SHORT positions
  isSplit?: boolean; // True if this trade was split into multiple positions
  splitFromTradeId?: string; // Reference to original trade that was split
  splitGroupId?: string; // Unique ID for grouping split positions together
  openDate: Date;
  filledDate?: Date; // Date when trade was filled on exchange
  closeDate?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// API Response types
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// Form types
export interface CreateCryptocurrencyInput {
  symbol: string;
  name: string;
  decimalPlaces: number;
}

export interface UpdateCryptocurrencyInput {
  name: string;
  decimalPlaces: number;
}

export interface CreatePortfolioInput {
  name: string;
  totalDeposit: number;
  coins: IPortfolioCoin[];
  initialCoins?: IInitialCoin[];
}

export interface CreateTradeInput {
  coinSymbol: string;
  tradeType?: TradeType;
  entryPrice: number;
  depositPercent: number;
  entryFee: number;
  amount: number;
  sumPlusFee: number;
  parentTradeId?: string;
}

export interface UpdateTradeInput {
  status?: TradeStatus;
  exitPrice?: number;
  exitFee?: number;
  amount?: number;
  sumPlusFee?: number;
  closeDate?: Date;
}

export interface UpdateExitPriceInput {
  exitPrice: number;
  exitFee: number;
}

export interface SplitTradeInput {
  amounts: number[]; // Array of amounts for each split part
}

// Portfolio Statistics types
export interface TradeWithProfit extends ITrade {
  profitUSD: number;
  profitPercent: number;
}

export interface CoinPerformance {
  coinSymbol: string;
  tradesCount: number;
  winRate: number;
  totalProfitUSD: number;
  avgProfitPercent: number;
  bestTrade: {
    profitUSD: number;
    profitPercent: number;
  } | null;
  worstTrade: {
    profitUSD: number;
    profitPercent: number;
  } | null;
}

export interface CumulativeProfitPoint {
  date: string;
  profit: number;
}

export interface PortfolioStatistics {
  totalProfitUSD: number;
  totalProfitPercent: number;
  totalFeesPaid: number; // Total fees paid across all closed trades
  winRate: number;
  avgProfitUSD: number;
  avgProfitPercent: number;
  totalROI: number;
  totalTrades: {
    open: number;
    filled: number;
    closed: number;
  };
  bestTrade: {
    trade: TradeWithProfit;
  } | null;
  worstTrade: {
    trade: TradeWithProfit;
  } | null;
  performanceByCoin: CoinPerformance[];
  topProfitableTrades: TradeWithProfit[];
  topLosingTrades: TradeWithProfit[];
  cumulativeProfit: CumulativeProfitPoint[];
  // LONG-specific metrics
  long: {
    totalProfitUSD: number;
    totalProfitPercent: number;
    winRate: number;
    avgProfitUSD: number;
    avgProfitPercent: number;
    totalTrades: number;
  };
  // SHORT-specific metrics
  short: {
    totalProfitCoins: Record<string, number>; // { BTC: 0.123, ETH: 1.456 }
    totalProfitPercent: number;
    winRate: number;
    avgProfitCoins: Record<string, number>; // Average profit per coin
    avgProfitPercent: number;
    totalTrades: number;
  };
}

// Export types
export type ExportFormat = 'xlsx' | 'csv';
export type ExportInclude = 'all' | 'open' | 'closed' | 'portfolio';

export interface ExportOptions {
  format: ExportFormat;
  include: ExportInclude[];
}

// User Settings types
export interface IUserSettings extends Document {
  _id: string;
  userId: string;
  feeCalculationMode: 'per-portfolio' | 'combined';
  combinedPortfolios: string[];
  createdAt: Date;
  updatedAt: Date;
}
