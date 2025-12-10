# Fee Calculation

## Overview
Automatic fee calculation based on Coinbase's tiered fee structure. Fees are determined by 30-day trading volume and calculated dynamically for both entry and exit trades.

## Fee Tiers (Maker Fees)

| Level | Minimum Volume (USD) | Maker Fee (%) |
|-------|---------------------|---------------|
| Intro 1 | $0 | 0.600% |
| Intro 2 | $10,000 | 0.400% |
| Advanced 1 | $25,000 | 0.250% |
| Advanced 2 | $75,000 | 0.125% |
| Advanced 3 | $250,000 | 0.075% |
| VIP 1 | $500,000 | 0.060% |
| VIP 2 | $1,000,000 | 0.050% |
| VIP 3 | $5,000,000 | 0.040% |
| VIP 4 | $10,000,000 | 0.025% |
| VIP 5 | $20,000,000 | 0.010% |
| VIP 6+ | $50,000,000+ | 0.000% |

## How 30-Day Volume is Calculated

```typescript
// Find all FILLED or CLOSED trades in the last 30 days
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

// Sum all sumPlusFee values
const volume = trades.reduce((sum, trade) => sum + trade.sumPlusFee, 0);
```

## Entry vs Exit Fee Calculation

### Entry Fee
When creating a new trade:
- **Excludes** the current trade being created (uses `tradeId` parameter)
- Calculates volume from existing filled/closed trades only
- Auto-fills the entry fee field in trade creation modal

### Exit Fee
When closing/partially closing a trade:
- **Includes** all filled trades (the trade being closed is already filled)
- Calculates volume including the trade being closed
- Auto-fills the exit fee field in exit modals

## Fee Level Algorithm

```typescript
function calculateFeeLevel(volume: number): FeeCalculationResult {
  // Find highest level where volume >= minVolume
  let currentLevel = FEE_LEVELS[0];

  for (let i = FEE_LEVELS.length - 1; i >= 0; i--) {
    if (volume >= FEE_LEVELS[i].minVolume) {
      currentLevel = FEE_LEVELS[i];
      break;
    }
  }

  // Calculate next level info
  const nextLevel = getNextLevel(currentLevel, volume);

  return {
    level: currentLevel.level,
    feePercent: currentLevel.makerFee,
    currentVolume: volume,
    nextLevel
  };
}
```

## API Endpoint

**GET** `/api/portfolios/[portfolioId]/calculate-fee`

### Query Parameters
- `type`: `"entry"` or `"exit"` (required)
- `tradeId`: Trade ID to exclude from calculation (optional, used for entry fee)

### Response
```typescript
{
  success: true,
  data: {
    level: "Advanced 1",
    feePercent: 0.250,
    currentVolume: 28500.00,
    nextLevel: {
      level: "Advanced 2",
      minVolume: 75000,
      remaining: 46500.00
    }
  }
}
```

## Edge Cases

### New Portfolio
- First trade uses the lowest tier (Intro 1: 0.600%)
- No historical volume exists yet

### Volume Exactly at Threshold
- If `volume = 25000`, user gets Advanced 1 (0.250%)
- Thresholds are inclusive (>=)

### Trades Without Dates
- Trades without `filledDate` or `closeDate` are excluded
- Only properly dated trades count toward volume

## Usage in UI

Fees are automatically calculated and displayed when:
1. Creating a new trade (entry fee)
2. Setting exit price (exit fee)
3. Partially closing a position (exit fee)
4. Viewing settings page (current fee level for each portfolio)

Users can manually override the calculated fee if needed.
