# Feature: Export Data Format
Date: 2025-01
Status: Complete

## Supported Formats

### XLSX (Excel)
- Multiple sheets support
- Portfolio summary sheet (optional)
- Formatted headers, auto column width

### CSV
- Single file with trade data
- UTF-8 encoding with BOM for Excel compatibility
- Comma-separated values

## Portfolio Summary Sheet (XLSX only)

```
Portfolio Name: My Trading Portfolio
Total Deposit: $10,000.00
Export Date: 2025-01-20 14:30

Coin Distribution
Symbol  Percentage  Decimal Places
BTC     40%         8
ETH     30%         8
SOL     20%         6
```

## Trades Sheet Columns

| Column | Description | Format |
|--------|-------------|--------|
| Trade ID | MongoDB ObjectId | String |
| Coin | Symbol | BTC, ETH |
| Status | Trade status | OPEN, FILLED, CLOSED |
| Type | Trade type | LONG, SHORT |
| Open Date | Order placed | YYYY-MM-DD HH:mm |
| Filled Date | Order filled | YYYY-MM-DD HH:mm or `-` |
| Close Date | Position closed | YYYY-MM-DD HH:mm or `-` |
| Entry Price | Entry USD | $45,000.50 |
| Exit Price | Exit USD | $48,000.00 or `-` |
| Deposit % | % used | 10% |
| Entry Fee % | Fee | 0.25% |
| Exit Fee % | Fee | 0.25% or `-` |
| Amount | Coins | 1.50000000 |
| Sum+Fee | Entry cost | $67,500.00 |
| Profit % | Net profit | +7.50% or -2.30% |
| Profit USD | Net profit | +$5,000.00 |
| Split Group | UUID | Shared or `-` |

## Related
- [Export API](./api-export.md)
- [Export Edge Cases](./export-edge-cases.md)
