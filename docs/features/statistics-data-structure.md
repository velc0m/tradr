# Feature: Statistics Data Structure
Date: 2025-01
Status: Complete

## PortfolioStatistics Interface

```typescript
interface PortfolioStatistics {
  totalProfitUSD: number;
  totalProfitPercent: number;  // Average across trades
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
```

## CoinPerformance Interface

```typescript
interface CoinPerformance {
  coinSymbol: string;
  tradesCount: number;
  winRate: number;
  totalProfitUSD: number;
  avgProfitPercent: number;
  bestTrade: { profitUSD: number; profitPercent: number } | null;
  worstTrade: { profitUSD: number; profitPercent: number } | null;
}
```

## Edge Cases

| Case | Behavior |
|------|----------|
| Split positions | Each split independent in stats |
| Zero exit price | Shows 0 profit |
| No closed trades | Returns null for best/worst |

## Usage Example

```typescript
const response = await fetch(`/api/portfolios/${portfolioId}/stats`);
const { data } = await response.json();

console.log(`Win Rate: ${data.winRate.toFixed(2)}%`);
console.log(`Total Profit: $${data.totalProfitUSD.toFixed(2)}`);
console.log(`ROI: ${data.totalROI.toFixed(2)}%`);
```

## Related
- [Statistics Calculations](./statistics-calculations.md)
- [Statistics API](./api-statistics.md)
