# Feature: Fee Tiers Reference
Date: 2025-01
Status: Complete

## Overview
Coinbase-style tiered fee structure based on 30-day trading volume (Maker Fees).

## Fee Levels

| Level | Min Volume (USD) | Maker Fee (%) |
|-------|------------------|---------------|
| Intro 1 | $0 | 0.600% |
| Intro 2 | $10,000 | 0.400% |
| Advanced 1 | $25,000 | 0.250% |
| Advanced 2 | $75,000 | 0.125% |
| Advanced 3 | $250,000 | 0.075% |
| VIP 1 | $500,000 | 0.060% |
| VIP 2 | $1,000,000 | 0.050% |
| VIP 3 | $5,000,000 | 0.040% |
| VIP 4 | $10,000,000 | 0.025% |
| VIP 5 | $20,000,000 | 0.010% |
| VIP 6+ | $50,000,000+ | 0.000% |

## Threshold Rules
- Thresholds are inclusive (`>=`)
- Example: volume = $25,000 → Advanced 1 (0.250%)

## Related
- [Fee Calculation Logic](./fee-calculation-logic.md)
- [Fee API](./api-fees.md)
