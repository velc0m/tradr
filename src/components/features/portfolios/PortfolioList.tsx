'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CreatePortfolioModal } from './CreatePortfolioModal';
import { IPortfolio } from '@/types';
import { Plus } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

export function PortfolioList() {
  const [portfolios, setPortfolios] = useState<IPortfolio[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchPortfolios();
  }, []);

  const fetchPortfolios = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/portfolios');
      const data = await response.json();

      if (data.success && data.data) {
        setPortfolios(data.data);
      } else {
        throw new Error(data.error || 'Failed to fetch portfolios');
      }
    } catch (error) {
      toast({
        title: 'Error',
        description:
          error instanceof Error ? error.message : 'Failed to load portfolios',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handlePortfolioCreated = (portfolio: IPortfolio) => {
    setPortfolios([portfolio, ...portfolios]);
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold">Portfolios</h2>
        </div>
        <div className="text-center py-12 text-muted-foreground">
          Loading portfolios...
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold">Portfolios</h2>
          <Button onClick={() => setShowCreateModal(true)}>
            <Plus className="h-4 w-4 mr-2" />
            New Portfolio
          </Button>
        </div>

        {portfolios.length === 0 ? (
          <Card>
            <CardContent className="py-12">
              <div className="text-center space-y-4">
                <div className="text-muted-foreground">
                  No portfolios yet. Create your first portfolio to start tracking
                  your crypto trades.
                </div>
                <Button onClick={() => setShowCreateModal(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Portfolio
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {portfolios.map((portfolio) => (
              <Card key={portfolio._id} className="hover:bg-accent/50 transition-colors">
                <CardHeader>
                  <CardTitle className="flex justify-between items-start">
                    <span className="truncate">{portfolio.name}</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <div className="text-sm text-muted-foreground">
                      Total Deposit
                    </div>
                    <div className="text-2xl font-bold">
                      ${portfolio.totalDeposit.toLocaleString('en-US', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </div>
                  </div>

                  <div>
                    <div className="text-sm text-muted-foreground mb-2">
                      Allocation
                    </div>
                    <div className="space-y-1">
                      {portfolio.coins.map((coin, index) => (
                        <div
                          key={index}
                          className="flex justify-between items-center text-sm"
                        >
                          <span className="font-medium">{coin.symbol}</span>
                          <span className="text-muted-foreground">
                            {coin.percentage}%
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <Button variant="outline" className="w-full mt-4">
                    Open
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <CreatePortfolioModal
        open={showCreateModal}
        onOpenChange={setShowCreateModal}
        onSuccess={handlePortfolioCreated}
      />
    </>
  );
}
