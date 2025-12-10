# API Endpoints

## Authentication
All endpoints require authentication via NextAuth session. Unauthorized requests return `401`.

---

## Portfolios

### Create Portfolio
**POST** `/api/portfolios`

**Body:**
```typescript
{
  name: string;
  totalDeposit: number;
  coins: Array<{
    symbol: string;
    percentage: number;
    decimalPlaces: number;
  }>;
}
```

**Response:** `{ success: true, data: IPortfolio }`

---

### List Portfolios
**GET** `/api/portfolios`

**Response:** `{ success: true, data: IPortfolio[] }`

---

### Get Portfolio
**GET** `/api/portfolios/[portfolioId]`

**Response:** `{ success: true, data: IPortfolio }`

---

### Update Portfolio
**PUT** `/api/portfolios/[portfolioId]`

**Body:** Partial portfolio data (name, totalDeposit, coins)

**Response:** `{ success: true, data: IPortfolio }`

---

### Delete Portfolio
**DELETE** `/api/portfolios/[portfolioId]`

Also deletes all associated trades.

**Response:** `{ success: true, message: "..." }`

---

## Trades

### Create Trade
**POST** `/api/portfolios/[portfolioId]/trades`

**Body:**
```typescript
{
  coinSymbol: string;
  entryPrice: number;
  depositPercent: number;
  entryFee: number;
  openDate: string;  // YYYY-MM-DD
}
```

**Response:** `{ success: true, data: ITrade }`

---

### List Trades
**GET** `/api/portfolios/[portfolioId]/trades`

**Query Parameters:**
- `status`: `"OPEN"` | `"FILLED"` | `"CLOSED"` (optional)

**Response:** `{ success: true, data: ITrade[] }`

---

### Get Trade
**GET** `/api/trades/[id]`

**Response:** `{ success: true, data: ITrade }`

---

### Update Trade
**PUT** `/api/trades/[id]`

**Body:**
```typescript
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
```

**Response:** `{ success: true, data: ITrade }`

---

### Delete Trade
**DELETE** `/api/trades/[id]`

**Response:** `{ success: true, message: "..." }`

---

### Split Position
**POST** `/api/trades/[id]/split`

**Body:**
```typescript
{
  amounts: number[];  // Array of 2-5 amounts that must sum to trade amount
}
```

**Response:**
```typescript
{
  success: true,
  data: {
    originalTrade: ITrade;      // Marked as isSplit: true, status: CLOSED
    splitTrades: ITrade[];      // New independent positions
  },
  message: "Trade successfully split into N positions"
}
```

**Restrictions:**
- Only FILLED trades can be split
- Cannot split SHORT positions derived from LONG (with parentTradeId)
- Amounts must sum to original trade amount (small floating-point tolerance allowed)

---

## Statistics

### Portfolio Statistics
**GET** `/api/portfolios/[portfolioId]/stats`

**Response:**
```typescript
{
  success: true,
  data: {
    totalProfitUSD: number;
    totalProfitPercent: number;
    winRate: number;
    avgProfitUSD: number;
    avgProfitPercent: number;
    totalROI: number;
    totalTrades: {
      open: number;
      filled: number;
      closed: number;
    };
    bestTrade: { trade: TradeWithProfit } | null;
    worstTrade: { trade: TradeWithProfit } | null;
    performanceByCoin: CoinPerformance[];
    topProfitableTrades: TradeWithProfit[];
    topLosingTrades: TradeWithProfit[];
    cumulativeProfit: CumulativeProfitPoint[];
  }
}
```

See [statistics.md](./statistics.md) for details.

---

## Fee Calculation

### Calculate Fee Level
**GET** `/api/portfolios/[portfolioId]/calculate-fee`

**Query Parameters:**
- `type`: `"entry"` | `"exit"` (required)
- `tradeId`: Trade ID to exclude (optional, for entry fee)

**Response:**
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

See [fee-calculation.md](./fee-calculation.md) for details.

---

## Export

### Export Portfolio Data
**GET** `/api/portfolios/[portfolioId]/export`

**Query Parameters:**
- `format`: `"xlsx"` | `"csv"` (default: `"xlsx"`)
- `include`: Comma-separated list of `"all"`, `"open"`, `"closed"`, `"portfolio"` (default: `"all"`)

**Response:** Binary file download (XLSX or CSV)

**Headers:**
```
Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
  OR text/csv; charset=utf-8
Content-Disposition: attachment; filename="portfolio-name-date.{ext}"
```

See [export.md](./export.md) for details.

---

## User Settings

### Get Settings
**GET** `/api/settings`

**Response:**
```typescript
{
  success: true,
  data: {
    feeCalculationMode: "per-portfolio" | "combined";
    combinedPortfolios: string[];
  }
}
```

Creates default settings if none exist.

---

### Update Settings
**PUT** `/api/settings`

**Body:**
```typescript
{
  feeCalculationMode: "per-portfolio" | "combined";
  combinedPortfolios?: string[];
}
```

**Response:**
```typescript
{
  success: true,
  data: IUserSettings,
  message: "Settings updated successfully"
}
```

---

## Cryptocurrencies

### List Cryptocurrencies
**GET** `/api/cryptocurrencies`

**Response:** `{ success: true, data: ICryptocurrency[] }`

---

### Create Cryptocurrency
**POST** `/api/cryptocurrencies`

**Body:**
```typescript
{
  name: string;
  symbol: string;
  decimalPlaces: number;
}
```

**Response:** `{ success: true, data: ICryptocurrency }`

---

### Update Cryptocurrency
**PUT** `/api/cryptocurrencies/[id]`

**Body:** Partial cryptocurrency data

**Response:** `{ success: true, data: ICryptocurrency }`

---

### Delete Cryptocurrency
**DELETE** `/api/cryptocurrencies/[id]`

**Response:** `{ success: true, message: "..." }`

---

## Seed Data

### Seed Default Cryptocurrencies
**POST** `/api/seed`

Seeds default crypto list if not already seeded.

**Response:** `{ success: true }`

Automatically called on dashboard load.

---

## Error Responses

All endpoints return errors in this format:
```typescript
{
  success: false,
  error: string  // Error message
}
```

### Status Codes
- `200` - Success
- `400` - Bad Request (validation error)
- `401` - Unauthorized (not logged in)
- `403` - Forbidden (not your resource)
- `404` - Not Found
- `500` - Internal Server Error

---

## Request Validation

Most endpoints use Zod schemas for validation. Invalid requests return:
```typescript
{
  success: false,
  error: "Validation error message"
}
```

---

## Notes

1. All date inputs use format `YYYY-MM-DD`
2. All dates are stored as `Date` objects in MongoDB
3. All prices/amounts are numbers, not strings
4. User ownership is verified on all portfolio/trade operations
5. Cascading deletes: Deleting portfolio deletes all trades
