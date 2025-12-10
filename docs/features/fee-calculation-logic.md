# Feature: Fee Calculation Logic
Date: 2025-01
Status: Complete

## 30-Day Volume Calculation

```typescript
const thirtyDaysAgo = new Date();
thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

const trades = await Trade.find({
  portfolioId,
  status: { $in: [TradeStatus.FILLED, TradeStatus.CLOSED] },
  $or: [
    { filledDate: { $gte: thirtyDaysAgo } },
    { closeDate: { $gte: thirtyDaysAgo } }
  ]
});

const volume = trades.reduce((sum, trade) => sum + trade.sumPlusFee, 0);
```

## Entry vs Exit Fee

| Type | Calculation |
|------|-------------|
| Entry | Excludes current trade (uses `tradeId` param) |
| Exit | Includes all filled trades |

## Fee Level Algorithm

```typescript
function calculateFeeLevel(volume: number): FeeCalculationResult {
  let currentLevel = FEE_LEVELS[0];

  for (let i = FEE_LEVELS.length - 1; i >= 0; i--) {
    if (volume >= FEE_LEVELS[i].minVolume) {
      currentLevel = FEE_LEVELS[i];
      break;
    }
  }

  return {
    level: currentLevel.level,
    feePercent: currentLevel.makerFee,
    currentVolume: volume,
    nextLevel: getNextLevel(currentLevel, volume)
  };
}
```

## Edge Cases

| Case | Behavior |
|------|----------|
| New portfolio | First tier (Intro 1: 0.600%) |
| Exact threshold | Gets that level (inclusive) |
| No dated trades | Excluded from volume |

## UI Usage
Fees auto-calculated when:
1. Creating new trade (entry)
2. Setting exit price (exit)
3. Viewing settings page

Users can manually override calculated fees.

## Related
- [Fee Tiers](./fee-tiers.md)
- [Fee API](./api-fees.md)
