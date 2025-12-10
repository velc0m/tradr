# Feature: Trade Properties
Date: 2025-01
Status: Complete

## Core Trade Interface

```typescript
interface ITrade {
  portfolioId: string;
  coinSymbol: string;
  status: TradeStatus;

  // Entry details
  entryPrice: number;           // Entry price in USD
  depositPercent: number;       // % of deposit used
  entryFee: number;             // Entry fee %
  sumPlusFee: number;           // Total cost (amount × entryPrice)
  amount: number;               // Coin amount purchased

  // Exit details
  exitPrice?: number;           // Exit price USD (null if not set)
  exitFee?: number;             // Exit fee % (null if not set)

  // Reference tracking (NEVER changes)
  initialEntryPrice: number;    // Original entry price (preserved)
  initialAmount: number;        // Original amount (preserved)

  // Relationships
  parentTradeId?: string;       // For SHORT derived from LONG

  // Split tracking
  isSplit?: boolean;            // True if trade was split
  splitFromTradeId?: string;    // References original
  splitGroupId?: string;        // UUID shared by all splits

  // Dates
  openDate: Date;               // Limit order placed
  filledDate?: Date;            // Order filled
  closeDate?: Date;             // Position closed
}
```

## Important: Immutable Fields

`initialEntryPrice` and `initialAmount` **NEVER change** after creation.

When SHORT closes and updates parent LONG:
- `entryPrice` recalculates
- `amount` updates
- `initialEntryPrice` stays same
- `initialAmount` stays same

## Related
- [Trade Lifecycle](./trades-lifecycle.md)
- [Trade Calculations](./trades-calculations.md)
