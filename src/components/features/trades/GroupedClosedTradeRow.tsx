'use client';

import {useState} from 'react';
import {TableCell, TableRow} from '@/components/ui/table';
import {ITrade, TradeType} from '@/types';
import {ChevronDown, ChevronRight} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {BlurredAmount} from '@/components/ui/BlurredAmount';

export interface TradeGroup {
    type: 'full' | 'multi';
    mainTrade: ITrade;
    parts: ITrade[];
    summary?: {
        totalAmount: number;
        avgExitPrice: number;
        totalProfitPercent: number;
        totalProfitUSD: number;
        firstCloseDate: Date;
        lastCloseDate: Date;
    };
}

interface GroupedClosedTradeRowProps {
    group: TradeGroup;
    showFees?: boolean;
}

export function GroupedClosedTradeRow({group, showFees = false}: GroupedClosedTradeRowProps) {
    const [isExpanded, setIsExpanded] = useState(false);

    const formatPrice = (price: number): string => {
        const formatted = price.toFixed(2);
        const trimmed = formatted.replace(/\.?0+$/, '');
        return trimmed;
    };

    const formatDate = (date: Date | string | undefined): string => {
        if (!date) return '-';
        return new Date(date).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
        });
    };

    // For full trade (no parts), show as single row
    if (group.type === 'full') {
        const trade = group.mainTrade;
        const profitPercent = calculateProfitPercent(trade);
        const profitResult = calculateProfitResult(trade);

        return (
            <TableRow>
                <TableCell className="font-medium">
                    <span>{trade.coinSymbol}</span>
                </TableCell>
                <TableCell>
                    <div className="flex items-center gap-1.5">
                        {trade.tradeType === TradeType.SHORT ? (
                            <>
                <span className="text-xs bg-orange-500/20 text-orange-400 px-1.5 py-0.5 rounded">
                  SHORT
                </span>
                                {trade.isAveragingShort && (
                                    <span className="text-xs bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded"
                                          title="Averaging operation - excluded from USD statistics">
                    AVERAGING
                  </span>
                                )}
                            </>
                        ) : (
                            <>
                <span className="text-xs bg-green-500/20 text-green-400 px-1.5 py-0.5 rounded">
                  LONG
                </span>
                                {trade.initialEntryPrice && trade.entryPrice !== trade.initialEntryPrice && (
                                    <span className="text-xs bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded"
                                          title="Position was averaged down through SHORT averaging operation">
                    AVERAGED ↓
                  </span>
                                )}
                            </>
                        )}
                        {trade.splitGroupId && (
                            <span className="text-xs bg-purple-500/20 text-purple-400 px-1.5 py-0.5 rounded">
                Split
              </span>
                        )}
                    </div>
                </TableCell>
                <TableCell>
          <span className="text-xs bg-red-500/20 text-red-400 px-2 py-1 rounded">
            Closed
          </span>
                </TableCell>
                <TableCell>${formatPrice(trade.entryPrice)}</TableCell>
                <TableCell>
                    {trade.initialEntryPrice ? (
                        <span className="text-xs text-muted-foreground">
              ${formatPrice(trade.initialEntryPrice)}
            </span>
                    ) : '-'}
                </TableCell>
                <TableCell><BlurredAmount amount={trade.sumPlusFee}/></TableCell>
                <TableCell>{trade.amount.toFixed(8)}</TableCell>
                <TableCell>
                    {trade.exitPrice ? `$${formatPrice(trade.exitPrice)}` : '-'}
                </TableCell>
                <TableCell>
                    {profitPercent !== null ? (
                        <span className={profitPercent >= 0 ? 'text-green-500' : 'text-red-500'}>
              {profitPercent >= 0 ? '+' : ''}{profitPercent.toFixed(2)}%
            </span>
                    ) : '-'}
                </TableCell>
                <TableCell>
                    {profitResult !== null ? (
                        <div>
              <span className={profitResult.value >= 0 ? 'text-green-500' : 'text-red-500'}>
                {profitResult.value >= 0 ? '+' : ''}
                  {profitResult.type === 'coins'
                      ? `${profitResult.value.toFixed(8)} ${profitResult.symbol}`
                      : <BlurredAmount amount={profitResult.value}/>
                  }
              </span>
                            {showFees && (
                                <div className="text-xs text-muted-foreground mt-1">
                                    Fees: {trade.entryFee}% + {trade.exitFee || 0}%
                                </div>
                            )}
                        </div>
                    ) : '-'}
                </TableCell>
                <TableCell>{formatDate(trade.filledDate)}</TableCell>
                <TableCell>{formatDate(trade.closeDate)}</TableCell>
            </TableRow>
        );
    }

    // For multi-part trade, show summary row with expand/collapse
    const summary = group.summary!;
    const dateRange = summary.firstCloseDate.getTime() === summary.lastCloseDate.getTime()
        ? formatDate(summary.firstCloseDate)
        : `${formatDate(summary.firstCloseDate)} - ${formatDate(summary.lastCloseDate)}`;

    // Badge text: if only 1 part and parent still open, show "Partial", otherwise "Multi (N)"
    const badgeText = group.parts.length === 1 ? 'Partial' : `Multi (${group.parts.length})`;
    const badgeColor = group.parts.length === 1
        ? 'bg-yellow-500/20 text-yellow-400'
        : 'bg-purple-500/20 text-purple-400';

    // Calculate summary profit result (check if SHORT)
    const isShort = group.mainTrade.tradeType === TradeType.SHORT;
    const summaryProfitResult = isShort
        ? {type: 'coins' as const, value: summary.totalProfitUSD, symbol: group.mainTrade.coinSymbol}
        : {type: 'usd' as const, value: summary.totalProfitUSD};

    return (
        <>
            {/* Summary Row */}
            <TableRow className="hover:bg-muted/50 cursor-pointer" onClick={() => setIsExpanded(!isExpanded)}>
                <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                        {group.parts.length > 1 && (
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 p-0"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setIsExpanded(!isExpanded);
                                }}
                            >
                                {isExpanded ? (
                                    <ChevronDown className="h-4 w-4"/>
                                ) : (
                                    <ChevronRight className="h-4 w-4"/>
                                )}
                            </Button>
                        )}
                        {group.mainTrade.coinSymbol}
                    </div>
                </TableCell>
                <TableCell>
                    <div className="flex items-center gap-1.5">
                        {group.mainTrade.tradeType === TradeType.SHORT ? (
                            <>
                <span className="text-xs bg-orange-500/20 text-orange-400 px-1.5 py-0.5 rounded">
                  SHORT
                </span>
                                {group.mainTrade.isAveragingShort && (
                                    <span className="text-xs bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded"
                                          title="Averaging operation - excluded from USD statistics">
                    AVERAGING
                  </span>
                                )}
                            </>
                        ) : (
                            <>
                <span className="text-xs bg-green-500/20 text-green-400 px-1.5 py-0.5 rounded">
                  LONG
                </span>
                                {group.mainTrade.initialEntryPrice && group.mainTrade.entryPrice !== group.mainTrade.initialEntryPrice && (
                                    <span className="text-xs bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded"
                                          title="Position was averaged down through SHORT averaging operation">
                    AVERAGED ↓
                  </span>
                                )}
                            </>
                        )}
                        {group.mainTrade.splitGroupId && (
                            <span className="text-xs bg-purple-500/20 text-purple-400 px-1.5 py-0.5 rounded">
                Split
              </span>
                        )}
                    </div>
                </TableCell>
                <TableCell>
          <span className={`text-xs ${badgeColor} px-2 py-1 rounded`}>
            {badgeText}
          </span>
                </TableCell>
                <TableCell>
          <span className="text-xs bg-red-500/20 text-red-400 px-2 py-1 rounded">
            Closed
          </span>
                </TableCell>
                <TableCell>${formatPrice(group.mainTrade.entryPrice)}</TableCell>
                <TableCell>
                    {group.mainTrade.initialEntryPrice ? (
                        <span className="text-xs text-muted-foreground">
              ${formatPrice(group.mainTrade.initialEntryPrice)}
            </span>
                    ) : '-'}
                </TableCell>
                <TableCell><BlurredAmount amount={group.mainTrade.sumPlusFee}/></TableCell>
                <TableCell>{summary.totalAmount.toFixed(8)}</TableCell>
                <TableCell>${formatPrice(summary.avgExitPrice)}</TableCell>
                <TableCell>
          <span className={summary.totalProfitPercent >= 0 ? 'text-green-500' : 'text-red-500'}>
            {summary.totalProfitPercent >= 0 ? '+' : ''}{summary.totalProfitPercent.toFixed(2)}%
          </span>
                </TableCell>
                <TableCell>
                    <div>
            <span className={summaryProfitResult.value >= 0 ? 'text-green-500' : 'text-red-500'}>
              {summaryProfitResult.value >= 0 ? '+' : ''}
                {summaryProfitResult.type === 'coins'
                    ? `${summaryProfitResult.value.toFixed(8)} ${summaryProfitResult.symbol}`
                    : <BlurredAmount amount={summaryProfitResult.value}/>
                }
            </span>
                        {showFees && (
                            <div className="text-xs text-muted-foreground mt-1">
                                Avg: {group.mainTrade.entryFee}% + {group.mainTrade.exitFee || 0}%
                            </div>
                        )}
                    </div>
                </TableCell>
                <TableCell>{formatDate(group.mainTrade.filledDate)}</TableCell>
                <TableCell>
                    <span className="text-xs">{dateRange}</span>
                </TableCell>
            </TableRow>

            {/* Expanded Part Rows */}
            {isExpanded && group.parts.map((part, index) => {
                const partProfitPercent = calculateProfitPercent(part);
                const partProfitResult = calculateProfitResult(part);

                return (
                    <TableRow key={part._id} className="bg-muted/30">
                        <TableCell className="pl-12">
              <span className="text-xs text-muted-foreground">
                Part {index + 1}
              </span>
                        </TableCell>
                        <TableCell>-</TableCell>
                        <TableCell>
              <span className="text-xs bg-yellow-500/20 text-yellow-400 px-2 py-1 rounded">
                Partial
              </span>
                        </TableCell>
                        <TableCell>-</TableCell>
                        <TableCell className="text-xs text-muted-foreground">-</TableCell>
                        <TableCell className="text-xs text-muted-foreground">-</TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                            <BlurredAmount amount={part.sumPlusFee}/>
                        </TableCell>
                        <TableCell className="text-sm">{part.amount.toFixed(8)}</TableCell>
                        <TableCell className="text-sm">
                            {part.exitPrice ? `$${formatPrice(part.exitPrice)}` : '-'}
                        </TableCell>
                        <TableCell className="text-sm">
                            {partProfitPercent !== null ? (
                                <span className={partProfitPercent >= 0 ? 'text-green-500' : 'text-red-500'}>
                  {partProfitPercent >= 0 ? '+' : ''}{partProfitPercent.toFixed(2)}%
                </span>
                            ) : '-'}
                        </TableCell>
                        <TableCell className="text-sm">
                            {partProfitResult !== null ? (
                                <div>
                  <span className={partProfitResult.value >= 0 ? 'text-green-500' : 'text-red-500'}>
                    {partProfitResult.value >= 0 ? '+' : ''}
                      {partProfitResult.type === 'coins'
                          ? `${partProfitResult.value.toFixed(8)} ${partProfitResult.symbol}`
                          : <BlurredAmount amount={partProfitResult.value}/>
                      }
                  </span>
                                    {showFees && (
                                        <div className="text-xs text-muted-foreground mt-1">
                                            {part.entryFee}% + {part.exitFee || 0}%
                                        </div>
                                    )}
                                </div>
                            ) : '-'}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">-</TableCell>
                        <TableCell className="text-sm">{formatDate(part.closeDate)}</TableCell>
                    </TableRow>
                );
            })}
        </>
    );
}

// Helper functions
function calculateProfitPercent(trade: ITrade): number | null {
    if (!trade.exitPrice) return null;

    if (trade.tradeType === TradeType.SHORT) {
        // For SHORT: profit % based on coins gained
        const entryFeeVal = trade.entryFee || 0;
        const netReceived = trade.sumPlusFee * (100 - entryFeeVal) / 100;
        const exitFeeVal = trade.exitFee || 0;
        const buyBackPriceWithFee = trade.exitPrice * (100 + exitFeeVal) / 100;
        const coinsBoughtBack = netReceived / buyBackPriceWithFee;
        return ((coinsBoughtBack / trade.amount - 1) * 100);
    }

    // For LONG: existing logic
    return (
        ((trade.exitPrice / trade.entryPrice - 1) * 100) -
        trade.entryFee -
        (trade.exitFee || 0)
    );
}

function calculateProfitResult(trade: ITrade): { type: 'coins' | 'usd'; value: number; symbol?: string } | null {
    if (!trade.exitPrice) return null;

    if (trade.tradeType === TradeType.SHORT) {
        // SHORT: profit in coins
        const entryFeeVal = trade.entryFee || 0;
        const netReceived = trade.sumPlusFee * (100 - entryFeeVal) / 100;
        const exitFeeVal = trade.exitFee || 0;
        const buyBackPriceWithFee = trade.exitPrice * (100 + exitFeeVal) / 100;
        const coinsBoughtBack = netReceived / buyBackPriceWithFee;
        const profitCoins = coinsBoughtBack - trade.amount;

        return {
            type: 'coins',
            value: profitCoins,
            symbol: trade.coinSymbol,
        };
    }

    // LONG: profit in USD
    const exitValue = trade.amount * trade.exitPrice * (100 - (trade.exitFee || 0)) / 100;
    return {
        type: 'usd',
        value: exitValue - trade.sumPlusFee,
    };
}
