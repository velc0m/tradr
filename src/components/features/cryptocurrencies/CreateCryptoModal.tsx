'use client';

import { useState } from 'react';
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
import { CreateCryptocurrencyInput, ICryptocurrency } from '@/types';

interface CreateCryptoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (crypto: ICryptocurrency) => void;
}

export function CreateCryptoModal({
  open,
  onOpenChange,
  onSuccess,
}: CreateCryptoModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState<CreateCryptocurrencyInput>({
    symbol: '',
    name: '',
    decimalPlaces: 8,
  });
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const response = await fetch('/api/cryptocurrencies', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create cryptocurrency');
      }

      toast({
        title: 'Success',
        description: 'Cryptocurrency created successfully',
      });

      // Reset form
      setFormData({
        symbol: '',
        name: '',
        decimalPlaces: 8,
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
          error instanceof Error ? error.message : 'Failed to create cryptocurrency',
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
          <DialogTitle>Create Custom Cryptocurrency</DialogTitle>
          <DialogDescription>
            Add a custom cryptocurrency to use in your portfolios.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="symbol">
                Symbol <span className="text-destructive">*</span>
              </Label>
              <Input
                id="symbol"
                placeholder="BTC"
                value={formData.symbol}
                onChange={(e) =>
                  setFormData({ ...formData, symbol: e.target.value.toUpperCase() })
                }
                maxLength={10}
                required
                disabled={isLoading}
              />
              <p className="text-xs text-muted-foreground">
                Max 10 characters, will be converted to uppercase
              </p>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="name">
                Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="name"
                placeholder="Bitcoin"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                maxLength={50}
                required
                disabled={isLoading}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="decimalPlaces">Decimal Places</Label>
              <Input
                id="decimalPlaces"
                type="number"
                min={0}
                max={8}
                value={formData.decimalPlaces}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    decimalPlaces: parseInt(e.target.value) || 0,
                  })
                }
                disabled={isLoading}
              />
              <p className="text-xs text-muted-foreground">
                Number of decimal places (0-8)
              </p>
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
              {isLoading ? 'Creating...' : 'Create'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
