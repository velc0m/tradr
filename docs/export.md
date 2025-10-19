# Data Export

## Overview
Export portfolio and trade data to Excel (XLSX) or CSV formats for external analysis, record-keeping, or tax reporting.

## Supported Formats

### XLSX (Excel)
- Multiple sheets support
- Portfolio summary sheet (optional)
- Formatted data with proper column headers
- Automatic column width adjustment

### CSV
- Single file with trade data
- UTF-8 encoding with BOM for Excel compatibility
- Comma-separated values

## API Endpoint

**GET** `/api/portfolios/[portfolioId]/export`

### Query Parameters

#### `format` (optional)
- Values: `"xlsx"` | `"csv"`
- Default: `"xlsx"`

#### `include` (optional)
- Values: `"all"` | `"open"` | `"closed"` | `"portfolio"` (comma-separated)
- Default: `"all"`
- Examples:
  - `include=all` - All trades
  - `include=open` - Only OPEN and FILLED trades
  - `include=closed` - Only CLOSED trades
  - `include=open,closed,portfolio` - All trades + portfolio info

### Example Request
```
GET /api/portfolios/abc123/export?format=xlsx&include=all,portfolio
```

## Export Data Structure

### Portfolio Summary Sheet (XLSX only)
```
Portfolio Name: My Trading Portfolio
Total Deposit: $10,000.00
Export Date: 2025-01-20 14:30

Coin Distribution
Symbol  Percentage  Decimal Places
BTC     40%         8
ETH     30%         8
SOL     20%         6
DOGE    10%         4
```

### Trades Sheet

| Column | Description | Format |
|--------|-------------|--------|
| Trade ID | MongoDB ObjectId | String |
| Coin | Cryptocurrency symbol | BTC, ETH, etc. |
| Status | Trade status | OPEN, FILLED, CLOSED |
| Type | Full or partial close | Full, Partial |
| Open Date | Order placement date | YYYY-MM-DD HH:mm |
| Filled Date | Order filled date | YYYY-MM-DD HH:mm or `-` |
| Close Date | Position closed date | YYYY-MM-DD HH:mm or `-` |
| Entry Price | Entry price USD | $45,000.50 |
| Exit Price | Exit price USD | $48,000.00 or `-` |
| Deposit % | % of deposit used | 10% |
| Entry Fee % | Entry fee percentage | 0.25% |
| Exit Fee % | Exit fee percentage | 0.25% or `-` |
| Original Amount | Total amount purchased | 1.50000000 |
| Remaining Amount | Amount still in position | 0.80000000 |
| Sum+Fee | Total entry cost | $67,500.00 |
| Profit % | Net profit percentage | +7.50% or -2.30% |
| Profit USD | Net profit in USD | +$5,000.00 or -$1,500.00 |

## Profit Calculations in Export

### For OPEN/FILLED Trades
Uses `remainingAmount` for profit calculation:
```typescript
proportion = remainingAmount / originalAmount
proportionalEntryCost = sumPlusFee × proportion
exitValue = remainingAmount × exitPrice × (100 - exitFee) / 100
profitUSD = exitValue - proportionalEntryCost
```

### For CLOSED Trades
Uses actual closed `amount`:
```typescript
exitValue = amount × exitPrice × (100 - exitFee) / 100
profitUSD = exitValue - sumPlusFee
```

## File Naming

Generated filenames include portfolio name and date:
```
portfolio-{sanitized_name}-{YYYY-MM-DD}.{ext}

Examples:
- portfolio-My_Trading_Portfolio-2025-01-20.xlsx
- portfolio-BTC_Only-2025-01-20.csv
```

Name sanitization:
- Non-alphanumeric characters replaced with `_`
- Spaces replaced with `_`

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

## Response Headers

### XLSX
```
Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
Content-Disposition: attachment; filename="portfolio-name-date.xlsx"
```

### CSV
```
Content-Type: text/csv; charset=utf-8
Content-Disposition: attachment; filename="portfolio-name-date.csv"
```

## Edge Cases

### Empty Portfolio
- XLSX: Creates file with portfolio summary (if included), empty trades sheet
- CSV: Returns UTF-8 BOM only (empty file)

### Trades Without Exit Price
- Profit columns show `-`
- Exit Price shows `-`
- Exit Fee shows `-`

### Partial Close Trades
- `Type` column shows "Partial"
- `Original Amount` shows original position size
- `Remaining Amount` shows current remaining (0 for closed portions)

### Special Characters in Portfolio Name
- Sanitized in filename
- Original name preserved in file content

## Usage Example

```typescript
// Download XLSX with all data
const downloadExcel = async (portfolioId: string) => {
  const url = `/api/portfolios/${portfolioId}/export?format=xlsx&include=all,portfolio`;
  const response = await fetch(url);
  const blob = await response.blob();

  // Trigger download
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = response.headers.get('Content-Disposition')
    .split('filename=')[1].replace(/"/g, '');
  a.click();
};

// Download CSV with closed trades only
const downloadCSV = async (portfolioId: string) => {
  const url = `/api/portfolios/${portfolioId}/export?format=csv&include=closed`;
  window.open(url, '_blank');
};
```

## Library Used
- **xlsx**: Used for both XLSX and CSV generation
- Handles UTF-8 BOM for Excel compatibility
- Automatic type inference for columns
