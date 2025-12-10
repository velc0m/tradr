# Feature: Cryptocurrencies API
Date: 2025-01
Status: Complete

## Overview
Manage cryptocurrency reference data (symbols, names, decimal places).

## Endpoints

### List Cryptocurrencies
**GET** `/api/cryptocurrencies`

```typescript
{ success: true, data: ICryptocurrency[] }
```

### Create Cryptocurrency
**POST** `/api/cryptocurrencies`

```typescript
// Request
{
  name: string;
  symbol: string;
  decimalPlaces: number;
}

// Response
{ success: true, data: ICryptocurrency }
```

### Update Cryptocurrency
**PUT** `/api/cryptocurrencies/[id]`

Body: Partial cryptocurrency data
```typescript
{ success: true, data: ICryptocurrency }
```

### Delete Cryptocurrency
**DELETE** `/api/cryptocurrencies/[id]`

```typescript
{ success: true, message: "..." }
```

### Seed Default Cryptocurrencies
**POST** `/api/seed`

Seeds default crypto list if not already seeded. Auto-called on dashboard load.
```typescript
{ success: true }
```

## Related
- [Portfolio API](./api-portfolios.md)
