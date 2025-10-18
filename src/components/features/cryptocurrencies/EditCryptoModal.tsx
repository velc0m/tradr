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
import { ICryptocurrency } from '@/types';

interface EditCryptoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cryptocurrency: ICryptocurrency;
  onSuccess?: (crypto: ICryptocurrency) => void;
}

export function EditCryptoModal({
  open,
  onOpenChange,
  cryptocurrency,
  onSuccess,
}: EditCryptoModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [name, setName] = useState(cryptocurrency.name);
  const [decimalPlaces, setDecimalPlaces] = useState(
    cryptocurrency.decimalPlaces
  );
  const { toast } = useToast();

  // Reset form when cryptocurrency changes
  useEffect(() => {
    setName(cryptocurrency.name);
    setDecimalPlaces(cryptocurrency.decimalPlaces);
  }, [cryptocurrency]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const response = await fetch(`/api/cryptocurrencies/${cryptocurrency._id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: name.trim(),
          decimalPlaces,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update cryptocurrency');
      }

      toast({
        title: 'Success',
        description: 'Cryptocurrency updated successfully',
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
          error instanceof Error
            ? error.message
            : 'Failed to update cryptocurrency',
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
          <DialogTitle>Edit Cryptocurrency</DialogTitle>
          <DialogDescription>
            Update the details of your custom cryptocurrency.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="symbol">Symbol</Label>
              <Input
                id="symbol"
                value={cryptocurrency.symbol}
                disabled
                className="bg-muted"
              />
              <p className="text-xs text-muted-foreground">
                Symbol cannot be changed
              </p>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="name">
                Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="name"
                placeholder="Bitcoin"
                value={name}
                onChange={(e) => setName(e.target.value)}
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
                value={decimalPlaces}
                onChange={(e) => setDecimalPlaces(parseInt(e.target.value) || 0)}
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
              {isLoading ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
