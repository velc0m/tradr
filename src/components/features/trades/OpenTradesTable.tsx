import {Button} from '@/components/ui/button';
import {Card, CardContent, CardHeader, CardTitle} from '@/components/ui/card';
import {Table, TableBody, TableCell, TableHead, TableHeader, TableRow} from '@/components/ui/table';
import {BlurredAmount} from '@/components/ui/BlurredAmount';
import {ITrade, TradeStatus, TradeType} from '@/types';
import {
    Check,
    CornerDownRight,
    DollarSign,
    MinusCircle,
    Pencil,
    Plus,
    Trash2,
    TrendingDown
} from 'lucide-react';

interface GroupedTrade {
    parent: ITrade;
    children: ITrade[];
    splitSiblings?: ITrade[];
    splitInfo?: { part: number; total: number };
}

interface OpenTradesTableProps {
    groupedOpenTrades: GroupedTrade[];
    onCreateTrade: () => void;
    onEditTrade: (trade: ITrade) => void;
    onFillTrade: (trade: ITrade) => void;
    onDeleteTrade: (trade: ITrade) => void;
    onSetExitPrice: (trade: ITrade) => void;
    onSplitTrade: (trade: ITrade) => void;
    onOpenShort: (trade: ITrade) => void;
    onCloseTrade: (trade: ITrade) => void;
    formatPrice: (price: number) => string;
    formatAmount: (amount: number) => string;
    calculateProfitPercent: (trade: ITrade) => number | null;
    calculateProfitUSD: (trade: ITrade) => number | null;
    calculateProfitCoins: (trade: ITrade) => number | null;
    hasActiveShortsOnLong: (tradeId: string) => boolean;
    getStatusBadge: (status: TradeStatus) => JSX.Element;
}

export function OpenTradesTable({
                                    groupedOpenTrades,
                                    onCreateTrade,
                                    onEditTrade,
                                    onFillTrade,
                                    onDeleteTrade,
                                    onSetExitPrice,
                                    onSplitTrade,
                                    onOpenShort,
                                    onCloseTrade,
                                    formatPrice,
                                    formatAmount,
                                    calculateProfitPercent,
                                    calculateProfitUSD,
                                    calculateProfitCoins,
                                    hasActiveShortsOnLong,
                                    getStatusBadge
                                }: OpenTradesTableProps) {

    const renderTradeRow = (trade: ITrade, isChild: boolean = false, splitInfo?: {
        part: number;
        total: number
    }) => {
        const profitPercent = calculateProfitPercent(trade);
        const profitUSD = calculateProfitUSD(trade);
        const profitCoins = calculateProfitCoins(trade);
        const isLongWithActiveShorts = trade.tradeType === TradeType.LONG && hasActiveShortsOnLong(trade._id);

        return (
            <TableRow
                key={trade._id}
                className={`${isChild ? 'bg-muted/30' : ''} ${isLongWithActiveShorts ? 'opacity-50' : ''}`}
            >
                <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                        {isChild && (
                            <CornerDownRight
                                className="h-4 w-4 text-muted-foreground"/>
                        )}
                        <span>{trade.coinSymbol}</span>
                    </div>
                </TableCell>
                <TableCell>
                    <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                            {trade.tradeType === TradeType.SHORT ? (
                                <span
                                    className="text-xs bg-orange-500/20 text-orange-400 px-1.5 py-0.5 rounded whitespace-nowrap">
                                    SHORT
                                </span>
                            ) : (
                                <span
                                    className="text-xs bg-green-500/20 text-green-400 px-1.5 py-0.5 rounded whitespace-nowrap">
                                    LONG
                                </span>
                            )}
                            {trade.isAveragingShort && (
                                <span
                                    className="text-xs bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded whitespace-nowrap"
                                    title="Averaging operation - excluded from USD statistics">
                                    AVERAGING
                                </span>
                            )}
                            {trade.tradeType === TradeType.LONG && trade.initialAmount && trade.amount > trade.initialAmount && (
                                <span
                                    className="text-xs bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded whitespace-nowrap"
                                    title="Position was averaged down through SHORT averaging operation">
                                    AVERAGED ↓
                                </span>
                            )}
                            {isLongWithActiveShorts && (
                                <span
                                    className="text-xs bg-yellow-500/20 text-yellow-400 px-1.5 py-0.5 rounded whitespace-nowrap"
                                    title="Has active SHORT positions">
                                    🔒 Locked
                                </span>
                            )}
                            {splitInfo && (
                                <span
                                    className="text-xs bg-purple-500/20 text-purple-400 px-1.5 py-0.5 rounded whitespace-nowrap">
                                    Split {splitInfo.part}/{splitInfo.total}
                                </span>
                            )}
                        </div>
                        {isChild && (
                            <div className="text-xs text-muted-foreground">
                                ↳ SHORT for parent LONG
                            </div>
                        )}
                    </div>
                </TableCell>
                <TableCell>
                    {getStatusBadge(trade.status)}
                </TableCell>
                <TableCell>
                    {trade.status === TradeStatus.OPEN ? (
                        trade.openDate ? (
                            new Date(trade.openDate).toLocaleDateString('en-US', {
                                year: 'numeric',
                                month: 'short',
                                day: 'numeric',
                            })
                        ) : '-'
                    ) : trade.status === TradeStatus.FILLED ? (
                        trade.filledDate ? (
                            new Date(trade.filledDate).toLocaleDateString('en-US', {
                                year: 'numeric',
                                month: 'short',
                                day: 'numeric',
                            })
                        ) : '-'
                    ) : '-'}
                </TableCell>
                <TableCell>${formatPrice(trade.entryPrice)}</TableCell>
                <TableCell><BlurredAmount amount={trade.sumPlusFee}/></TableCell>
                <TableCell>
                    {formatAmount(trade.amount)}
                </TableCell>
                <TableCell>
                    {trade.exitPrice ? `$${formatPrice(trade.exitPrice)}` : '-'}
                </TableCell>
                <TableCell>
                    {profitPercent !== null ? (
                        <span className={profitPercent >= 0 ? 'text-green-500' : 'text-red-500'}>
                            {profitPercent >= 0 ? '+' : ''}{profitPercent.toFixed(2)}%
                        </span>
                    ) : (
                        '-'
                    )}
                </TableCell>
                <TableCell>
                    {trade.tradeType === TradeType.SHORT && profitCoins !== null ? (
                        <span className={profitCoins >= 0 ? 'text-green-500' : 'text-red-500'}>
                            {profitCoins >= 0 ? '+' : ''}{profitCoins.toFixed(8)} {trade.coinSymbol}
                        </span>
                    ) : profitUSD !== null ? (
                        <span className={profitUSD >= 0 ? 'text-green-500' : 'text-red-500'}>
                            <BlurredAmount amount={profitUSD} showSign={true}/>
                        </span>
                    ) : (
                        '-'
                    )}
                </TableCell>
                <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                        {/* Edit button - available for open and filled trades */}
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onEditTrade(trade)}
                            title={isLongWithActiveShorts ? "Locked: Close all SHORT positions first" : "Edit Trade"}
                            disabled={isLongWithActiveShorts}
                        >
                            <Pencil className="h-4 w-4"/>
                        </Button>
                        {trade.status === TradeStatus.OPEN && (
                            <>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => onFillTrade(trade)}
                                    title={isLongWithActiveShorts ? "Locked: Close all SHORT positions first" : "Mark as Filled"}
                                    disabled={isLongWithActiveShorts}
                                >
                                    <Check className="h-4 w-4 text-green-500"/>
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => onDeleteTrade(trade)}
                                    title={isLongWithActiveShorts ? "Locked: Close all SHORT positions first" : "Delete"}
                                    disabled={isLongWithActiveShorts}
                                >
                                    <Trash2 className="h-4 w-4 text-destructive"/>
                                </Button>
                            </>
                        )}
                        {trade.status === TradeStatus.FILLED && (
                            <>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => onSetExitPrice(trade)}
                                    title={isLongWithActiveShorts ? "Locked: Close all SHORT positions first" : "Set Exit Price"}
                                    disabled={isLongWithActiveShorts}
                                >
                                    <DollarSign className="h-4 w-4"/>
                                </Button>
                                {/* Split button - for LONG or standalone SHORT (not SHORT from LONG) */}
                                {(trade.tradeType === TradeType.LONG ||
                                    (trade.tradeType === TradeType.SHORT && !trade.parentTradeId)) && (
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => onSplitTrade(trade)}
                                        title={isLongWithActiveShorts ? "Locked: Close all SHORT positions first" : "Split Position"}
                                        disabled={isLongWithActiveShorts}
                                    >
                                        <MinusCircle className="h-4 w-4 text-yellow-500"/>
                                    </Button>
                                )}
                                {/* Open SHORT button - only for LONG positions */}
                                {trade.tradeType === TradeType.LONG && (
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => onOpenShort(trade)}
                                        title={isLongWithActiveShorts ? "Locked: Close all SHORT positions first" : "Open SHORT from this LONG position"}
                                        disabled={isLongWithActiveShorts}
                                    >
                                        <TrendingDown className="h-4 w-4 text-orange-500"/>
                                    </Button>
                                )}
                            </>
                        )}
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onCloseTrade(trade)}
                            title={isLongWithActiveShorts ? "Locked: Close all SHORT positions first" : "Close Trade"}
                            disabled={isLongWithActiveShorts}
                        >
                            Close
                        </Button>
                    </div>
                </TableCell>
            </TableRow>
        );
    };

    return (
        <Card>
            <CardHeader>
                <div className="flex justify-between items-center">
                    <CardTitle>Open Trades</CardTitle>
                    <Button onClick={onCreateTrade}>
                        <Plus className="h-4 w-4 mr-2"/>
                        Add Trade
                    </Button>
                </div>
            </CardHeader>
            <CardContent>
                {groupedOpenTrades.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                        No open trades. Click "Add Trade" to create one.
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="min-w-[60px]">Coin</TableHead>
                                    <TableHead className="min-w-[150px]">Type</TableHead>
                                    <TableHead className="min-w-[70px]">Status</TableHead>
                                    <TableHead className="min-w-[100px]">Date</TableHead>
                                    <TableHead className="min-w-[90px]">Entry Price</TableHead>
                                    <TableHead className="min-w-[90px]">Sum+Fee</TableHead>
                                    <TableHead className="min-w-[110px]">Amount</TableHead>
                                    <TableHead className="min-w-[90px]">Exit Price</TableHead>
                                    <TableHead className="min-w-[80px]">Profit %</TableHead>
                                    <TableHead className="min-w-[120px]">Profit</TableHead>
                                    <TableHead className="text-right min-w-[150px]">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {groupedOpenTrades.map((group) => (
                                    <>
                                        {renderTradeRow(group.parent, false, group.splitInfo)}
                                        {group.children.map(child => renderTradeRow(child, true, undefined))}
                                    </>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
