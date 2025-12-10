# Feature: Statistics Calculations
Date: 2025-01
Status: Complete

## Profit Formulas

### Profit Percentage
```
Profit % = ((exitPrice / entryPrice - 1) * 100) - entryFee - exitFee
```
Net profit percentage after all fees.

### Profit USD (Closed Trades)
```
exitValue = amount × exitPrice × (100 - exitFee) / 100
profitUSD = exitValue - sumPlusFee
```

**Note:** Split positions treated as independent trades, each with own `amount` and `sumPlusFee`.

## Aggregate Metrics

| Metric | Formula |
|--------|---------|
| Total Profit/Loss (USD) | Sum of all closed trade profits |
| Average Profit % | Mean profit % across closed trades |
| Win Rate | (profitable trades / total) × 100 |
| Average Profit USD | total profit / number of trades |
| Total ROI | (total profit / total investment) × 100 |

## Trade Counts
```typescript
{
  open: number,    // OPEN status
  filled: number,  // FILLED status (awaiting exit)
  closed: number   // Completed trades
}
```

## Performance by Coin
Each cryptocurrency gets individual metrics:
- Trade count
- Win rate
- Total profit (USD)
- Average profit (%)
- Best/worst trade for that coin

## Top Trades
- Top 5 most profitable
- Top 5 most losing

## Cumulative Profit
Time series showing profit accumulation, sorted by close date.

## Related
- [Statistics API](./api-statistics.md)
- [Trade Calculations](./trades-calculations.md)
