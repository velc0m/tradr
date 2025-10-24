import {NextRequest, NextResponse} from 'next/server';
import {getServerSession} from 'next-auth';
import {authOptions} from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import Trade from '@/models/Trade';
import Portfolio from '@/models/Portfolio';
import {ApiResponse, TradeStatus, TradeType, UpdateTradeInput} from '@/types';
import {z} from 'zod';

interface RouteParams {
    params: Promise<{
        id: string;
    }>;
}

const updateTradeSchema = z.object({
    status: z.nativeEnum(TradeStatus).optional(),
    exitPrice: z.number().positive().optional().nullable(),
    exitFee: z.number().min(0).max(100).optional(),
    amount: z.number().positive().optional(),
    sumPlusFee: z.number().positive().optional(),
    filledDate: z.string().optional(), // Accept as string to avoid timezone conversion
    closeDate: z.string().optional(), // Accept as string to avoid timezone conversion
    // New fields for editing open/filled trades
    entryPrice: z.number().positive().optional(),
    depositPercent: z.number().min(0).max(100).optional(),
    entryFee: z.number().min(0).max(100).optional(),
    openDate: z.string().optional(),
});

/**
 * PUT /api/trades/[id]
 * Updates a trade
 */
export async function PUT(
    request: NextRequest,
    {params}: RouteParams
): Promise<NextResponse<ApiResponse>> {
    try {
        const session = await getServerSession(authOptions);

        if (!session?.user?.id) {
            return NextResponse.json(
                {success: false, error: 'Unauthorized'},
                {status: 401}
            );
        }

        const {id} = await params;
        const body: UpdateTradeInput = await request.json();

        // Validate input
        const validatedData = updateTradeSchema.parse(body);

        await connectDB();

        // Find the trade
        const trade = await Trade.findById(id);

        if (!trade) {
            return NextResponse.json(
                {success: false, error: 'Trade not found'},
                {status: 404}
            );
        }

        // Verify user owns the portfolio this trade belongs to
        const portfolio = await Portfolio.findById(trade.portfolioId);

        if (!portfolio || portfolio.userId !== session.user.id) {
            return NextResponse.json(
                {success: false, error: 'Forbidden'},
                {status: 403}
            );
        }

        // Check if editing entry fields (only allowed for open/filled trades)
        const isEditingEntryFields =
            validatedData.entryPrice !== undefined ||
            validatedData.depositPercent !== undefined ||
            validatedData.entryFee !== undefined ||
            validatedData.openDate !== undefined;

        if (isEditingEntryFields && trade.status === TradeStatus.CLOSED) {
            return NextResponse.json(
                {success: false, error: 'Cannot edit entry fields of closed trades'},
                {status: 400}
            );
        }

        // Update trade fields
        if (validatedData.status !== undefined) {
            const wasNotClosed = trade.status !== TradeStatus.CLOSED;
            const isNowClosed = validatedData.status === TradeStatus.CLOSED;

            trade.status = validatedData.status;

            // If status changed to closed, set closeDate
            if (isNowClosed && !trade.closeDate) {
                trade.closeDate = new Date();
            }

            // If SHORT trade is being closed, update parent LONG trade
            if (wasNotClosed && isNowClosed && trade.tradeType === TradeType.SHORT && trade.parentTradeId) {
                // Must have exitPrice to close
                if (!trade.exitPrice) {
                    return NextResponse.json(
                        {success: false, error: 'Cannot close SHORT trade without exit price'},
                        {status: 400}
                    );
                }

                // Find parent LONG trade
                const parentTrade = await Trade.findById(trade.parentTradeId);

                if (parentTrade && parentTrade.tradeType === TradeType.LONG) {
                    // Calculate profit in coins for SHORT
                    // No partial closes - always use full amount
                    const shortAmount = trade.amount;

                    // Calculate net received after entry fee (sale fee)
                    const entryFeeVal = trade.entryFee ?? 0;
                    const netReceived = trade.sumPlusFee * (100 - entryFeeVal) / 100;

                    // Calculate buy back cost with exit fee
                    const exitFeeVal = trade.exitFee ?? 0;
                    const buyBackPriceWithFee = trade.exitPrice * (100 + exitFeeVal) / 100;

                    // Calculate coins bought back from net received
                    const coinsBoughtBack = netReceived / buyBackPriceWithFee;

                    // Update parent LONG trade
                    const newAmount = parentTrade.amount + coinsBoughtBack;
                    const newEntryPrice = parentTrade.sumPlusFee / newAmount;

                    parentTrade.amount = newAmount;
                    parentTrade.entryPrice = newEntryPrice;
                    // Do NOT update initialEntryPrice or initialAmount!

                    await parentTrade.save();
                }
            }
        }

        if (validatedData.exitPrice !== undefined) {
            trade.exitPrice = validatedData.exitPrice === null ? undefined : validatedData.exitPrice;
        }

        if (validatedData.exitFee !== undefined) {
            trade.exitFee = validatedData.exitFee;
        }

        if (validatedData.amount !== undefined) {
            trade.amount = validatedData.amount;
        }

        if (validatedData.sumPlusFee !== undefined) {
            trade.sumPlusFee = validatedData.sumPlusFee;
        }

        if (validatedData.filledDate !== undefined && validatedData.filledDate !== '') {
            const filledDate = new Date(validatedData.filledDate + 'T00:00:00');
            trade.filledDate = filledDate;
        }

        if (validatedData.closeDate !== undefined && validatedData.closeDate !== '') {
            const closeDate = new Date(validatedData.closeDate + 'T00:00:00');
            trade.closeDate = closeDate;
        }

        // Update entry fields (for open/filled trades)
        if (validatedData.entryPrice !== undefined) {
            trade.entryPrice = validatedData.entryPrice;
        }

        if (validatedData.depositPercent !== undefined) {
            trade.depositPercent = validatedData.depositPercent;
        }

        if (validatedData.entryFee !== undefined) {
            trade.entryFee = validatedData.entryFee;
        }

        if (validatedData.openDate !== undefined && validatedData.openDate !== '') {
            const openDate = new Date(validatedData.openDate + 'T00:00:00');
            trade.openDate = openDate;
        }

        await trade.save();

        return NextResponse.json({
            success: true,
            data: trade,
            message: 'Trade updated successfully',
        });
    } catch (error) {
        console.error('Error updating trade:', error);

        // Handle validation errors
        if (error instanceof z.ZodError) {
            return NextResponse.json(
                {
                    success: false,
                    error: error.errors[0].message,
                },
                {status: 400}
            );
        }

        return NextResponse.json(
            {
                success: false,
                error: 'Failed to update trade',
            },
            {status: 500}
        );
    }
}

/**
 * DELETE /api/trades/[id]
 * Deletes a trade
 */
export async function DELETE(
    request: NextRequest,
    {params}: RouteParams
): Promise<NextResponse<ApiResponse>> {
    try {
        const session = await getServerSession(authOptions);

        if (!session?.user?.id) {
            return NextResponse.json(
                {success: false, error: 'Unauthorized'},
                {status: 401}
            );
        }

        const {id} = await params;

        await connectDB();

        // Find the trade
        const trade = await Trade.findById(id);

        if (!trade) {
            return NextResponse.json(
                {success: false, error: 'Trade not found'},
                {status: 404}
            );
        }

        // Verify user owns the portfolio this trade belongs to
        const portfolio = await Portfolio.findById(trade.portfolioId);

        if (!portfolio || portfolio.userId !== session.user.id) {
            return NextResponse.json(
                {success: false, error: 'Forbidden'},
                {status: 403}
            );
        }

        // If deleting SHORT that's not closed, restore parent LONG amount
        if (trade.tradeType === TradeType.SHORT && trade.parentTradeId && trade.status !== TradeStatus.CLOSED) {
            const parentTrade = await Trade.findById(trade.parentTradeId);

            if (parentTrade) {
                // Restore amount back to parent LONG
                parentTrade.amount += trade.amount;
                await parentTrade.save();
            }
        }

        // Delete the trade
        await Trade.findByIdAndDelete(id);

        return NextResponse.json({
            success: true,
            message: 'Trade deleted successfully',
        });
    } catch (error) {
        console.error('Error deleting trade:', error);
        return NextResponse.json(
            {
                success: false,
                error: 'Failed to delete trade',
            },
            {status: 500}
        );
    }
}
