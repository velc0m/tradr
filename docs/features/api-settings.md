# Feature: User Settings API
Date: 2025-01
Status: Complete

## Overview
User preferences for fee calculation mode and portfolio grouping.

## Endpoints

### Get Settings
**GET** `/api/settings`

Creates default settings if none exist.
```typescript
{
  success: true,
  data: {
    feeCalculationMode: "per-portfolio" | "combined";
    combinedPortfolios: string[];
  }
}
```

### Update Settings
**PUT** `/api/settings`

```typescript
// Request
{
  feeCalculationMode: "per-portfolio" | "combined";
  combinedPortfolios?: string[];
}

// Response
{
  success: true,
  data: IUserSettings,
  message: "Settings updated successfully"
}
```

## Related
- [Fee Calculation](./api-fees.md)
