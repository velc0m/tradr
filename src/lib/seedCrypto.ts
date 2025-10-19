import connectDB from '@/lib/mongodb';
import Cryptocurrency from '@/models/Cryptocurrency';

interface DefaultCrypto {
  symbol: string;
  name: string;
  decimalPlaces: number;
}

const DEFAULT_CRYPTOCURRENCIES: DefaultCrypto[] = [
  {
    symbol: 'BTC',
    name: 'Bitcoin',
    decimalPlaces: 8,
  },
  {
    symbol: 'ETH',
    name: 'Ethereum',
    decimalPlaces: 8,
  },
  {
    symbol: 'XRP',
    name: 'Ripple',
    decimalPlaces: 6,
  },
];

/**
 * Seeds the database with default cryptocurrencies
 * This function is idempotent - it will not create duplicates
 */
export async function seedCryptocurrencies(): Promise<void> {
  try {
    await connectDB();

    // Check if default cryptocurrencies already exist
    const existingCount = await Cryptocurrency.countDocuments({
      isDefault: true,
    });

    if (existingCount >= DEFAULT_CRYPTOCURRENCIES.length) {
      return;
    }

    // Create default cryptocurrencies that don't exist yet
    for (const crypto of DEFAULT_CRYPTOCURRENCIES) {
      const existing = await Cryptocurrency.findOne({
        symbol: crypto.symbol,
        isDefault: true,
      });

      if (!existing) {
        await Cryptocurrency.create({
          symbol: crypto.symbol,
          name: crypto.name,
          decimalPlaces: crypto.decimalPlaces,
          isDefault: true,
          userId: null,
        });
      }
    }
  } catch (error) {
    console.error('Error seeding cryptocurrencies:', error);
    throw error;
  }
}
