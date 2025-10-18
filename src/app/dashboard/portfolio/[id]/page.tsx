'use client';

import { useState, useEffect } from 'react';
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
import { EditExitPriceModal } from '@/components/features/trades/EditExitPriceModal';
import { MarkAsFilledDialog } from '@/components/features/trades/MarkAsFilledDialog';
import { CloseTradeDialog } from '@/components/features/trades/CloseTradeDialog';
import { useToast } from '@/components/ui/use-toast';
import { IPortfolio, ITrade, TradeStatus } from '@/types';
import { ArrowLeft, Edit, Trash2, Plus, Check, DollarSign } from 'lucide-react';

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
  const [showEditModal, setShowEditModal] = useState(false);
  const [showCreateTradeModal, setShowCreateTradeModal] = useState(false);
  const [showEditExitPriceModal, setShowEditExitPriceModal] = useState(false);
  const [showMarkAsFilledDialog, setShowMarkAsFilledDialog] = useState(false);
  const [showCloseTradeDialog, setShowCloseTradeDialog] = useState(false);
  const [tradeToEdit, setTradeToEdit] = useState<ITrade | null>(null);
  const [tradeToFill, setTradeToFill] = useState<ITrade | null>(null);
  const [tradeToClose, setTradeToClose] = useState<ITrade | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteTradeDialogOpen, setDeleteTradeDialogOpen] = useState(false);
  const [tradeToDelete, setTradeToDelete] = useState<ITrade | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (status === 'authenticated') {
      fetchPortfolio();
      fetchTrades();
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

  const handlePortfolioUpdated = (updatedPortfolio: IPortfolio) => {
    setPortfolio(updatedPortfolio);
  };

  const handleTradeCreated = (trade: ITrade) => {
    setTrades([trade, ...trades]);
  };

  const handleTradeUpdated = (updatedTrade: ITrade) => {
    setTrades(trades.map((t) => (t._id === updatedTrade._id ? updatedTrade : t)));
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

  const calculateProfitUSD = (trade: ITrade): number | null => {
    if (!trade.exitPrice) return null;
    const exitValue = trade.amount * trade.exitPrice * (100 - (trade.exitFee || 0)) / 100;
    return exitValue - trade.sumPlusFee;
  };

  const formatPrice = (price: number): string => {
    // Remove trailing zeros and unnecessary decimals
    const formatted = price.toFixed(6);
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

          <div className="grid gap-6 md:grid-cols-2">
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
                        <TableHead className="min-w-[110px]">Amount (coins)</TableHead>
                        <TableHead className="min-w-[90px]">Exit Price</TableHead>
                        <TableHead className="min-w-[80px]">Profit %</TableHead>
                        <TableHead className="min-w-[80px]">Profit $</TableHead>
                        <TableHead className="text-right min-w-[120px]">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {openTrades.map((trade) => {
                        const profitPercent = calculateProfitPercent(trade);
                        const profitUSD = calculateProfitUSD(trade);

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
                            <TableCell>{trade.amount.toFixed(8)}</TableCell>
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
              {closedTrades.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  No closed trades yet.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="min-w-[60px]">Coin</TableHead>
                        <TableHead className="min-w-[70px]">Status</TableHead>
                        <TableHead className="min-w-[90px]">Entry Price</TableHead>
                        <TableHead className="min-w-[90px]">Sum+Fee</TableHead>
                        <TableHead className="min-w-[110px]">Amount (coins)</TableHead>
                        <TableHead className="min-w-[90px]">Exit Price</TableHead>
                        <TableHead className="min-w-[80px]">Profit %</TableHead>
                        <TableHead className="min-w-[80px]">Profit $</TableHead>
                        <TableHead className="min-w-[100px]">Filled Date</TableHead>
                        <TableHead className="min-w-[100px]">Close Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {closedTrades.map((trade) => {
                        const profitPercent = calculateProfitPercent(trade);
                        const profitUSD = calculateProfitUSD(trade);

                        return (
                          <TableRow key={trade._id}>
                            <TableCell className="font-medium">
                              {trade.coinSymbol}
                            </TableCell>
                            <TableCell>{getStatusBadge(trade.status)}</TableCell>
                            <TableCell>${formatPrice(trade.entryPrice)}</TableCell>
                            <TableCell>${trade.sumPlusFee.toFixed(2)}</TableCell>
                            <TableCell>{trade.amount.toFixed(8)}</TableCell>
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
                            <TableCell>
                              {trade.filledDate ? new Date(trade.filledDate).toLocaleDateString('en-US', {
                                year: 'numeric',
                                month: 'short',
                                day: 'numeric',
                              }) : '-'}
                            </TableCell>
                            <TableCell>
                              {trade.closeDate ? new Date(trade.closeDate).toLocaleDateString('en-US', {
                                year: 'numeric',
                                month: 'short',
                                day: 'numeric',
                              }) : '-'}
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
