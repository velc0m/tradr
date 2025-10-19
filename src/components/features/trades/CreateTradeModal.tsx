'use client';

import { useState, useMemo, useEffect } from 'react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { IPortfolio, ITrade } from '@/types';

interface CreateTradeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  portfolio: IPortfolio;
  onSuccess?: (trade: ITrade) => void;
}

export function CreateTradeModal({
  open,
  onOpenChange,
  portfolio,
  onSuccess,
}: CreateTradeModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [coinSymbol, setCoinSymbol] = useState('');
  const [entryPrice, setEntryPrice] = useState('');
  const [depositPercent, setDepositPercent] = useState('');
  const [entryFee, setEntryFee] = useState('0.25');
  const [feeLevel, setFeeLevel] = useState('');
  const [amount, setAmount] = useState('');
  const [sumPlusFee, setSumPlusFee] = useState('');

  // Get today's date in local timezone
  const getLocalDateString = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const [openDate, setOpenDate] = useState(getLocalDateString());
  const { toast } = useToast();

  // Fetch and auto-fill entry fee when modal opens
  useEffect(() => {
    if (open) {
      fetchEntryFee();
    }
  }, [open]);

  const fetchEntryFee = async () => {
    try {
      const response = await fetch(
        `/api/portfolios/${portfolio._id}/calculate-fee?type=entry`
      );
      const data = await response.json();

      if (data.success && data.data) {
        setEntryFee(data.data.feePercent.toFixed(3));
        setFeeLevel(data.data.level);
      }
    } catch (error) {
      console.error('Failed to fetch entry fee:', error);
      // Silently fail, keep default value
    }
  };

  // Calculate Amount in USD
  const amountUSD = useMemo(() => {
    const deposit = portfolio.totalDeposit;
    const percent = parseFloat(depositPercent) || 0;
    return (deposit * percent) / 100;
  }, [portfolio.totalDeposit, depositPercent]);

  // Calculate Sum (without fee)
  const sumWithoutFee = useMemo(() => {
    const total = parseFloat(sumPlusFee) || 0;
    const fee = parseFloat(entryFee) || 0;
    return (total * (100 - fee)) / 100;
  }, [sumPlusFee, entryFee]);

  // Calculate Entry Fee in USD
  const entryFeeUSD = useMemo(() => {
    const total = parseFloat(sumPlusFee) || 0;
    const fee = parseFloat(entryFee) || 0;
    return (total * fee) / 100;
  }, [sumPlusFee, entryFee]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const response = await fetch(`/api/portfolios/${portfolio._id}/trades`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          coinSymbol,
          entryPrice: parseFloat(entryPrice),
          depositPercent: parseFloat(depositPercent),
          entryFee: parseFloat(entryFee),
          amount: parseFloat(amount),
          sumPlusFee: parseFloat(sumPlusFee),
          openDate: openDate, // Send selected date as string
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create trade');
      }

      toast({
        title: 'Success',
        description: 'Trade created successfully',
      });

      // Reset form
      setCoinSymbol('');
      setEntryPrice('');
      setDepositPercent('');
      setEntryFee('0.25');
      setAmount('');
      setSumPlusFee('');
      setOpenDate(getLocalDateString());

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
          error instanceof Error ? error.message : 'Failed to create trade',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Create New Trade</DialogTitle>
          <DialogDescription>
            Add a new trade to your portfolio
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="coin">
                Coin <span className="text-destructive">*</span>
              </Label>
              <Select value={coinSymbol} onValueChange={setCoinSymbol} required>
                <SelectTrigger>
                  <SelectValue placeholder="Select coin" />
                </SelectTrigger>
                <SelectContent>
                  {portfolio.coins.map((coin) => (
                    <SelectItem key={coin.symbol} value={coin.symbol}>
                      {coin.symbol}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

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

            <div className="grid gap-2">
              <Label htmlFor="depositPercent">
                Deposit % <span className="text-destructive">*</span>
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
              {depositPercent && (
                <p className="text-xs text-muted-foreground">
                  Amount (USD): ${amountUSD.toFixed(2)}
                </p>
              )}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="entryFee">
                Entry Fee %
                {feeLevel && (
                  <span className="text-xs text-muted-foreground ml-2">
                    ({feeLevel})
                  </span>
                )}
              </Label>
              <Input
                id="entryFee"
                type="number"
                placeholder="0.1"
                value={entryFee}
                onChange={(e) => setEntryFee(e.target.value)}
                step="0.001"
                min="0"
                disabled={isLoading}
              />
              {entryFeeUSD > 0 && (
                <p className="text-xs text-muted-foreground">
                  Entry Fee (USD): ${entryFeeUSD.toFixed(2)}
                </p>
              )}
            </div>

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
              {sumPlusFee && (
                <p className="text-xs text-muted-foreground">
                  Sum (USD): ${sumWithoutFee.toFixed(2)}
                </p>
              )}
            </div>

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
              <p className="text-xs text-muted-foreground">
                Enter the amount from your exchange
              </p>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="openDate">Open Date</Label>
              <Input
                id="openDate"
                type="date"
                value={openDate}
                onChange={(e) => setOpenDate(e.target.value)}
                disabled={isLoading}
              />
            </div>
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
              {isLoading ? 'Creating...' : 'Create Trade'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
