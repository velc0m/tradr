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

    // Validate input
    const validatedData = createPortfolioSchema.parse(body);

    await connectDB();

    // Create new portfolio
    const portfolio = await Portfolio.create({
      userId: session.user.id,
      name: validatedData.name,
      totalDeposit: validatedData.totalDeposit,
      coins: validatedData.coins,
    });

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
