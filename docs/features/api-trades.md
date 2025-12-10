# Feature: Trades API
Date: 2025-01
Status: Complete

## Overview
RESTful API for trade management including LONG/SHORT positions and split functionality.

## Endpoints

### Create Trade
**POST** `/api/portfolios/[portfolioId]/trades`

```typescript
// Request
{
  coinSymbol: string;
  entryPrice: number;
  depositPercent: number;
  entryFee: number;
  openDate: string;  // YYYY-MM-DD
}

// Response
{ success: true, data: ITrade }
```

### List Trades
**GET** `/api/portfolios/[portfolioId]/trades`

Query: `status`: `"OPEN"` | `"FILLED"` | `"CLOSED"` (optional)
```typescript
{ success: true, data: ITrade[] }
```

### Get Trade
**GET** `/api/trades/[id]`

```typescript
{ success: true, data: ITrade }
```

### Update Trade
**PUT** `/api/trades/[id]`

```typescript
// Request (all optional)
{
  entryPrice?: number;
  depositPercent?: number;
  entryFee?: number;
  exitPrice?: number | null;
  exitFee?: number;
  status?: TradeStatus;
  openDate?: string;
  filledDate?: string;
  closeDate?: string;
}

// Response
{ success: true, data: ITrade }
```

### Delete Trade
**DELETE** `/api/trades/[id]`

```typescript
{ success: true, message: "..." }
```

### Split Position
**POST** `/api/trades/[id]/split`

Split a FILLED position into 2-5 independent positions.

```typescript
// Request
{
  amounts: number[];  // Must sum to trade amount
}

// Response
{
  success: true,
  data: {
    originalTrade: ITrade;      // isSplit: true, status: CLOSED
    splitTrades: ITrade[];      // New independent positions
  },
  message: "Trade successfully split into N positions"
}
```

**Restrictions:**
- Only FILLED trades can be split
- Cannot split SHORT positions with parentTradeId
- Amounts must sum to original (floating-point tolerance allowed)

## Related
- [Trade Lifecycle](./trades-lifecycle.md)
- [Portfolio API](./api-portfolios.md)
- [API Common](./api-common.md)
