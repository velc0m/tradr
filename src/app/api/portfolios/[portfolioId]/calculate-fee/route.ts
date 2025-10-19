import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import Portfolio from '@/models/Portfolio';
import Trade from '@/models/Trade';
import { TradeStatus, ApiResponse } from '@/types';
import { calculateFeeLevel, FeeCalculationResult } from '@/lib/coinbaseFees';

interface RouteParams {
  params: Promise<{
    portfolioId: string;
  }>;
}

/**
 * Calculate 30-day trading volume
 * @param portfolioId - Portfolio ID to calculate volume for
 * @param excludeTradeId - Optional trade ID to exclude from calculation (for entry fee calculation)
 * @returns Total 30-day volume in USD
 */
async function calculate30DayVolume(
  portfolioId: string,
  excludeTradeId?: string
): Promise<number> {
  // Calculate date 30 days ago from now
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  // Find all filled or closed trades in the last 30 days
  const query: any = {
    portfolioId,
    status: { $in: [TradeStatus.FILLED, TradeStatus.CLOSED] },
    $or: [
      { filledDate: { $gte: thirtyDaysAgo } },
      { closeDate: { $gte: thirtyDaysAgo } },
    ],
  };

  // Exclude specific trade if provided (for entry fee calculation)
  if (excludeTradeId) {
    query._id = { $ne: excludeTradeId };
  }

  const trades = await Trade.find(query);

  // Sum up all sumPlusFee values
  const totalVolume = trades.reduce((sum, trade) => sum + trade.sumPlusFee, 0);

  return totalVolume;
}

/**
 * GET /api/portfolios/[portfolioId]/calculate-fee
 *
 * Query parameters:
 * - type: "entry" | "exit" - Type of fee to calculate
 * - tradeId: (optional) - Trade ID to exclude from entry fee calculation
 *
 * Returns current fee level and percentage based on 30-day volume
 */
export async function GET(
  request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse<ApiResponse<FeeCalculationResult>>> {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { portfolioId } = await params;
    const { searchParams } = new URL(request.url);
    const feeType = searchParams.get('type') || 'entry'; // "entry" or "exit"
    const tradeId = searchParams.get('tradeId'); // optional, for excluding from calculation

    await connectDB();

    // Verify portfolio exists and user owns it
    const portfolio = await Portfolio.findById(portfolioId);

    if (!portfolio) {
      return NextResponse.json(
        { success: false, error: 'Portfolio not found' },
        { status: 404 }
      );
    }

    if (portfolio.userId !== session.user.id) {
      return NextResponse.json(
        { success: false, error: 'Forbidden' },
        { status: 403 }
      );
    }

    // Calculate 30-day volume
    let volume: number;

    if (feeType === 'entry') {
      // For entry fee: exclude current trade (if provided)
      volume = await calculate30DayVolume(portfolioId, tradeId);
    } else {
      // For exit fee: include all trades (assuming the trade is already filled)
      volume = await calculate30DayVolume(portfolioId);
    }

    // Calculate fee level based on volume
    const feeResult = calculateFeeLevel(volume);

    return NextResponse.json({
      success: true,
      data: feeResult,
    });
  } catch (error) {
    console.error('Error calculating fee:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to calculate fee',
      },
      { status: 500 }
    );
  }
}
