import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import mongoose from 'mongoose';
import { ApiResponse } from '@/types';

/**
 * POST /api/migrate/trades-short-fields
 * Migrates existing trades to add SHORT position fields
 *
 * This endpoint:
 * 1. Finds all trades without the new fields (tradeType, initialEntryPrice, initialAmount)
 * 2. Updates them with default LONG values:
 *    - tradeType = 'LONG'
 *    - initialEntryPrice = entryPrice
 *    - initialAmount = originalAmount (or amount if originalAmount is not set)
 */
export async function POST(
  request: NextRequest
): Promise<NextResponse<ApiResponse>> {
  try {
    const session = await getServerSession(authOptions);

    // Only allow authenticated users to run migrations
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    await connectDB();

    const db = mongoose.connection.db;
    if (!db) {
      throw new Error('Database connection not established');
    }

    const tradesCollection = db.collection('trades');

    // Find all trades that don't have the new fields
    const tradesToUpdate = await tradesCollection.find({
      $or: [
        { tradeType: { $exists: false } },
        { initialEntryPrice: { $exists: false } },
        { initialAmount: { $exists: false } },
      ],
    }).toArray();

    console.log(`Found ${tradesToUpdate.length} trades to migrate`);

    if (tradesToUpdate.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No trades need migration. All trades already have the new fields.',
        data: {
          totalTrades: 0,
          updatedCount: 0,
          errorCount: 0,
        },
      });
    }

    let updatedCount = 0;
    let errorCount = 0;
    const errors: Array<{ tradeId: string; error: string }> = [];

    for (const trade of tradesToUpdate) {
      try {
        const updateData: any = {};

        // Set tradeType to LONG if not exists
        if (!trade.tradeType) {
          updateData.tradeType = 'LONG';
        }

        // Set initialEntryPrice to current entryPrice if not exists
        if (!trade.initialEntryPrice && trade.entryPrice !== undefined) {
          updateData.initialEntryPrice = trade.entryPrice;
        }

        // Set initialAmount to originalAmount (or amount if originalAmount doesn't exist)
        if (!trade.initialAmount) {
          if (trade.originalAmount !== undefined) {
            updateData.initialAmount = trade.originalAmount;
          } else if (trade.amount !== undefined) {
            updateData.initialAmount = trade.amount;
          }
        }

        // Update the trade
        const result = await tradesCollection.updateOne(
          { _id: trade._id },
          { $set: updateData }
        );

        if (result.modifiedCount > 0) {
          updatedCount++;
          console.log(`✓ Updated trade ${trade._id}: ${JSON.stringify(updateData)}`);
        }
      } catch (error) {
        errorCount++;
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        errors.push({ tradeId: trade._id.toString(), error: errorMessage });
        console.error(`✗ Error updating trade ${trade._id}:`, error);
      }
    }

    // Verify the migration
    const remainingTrades = await tradesCollection.countDocuments({
      $or: [
        { tradeType: { $exists: false } },
        { initialEntryPrice: { $exists: false } },
        { initialAmount: { $exists: false } },
      ],
    });

    const isSuccess = remainingTrades === 0;

    return NextResponse.json({
      success: isSuccess,
      message: isSuccess
        ? 'Migration completed successfully! All trades now have the new fields.'
        : 'Migration completed with some errors. Review the error details.',
      data: {
        totalTrades: tradesToUpdate.length,
        updatedCount,
        errorCount,
        remainingTrades,
        errors: errors.length > 0 ? errors : undefined,
      },
    });
  } catch (error) {
    console.error('Error running migration:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to run migration',
      },
      { status: 500 }
    );
  }
}
