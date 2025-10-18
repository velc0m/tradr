'use client';

import { useState, useEffect, useMemo } from 'react';
import { useSession } from 'next-auth/react';
import { redirect, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
import { EditPortfolioModal } from '@/components/features/portfolios/EditPortfolioModal';
import { CreateTradeModal } from '@/components/features/trades/CreateTradeModal';
import { EditTradeDialog } from '@/components/features/trades/EditTradeDialog';
import { EditExitPriceModal } from '@/components/features/trades/EditExitPriceModal';
import { MarkAsFilledDialog } from '@/components/features/trades/MarkAsFilledDialog';
import { CloseTradeDialog } from '@/components/features/trades/CloseTradeDialog';
import { PartialCloseModal } from '@/components/features/trades/PartialCloseModal';
import { GroupedClosedTradeRow, TradeGroup } from '@/components/features/trades/GroupedClosedTradeRow';
import { useToast } from '@/components/ui/use-toast';
import { IPortfolio, ITrade, TradeStatus } from '@/types';
import { ArrowLeft, Edit, Trash2, Plus, Check, DollarSign, MinusCircle, BarChart3, Pencil } from 'lucide-react';

interface PortfolioPageProps {
  params: {
    id: string;
  };
}

export default function PortfolioPage({ params }: PortfolioPageProps) {
  const { status } = useSession();
  const router = useRouter();
  const [portfolio, setPortfolio] = useState<IPortfolio | null>(null);
  const [trades, setTrades] = useState<ITrade[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [quickStats, setQuickStats] = useState<{
    totalClosedTrades: number;
    totalProfitUSD: number;
    winRate: number;
  } | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showCreateTradeModal, setShowCreateTradeModal] = useState(false);
  const [showEditTradeDialog, setShowEditTradeDialog] = useState(false);
  const [showEditExitPriceModal, setShowEditExitPriceModal] = useState(false);
  const [showMarkAsFilledDialog, setShowMarkAsFilledDialog] = useState(false);
  const [showCloseTradeDialog, setShowCloseTradeDialog] = useState(false);
  const [showPartialCloseModal, setShowPartialCloseModal] = useState(false);
  const [tradeToEdit, setTradeToEdit] = useState<ITrade | null>(null);
  const [tradeToFill, setTradeToFill] = useState<ITrade | null>(null);
  const [tradeToClose, setTradeToClose] = useState<ITrade | null>(null);
  const [tradeToPartialClose, setTradeToPartialClose] = useState<ITrade | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteTradeDialogOpen, setDeleteTradeDialogOpen] = useState(false);
  const [tradeToDelete, setTradeToDelete] = useState<ITrade | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const { toast } = useToast();

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
        console.log('=== FETCHED TRADES ===');
        console.log('Total trades:', data.data.length);
        data.data.forEach((trade: ITrade) => {
          console.log(`Trade ${trade._id}:`, {
            coinSymbol: trade.coinSymbol,
            status: trade.status,
            originalAmount: trade.originalAmount,
            remainingAmount: trade.remainingAmount,
            isPartialClose: trade.isPartialClose,
            parentTradeId: trade.parentTradeId,
          });
        });
        console.log('=== END FETCHED TRADES ===');
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
  };

  const handleTradeUpdated = (updatedTrade: ITrade) => {
    console.log('=== HANDLE TRADE UPDATED ===');
    console.log('Updated trade received:', updatedTrade);
    console.log('Trade ID:', updatedTrade._id);
    console.log('Updated amount:', updatedTrade.amount);
    console.log('Updated originalAmount:', updatedTrade.originalAmount);
    console.log('Updated remainingAmount:', updatedTrade.remainingAmount);
    console.log('Current trades count:', trades.length);

    const newTrades = trades.map((t) => (t._id === updatedTrade._id ? updatedTrade : t));
    console.log('New trades array created, count:', newTrades.length);
    setTrades(newTrades);

    // If trade was closed, update Quick Stats
    if (updatedTrade.status === TradeStatus.CLOSED) {
      console.log('Trade was closed, refreshing Quick Stats...');
      fetchQuickStats();
    }

    console.log('=== END HANDLE TRADE UPDATED ===');
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

      setTrades(trades.filter((t) => t._id !== tradeToDelete._id));
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
    return (
      ((trade.exitPrice / trade.entryPrice - 1) * 100) -
      trade.entryFee -
      (trade.exitFee || 0)
    );
  };

  // Calculate Profit USD for REMAINING amount in Open Trades
  // For Closed Trades, uses the actual amount that was closed
  const calculateProfitUSD = (trade: ITrade): number | null => {
    if (!trade.exitPrice) return null;

    // For open/filled trades, use remaining amount
    if (trade.status === TradeStatus.OPEN || trade.status === TradeStatus.FILLED) {
      const remainingAmount = trade.remainingAmount ?? trade.amount;
      const originalAmount = trade.originalAmount ?? trade.amount;

      // Proportional entry cost for remaining amount
      const proportion = remainingAmount / originalAmount;
      const proportionalEntryCost = trade.sumPlusFee * proportion;

      // Exit value for remaining amount
      const exitValue = remainingAmount * trade.exitPrice * (100 - (trade.exitFee || 0)) / 100;

      const profitUSD = exitValue - proportionalEntryCost;

      // Detailed logging for debugging
      if (trade.coinSymbol === 'BTC') {
        console.log(`=== ${trade.coinSymbol} Trade Profit Calculation ===`);
        console.log('Trade ID:', trade._id);
        console.log('Entry Price: $' + trade.entryPrice);
        console.log('Exit Price: $' + trade.exitPrice);
        console.log('Amount (from DB): ' + trade.amount);
        console.log('Original Amount: ' + originalAmount);
        console.log('Remaining Amount: ' + remainingAmount);
        console.log('Entry Fee: ' + trade.entryFee + '%');
        console.log('Exit Fee: ' + (trade.exitFee || 0) + '%');
        console.log('Sum+Fee (Entry Cost): $' + trade.sumPlusFee.toFixed(2));
        console.log('');
        console.log('Calculation:');
        console.log('Proportion: ' + remainingAmount + ' / ' + originalAmount + ' = ' + proportion);
        console.log('Proportional Entry Cost: $' + trade.sumPlusFee + ' × ' + proportion + ' = $' + proportionalEntryCost.toFixed(2));
        console.log('');
        console.log('Gross Exit Value: ' + remainingAmount + ' × $' + trade.exitPrice + ' = $' + (remainingAmount * trade.exitPrice).toFixed(2));
        console.log('Exit Fee Multiplier: (100 - ' + (trade.exitFee || 0) + ') / 100 = ' + ((100 - (trade.exitFee || 0)) / 100));
        console.log('Net Exit Value: $' + (remainingAmount * trade.exitPrice).toFixed(2) + ' × ' + ((100 - (trade.exitFee || 0)) / 100) + ' = $' + exitValue.toFixed(2));
        console.log('');
        console.log('Profit USD: $' + exitValue.toFixed(2) + ' - $' + proportionalEntryCost.toFixed(2) + ' = $' + profitUSD.toFixed(2));
        console.log('=== END CALCULATION ===');
      }

      return profitUSD;
    }

    // For closed trades, use actual amount (what was closed)
    const exitValue = trade.amount * trade.exitPrice * (100 - (trade.exitFee || 0)) / 100;
    return exitValue - trade.sumPlusFee;
  };

  const formatPrice = (price: number): string => {
    // Remove trailing zeros and unnecessary decimals
    const formatted = price.toFixed(6);
    const trimmed = formatted.replace(/\.?0+$/, '');
    return trimmed;
  };

  const formatAmount = (amount: number): string => {
    // Show all significant digits for amount (up to 10 decimal places)
    // Remove trailing zeros
    const formatted = amount.toFixed(10);
    const trimmed = formatted.replace(/\.?0+$/, '');
    return trimmed;
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
  const closedTrades = trades.filter((t) => t.status === TradeStatus.CLOSED);

  // Group closed trades by parent
  const groupedClosedTrades = useMemo(() => {
    const groups: TradeGroup[] = [];
    const processedIds = new Set<string>();

    // First, find all partial closes and their parents
    const partialCloses = closedTrades.filter(t => t.isPartialClose && t.parentTradeId);

    // Group by parentTradeId
    const parentMap = new Map<string, ITrade[]>();
    partialCloses.forEach(part => {
      if (!part.parentTradeId) return;

      if (!parentMap.has(part.parentTradeId)) {
        parentMap.set(part.parentTradeId, []);
      }
      parentMap.get(part.parentTradeId)!.push(part);
    });

    // Process each parent with its parts
    parentMap.forEach((parts, parentId) => {
      // Find parent trade
      const parentTrade = closedTrades.find(t => t._id === parentId);
      if (!parentTrade) return;

      // Mark all as processed
      processedIds.add(parentId);
      parts.forEach(p => processedIds.add(p._id));

      // All parts to calculate summary (including parent if it's closed with remaining amount)
      const allParts = [...parts];

      // If parent is closed and has remainingAmount, create virtual part for it
      if (parentTrade.status === TradeStatus.CLOSED && parentTrade.remainingAmount) {
        // Round to avoid floating point issues (0.999999... → 1.0)
        const remainingAmount = Math.round(parentTrade.remainingAmount * 100000000) / 100000000;
        const originalAmount = parentTrade.originalAmount ?? parentTrade.amount;

        // Calculate PROPORTIONAL sumPlusFee for remaining amount
        const proportion = remainingAmount / originalAmount;
        const proportionalSumPlusFee = parentTrade.sumPlusFee * proportion;

        // Create virtual part for parent's remaining close
        const virtualPart: ITrade = {
          ...parentTrade,
          _id: parentTrade._id + '-remaining',
          amount: remainingAmount,
          sumPlusFee: proportionalSumPlusFee,  // ← PROPORTIONAL!
          isPartialClose: true,
          closedAmount: remainingAmount,
        } as ITrade;

        allParts.push(virtualPart);
      }

      // Calculate summary from ALL parts
      const totalAmount = allParts.reduce((sum, p) => sum + p.amount, 0);
      const totalValue = allParts.reduce((sum, p) => sum + (p.amount * (p.exitPrice || 0)), 0);
      const avgExitPrice = totalAmount > 0 ? totalValue / totalAmount : 0;

      const totalProfitUSD = allParts.reduce((sum, p) => {
        const profit = calculateProfitUSD(p);
        return sum + (profit || 0);
      }, 0);

      const totalProfitPercent = allParts.reduce((sum, p) => {
        const percent = calculateProfitPercent(p);
        return sum + (percent || 0);
      }, 0) / allParts.length;

      const closeDates = allParts
        .map(p => p.closeDate)
        .filter(d => d)
        .map(d => new Date(d!));

      const firstCloseDate = closeDates.length > 0
        ? new Date(Math.min(...closeDates.map(d => d.getTime())))
        : new Date();

      const lastCloseDate = closeDates.length > 0
        ? new Date(Math.max(...closeDates.map(d => d.getTime())))
        : new Date();

      groups.push({
        type: 'multi',
        mainTrade: parentTrade,
        parts: allParts.sort((a, b) =>
          (a.closeDate ? new Date(a.closeDate).getTime() : 0) -
          (b.closeDate ? new Date(b.closeDate).getTime() : 0)
        ),
        summary: {
          totalAmount,
          avgExitPrice,
          totalProfitPercent,
          totalProfitUSD,
          firstCloseDate,
          lastCloseDate,
        },
      });
    });

    // Process remaining trades that are not partial closes and not parents
    closedTrades.forEach((trade) => {
      if (processedIds.has(trade._id)) return;

      // If this is a partial close but parent not found (still in Open Trades),
      // show it as a single-part multi group
      if (trade.isPartialClose) {
        processedIds.add(trade._id);

        // Calculate summary for single part
        const profitUSD = calculateProfitUSD(trade);
        const profitPercent = calculateProfitPercent(trade);

        groups.push({
          type: 'multi',
          mainTrade: trade,
          parts: [trade],
          summary: {
            totalAmount: trade.amount,
            avgExitPrice: trade.exitPrice || 0,
            totalProfitPercent: profitPercent || 0,
            totalProfitUSD: profitUSD || 0,
            firstCloseDate: trade.closeDate ? new Date(trade.closeDate) : new Date(),
            lastCloseDate: trade.closeDate ? new Date(trade.closeDate) : new Date(),
          },
        });
      } else {
        // This is a full close (no partial closes associated)
        processedIds.add(trade._id);
        groups.push({
          type: 'full',
          mainTrade: trade,
          parts: [],
        });
      }
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
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div className="flex-1">
              <h1 className="text-3xl font-bold">{portfolio.name}</h1>
              <p className="text-muted-foreground mt-1">Portfolio details</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setShowEditModal(true)}>
                <Edit className="h-4 w-4 mr-2" />
                Edit
              </Button>
              <Button variant="destructive" onClick={() => setDeleteDialogOpen(true)}>
                <Trash2 className="h-4 w-4 mr-2" />
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
                    Total Deposit
                  </div>
                  <div className="text-3xl font-bold">
                    ${portfolio.totalDeposit.toLocaleString('en-US', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </div>
                </div>
                <div>
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
                    const allocation =
                      (portfolio.totalDeposit * coin.percentage) / 100;
                    return (
                      <div
                        key={index}
                        className="flex justify-between items-center p-3 rounded-lg bg-muted/50"
                      >
                        <div>
                          <div className="font-semibold">{coin.symbol}</div>
                          <div className="text-sm text-muted-foreground">
                            {coin.percentage}% allocation
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-medium">
                            ${allocation.toLocaleString('en-US', {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {coin.decimalPlaces} decimal places
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
                  <BarChart3 className="h-5 w-5" />
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
                      <div className={`text-2xl font-bold ${quickStats.totalProfitUSD >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                        {quickStats.totalProfitUSD >= 0 ? '+' : ''}${quickStats.totalProfitUSD.toLocaleString('en-US', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
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
                    <BarChart3 className="h-4 w-4 mr-2" />
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
                  <Plus className="h-4 w-4 mr-2" />
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
                        <TableHead className="min-w-[110px]">Original</TableHead>
                        <TableHead className="min-w-[110px]">Remaining</TableHead>
                        <TableHead className="min-w-[90px]">Exit Price</TableHead>
                        <TableHead className="min-w-[80px]">Profit %</TableHead>
                        <TableHead className="min-w-[80px]">Profit $</TableHead>
                        <TableHead className="text-right min-w-[150px]">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {openTrades.map((trade) => {
                        const profitPercent = calculateProfitPercent(trade);
                        const profitUSD = calculateProfitUSD(trade);
                        const originalAmount = trade.originalAmount ?? trade.amount;
                        const remainingAmount = trade.remainingAmount ?? trade.amount;

                        return (
                          <TableRow key={trade._id}>
                            <TableCell className="font-medium">
                              {trade.coinSymbol}
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
                            <TableCell>${trade.sumPlusFee.toFixed(2)}</TableCell>
                            <TableCell>
                              {formatAmount(originalAmount)}
                            </TableCell>
                            <TableCell>
                              <span className={remainingAmount < originalAmount ? 'text-yellow-500 font-medium' : ''}>
                                {formatAmount(remainingAmount)}
                              </span>
                              {remainingAmount < originalAmount && (
                                <span className="text-xs text-yellow-500/60 block">
                                  ({((remainingAmount / originalAmount) * 100).toFixed(1)}% left)
                                </span>
                              )}
                            </TableCell>
                            <TableCell>
                              {trade.exitPrice ? `$${formatPrice(trade.exitPrice)}` : '-'}
                            </TableCell>
                            <TableCell>
                              {profitPercent !== null ? (
                                <span className={profitPercent >= 0 ? 'text-green-500' : 'text-red-500'}>
                                  {profitPercent >= 0 ? '+' : ''}{profitPercent.toFixed(2)}%
                                </span>
                              ) : (
                                '-'
                              )}
                            </TableCell>
                            <TableCell>
                              {profitUSD !== null ? (
                                <span className={profitUSD >= 0 ? 'text-green-500' : 'text-red-500'}>
                                  {profitUSD >= 0 ? '+' : ''}${profitUSD.toFixed(2)}
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
                                  title="Edit Trade"
                                >
                                  <Pencil className="h-4 w-4" />
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
                                      title="Mark as Filled"
                                    >
                                      <Check className="h-4 w-4 text-green-500" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => {
                                        setTradeToDelete(trade);
                                        setDeleteTradeDialogOpen(true);
                                      }}
                                      title="Delete"
                                    >
                                      <Trash2 className="h-4 w-4 text-destructive" />
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
                                      title="Set Exit Price"
                                    >
                                      <DollarSign className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => {
                                        setTradeToPartialClose(trade);
                                        setShowPartialCloseModal(true);
                                      }}
                                      title="Partial Close"
                                    >
                                      <MinusCircle className="h-4 w-4 text-yellow-500" />
                                    </Button>
                                  </>
                                )}
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    setTradeToClose(trade);
                                    setShowCloseTradeDialog(true);
                                  }}
                                  title="Close Trade"
                                >
                                  Close
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
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
              <CardTitle>Closed Trades</CardTitle>
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
                        <TableHead className="min-w-[80px]">Type</TableHead>
                        <TableHead className="min-w-[70px]">Status</TableHead>
                        <TableHead className="min-w-[90px]">Entry Price</TableHead>
                        <TableHead className="min-w-[90px]">Sum+Fee</TableHead>
                        <TableHead className="min-w-[110px]">Amount</TableHead>
                        <TableHead className="min-w-[90px]">Exit Price</TableHead>
                        <TableHead className="min-w-[80px]">Profit %</TableHead>
                        <TableHead className="min-w-[80px]">Profit $</TableHead>
                        <TableHead className="min-w-[100px]">Filled Date</TableHead>
                        <TableHead className="min-w-[100px]">Close Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {groupedClosedTrades.map((group, index) => (
                        <GroupedClosedTradeRow key={group.mainTrade._id + '-' + index} group={group} />
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
          <CreateTradeModal
            open={showCreateTradeModal}
            onOpenChange={setShowCreateTradeModal}
            portfolio={portfolio}
            onSuccess={handleTradeCreated}
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

      <PartialCloseModal
        open={showPartialCloseModal}
        onOpenChange={setShowPartialCloseModal}
        trade={tradeToPartialClose}
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
