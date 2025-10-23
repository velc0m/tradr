import {NextRequest, NextResponse} from 'next/server';
import {getServerSession} from 'next-auth';
import {authOptions} from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import Portfolio from '@/models/Portfolio';
import Trade from '@/models/Trade';
import {ExportFormat, ExportInclude, ITrade, TradeStatus} from '@/types';
import * as XLSX from 'xlsx';

interface RouteParams {
    params: Promise<{
        portfolioId: string;
    }>;
}

// Helper function to format date in YYYY-MM-DD HH:mm format
function formatDate(date: Date | string | undefined): string {
    if (!date) return '-';
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:${minutes}`;
}

// Helper function to format price (remove trailing zeros)
function formatPrice(price: number): string {
    const formatted = price.toFixed(6);
    return formatted.replace(/\.?0+$/, '');
}

// Helper function to format amount (up to 10 decimal places, remove trailing zeros)
function formatAmount(amount: number): string {
    const formatted = amount.toFixed(10);
    return formatted.replace(/\.?0+$/, '');
}

// Calculate profit percent for a trade
function calculateProfitPercent(trade: ITrade): number | null {
    if (!trade.exitPrice) return null;
    return (
        ((trade.exitPrice / trade.entryPrice - 1) * 100) -
        trade.entryFee -
        (trade.exitFee || 0)
    );
}

// Calculate profit USD for a trade
function calculateProfitUSD(trade: ITrade): number | null {
    if (!trade.exitPrice) return null;

    const exitValue = trade.amount * trade.exitPrice * (100 - (trade.exitFee || 0)) / 100;
    return exitValue - trade.sumPlusFee;
}

// Format trade data for export
function formatTradeForExport(trade: ITrade) {
    const profitPercent = calculateProfitPercent(trade);
    const profitUSD = calculateProfitUSD(trade);

    return {
        'Trade ID': trade._id,
        'Coin': trade.coinSymbol,
        'Status': trade.status,
        'Trade Type': trade.tradeType,
        'Open Date': formatDate(trade.openDate),
        'Filled Date': formatDate(trade.filledDate),
        'Close Date': formatDate(trade.closeDate),
        'Entry Price': `$${formatPrice(trade.entryPrice)}`,
        'Exit Price': trade.exitPrice ? `$${formatPrice(trade.exitPrice)}` : '-',
        'Deposit %': `${trade.depositPercent}%`,
        'Entry Fee %': `${trade.entryFee}%`,
        'Exit Fee %': trade.exitFee ? `${trade.exitFee}%` : '-',
        'Amount': formatAmount(trade.amount),
        'Sum+Fee': `$${trade.sumPlusFee.toFixed(2)}`,
        'Profit %': profitPercent !== null ? `${profitPercent >= 0 ? '+' : ''}${profitPercent.toFixed(2)}%` : '-',
        'Profit USD': profitUSD !== null ? `${profitUSD >= 0 ? '+$' : '-$'}${Math.abs(profitUSD).toFixed(2)}` : '-',
    };
}

// Generate Excel file
function generateExcelFile(
    portfolioName: string,
    totalDeposit: number,
    coins: Array<{ symbol: string; percentage: number; decimalPlaces: number }>,
    trades: ITrade[],
    includePortfolioInfo: boolean
): Buffer {
    const workbook = XLSX.utils.book_new();

    // Portfolio Summary Sheet (if requested)
    if (includePortfolioInfo) {
        const portfolioData = [
            ['Portfolio Name', portfolioName],
            ['Total Deposit', `$${totalDeposit.toLocaleString('en-US', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            })}`],
            ['Export Date', formatDate(new Date())],
            [],
            ['Coin Distribution'],
            ['Symbol', 'Percentage', 'Decimal Places'],
            ...coins.map(coin => [coin.symbol, `${coin.percentage}%`, coin.decimalPlaces]),
        ];

        const portfolioSheet = XLSX.utils.aoa_to_sheet(portfolioData);
        XLSX.utils.book_append_sheet(workbook, portfolioSheet, 'Portfolio Summary');
    }

    // Trades Sheet
    if (trades.length > 0) {
        const tradesData = trades.map(formatTradeForExport);
        const tradesSheet = XLSX.utils.json_to_sheet(tradesData);
        XLSX.utils.book_append_sheet(workbook, tradesSheet, 'Trades');
    }

    // Write to buffer
    const excelBuffer = XLSX.write(workbook, {type: 'buffer', bookType: 'xlsx'});
    return Buffer.from(excelBuffer);
}

// Generate CSV file
function generateCSVFile(trades: ITrade[]): string {
    if (trades.length === 0) {
        return '\uFEFF'; // UTF-8 BOM
    }

    const tradesData = trades.map(formatTradeForExport);
    const worksheet = XLSX.utils.json_to_sheet(tradesData);
    const csv = XLSX.utils.sheet_to_csv(worksheet);

    // Add UTF-8 BOM for proper Excel handling
    return '\uFEFF' + csv;
}

export async function GET(
    request: NextRequest,
    {params}: RouteParams
): Promise<NextResponse> {
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

        // Parse query parameters
        const format = (searchParams.get('format') || 'xlsx') as ExportFormat;
        const includeParam = searchParams.get('include') || 'all';
        const includeOptions = includeParam.split(',') as ExportInclude[];

        await connectDB();

        // Fetch portfolio
        const portfolio = await Portfolio.findById(portfolioId);

        if (!portfolio) {
            return NextResponse.json(
                {success: false, error: 'Portfolio not found'},
                {status: 404}
            );
        }

        // Check if user owns this portfolio
        if (portfolio.userId !== session.user.id) {
            return NextResponse.json(
                {success: false, error: 'Forbidden'},
                {status: 403}
            );
        }

        // Fetch trades based on include options
        let tradesQuery: any = {
            portfolioId,
            isSplit: {$ne: true} // Exclude split original trades
        };

        if (includeOptions.includes('open') && !includeOptions.includes('closed')) {
            tradesQuery.status = {$in: [TradeStatus.OPEN, TradeStatus.FILLED]};
        } else if (includeOptions.includes('closed') && !includeOptions.includes('open')) {
            tradesQuery.status = TradeStatus.CLOSED;
        }
        // If 'all' or both 'open' and 'closed', no status filter

        const trades = await Trade.find(tradesQuery).sort({openDate: -1});

        const includePortfolioInfo = includeOptions.includes('portfolio');

        // Generate file based on format
        if (format === 'xlsx') {
            const buffer = generateExcelFile(
                portfolio.name,
                portfolio.totalDeposit,
                portfolio.coins,
                trades,
                includePortfolioInfo
            );

            // Generate filename
            const date = new Date().toISOString().split('T')[0];
            const filename = `portfolio-${portfolio.name.replace(/[^a-zA-Z0-9]/g, '_')}-${date}.xlsx`;

            return new NextResponse(buffer, {
                headers: {
                    'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                    'Content-Disposition': `attachment; filename="${filename}"`,
                },
            });
        } else {
            // CSV format - only trades
            const csv = generateCSVFile(trades);

            // Generate filename
            const date = new Date().toISOString().split('T')[0];
            const filename = `portfolio-${portfolio.name.replace(/[^a-zA-Z0-9]/g, '_')}-${date}.csv`;

            return new NextResponse(csv, {
                headers: {
                    'Content-Type': 'text/csv; charset=utf-8',
                    'Content-Disposition': `attachment; filename="${filename}"`,
                },
            });
        }
    } catch (error) {
        console.error('Error exporting portfolio:', error);
        return NextResponse.json(
            {
                success: false,
                error: 'Failed to export portfolio',
            },
            {status: 500}
        );
    }
}
