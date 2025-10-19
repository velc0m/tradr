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

interface EditTradeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trade: ITrade | null;
  onSuccess?: (trade: ITrade) => void;
}

export function EditTradeDialog({
  open,
  onOpenChange,
  trade,
  onSuccess,
}: EditTradeDialogProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [entryPrice, setEntryPrice] = useState('');
  const [depositPercent, setDepositPercent] = useState('');
  const [entryFee, setEntryFee] = useState('');
  const [amount, setAmount] = useState('');
  const [sumPlusFee, setSumPlusFee] = useState('');
  const [openDate, setOpenDate] = useState('');
  const [filledDate, setFilledDate] = useState('');

  const { toast } = useToast();

  // Format date to YYYY-MM-DD for date input
  const formatDateForInput = (date: Date | string | undefined) => {
    if (!date) return '';
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Initialize form when trade changes
  useEffect(() => {
    if (trade && open) {
      setEntryPrice(trade.entryPrice.toString());
      setDepositPercent(trade.depositPercent.toString());
      setEntryFee(trade.entryFee.toString());
      setAmount(trade.amount.toString());
      setSumPlusFee(trade.sumPlusFee.toString());
      setOpenDate(formatDateForInput(trade.openDate));
      setFilledDate(formatDateForInput(trade.filledDate));
    }
  }, [trade, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!trade) return;

    // Validation
    const entryPriceNum = parseFloat(entryPrice);
    const depositPercentNum = parseFloat(depositPercent);
    const entryFeeNum = parseFloat(entryFee);
    const amountNum = parseFloat(amount);
    const sumPlusFeeNum = parseFloat(sumPlusFee);

    if (entryPriceNum <= 0) {
      toast({
        title: 'Validation Error',
        description: 'Entry Price must be greater than 0',
        variant: 'destructive',
      });
      return;
    }

    if (depositPercentNum < 0 || depositPercentNum > 100) {
      toast({
        title: 'Validation Error',
        description: 'Deposit Percent must be between 0 and 100',
        variant: 'destructive',
      });
      return;
    }

    if (entryFeeNum < 0 || entryFeeNum > 100) {
      toast({
        title: 'Validation Error',
        description: 'Entry Fee must be between 0 and 100',
        variant: 'destructive',
      });
      return;
    }

    if (amountNum <= 0) {
      toast({
        title: 'Validation Error',
        description: 'Amount must be greater than 0',
        variant: 'destructive',
      });
      return;
    }

    if (sumPlusFeeNum <= 0) {
      toast({
        title: 'Validation Error',
        description: 'Sum+Fee must be greater than 0',
        variant: 'destructive',
      });
      return;
    }

    // Validate dates
    const openDateObj = new Date(openDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (openDateObj > today) {
      toast({
        title: 'Validation Error',
        description: 'Open Date cannot be in the future',
        variant: 'destructive',
      });
      return;
    }

    // If trade is filled and filledDate is provided, validate it
    if (trade.status === 'filled' && filledDate) {
      const filledDateObj = new Date(filledDate);
      if (filledDateObj < openDateObj) {
        toast({
          title: 'Validation Error',
          description: 'Filled Date must be on or after Open Date',
          variant: 'destructive',
        });
        return;
      }
      if (filledDateObj > today) {
        toast({
          title: 'Validation Error',
          description: 'Filled Date cannot be in the future',
          variant: 'destructive',
        });
        return;
      }
    }

    setIsLoading(true);

    try {
      const updateData: Record<string, any> = {
        entryPrice: entryPriceNum,
        depositPercent: depositPercentNum,
        entryFee: entryFeeNum,
        amount: amountNum,
        sumPlusFee: sumPlusFeeNum,
        openDate: openDate,
      };

      // Only include filledDate if trade is filled and date is provided
      if (trade.status === 'filled' && filledDate) {
        updateData.filledDate = filledDate;
      }

      const response = await fetch(`/api/trades/${trade._id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updateData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update trade');
      }

      console.log('=== TRADE UPDATE RESPONSE ===');
      console.log('Response data:', data.data);
      console.log('Updated amount:', data.data?.amount);
      console.log('Updated originalAmount:', data.data?.originalAmount);
      console.log('Updated remainingAmount:', data.data?.remainingAmount);
      console.log('=== END UPDATE RESPONSE ===');

      toast({
        title: 'Success',
        description: 'Trade updated successfully',
      });

      // Call success callback BEFORE closing modal
      if (onSuccess && data.data) {
        console.log('Calling onSuccess callback with updated trade');
        onSuccess(data.data);
      }

      // Close modal
      onOpenChange(false);
    } catch (error) {
      toast({
        title: 'Error',
        description:
          error instanceof Error ? error.message : 'Failed to update trade',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (!trade) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Trade</DialogTitle>
          <DialogDescription>
            Edit details for {trade.coinSymbol} trade
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            {/* Coin Symbol - Read Only */}
            <div className="grid gap-2">
              <Label htmlFor="coinSymbol">Coin</Label>
              <Input
                id="coinSymbol"
                value={trade.coinSymbol}
                disabled
                className="bg-muted"
              />
            </div>

            {/* Entry Price */}
            <div className="grid gap-2">
              <Label htmlFor="entryPrice">
                Entry Price <span className="text-destructive">*</span>
              </Label>
              <Input
                id="entryPrice"
                type="number"
                placeholder="0.00"
                value={entryPrice}
                onChange={(e) => setEntryPrice(e.target.value)}
                step="0.000001"
                min="0"
                required
                disabled={isLoading}
              />
            </div>

            {/* Deposit Percent */}
            <div className="grid gap-2">
              <Label htmlFor="depositPercent">
                Deposit Percent <span className="text-destructive">*</span>
              </Label>
              <Input
                id="depositPercent"
                type="number"
                placeholder="0"
                value={depositPercent}
                onChange={(e) => setDepositPercent(e.target.value)}
                step="0.01"
                min="0"
                max="100"
                required
                disabled={isLoading}
              />
            </div>

            {/* Entry Fee */}
            <div className="grid gap-2">
              <Label htmlFor="entryFee">
                Entry Fee (%) <span className="text-destructive">*</span>
              </Label>
              <Input
                id="entryFee"
                type="number"
                placeholder="0.1"
                value={entryFee}
                onChange={(e) => setEntryFee(e.target.value)}
                step="0.001"
                min="0"
                max="100"
                required
                disabled={isLoading}
              />
            </div>

            {/* Amount */}
            <div className="grid gap-2">
              <Label htmlFor="amount">
                Amount (coins) <span className="text-destructive">*</span>
              </Label>
              <Input
                id="amount"
                type="number"
                placeholder="0.00000000"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                step="0.00000001"
                min="0"
                required
                disabled={isLoading}
              />
            </div>

            {/* Sum + Fee */}
            <div className="grid gap-2">
              <Label htmlFor="sumPlusFee">
                Sum + Fee (USD) <span className="text-destructive">*</span>
              </Label>
              <Input
                id="sumPlusFee"
                type="number"
                placeholder="0.00"
                value={sumPlusFee}
                onChange={(e) => setSumPlusFee(e.target.value)}
                step="0.01"
                min="0"
                required
                disabled={isLoading}
              />
            </div>

            {/* Open Date */}
            <div className="grid gap-2">
              <Label htmlFor="openDate">
                Open Date <span className="text-destructive">*</span>
              </Label>
              <Input
                id="openDate"
                type="date"
                value={openDate}
                onChange={(e) => setOpenDate(e.target.value)}
                required
                disabled={isLoading}
              />
            </div>

            {/* Filled Date - only for filled trades */}
            {trade.status === 'filled' && (
              <div className="grid gap-2">
                <Label htmlFor="filledDate">Filled Date</Label>
                <Input
                  id="filledDate"
                  type="date"
                  value={filledDate}
                  onChange={(e) => setFilledDate(e.target.value)}
                  disabled={isLoading}
                />
                <p className="text-xs text-muted-foreground">
                  Optional - leave empty to keep current value
                </p>
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
              {isLoading ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
