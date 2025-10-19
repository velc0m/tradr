import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import Portfolio from '@/models/Portfolio';
import { ApiResponse, CreatePortfolioInput } from '@/types';
import { z } from 'zod';

interface RouteParams {
  params: Promise<{
    portfolioId: string;
  }>;
}

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

const updatePortfolioSchema = z.object({
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
 * GET /api/portfolios/[portfolioId]
 * Returns a single portfolio by ID
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

    const portfolio = await Portfolio.findById(portfolioId);

    if (!portfolio) {
      return NextResponse.json(
        { success: false, error: 'Portfolio not found' },
        { status: 404 }
      );
    }

    // Check if user owns this portfolio
    if (portfolio.userId !== session.user.id) {
      return NextResponse.json(
        { success: false, error: 'Forbidden' },
        { status: 403 }
      );
    }

    return NextResponse.json({
      success: true,
      data: portfolio,
    });
  } catch (error) {
    console.error('Error fetching portfolio:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch portfolio',
      },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/portfolios/[portfolioId]
 * Updates a portfolio
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

    const { portfolioId } = await params;
    const body: CreatePortfolioInput = await request.json();

    // Validate input
    const validatedData = updatePortfolioSchema.parse(body);

    await connectDB();

    const portfolio = await Portfolio.findById(portfolioId);

    if (!portfolio) {
      return NextResponse.json(
        { success: false, error: 'Portfolio not found' },
        { status: 404 }
      );
    }

    // Check if user owns this portfolio
    if (portfolio.userId !== session.user.id) {
      return NextResponse.json(
        { success: false, error: 'Forbidden' },
        { status: 403 }
      );
    }

    // Update portfolio
    portfolio.name = validatedData.name;
    portfolio.totalDeposit = validatedData.totalDeposit;
    portfolio.coins = validatedData.coins;

    await portfolio.save();

    return NextResponse.json({
      success: true,
      data: portfolio,
      message: 'Portfolio updated successfully',
    });
  } catch (error) {
    console.error('Error updating portfolio:', error);

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
        error: 'Failed to update portfolio',
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/portfolios/[portfolioId]
 * Deletes a portfolio
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

    const { portfolioId } = await params;

    await connectDB();

    const portfolio = await Portfolio.findById(portfolioId);

    if (!portfolio) {
      return NextResponse.json(
        { success: false, error: 'Portfolio not found' },
        { status: 404 }
      );
    }

    // Check if user owns this portfolio
    if (portfolio.userId !== session.user.id) {
      return NextResponse.json(
        { success: false, error: 'Forbidden' },
        { status: 403 }
      );
    }

    // Delete the portfolio
    await Portfolio.findByIdAndDelete(portfolioId);

    return NextResponse.json({
      success: true,
      message: 'Portfolio deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting portfolio:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to delete portfolio',
      },
      { status: 500 }
    );
  }
}
