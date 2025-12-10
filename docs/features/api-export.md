# Feature: Export API
Date: 2025-01
Status: Complete

## Overview
Export portfolio and trade data to Excel (XLSX) or CSV formats.

## Endpoint

### Export Portfolio Data
**GET** `/api/portfolios/[portfolioId]/export`

**Query Parameters:**
- `format`: `"xlsx"` | `"csv"` (default: `"xlsx"`)
- `include`: Comma-separated: `"all"`, `"open"`, `"closed"`, `"portfolio"`

**Response:** Binary file download

**Headers:**
```
Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
  OR text/csv; charset=utf-8
Content-Disposition: attachment; filename="portfolio-name-date.{ext}"
```

## Example
```
GET /api/portfolios/abc123/export?format=xlsx&include=all,portfolio
```

## Related
- [Export Data Format](./export-format.md)
- [Portfolio API](./api-portfolios.md)
