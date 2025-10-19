'use client';

import { useState } from 'react';
import { TableCell, TableRow } from '@/components/ui/table';
import { ITrade, TradeStatus } from '@/types';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { BlurredAmount } from '@/components/ui/BlurredAmount';

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
}

export function GroupedClosedTradeRow({ group }: GroupedClosedTradeRowProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const formatPrice = (price: number): string => {
    const formatted = price.toFixed(6);
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
    const profitUSD = calculateProfitUSD(trade);

    return (
      <TableRow>
        <TableCell className="font-medium">{trade.coinSymbol}</TableCell>
        <TableCell>
          <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-1 rounded">
            Full
          </span>
        </TableCell>
        <TableCell>
          <span className="text-xs bg-red-500/20 text-red-400 px-2 py-1 rounded">
            Closed
          </span>
        </TableCell>
        <TableCell>${formatPrice(trade.entryPrice)}</TableCell>
        <TableCell><BlurredAmount amount={trade.sumPlusFee} /></TableCell>
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
          {profitUSD !== null ? (
            <span className={profitUSD >= 0 ? 'text-green-500' : 'text-red-500'}>
              <BlurredAmount amount={profitUSD} showSign={true} />
            </span>
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
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
              </Button>
            )}
            {group.mainTrade.coinSymbol}
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
        <TableCell><BlurredAmount amount={group.mainTrade.sumPlusFee} /></TableCell>
        <TableCell>{summary.totalAmount.toFixed(8)}</TableCell>
        <TableCell>${formatPrice(summary.avgExitPrice)}</TableCell>
        <TableCell>
          <span className={summary.totalProfitPercent >= 0 ? 'text-green-500' : 'text-red-500'}>
            {summary.totalProfitPercent >= 0 ? '+' : ''}{summary.totalProfitPercent.toFixed(2)}%
          </span>
        </TableCell>
        <TableCell>
          <span className={summary.totalProfitUSD >= 0 ? 'text-green-500' : 'text-red-500'}>
            <BlurredAmount amount={summary.totalProfitUSD} showSign={true} />
          </span>
        </TableCell>
        <TableCell>{formatDate(group.mainTrade.filledDate)}</TableCell>
        <TableCell>
          <span className="text-xs">{dateRange}</span>
        </TableCell>
      </TableRow>

      {/* Expanded Part Rows */}
      {isExpanded && group.parts.map((part, index) => {
        const partProfitPercent = calculateProfitPercent(part);
        const partProfitUSD = calculateProfitUSD(part);

        return (
          <TableRow key={part._id} className="bg-muted/30">
            <TableCell className="pl-12">
              <span className="text-xs text-muted-foreground">
                Part {index + 1}
              </span>
            </TableCell>
            <TableCell>
              <span className="text-xs bg-yellow-500/20 text-yellow-400 px-2 py-1 rounded">
                Partial
              </span>
            </TableCell>
            <TableCell>-</TableCell>
            <TableCell className="text-xs text-muted-foreground">-</TableCell>
            <TableCell className="text-xs text-muted-foreground">
              <BlurredAmount amount={part.sumPlusFee} />
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
              {partProfitUSD !== null ? (
                <span className={partProfitUSD >= 0 ? 'text-green-500' : 'text-red-500'}>
                  <BlurredAmount amount={partProfitUSD} showSign={true} />
                </span>
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
  return (
    ((trade.exitPrice / trade.entryPrice - 1) * 100) -
    trade.entryFee -
    (trade.exitFee || 0)
  );
}

function calculateProfitUSD(trade: ITrade): number | null {
  if (!trade.exitPrice) return null;
  const exitValue = trade.amount * trade.exitPrice * (100 - (trade.exitFee || 0)) / 100;
  return exitValue - trade.sumPlusFee;
}
