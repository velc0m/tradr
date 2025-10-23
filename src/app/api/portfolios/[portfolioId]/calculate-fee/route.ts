import {NextRequest, NextResponse} from 'next/server';
import {getServerSession} from 'next-auth';
import {authOptions} from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import Portfolio from '@/models/Portfolio';
import Trade from '@/models/Trade';
import {ApiResponse, TradeStatus} from '@/types';
import {calculateFeeLevel, FeeCalculationResult} from '@/lib/coinbaseFees';

interface RouteParams {
    params: Promise<{
        portfolioId: string;
    }>;
}

/**
 * Calculate 30-day trading volume
 * @param portfolioId - Portfolio ID to calculate volume for
 * @param excludeTradeId - Optional trade ID to exclude from calculation (for entry fee calculation)
 * @param includeTradeId - Optional trade ID to explicitly include in calculation (for SHORT with parent LONG)
 * @returns Total 30-day volume in USD
 */
async function calculate30DayVolume(
    portfolioId: string,
    excludeTradeId?: string,
    includeTradeId?: string
): Promise<number> {
    // Calculate date 30 days ago from now
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Build query: Find all filled or closed trades in the last 30 days
    // Exclude split original trades (isSplit: true) to avoid double counting
    const query: any = {
        portfolioId,
        isSplit: {$ne: true}, // Exclude split originals
        $or: [
            // CLOSED trades with closeDate in last 30 days
            {
                status: TradeStatus.CLOSED,
                closeDate: {$gte: thirtyDaysAgo}
            },
            // FILLED trades with filledDate in last 30 days
            {
                status: TradeStatus.FILLED,
                filledDate: {$gte: thirtyDaysAgo}
            },
            // Fallback: FILLED trades without filledDate, use updatedAt
            {
                status: TradeStatus.FILLED,
                filledDate: {$exists: false},
                updatedAt: {$gte: thirtyDaysAgo}
            },
        ],
    };

    // Exclude specific trade if provided (for entry fee calculation)
    if (excludeTradeId) {
        query._id = {$ne: excludeTradeId};
    }

    const trades = await Trade.find(query);

    // If includeTradeId is provided, fetch and add it explicitly
    if (includeTradeId) {
        const includeTrade = await Trade.findById(includeTradeId);

        if (includeTrade) {
            const alreadyIncluded = trades.some(t => t._id.toString() === includeTradeId);

            if (!alreadyIncluded) {
                trades.push(includeTrade);
            }
        }
    }

    // Sum up trading volume: entry (sumPlusFee) + exit (amount × exitPrice for closed trades)
    const totalVolume = trades.reduce((sum, trade) => {
        let tradeVolume = trade.sumPlusFee; // Entry volume

        // For closed trades, add exit volume
        if (trade.status === TradeStatus.CLOSED && trade.exitPrice) {
            const exitVolume = trade.amount * trade.exitPrice;
            tradeVolume += exitVolume;
        }

        return sum + tradeVolume;
    }, 0);

    return totalVolume;
}

/**
 * GET /api/portfolios/[portfolioId]/calculate-fee
 *
 * Query parameters:
 * - type: "entry" | "exit" - Type of fee to calculate
 * - tradeId: (optional) - Trade ID to exclude from entry fee calculation
 * - includeTradeId: (optional) - Trade ID to explicitly include in calculation (for SHORT with parent LONG)
 *
 * Returns current fee level and percentage based on 30-day volume
 */
export async function GET(
    request: NextRequest,
    {params}: RouteParams
): Promise<NextResponse<ApiResponse<FeeCalculationResult>>> {
    try {
        const session = await getServerSession(authOptions);

        if (!session?.user?.id) {
            return NextResponse.json(
                {success: false, error: 'Unauthorized'},
                {status: 401}
            );
        }

        const {portfolioId} = await params;
        const {searchParams} = new URL(request.url);
        const feeType = searchParams.get('type') || 'entry'; // "entry" or "exit"
        const tradeId = searchParams.get('tradeId'); // optional, for excluding from calculation
        const includeTradeId = searchParams.get('includeTradeId'); // optional, for including specific trade

        await connectDB();

        // Verify portfolio exists and user owns it
        const portfolio = await Portfolio.findById(portfolioId);

        if (!portfolio) {
            return NextResponse.json(
                {success: false, error: 'Portfolio not found'},
                {status: 404}
            );
        }

        if (portfolio.userId !== session.user.id) {
            return NextResponse.json(
                {success: false, error: 'Forbidden'},
                {status: 403}
            );
        }

        // Calculate 30-day volume
        let volume: number;

        if (feeType === 'entry') {
            // For entry fee: exclude current trade (if provided), but include specific trade (for SHORT with parent LONG)
            volume = await calculate30DayVolume(portfolioId, tradeId || undefined, includeTradeId || undefined);
        } else {
            // For exit fee: include current trade in volume (if provided)
            volume = await calculate30DayVolume(portfolioId, undefined, includeTradeId || undefined);
        }

        // Calculate fee level based on volume
        const feeResult = calculateFeeLevel(volume);

        return NextResponse.json({
            success: true,
            data: feeResult,
        });
    } catch (error) {
        console.error('Error calculating fee:', error);
        return NextResponse.json(
            {
                success: false,
                error: 'Failed to calculate fee',
            },
            {status: 500}
        );
    }
}
