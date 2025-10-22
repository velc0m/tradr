# Trade Management

## Overview
Trades represent cryptocurrency positions in a portfolio. They follow a lifecycle from creation (OPEN) to filled (FILLED) to closed (CLOSED).

## Trade Lifecycle

```
OPEN → FILLED → CLOSED
         ↓
         └─→ Can be split into 2-5 independent positions
```

### Trade Statuses
- **OPEN**: Limit order placed, not yet filled
- **FILLED**: Order filled, position active, awaiting exit
- **CLOSED**: Position closed, P&L finalized

## Core Trade Properties

```typescript
interface ITrade {
  portfolioId: string;
  coinSymbol: string;
  status: TradeStatus;

  // Entry details
  entryPrice: number;           // Entry price in USD
  depositPercent: number;       // % of deposit used for this trade
  entryFee: number;            // Entry fee %
  sumPlusFee: number;          // Total cost (amount × entryPrice)
  amount: number;              // Coin amount purchased

  // Exit details
  exitPrice?: number;          // Exit price in USD (null if not set)
  exitFee?: number;           // Exit fee % (null if not set)

  // Reference tracking (never changes)
  initialEntryPrice: number;   // Original entry price (preserved)
  initialAmount: number;       // Original amount (preserved)

  // Relationships
  parentTradeId?: string;      // For SHORT derived from LONG

  // Split tracking
  isSplit?: boolean;           // True if this trade was split
  splitFromTradeId?: string;   // References original if this is a split
  splitGroupId?: string;       // UUID shared by all splits from same original

  // Dates
  openDate: Date;             // When limit order was placed
  filledDate?: Date;          // When order was filled
  closeDate?: Date;           // When position was closed
}
```

## Creating a Trade

**POST** `/api/portfolios/[portfolioId]/trades`

```typescript
{
  coinSymbol: "BTC",
  entryPrice: 45000.50,
  depositPercent: 10,
  entryFee: 0.25,
  openDate: "2025-01-15"
}
```

Calculations performed:
```typescript
sumPlusFee = (totalDeposit × depositPercent / 100)
amount = sumPlusFee / entryPrice
```

## Editing a Trade

**PUT** `/api/trades/[id]`

Can update:
- `entryPrice`
- `depositPercent`
- `entryFee`
- `exitPrice` (can be set or cleared)
- `exitFee`
- `openDate`

When entry details change, `amount` is recalculated automatically.

## Marking as Filled

**PUT** `/api/trades/[id]`

```typescript
{
  status: "FILLED",
  filledDate: "2025-01-16"
}
```

Changes:
- Status: OPEN → FILLED
- Sets `filledDate`
- Trade now included in 30-day volume calculations

## Setting Exit Price

**PUT** `/api/trades/[id]`

```typescript
{
  exitPrice: 48500.00,
  exitFee: 0.25
}
```

- Can be set on FILLED trades to preview potential profit
- Can be cleared by setting `exitPrice: null`
- Does NOT close the trade (status remains FILLED)

## Closing a Trade

Set exit price + manually change status to CLOSED via edit dialog.

## Splitting a Position

**POST** `/api/trades/[id]/split`

Split a FILLED position into 2-5 independent positions:

```typescript
{
  amounts: [0.5, 0.3, 0.2]  // Must sum to original trade amount
}
```

Behavior:
- Each split inherits `entryPrice`, `entryFee`, `openDate`, `filledDate` from original
- Each split gets proportional `amount` and `sumPlusFee`
- All splits share a common `splitGroupId` (UUID)
- Original trade marked as `isSplit: true` and status set to CLOSED
- Visual indicators show "Split 1/3", "Split 2/3", etc. in UI

Restrictions:
- Only FILLED trades can be split
- Cannot split SHORT positions derived from LONG (with parentTradeId)
- Amounts must sum to original trade amount (with small floating-point tolerance)

## Important Formulas

### Amount Calculation
```typescript
amount = sumPlusFee / entryPrice
```

### Profit Percentage
```typescript
profitPercent = ((exitPrice / entryPrice - 1) × 100) - entryFee - exitFee
```

### Profit USD
```typescript
exitValue = amount × exitPrice × (100 - exitFee) / 100
profitUSD = exitValue - sumPlusFee
```

## Edge Cases

### Changing Entry Price
- Recalculates `amount` based on existing `sumPlusFee`
- Maintains total investment, changes coin quantity

### Clearing Exit Price
- Sets `exitPrice` to `null`
- Resets `exitFee` to match `entryFee`
- Clears profit calculations

### Filled Date Before Open Date
- No validation enforced
- Users are responsible for logical date ordering

### Decimal Precision
- Prices: Up to 6 decimal places
- Amounts: Up to 10 decimal places
- Displayed with trailing zeros removed
