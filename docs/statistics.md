# Portfolio Statistics

## Overview
Portfolio statistics provide comprehensive analysis of trading performance, including profit/loss metrics, win rates, and coin-level performance tracking.

## Key Metrics

### Profit Calculations

#### Profit Percentage
```
Profit % = ((exitPrice / entryPrice - 1) * 100) - entryFee - exitFee
```
Net profit percentage after all fees.

#### Profit USD
```
For closed trades:
exitValue = amount × exitPrice × (100 - exitFee) / 100
profitUSD = exitValue - sumPlusFee

For parent trades with partial closes:
proportion = remainingAmount / originalAmount
proportionalSumPlusFee = sumPlusFee × proportion
exitValue = remainingAmount × exitPrice × (100 - exitFee) / 100
profitUSD = exitValue - proportionalSumPlusFee
```

### Statistics Breakdown

- **Total Profit/Loss (USD)**: Sum of all closed trade profits
- **Average Profit %**: Mean profit percentage across all closed trades
- **Win Rate**: (profitable trades / total trades) × 100
- **Average Profit USD**: Total profit / number of trades
- **Total ROI**: (total profit / total investment) × 100

### Trade Counts
```typescript
{
  open: number,    // Trades with OPEN status
  filled: number,  // Trades with FILLED status (awaiting exit)
  closed: number   // Completed trades
}
```

### Performance by Coin
Each cryptocurrency gets individual performance metrics:
- Trade count
- Win rate
- Total profit (USD)
- Average profit (%)
- Best/worst trade for that coin

### Top Trades
- Top 5 most profitable trades
- Top 5 most losing trades

### Cumulative Profit
Time series data showing profit accumulation over time, sorted by close date.

## Important Edge Cases

### Partial Closes
When calculating profit for parent trades that were partially closed:
1. Use `remainingAmount` instead of original `amount`
2. Calculate proportional entry cost based on remaining portion
3. Formula handles both parent trades and partial close records correctly

### Zero Exit Price
Trades without exit price (OPEN/FILLED status) show 0 profit in statistics.

## Data Structure

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

## API Endpoint

**GET** `/api/portfolios/[portfolioId]/stats`

Returns all statistics for the specified portfolio.

## Usage Example

```typescript
const response = await fetch(`/api/portfolios/${portfolioId}/stats`);
const { data } = await response.json();

console.log(`Win Rate: ${data.winRate.toFixed(2)}%`);
console.log(`Total Profit: $${data.totalProfitUSD.toFixed(2)}`);
console.log(`ROI: ${data.totalROI.toFixed(2)}%`);
```
