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
import { ITrade, TradeStatus } from '@/types';

interface MarkAsFilledDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trade: ITrade | null;
  onSuccess?: (trade: ITrade) => void;
}

export function MarkAsFilledDialog({
  open,
  onOpenChange,
  trade,
  onSuccess,
}: MarkAsFilledDialogProps) {
  const [isLoading, setIsLoading] = useState(false);

  // Get today's date in local timezone (not UTC)
  const getLocalDateString = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const [filledDate, setFilledDate] = useState(getLocalDateString());
  const { toast } = useToast();

  const handleConfirm = async () => {
    if (!trade) return;

    setIsLoading(true);

    try {
      const response = await fetch(`/api/trades/${trade._id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status: TradeStatus.FILLED,
          filledDate: filledDate,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to mark trade as filled');
      }

      toast({
        title: 'Success',
        description: 'Trade marked as filled',
      });

      onOpenChange(false);

      if (onSuccess && data.data) {
        onSuccess(data.data);
      }
    } catch (error) {
      toast({
        title: 'Error',
        description:
          error instanceof Error ? error.message : 'Failed to mark trade as filled',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>Confirm Fill</DialogTitle>
          <DialogDescription>
            Set the date when this trade was filled on the exchange
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="filledDate">Fill Date</Label>
            <Input
              id="filledDate"
              type="date"
              value={filledDate}
              onChange={(e) => setFilledDate(e.target.value)}
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
          <Button onClick={handleConfirm} disabled={isLoading}>
            {isLoading ? 'Confirming...' : 'Confirm'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
