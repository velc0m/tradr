'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { ITrade, TradeType } from '@/types';
import { X } from 'lucide-react';

interface EditExitPriceModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trade: ITrade;
  onSuccess?: (trade: ITrade) => void;
}

export function EditExitPriceModal({
  open,
  onOpenChange,
  trade,
  onSuccess,
}: EditExitPriceModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [exitPrice, setExitPrice] = useState(trade.exitPrice?.toString() || '');
  const [exitFee, setExitFee] = useState(trade.exitFee?.toString() || trade.entryFee?.toString() || '0.1');
  const [feeLevel, setFeeLevel] = useState('');
  const { toast } = useToast();

  // Format price without trailing zeros
  const formatPrice = (price: number): string => {
    const formatted = price.toFixed(6);
    const trimmed = formatted.replace(/\.?0+$/, '');
    return trimmed;
  };

  // Format amount (coins) without trailing zeros
  const formatAmount = (amount: number): string => {
    const formatted = amount.toFixed(10);
    const trimmed = formatted.replace(/\.?0+$/, '');
    return trimmed;
  };

  // Reset form when trade changes
  useEffect(() => {
    setExitPrice(trade.exitPrice?.toString() || '');
    setExitFee(trade.exitFee?.toString() || trade.entryFee?.toString() || '0.1');
  }, [trade]);

  // Fetch and auto-fill exit fee when modal opens
  useEffect(() => {
    if (open) {
      // Always fetch exit fee when modal opens
      fetchExitFee();
    }
  }, [open]);

  const fetchExitFee = async () => {
    try {
      // For exit fee: include current trade in volume
      const response = await fetch(
        `/api/portfolios/${trade.portfolioId}/calculate-fee?type=exit&includeTradeId=${trade._id}`
      );
      const data = await response.json();

      if (data.success && data.data) {
        // Only auto-fill if user hasn't set exitFee yet
        if (!trade.exitFee) {
          setExitFee(data.data.feePercent.toFixed(3));
        }
        setFeeLevel(data.data.level);
      }
    } catch (error) {
      console.error('Failed to fetch exit fee:', error);
      // Silently fail, keep default value
    }
  };

  // Calculate Profit % and Profit Amount (USD for LONG, coins for SHORT)
  const profitResult = useMemo(() => {
    const exit = parseFloat(exitPrice) || 0;
    const exitFeeVal = parseFloat(exitFee) || 0;

    if (exit === 0) return null;

    const remainingAmount = trade.remainingAmount ?? trade.amount;
    const originalAmount = trade.originalAmount ?? trade.amount;
    const proportion = remainingAmount / originalAmount;

    if (trade.tradeType === TradeType.SHORT) {
      // SHORT: Profit in coins
      // Calculate how many coins can be bought back with the proportional sale amount
      const proportionalSaleAmount = trade.sumPlusFee * proportion;
      const buyBackPriceWithFee = exit * (100 + exitFeeVal) / 100;
      const coinsBoughtBack = proportionalSaleAmount / buyBackPriceWithFee;
      const profitCoins = coinsBoughtBack - remainingAmount;

      // Profit %: based on initial entry price vs buy back price
      const profitPercent = ((coinsBoughtBack / remainingAmount - 1) * 100);

      return {
        type: 'coins' as const,
        value: profitCoins,
        percent: profitPercent,
        symbol: trade.coinSymbol,
      };
    } else {
      // LONG: Profit in USD
      const entry = trade.entryPrice;
      const entryFeeVal = trade.entryFee;
      const proportionalEntryCost = trade.sumPlusFee * proportion;
      const exitValue = remainingAmount * exit * (100 - exitFeeVal) / 100;
      const profitUSD = exitValue - proportionalEntryCost;

      // Profit %
      const profitPercent = ((exit / entry - 1) * 100 - entryFeeVal - exitFeeVal);

      return {
        type: 'usd' as const,
        value: profitUSD,
        percent: profitPercent,
      };
    }
  }, [exitPrice, exitFee, trade]);

  const handleClearExitPrice = async () => {
    setIsLoading(true);

    try {
      const response = await fetch(`/api/trades/${trade._id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          exitPrice: null,
          exitFee: trade.entryFee, // Reset to entryFee
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to clear exit price');
      }

      toast({
        title: 'Success',
        description: 'Exit price cleared successfully',
      });

      // Close modal
      onOpenChange(false);

      // Call success callback
      if (onSuccess && data.data) {
        onSuccess(data.data);
      }
    } catch (error) {
      toast({
        title: 'Error',
        description:
          error instanceof Error ? error.message : 'Failed to clear exit price',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // Allow empty exitPrice (will set to null)
      const exitPriceValue = exitPrice.trim() === '' ? null : parseFloat(exitPrice);

      // Validate: if not empty, must be > 0
      if (exitPriceValue !== null && exitPriceValue <= 0) {
        throw new Error('Exit price must be greater than 0');
      }

      const response = await fetch(`/api/trades/${trade._id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          exitPrice: exitPriceValue,
          exitFee: exitPriceValue === null ? trade.entryFee : parseFloat(exitFee),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update exit price');
      }

      toast({
        title: 'Success',
        description: exitPriceValue === null ? 'Exit price cleared successfully' : 'Exit price updated successfully',
      });

      // Close modal
      onOpenChange(false);

      // Call success callback
      if (onSuccess && data.data) {
        onSuccess(data.data);
      }
    } catch (error) {
      toast({
        title: 'Error',
        description:
          error instanceof Error ? error.message : 'Failed to update exit price',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>
            {trade.tradeType === TradeType.SHORT ? 'Set Buy Back Price' : 'Set Exit Price'}
          </DialogTitle>
          <DialogDescription>
            {trade.tradeType === TradeType.SHORT
              ? 'Set the buy back price and fee for this SHORT trade'
              : 'Set the exit price and fee for this trade'
            }
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Trade Information</Label>
              <div className="text-sm text-muted-foreground space-y-1">
                <div>Coin: {trade.coinSymbol}</div>
                <div>Entry Price: ${formatPrice(trade.entryPrice)}</div>
                <div>Original Amount: {formatAmount(trade.originalAmount ?? trade.amount)}</div>
                <div className="font-medium text-yellow-400">
                  Remaining Amount: {formatAmount(trade.remainingAmount ?? trade.amount)}
                </div>
              </div>
              <p className="text-xs text-muted-foreground italic">
                Setting exit price for remaining {formatAmount(trade.remainingAmount ?? trade.amount)} {trade.coinSymbol}
              </p>
            </div>

            <div className="grid gap-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="exitPrice">
                  {trade.tradeType === TradeType.SHORT ? 'Buy Back Price' : 'Exit Price'}
                </Label>
                {exitPrice && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleClearExitPrice}
                    disabled={isLoading}
                    className="h-6 px-2 text-xs"
                  >
                    <X className="h-3 w-3 mr-1" />
                    Clear
                  </Button>
                )}
              </div>
              <Input
                id="exitPrice"
                type="number"
                placeholder="0.00"
                value={exitPrice}
                onChange={(e) => setExitPrice(e.target.value)}
                step="0.000001"
                min="0"
                disabled={isLoading}
              />
              <p className="text-xs text-muted-foreground">
                {trade.tradeType === TradeType.SHORT
                  ? 'Leave empty to clear buy back price'
                  : 'Leave empty to clear exit price'
                }
              </p>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="exitFee">
                Exit Fee %
                {feeLevel && (
                  <span className="text-xs text-muted-foreground ml-2">
                    ({feeLevel})
                  </span>
                )}
              </Label>
              <Input
                id="exitFee"
                type="number"
                placeholder="0.1"
                value={exitFee}
                onChange={(e) => setExitFee(e.target.value)}
                step="0.001"
                min="0"
                disabled={isLoading}
              />
            </div>

            {profitResult !== null && (
              <div className="grid gap-2 p-3 rounded-lg bg-muted">
                <Label>Projected Results</Label>
                <div className="text-sm space-y-1">
                  <div className="flex justify-between">
                    <span>Profit %:</span>
                    <span
                      className={
                        profitResult.percent >= 0 ? 'text-green-500' : 'text-red-500'
                      }
                    >
                      {profitResult.percent >= 0 ? '+' : ''}
                      {profitResult.percent.toFixed(2)}%
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>
                      {profitResult.type === 'coins' ? `Profit (${profitResult.symbol}):` : 'Profit $:'}
                    </span>
                    <span
                      className={
                        profitResult.value >= 0 ? 'text-green-500' : 'text-red-500'
                      }
                    >
                      {profitResult.value >= 0 ? '+' : ''}
                      {profitResult.type === 'coins'
                        ? `${profitResult.value.toFixed(8)} ${profitResult.symbol}`
                        : `$${profitResult.value.toFixed(2)}`
                      }
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
