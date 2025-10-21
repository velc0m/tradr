# Testing Guide

This directory contains all the tests for the Tradr application.

## Overview

We use **Jest** as our testing framework with the following tools:
- **ts-jest**: TypeScript support for Jest
- **mongodb-memory-server**: In-memory MongoDB for isolated database testing
- **@testing-library/react**: React component testing utilities
- **@testing-library/jest-dom**: Custom Jest matchers for DOM assertions

## Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode (re-runs on file changes)
npm run test:watch

# Run tests with coverage report
npm run test:coverage
```

## Test Structure

```
src/__tests__/
├── api/                      # API route tests
│   └── portfolios/
│       └── portfolio.test.ts # Portfolio model tests
├── helpers/                  # Test utilities
│   ├── db.ts                # MongoDB test helpers
│   ├── auth.ts              # Authentication mocking
│   └── testData.ts          # Test data generators
└── README.md
```

## Current Test Coverage

### Portfolio Tests (`portfolio.test.ts`)

**Portfolio Creation**:
- ✅ Create portfolio with correct data
- ✅ Validate coin percentages sum to 100%
- ✅ Accept percentages with decimal precision
- ✅ Require at least one coin

**Coin Allocation Calculation**:
- ✅ Calculate deposit distribution (50-30-20 split)
- ✅ Calculate deposit distribution (equal split)
- ✅ Calculate deposit distribution (uneven split)
- ✅ Handle decimal percentages correctly
- ✅ Work with small deposits
- ✅ Work with large deposits

**Portfolio Fields**:
- ✅ Store coin symbols in uppercase
- ✅ Store decimal places for each coin
- ✅ Include timestamps (createdAt, updatedAt)
- ✅ Support optional initialCoins field

## Test Helpers

### Database Helpers (`helpers/db.ts`)

```typescript
import { connectTestDB, closeTestDB, clearTestDB } from '../helpers/db';

// Setup and teardown in your tests
beforeAll(async () => {
  await connectTestDB(); // Connects to in-memory MongoDB
});

afterAll(async () => {
  await closeTestDB(); // Closes connection and stops MongoDB
});

afterEach(async () => {
  await clearTestDB(); // Clears all collections after each test
});
```

### Test Data Generators (`helpers/testData.ts`)

```typescript
import { createTestPortfolioData, calculateExpectedAllocation } from '../helpers/testData';

// Create default test portfolio
const portfolioData = createTestPortfolioData();

// Create custom portfolio
const customPortfolio = createTestPortfolioData({
  totalDeposit: 5000,
  coins: [
    { symbol: 'BTC', percentage: 60, decimalPlaces: 8 },
    { symbol: 'ETH', percentage: 40, decimalPlaces: 6 },
  ],
});

// Calculate expected allocation
const allocation = calculateExpectedAllocation(1000, portfolioData.coins);
// Returns: { BTC: 500, ETH: 300, ADA: 200 }
```

### Authentication Mocking (`helpers/auth.ts`)

```typescript
import { createMockSession, mockGetServerSession } from '../helpers/auth';

// Create mock session
const session = createMockSession('custom-user-id');

// Mock getServerSession for authenticated tests
mockGetServerSession(session);
```

## Writing New Tests

### Example: Portfolio Model Test

```typescript
import { connectTestDB, closeTestDB, clearTestDB } from '../../helpers/db';
import { createTestPortfolioData } from '../../helpers/testData';
import Portfolio from '@/models/Portfolio';

describe('Portfolio Tests', () => {
  beforeAll(async () => {
    await connectTestDB();
  });

  afterAll(async () => {
    await closeTestDB();
  });

  afterEach(async () => {
    await clearTestDB();
  });

  it('should create a portfolio', async () => {
    const data = {
      userId: 'test-user-id',
      ...createTestPortfolioData(),
    };

    const portfolio = await Portfolio.create(data);

    expect(portfolio).toBeDefined();
    expect(portfolio.name).toBe(data.name);
  });
});
```

## What We're Testing

### 1. Portfolio Coin Allocation

When a user creates a portfolio with:
- Total deposit: 1000 USD
- Coins: BTC (50%), ETH (30%), ADA (20%)

We verify that the allocation is calculated correctly:
- BTC: 500 USD (50% of 1000)
- ETH: 300 USD (30% of 1000)
- ADA: 200 USD (20% of 1000)

This ensures the deposit is distributed properly according to the user's chosen percentages.

### 2. Validation Rules

- Coin percentages must sum to exactly 100%
- At least one coin is required
- Coin symbols are stored in uppercase
- Decimal places are validated (0-8)

### 3. Data Integrity

- Timestamps are automatically created
- Fields are properly validated
- Optional fields (like initialCoins) work correctly

## Next Steps

Future tests to add:
- [ ] Trade creation and profit calculations
- [ ] LONG position tests
- [ ] SHORT position tests
- [ ] Partial close functionality
- [ ] Statistics calculation tests
- [ ] API endpoint tests (with authentication)
- [ ] Component tests (UI)

## Tips

1. **Isolation**: Each test should be independent. Use `afterEach` to clear the database.
2. **Descriptive names**: Use clear test names that describe what's being tested.
3. **Arrange-Act-Assert**: Structure tests with setup, execution, and verification.
4. **Mock external dependencies**: Use test helpers to mock auth, API calls, etc.
5. **Test edge cases**: Include tests for boundary conditions, errors, and unusual inputs.

## Configuration Files

- `jest.config.js`: Main Jest configuration
- `jest.setup.js`: Setup file that runs before all tests
- `tsconfig.test.json`: TypeScript configuration for tests
