import mongoose, { Schema, Model } from 'mongoose';

export interface IUserSettings extends mongoose.Document {
  userId: string;
  feeCalculationMode: 'per-portfolio' | 'combined';
  combinedPortfolios: string[]; // Array of portfolio IDs to combine for fee calculation
  createdAt: Date;
  updatedAt: Date;
}

const UserSettingsSchema = new Schema<IUserSettings>(
  {
    userId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    feeCalculationMode: {
      type: String,
      enum: ['per-portfolio', 'combined'],
      default: 'per-portfolio',
    },
    combinedPortfolios: {
      type: [String],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

const UserSettings: Model<IUserSettings> =
  mongoose.models.UserSettings ||
  mongoose.model<IUserSettings>('UserSettings', UserSettingsSchema);

export default UserSettings;
