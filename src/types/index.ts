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
  OPEN = 'OPEN',
  CLOSED = 'CLOSED',
}

export interface ITrade extends Document {
  _id: string;
  portfolioId: string;
  coinSymbol: string;
  status: TradeStatus;
  entryPrice: number;
  depositPercent: number;
  entryFee: number;
  exitPrice?: number;
  exitFee?: number;
  amount: number;
  openDate: Date;
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
  portfolioId: string;
  coinSymbol: string;
  entryPrice: number;
  depositPercent: number;
  entryFee: number;
  amount: number;
}

export interface CloseTradeInput {
  exitPrice: number;
  exitFee: number;
}
