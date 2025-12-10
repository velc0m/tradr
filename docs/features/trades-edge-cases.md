# Feature: Trade Edge Cases
Date: 2025-01
Status: Complete

## Changing Entry Price
- Recalculates `amount` based on existing `sumPlusFee`
- Maintains total investment, changes coin quantity

## Clearing Exit Price
- Sets `exitPrice` to `null`
- Resets `exitFee` to match `entryFee`
- Clears profit calculations

## Filled Date Before Open Date
- No validation enforced
- Users responsible for logical date ordering

## Creating Trades

When created via API:
```typescript
sumPlusFee = (totalDeposit × depositPercent / 100)
amount = sumPlusFee / entryPrice
```

## Editing Trades

Can update on any status:
- `entryPrice`
- `depositPercent`
- `entryFee`
- `exitPrice` (set or clear)
- `exitFee`
- `openDate`

When entry details change, `amount` recalculates automatically.

## Related
- [Trade Properties](./trades-properties.md)
- [Trade Calculations](./trades-calculations.md)
