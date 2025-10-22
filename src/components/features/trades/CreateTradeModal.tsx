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
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useToast } from '@/components/ui/use-toast';
import { IPortfolio, ITrade, TradeType, TradeStatus } from '@/types';
import { cn } from '@/lib/utils';

interface CreateTradeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  portfolio: IPortfolio;
  onSuccess?: (trade: ITrade) => void;
  prefilledData?: {
    coinSymbol?: string;
    tradeType?: TradeType;
    parentTradeId?: string;
    salePrice?: number;
    maxAmount?: number;
  };
}

export function CreateTradeModal({
  open,
  onOpenChange,
  portfolio,
  onSuccess,
  prefilledData,
}: CreateTradeModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [tradeType, setTradeType] = useState<TradeType>(TradeType.LONG);
  const [coinSymbol, setCoinSymbol] = useState('');
  const [entryPrice, setEntryPrice] = useState('');
  const [depositPercent, setDepositPercent] = useState('');
  const [entryFee, setEntryFee] = useState('0.25');
  const [feeLevel, setFeeLevel] = useState('');
  const [amount, setAmount] = useState('');
  const [sumPlusFee, setSumPlusFee] = useState('');
  const [openTrades, setOpenTrades] = useState<ITrade[]>([]);
  const [parentTradeId, setParentTradeId] = useState<string | undefined>(undefined);

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

  // Fetch entry fee and open trades when modal opens
  useEffect(() => {
    if (open) {
      fetchEntryFee();
      fetchOpenTrades();
    }
  }, [open]);

  // Auto-calculate depositPercent for SHORT
  useEffect(() => {
    if (tradeType === TradeType.SHORT && portfolio && sumPlusFee) {
      const calculatedPercent = (parseFloat(sumPlusFee) / portfolio.totalDeposit) * 100;
      if (calculatedPercent > 0) {
        setDepositPercent(calculatedPercent.toFixed(2));
      }
    }
  }, [tradeType, sumPlusFee, portfolio]);

  // Auto-calculate amount for LONG trades
  useEffect(() => {
    if (tradeType === TradeType.LONG && sumPlusFee && entryPrice && entryFee && coinSymbol) {
      const gross = parseFloat(sumPlusFee);
      const price = parseFloat(entryPrice);
      const fee = parseFloat(entryFee);

      if (gross > 0 && price > 0) {
        const netAmount = gross * 100 / (100 + fee);
        const calculatedAmount = netAmount / price;

        if (calculatedAmount > 0) {
          const coin = portfolio.coins.find(c => c.symbol === coinSymbol);
          const decimalPlaces = coin?.decimalPlaces || 8;
          setAmount(calculatedAmount.toFixed(decimalPlaces));
        }
      }
    }
  }, [tradeType, sumPlusFee, entryPrice, entryFee, coinSymbol, portfolio.coins]);

  // Auto-calculate sumPlusFee for SHORT trades
  useEffect(() => {
    if (tradeType === TradeType.SHORT && amount && entryPrice) {
      const amt = parseFloat(amount);
      const price = parseFloat(entryPrice);

      if (amt > 0 && price > 0) {
        const calculatedSumPlusFee = amt * price;
        if (calculatedSumPlusFee > 0) {
          setSumPlusFee(calculatedSumPlusFee.toFixed(2));
        }
      }
    }
  }, [tradeType, amount, entryPrice]);

  // Handle prefilled data
  useEffect(() => {
    if (open && prefilledData) {
      if (prefilledData.coinSymbol) setCoinSymbol(prefilledData.coinSymbol);
      if (prefilledData.tradeType) setTradeType(prefilledData.tradeType);
      if (prefilledData.salePrice) setEntryPrice(prefilledData.salePrice.toString());
      if (prefilledData.maxAmount) setAmount(prefilledData.maxAmount.toString());
      if (prefilledData.parentTradeId) setParentTradeId(prefilledData.parentTradeId);
    }
  }, [open, prefilledData]);

  const fetchEntryFee = async () => {
    try {
      // For SHORT with parentTradeId, include parent trade in volume calculation
      const includeParam = parentTradeId ? `&includeTradeId=${parentTradeId}` : '';
      const response = await fetch(
        `/api/portfolios/${portfolio._id}/calculate-fee?type=entry${includeParam}`
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

  const fetchOpenTrades = async () => {
    try {
      const response = await fetch(`/api/portfolios/${portfolio._id}/trades`);
      const data = await response.json();

      if (data.success && data.data) {
        // Filter only OPEN and FILLED trades
        const activeTrades = data.data.filter(
          (trade: ITrade) =>
            trade.status === TradeStatus.OPEN || trade.status === TradeStatus.FILLED
        );
        setOpenTrades(activeTrades);
      }
    } catch (error) {
      console.error('Failed to fetch trades:', error);
      setOpenTrades([]);
    }
  };

  // Check if SHORT is available for selected coin
  const shortAvailability = useMemo(() => {
    if (!coinSymbol) {
      return { available: false, reason: 'Select a coin first' };
    }

    // If opening SHORT from specific LONG (parentTradeId exists in prefilledData)
    if (prefilledData?.parentTradeId && prefilledData?.maxAmount) {
      return {
        available: true,
        amount: prefilledData.maxAmount,
        fromInitialCoins: 0,
        fromOpenTrades: prefilledData.maxAmount,
        isFromSpecificLong: true,
      };
    }

    // Otherwise, calculate available from all sources
    // Check if coin is in initialCoins
    const initialCoin = portfolio.initialCoins?.find(
      (coin) => coin.symbol === coinSymbol
    );

    // Check if there are open LONG trades for this coin
    const openLongTrades = openTrades.filter(
      (trade) => trade.coinSymbol === coinSymbol && trade.tradeType === TradeType.LONG
    );

    // Calculate available amount
    let availableAmount = 0;

    if (initialCoin) {
      availableAmount += initialCoin.amount;
    }

    if (openLongTrades.length > 0) {
      // Sum up amounts from all open LONG trades
      openLongTrades.forEach((trade) => {
        availableAmount += trade.amount;
      });
    }

    if (availableAmount > 0) {
      return {
        available: true,
        amount: availableAmount,
        fromInitialCoins: initialCoin?.amount || 0,
        fromOpenTrades: availableAmount - (initialCoin?.amount || 0),
        isFromSpecificLong: false,
      };
    }

    return {
      available: false,
      reason: 'No coins available for SHORT',
      amount: 0,
    };
  }, [coinSymbol, portfolio.initialCoins, openTrades, prefilledData]);

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

  // Calculate expected sum based on deposit %
  const expectedSum = useMemo(() => {
    const deposit = portfolio.totalDeposit;
    const percent = parseFloat(depositPercent) || 0;
    return (deposit * percent) / 100;
  }, [portfolio.totalDeposit, depositPercent]);

  // Check if there's a significant difference (more than 10%)
  const sumDifferenceWarning = useMemo(() => {
    const actualSum = parseFloat(sumPlusFee) || 0;
    const expected = expectedSum;

    // Only show warning if both values are present
    if (actualSum === 0 || expected === 0) {
      return null;
    }

    const difference = Math.abs(actualSum - expected);
    const percentDifference = (difference / expected) * 100;

    // Show warning if difference is more than 10%
    if (percentDifference > 10) {
      return {
        actualSum,
        expectedSum: expected,
        percentDifference: percentDifference.toFixed(1),
      };
    }

    return null;
  }, [sumPlusFee, expectedSum]);

  // Handle trade type change - reset form when switching
  const handleTradeTypeChange = (newType: string) => {
    setTradeType(newType as TradeType);
    // Reset form fields when switching type
    setEntryPrice('');
    setDepositPercent('');
    setAmount('');
    setSumPlusFee('');
  };

  // Calculate Net Received for SHORT (after entry fee)
  const netReceivedUSD = useMemo(() => {
    if (tradeType === TradeType.SHORT) {
      const gross = parseFloat(sumPlusFee) || 0;
      const fee = parseFloat(entryFee) || 0;
      return gross * (100 - fee) / 100;
    }
    return 0;
  }, [tradeType, sumPlusFee, entryFee]);

  // Dynamic labels based on trade type
  const labels = useMemo(() => {
    if (tradeType === TradeType.SHORT) {
      return {
        entryPrice: 'Sale Price (USD)',
        sumPlusFee: 'Sale Amount (Gross, USD)',
        depositPercent: 'Deposit %',
      };
    }
    return {
      entryPrice: 'Entry Price (USD)',
      sumPlusFee: 'Sum + Fee (USD)',
      depositPercent: 'Deposit %',
    };
  }, [tradeType]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const payload: any = {
        coinSymbol,
        tradeType,
        entryPrice: parseFloat(entryPrice),
        depositPercent: parseFloat(depositPercent),
        entryFee: parseFloat(entryFee),
        amount: parseFloat(amount),
        sumPlusFee: parseFloat(sumPlusFee),
        openDate: openDate,
      };

      // Add parentTradeId for SHORT trades from LONG positions
      if (tradeType === TradeType.SHORT && parentTradeId) {
        payload.parentTradeId = parentTradeId;
      }

      const response = await fetch(`/api/portfolios/${portfolio._id}/trades`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
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
      setTradeType(TradeType.LONG);
      setCoinSymbol('');
      setEntryPrice('');
      setDepositPercent('');
      setEntryFee('0.25');
      setAmount('');
      setSumPlusFee('');
      setOpenDate(getLocalDateString());
      setParentTradeId(undefined);

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
              <Select
                value={coinSymbol}
                onValueChange={setCoinSymbol}
                required
                disabled={isLoading || !!prefilledData?.coinSymbol}
              >
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
              <Label>
                Trade Type <span className="text-destructive">*</span>
              </Label>
              <RadioGroup
                value={tradeType}
                onValueChange={handleTradeTypeChange}
                className="flex gap-4"
                disabled={!!prefilledData?.tradeType}
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem
                    value={TradeType.LONG}
                    id="long"
                    disabled={!!prefilledData?.tradeType}
                  />
                  <Label htmlFor="long" className="font-normal cursor-pointer">
                    LONG
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem
                    value={TradeType.SHORT}
                    id="short"
                    disabled={!shortAvailability.available || !!prefilledData?.tradeType}
                  />
                  <Label
                    htmlFor="short"
                    className={cn(
                      "font-normal cursor-pointer",
                      (!shortAvailability.available || !!prefilledData?.tradeType) && "opacity-50 cursor-not-allowed"
                    )}
                  >
                    SHORT
                  </Label>
                </div>
              </RadioGroup>
              {!shortAvailability.available && coinSymbol && (
                <p className="text-xs text-muted-foreground">
                  {shortAvailability.reason}
                </p>
              )}
              {shortAvailability.available && tradeType === TradeType.SHORT && (
                <div className="text-xs text-muted-foreground">
                  Available: {shortAvailability.amount?.toFixed(8)} {coinSymbol}
                  {!shortAvailability.isFromSpecificLong && shortAvailability.fromInitialCoins > 0 && (
                    <span className="text-blue-400">
                      {' '}({shortAvailability.fromInitialCoins.toFixed(8)} from initial coins)
                    </span>
                  )}
                </div>
              )}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="entryPrice">
                {labels.entryPrice} <span className="text-destructive">*</span>
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

            {/* Only show Deposit % for LONG trades */}
            {tradeType === TradeType.LONG && (
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
            )}

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
                {labels.sumPlusFee} <span className="text-destructive">*</span>
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
              {tradeType === TradeType.SHORT && sumPlusFee && (
                <p className="text-xs text-muted-foreground">
                  Enter total sale value shown on exchange (before fee deduction)
                </p>
              )}
              {tradeType === TradeType.SHORT && netReceivedUSD > 0 && (
                <p className="text-xs text-green-600 dark:text-green-500">
                  Net Received (after {entryFee}% fee): ${netReceivedUSD.toFixed(2)}
                </p>
              )}
              {tradeType === TradeType.LONG && sumPlusFee && (
                <p className="text-xs text-muted-foreground">
                  Sum (USD): ${sumWithoutFee.toFixed(2)}
                </p>
              )}
              {sumDifferenceWarning && tradeType === TradeType.LONG && (
                <div className="flex items-start gap-2 p-2 rounded-md bg-yellow-500/10 border border-yellow-500/20">
                  <span className="text-yellow-600 dark:text-yellow-500">⚠️</span>
                  <p className="text-xs text-yellow-600 dark:text-yellow-500 flex-1">
                    Sum+Fee (${sumDifferenceWarning.actualSum.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}) significantly differs from calculated amount (${sumDifferenceWarning.expectedSum.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}) based on {depositPercent}% deposit ({sumDifferenceWarning.percentDifference}% difference)
                  </p>
                </div>
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
                {tradeType === TradeType.LONG
                  ? 'Auto-calculated (editable)'
                  : 'Enter the amount from your exchange'}
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
