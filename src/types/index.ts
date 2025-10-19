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

export interface IPortfolio extends Document {
  _id: string;
  userId: string;
  name: string;
  totalDeposit: number;
  coins: IPortfolioCoin[];
  createdAt: Date;
  updatedAt: Date;
}

// Trade types
export enum TradeStatus {
  OPEN = 'open',
  FILLED = 'filled',
  CLOSED = 'closed',
}

export interface ITrade extends Document {
  _id: string;
  portfolioId: string;
  coinSymbol: string;
  status: TradeStatus;
  entryPrice: number;
  depositPercent: number;
  entryFee: number;
  sumPlusFee: number; // Amount in USD that user inputs manually from exchange
  exitPrice?: number;
  exitFee?: number;
  amount: number; // Amount in coins (manual input from exchange)
  originalAmount?: number; // Initial amount of coins when trade was created
  remainingAmount?: number; // Remaining amount of coins not yet sold
  isPartialClose?: boolean; // True if this is a partial close record
  parentTradeId?: string; // Reference to parent trade for partial closes
  closedAmount?: number; // Amount of coins closed in this partial close
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
}

export interface CreateTradeInput {
  coinSymbol: string;
  entryPrice: number;
  depositPercent: number;
  entryFee: number;
  amount: number;
  sumPlusFee: number;
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

export interface PartialCloseInput {
  amountToClose: number;
  exitPrice: number;
  exitFee: number;
  closeDate: string;
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
}

// Export types
export type ExportFormat = 'xlsx' | 'csv';
export type ExportInclude = 'all' | 'open' | 'closed' | 'portfolio';

export interface ExportOptions {
  format: ExportFormat;
  include: ExportInclude[];
}
