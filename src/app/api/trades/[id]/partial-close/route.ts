import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import Trade from '@/models/Trade';
import Portfolio from '@/models/Portfolio';
import { ApiResponse, PartialCloseInput, TradeStatus } from '@/types';
import { z } from 'zod';

interface RouteParams {
  params: Promise<{
    id: string;
  }>;
}

const partialCloseSchema = z.object({
  amountToClose: z.number().positive('Amount to close must be positive'),
  exitPrice: z.number().positive('Exit price must be positive'),
  exitFee: z.number().min(0, 'Exit fee cannot be negative'),
  closeDate: z.string().min(1, 'Close date is required'),
});

/**
 * POST /api/trades/[id]/partial-close
 * Partially closes a trade
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

    const body: PartialCloseInput = await request.json();

    // Validate input
    const validatedData = partialCloseSchema.parse(body);

    await connectDB();

    // Find the parent trade
    const parentTrade = await Trade.findById(id);

    if (!parentTrade) {
      return NextResponse.json(
        { success: false, error: 'Trade not found' },
        { status: 404 }
      );
    }

    // Verify user owns the portfolio this trade belongs to
    const portfolio = await Portfolio.findById(parentTrade.portfolioId);

    if (!portfolio || portfolio.userId !== session.user.id) {
      return NextResponse.json(
        { success: false, error: 'Forbidden' },
        { status: 403 }
      );
    }

    // Validate trade status - can only partial close filled trades
    if (parentTrade.status !== TradeStatus.FILLED) {
      return NextResponse.json(
        { success: false, error: 'Can only partial close filled trades' },
        { status: 400 }
      );
    }

    // Initialize remainingAmount if not set (for backward compatibility)
    const currentRemaining = parentTrade.remainingAmount ?? parentTrade.amount;
    const currentOriginal = parentTrade.originalAmount ?? parentTrade.amount;

    // Validate amount to close
    if (validatedData.amountToClose > currentRemaining) {
      return NextResponse.json(
        {
          success: false,
          error: `Cannot close more than remaining amount (${currentRemaining})`,
        },
        { status: 400 }
      );
    }

    if (validatedData.amountToClose <= 0) {
      return NextResponse.json(
        { success: false, error: 'Amount to close must be positive' },
        { status: 400 }
      );
    }

    // Calculate new remaining amount with proper rounding to avoid floating point issues
    const rawRemaining = currentRemaining - validatedData.amountToClose;
    const newRemainingAmount = Math.round(rawRemaining * 100000000) / 100000000;

    // Calculate proportional values for the closed portion
    // ALWAYS use originalAmount as base, NOT remainingAmount!
    const proportion = validatedData.amountToClose / currentOriginal;
    const proportionalSumPlusFee = parentTrade.sumPlusFee * proportion;

    // Create closed trade record
    const closedTrade = new Trade({
      portfolioId: parentTrade.portfolioId,
      coinSymbol: parentTrade.coinSymbol,
      status: TradeStatus.CLOSED,
      entryPrice: parentTrade.entryPrice,
      depositPercent: parentTrade.depositPercent,
      entryFee: parentTrade.entryFee,
      sumPlusFee: proportionalSumPlusFee,
      amount: validatedData.amountToClose,
      originalAmount: currentOriginal,
      remainingAmount: 0, // This portion is fully closed
      isPartialClose: true,
      parentTradeId: parentTrade._id.toString(),
      closedAmount: validatedData.amountToClose,
      exitPrice: validatedData.exitPrice,
      exitFee: validatedData.exitFee,
      openDate: parentTrade.openDate,
      filledDate: parentTrade.filledDate,
      closeDate: new Date(validatedData.closeDate + 'T00:00:00'),
    });

    await closedTrade.save();

    // Check if remaining amount is essentially zero (floating point precision)
    const isFullyClosed = newRemainingAmount <= 0.00000001;

    // Build update object with $set operator
    const updateFields: Record<string, unknown> = {
      remainingAmount: isFullyClosed ? 0 : newRemainingAmount,
    };

    // Only set originalAmount if it's not already set (backward compatibility)
    if (!parentTrade.originalAmount) {
      updateFields.originalAmount = currentOriginal;
    }

    // If fully closed, update status and closeDate
    if (isFullyClosed) {
      updateFields.status = TradeStatus.CLOSED;
      updateFields.closeDate = new Date(validatedData.closeDate + 'T00:00:00');
    }

    // CRITICAL: Direct MongoDB update for reliability
    await Trade.collection.updateOne(
      { _id: parentTrade._id },
      { $set: updateFields }
    );

    // Fetch fresh document to verify update
    const updatedParentTrade = await Trade.findById(id).lean();

    if (!updatedParentTrade) {
      return NextResponse.json(
        { success: false, error: 'Failed to update parent trade' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        parentTrade: updatedParentTrade,
        closedTrade,
      },
      message: 'Trade partially closed successfully',
    });
  } catch (error) {
    console.error('Error partially closing trade:', error);

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
        error: 'Failed to partially close trade',
      },
      { status: 500 }
    );
  }
}
