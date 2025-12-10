# Feature: Portfolio API
Date: 2025-01
Status: Complete

## Overview
RESTful API endpoints for portfolio CRUD operations. All endpoints require NextAuth session authentication.

## Endpoints

### Create Portfolio
**POST** `/api/portfolios`

```typescript
// Request
{
  name: string;
  totalDeposit: number;
  coins: Array<{
    symbol: string;
    percentage: number;
    decimalPlaces: number;
  }>;
}

// Response
{ success: true, data: IPortfolio }
```

### List Portfolios
**GET** `/api/portfolios`

Returns all portfolios for authenticated user.
```typescript
{ success: true, data: IPortfolio[] }
```

### Get Portfolio
**GET** `/api/portfolios/[portfolioId]`

```typescript
{ success: true, data: IPortfolio }
```

### Update Portfolio
**PUT** `/api/portfolios/[portfolioId]`

Body: Partial portfolio data (name, totalDeposit, coins)
```typescript
{ success: true, data: IPortfolio }
```

### Delete Portfolio
**DELETE** `/api/portfolios/[portfolioId]`

Also deletes all associated trades.
```typescript
{ success: true, message: "..." }
```

## Related
- [Trades API](./api-trades.md)
- [Statistics API](./api-statistics.md)
- [API Common](./api-common.md)
