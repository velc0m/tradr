import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import Cryptocurrency from '@/models/Cryptocurrency';
import { ApiResponse, CreateCryptocurrencyInput } from '@/types';
import { z } from 'zod';

const createCryptoSchema = z.object({
  symbol: z
    .string()
    .min(1, 'Symbol is required')
    .max(10, 'Symbol cannot exceed 10 characters')
    .transform((val) => val.toUpperCase().trim()),
  name: z
    .string()
    .min(1, 'Name is required')
    .max(50, 'Name cannot exceed 50 characters')
    .trim(),
  decimalPlaces: z
    .number()
    .int()
    .min(0, 'Decimal places cannot be negative')
    .max(8, 'Decimal places cannot exceed 8')
    .default(8),
});

/**
 * GET /api/cryptocurrencies
 * Returns all available cryptocurrencies for the authenticated user
 * (system default + user's custom cryptocurrencies)
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

    // Get all default cryptocurrencies + user's custom cryptocurrencies
    const cryptocurrencies = await Cryptocurrency.find({
      $or: [{ isDefault: true }, { userId: session.user.id }],
    }).sort({ isDefault: -1, symbol: 1 });

    return NextResponse.json({
      success: true,
      data: cryptocurrencies,
    });
  } catch (error) {
    console.error('Error fetching cryptocurrencies:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch cryptocurrencies',
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/cryptocurrencies
 * Creates a new user-specific cryptocurrency
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

    const body: CreateCryptocurrencyInput = await request.json();

    // Validate input
    const validatedData = createCryptoSchema.parse(body);

    await connectDB();

    // Check if cryptocurrency with this symbol already exists (global or for this user)
    const existing = await Cryptocurrency.findOne({
      symbol: validatedData.symbol,
      $or: [{ isDefault: true }, { userId: session.user.id }],
    });

    if (existing) {
      return NextResponse.json(
        {
          success: false,
          error: `Cryptocurrency with symbol ${validatedData.symbol} already exists`,
        },
        { status: 400 }
      );
    }

    // Create new cryptocurrency
    const cryptocurrency = await Cryptocurrency.create({
      symbol: validatedData.symbol,
      name: validatedData.name,
      decimalPlaces: validatedData.decimalPlaces,
      isDefault: false,
      userId: session.user.id,
    });

    return NextResponse.json(
      {
        success: true,
        data: cryptocurrency,
        message: 'Cryptocurrency created successfully',
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating cryptocurrency:', error);

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

    // Handle mongoose duplicate key error
    if (error instanceof Error && error.message.includes('duplicate key')) {
      return NextResponse.json(
        {
          success: false,
          error: 'Cryptocurrency with this symbol already exists',
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to create cryptocurrency',
      },
      { status: 500 }
    );
  }
}
