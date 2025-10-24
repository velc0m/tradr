'use client';

import {useEffect, useMemo, useState} from 'react';
import {useSession} from 'next-auth/react';
import {redirect, useRouter} from 'next/navigation';
import Link from 'next/link';
import {Button} from '@/components/ui/button';
import {Card, CardContent, CardHeader, CardTitle} from '@/components/ui/card';
import {Table, TableBody, TableCell, TableHead, TableHeader, TableRow,} from '@/components/ui/table';
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from '@/components/ui/select';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {EditPortfolioModal} from '@/components/features/portfolios/EditPortfolioModal';
import {ExportPortfolioDialog} from '@/components/features/portfolios/ExportPortfolioDialog';
import {PortfolioOverviewCard} from '@/components/features/portfolios/PortfolioOverviewCard';
import {CoinAllocationCard} from '@/components/features/portfolios/CoinAllocationCard';
import {QuickStatsCard} from '@/components/features/portfolios/QuickStatsCard';
import {CreateTradeModal} from '@/components/features/trades/CreateTradeModal';
import {OpenTradesTable} from '@/components/features/trades/OpenTradesTable';
import {EditTradeDialog} from '@/components/features/trades/EditTradeDialog';
import {EditExitPriceModal} from '@/components/features/trades/EditExitPriceModal';
import {MarkAsFilledDialog} from '@/components/features/trades/MarkAsFilledDialog';
import {CloseTradeDialog} from '@/components/features/trades/CloseTradeDialog';
import {SplitTradeModal} from '@/components/features/trades/SplitTradeModal';
import {GroupedClosedTradeRow, TradeGroup} from '@/components/features/trades/GroupedClosedTradeRow';
import {useToast} from '@/components/ui/use-toast';
import {IPortfolio, ITrade, TradeStatus, TradeType} from '@/types';
import {
    ArrowDown,
    ArrowLeft,
    ArrowUp,
    BarChart3,
    Check,
    CornerDownRight,
    DollarSign,
    Download,
    Edit,
    Eye,
    EyeOff,
    Filter,
    MinusCircle,
    Pencil,
    Plus,
    Trash2,
    TrendingDown,
    X
} from 'lucide-react';
import {useBlur} from '@/contexts/BlurContext';
import {BlurredAmount} from '@/components/ui/BlurredAmount';

interface PortfolioPageProps {
    params: {
        id: string;
    };
}

export default function PortfolioPage({params}: PortfolioPageProps) {
    const {status} = useSession();
    const router = useRouter();
    const {isBlurred, toggleBlur} = useBlur();
    const [portfolio, setPortfolio] = useState<IPortfolio | null>(null);
    const [trades, setTrades] = useState<ITrade[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [quickStats, setQuickStats] = useState<{
        totalClosedTrades: number;
        totalProfitUSD: number;
        winRate: number;
    } | null>(null);
    const [showEditModal, setShowEditModal] = useState(false);
    const [showExportDialog, setShowExportDialog] = useState(false);
    const [showCreateTradeModal, setShowCreateTradeModal] = useState(false);
    const [createTradePrefilledData, setCreateTradePrefilledData] = useState<{
        coinSymbol?: string;
        tradeType?: TradeType;
        parentTradeId?: string;
        salePrice?: number;
        maxAmount?: number;
    } | undefined>(undefined);
    const [showEditTradeDialog, setShowEditTradeDialog] = useState(false);
    const [showEditExitPriceModal, setShowEditExitPriceModal] = useState(false);
    const [showMarkAsFilledDialog, setShowMarkAsFilledDialog] = useState(false);
    const [showCloseTradeDialog, setShowCloseTradeDialog] = useState(false);
    const [showSplitModal, setShowSplitModal] = useState(false);
    const [tradeToEdit, setTradeToEdit] = useState<ITrade | null>(null);
    const [tradeToFill, setTradeToFill] = useState<ITrade | null>(null);
    const [tradeToClose, setTradeToClose] = useState<ITrade | null>(null);
    const [tradeToSplit, setTradeToSplit] = useState<ITrade | null>(null);
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [deleteTradeDialogOpen, setDeleteTradeDialogOpen] = useState(false);
    const [tradeToDelete, setTradeToDelete] = useState<ITrade | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const [showFees, setShowFees] = useState(false);
    const [closedTradesFilter, setClosedTradesFilter] = useState<{
        coin: string;
        type: string;
        sortBy: 'closeDate' | 'filledDate' | 'none';
        sortOrder: 'asc' | 'desc';
    }>({
        coin: 'all',
        type: 'all',
        sortBy: 'closeDate',
        sortOrder: 'desc',
    });
    const {toast} = useToast();

    useEffect(() => {
        if (status === 'authenticated') {
            fetchPortfolio();
            fetchTrades();
            fetchQuickStats();
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
        setIsLoading(true);
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
        } finally {
            setIsLoading(false);
        }
    };

    const fetchTrades = async () => {
        try {
            const response = await fetch(`/api/portfolios/${params.id}/trades`);
            const data = await response.json();

            if (data.success && data.data) {
                setTrades(data.data);
            }
        } catch (error) {
            toast({
                title: 'Error',
                description: 'Failed to load trades',
                variant: 'destructive',
            });
        }
    };

    const fetchQuickStats = async () => {
        try {
            const response = await fetch(`/api/portfolios/${params.id}/stats`);
            const data = await response.json();

            if (data.success && data.data) {
                setQuickStats({
                    totalClosedTrades: data.data.totalTrades.closed,
                    totalProfitUSD: data.data.totalProfitUSD,
                    winRate: data.data.winRate,
                });
            }
        } catch (error) {
            // Silently fail - quick stats are not critical
            console.error('Failed to load quick stats:', error);
        }
    };

    const handlePortfolioUpdated = (updatedPortfolio: IPortfolio) => {
        setPortfolio(updatedPortfolio);
    };

    const handleTradeCreated = (trade: ITrade) => {
        setTrades([trade, ...trades]);
        // Refresh portfolio to update initialCoins if SHORT was created
        fetchPortfolio();
    };

    const handleOpenShort = (parentTrade: ITrade) => {
        setCreateTradePrefilledData({
            coinSymbol: parentTrade.coinSymbol,
            tradeType: TradeType.SHORT,
            parentTradeId: parentTrade._id,
            salePrice: parentTrade.exitPrice,
            maxAmount: parentTrade.amount,
        });
        setShowCreateTradeModal(true);
    };

    const handleTradeUpdated = (updatedTrade: ITrade) => {
        // If SHORT was closed, reload all trades to update parent LONG
        if (updatedTrade.tradeType === TradeType.SHORT &&
            updatedTrade.status === TradeStatus.CLOSED &&
            updatedTrade.parentTradeId) {
            fetchTrades();
            fetchQuickStats();
            return;
        }

        const newTrades = trades.map((t) => (t._id === updatedTrade._id ? updatedTrade : t));
        setTrades(newTrades);

        // If trade was closed, update Quick Stats
        if (updatedTrade.status === TradeStatus.CLOSED) {
            fetchQuickStats();
        }
    };


    const handleDeleteTrade = async () => {
        if (!tradeToDelete) return;

        setIsDeleting(true);
        try {
            const response = await fetch(`/api/trades/${tradeToDelete._id}`, {
                method: 'DELETE',
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to delete trade');
            }

            toast({
                title: 'Success',
                description: 'Trade deleted successfully',
            });

            // If deleting SHORT with parent, reload all trades to update parent LONG
            if (tradeToDelete.tradeType === TradeType.SHORT && tradeToDelete.parentTradeId) {
                fetchTrades();
            } else {
                setTrades(trades.filter((t) => t._id !== tradeToDelete._id));
            }

            setDeleteTradeDialogOpen(false);
            setTradeToDelete(null);
        } catch (error) {
            toast({
                title: 'Error',
                description:
                    error instanceof Error ? error.message : 'Failed to delete trade',
                variant: 'destructive',
            });
        } finally {
            setIsDeleting(false);
        }
    };

    const handleDeletePortfolio = async () => {
        setIsDeleting(true);
        try {
            const response = await fetch(`/api/portfolios/${params.id}`, {
                method: 'DELETE',
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to delete portfolio');
            }

            toast({
                title: 'Success',
                description: 'Portfolio deleted successfully',
            });

            router.push('/dashboard');
        } catch (error) {
            toast({
                title: 'Error',
                description:
                    error instanceof Error ? error.message : 'Failed to delete portfolio',
                variant: 'destructive',
            });
        } finally {
            setIsDeleting(false);
            setDeleteDialogOpen(false);
        }
    };

    const calculateProfitPercent = (trade: ITrade): number | null => {
        if (!trade.exitPrice) return null;

        if (trade.tradeType === TradeType.SHORT) {
            // SHORT: profit % based on coins gained
            const entryFeeVal = trade.entryFee || 0;
            const netReceived = trade.sumPlusFee * (100 - entryFeeVal) / 100;
            const exitFeeVal = trade.exitFee || 0;
            const buyBackPriceWithFee = trade.exitPrice * (100 + exitFeeVal) / 100;
            const coinsBoughtBack = netReceived / buyBackPriceWithFee;
            return ((coinsBoughtBack / trade.amount - 1) * 100);
        }

        // LONG: profit % based on price change minus fees
        return (
            ((trade.exitPrice / trade.entryPrice - 1) * 100) -
            trade.entryFee -
            (trade.exitFee || 0)
        );
    };

    // Calculate Profit USD (LONG only)
    const calculateProfitUSD = (trade: ITrade): number | null => {
        if (!trade.exitPrice || trade.tradeType === TradeType.LONG) {
            if (!trade.exitPrice) return null;
            const exitValue = trade.amount * trade.exitPrice * (100 - (trade.exitFee || 0)) / 100;
            return exitValue - trade.sumPlusFee;
        }
        return null;
    };

    // Calculate Profit Coins (SHORT only)
    const calculateProfitCoins = (trade: ITrade): number | null => {
        if (!trade.exitPrice || trade.tradeType !== TradeType.SHORT) return null;

        const entryFeeVal = trade.entryFee || 0;
        const netReceived = trade.sumPlusFee * (100 - entryFeeVal) / 100;
        const exitFeeVal = trade.exitFee || 0;
        const buyBackPriceWithFee = trade.exitPrice * (100 + exitFeeVal) / 100;
        const coinsBoughtBack = netReceived / buyBackPriceWithFee;

        return coinsBoughtBack - trade.amount;
    };

    const formatPrice = (price: number): string => {
        // Format USD prices with 2 decimal places
        const formatted = price.toFixed(2);
        const trimmed = formatted.replace(/\.?0+$/, '');
        return trimmed;
    };

    const formatAmount = (amount: number): string => {
        // Show crypto amounts with max 8 decimal places (Bitcoin standard)
        // Remove trailing zeros
        const formatted = amount.toFixed(8);
        const trimmed = formatted.replace(/\.?0+$/, '');
        return trimmed;
    };

    // Check if LONG trade has active SHORT positions
    const hasActiveShortsOnLong = (longTradeId: string): boolean => {
        return trades.some(
            (t) =>
                t.tradeType === TradeType.SHORT &&
                t.parentTradeId === longTradeId &&
                t.status !== TradeStatus.CLOSED
        );
    };

    const getStatusBadge = (status: TradeStatus) => {
        switch (status) {
            case TradeStatus.OPEN:
                return (
                    <span className="text-xs bg-gray-500/20 text-gray-400 px-2 py-1 rounded">
            Open
          </span>
                );
            case TradeStatus.FILLED:
                return (
                    <span className="text-xs bg-green-500/20 text-green-400 px-2 py-1 rounded">
            Filled
          </span>
                );
            case TradeStatus.CLOSED:
                return (
                    <span className="text-xs bg-red-500/20 text-red-400 px-2 py-1 rounded">
            Closed
          </span>
                );
        }
    };

    const openTrades = trades.filter(
        (t) => t.status === TradeStatus.OPEN || t.status === TradeStatus.FILLED
    );
    const closedTrades = trades.filter((t) => t.status === TradeStatus.CLOSED && !t.isSplit);

    // Get unique coins from closed trades for filter
    const uniqueCoins = useMemo(() => {
        const coins = new Set(closedTrades.map(t => t.coinSymbol));
        return Array.from(coins).sort();
    }, [closedTrades]);

    // Group open trades: LONG with their SHORT children, and split positions
    const groupedOpenTrades = useMemo(() => {
        const grouped: Array<{
            parent: ITrade;
            children: ITrade[];
            splitSiblings?: ITrade[]; // Other trades from the same split
            splitInfo?: { part: number; total: number }; // Part X of Y
        }> = [];
        const processedIds = new Set<string>();

        // First, group split positions by splitGroupId
        const splitGroups = new Map<string, ITrade[]>();
        openTrades.forEach(trade => {
            if (trade.splitGroupId) {
                if (!splitGroups.has(trade.splitGroupId)) {
                    splitGroups.set(trade.splitGroupId, []);
                }
                splitGroups.get(trade.splitGroupId)!.push(trade);
            }
        });

        // Sort each split group by creation time (newest first)
        splitGroups.forEach((trades) => {
            trades.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        });

        // Now process trades
        const longTrades = openTrades.filter(t => t.tradeType === TradeType.LONG);

        longTrades.forEach(longTrade => {
            // Find SHORT trades that reference this LONG as parent
            const shortChildren = openTrades.filter(
                t => t.tradeType === TradeType.SHORT && t.parentTradeId === longTrade._id
            );

            // Check if this trade is part of a split group
            const splitSiblings = longTrade.splitGroupId
                ? (splitGroups.get(longTrade.splitGroupId) || []).filter(t => t._id !== longTrade._id)
                : [];

            const splitInfo = longTrade.splitGroupId && splitGroups.has(longTrade.splitGroupId)
                ? {
                    part: splitGroups.get(longTrade.splitGroupId)!.findIndex(t => t._id === longTrade._id) + 1,
                    total: splitGroups.get(longTrade.splitGroupId)!.length,
                }
                : undefined;

            grouped.push({
                parent: longTrade,
                children: shortChildren,
                splitSiblings: splitSiblings.length > 0 ? splitSiblings : undefined,
                splitInfo,
            });

            // Mark all as processed
            processedIds.add(longTrade._id);
            shortChildren.forEach(child => processedIds.add(child._id));
        });

        // Add standalone SHORT trades (from initialCoins, not from LONG)
        openTrades.forEach(trade => {
            if (trade.tradeType === TradeType.SHORT && !processedIds.has(trade._id)) {
                const splitSiblings = trade.splitGroupId
                    ? (splitGroups.get(trade.splitGroupId) || []).filter(t => t._id !== trade._id)
                    : [];

                const splitInfo = trade.splitGroupId && splitGroups.has(trade.splitGroupId)
                    ? {
                        part: splitGroups.get(trade.splitGroupId)!.findIndex(t => t._id === trade._id) + 1,
                        total: splitGroups.get(trade.splitGroupId)!.length,
                    }
                    : undefined;

                grouped.push({
                    parent: trade,
                    children: [],
                    splitSiblings: splitSiblings.length > 0 ? splitSiblings : undefined,
                    splitInfo,
                });
                processedIds.add(trade._id);
            }
        });

        return grouped;
    }, [openTrades]);

    // Group closed trades - simple grouping, no partial close logic
    const groupedClosedTrades = useMemo(() => {
        let filtered = [...closedTrades];

        // Apply filters
        if (closedTradesFilter.coin !== 'all') {
            filtered = filtered.filter(t => t.coinSymbol === closedTradesFilter.coin);
        }
        if (closedTradesFilter.type !== 'all') {
            filtered = filtered.filter(t => t.tradeType === closedTradesFilter.type);
        }

        // Apply sorting
        if (closedTradesFilter.sortBy !== 'none') {
            filtered.sort((a, b) => {
                const dateA = closedTradesFilter.sortBy === 'closeDate'
                    ? (a.closeDate ? new Date(a.closeDate).getTime() : 0)
                    : (a.filledDate ? new Date(a.filledDate).getTime() : 0);
                const dateB = closedTradesFilter.sortBy === 'closeDate'
                    ? (b.closeDate ? new Date(b.closeDate).getTime() : 0)
                    : (b.filledDate ? new Date(b.filledDate).getTime() : 0);

                return closedTradesFilter.sortOrder === 'asc' ? dateA - dateB : dateB - dateA;
            });
        }

        const groups: TradeGroup[] = [];

        // Each closed trade is shown as a separate "full" trade
        filtered.forEach((trade) => {
            groups.push({
                type: 'full',
                mainTrade: trade,
                parts: [],
            });
        });

        return groups;
    }, [closedTrades, closedTradesFilter]);

    if (isLoading) {
        return (
            <div className="min-h-screen bg-background">
                <main className="container mx-auto px-4 py-8">
                    <div className="text-center py-12 text-muted-foreground">
                        Loading portfolio...
                    </div>
                </main>
            </div>
        );
    }

    if (!portfolio) {
        return (
            <div className="min-h-screen bg-background">
                <main className="container mx-auto px-4 py-8">
                    <div className="text-center py-12 text-muted-foreground">
                        Portfolio not found
                    </div>
                </main>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background">
            <main className="container mx-auto px-4 py-8">
                <div className="space-y-6">
                    <div className="flex items-center gap-4">
                        <Link href="/dashboard">
                            <Button variant="ghost" size="icon">
                                <ArrowLeft className="h-5 w-5"/>
                            </Button>
                        </Link>
                        <div className="flex-1">
                            <h1 className="text-3xl font-bold">{portfolio.name}</h1>
                            <p className="text-muted-foreground mt-1">Portfolio details</p>
                        </div>
                        <div className="flex gap-2">
                            <Button
                                variant="outline"
                                size="icon"
                                onClick={toggleBlur}
                                title={isBlurred ? 'Show amounts' : 'Hide amounts'}
                            >
                                {isBlurred ? <EyeOff className="h-4 w-4"/> : <Eye className="h-4 w-4"/>}
                            </Button>
                            <Button variant="outline" onClick={() => setShowExportDialog(true)}>
                                <Download className="h-4 w-4 mr-2"/>
                                Export
                            </Button>
                            <Button variant="outline" onClick={() => setShowEditModal(true)}>
                                <Edit className="h-4 w-4 mr-2"/>
                                Edit
                            </Button>
                            <Button variant="destructive" onClick={() => setDeleteDialogOpen(true)}>
                                <Trash2 className="h-4 w-4 mr-2"/>
                                Delete
                            </Button>
                        </div>
                    </div>

                    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                        <PortfolioOverviewCard portfolio={portfolio} formatAmount={formatAmount} />

                        <CoinAllocationCard portfolio={portfolio} openTrades={openTrades} formatAmount={formatAmount} />

                        <QuickStatsCard quickStats={quickStats} portfolioId={params.id} />
                    </div>

                    <OpenTradesTable
                        groupedOpenTrades={groupedOpenTrades}
                        onCreateTrade={() => setShowCreateTradeModal(true)}
                        onEditTrade={(trade) => {
                            setTradeToEdit(trade);
                            setShowEditTradeDialog(true);
                        }}
                        onFillTrade={(trade) => {
                            setTradeToFill(trade);
                            setShowMarkAsFilledDialog(true);
                        }}
                        onDeleteTrade={(trade) => {
                            setTradeToDelete(trade);
                            setDeleteTradeDialogOpen(true);
                        }}
                        onSetExitPrice={(trade) => {
                            setTradeToEdit(trade);
                            setShowEditExitPriceModal(true);
                        }}
                        onSplitTrade={(trade) => {
                            setTradeToSplit(trade);
                            setShowSplitModal(true);
                        }}
                        onOpenShort={handleOpenShort}
                        onCloseTrade={(trade) => {
                            setTradeToClose(trade);
                            setShowCloseTradeDialog(true);
                        }}
                        formatPrice={formatPrice}
                        formatAmount={formatAmount}
                        calculateProfitPercent={calculateProfitPercent}
                        calculateProfitUSD={calculateProfitUSD}
                        calculateProfitCoins={calculateProfitCoins}
                        hasActiveShortsOnLong={hasActiveShortsOnLong}
                        getStatusBadge={getStatusBadge}
                    />

                    <Card>
                        <CardHeader>
                            <div className="flex justify-between items-center">
                                <CardTitle>Closed Trades</CardTitle>
                                {closedTrades.length > 0 && (
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setShowFees(!showFees)}
                                    >
                                        <DollarSign className="h-4 w-4 mr-2"/>
                                        {showFees ? 'Hide Fees' : 'Show Fees'}
                                    </Button>
                                )}
                            </div>
                        </CardHeader>
                        <CardContent>
                            {closedTrades.length === 0 ? (
                                <div className="text-center py-12 text-muted-foreground">
                                    No closed trades yet.
                                </div>
                            ) : (
                                <>
                                    {/* Filters and Sorting */}
                                    <div className="flex flex-wrap gap-3 mb-4 items-center">
                                        <div className="flex items-center gap-2">
                                            <Filter className="h-4 w-4 text-muted-foreground"/>
                                            <span className="text-sm text-muted-foreground">Filters:</span>
                                        </div>

                                        {/* Coin Filter */}
                                        <Select
                                            value={closedTradesFilter.coin}
                                            onValueChange={(value) =>
                                                setClosedTradesFilter({...closedTradesFilter, coin: value})
                                            }
                                        >
                                            <SelectTrigger className="w-[120px]">
                                                <SelectValue placeholder="Coin"/>
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="all">All Coins</SelectItem>
                                                {uniqueCoins.map((coin) => (
                                                    <SelectItem key={coin} value={coin}>
                                                        {coin}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>

                                        {/* Type Filter */}
                                        <Select
                                            value={closedTradesFilter.type}
                                            onValueChange={(value) =>
                                                setClosedTradesFilter({...closedTradesFilter, type: value})
                                            }
                                        >
                                            <SelectTrigger className="w-[120px]">
                                                <SelectValue placeholder="Type"/>
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="all">All Types</SelectItem>
                                                <SelectItem value={TradeType.LONG}>LONG</SelectItem>
                                                <SelectItem value={TradeType.SHORT}>SHORT</SelectItem>
                                            </SelectContent>
                                        </Select>

                                        {/* Sort By */}
                                        <Select
                                            value={closedTradesFilter.sortBy}
                                            onValueChange={(value: 'closeDate' | 'filledDate' | 'none') =>
                                                setClosedTradesFilter({...closedTradesFilter, sortBy: value})
                                            }
                                        >
                                            <SelectTrigger className="w-[150px]">
                                                <SelectValue placeholder="Sort by"/>
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="none">No Sort</SelectItem>
                                                <SelectItem value="closeDate">Close Date</SelectItem>
                                                <SelectItem value="filledDate">Filled Date</SelectItem>
                                            </SelectContent>
                                        </Select>

                                        {/* Sort Order */}
                                        {closedTradesFilter.sortBy !== 'none' && (
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() =>
                                                    setClosedTradesFilter({
                                                        ...closedTradesFilter,
                                                        sortOrder: closedTradesFilter.sortOrder === 'asc' ? 'desc' : 'asc',
                                                    })
                                                }
                                            >
                                                {closedTradesFilter.sortOrder === 'asc' ? (
                                                    <ArrowUp className="h-4 w-4"/>
                                                ) : (
                                                    <ArrowDown className="h-4 w-4"/>
                                                )}
                                            </Button>
                                        )}

                                        {/* Clear Filters */}
                                        {(closedTradesFilter.coin !== 'all' ||
                                            closedTradesFilter.type !== 'all' ||
                                            closedTradesFilter.sortBy !== 'closeDate') && (
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() =>
                                                    setClosedTradesFilter({
                                                        coin: 'all',
                                                        type: 'all',
                                                        sortBy: 'closeDate',
                                                        sortOrder: 'desc',
                                                    })
                                                }
                                            >
                                                <X className="h-4 w-4 mr-1"/>
                                                Clear
                                            </Button>
                                        )}

                                        <div className="ml-auto text-sm text-muted-foreground">
                                            Showing {groupedClosedTrades.length} of {closedTrades.length} trades
                                        </div>
                                    </div>
                                </>
                            )}

                            {groupedClosedTrades.length > 0 && (
                                <div className="overflow-x-auto">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead className="min-w-[80px]">Coin</TableHead>
                                                <TableHead className="min-w-[180px]">Type</TableHead>
                                                <TableHead className="min-w-[70px]">Status</TableHead>
                                                <TableHead className="min-w-[90px]">Entry Price</TableHead>
                                                <TableHead className="min-w-[90px]"
                                                           title="Original entry price before averaging">Initial
                                                    Entry</TableHead>
                                                <TableHead className="min-w-[90px]">Sum+Fee</TableHead>
                                                <TableHead className="min-w-[110px]">Amount</TableHead>
                                                <TableHead className="min-w-[90px]">Exit Price</TableHead>
                                                <TableHead className="min-w-[80px]">Profit %</TableHead>
                                                <TableHead className="min-w-[120px]">Profit</TableHead>
                                                <TableHead className="min-w-[100px]">Filled Date</TableHead>
                                                <TableHead className="min-w-[100px]">Close Date</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {groupedClosedTrades.map((group, index) => (
                                                <GroupedClosedTradeRow
                                                    key={group.mainTrade._id + '-' + index}
                                                    group={group}
                                                    showFees={showFees}
                                                />
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </main>

            {portfolio && (
                <>
                    <EditPortfolioModal
                        open={showEditModal}
                        onOpenChange={setShowEditModal}
                        portfolio={portfolio}
                        onSuccess={handlePortfolioUpdated}
                    />
                    <ExportPortfolioDialog
                        open={showExportDialog}
                        onOpenChange={setShowExportDialog}
                        portfolioId={params.id}
                        portfolioName={portfolio.name}
                    />
                    <CreateTradeModal
                        open={showCreateTradeModal}
                        onOpenChange={(open) => {
                            setShowCreateTradeModal(open);
                            if (!open) {
                                // Clear prefilled data when modal closes
                                setCreateTradePrefilledData(undefined);
                            }
                        }}
                        portfolio={portfolio}
                        onSuccess={handleTradeCreated}
                        prefilledData={createTradePrefilledData}
                    />
                </>
            )}

            <EditTradeDialog
                open={showEditTradeDialog}
                onOpenChange={setShowEditTradeDialog}
                trade={tradeToEdit}
                onSuccess={handleTradeUpdated}
            />

            {tradeToEdit && (
                <EditExitPriceModal
                    open={showEditExitPriceModal}
                    onOpenChange={setShowEditExitPriceModal}
                    trade={tradeToEdit}
                    onSuccess={handleTradeUpdated}
                />
            )}

            <MarkAsFilledDialog
                open={showMarkAsFilledDialog}
                onOpenChange={setShowMarkAsFilledDialog}
                trade={tradeToFill}
                onSuccess={handleTradeUpdated}
            />

            <CloseTradeDialog
                open={showCloseTradeDialog}
                onOpenChange={setShowCloseTradeDialog}
                trade={tradeToClose}
                onSuccess={handleTradeUpdated}
            />

            <SplitTradeModal
                open={showSplitModal}
                onOpenChange={setShowSplitModal}
                trade={tradeToSplit}
                onSuccess={() => {
                    fetchTrades();
                }}
            />

            <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will permanently delete the portfolio{' '}
                            <span className="font-semibold">{portfolio.name}</span> and all
                            associated trades. This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleDeletePortfolio}
                            disabled={isDeleting}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            {isDeleting ? 'Deleting...' : 'Delete'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <AlertDialog open={deleteTradeDialogOpen} onOpenChange={setDeleteTradeDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will permanently delete this trade. This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleDeleteTrade}
                            disabled={isDeleting}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            {isDeleting ? 'Deleting...' : 'Delete'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
