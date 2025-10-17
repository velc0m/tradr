import { NextRequest, NextResponse } from 'next/server';
import { seedCryptocurrencies } from '@/lib/seedCrypto';
import { ApiResponse } from '@/types';

/**
 * POST /api/seed
 * Seeds the database with default cryptocurrencies
 * This endpoint is idempotent - it can be called multiple times safely
 */
export async function POST(
  request: NextRequest
): Promise<NextResponse<ApiResponse>> {
  try {
    await seedCryptocurrencies();

    return NextResponse.json({
      success: true,
      message: 'Database seeded successfully',
    });
  } catch (error) {
    console.error('Error seeding database:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to seed database',
      },
      { status: 500 }
    );
  }
}
