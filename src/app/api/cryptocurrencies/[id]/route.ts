import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import Cryptocurrency from '@/models/Cryptocurrency';
import Portfolio from '@/models/Portfolio';
import { ApiResponse, UpdateCryptocurrencyInput } from '@/types';
import { z } from 'zod';

interface RouteParams {
  params: Promise<{
    id: string;
  }>;
}

const updateCryptoSchema = z.object({
  name: z
    .string()
    .min(1, 'Name is required')
    .max(50, 'Name cannot exceed 50 characters')
    .trim(),
  decimalPlaces: z
    .number()
    .int()
    .min(0, 'Decimal places cannot be negative')
    .max(8, 'Decimal places cannot exceed 8'),
});

/**
 * PUT /api/cryptocurrencies/[id]
 * Updates a user's custom cryptocurrency
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
    const body: UpdateCryptocurrencyInput = await request.json();

    // Validate input
    const validatedData = updateCryptoSchema.parse(body);

    await connectDB();

    // Find the cryptocurrency
    const cryptocurrency = await Cryptocurrency.findById(id);

    if (!cryptocurrency) {
      return NextResponse.json(
        { success: false, error: 'Cryptocurrency not found' },
        { status: 404 }
      );
    }

    // Check if it's a default cryptocurrency
    if (cryptocurrency.isDefault) {
      return NextResponse.json(
        {
          success: false,
          error: 'Cannot edit system cryptocurrencies',
        },
        { status: 403 }
      );
    }

    // Check if user owns this cryptocurrency
    if (cryptocurrency.userId !== session.user.id) {
      return NextResponse.json(
        { success: false, error: 'Forbidden' },
        { status: 403 }
      );
    }

    // Update the cryptocurrency
    cryptocurrency.name = validatedData.name;
    cryptocurrency.decimalPlaces = validatedData.decimalPlaces;

    await cryptocurrency.save();

    return NextResponse.json({
      success: true,
      data: cryptocurrency,
      message: 'Cryptocurrency updated successfully',
    });
  } catch (error) {
    console.error('Error updating cryptocurrency:', error);

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
        error: 'Failed to update cryptocurrency',
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/cryptocurrencies/[id]
 * Deletes a user's custom cryptocurrency
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

    // Find the cryptocurrency
    const cryptocurrency = await Cryptocurrency.findById(id);

    if (!cryptocurrency) {
      return NextResponse.json(
        { success: false, error: 'Cryptocurrency not found' },
        { status: 404 }
      );
    }

    // Check if it's a default cryptocurrency
    if (cryptocurrency.isDefault) {
      return NextResponse.json(
        {
          success: false,
          error: 'Cannot delete system cryptocurrencies',
        },
        { status: 403 }
      );
    }

    // Check if user owns this cryptocurrency
    if (cryptocurrency.userId !== session.user.id) {
      return NextResponse.json(
        { success: false, error: 'Forbidden' },
        { status: 403 }
      );
    }

    // Check if cryptocurrency is used in any portfolio
    const portfoliosUsingCrypto = await Portfolio.findOne({
      userId: session.user.id,
      'coins.symbol': cryptocurrency.symbol,
    });

    if (portfoliosUsingCrypto) {
      return NextResponse.json(
        {
          success: false,
          error: `Cannot delete ${cryptocurrency.symbol} - it is used in portfolio "${portfoliosUsingCrypto.name}"`,
        },
        { status: 400 }
      );
    }

    // Delete the cryptocurrency
    await Cryptocurrency.findByIdAndDelete(id);

    return NextResponse.json({
      success: true,
      message: 'Cryptocurrency deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting cryptocurrency:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to delete cryptocurrency',
      },
      { status: 500 }
    );
  }
}
