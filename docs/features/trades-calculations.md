# Feature: Trade Calculations
Date: 2025-01
Status: Complete

## Overview
Pure calculation functions in `src/lib/calculations.ts` for LONG and SHORT profit.

## LONG Position Formulas

### Amount Calculation
```typescript
amount = sumPlusFee / entryPrice
```

### Profit USD
```typescript
exitValue = amount × exitPrice × (100 - exitFee) / 100
profitUSD = exitValue - sumPlusFee
```

### Profit Percentage
```typescript
profitPercent = ((exitPrice / entryPrice - 1) × 100) - entryFee - exitFee
```

## SHORT Position Formulas

### Profit in Coins
```typescript
buyBackPriceWithFee = buyBackPrice × (100 + buyBackFee) / 100
coinsBoughtBack = sumPlusFee / buyBackPriceWithFee
profitCoins = coinsBoughtBack - soldAmount
```

### Profit Percentage
```typescript
profitPercent = ((coinsBoughtBack / soldAmount) - 1) × 100
```

## Parent LONG Recalculation

When SHORT closes:
```typescript
newEntryPrice = originalSumPlusFee / newTotalAmount
```

## Decimal Precision

| Type | Precision |
|------|-----------|
| Prices | Up to 6 decimal places |
| Amounts | Up to 10 decimal places |

Displayed with trailing zeros removed.

## Related
- [Trade Properties](./trades-properties.md)
- [Statistics Calculations](./statistics-calculations.md)
