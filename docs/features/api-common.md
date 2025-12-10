# Feature: API Common Patterns
Date: 2025-01
Status: Complete

## Authentication
All endpoints require NextAuth session. Unauthorized requests return `401`.

## Error Responses

```typescript
{
  success: false,
  error: string  // Error message
}
```

## Status Codes

| Code | Meaning |
|------|---------|
| 200 | Success |
| 400 | Bad Request (validation error) |
| 401 | Unauthorized (not logged in) |
| 403 | Forbidden (not your resource) |
| 404 | Not Found |
| 500 | Internal Server Error |

## Request Validation

Most endpoints use Zod schemas. Invalid requests return:
```typescript
{
  success: false,
  error: "Validation error message"
}
```

## Notes

1. All date inputs: `YYYY-MM-DD` format
2. Dates stored as `Date` objects in MongoDB
3. Prices/amounts are numbers, not strings
4. User ownership verified on all operations
5. Cascading deletes: Portfolio deletion removes all trades

## Related
- [Portfolio API](./api-portfolios.md)
- [Trades API](./api-trades.md)
