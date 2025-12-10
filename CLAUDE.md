# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Tradr is a cryptocurrency trading tracker built with Next.js 14, TypeScript, and MongoDB. It tracks LONG and SHORT positions, calculates profit/loss, manages portfolios, and exports trade data.

## Commands

```bash
npm run dev           # Start development server (localhost:3333)
npm run build         # Build for production
npm run lint          # ESLint check
npm run type-check    # TypeScript compiler check
npm test              # Run all tests (111 tests)
npm run test:watch    # Watch mode
npm run test:coverage # Coverage report
```

## Architecture

### Trade Lifecycle
```
OPEN → FILLED → CLOSED
         ↓
         └─→ Can be split into 2-5 independent positions
```

- **OPEN**: Limit order placed, not yet filled
- **FILLED**: Order filled, position active (included in 30-day volume)
- **CLOSED**: Position closed, P&L finalized

### Trade Types
- **LONG**: Buy position, profit calculated in USD
- **SHORT**: Sell/borrow position, profit calculated in coins
- **Averaging SHORT**: Internal operation where SHORT profit is used to average down a parent LONG position (not counted in USD statistics)

### Key Business Logic

All profit calculations are pure functions in `src/lib/calculations.ts`:

**LONG profit (USD):**
```
exitValue = amount × exitPrice × (100 - exitFee) / 100
profitUSD = exitValue - sumPlusFee
```

**SHORT profit (coins):**
```
buyBackPriceWithFee = buyBackPrice × (100 + buyBackFee) / 100
coinsBoughtBack = sumPlusFee / buyBackPriceWithFee
profitCoins = coinsBoughtBack - soldAmount
```

### Directory Structure

- `src/app/` - Next.js App Router (pages and API routes)
- `src/components/features/` - Feature-specific components (trades/, portfolios/, cryptocurrencies/)
- `src/components/ui/` - shadcn/ui components
- `src/lib/` - Utilities: `calculations.ts` (profit math), `mongodb.ts` (connection), `auth.ts` (NextAuth)
- `src/models/` - Mongoose schemas: User, Portfolio, Trade, Cryptocurrency, UserSettings
- `src/types/index.ts` - All TypeScript interfaces (ITrade, IPortfolio, etc.)
- `src/__tests__/` - Test suites organized by api/, lib/, models/, scenarios/
- `docs/` - API reference, trade management, fee calculations, statistics docs

### API Routes (RESTful)

- `POST/GET /api/portfolios` - Create/list portfolios
- `GET/PUT/DELETE /api/portfolios/[id]` - Portfolio CRUD
- `POST/GET /api/portfolios/[id]/trades` - Create/list trades
- `GET /api/portfolios/[id]/stats` - Portfolio statistics
- `PUT/DELETE /api/trades/[id]` - Trade CRUD
- `POST /api/trades/[id]/split` - Split FILLED position into 2-5 parts

### Key Files

- `src/lib/calculations.ts` - Core profit calculation logic (changes affect all statistics)
- `src/models/Trade.ts` - Trade schema with computed virtual properties
- `src/types/index.ts` - All TypeScript interfaces
- `src/__tests__/scenarios/*.test.ts` - Critical integration tests

## Code Standards

- TypeScript strict mode: `strict: true`, no `any` types (enforced by ESLint)
- Path alias: `@/*` maps to `./src/*`
- Components organized by feature
- All code comments in English
- API routes follow REST conventions

## Environment Variables

```env
MONGODB_URI=mongodb+srv://...
NEXTAUTH_SECRET=<openssl rand -base64 32>
NEXTAUTH_URL=http://localhost:3333
NODE_ENV=development
```

## Testing

Tests use Jest with mongodb-memory-server for isolated database tests:
- `src/__tests__/lib/calculations.test.ts` - Profit calculation tests
- `src/__tests__/scenarios/long-lifecycle.test.ts` - LONG trade workflows
- `src/__tests__/scenarios/short-lifecycle.test.ts` - SHORT trade workflows
- `src/__tests__/scenarios/statistics.test.ts` - Statistics computation

Run a single test file:
```bash
npm test -- src/__tests__/lib/calculations.test.ts
```

## Git Commit Rules

**Commit message format:**
```
[TR-XX] Short description

Optional longer description
```

**Rules:**
- Task numbers are grouped by epic/story (e.g., all docs tasks = TR-26, all fee fixes = TR-25)
- Do NOT include footer lines like "Generated with..." or "Co-Authored-By..."
- Keep messages concise and descriptive
- Always commit to `dev` branch, then create PR to `master`
