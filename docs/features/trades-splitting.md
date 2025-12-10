# Feature: Trade Splitting
Date: 2025-01
Status: Complete

## Overview
Split a FILLED position into 2-5 independent positions for partial exits.

## API

**POST** `/api/trades/[id]/split`

```typescript
// Request
{ amounts: [0.5, 0.3, 0.2] }  // Must sum to original amount

// Response
{
  originalTrade: ITrade;    // isSplit: true, status: CLOSED
  splitTrades: ITrade[];    // New independent positions
}
```

## Behavior

Each split inherits from original:
- `entryPrice`
- `entryFee`
- `openDate`
- `filledDate`

Each split gets proportional:
- `amount`
- `sumPlusFee`

All splits share:
- Common `splitGroupId` (UUID)

Original trade:
- Marked `isSplit: true`
- Status set to `CLOSED`

## Restrictions

| Rule | Description |
|------|-------------|
| Status | Only FILLED trades |
| Type | Cannot split SHORT with parentTradeId |
| Sum | Amounts must equal original (float tolerance) |
| Count | 2-5 splits allowed |

## UI Display
Visual indicators: "Split 1/3", "Split 2/3", "Split 3/3"

## Related
- [Trade Lifecycle](./trades-lifecycle.md)
- [Trades API](./api-trades.md)
