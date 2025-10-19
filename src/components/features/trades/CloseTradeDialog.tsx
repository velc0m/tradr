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

interface CloseTradeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trade: ITrade | null;
  onSuccess?: (trade: ITrade) => void;
}

export function CloseTradeDialog({
  open,
  onOpenChange,
  trade,
  onSuccess,
}: CloseTradeDialogProps) {
  const [isLoading, setIsLoading] = useState(false);

  // Get today's date in local timezone (not UTC)
  const getLocalDateString = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const [closeDate, setCloseDate] = useState(getLocalDateString());
  const { toast } = useToast();

  const handleConfirm = async () => {
    if (!trade) return;

    if (!trade.exitPrice) {
      toast({
        title: 'Error',
        description: 'Cannot close trade without Exit Price. Please set Exit Price first.',
        variant: 'destructive',
      });
      onOpenChange(false);
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch(`/api/trades/${trade._id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status: TradeStatus.CLOSED,
          closeDate: closeDate,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to close trade');
      }

      toast({
        title: 'Success',
        description: 'Trade closed successfully',
      });

      onOpenChange(false);

      if (onSuccess && data.data) {
        onSuccess(data.data);
      }
    } catch (error) {
      toast({
        title: 'Error',
        description:
          error instanceof Error ? error.message : 'Failed to close trade',
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
          <DialogTitle>Close Trade</DialogTitle>
          <DialogDescription>
            Are you sure you want to close this trade? It will be moved to Closed Trades.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="closeDate">Close Date</Label>
            <Input
              id="closeDate"
              type="date"
              value={closeDate}
              onChange={(e) => setCloseDate(e.target.value)}
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
            {isLoading ? 'Closing...' : 'Close Trade'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
