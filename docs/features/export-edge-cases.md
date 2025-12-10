# Feature: Export Edge Cases
Date: 2025-01
Status: Complete

## Data Formatting

### Prices
- 6 decimal places
- Trailing zeros removed
- Examples: `$45000.5`, `$0.000123`

### Amounts
- Up to 10 decimal places
- Trailing zeros removed
- Examples: `1.5`, `0.00000123`

### Dates
- Format: `YYYY-MM-DD HH:mm`
- Empty dates: `-`

### Profit Values
- Positive: `+$5,000.00` or `+7.50%`
- Negative: `-$1,500.00` or `-2.30%`
- No exit price: `-`

## File Naming

```
portfolio-{sanitized_name}-{YYYY-MM-DD}.{ext}

Examples:
- portfolio-My_Trading_Portfolio-2025-01-20.xlsx
- portfolio-BTC_Only-2025-01-20.csv
```

Name sanitization:
- Non-alphanumeric → `_`
- Spaces → `_`

## Edge Cases

| Case | XLSX | CSV |
|------|------|-----|
| Empty portfolio | Summary + empty trades | UTF-8 BOM only |
| No exit price | Profit shows `-` | Profit shows `-` |
| Split positions | Each as independent row | Each as independent row |
| Special chars in name | Sanitized filename, original in content | Same |

## Usage Example

```typescript
// Download XLSX
const url = `/api/portfolios/${id}/export?format=xlsx&include=all,portfolio`;
const response = await fetch(url);
const blob = await response.blob();

// Download CSV
window.open(`/api/portfolios/${id}/export?format=csv&include=closed`, '_blank');
```

## Library
**xlsx** package for both formats, handles UTF-8 BOM for Excel compatibility.

## Related
- [Export Format](./export-format.md)
- [Export API](./api-export.md)
