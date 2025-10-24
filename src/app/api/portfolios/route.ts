import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import Portfolio from '@/models/Portfolio';
import { ApiResponse, CreatePortfolioInput } from '@/types';
import { z } from 'zod';

const portfolioCoinSchema = z.object({
  symbol: z.string().min(1, 'Coin symbol is required').toUpperCase(),
  percentage: z
    .number()
    .min(0, 'Percentage cannot be negative')
    .max(100, 'Percentage cannot exceed 100'),
  decimalPlaces: z
    .number()
    .int()
    .min(0, 'Decimal places cannot be negative')
    .max(8, 'Decimal places cannot exceed 8'),
});

const initialCoinSchema = z.object({
  symbol: z.string().min(1, 'Coin symbol is required').toUpperCase(),
  amount: z
    .number()
    .min(0, 'Amount cannot be negative')
    .positive('Amount must be greater than 0'),
});

const createPortfolioSchema = z.object({
  name: z
    .string()
    .min(1, 'Portfolio name is required')
    .max(100, 'Portfolio name cannot exceed 100 characters')
    .trim(),
  totalDeposit: z
    .number()
    .min(0, 'Total deposit cannot be negative')
    .positive('Total deposit must be greater than 0'),
  coins: z
    .array(portfolioCoinSchema)
    .min(1, 'At least one coin is required')
    .refine(
      (coins) => {
        const totalPercentage = coins.reduce(
          (sum, coin) => sum + coin.percentage,
          0
        );
        return Math.abs(totalPercentage - 100) < 0.01;
      },
      {
        message: 'Total coin percentages must equal 100%',
      }
    ),
  initialCoins: z.array(initialCoinSchema).optional(),
});

/**
 * GET /api/portfolios
 * Returns all portfolios for the authenticated user
 */
export async function GET(
  request: NextRequest
): Promise<NextResponse<ApiResponse>> {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    await connectDB();

    const portfolios = await Portfolio.find({ userId: session.user.id }).sort({
      createdAt: -1,
    });

    return NextResponse.json({
      success: true,
      data: portfolios,
    });
  } catch (error) {
    console.error('Error fetching portfolios:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch portfolios',
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/portfolios
 * Creates a new portfolio for the authenticated user
 */
export async function POST(
  request: NextRequest
): Promise<NextResponse<ApiResponse>> {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body: CreatePortfolioInput = await request.json();

    console.log('Received portfolio creation request:', JSON.stringify(body, null, 2));

    // Validate input
    const validatedData = createPortfolioSchema.parse(body);

    console.log('Validated data:', JSON.stringify(validatedData, null, 2));

    await connectDB();

    // Create new portfolio
    const portfolioData = {
      userId: session.user.id,
      name: validatedData.name,
      totalDeposit: validatedData.totalDeposit,
      coins: validatedData.coins,
      initialCoins: validatedData.initialCoins ?? [],
    };

    console.log('Creating portfolio with data:', JSON.stringify(portfolioData, null, 2));

    const portfolio = await Portfolio.create(portfolioData);

    console.log('Created portfolio:', JSON.stringify(portfolio.toObject(), null, 2));

    return NextResponse.json(
      {
        success: true,
        data: portfolio,
        message: 'Portfolio created successfully',
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating portfolio:', error);

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

    // Handle mongoose validation errors
    if (error instanceof Error && error.name === 'ValidationError') {
      return NextResponse.json(
        {
          success: false,
          error: error.message,
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to create portfolio',
      },
      { status: 500 }
    );
  }
}
