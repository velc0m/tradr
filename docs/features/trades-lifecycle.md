# Feature: Trade Lifecycle
Date: 2025-01
Status: Complete

## Overview
Trades represent cryptocurrency positions following a lifecycle from creation to closure.

## Lifecycle Flow

```
OPEN → FILLED → CLOSED
         ↓
         └─→ Can be split into 2-5 independent positions
```

## Trade Statuses

| Status | Description |
|--------|-------------|
| OPEN | Limit order placed, not yet filled |
| FILLED | Order filled, position active, awaiting exit |
| CLOSED | Position closed, P&L finalized |

## Status Transitions

### Opening (OPEN)
- Create trade with entry details
- Not yet included in 30-day volume

### Filling (OPEN → FILLED)
```typescript
{ status: "FILLED", filledDate: "2025-01-16" }
```
- Sets `filledDate`
- Included in 30-day volume calculations

### Setting Exit Price (FILLED)
```typescript
{ exitPrice: 48500.00, exitFee: 0.25 }
```
- Preview potential profit
- Can be cleared with `exitPrice: null`
- Does NOT close trade

### Closing (FILLED → CLOSED)
Set exit price + change status to CLOSED via edit dialog.

## Related
- [Trade Properties](./trades-properties.md)
- [Trade Splitting](./trades-splitting.md)
- [Trades API](./api-trades.md)
