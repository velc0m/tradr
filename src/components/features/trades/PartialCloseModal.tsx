'use client';

import { useState, useEffect } from 'react';
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

interface PartialCloseModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trade: ITrade | null;
  onSuccess?: () => void;
}

export function PartialCloseModal({
  open,
  onOpenChange,
  trade,
  onSuccess,
}: PartialCloseModalProps) {
  const [isLoading, setIsLoading] = useState(false);

  // Get today's date in local timezone
  const getLocalDateString = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const [amountToClose, setAmountToClose] = useState('');
  const [exitPrice, setExitPrice] = useState('');
  const [exitFee, setExitFee] = useState('0.25');
  const [feeLevel, setFeeLevel] = useState('');
  const [closeDate, setCloseDate] = useState(getLocalDateString());
  const { toast } = useToast();

  // Reset form when modal opens with new trade
  useEffect(() => {
    if (open && trade) {
      setAmountToClose('');
      setExitPrice(trade.exitPrice?.toString() || '');
      setExitFee(trade.exitFee?.toString() || '0.25');
      setCloseDate(getLocalDateString());

      // Fetch exit fee if not already set
      fetchExitFee();
    }
  }, [open, trade]);

  const fetchExitFee = async () => {
    if (!trade) return;

    try {
      // For exit fee: include all filled trades
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

  if (!trade) return null;

  const remainingAmount = trade.remainingAmount ?? trade.amount;
  const originalAmount = trade.originalAmount ?? trade.amount;

  // Calculate preview values
  const calculatePreview = () => {
    const closeAmount = parseFloat(amountToClose) || 0;
    const exit = parseFloat(exitPrice) || 0;
    const fee = parseFloat(exitFee) || 0;

    if (closeAmount <= 0 || exit <= 0) {
      return { sumPlusFee: 0, profitPercent: 0, profitUSD: 0 };
    }

    // Proportional entry cost for this portion
    const proportion = closeAmount / originalAmount;
    const entrySumPlusFee = trade.sumPlusFee * proportion;

    // Exit calculations
    const exitSumPlusFee = closeAmount * exit;
    const exitSum = exitSumPlusFee * (100 - fee) / 100;

    // Profit calculations
    const profitUSD = exitSum - entrySumPlusFee;
    const profitPercent = ((exit / trade.entryPrice - 1) * 100) - trade.entryFee - fee;

    return {
      sumPlusFee: exitSumPlusFee,
      profitPercent,
      profitUSD,
    };
  };

  const preview = calculatePreview();

  const handleConfirm = async () => {
    if (!trade) return;

    const closeAmount = parseFloat(amountToClose);
    const exit = parseFloat(exitPrice);
    const fee = parseFloat(exitFee);

    // Validation
    if (!closeAmount || closeAmount <= 0) {
      toast({
        title: 'Error',
        description: 'Please enter a valid amount to close',
        variant: 'destructive',
      });
      return;
    }

    if (closeAmount > remainingAmount) {
      toast({
        title: 'Error',
        description: `Cannot close more than remaining amount (${remainingAmount.toFixed(8)})`,
        variant: 'destructive',
      });
      return;
    }

    if (!exit || exit <= 0) {
      toast({
        title: 'Error',
        description: 'Please enter a valid exit price',
        variant: 'destructive',
      });
      return;
    }

    if (fee < 0) {
      toast({
        title: 'Error',
        description: 'Exit fee cannot be negative',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch(`/api/trades/${trade._id}/partial-close`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amountToClose: closeAmount,
          exitPrice: exit,
          exitFee: fee,
          closeDate: closeDate,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to partially close trade');
      }

      toast({
        title: 'Success',
        description: 'Trade partially closed successfully',
      });

      onOpenChange(false);

      if (onSuccess) {
        onSuccess();
      }
    } catch (error) {
      toast({
        title: 'Error',
        description:
          error instanceof Error ? error.message : 'Failed to partially close trade',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const formatPrice = (price: number): string => {
    const formatted = price.toFixed(6);
    const trimmed = formatted.replace(/\.?0+$/, '');
    return trimmed;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Partial Close Position</DialogTitle>
          <DialogDescription>
            Close a portion of your {trade.coinSymbol} position
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {/* Trade Info */}
          <div className="grid grid-cols-2 gap-4 p-4 rounded-lg bg-muted/50">
            <div>
              <div className="text-xs text-muted-foreground">Coin</div>
              <div className="font-medium">{trade.coinSymbol}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Entry Price</div>
              <div className="font-medium">${formatPrice(trade.entryPrice)}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Total Amount</div>
              <div className="font-medium">{originalAmount.toFixed(8)}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Remaining Amount</div>
              <div className="font-medium">{remainingAmount.toFixed(8)}</div>
            </div>
          </div>

          {/* Input Fields */}
          <div className="grid gap-2">
            <Label htmlFor="amountToClose">Amount to Close *</Label>
            <Input
              id="amountToClose"
              type="number"
              step="any"
              placeholder={`Max: ${remainingAmount.toFixed(8)}`}
              value={amountToClose}
              onChange={(e) => setAmountToClose(e.target.value)}
              disabled={isLoading}
            />
            <p className="text-xs text-muted-foreground">
              Must be between 0 and {remainingAmount.toFixed(8)}
            </p>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="exitPrice">Exit Price (USD) *</Label>
            <Input
              id="exitPrice"
              type="number"
              step="any"
              placeholder="0.00"
              value={exitPrice}
              onChange={(e) => setExitPrice(e.target.value)}
              disabled={isLoading}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="exitFee">
              Exit Fee (%) *
              {feeLevel && (
                <span className="text-xs text-muted-foreground ml-2">
                  ({feeLevel})
                </span>
              )}
            </Label>
            <Input
              id="exitFee"
              type="number"
              step="0.001"
              placeholder="0.25"
              value={exitFee}
              onChange={(e) => setExitFee(e.target.value)}
              disabled={isLoading}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="closeDate">Close Date *</Label>
            <Input
              id="closeDate"
              type="date"
              value={closeDate}
              onChange={(e) => setCloseDate(e.target.value)}
              disabled={isLoading}
            />
          </div>

          {/* Preview Calculations */}
          {parseFloat(amountToClose) > 0 && parseFloat(exitPrice) > 0 && (
            <div className="grid gap-2 p-4 rounded-lg bg-muted/50 border">
              <div className="text-sm font-semibold mb-2">Preview for this portion:</div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="text-muted-foreground">Exit Sum+Fee:</div>
                <div className="font-medium">${preview.sumPlusFee.toFixed(2)}</div>

                <div className="text-muted-foreground">Profit %:</div>
                <div className={`font-medium ${preview.profitPercent >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                  {preview.profitPercent >= 0 ? '+' : ''}{preview.profitPercent.toFixed(2)}%
                </div>

                <div className="text-muted-foreground">Profit USD:</div>
                <div className={`font-medium ${preview.profitUSD >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                  {preview.profitUSD >= 0 ? '+' : ''}${preview.profitUSD.toFixed(2)}
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
          <Button onClick={handleConfirm} disabled={isLoading}>
            {isLoading ? 'Closing...' : 'Close Partial Position'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
