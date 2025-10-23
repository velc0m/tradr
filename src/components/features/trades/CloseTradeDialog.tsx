'use client';

import {useEffect, useState} from 'react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {Label} from '@/components/ui/label';
import {useToast} from '@/components/ui/use-toast';
import {ITrade, TradeStatus, TradeType} from '@/types';

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
    const [exitFee, setExitFee] = useState('0.6');
    const [feeLevel, setFeeLevel] = useState('');

    // Get today's date in local timezone (not UTC)
    const getLocalDateString = () => {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    const [closeDate, setCloseDate] = useState(getLocalDateString());
    const {toast} = useToast();

    // Fetch exit fee when modal opens
    useEffect(() => {
        if (open && trade) {
            fetchExitFee();
        }
    }, [open, trade]);

    const fetchExitFee = async () => {
        if (!trade) return;

        try {
            // Always fetch current fee from API to show current tier
            const response = await fetch(
                `/api/portfolios/${trade.portfolioId}/calculate-fee?type=exit&includeTradeId=${trade._id}`
            );
            const data = await response.json();

            if (data.success && data.data) {
                setFeeLevel(data.data.level);

                // If exitFee is already set (from Set Exit Price), use it
                // Otherwise use current fee from API
                if (trade.exitFee !== undefined && trade.exitFee !== null) {
                    setExitFee(trade.exitFee.toFixed(3));
                } else {
                    setExitFee(data.data.feePercent.toFixed(3));
                }
            }
        } catch (error) {
            console.error('Failed to fetch exit fee:', error);
            // Use saved exitFee or entryFee as fallback
            setExitFee((trade.exitFee || trade.entryFee || 0.6).toString());
        }
    };

    const handleConfirm = async () => {
        if (!trade) return;

        if (!trade.exitPrice) {
            const priceLabel = trade.tradeType === TradeType.SHORT ? 'Buy Back Price' : 'Exit Price';
            toast({
                title: 'Error',
                description: `Cannot close trade without ${priceLabel}. Please set ${priceLabel} first.`,
                variant: 'destructive',
            });
            onOpenChange(false);
            return;
        }

        // Prevent closing LONG if there are active SHORT positions from it
        if (trade.tradeType === TradeType.LONG) {
            try {
                const tradesResponse = await fetch(`/api/portfolios/${trade.portfolioId}/trades`);
                const tradesData = await tradesResponse.json();

                if (tradesData.success && tradesData.data) {
                    const activeShorts = tradesData.data.filter(
                        (t: ITrade) =>
                            t.tradeType === TradeType.SHORT &&
                            t.parentTradeId === trade._id &&
                            t.status !== TradeStatus.CLOSED
                    );

                    if (activeShorts.length > 0) {
                        toast({
                            title: 'Cannot Close Position',
                            description: `This LONG has ${activeShorts.length} active SHORT position(s). Close all SHORTs first.`,
                            variant: 'destructive',
                        });
                        onOpenChange(false);
                        return;
                    }
                }
            } catch (error) {
                console.error('Failed to check active SHORTs:', error);
            }
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
                    exitFee: parseFloat(exitFee), // Update exit fee on close
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

                    <div className="grid gap-2">
                        <Label htmlFor="exitFee">
                            Exit Fee (%)
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
                        <p className="text-xs text-muted-foreground">
                            Current fee based on your 30-day trading volume. You can edit if needed.
                        </p>
                    </div>

                    {trade && trade.exitPrice && (
                        <div className="grid gap-2 p-3 rounded-lg bg-muted/50">
                            <div className="text-sm space-y-1">
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Exit Price:</span>
                                    <span className="font-medium">${trade.exitPrice}</span>
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
                        {isLoading ? 'Closing...' : 'Close Trade'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
