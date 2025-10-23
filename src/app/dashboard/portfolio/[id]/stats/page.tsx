'use client';

import {useEffect, useState} from 'react';
import {useSession} from 'next-auth/react';
import {redirect, useRouter} from 'next/navigation';
import Link from 'next/link';
import {Button} from '@/components/ui/button';
import {Card, CardContent, CardHeader, CardTitle} from '@/components/ui/card';
import {Table, TableBody, TableCell, TableHead, TableHeader, TableRow,} from '@/components/ui/table';
import {useToast} from '@/components/ui/use-toast';
import {IPortfolio, PortfolioStatistics} from '@/types';
import {ArrowLeft, BarChart3, DollarSign, Target, TrendingDown, TrendingUp, Trophy} from 'lucide-react';
import {CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,} from 'recharts';

interface StatsPageProps {
    params: {
        id: string;
    };
}

export default function PortfolioStatsPage({params}: StatsPageProps) {
    const {status} = useSession();
    const router = useRouter();
    const [portfolio, setPortfolio] = useState<IPortfolio | null>(null);
    const [stats, setStats] = useState<PortfolioStatistics | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [showCurrentValue, setShowCurrentValue] = useState(false);
    const [currentPrices, setCurrentPrices] = useState<Record<string, number>>({});
    const [isLoadingPrices, setIsLoadingPrices] = useState(false);
    const {toast} = useToast();

    useEffect(() => {
        if (status === 'authenticated') {
            fetchPortfolio();
            fetchStats();
        }
    }, [status, params.id]);

    if (status === 'loading') {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center">
                <div className="text-muted-foreground">Loading...</div>
            </div>
        );
    }

    if (status === 'unauthenticated') {
        redirect('/auth/signin');
    }

    const fetchPortfolio = async () => {
        try {
            const response = await fetch(`/api/portfolios/${params.id}`);
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to fetch portfolio');
            }

            if (data.success && data.data) {
                setPortfolio(data.data);
            }
        } catch (error) {
            toast({
                title: 'Error',
                description:
                    error instanceof Error ? error.message : 'Failed to load portfolio',
                variant: 'destructive',
            });
            router.push('/dashboard');
        }
    };

    const fetchStats = async () => {
        setIsLoading(true);
        try {
            const response = await fetch(`/api/portfolios/${params.id}/stats`);
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to fetch statistics');
            }

            if (data.success && data.data) {
                setStats(data.data);
            }
        } catch (error) {
            toast({
                title: 'Error',
                description:
                    error instanceof Error ? error.message : 'Failed to load statistics',
                variant: 'destructive',
            });
        } finally {
            setIsLoading(false);
        }
    };

    const fetchCurrentPrices = async () => {
        if (!stats?.short.totalProfitCoins) return;

        setIsLoadingPrices(true);
        try {
            const symbols = Object.keys(stats.short.totalProfitCoins);
            if (symbols.length === 0) return;

            const response = await fetch(`/api/prices/current?symbols=${symbols.join(',')}`);
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to fetch prices');
            }

            if (data.success && data.data) {
                setCurrentPrices(data.data);
            }
        } catch (error) {
            toast({
                title: 'Error',
                description:
                    error instanceof Error ? error.message : 'Failed to load current prices',
                variant: 'destructive',
            });
        } finally {
            setIsLoadingPrices(false);
        }
    };

    // Fetch current prices when toggle is enabled
    useEffect(() => {
        if (showCurrentValue && stats) {
            fetchCurrentPrices();
        }
    }, [showCurrentValue, stats]);

    const formatCurrency = (value: number): string => {
        return value.toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        });
    };

    const formatPercent = (value: number): string => {
        return value.toFixed(2);
    };

    const formatDate = (dateString: string): string => {
        return new Date(dateString).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
        });
    };

    const formatPrice = (price: number): string => {
        const formatted = price.toFixed(2);
        const trimmed = formatted.replace(/\.?0+$/, '');
        return trimmed;
    };

    // Calculate SHORT profit in USD using current prices
    const calculateShortProfitUSD = (): number => {
        if (!stats?.short.totalProfitCoins || !showCurrentValue) return 0;

        let totalUSD = 0;
        Object.entries(stats.short.totalProfitCoins).forEach(([symbol, amount]) => {
            const price = currentPrices[symbol];
            if (price) {
                totalUSD += amount * price;
            }
        });

        return totalUSD;
    };

    // Calculate combined P/L (LONG USD + SHORT USD)
    const calculateCombinedPL = (): number => {
        if (!stats) return 0;

        const longProfitUSD = stats.long?.totalProfitUSD || 0;
        const shortProfitUSD = showCurrentValue ? calculateShortProfitUSD() : 0;

        return longProfitUSD + shortProfitUSD;
    };

    if (isLoading || !stats) {
        return (
            <div className="min-h-screen bg-background">
                <main className="container mx-auto px-4 py-8">
                    <div className="text-center py-12 text-muted-foreground">
                        Loading statistics...
                    </div>
                </main>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background">
            <main className="container mx-auto px-4 py-8">
                <div className="space-y-6">
                    {/* Header */}
                    <div className="flex items-center gap-4">
                        <Link href={`/dashboard/portfolio/${params.id}`}>
                            <Button variant="ghost" size="icon">
                                <ArrowLeft className="h-5 w-5"/>
                            </Button>
                        </Link>
                        <div className="flex-1">
                            <h1 className="text-3xl font-bold">Portfolio Statistics</h1>
                            <p className="text-muted-foreground mt-1">
                                {portfolio?.name || 'Portfolio'} - Performance Analytics
                            </p>
                        </div>
                        {stats?.short && stats.short.totalTrades > 0 && (
                            <div className="flex items-center gap-2">
                                <Button
                                    variant={showCurrentValue ? 'default' : 'outline'}
                                    size="sm"
                                    onClick={() => setShowCurrentValue(!showCurrentValue)}
                                    disabled={isLoadingPrices}
                                >
                                    {isLoadingPrices ? 'Loading...' : showCurrentValue ? 'Hide Current Value' : 'Show Current Value'}
                                </Button>
                            </div>
                        )}
                    </div>

                    {/* Overall Metrics Grid */}
                    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                        {/* Total Profit/Loss */}
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">
                                    Total Profit/Loss
                                    {showCurrentValue && (
                                        <span className="text-xs text-muted-foreground ml-2">(Combined)</span>
                                    )}
                                </CardTitle>
                                <DollarSign className="h-4 w-4 text-muted-foreground"/>
                            </CardHeader>
                            <CardContent>
                                {showCurrentValue ? (
                                    <>
                                        <div
                                            className={`text-2xl font-bold ${
                                                calculateCombinedPL() >= 0 ? 'text-green-500' : 'text-red-500'
                                            }`}
                                        >
                                            {calculateCombinedPL() >= 0 ? '+' : ''}${formatCurrency(calculateCombinedPL())}
                                        </div>
                                        <p className="text-xs text-muted-foreground">
                                            LONG: ${formatCurrency(stats.long?.totalProfitUSD || 0)} + SHORT:
                                            ${formatCurrency(calculateShortProfitUSD())}
                                        </p>
                                        <p className="text-xs text-yellow-500 mt-1">
                                            * Current prices are approximate
                                        </p>
                                    </>
                                ) : (
                                    <>
                                        <div
                                            className={`text-2xl font-bold ${
                                                stats.totalProfitUSD >= 0 ? 'text-green-500' : 'text-red-500'
                                            }`}
                                        >
                                            {stats.totalProfitUSD >= 0 ? '+' : ''}${formatCurrency(stats.totalProfitUSD)}
                                        </div>
                                        <p
                                            className={`text-xs ${
                                                stats.totalProfitPercent >= 0 ? 'text-green-500' : 'text-red-500'
                                            }`}
                                        >
                                            {stats.totalProfitPercent >= 0 ? '+' : ''}
                                            {formatPercent(stats.totalProfitPercent)}% average
                                        </p>
                                    </>
                                )}
                            </CardContent>
                        </Card>

                        {/* Win Rate */}
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Win Rate</CardTitle>
                                <Target className="h-4 w-4 text-muted-foreground"/>
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{formatPercent(stats.winRate)}%</div>
                                <p className="text-xs text-muted-foreground">
                                    Profitable trades
                                </p>
                            </CardContent>
                        </Card>

                        {/* Average Profit */}
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">
                                    Average Profit
                                </CardTitle>
                                <TrendingUp className="h-4 w-4 text-muted-foreground"/>
                            </CardHeader>
                            <CardContent>
                                <div
                                    className={`text-2xl font-bold ${
                                        stats.avgProfitUSD >= 0 ? 'text-green-500' : 'text-red-500'
                                    }`}
                                >
                                    {stats.avgProfitUSD >= 0 ? '+' : ''}${formatCurrency(stats.avgProfitUSD)}
                                </div>
                                <p
                                    className={`text-xs ${
                                        stats.avgProfitPercent >= 0 ? 'text-green-500' : 'text-red-500'
                                    }`}
                                >
                                    {stats.avgProfitPercent >= 0 ? '+' : ''}
                                    {formatPercent(stats.avgProfitPercent)}% per trade
                                </p>
                            </CardContent>
                        </Card>

                        {/* Total ROI */}
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Total ROI</CardTitle>
                                <BarChart3 className="h-4 w-4 text-muted-foreground"/>
                            </CardHeader>
                            <CardContent>
                                <div
                                    className={`text-2xl font-bold ${
                                        stats.totalROI >= 0 ? 'text-green-500' : 'text-red-500'
                                    }`}
                                >
                                    {stats.totalROI >= 0 ? '+' : ''}
                                    {formatPercent(stats.totalROI)}%
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    Return on Investment
                                </p>
                            </CardContent>
                        </Card>

                        {/* Total Trades */}
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">
                                    Total Trades
                                </CardTitle>
                                <BarChart3 className="h-4 w-4 text-muted-foreground"/>
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">
                                    {stats.totalTrades.open + stats.totalTrades.filled + stats.totalTrades.closed}
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    <span className="text-gray-400">{stats.totalTrades.open} open</span>
                                    {' · '}
                                    <span className="text-green-400">{stats.totalTrades.filled} filled</span>
                                    {' · '}
                                    <span className="text-red-400">{stats.totalTrades.closed} closed</span>
                                </p>
                                {stats.averaging && stats.averaging.totalTrades > 0 && (
                                    <p className="text-xs text-blue-400 mt-1">
                                        + {stats.averaging.totalTrades} averaging
                                        operation{stats.averaging.totalTrades > 1 ? 's' : ''}
                                    </p>
                                )}
                            </CardContent>
                        </Card>

                        {/* Total Fees Paid */}
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">
                                    Total Fees Paid
                                </CardTitle>
                                <DollarSign className="h-4 w-4 text-muted-foreground"/>
                            </CardHeader>
                            <CardContent>
                                <div
                                    className="text-2xl font-bold text-orange-500 cursor-help"
                                    title={`Standard Trades: $${formatCurrency(stats.standardFees)}\nAveraging Operations: $${formatCurrency(stats.averagingFees)}`}
                                >
                                    ${formatCurrency(stats.totalFeesPaid)}
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    Entry + Exit fees on closed trades
                                </p>
                                {stats.averagingFees > 0 && (
                                    <p className="text-xs text-blue-400 mt-1">
                                        Standard: ${formatCurrency(stats.standardFees)} · Averaging:
                                        ${formatCurrency(stats.averagingFees)}
                                    </p>
                                )}
                            </CardContent>
                        </Card>

                        {/* Best/Worst Trade */}
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">
                                    Best/Worst Trade
                                </CardTitle>
                                <Trophy className="h-4 w-4 text-muted-foreground"/>
                            </CardHeader>
                            <CardContent>
                                {stats.bestTrade ? (
                                    <div className="space-y-2">
                                        <div>
                                            <div className="text-xs text-muted-foreground">Best</div>
                                            <div className="text-sm font-medium text-green-500">
                                                {stats.bestTrade.trade.coinSymbol}:
                                                +${formatCurrency(stats.bestTrade.trade.profitUSD)}
                                            </div>
                                        </div>
                                        {stats.worstTrade && (
                                            <div>
                                                <div className="text-xs text-muted-foreground">Worst</div>
                                                <div
                                                    className={`text-sm font-medium ${stats.worstTrade.trade.profitUSD >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                                                    {stats.worstTrade.trade.coinSymbol}: {stats.worstTrade.trade.profitUSD >= 0 ? '+' : ''}${formatCurrency(stats.worstTrade.trade.profitUSD)}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <div className="text-sm text-muted-foreground">No trades yet</div>
                                )}
                            </CardContent>
                        </Card>
                    </div>

                    {/* LONG and SHORT Specific Metrics */}
                    <div className="grid gap-6 md:grid-cols-2">
                        {/* LONG Performance */}
                        {stats.long && stats.long.totalTrades > 0 && (
                            <Card>
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2">
                                        <TrendingUp className="h-5 w-5 text-green-500"/>
                                        LONG Performance
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div>
                                        <div className="text-sm text-muted-foreground">Total Profit (USD)</div>
                                        <div
                                            className={`text-2xl font-bold ${stats.long.totalProfitUSD >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                                            {stats.long.totalProfitUSD >= 0 ? '+' : ''}${formatCurrency(stats.long.totalProfitUSD)}
                                        </div>
                                    </div>
                                    <div>
                                        <div className="text-sm text-muted-foreground">Win Rate</div>
                                        <div className="text-xl font-bold">{formatPercent(stats.long.winRate)}%</div>
                                    </div>
                                    <div>
                                        <div className="text-sm text-muted-foreground">Avg Profit per Trade</div>
                                        <div
                                            className={`text-xl font-bold ${stats.long.avgProfitUSD >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                                            {stats.long.avgProfitUSD >= 0 ? '+' : ''}${formatCurrency(stats.long.avgProfitUSD)}
                                        </div>
                                        <p className="text-xs text-muted-foreground">
                                            {stats.long.avgProfitPercent >= 0 ? '+' : ''}{formatPercent(stats.long.avgProfitPercent)}%
                                            avg
                                        </p>
                                    </div>
                                    <div className="pt-2 border-t">
                                        <div className="text-sm text-muted-foreground">Total LONG Trades</div>
                                        <div className="text-xl font-bold">{stats.long.totalTrades}</div>
                                    </div>
                                </CardContent>
                            </Card>
                        )}

                        {/* SHORT Performance */}
                        {stats.short && stats.short.totalTrades > 0 && (
                            <Card>
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2">
                                        <TrendingDown className="h-5 w-5 text-orange-500"/>
                                        SHORT Performance
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div>
                                        <div className="text-sm text-muted-foreground">
                                            Total Profit {showCurrentValue ? '(USD)' : '(Coins)'}
                                        </div>
                                        {showCurrentValue ? (
                                            <>
                                                <div
                                                    className={`text-2xl font-bold ${calculateShortProfitUSD() >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                                                    {calculateShortProfitUSD() >= 0 ? '+' : ''}${formatCurrency(calculateShortProfitUSD())}
                                                </div>
                                                <div className="space-y-0.5 mt-2 text-xs text-muted-foreground">
                                                    {Object.entries(stats.short.totalProfitCoins).map(([symbol, amount]) => {
                                                        const price = currentPrices[symbol];
                                                        return (
                                                            <div key={symbol}>
                                                                {amount.toFixed(8)} {symbol} ×
                                                                ${price ? formatCurrency(price) : '-.--'} =
                                                                ${price ? formatCurrency(amount * price) : '-.--'}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                                <p className="text-xs text-yellow-500 mt-2">
                                                    * Current prices are approximate
                                                </p>
                                            </>
                                        ) : (
                                            <div className="space-y-1">
                                                {Object.entries(stats.short.totalProfitCoins).map(([symbol, amount]) => (
                                                    <div key={symbol}
                                                         className={`text-lg font-bold ${amount >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                                                        {amount >= 0 ? '+' : ''}{amount.toFixed(8)} {symbol}
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                    <div>
                                        <div className="text-sm text-muted-foreground">Win Rate</div>
                                        <div className="text-xl font-bold">{formatPercent(stats.short.winRate)}%</div>
                                    </div>
                                    <div>
                                        <div className="text-sm text-muted-foreground">Avg Profit per Trade</div>
                                        <div className="space-y-1">
                                            {Object.entries(stats.short.avgProfitCoins).map(([symbol, amount]) => (
                                                <div key={symbol}
                                                     className={`text-lg font-bold ${amount >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                                                    {amount >= 0 ? '+' : ''}{amount.toFixed(8)} {symbol}
                                                </div>
                                            ))}
                                        </div>
                                        <p className="text-xs text-muted-foreground mt-1">
                                            {stats.short.avgProfitPercent >= 0 ? '+' : ''}{formatPercent(stats.short.avgProfitPercent)}%
                                            avg
                                        </p>
                                    </div>
                                    <div className="pt-2 border-t">
                                        <div className="text-sm text-muted-foreground">Total SHORT Trades</div>
                                        <div className="text-xl font-bold">{stats.short.totalTrades}</div>
                                    </div>
                                </CardContent>
                            </Card>
                        )}

                        {/* Averaging Operations */}
                        {stats.averaging && stats.averaging.totalTrades > 0 && (
                            <Card>
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2">
                                        <BarChart3 className="h-5 w-5 text-blue-500"/>
                                        Averaging Operations
                                    </CardTitle>
                                    <p className="text-xs text-muted-foreground mt-1">
                                        Internal operations for averaging down LONG positions
                                    </p>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="rounded-md bg-blue-500/10 border border-blue-500/20 p-3">
                                        <p className="text-xs text-blue-400">
                                            ℹ️ These operations earn coins to increase holdings in existing LONG
                                            positions.
                                            <br/>
                                            Not counted in main P&L to avoid double-counting when LONG closes.
                                        </p>
                                    </div>
                                    <div>
                                        <div className="text-sm text-muted-foreground">
                                            Total Coins Earned
                                        </div>
                                        <div className="space-y-1">
                                            {Object.entries(stats.averaging.totalProfitCoins).map(([symbol, amount]) => (
                                                <div key={symbol}
                                                     className={`text-lg font-bold ${amount >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                                                    {amount >= 0 ? '+' : ''}{amount.toFixed(8)} {symbol}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                    <div>
                                        <div className="text-sm text-muted-foreground">Success Rate</div>
                                        <div className="text-xl font-bold">{formatPercent(stats.averaging.winRate)}%
                                        </div>
                                    </div>
                                    <div>
                                        <div className="text-sm text-muted-foreground">Avg % per Operation</div>
                                        <div className="text-xl font-bold">
                                            {stats.averaging.totalProfitPercent >= 0 ? '+' : ''}
                                            {formatPercent(stats.averaging.totalProfitPercent)}%
                                        </div>
                                    </div>
                                    <div>
                                        <div className="text-sm text-muted-foreground">Fees Paid</div>
                                        <div
                                            className="text-xl font-bold text-orange-500">${formatCurrency(stats.averagingFees)}</div>
                                    </div>
                                    <div className="pt-2 border-t">
                                        <div className="text-sm text-muted-foreground">Total Operations</div>
                                        <div className="text-xl font-bold">{stats.averaging.totalTrades}</div>
                                    </div>
                                </CardContent>
                            </Card>
                        )}
                    </div>

                    {/* Performance by Coin */}
                    {stats.performanceByCoin.length > 0 && (
                        <Card>
                            <CardHeader>
                                <CardTitle>Performance by Coin</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="overflow-x-auto">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead className="min-w-[80px]">Coin</TableHead>
                                                <TableHead className="min-w-[80px]">Trades</TableHead>
                                                <TableHead className="min-w-[80px]">Win Rate</TableHead>
                                                <TableHead className="min-w-[120px]">Total Profit USD</TableHead>
                                                <TableHead className="min-w-[120px]">Avg Profit %</TableHead>
                                                <TableHead className="min-w-[100px]">Best Trade</TableHead>
                                                <TableHead className="min-w-[100px]">Worst Trade</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {stats.performanceByCoin.map((coin) => (
                                                <TableRow key={coin.coinSymbol}>
                                                    <TableCell className="font-medium">
                                                        {coin.coinSymbol}
                                                    </TableCell>
                                                    <TableCell>{coin.tradesCount}</TableCell>
                                                    <TableCell>{formatPercent(coin.winRate)}%</TableCell>
                                                    <TableCell
                                                        className={
                                                            coin.totalProfitUSD >= 0
                                                                ? 'text-green-500'
                                                                : 'text-red-500'
                                                        }
                                                    >
                                                        {coin.totalProfitUSD >= 0 ? '+' : ''}$
                                                        {formatCurrency(coin.totalProfitUSD)}
                                                    </TableCell>
                                                    <TableCell
                                                        className={
                                                            coin.avgProfitPercent >= 0
                                                                ? 'text-green-500'
                                                                : 'text-red-500'
                                                        }
                                                    >
                                                        {coin.avgProfitPercent >= 0 ? '+' : ''}
                                                        {formatPercent(coin.avgProfitPercent)}%
                                                    </TableCell>
                                                    <TableCell className="text-green-500">
                                                        {coin.bestTrade
                                                            ? `+$${formatCurrency(coin.bestTrade.profitUSD)}`
                                                            : '-'}
                                                    </TableCell>
                                                    <TableCell
                                                        className={
                                                            coin.worstTrade && coin.worstTrade.profitUSD < 0
                                                                ? 'text-red-500'
                                                                : 'text-green-500'
                                                        }
                                                    >
                                                        {coin.worstTrade
                                                            ? `${coin.worstTrade.profitUSD >= 0 ? '+' : ''}$${formatCurrency(coin.worstTrade.profitUSD)}`
                                                            : '-'}
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {/* Top Profitable and Losing Trades */}
                    <div className="grid gap-6 md:grid-cols-2">
                        {/* Top 5 Profitable Trades */}
                        {stats.topProfitableTrades.length > 0 && (
                            <Card>
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2">
                                        <TrendingUp className="h-5 w-5 text-green-500"/>
                                        Top 5 Profitable Trades
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="overflow-x-auto">
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead>Date</TableHead>
                                                    <TableHead>Coin</TableHead>
                                                    <TableHead>Entry</TableHead>
                                                    <TableHead>Exit</TableHead>
                                                    <TableHead>Profit %</TableHead>
                                                    <TableHead>Profit USD</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {stats.topProfitableTrades.map((trade) => (
                                                    <TableRow key={trade._id}>
                                                        <TableCell>
                                                            {trade.closeDate
                                                                ? formatDate(trade.closeDate.toString())
                                                                : '-'}
                                                        </TableCell>
                                                        <TableCell className="font-medium">
                                                            {trade.coinSymbol}
                                                        </TableCell>
                                                        <TableCell>${formatPrice(trade.entryPrice)}</TableCell>
                                                        <TableCell>
                                                            ${formatPrice(trade.exitPrice || 0)}
                                                        </TableCell>
                                                        <TableCell className="text-green-500">
                                                            +{formatPercent(trade.profitPercent)}%
                                                        </TableCell>
                                                        <TableCell className="text-green-500 font-medium">
                                                            +${formatCurrency(trade.profitUSD)}
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </div>
                                </CardContent>
                            </Card>
                        )}

                        {/* Top 5 Losing Trades */}
                        {stats.topLosingTrades.length > 0 && (
                            <Card>
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2">
                                        <TrendingDown className="h-5 w-5 text-red-500"/>
                                        Top 5 Losing Trades
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="overflow-x-auto">
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead>Date</TableHead>
                                                    <TableHead>Coin</TableHead>
                                                    <TableHead>Entry</TableHead>
                                                    <TableHead>Exit</TableHead>
                                                    <TableHead>Profit %</TableHead>
                                                    <TableHead>Profit USD</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {stats.topLosingTrades.map((trade) => (
                                                    <TableRow key={trade._id}>
                                                        <TableCell>
                                                            {trade.closeDate
                                                                ? formatDate(trade.closeDate.toString())
                                                                : '-'}
                                                        </TableCell>
                                                        <TableCell className="font-medium">
                                                            {trade.coinSymbol}
                                                        </TableCell>
                                                        <TableCell>${formatPrice(trade.entryPrice)}</TableCell>
                                                        <TableCell>
                                                            ${formatPrice(trade.exitPrice || 0)}
                                                        </TableCell>
                                                        <TableCell
                                                            className={
                                                                trade.profitPercent >= 0
                                                                    ? 'text-green-500'
                                                                    : 'text-red-500'
                                                            }
                                                        >
                                                            {trade.profitPercent >= 0 ? '+' : ''}
                                                            {formatPercent(trade.profitPercent)}%
                                                        </TableCell>
                                                        <TableCell
                                                            className={
                                                                trade.profitUSD >= 0
                                                                    ? 'text-green-500 font-medium'
                                                                    : 'text-red-500 font-medium'
                                                            }
                                                        >
                                                            {trade.profitUSD >= 0 ? '+' : ''}$
                                                            {formatCurrency(trade.profitUSD)}
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </div>
                                </CardContent>
                            </Card>
                        )}
                    </div>

                    {/* Cumulative Profit Chart */}
                    {stats.cumulativeProfit.length > 0 && (
                        <Card>
                            <CardHeader>
                                <CardTitle>Cumulative Profit Over Time</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <ResponsiveContainer width="100%" height={300}>
                                    <LineChart data={stats.cumulativeProfit}>
                                        <CartesianGrid strokeDasharray="3 3"/>
                                        <XAxis
                                            dataKey="date"
                                            tick={{fontSize: 12}}
                                            tickFormatter={(value) => {
                                                const date = new Date(value);
                                                return `${date.getMonth() + 1}/${date.getDate()}`;
                                            }}
                                        />
                                        <YAxis
                                            tick={{fontSize: 12}}
                                            tickFormatter={(value) => `$${value.toFixed(0)}`}
                                        />
                                        <Tooltip
                                            formatter={(value: number) => [
                                                `$${formatCurrency(value)}`,
                                                'Cumulative Profit',
                                            ]}
                                            labelFormatter={(label) => formatDate(label)}
                                        />
                                        <Line
                                            type="monotone"
                                            dataKey="profit"
                                            stroke={stats.totalProfitUSD >= 0 ? '#22c55e' : '#ef4444'}
                                            strokeWidth={2}
                                            dot={{r: 3}}
                                        />
                                    </LineChart>
                                </ResponsiveContainer>
                            </CardContent>
                        </Card>
                    )}
                </div>
            </main>
        </div>
    );
}
