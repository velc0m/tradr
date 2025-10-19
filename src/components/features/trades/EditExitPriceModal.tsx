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
import { ITrade } from '@/types';
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
      // For exit fee: include all filled trades (the trade should already be filled)
      const response = await fetch(
        `/api/portfolios/${trade.portfolioId}/calculate-fee?type=exit`
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

  // Calculate Profit %
  const profitPercent = useMemo(() => {
    const exit = parseFloat(exitPrice) || 0;
    const entry = trade.entryPrice;
    const entryFeeVal = trade.entryFee;
    const exitFeeVal = parseFloat(exitFee) || 0;

    if (exit === 0) return null;

    return ((exit / entry - 1) * 100 - entryFeeVal - exitFeeVal);
  }, [exitPrice, trade.entryPrice, trade.entryFee, exitFee]);

  // Calculate Profit $ for REMAINING amount only
  const profitUSD = useMemo(() => {
    const exit = parseFloat(exitPrice) || 0;
    const exitFeeVal = parseFloat(exitFee) || 0;

    if (exit === 0) return null;

    const remainingAmount = trade.remainingAmount ?? trade.amount;
    const originalAmount = trade.originalAmount ?? trade.amount;

    // Proportional entry cost for remaining amount
    const proportion = remainingAmount / originalAmount;
    const proportionalEntryCost = trade.sumPlusFee * proportion;

    // Exit value for remaining amount
    const exitValue = remainingAmount * exit * (100 - exitFeeVal) / 100;

    return exitValue - proportionalEntryCost;
  }, [exitPrice, exitFee, trade.remainingAmount, trade.originalAmount, trade.amount, trade.sumPlusFee]);

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
          <DialogTitle>Set Exit Price</DialogTitle>
          <DialogDescription>
            Set the exit price and fee for this trade
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Trade Information</Label>
              <div className="text-sm text-muted-foreground space-y-1">
                <div>Coin: {trade.coinSymbol}</div>
                <div>Entry Price: ${formatPrice(trade.entryPrice)}</div>
                <div>Original Amount: {(trade.originalAmount ?? trade.amount).toFixed(8)}</div>
                <div className="font-medium text-yellow-400">
                  Remaining Amount: {(trade.remainingAmount ?? trade.amount).toFixed(8)}
                </div>
              </div>
              <p className="text-xs text-muted-foreground italic">
                Setting exit price for remaining {(trade.remainingAmount ?? trade.amount).toFixed(8)} {trade.coinSymbol}
              </p>
            </div>

            <div className="grid gap-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="exitPrice">Exit Price</Label>
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
                Leave empty to clear exit price
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

            {profitPercent !== null && profitUSD !== null && (
              <div className="grid gap-2 p-3 rounded-lg bg-muted">
                <Label>Projected Results</Label>
                <div className="text-sm space-y-1">
                  <div className="flex justify-between">
                    <span>Profit %:</span>
                    <span
                      className={
                        profitPercent >= 0 ? 'text-green-500' : 'text-red-500'
                      }
                    >
                      {profitPercent >= 0 ? '+' : ''}
                      {profitPercent.toFixed(2)}%
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Profit $:</span>
                    <span
                      className={
                        profitUSD >= 0 ? 'text-green-500' : 'text-red-500'
                      }
                    >
                      {profitUSD >= 0 ? '+' : ''}${profitUSD.toFixed(2)}
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
