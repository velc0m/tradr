import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import Trade from '@/models/Trade';
import Portfolio from '@/models/Portfolio';
import { ApiResponse, CreateTradeInput, TradeStatus } from '@/types';
import { z } from 'zod';

interface RouteParams {
  params: Promise<{
    portfolioId: string;
  }>;
}

const createTradeSchema = z.object({
  coinSymbol: z.string().min(1, 'Coin symbol is required').toUpperCase(),
  entryPrice: z.number().positive('Entry price must be positive'),
  depositPercent: z
    .number()
    .min(0, 'Deposit percent cannot be negative')
    .max(100, 'Deposit percent cannot exceed 100'),
  entryFee: z.number().min(0, 'Entry fee cannot be negative').default(0.25),
  amount: z.number().positive('Amount must be positive'),
  sumPlusFee: z.number().positive('Sum plus fee must be positive'),
  openDate: z.string().optional(), // Accept date as string to avoid timezone conversion
});

/**
 * GET /api/portfolios/[portfolioId]/trades
 * Returns all trades for a portfolio
 */
export async function GET(
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

    const { portfolioId } = await params;

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

    const trades = await Trade.find({ portfolioId }).sort({ openDate: -1 });

    return NextResponse.json({
      success: true,
      data: trades,
    });
  } catch (error) {
    console.error('Error fetching trades:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch trades',
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/portfolios/[portfolioId]/trades
 * Creates a new trade for a portfolio
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

    const { portfolioId } = await params;
    const body: CreateTradeInput = await request.json();

    // Validate input
    const validatedData = createTradeSchema.parse(body);

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

    // Verify coin exists in portfolio
    const coinExists = portfolio.coins.some(
      (coin) => coin.symbol === validatedData.coinSymbol
    );

    if (!coinExists) {
      return NextResponse.json(
        {
          success: false,
          error: `Coin ${validatedData.coinSymbol} is not in this portfolio`,
        },
        { status: 400 }
      );
    }

    const openDate = validatedData.openDate
      ? new Date(validatedData.openDate + 'T00:00:00')
      : new Date();

    const trade = await Trade.create({
      portfolioId,
      coinSymbol: validatedData.coinSymbol,
      status: TradeStatus.OPEN,
      entryPrice: validatedData.entryPrice,
      depositPercent: validatedData.depositPercent,
      entryFee: validatedData.entryFee,
      exitFee: validatedData.entryFee,
      sumPlusFee: validatedData.sumPlusFee,
      amount: validatedData.amount,
      originalAmount: validatedData.amount, // Initialize for partial close support
      remainingAmount: validatedData.amount, // Initialize for partial close support
      isPartialClose: false,
      openDate: openDate,
    });

    return NextResponse.json(
      {
        success: true,
        data: trade,
        message: 'Trade created successfully',
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating trade:', error);

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
        error: 'Failed to create trade',
      },
      { status: 500 }
    );
  }
}
