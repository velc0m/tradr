import mongoose, { Schema, Model } from 'mongoose';
import { ICryptocurrency } from '@/types';

const CryptocurrencySchema = new Schema<ICryptocurrency>(
  {
    symbol: {
      type: String,
      required: [true, 'Cryptocurrency symbol is required'],
      unique: true,
      uppercase: true,
      trim: true,
      maxlength: [10, 'Symbol cannot exceed 10 characters'],
      index: true,
    },
    name: {
      type: String,
      required: [true, 'Cryptocurrency name is required'],
      trim: true,
      maxlength: [50, 'Name cannot exceed 50 characters'],
    },
    decimalPlaces: {
      type: Number,
      required: true,
      default: 8,
      min: [0, 'Decimal places cannot be negative'],
      max: [8, 'Decimal places cannot exceed 8'],
    },
    isDefault: {
      type: Boolean,
      default: false,
      index: true,
    },
    userId: {
      type: String,
      ref: 'User',
      default: null,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for efficient querying of user's and default cryptocurrencies
CryptocurrencySchema.index({ isDefault: 1, userId: 1 });

// Validate that default cryptocurrencies don't have userId
CryptocurrencySchema.pre('save', function (next) {
  if (this.isDefault && this.userId !== null) {
    next(new Error('Default cryptocurrencies cannot have a userId'));
  }
  next();
});

// Prevent model recompilation in development
const Cryptocurrency: Model<ICryptocurrency> =
  mongoose.models.Cryptocurrency ||
  mongoose.model<ICryptocurrency>('Cryptocurrency', CryptocurrencySchema);

export default Cryptocurrency;
