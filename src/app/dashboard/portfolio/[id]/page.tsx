'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { redirect, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { useToast } from '@/components/ui/use-toast';
import { IPortfolio } from '@/types';
import { ArrowLeft, Edit, Trash2 } from 'lucide-react';

interface PortfolioPageProps {
  params: {
    id: string;
  };
}

export default function PortfolioPage({ params }: PortfolioPageProps) {
  const { status } = useSession();
  const router = useRouter();
  const [portfolio, setPortfolio] = useState<IPortfolio | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showEditModal, setShowEditModal] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (status === 'authenticated') {
      fetchPortfolio();
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

  const handlePortfolioUpdated = (updatedPortfolio: IPortfolio) => {
    setPortfolio(updatedPortfolio);
  };

  const handleDeleteClick = () => {
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
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
              <Button variant="destructive" onClick={handleDeleteClick}>
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
              <CardTitle>Trades</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12 text-muted-foreground">
                Trades will be displayed here
              </div>
            </CardContent>
          </Card>
        </div>
      </main>

      {portfolio && (
        <EditPortfolioModal
          open={showEditModal}
          onOpenChange={setShowEditModal}
          portfolio={portfolio}
          onSuccess={handlePortfolioUpdated}
        />
      )}

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
              onClick={handleDeleteConfirm}
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
