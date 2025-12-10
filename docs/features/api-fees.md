# Feature: Fee Calculation API
Date: 2025-01
Status: Complete

## Overview
Dynamic fee calculation based on 30-day trading volume using Coinbase's tiered structure.

## Endpoint

### Calculate Fee Level
**GET** `/api/portfolios/[portfolioId]/calculate-fee`

**Query Parameters:**
- `type`: `"entry"` | `"exit"` (required)
- `tradeId`: Trade ID to exclude (optional, for entry fee)

```typescript
{
  success: true,
  data: {
    level: string;          // "Advanced 1"
    feePercent: number;     // 0.250
    currentVolume: number;  // 28500.00
    nextLevel: {
      level: string;
      minVolume: number;
      remaining: number;
    } | null;
  }
}
```

## Entry vs Exit Fee

| Type | Behavior |
|------|----------|
| Entry | Excludes current trade being created |
| Exit | Includes all filled trades |

## Related
- [Fee Tiers Reference](./fee-tiers.md)
- [Trades API](./api-trades.md)
