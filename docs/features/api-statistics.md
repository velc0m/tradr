# Feature: Statistics API
Date: 2025-01
Status: Complete

## Overview
Portfolio statistics endpoint providing comprehensive trading performance analysis.

## Endpoint

### Get Portfolio Statistics
**GET** `/api/portfolios/[portfolioId]/stats`

```typescript
{
  success: true,
  data: {
    totalProfitUSD: number;
    totalProfitPercent: number;
    winRate: number;
    avgProfitUSD: number;
    avgProfitPercent: number;
    totalROI: number;
    totalTrades: {
      open: number;
      filled: number;
      closed: number;
    };
    bestTrade: { trade: TradeWithProfit } | null;
    worstTrade: { trade: TradeWithProfit } | null;
    performanceByCoin: CoinPerformance[];
    topProfitableTrades: TradeWithProfit[];
    topLosingTrades: TradeWithProfit[];
    cumulativeProfit: CumulativeProfitPoint[];
  }
}
```

## Metrics Explained

| Metric | Description |
|--------|-------------|
| totalProfitUSD | Sum of all closed trade profits |
| winRate | (profitable trades / total) × 100 |
| totalROI | (total profit / total investment) × 100 |
| performanceByCoin | Per-coin: trades, winRate, profit, best/worst |
| cumulativeProfit | Time series by close date |

## Related
- [Statistics Calculations](./statistics-calculations.md)
- [Portfolio API](./api-portfolios.md)
