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
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue,} from '@/components/ui/select';
import {useToast} from '@/components/ui/use-toast';
import {ITrade, TradeType} from '@/types';

interface SplitTradeModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    trade: ITrade | null;
    onSuccess?: () => void;
}

export function SplitTradeModal({
                                    open,
                                    onOpenChange,
                                    trade,
                                    onSuccess,
                                }: SplitTradeModalProps) {
    const [isLoading, setIsLoading] = useState(false);
    const [numParts, setNumParts] = useState('2');
    const [amounts, setAmounts] = useState<string[]>(['', '']);
    const {toast} = useToast();

    // Reset form when modal opens with new trade
    useEffect(() => {
        if (open && trade) {
            setNumParts('2');
            setAmounts(['', '']);
        }
    }, [open, trade]);

    // Update amounts array when number of parts changes
    useEffect(() => {
        const num = parseInt(numParts);
        if (num >= 2 && num <= 5) {
            setAmounts(new Array(num).fill(''));
        }
    }, [numParts]);

    if (!trade) return null;

    const formatAmount = (amount: number): string => {
        const formatted = amount.toFixed(8);
        const trimmed = formatted.replace(/\.?0+$/, '');
        return trimmed;
    };

    const formatPrice = (price: number): string => {
        const formatted = price.toFixed(2);
        const trimmed = formatted.replace(/\.?0+$/, '');
        return trimmed;
    };

    // Calculate totals and validation
    const parsedAmounts = amounts.map(a => parseFloat(a) || 0);
    const totalAmount = parsedAmounts.reduce((sum, amt) => sum + amt, 0);
    const remaining = trade.amount - totalAmount;
    const tolerance = 1e-8;
    const isValid = Math.abs(remaining) < tolerance && parsedAmounts.every(a => a > 0);

    // Calculate preview for each part
    const previews = parsedAmounts.map(amt => {
        if (amt <= 0) return null;
        const proportion = amt / trade.amount;
        const sumPlusFee = trade.sumPlusFee * proportion;
        const percentage = (proportion * 100).toFixed(2);
        return {amount: amt, sumPlusFee, percentage};
    });

    const handleAmountChange = (index: number, value: string) => {
        const newAmounts = [...amounts];
        newAmounts[index] = value;
        setAmounts(newAmounts);
    };

    const handleAutoFill = (index: number) => {
        const currentTotal = parsedAmounts.reduce((sum, amt, i) => {
            return i === index ? sum : sum + amt;
        }, 0);
        const autoValue = trade.amount - currentTotal;

        if (autoValue > 0) {
            const newAmounts = [...amounts];
            newAmounts[index] = autoValue.toFixed(8).replace(/\.?0+$/, '');
            setAmounts(newAmounts);
        }
    };

    const handleSplitEvenly = () => {
        const num = parseInt(numParts);

        // Determine decimal precision from original amount
        const amountStr = trade.amount.toString();
        const decimalIndex = amountStr.indexOf('.');
        const precision = decimalIndex >= 0 ? amountStr.length - decimalIndex - 1 : 0;
        const maxPrecision = Math.min(precision, 10); // Max 10 decimal places

        const newAmounts: string[] = [];
        let remaining = trade.amount;

        // For all parts except the last: round down to keep precision
        for (let i = 0; i < num - 1; i++) {
            const equalPart = trade.amount / num;
            // Round down to maintain precision
            const factor = Math.pow(10, maxPrecision);
            const roundedDown = Math.floor(equalPart * factor) / factor;
            newAmounts.push(roundedDown.toFixed(maxPrecision).replace(/\.?0+$/, ''));
            remaining -= roundedDown;
        }

        // Last part gets the remainder (ensures exact sum)
        newAmounts.push(remaining.toFixed(maxPrecision).replace(/\.?0+$/, ''));

        setAmounts(newAmounts);
    };

    const handleSplit = async () => {
        if (!trade) return;

        if (!isValid) {
            toast({
                title: 'Error',
                description: 'Please ensure all amounts are positive and sum equals total amount',
                variant: 'destructive',
            });
            return;
        }

        setIsLoading(true);

        try {
            const response = await fetch(`/api/trades/${trade._id}/split`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    amounts: parsedAmounts,
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to split trade');
            }

            toast({
                title: 'Success',
                description: `Trade successfully split into ${parsedAmounts.length} positions`,
            });

            onOpenChange(false);

            if (onSuccess) {
                onSuccess();
            }
        } catch (error) {
            toast({
                title: 'Error',
                description:
                    error instanceof Error ? error.message : 'Failed to split trade',
                variant: 'destructive',
            });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[600px]">
                <DialogHeader>
                    <DialogTitle>Split Position</DialogTitle>
                    <DialogDescription>
                        Divide your {trade.coinSymbol} position into multiple independent positions
                    </DialogDescription>
                </DialogHeader>

                <div className="grid gap-4 py-4">
                    {/* Trade Info */}
                    <div className="grid grid-cols-3 gap-4 p-4 rounded-lg bg-muted/50">
                        <div>
                            <div className="text-xs text-muted-foreground">Coin</div>
                            <div className="font-medium">{trade.coinSymbol}</div>
                        </div>
                        <div>
                            <div className="text-xs text-muted-foreground">
                                {trade.tradeType === TradeType.SHORT ? 'Sale Price' : 'Entry Price'}
                            </div>
                            <div className="font-medium">${formatPrice(trade.entryPrice)}</div>
                        </div>
                        <div>
                            <div className="text-xs text-muted-foreground">Total Amount</div>
                            <div className="font-medium">{formatAmount(trade.amount)}</div>
                        </div>
                    </div>

                    {/* Number of Parts */}
                    <div className="grid gap-2">
                        <Label htmlFor="numParts">Split into how many parts? *</Label>
                        <Select value={numParts} onValueChange={setNumParts}>
                            <SelectTrigger id="numParts">
                                <SelectValue placeholder="Select number of parts"/>
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="2">2 parts</SelectItem>
                                <SelectItem value="3">3 parts</SelectItem>
                                <SelectItem value="4">4 parts</SelectItem>
                                <SelectItem value="5">5 parts</SelectItem>
                            </SelectContent>
                        </Select>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={handleSplitEvenly}
                            className="mt-2 w-full"
                            disabled={isLoading}
                        >
                            Split Evenly ({numParts} equal parts)
                        </Button>
                    </div>

                    {/* Amount Inputs */}
                    <div className="grid gap-3">
                        <Label>Amount for each part *</Label>
                        {amounts.map((amount, index) => (
                            <div key={index} className="flex gap-2 items-center">
                <span className="text-sm text-muted-foreground w-16">
                  Part {index + 1}:
                </span>
                                <Input
                                    type="number"
                                    step="any"
                                    placeholder="0.00000000"
                                    value={amount}
                                    onChange={(e) => handleAmountChange(index, e.target.value)}
                                    disabled={isLoading}
                                    className="flex-1"
                                />
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleAutoFill(index)}
                                    disabled={isLoading}
                                >
                                    Auto
                                </Button>
                            </div>
                        ))}
                    </div>

                    {/* Validation Display */}
                    <div className="p-3 rounded-lg bg-muted/50 border">
                        <div className="grid grid-cols-2 gap-2 text-sm">
                            <div className="text-muted-foreground">Total Amount:</div>
                            <div className={`font-medium ${isValid ? 'text-green-500' : 'text-yellow-500'}`}>
                                {formatAmount(totalAmount)}
                            </div>

                            <div className="text-muted-foreground">Required:</div>
                            <div className="font-medium">{formatAmount(trade.amount)}</div>

                            <div className="text-muted-foreground">Remaining:</div>
                            <div
                                className={`font-medium ${Math.abs(remaining) < tolerance ? 'text-green-500' : 'text-red-500'}`}>
                                {remaining >= 0 ? '+' : ''}{formatAmount(remaining)}
                            </div>
                        </div>
                    </div>

                    {/* Preview Table */}
                    {previews.some(p => p !== null) && (
                        <div className="border rounded-lg overflow-hidden">
                            <div className="bg-muted px-3 py-2 text-sm font-semibold">Preview</div>
                            <div className="divide-y">
                                {previews.map((preview, index) => {
                                    if (!preview) return null;
                                    return (
                                        <div key={index} className="grid grid-cols-4 gap-2 px-3 py-2 text-sm">
                                            <div className="text-muted-foreground">Part {index + 1}:</div>
                                            <div className="font-medium">{formatAmount(preview.amount)}</div>
                                            <div className="text-right">${preview.sumPlusFee.toFixed(2)}</div>
                                            <div className="text-right text-muted-foreground">{preview.percentage}%
                                            </div>
                                        </div>
                                    );
                                })}
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
                    <Button onClick={handleSplit} disabled={isLoading || !isValid}>
                        {isLoading ? 'Splitting...' : 'Split Position'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
