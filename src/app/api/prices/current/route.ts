import { NextRequest, NextResponse } from 'next/server';
import { ApiResponse } from '@/types';

interface CoinGeckoPriceResponse {
  [coinId: string]: {
    usd: number;
  };
}

/**
 * GET /api/prices/current?symbols=BTC,ETH
 * Fetches current prices from CoinGecko API
 */
export async function GET(
  request: NextRequest
): Promise<NextResponse<ApiResponse<Record<string, number>>>> {
  try {
    const { searchParams } = new URL(request.url);
    const symbolsParam = searchParams.get('symbols');

    if (!symbolsParam) {
      return NextResponse.json(
        { success: false, error: 'Missing symbols parameter' },
        { status: 400 }
      );
    }

    const symbols = symbolsParam.split(',').map(s => s.trim().toUpperCase());

    // Map common symbols to CoinGecko IDs
    const symbolToCoinGeckoId: Record<string, string> = {
      'BTC': 'bitcoin',
      'ETH': 'ethereum',
      'BNB': 'binancecoin',
      'SOL': 'solana',
      'ADA': 'cardano',
      'XRP': 'ripple',
      'DOT': 'polkadot',
      'DOGE': 'dogecoin',
      'MATIC': 'matic-network',
      'AVAX': 'avalanche-2',
      'LINK': 'chainlink',
      'UNI': 'uniswap',
      'LTC': 'litecoin',
      'ATOM': 'cosmos',
      'XLM': 'stellar',
      'ALGO': 'algorand',
      'VET': 'vechain',
      'ICP': 'internet-computer',
      'FIL': 'filecoin',
      'TRX': 'tron',
      'ETC': 'ethereum-classic',
      'XMR': 'monero',
      'APT': 'aptos',
      'ARB': 'arbitrum',
      'OP': 'optimism',
    };

    // Get CoinGecko IDs for requested symbols
    const coinGeckoIds: string[] = [];
    const symbolMap: Record<string, string> = {}; // coinGeckoId -> symbol

    symbols.forEach(symbol => {
      const coinGeckoId = symbolToCoinGeckoId[symbol];
      if (coinGeckoId) {
        coinGeckoIds.push(coinGeckoId);
        symbolMap[coinGeckoId] = symbol;
      }
    });

    if (coinGeckoIds.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No valid symbols found' },
        { status: 400 }
      );
    }

    // Fetch prices from CoinGecko
    const coinsParam = coinGeckoIds.join(',');
    const coinGeckoUrl = `https://api.coingecko.com/api/v3/simple/price?ids=${coinsParam}&vs_currencies=usd`;

    const response = await fetch(coinGeckoUrl, {
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`CoinGecko API error: ${response.status}`);
    }

    const data: CoinGeckoPriceResponse = await response.json();

    // Convert CoinGecko response to symbol-based format
    const prices: Record<string, number> = {};

    Object.entries(data).forEach(([coinGeckoId, priceData]) => {
      const symbol = symbolMap[coinGeckoId];
      if (symbol && priceData.usd) {
        prices[symbol] = priceData.usd;
      }
    });

    return NextResponse.json({
      success: true,
      data: prices,
    });
  } catch (error) {
    console.error('Error fetching current prices:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch current prices',
      },
      { status: 500 }
    );
  }
}
