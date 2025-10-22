import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import Trade from '@/models/Trade';
import Portfolio from '@/models/Portfolio';
import { ApiResponse, CreateTradeInput, TradeStatus, TradeType } from '@/types';
import { z } from 'zod';

interface RouteParams {
  params: Promise<{
    portfolioId: string;
  }>;
}

const createTradeSchema = z.object({
  coinSymbol: z.string().min(1, 'Coin symbol is required').toUpperCase(),
  tradeType: z.enum(['LONG', 'SHORT']).optional().default('LONG'),
  entryPrice: z.number().positive('Entry price must be positive'),
  depositPercent: z
    .number()
    .min(0, 'Deposit percent cannot be negative')
    .max(100, 'Deposit percent cannot exceed 100'),
  entryFee: z.number().min(0, 'Entry fee cannot be negative').default(0.25),
  amount: z.number().positive('Amount must be positive'),
  sumPlusFee: z.number().positive('Sum plus fee must be positive'),
  openDate: z.string().optional(), // Accept date as string to avoid timezone conversion
  parentTradeId: z.string().optional(), // For SHORT trades from LONG positions
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

    // Handle SHORT trade creation
    if (validatedData.tradeType === 'SHORT') {
      // Calculate available amount for SHORT
      let availableAmount = 0;
      let parentTrade = null;

      // Check if SHORT is from a LONG position
      if (validatedData.parentTradeId) {
        parentTrade = await Trade.findById(validatedData.parentTradeId);

        if (!parentTrade) {
          return NextResponse.json(
            { success: false, error: 'Parent LONG trade not found' },
            { status: 404 }
          );
        }

        // Verify parent trade belongs to the same portfolio
        if (parentTrade.portfolioId !== portfolioId) {
          return NextResponse.json(
            { success: false, error: 'Parent trade does not belong to this portfolio' },
            { status: 403 }
          );
        }

        // Verify parent is a LONG trade
        if (parentTrade.tradeType !== TradeType.LONG) {
          return NextResponse.json(
            { success: false, error: 'Parent trade must be a LONG position' },
            { status: 400 }
          );
        }

        // Verify parent is still open or filled
        if (parentTrade.status !== TradeStatus.OPEN && parentTrade.status !== TradeStatus.FILLED) {
          return NextResponse.json(
            { success: false, error: 'Parent LONG trade is already closed' },
            { status: 400 }
          );
        }

        availableAmount = parentTrade.amount;
      } else {
        // SHORT from initialCoins
        const initialCoin = portfolio.initialCoins?.find(
          (coin) => coin.symbol === validatedData.coinSymbol
        );

        if (initialCoin) {
          availableAmount = initialCoin.amount;
        }
      }

      // Validate amount
      if (validatedData.amount > availableAmount) {
        return NextResponse.json(
          {
            success: false,
            error: `Cannot sell more than available amount (${availableAmount} ${validatedData.coinSymbol})`,
          },
          { status: 400 }
        );
      }

      // Get initial entry price and amount from parent LONG trade
      let initialEntryPrice = validatedData.entryPrice;
      let initialAmount = validatedData.amount;

      if (parentTrade) {
        initialEntryPrice = parentTrade.initialEntryPrice;
        initialAmount = parentTrade.initialAmount;

        // Reduce parent LONG trade's amount and sumPlusFee proportionally
        const proportion = validatedData.amount / parentTrade.amount;
        const reducedSumPlusFee = parentTrade.sumPlusFee * proportion;

        parentTrade.amount -= validatedData.amount;
        parentTrade.sumPlusFee -= reducedSumPlusFee;
        parentTrade.entryPrice = parentTrade.amount > 0 ? parentTrade.sumPlusFee / parentTrade.amount : parentTrade.entryPrice;

        await parentTrade.save();
      } else {
        // Update initialCoins in portfolio
        const initialCoinIndex = portfolio.initialCoins?.findIndex(
          (coin) => coin.symbol === validatedData.coinSymbol
        );

        if (initialCoinIndex !== undefined && initialCoinIndex >= 0 && portfolio.initialCoins) {
          portfolio.initialCoins[initialCoinIndex].amount -= validatedData.amount;

          // Remove coin from initialCoins if amount becomes 0
          if (portfolio.initialCoins[initialCoinIndex].amount <= 0) {
            portfolio.initialCoins.splice(initialCoinIndex, 1);
          }

          await portfolio.save();
        }
      }

      // Create SHORT trade
      const trade = await Trade.create({
        portfolioId,
        coinSymbol: validatedData.coinSymbol,
        status: TradeStatus.OPEN,
        tradeType: TradeType.SHORT,
        entryPrice: validatedData.entryPrice, // Sale price
        depositPercent: validatedData.depositPercent,
        entryFee: validatedData.entryFee,
        exitFee: validatedData.entryFee,
        sumPlusFee: validatedData.sumPlusFee,
        amount: validatedData.amount,
        initialEntryPrice, // From parent LONG or current sale price
        initialAmount, // From parent LONG or current amount
        parentTradeId: validatedData.parentTradeId || undefined,
        openDate: openDate,
      });

      return NextResponse.json(
        {
          success: true,
          data: trade,
          message: 'SHORT trade created successfully',
        },
        { status: 201 }
      );
    }

    // Handle LONG trade creation (existing logic)
    const trade = await Trade.create({
      portfolioId,
      coinSymbol: validatedData.coinSymbol,
      status: TradeStatus.OPEN,
      tradeType: TradeType.LONG,
      entryPrice: validatedData.entryPrice,
      depositPercent: validatedData.depositPercent,
      entryFee: validatedData.entryFee,
      exitFee: validatedData.entryFee,
      sumPlusFee: validatedData.sumPlusFee,
      amount: validatedData.amount,
      initialEntryPrice: validatedData.entryPrice, // Store initial entry price
      initialAmount: validatedData.amount, // Store initial amount
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
