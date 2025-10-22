import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import Trade from '@/models/Trade';
import Portfolio from '@/models/Portfolio';
import { ApiResponse, SplitTradeInput, TradeStatus, TradeType } from '@/types';
import { z } from 'zod';
import { randomUUID } from 'crypto';

interface RouteParams {
  params: Promise<{
    id: string;
  }>;
}

const splitTradeSchema = z.object({
  amounts: z
    .array(z.number().positive('Each amount must be positive'))
    .min(2, 'Must split into at least 2 parts')
    .max(5, 'Cannot split into more than 5 parts'),
});

/**
 * POST /api/trades/[id]/split
 * Splits a FILLED trade into multiple independent positions
 */
export async function POST(
  request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse<ApiResponse>> {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { id } = await params;

    const body: SplitTradeInput = await request.json();

    // Validate input
    const validatedData = splitTradeSchema.parse(body);

    await connectDB();

    // Find the trade to split
    const originalTrade = await Trade.findById(id);

    if (!originalTrade) {
      return NextResponse.json(
        { success: false, error: 'Trade not found' },
        { status: 404 }
      );
    }

    // Verify user owns the portfolio this trade belongs to
    const portfolio = await Portfolio.findById(originalTrade.portfolioId);

    if (!portfolio || portfolio.userId !== session.user.id) {
      return NextResponse.json(
        { success: false, error: 'Forbidden' },
        { status: 403 }
      );
    }

    // Validate trade status - can only split filled trades
    if (originalTrade.status !== TradeStatus.FILLED) {
      return NextResponse.json(
        { success: false, error: 'Only FILLED trades can be split' },
        { status: 400 }
      );
    }

    // Cannot split SHORT positions that are derived from LONG positions
    if (originalTrade.tradeType === TradeType.SHORT && originalTrade.parentTradeId) {
      return NextResponse.json(
        {
          success: false,
          error: 'Cannot split SHORT positions that are derived from LONG positions',
        },
        { status: 400 }
      );
    }

    // Validate that sum of amounts equals trade amount (with floating point tolerance)
    const totalAmount = validatedData.amounts.reduce((sum, amt) => sum + amt, 0);
    const tolerance = 1e-8;

    if (Math.abs(totalAmount - originalTrade.amount) > tolerance) {
      return NextResponse.json(
        {
          success: false,
          error: `Sum of amounts (${totalAmount}) must equal trade amount (${originalTrade.amount})`,
        },
        { status: 400 }
      );
    }

    // Generate unique split group ID
    const splitGroupId = randomUUID();

    // Create new split positions
    const splitTrades = [];

    for (const amount of validatedData.amounts) {
      // Calculate proportional sumPlusFee for this part
      const proportion = amount / originalTrade.amount;
      const proportionalSumPlusFee = originalTrade.sumPlusFee * proportion;

      // Create new trade with same parameters but different amount
      const splitTrade = new Trade({
        portfolioId: originalTrade.portfolioId,
        coinSymbol: originalTrade.coinSymbol,
        status: TradeStatus.FILLED,
        tradeType: originalTrade.tradeType,
        entryPrice: originalTrade.entryPrice,
        depositPercent: originalTrade.depositPercent,
        entryFee: originalTrade.entryFee,
        sumPlusFee: proportionalSumPlusFee,
        amount: amount,
        initialEntryPrice: originalTrade.entryPrice, // Use entryPrice for each split
        initialAmount: amount, // Use the split amount for each part
        // Do NOT copy exitPrice or exitFee - splits are independent positions
        splitFromTradeId: originalTrade._id.toString(),
        splitGroupId: splitGroupId,
        openDate: originalTrade.openDate,
        filledDate: originalTrade.filledDate,
      });

      await splitTrade.save();
      splitTrades.push(splitTrade);
    }

    // Mark original trade as split and close it
    originalTrade.isSplit = true;
    originalTrade.status = TradeStatus.CLOSED;
    originalTrade.closeDate = new Date();

    await originalTrade.save();

    return NextResponse.json({
      success: true,
      data: {
        originalTrade,
        splitTrades,
      },
      message: `Trade successfully split into ${splitTrades.length} positions`,
    });
  } catch (error) {
    console.error('Error splitting trade:', error);

    // Handle validation errors
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: error.errors[0].message,
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to split trade',
      },
      { status: 500 }
    );
  }
}
