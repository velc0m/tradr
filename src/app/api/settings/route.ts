import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import UserSettings from '@/models/UserSettings';
import { ApiResponse } from '@/types';
import { z } from 'zod';

const updateSettingsSchema = z.object({
  feeCalculationMode: z.enum(['per-portfolio', 'combined']),
  combinedPortfolios: z.array(z.string()).optional(),
});

/**
 * GET /api/settings
 * Get user settings (creates default if not exists)
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

    // Find or create settings
    let settings = await UserSettings.findOne({ userId: session.user.id });

    if (!settings) {
      // Create default settings
      settings = await UserSettings.create({
        userId: session.user.id,
        feeCalculationMode: 'per-portfolio',
        combinedPortfolios: [],
      });
    }

    return NextResponse.json({
      success: true,
      data: settings,
    });
  } catch (error) {
    console.error('Error fetching settings:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch settings',
      },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/settings
 * Update user settings
 */
export async function PUT(
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

    const body = await request.json();

    // Validate input
    const validatedData = updateSettingsSchema.parse(body);

    await connectDB();

    // Find or create settings
    let settings = await UserSettings.findOne({ userId: session.user.id });

    if (!settings) {
      // Create new settings
      settings = await UserSettings.create({
        userId: session.user.id,
        ...validatedData,
      });
    } else {
      // Update existing settings
      settings.feeCalculationMode = validatedData.feeCalculationMode;
      if (validatedData.combinedPortfolios !== undefined) {
        settings.combinedPortfolios = validatedData.combinedPortfolios;
      }
      await settings.save();
    }

    return NextResponse.json({
      success: true,
      data: settings,
      message: 'Settings updated successfully',
    });
  } catch (error) {
    console.error('Error updating settings:', error);

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
        error: 'Failed to update settings',
      },
      { status: 500 }
    );
  }
}
