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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { CreateCryptoModal } from '@/components/features/cryptocurrencies/CreateCryptoModal';
import { ICryptocurrency, IPortfolioCoin, IPortfolio, IInitialCoin } from '@/types';
import { Plus, X } from 'lucide-react';

interface EditPortfolioModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  portfolio: IPortfolio;
  onSuccess?: (portfolio: IPortfolio) => void;
}

export function EditPortfolioModal({
  open,
  onOpenChange,
  portfolio,
  onSuccess,
}: EditPortfolioModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [cryptocurrencies, setCryptocurrencies] = useState<ICryptocurrency[]>([]);
  const [showCreateCrypto, setShowCreateCrypto] = useState(false);
  const [name, setName] = useState(portfolio.name);
  const [totalDeposit, setTotalDeposit] = useState(
    portfolio.totalDeposit.toString()
  );
  const [coins, setCoins] = useState<IPortfolioCoin[]>(portfolio.coins);
  const [initialCoins, setInitialCoins] = useState<IInitialCoin[]>(
    portfolio.initialCoins || []
  );
  const { toast } = useToast();

  // Reset form when portfolio changes
  useEffect(() => {
    console.log('EditPortfolioModal - Portfolio data:', JSON.stringify(portfolio, null, 2));
    console.log('EditPortfolioModal - Initial coins from portfolio:', portfolio.initialCoins);

    setName(portfolio.name);
    setTotalDeposit(portfolio.totalDeposit.toString());
    setCoins(portfolio.coins);
    setInitialCoins(portfolio.initialCoins || []);
  }, [portfolio]);

  // Fetch cryptocurrencies when modal opens
  useEffect(() => {
    if (open) {
      fetchCryptocurrencies();
    }
  }, [open]);

  const fetchCryptocurrencies = async () => {
    try {
      const response = await fetch('/api/cryptocurrencies');
      const data = await response.json();

      if (data.success && data.data) {
        setCryptocurrencies(data.data);
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to load cryptocurrencies',
        variant: 'destructive',
      });
    }
  };

  const addCoin = () => {
    setCoins((prevCoins) => [
      ...prevCoins,
      { symbol: '', percentage: 0, decimalPlaces: 8 },
    ]);
  };

  const removeCoin = (index: number) => {
    setCoins((prevCoins) => {
      if (prevCoins.length > 1) {
        return prevCoins.filter((_, i) => i !== index);
      }
      return prevCoins;
    });
  };

  const updateCoin = (
    index: number,
    field: keyof IPortfolioCoin,
    value: string | number
  ) => {
    setCoins((prevCoins) => {
      const newCoins = [...prevCoins];
      newCoins[index] = { ...newCoins[index], [field]: value };
      return newCoins;
    });
  };

  const handleSymbolChange = (index: number, symbol: string) => {
    const crypto = cryptocurrencies.find((c) => c.symbol === symbol);
    if (crypto) {
      setCoins((prevCoins) => {
        const newCoins = [...prevCoins];
        newCoins[index] = {
          ...newCoins[index],
          symbol: symbol,
          decimalPlaces: crypto.decimalPlaces,
        };
        return newCoins;
      });
    }
  };

  const addInitialCoin = () => {
    setInitialCoins((prevCoins) => [
      ...prevCoins,
      { symbol: '', amount: 0 },
    ]);
  };

  const removeInitialCoin = (index: number) => {
    setInitialCoins((prevCoins) => prevCoins.filter((_, i) => i !== index));
  };

  const updateInitialCoin = (
    index: number,
    field: keyof IInitialCoin,
    value: string | number
  ) => {
    setInitialCoins((prevCoins) => {
      const newCoins = [...prevCoins];
      newCoins[index] = { ...newCoins[index], [field]: value };
      return newCoins;
    });
  };

  const getTotalPercentage = () => {
    return coins.reduce((sum, coin) => sum + coin.percentage, 0);
  };

  const isValid = () => {
    const totalPercentage = getTotalPercentage();
    const hasEmptySymbols = coins.some((coin) => !coin.symbol);
    const hasValidDeposit = parseFloat(totalDeposit) > 0;
    const hasInvalidInitialCoins = initialCoins.some(
      (coin) => !coin.symbol || coin.amount <= 0
    );

    return (
      name.trim() !== '' &&
      hasValidDeposit &&
      !hasEmptySymbols &&
      Math.abs(totalPercentage - 100) < 0.01 &&
      !hasInvalidInitialCoins
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isValid()) {
      toast({
        title: 'Validation Error',
        description: 'Please ensure all fields are filled and percentages sum to 100%',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);

    try {
      const payload = {
        name: name.trim(),
        totalDeposit: parseFloat(totalDeposit),
        coins,
        initialCoins: initialCoins.length > 0 ? initialCoins : undefined,
      };

      console.log('Updating portfolio with payload:', JSON.stringify(payload, null, 2));
      console.log('Current initialCoins state:', initialCoins);

      const response = await fetch(`/api/portfolios/${portfolio._id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update portfolio');
      }

      toast({
        title: 'Success',
        description: 'Portfolio updated successfully',
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
          error instanceof Error ? error.message : 'Failed to update portfolio',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCryptoCreated = (crypto: ICryptocurrency) => {
    setCryptocurrencies([...cryptocurrencies, crypto]);
  };

  const totalPercentage = getTotalPercentage();
  const percentageError = Math.abs(totalPercentage - 100) >= 0.01;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Portfolio</DialogTitle>
            <DialogDescription>
              Update your portfolio settings and coin allocation.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="name">
                  Portfolio Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="name"
                  placeholder="My Portfolio"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={100}
                  required
                  disabled={isLoading}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="totalDeposit">
                  Total Deposit (USD) <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="totalDeposit"
                  type="number"
                  placeholder="10000"
                  value={totalDeposit}
                  onChange={(e) => setTotalDeposit(e.target.value)}
                  min={0}
                  step="0.01"
                  required
                  disabled={isLoading}
                />
              </div>

              <div className="grid gap-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm text-muted-foreground">
                    Initial Coins (Optional)
                  </Label>
                </div>
                <p className="text-xs text-muted-foreground">
                  Add coins you already own that are not purchased with the deposit
                </p>

                {initialCoins.length > 0 && (
                  <div className="grid gap-3">
                    {initialCoins.map((coin, index) => (
                      <div
                        key={index}
                        className="grid grid-cols-[1fr_140px_auto] gap-2 items-end"
                      >
                        <div className="grid gap-1">
                          <Label className="text-xs">Cryptocurrency</Label>
                          <Select
                            value={coin.symbol}
                            onValueChange={(value) =>
                              updateInitialCoin(index, 'symbol', value.toUpperCase())
                            }
                            disabled={isLoading}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select coin" />
                            </SelectTrigger>
                            <SelectContent>
                              {cryptocurrencies.map((crypto) => (
                                <SelectItem key={crypto._id} value={crypto.symbol}>
                                  {crypto.symbol} - {crypto.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="grid gap-1">
                          <Label className="text-xs">Amount</Label>
                          <Input
                            type="number"
                            placeholder="1.5"
                            value={coin.amount || ''}
                            onChange={(e) =>
                              updateInitialCoin(
                                index,
                                'amount',
                                parseFloat(e.target.value) || 0
                              )
                            }
                            min={0}
                            step="0.00000001"
                            disabled={isLoading}
                          />
                        </div>

                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeInitialCoin(index)}
                          disabled={isLoading}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addInitialCoin}
                  disabled={isLoading}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Add Initial Coin
                </Button>
              </div>

              <div className="grid gap-2">
                <div className="flex items-center justify-between">
                  <Label>Coin Allocation</Label>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setShowCreateCrypto(true)}
                      disabled={isLoading}
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Create Custom Crypto
                    </Button>
                  </div>
                </div>

                <div className="grid gap-3">
                  {coins.map((coin, index) => (
                    <div
                      key={index}
                      className="grid grid-cols-[1fr_100px_auto] gap-2 items-end"
                    >
                      <div className="grid gap-1">
                        <Label className="text-xs">Cryptocurrency</Label>
                        <Select
                          value={coin.symbol}
                          onValueChange={(value) => handleSymbolChange(index, value)}
                          disabled={isLoading}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select coin" />
                          </SelectTrigger>
                          <SelectContent>
                            {cryptocurrencies.map((crypto) => (
                              <SelectItem key={crypto._id} value={crypto.symbol}>
                                {crypto.symbol} - {crypto.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="grid gap-1">
                        <Label className="text-xs">Percentage</Label>
                        <Input
                          type="number"
                          placeholder="0"
                          value={coin.percentage || ''}
                          onChange={(e) =>
                            updateCoin(
                              index,
                              'percentage',
                              parseFloat(e.target.value) || 0
                            )
                          }
                          min={0}
                          max={100}
                          step="0.01"
                          disabled={isLoading}
                        />
                      </div>

                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeCoin(index)}
                        disabled={coins.length === 1 || isLoading}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>

                <div className="flex items-center justify-between text-sm">
                  <span className={percentageError ? 'text-destructive' : ''}>
                    Total: {totalPercentage.toFixed(2)}%
                  </span>
                  {percentageError && (
                    <span className="text-destructive text-xs">
                      Must equal 100%
                    </span>
                  )}
                </div>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addCoin}
                  disabled={isLoading}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Add Coin
                </Button>
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
              <Button type="submit" disabled={isLoading || !isValid()}>
                {isLoading ? 'Updating...' : 'Update Portfolio'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <CreateCryptoModal
        open={showCreateCrypto}
        onOpenChange={setShowCreateCrypto}
        onSuccess={handleCryptoCreated}
      />
    </>
  );
}
