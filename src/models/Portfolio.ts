import mongoose, { Schema, Model } from 'mongoose';
import { IPortfolio, IPortfolioCoin, IInitialCoin } from '@/types';

const PortfolioCoinSchema = new Schema<IPortfolioCoin>(
  {
    symbol: {
      type: String,
      required: [true, 'Coin symbol is required'],
      uppercase: true,
      trim: true,
    },
    percentage: {
      type: Number,
      required: [true, 'Percentage is required'],
      min: [0, 'Percentage cannot be negative'],
      max: [100, 'Percentage cannot exceed 100'],
    },
    decimalPlaces: {
      type: Number,
      required: [true, 'Decimal places is required'],
      min: [0, 'Decimal places cannot be negative'],
      max: [8, 'Decimal places cannot exceed 8'],
      default: 2,
    },
  },
  { _id: false }
);

const InitialCoinSchema = new Schema<IInitialCoin>(
  {
    symbol: {
      type: String,
      required: [true, 'Coin symbol is required'],
      uppercase: true,
      trim: true,
    },
    amount: {
      type: Number,
      required: [true, 'Amount is required'],
      min: [0, 'Amount cannot be negative'],
    },
  },
  { _id: false }
);

const PortfolioSchema = new Schema<IPortfolio>(
  {
    userId: {
      type: String,
      required: [true, 'User ID is required'],
      ref: 'User',
      index: true,
    },
    name: {
      type: String,
      required: [true, 'Portfolio name is required'],
      trim: true,
      minlength: [1, 'Portfolio name is required'],
      maxlength: [100, 'Portfolio name cannot exceed 100 characters'],
    },
    totalDeposit: {
      type: Number,
      required: [true, 'Total deposit is required'],
      min: [0, 'Total deposit cannot be negative'],
    },
    coins: {
      type: [PortfolioCoinSchema],
      required: true,
      validate: {
        validator: function (coins: IPortfolioCoin[]) {
          if (coins.length === 0) return false;
          const totalPercentage = coins.reduce((sum, coin) => sum + coin.percentage, 0);
          return Math.abs(totalPercentage - 100) < 0.01; // Allow small floating point errors
        },
        message: 'Total coin percentages must equal 100%',
      },
    },
    initialCoins: {
      type: [InitialCoinSchema],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for better query performance
PortfolioSchema.index({ userId: 1, createdAt: -1 });

// Prevent model recompilation in development
const Portfolio: Model<IPortfolio> =
  mongoose.models.Portfolio ||
  mongoose.model<IPortfolio>('Portfolio', PortfolioSchema);

// Debug: log schema paths to verify initialCoins is included
if (process.env.NODE_ENV === 'development') {
  console.log('Portfolio model schema paths:', Object.keys(Portfolio.schema.paths));
}

export default Portfolio;
