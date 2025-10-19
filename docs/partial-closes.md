# Partial Closes

## Overview
Partial closes allow closing portions of a position while keeping the rest active. This is useful for taking profits incrementally or implementing scaling strategies.

## How It Works

### Parent Trade Tracking
When a trade is partially closed:
- **Parent trade**: Status remains FILLED, tracks remaining amount
- **Closed trade**: New record created with CLOSED status for the closed portion

### Key Fields
```typescript
// Parent trade
{
  originalAmount: 1.5,      // Total amount purchased
  remainingAmount: 0.8,     // Amount still in position
  status: "FILLED"          // Stays FILLED until fully closed
}

// Partial close record
{
  amount: 0.7,              // Amount closed in this action
  originalAmount: 1.5,      // Reference to original size
  remainingAmount: 0,       // This portion is fully closed
  isPartialClose: true,     // Marks this as partial close record
  parentTradeId: "...",     // Reference to parent trade
  closedAmount: 0.7,        // Same as amount
  status: "CLOSED"
}
```

## API Endpoint

**POST** `/api/trades/[id]/partial-close`

### Request Body
```typescript
{
  amountToClose: 0.7,
  exitPrice: 48500.00,
  exitFee: 0.25,
  closeDate: "2025-01-20"
}
```

### Validation
- Trade must have status FILLED
- `amountToClose` must be > 0
- `amountToClose` must be ≤ `remainingAmount`
- `exitPrice` must be > 0
- `exitFee` must be ≥ 0

## Calculations

### Proportional Entry Cost
```typescript
// ALWAYS use originalAmount as base
proportion = amountToClose / originalAmount
proportionalSumPlusFee = sumPlusFee × proportion
```

Example:
```
Original: 1.5 BTC @ $45,000 = $67,500
Close: 0.7 BTC
Proportion: 0.7 / 1.5 = 0.4667
Entry cost for this portion: $67,500 × 0.4667 = $31,500
```

### Remaining Amount
```typescript
rawRemaining = currentRemaining - amountToClose
// Round to 8 decimals to avoid floating point issues
newRemaining = Math.round(rawRemaining × 100000000) / 100000000
```

### Full Close Detection
```typescript
isFullyClosed = newRemaining <= 0.00000001
```

If fully closed:
- Parent trade status → CLOSED
- Parent trade closeDate set
- Parent trade remainingAmount = 0

## Process Flow

1. **Validate** trade and input parameters
2. **Calculate** proportional entry cost and new remaining amount
3. **Create** closed trade record with partial close metadata
4. **Update** parent trade:
   - Decrease `remainingAmount`
   - Set `originalAmount` (if not already set)
   - If fully closed: set status to CLOSED and closeDate
5. **Return** both parent and closed trade records

## Profit Calculation for Partial Closes

### For the Closed Portion
```typescript
exitValue = amountToClose × exitPrice × (100 - exitFee) / 100
profitUSD = exitValue - proportionalSumPlusFee
profitPercent = ((exitPrice / entryPrice - 1) × 100) - entryFee - exitFee
```

### For the Remaining Position (Parent Trade)
When finally closed:
```typescript
proportion = remainingAmount / originalAmount
proportionalSumPlusFee = sumPlusFee × proportion
exitValue = remainingAmount × exitPrice × (100 - exitFee) / 100
profitUSD = exitValue - proportionalSumPlusFee
```

## Edge Cases

### Multiple Partial Closes
```
Original: 1.5 BTC
Close 1: 0.5 BTC → Remaining: 1.0 BTC
Close 2: 0.3 BTC → Remaining: 0.7 BTC
Close 3: 0.7 BTC → Remaining: 0.0 BTC (FULLY CLOSED)
```

Each partial close:
- Creates separate closed trade record
- Uses `originalAmount` (1.5) for proportion calculation
- NOT the remaining amount at time of close

### Floating Point Precision
- All amounts rounded to 8 decimal places
- Prevents 0.0000000001 BTC remaining due to float math
- Threshold: 0.00000001 BTC considered as zero

### Statistics Impact
- Each partial close record appears as separate CLOSED trade
- Parent trade only included in statistics when fully closed
- Prevents double-counting in profit calculations

## Important Notes

1. **Always use originalAmount** for proportion calculations, not remainingAmount
2. **Round to 8 decimals** to handle floating point precision
3. **Update via MongoDB directly** for reliability (not Mongoose save)
4. **Create closed record before** updating parent trade
5. **Fetch fresh document** after update to verify changes

## Example Scenario

Purchase 1.5 BTC @ $45,000 (sumPlusFee: $67,500)

**Partial Close 1**: 0.5 BTC @ $48,000
```
Proportion: 0.5 / 1.5 = 0.3333
Entry cost: $67,500 × 0.3333 = $22,500
Exit value: 0.5 × $48,000 × 0.9975 = $23,940
Profit: $23,940 - $22,500 = $1,440
Remaining: 1.0 BTC
```

**Partial Close 2**: 1.0 BTC @ $50,000
```
Proportion: 1.0 / 1.5 = 0.6667
Entry cost: $67,500 × 0.6667 = $45,000
Exit value: 1.0 × $50,000 × 0.9975 = $49,875
Profit: $49,875 - $45,000 = $4,875
Remaining: 0.0 BTC (FULLY CLOSED)
```

**Total Profit**: $1,440 + $4,875 = $6,315
