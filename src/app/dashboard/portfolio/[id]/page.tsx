'use client';

import {useEffect, useMemo, useState} from 'react';
import {useSession} from 'next-auth/react';
import {redirect, useRouter} from 'next/navigation';
import Link from 'next/link';
import {Button} from '@/components/ui/button';
import {Card, CardContent, CardHeader, CardTitle} from '@/components/ui/card';
import {Table, TableBody, TableCell, TableHead, TableHeader, TableRow,} from '@/components/ui/table';
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
import {CreateTradeModal} from '@/components/features/trades/CreateTradeModal';
import {EditTradeDialog} from '@/components/features/trades/EditTradeDialog';
import {EditExitPriceModal} from '@/components/features/trades/EditExitPriceModal';
import {MarkAsFilledDialog} from '@/components/features/trades/MarkAsFilledDialog';
import {CloseTradeDialog} from '@/components/features/trades/CloseTradeDialog';
import {SplitTradeModal} from '@/components/features/trades/SplitTradeModal';
import {GroupedClosedTradeRow, TradeGroup} from '@/components/features/trades/GroupedClosedTradeRow';
import {useToast} from '@/components/ui/use-toast';
import {IPortfolio, ITrade, TradeStatus, TradeType} from '@/types';
import {
    ArrowLeft,
    BarChart3,
    Check,
    CornerDownRight,
    DollarSign,
    Download,
    Edit,
    Eye,
    EyeOff,
    MinusCircle,
    Pencil,
    Plus,
    Trash2,
    TrendingDown
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
        const groups: TradeGroup[] = [];

        // Each closed trade is shown as a separate "full" trade
        closedTrades.forEach((trade) => {
            groups.push({
                type: 'full',
                mainTrade: trade,
                parts: [],
            });
        });

        return groups;
    }, [closedTrades]);

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
                        <Card>
                            <CardHeader>
                                <CardTitle>Portfolio Overview</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div>
                                    <div className="text-sm text-muted-foreground">
                                        Cash Deposit (USD)
                                    </div>
                                    <div className="text-3xl font-bold">
                                        <BlurredAmount amount={portfolio.totalDeposit}/>
                                    </div>
                                </div>
                                {portfolio.initialCoins && portfolio.initialCoins.length > 0 && (
                                    <div className="pt-2 border-t">
                                        <div className="text-sm text-muted-foreground mb-2">
                                            Initial Coins
                                        </div>
                                        <div className="space-y-1">
                                            {portfolio.initialCoins.map((coin, idx) => (
                                                <div key={idx} className="text-sm font-medium text-blue-400">
                                                    {formatAmount(coin.amount)} {coin.symbol}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                                <div className="pt-2 border-t">
                                    <div className="text-sm text-muted-foreground mb-2">
                                        Created
                                    </div>
                                    <div className="text-sm">
                                        {new Date(portfolio.createdAt).toLocaleDateString('en-US', {
                                            year: 'numeric',
                                            month: 'long',
                                            day: 'numeric',
                                        })}
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle>Coin Allocation</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-3">
                                    {portfolio.coins.map((coin, index) => {
                                        // Allocation based on cash deposit only
                                        const allocation = (portfolio.totalDeposit * coin.percentage) / 100;

                                        // Initial coins for THIS specific coin (in amount, not value)
                                        const initialCoinForSymbol = portfolio.initialCoins?.find(ic => ic.symbol === coin.symbol);
                                        const initialCoinAmount = initialCoinForSymbol?.amount || 0;

                                        // Calculate used amount from open/filled trades
                                        const coinOpenTrades = openTrades.filter(t => t.coinSymbol === coin.symbol);
                                        const usedInTrades = coinOpenTrades.reduce((sum, trade) => sum + trade.sumPlusFee, 0);

                                        const usedPercent = allocation > 0 ? (usedInTrades / allocation) * 100 : 0;
                                        const availablePercent = 100 - usedPercent;
                                        const availableAmount = allocation - usedInTrades;

                                        return (
                                            <div
                                                key={index}
                                                className="p-3 rounded-lg bg-muted/50 space-y-2"
                                            >
                                                <div className="flex justify-between items-center">
                                                    <div>
                                                        <div className="font-semibold">{coin.symbol}</div>
                                                        <div className="text-sm text-muted-foreground">
                                                            {coin.percentage}% allocation
                                                        </div>
                                                    </div>
                                                    <div className="text-right">
                                                        <div className="font-medium">
                                                            <BlurredAmount amount={allocation}/>
                                                        </div>
                                                        <div className="text-xs text-muted-foreground">
                                                            {coin.decimalPlaces} decimal places
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="space-y-1">
                                                    {initialCoinAmount > 0 && (
                                                        <div className="flex items-center justify-between text-xs">
                                                            <span className="text-blue-400">Initial coins:</span>
                                                            <span className="text-blue-400">
                                {formatAmount(initialCoinAmount)} {coin.symbol}
                              </span>
                                                        </div>
                                                    )}
                                                    {usedInTrades > 0 && (
                                                        <div className="flex items-center justify-between text-xs">
                                                            <span
                                                                className="text-muted-foreground">In open trades:</span>
                                                            <span className="text-muted-foreground">
                                <BlurredAmount amount={usedInTrades}/>
                              </span>
                                                        </div>
                                                    )}
                                                    <div
                                                        className="flex items-center justify-between text-xs font-medium pt-1 border-t border-muted">
                            <span className={availablePercent < 0 ? 'text-red-500' : 'text-green-500'}>
                              Available: {availablePercent.toFixed(1)}%
                            </span>
                                                        <span
                                                            className={availablePercent < 0 ? 'text-red-500' : 'text-green-500'}>
                              <BlurredAmount amount={availableAmount} showSign={true}/>
                            </span>
                                                    </div>
                                                    <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                                                        <div
                                                            className={`h-full transition-all ${
                                                                usedPercent > 100 ? 'bg-red-500' :
                                                                    usedPercent > 80 ? 'bg-yellow-500' :
                                                                        'bg-green-500'
                                                            }`}
                                                            style={{width: `${Math.min(usedPercent, 100)}%`}}
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <BarChart3 className="h-5 w-5"/>
                                    Quick Stats
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {quickStats ? (
                                    <>
                                        <div>
                                            <div className="text-sm text-muted-foreground mb-2">
                                                Total Closed Trades
                                            </div>
                                            <div className="text-2xl font-bold">{quickStats.totalClosedTrades}</div>
                                        </div>
                                        <div>
                                            <div className="text-sm text-muted-foreground mb-2">
                                                Overall P/L
                                            </div>
                                            <div
                                                className={`text-2xl font-bold ${quickStats.totalProfitUSD >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                                                <BlurredAmount
                                                    amount={quickStats.totalProfitUSD}
                                                    showSign={true}
                                                />
                                            </div>
                                        </div>
                                        <div>
                                            <div className="text-sm text-muted-foreground mb-2">
                                                Win Rate
                                            </div>
                                            <div className="text-2xl font-bold">{quickStats.winRate.toFixed(2)}%</div>
                                        </div>
                                    </>
                                ) : (
                                    <div className="text-sm text-muted-foreground">Loading stats...</div>
                                )}
                                <Link href={`/dashboard/portfolio/${params.id}/stats`}>
                                    <Button className="w-full mt-2" variant="outline">
                                        <BarChart3 className="h-4 w-4 mr-2"/>
                                        View Detailed Statistics
                                    </Button>
                                </Link>
                            </CardContent>
                        </Card>
                    </div>

                    <Card>
                        <CardHeader>
                            <div className="flex justify-between items-center">
                                <CardTitle>Open Trades</CardTitle>
                                <Button onClick={() => setShowCreateTradeModal(true)}>
                                    <Plus className="h-4 w-4 mr-2"/>
                                    Add Trade
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent>
                            {openTrades.length === 0 ? (
                                <div className="text-center py-12 text-muted-foreground">
                                    No open trades. Click "Add Trade" to create one.
                                </div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead className="min-w-[60px]">Coin</TableHead>
                                                <TableHead className="min-w-[70px]">Status</TableHead>
                                                <TableHead className="min-w-[100px]">Date</TableHead>
                                                <TableHead className="min-w-[90px]">Entry Price</TableHead>
                                                <TableHead className="min-w-[90px]">Sum+Fee</TableHead>
                                                <TableHead className="min-w-[110px]">Amount</TableHead>
                                                <TableHead className="min-w-[90px]">Exit Price</TableHead>
                                                <TableHead className="min-w-[80px]">Profit %</TableHead>
                                                <TableHead className="min-w-[120px]">Profit</TableHead>
                                                <TableHead className="text-right min-w-[150px]">Actions</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {groupedOpenTrades.map((group) => {
                                                const renderTradeRow = (trade: ITrade, isChild: boolean = false, splitInfo?: {
                                                    part: number;
                                                    total: number
                                                }) => {
                                                    const profitPercent = calculateProfitPercent(trade);
                                                    const profitUSD = calculateProfitUSD(trade);
                                                    const profitCoins = calculateProfitCoins(trade);
                                                    const isLongWithActiveShorts = trade.tradeType === TradeType.LONG && hasActiveShortsOnLong(trade._id);

                                                    return (
                                                        <TableRow
                                                            key={trade._id}
                                                            className={`${isChild ? 'bg-muted/30' : ''} ${isLongWithActiveShorts ? 'opacity-50' : ''}`}
                                                        >
                                                            <TableCell className="font-medium">
                                                                <div className="flex items-center gap-2">
                                                                    {isChild && (
                                                                        <CornerDownRight
                                                                            className="h-4 w-4 text-muted-foreground"/>
                                                                    )}
                                                                    <div>
                                                                        <div className="flex flex-col gap-1">
                                                                            <div
                                                                                className="flex items-center gap-1.5 flex-wrap">
                                                                                <span>{trade.coinSymbol}</span>
                                                                                {trade.tradeType === TradeType.SHORT ? (
                                                                                    <>
                                          <span
                                              className="text-xs bg-orange-500/20 text-orange-400 px-1.5 py-0.5 rounded whitespace-nowrap">
                                            SHORT
                                          </span>
                                                                                        {trade.isAveragingShort && (
                                                                                            <span
                                                                                                className="text-xs bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded whitespace-nowrap"
                                                                                                title="Averaging operation - excluded from USD statistics">
                                              AVERAGING
                                            </span>
                                                                                        )}
                                                                                    </>
                                                                                ) : (
                                                                                    <>
                                          <span
                                              className="text-xs bg-green-500/20 text-green-400 px-1.5 py-0.5 rounded whitespace-nowrap">
                                            LONG
                                          </span>
                                                                                        {isLongWithActiveShorts && (
                                                                                            <span
                                                                                                className="text-xs bg-yellow-500/20 text-yellow-400 px-1.5 py-0.5 rounded whitespace-nowrap"
                                                                                                title="Has active SHORT positions">
                                          🔒 Locked
                                        </span>
                                                                                        )}
                                                                                    </>
                                                                                )}
                                                                            </div>
                                                                            <div
                                                                                className="flex items-center gap-1.5 flex-wrap">
                                                                                {trade.tradeType === TradeType.LONG && trade.initialAmount && trade.amount > trade.initialAmount && (
                                                                                    <span
                                                                                        className="text-xs bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded whitespace-nowrap"
                                                                                        title="Position was averaged down through SHORT averaging operation">
                                          AVERAGED ↓
                                        </span>
                                                                                )}
                                                                                {splitInfo && (
                                                                                    <span
                                                                                        className="text-xs bg-purple-500/20 text-purple-400 px-1.5 py-0.5 rounded whitespace-nowrap">
                                          Split {splitInfo.part}/{splitInfo.total}
                                        </span>
                                                                                )}
                                                                            </div>
                                                                        </div>
                                                                        {isChild && (
                                                                            <div
                                                                                className="text-xs text-muted-foreground mt-0.5">
                                                                                ↳ SHORT for parent LONG
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            </TableCell>
                                                            <TableCell>
                                                                {getStatusBadge(trade.status)}
                                                            </TableCell>
                                                            <TableCell>
                                                                {trade.status === TradeStatus.OPEN ? (
                                                                    trade.openDate ? (
                                                                        new Date(trade.openDate).toLocaleDateString('en-US', {
                                                                            year: 'numeric',
                                                                            month: 'short',
                                                                            day: 'numeric',
                                                                        })
                                                                    ) : '-'
                                                                ) : trade.status === TradeStatus.FILLED ? (
                                                                    trade.filledDate ? (
                                                                        new Date(trade.filledDate).toLocaleDateString('en-US', {
                                                                            year: 'numeric',
                                                                            month: 'short',
                                                                            day: 'numeric',
                                                                        })
                                                                    ) : '-'
                                                                ) : '-'}
                                                            </TableCell>
                                                            <TableCell>${formatPrice(trade.entryPrice)}</TableCell>
                                                            <TableCell><BlurredAmount
                                                                amount={trade.sumPlusFee}/></TableCell>
                                                            <TableCell>
                                                                {formatAmount(trade.amount)}
                                                            </TableCell>
                                                            <TableCell>
                                                                {trade.exitPrice ? `$${formatPrice(trade.exitPrice)}` : '-'}
                                                            </TableCell>
                                                            <TableCell>
                                                                {profitPercent !== null ? (
                                                                    <span
                                                                        className={profitPercent >= 0 ? 'text-green-500' : 'text-red-500'}>
                                  {profitPercent >= 0 ? '+' : ''}{profitPercent.toFixed(2)}%
                                </span>
                                                                ) : (
                                                                    '-'
                                                                )}
                                                            </TableCell>
                                                            <TableCell>
                                                                {trade.tradeType === TradeType.SHORT && profitCoins !== null ? (
                                                                    <span
                                                                        className={profitCoins >= 0 ? 'text-green-500' : 'text-red-500'}>
                                  {profitCoins >= 0 ? '+' : ''}{profitCoins.toFixed(8)} {trade.coinSymbol}
                                </span>
                                                                ) : profitUSD !== null ? (
                                                                    <span
                                                                        className={profitUSD >= 0 ? 'text-green-500' : 'text-red-500'}>
                                  <BlurredAmount amount={profitUSD} showSign={true}/>
                                </span>
                                                                ) : (
                                                                    '-'
                                                                )}
                                                            </TableCell>
                                                            <TableCell className="text-right">
                                                                <div className="flex justify-end gap-1">
                                                                    {/* Edit button - available for open and filled trades */}
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="sm"
                                                                        onClick={() => {
                                                                            setTradeToEdit(trade);
                                                                            setShowEditTradeDialog(true);
                                                                        }}
                                                                        title={isLongWithActiveShorts ? "Locked: Close all SHORT positions first" : "Edit Trade"}
                                                                        disabled={isLongWithActiveShorts}
                                                                    >
                                                                        <Pencil className="h-4 w-4"/>
                                                                    </Button>
                                                                    {trade.status === TradeStatus.OPEN && (
                                                                        <>
                                                                            <Button
                                                                                variant="ghost"
                                                                                size="sm"
                                                                                onClick={() => {
                                                                                    setTradeToFill(trade);
                                                                                    setShowMarkAsFilledDialog(true);
                                                                                }}
                                                                                title={isLongWithActiveShorts ? "Locked: Close all SHORT positions first" : "Mark as Filled"}
                                                                                disabled={isLongWithActiveShorts}
                                                                            >
                                                                                <Check
                                                                                    className="h-4 w-4 text-green-500"/>
                                                                            </Button>
                                                                            <Button
                                                                                variant="ghost"
                                                                                size="sm"
                                                                                onClick={() => {
                                                                                    setTradeToDelete(trade);
                                                                                    setDeleteTradeDialogOpen(true);
                                                                                }}
                                                                                title={isLongWithActiveShorts ? "Locked: Close all SHORT positions first" : "Delete"}
                                                                                disabled={isLongWithActiveShorts}
                                                                            >
                                                                                <Trash2
                                                                                    className="h-4 w-4 text-destructive"/>
                                                                            </Button>
                                                                        </>
                                                                    )}
                                                                    {trade.status === TradeStatus.FILLED && (
                                                                        <>
                                                                            <Button
                                                                                variant="ghost"
                                                                                size="sm"
                                                                                onClick={() => {
                                                                                    setTradeToEdit(trade);
                                                                                    setShowEditExitPriceModal(true);
                                                                                }}
                                                                                title={isLongWithActiveShorts ? "Locked: Close all SHORT positions first" : "Set Exit Price"}
                                                                                disabled={isLongWithActiveShorts}
                                                                            >
                                                                                <DollarSign className="h-4 w-4"/>
                                                                            </Button>
                                                                            {/* Split button - for LONG or standalone SHORT (not SHORT from LONG) */}
                                                                            {(trade.tradeType === TradeType.LONG ||
                                                                                (trade.tradeType === TradeType.SHORT && !trade.parentTradeId)) && (
                                                                                <Button
                                                                                    variant="ghost"
                                                                                    size="sm"
                                                                                    onClick={() => {
                                                                                        setTradeToSplit(trade);
                                                                                        setShowSplitModal(true);
                                                                                    }}
                                                                                    title={isLongWithActiveShorts ? "Locked: Close all SHORT positions first" : "Split Position"}
                                                                                    disabled={isLongWithActiveShorts}
                                                                                >
                                                                                    <MinusCircle
                                                                                        className="h-4 w-4 text-yellow-500"/>
                                                                                </Button>
                                                                            )}
                                                                            {/* Open SHORT button - only for LONG positions */}
                                                                            {trade.tradeType === TradeType.LONG && (
                                                                                <Button
                                                                                    variant="ghost"
                                                                                    size="sm"
                                                                                    onClick={() => handleOpenShort(trade)}
                                                                                    title={isLongWithActiveShorts ? "Locked: Close all SHORT positions first" : "Open SHORT from this LONG position"}
                                                                                    disabled={isLongWithActiveShorts}
                                                                                >
                                                                                    <TrendingDown
                                                                                        className="h-4 w-4 text-orange-500"/>
                                                                                </Button>
                                                                            )}
                                                                        </>
                                                                    )}
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="sm"
                                                                        onClick={() => {
                                                                            setTradeToClose(trade);
                                                                            setShowCloseTradeDialog(true);
                                                                        }}
                                                                        title={isLongWithActiveShorts ? "Locked: Close all SHORT positions first" : "Close Trade"}
                                                                        disabled={isLongWithActiveShorts}
                                                                    >
                                                                        Close
                                                                    </Button>
                                                                </div>
                                                            </TableCell>
                                                        </TableRow>
                                                    );
                                                };

                                                // Render parent trade and its children
                                                return (
                                                    <>
                                                        {renderTradeRow(group.parent, false, group.splitInfo)}
                                                        {group.children.map(child => renderTradeRow(child, true, undefined))}
                                                    </>
                                                );
                                            })}
                                        </TableBody>
                                    </Table>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <div className="flex justify-between items-center">
                                <CardTitle>Closed Trades</CardTitle>
                                {groupedClosedTrades.length > 0 && (
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
                            {groupedClosedTrades.length === 0 ? (
                                <div className="text-center py-12 text-muted-foreground">
                                    No closed trades yet.
                                </div>
                            ) : (
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
