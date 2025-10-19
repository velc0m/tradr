import mongoose, { Schema, Model } from 'mongoose';
import { ITrade, TradeStatus } from '@/types';

const TradeSchema = new Schema<ITrade>(
  {
    portfolioId: {
      type: String,
      required: [true, 'Portfolio ID is required'],
      ref: 'Portfolio',
      index: true,
    },
    coinSymbol: {
      type: String,
      required: [true, 'Coin symbol is required'],
      uppercase: true,
      trim: true,
    },
    status: {
      type: String,
      enum: Object.values(TradeStatus),
      default: TradeStatus.OPEN,
      required: true,
      index: true,
    },
    entryPrice: {
      type: Number,
      required: [true, 'Entry price is required'],
      min: [0, 'Entry price cannot be negative'],
    },
    depositPercent: {
      type: Number,
      required: [true, 'Deposit percent is required'],
      min: [0, 'Deposit percent cannot be negative'],
      max: [100, 'Deposit percent cannot exceed 100'],
    },
    entryFee: {
      type: Number,
      required: [true, 'Entry fee is required'],
      min: [0, 'Entry fee cannot be negative'],
      default: 0.1,
    },
    sumPlusFee: {
      type: Number,
      required: [true, 'Sum plus fee is required'],
      min: [0, 'Sum plus fee cannot be negative'],
    },
    exitPrice: {
      type: Number,
      min: [0, 'Exit price cannot be negative'],
    },
    exitFee: {
      type: Number,
      min: [0, 'Exit fee cannot be negative'],
      default: 0.1,
    },
    amount: {
      type: Number,
      required: [true, 'Amount is required'],
      min: [0, 'Amount cannot be negative'],
    },
    originalAmount: {
      type: Number,
      min: [0, 'Original amount cannot be negative'],
    },
    remainingAmount: {
      type: Number,
      min: [0, 'Remaining amount cannot be negative'],
    },
    isPartialClose: {
      type: Boolean,
      default: false,
    },
    parentTradeId: {
      type: String,
      ref: 'Trade',
    },
    closedAmount: {
      type: Number,
      min: [0, 'Closed amount cannot be negative'],
    },
    openDate: {
      type: Date,
      required: [true, 'Open date is required'],
      default: Date.now,
    },
    filledDate: {
      type: Date,
    },
    closeDate: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for better query performance
TradeSchema.index({ portfolioId: 1, status: 1 });
TradeSchema.index({ portfolioId: 1, openDate: -1 });
TradeSchema.index({ portfolioId: 1, coinSymbol: 1 });

// Virtual for calculating profit/loss
TradeSchema.virtual('profitLoss').get(function () {
  if (!this.exitPrice || this.status !== TradeStatus.CLOSED) {
    return null;
  }

  const entryValue = this.amount * this.entryPrice;
  const exitValue = this.amount * this.exitPrice;
  const totalFees = this.entryFee + (this.exitFee || 0);

  return exitValue - entryValue - totalFees;
});

// Virtual for calculating profit/loss percentage
TradeSchema.virtual('profitLossPercent').get(function () {
  if (!this.exitPrice || this.status !== TradeStatus.CLOSED) {
    return null;
  }

  const entryValue = this.amount * this.entryPrice;
  const exitValue = this.amount * this.exitPrice;
  const totalFees = this.entryFee + (this.exitFee || 0);
  const profitLoss = exitValue - entryValue - totalFees;

  return (profitLoss / entryValue) * 100;
});

// Ensure virtuals are included in JSON
TradeSchema.set('toJSON', { virtuals: true });
TradeSchema.set('toObject', { virtuals: true });

// Prevent model recompilation in development
const Trade: Model<ITrade> =
  mongoose.models.Trade || mongoose.model<ITrade>('Trade', TradeSchema);

export default Trade;
