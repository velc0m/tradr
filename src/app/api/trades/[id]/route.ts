import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import Trade from '@/models/Trade';
import Portfolio from '@/models/Portfolio';
import { ApiResponse, UpdateTradeInput, TradeStatus } from '@/types';
import { z } from 'zod';

interface RouteParams {
  params: Promise<{
    id: string;
  }>;
}

const updateTradeSchema = z.object({
  status: z.nativeEnum(TradeStatus).optional(),
  exitPrice: z.number().positive().optional().nullable(),
  exitFee: z.number().min(0).max(100).optional(),
  amount: z.number().positive().optional(),
  sumPlusFee: z.number().positive().optional(),
  filledDate: z.string().optional(), // Accept as string to avoid timezone conversion
  closeDate: z.string().optional(), // Accept as string to avoid timezone conversion
  // New fields for editing open/filled trades
  entryPrice: z.number().positive().optional(),
  depositPercent: z.number().min(0).max(100).optional(),
  entryFee: z.number().min(0).max(100).optional(),
  openDate: z.string().optional(),
});

/**
 * PUT /api/trades/[id]
 * Updates a trade
 */
export async function PUT(
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
    const body: UpdateTradeInput = await request.json();

    // Validate input
    const validatedData = updateTradeSchema.parse(body);

    await connectDB();

    // Find the trade
    const trade = await Trade.findById(id);

    if (!trade) {
      return NextResponse.json(
        { success: false, error: 'Trade not found' },
        { status: 404 }
      );
    }

    // Verify user owns the portfolio this trade belongs to
    const portfolio = await Portfolio.findById(trade.portfolioId);

    if (!portfolio || portfolio.userId !== session.user.id) {
      return NextResponse.json(
        { success: false, error: 'Forbidden' },
        { status: 403 }
      );
    }

    // Check if editing entry fields (only allowed for open/filled trades)
    const isEditingEntryFields =
      validatedData.entryPrice !== undefined ||
      validatedData.depositPercent !== undefined ||
      validatedData.entryFee !== undefined ||
      validatedData.openDate !== undefined;

    if (isEditingEntryFields && trade.status === TradeStatus.CLOSED) {
      return NextResponse.json(
        { success: false, error: 'Cannot edit entry fields of closed trades' },
        { status: 400 }
      );
    }

    // Update trade fields
    if (validatedData.status !== undefined) {
      trade.status = validatedData.status;

      // If status changed to closed, set closeDate
      if (validatedData.status === TradeStatus.CLOSED && !trade.closeDate) {
        trade.closeDate = new Date();
      }
    }

    if (validatedData.exitPrice !== undefined) {
      trade.exitPrice = validatedData.exitPrice === null ? undefined : validatedData.exitPrice;
    }

    if (validatedData.exitFee !== undefined) {
      trade.exitFee = validatedData.exitFee;
    }

    if (validatedData.amount !== undefined) {
      trade.amount = validatedData.amount;

      // Update originalAmount and remainingAmount for open/filled trades
      // This is important because when we edit the amount, we're changing the entire position
      if (trade.status === TradeStatus.OPEN || trade.status === TradeStatus.FILLED) {
        trade.originalAmount = validatedData.amount;
        trade.remainingAmount = validatedData.amount;
      }
    }

    if (validatedData.sumPlusFee !== undefined) {
      trade.sumPlusFee = validatedData.sumPlusFee;
    }

    if (validatedData.filledDate !== undefined && validatedData.filledDate !== '') {
      const filledDate = new Date(validatedData.filledDate + 'T00:00:00');
      trade.filledDate = filledDate;
    }

    if (validatedData.closeDate !== undefined && validatedData.closeDate !== '') {
      const closeDate = new Date(validatedData.closeDate + 'T00:00:00');
      trade.closeDate = closeDate;
    }

    // Update entry fields (for open/filled trades)
    if (validatedData.entryPrice !== undefined) {
      trade.entryPrice = validatedData.entryPrice;
    }

    if (validatedData.depositPercent !== undefined) {
      trade.depositPercent = validatedData.depositPercent;
    }

    if (validatedData.entryFee !== undefined) {
      trade.entryFee = validatedData.entryFee;
    }

    if (validatedData.openDate !== undefined && validatedData.openDate !== '') {
      const openDate = new Date(validatedData.openDate + 'T00:00:00');
      trade.openDate = openDate;
    }

    await trade.save();

    return NextResponse.json({
      success: true,
      data: trade,
      message: 'Trade updated successfully',
    });
  } catch (error) {
    console.error('Error updating trade:', error);

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
        error: 'Failed to update trade',
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/trades/[id]
 * Deletes a trade
 */
export async function DELETE(
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

    await connectDB();

    // Find the trade
    const trade = await Trade.findById(id);

    if (!trade) {
      return NextResponse.json(
        { success: false, error: 'Trade not found' },
        { status: 404 }
      );
    }

    // Verify user owns the portfolio this trade belongs to
    const portfolio = await Portfolio.findById(trade.portfolioId);

    if (!portfolio || portfolio.userId !== session.user.id) {
      return NextResponse.json(
        { success: false, error: 'Forbidden' },
        { status: 403 }
      );
    }

    // Delete the trade
    await Trade.findByIdAndDelete(id);

    return NextResponse.json({
      success: true,
      message: 'Trade deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting trade:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to delete trade',
      },
      { status: 500 }
    );
  }
}
