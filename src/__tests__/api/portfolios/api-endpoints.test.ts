import { NextRequest, NextResponse } from 'next/server';
import { connectTestDB, closeTestDB, clearTestDB } from '../../helpers/db';
import Portfolio from '@/models/Portfolio';
import { GET, POST } from '@/app/api/portfolios/route';
import {
  GET as GET_SINGLE,
  PUT,
  DELETE,
} from '@/app/api/portfolios/[portfolioId]/route';

// Mock NextAuth
jest.mock('next-auth', () => ({
  getServerSession: jest.fn(),
}));

import { getServerSession } from 'next-auth';

/**
 * Portfolio API Endpoints Tests
 *
 * Tests the HTTP API layer for portfolio CRUD operations:
 * - Authentication (requires valid session)
 * - Authorization (user can only access their own portfolios)
 * - Validation (request body validation)
 * - CRUD operations (Create, Read, Update, Delete)
 */
describe('Portfolio API Endpoints', () => {
  const mockSession = {
    user: {
      id: 'test-user-id',
      email: 'test@example.com',
      name: 'Test User',
    },
    expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  };

  beforeAll(async () => {
    await connectTestDB();
  });

  afterAll(async () => {
    await closeTestDB();
  });

  beforeEach(async () => {
    await clearTestDB();
    // Reset all mocks before each test
    jest.clearAllMocks();
  });

  describe('POST /api/portfolios - Create Portfolio', () => {
    // ⚠️ CRITICAL TEST - Verifies authentication is enforced
    // Why: Unauthenticated users must not create portfolios
    // If this breaks: Security vulnerability - anyone can create portfolios
    it('should return 401 if user is not authenticated', async () => {
      (getServerSession as jest.Mock).mockResolvedValue(null);

      const request = new NextRequest('http://localhost:3000/api/portfolios', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Test Portfolio',
          totalDeposit: 10000,
          coins: [{ symbol: 'BTC', percentage: 100, decimalPlaces: 8 }],
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Unauthorized');
    });

    it('should create a portfolio with valid data', async () => {
      (getServerSession as jest.Mock).mockResolvedValue(mockSession);

      const portfolioData = {
        name: 'Test Portfolio',
        totalDeposit: 10000,
        coins: [
          { symbol: 'BTC', percentage: 50, decimalPlaces: 8 },
          { symbol: 'ETH', percentage: 50, decimalPlaces: 6 },
        ],
      };

      const request = new NextRequest('http://localhost:3000/api/portfolios', {
        method: 'POST',
        body: JSON.stringify(portfolioData),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.success).toBe(true);
      expect(data.data.name).toBe('Test Portfolio');
      expect(data.data.totalDeposit).toBe(10000);
      expect(data.data.userId).toBe('test-user-id');
      expect(data.message).toBe('Portfolio created successfully');
    });

    it('should validate that coin percentages sum to 100%', async () => {
      (getServerSession as jest.Mock).mockResolvedValue(mockSession);

      const portfolioData = {
        name: 'Invalid Portfolio',
        totalDeposit: 10000,
        coins: [
          { symbol: 'BTC', percentage: 50, decimalPlaces: 8 },
          { symbol: 'ETH', percentage: 30, decimalPlaces: 6 },
          // Total: 80%, not 100%
        ],
      };

      const request = new NextRequest('http://localhost:3000/api/portfolios', {
        method: 'POST',
        body: JSON.stringify(portfolioData),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain('100');
    });

    it('should require at least one coin', async () => {
      (getServerSession as jest.Mock).mockResolvedValue(mockSession);

      const portfolioData = {
        name: 'No Coins Portfolio',
        totalDeposit: 10000,
        coins: [],
      };

      const request = new NextRequest('http://localhost:3000/api/portfolios', {
        method: 'POST',
        body: JSON.stringify(portfolioData),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain('At least one coin');
    });
  });

  describe('GET /api/portfolios - List Portfolios', () => {
    it('should return 401 if user is not authenticated', async () => {
      (getServerSession as jest.Mock).mockResolvedValue(null);

      const request = new NextRequest('http://localhost:3000/api/portfolios', {
        method: 'GET',
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.success).toBe(false);
    });

    it('should return all portfolios for authenticated user', async () => {
      (getServerSession as jest.Mock).mockResolvedValue(mockSession);

      // Create test portfolios
      await Portfolio.create({
        userId: 'test-user-id',
        name: 'Portfolio 1',
        totalDeposit: 10000,
        coins: [{ symbol: 'BTC', percentage: 100, decimalPlaces: 8 }],
      });

      await Portfolio.create({
        userId: 'test-user-id',
        name: 'Portfolio 2',
        totalDeposit: 20000,
        coins: [{ symbol: 'ETH', percentage: 100, decimalPlaces: 6 }],
      });

      // Create portfolio for different user (should not be returned)
      await Portfolio.create({
        userId: 'other-user-id',
        name: 'Other User Portfolio',
        totalDeposit: 5000,
        coins: [{ symbol: 'BTC', percentage: 100, decimalPlaces: 8 }],
      });

      const request = new NextRequest('http://localhost:3000/api/portfolios', {
        method: 'GET',
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toHaveLength(2);
      expect(data.data[0].name).toBe('Portfolio 2'); // Most recent first
      expect(data.data[1].name).toBe('Portfolio 1');
    });
  });

  describe('GET /api/portfolios/[portfolioId] - Get Single Portfolio', () => {
    it('should return 401 if user is not authenticated', async () => {
      (getServerSession as jest.Mock).mockResolvedValue(null);

      const request = new NextRequest(
        'http://localhost:3000/api/portfolios/123',
        {
          method: 'GET',
        }
      );

      const response = await GET_SINGLE(request, {
        params: Promise.resolve({ portfolioId: '123' }),
      });
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.success).toBe(false);
    });

    it('should return 404 if portfolio does not exist', async () => {
      (getServerSession as jest.Mock).mockResolvedValue(mockSession);

      const fakeId = '507f1f77bcf86cd799439011'; // Valid MongoDB ObjectId format

      const request = new NextRequest(
        `http://localhost:3000/api/portfolios/${fakeId}`,
        {
          method: 'GET',
        }
      );

      const response = await GET_SINGLE(request, {
        params: Promise.resolve({ portfolioId: fakeId }),
      });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Portfolio not found');
    });

    // ⚠️ CRITICAL TEST - Authorization check
    // Why: Users must not access portfolios they don't own
    // If this breaks: Data leak - users can see others' portfolios
    it('should return 403 if user does not own the portfolio', async () => {
      (getServerSession as jest.Mock).mockResolvedValue(mockSession);

      // Create portfolio for different user
      const portfolio = await Portfolio.create({
        userId: 'other-user-id',
        name: 'Other User Portfolio',
        totalDeposit: 10000,
        coins: [{ symbol: 'BTC', percentage: 100, decimalPlaces: 8 }],
      });

      const request = new NextRequest(
        `http://localhost:3000/api/portfolios/${portfolio._id}`,
        {
          method: 'GET',
        }
      );

      const response = await GET_SINGLE(request, {
        params: Promise.resolve({ portfolioId: portfolio._id.toString() }),
      });
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Forbidden');
    });

    it('should return portfolio if user owns it', async () => {
      (getServerSession as jest.Mock).mockResolvedValue(mockSession);

      const portfolio = await Portfolio.create({
        userId: 'test-user-id',
        name: 'My Portfolio',
        totalDeposit: 10000,
        coins: [{ symbol: 'BTC', percentage: 100, decimalPlaces: 8 }],
      });

      const request = new NextRequest(
        `http://localhost:3000/api/portfolios/${portfolio._id}`,
        {
          method: 'GET',
        }
      );

      const response = await GET_SINGLE(request, {
        params: Promise.resolve({ portfolioId: portfolio._id.toString() }),
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.name).toBe('My Portfolio');
      expect(data.data.userId).toBe('test-user-id');
    });
  });

  describe('PUT /api/portfolios/[portfolioId] - Update Portfolio', () => {
    it('should update portfolio with valid data', async () => {
      (getServerSession as jest.Mock).mockResolvedValue(mockSession);

      const portfolio = await Portfolio.create({
        userId: 'test-user-id',
        name: 'Original Name',
        totalDeposit: 10000,
        coins: [{ symbol: 'BTC', percentage: 100, decimalPlaces: 8 }],
      });

      const updateData = {
        name: 'Updated Name',
        totalDeposit: 15000,
        coins: [
          { symbol: 'BTC', percentage: 60, decimalPlaces: 8 },
          { symbol: 'ETH', percentage: 40, decimalPlaces: 6 },
        ],
      };

      const request = new NextRequest(
        `http://localhost:3000/api/portfolios/${portfolio._id}`,
        {
          method: 'PUT',
          body: JSON.stringify(updateData),
        }
      );

      const response = await PUT(request, {
        params: Promise.resolve({ portfolioId: portfolio._id.toString() }),
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.name).toBe('Updated Name');
      expect(data.data.totalDeposit).toBe(15000);
      expect(data.data.coins).toHaveLength(2);
    });

    it('should return 403 if user does not own the portfolio', async () => {
      (getServerSession as jest.Mock).mockResolvedValue(mockSession);

      // Create portfolio for different user
      const portfolio = await Portfolio.create({
        userId: 'other-user-id',
        name: 'Other User Portfolio',
        totalDeposit: 10000,
        coins: [{ symbol: 'BTC', percentage: 100, decimalPlaces: 8 }],
      });

      const updateData = {
        name: 'Hacked Name',
        totalDeposit: 99999,
        coins: [{ symbol: 'BTC', percentage: 100, decimalPlaces: 8 }],
      };

      const request = new NextRequest(
        `http://localhost:3000/api/portfolios/${portfolio._id}`,
        {
          method: 'PUT',
          body: JSON.stringify(updateData),
        }
      );

      const response = await PUT(request, {
        params: Promise.resolve({ portfolioId: portfolio._id.toString() }),
      });
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Forbidden');

      // Verify portfolio was not updated
      const unchangedPortfolio = await Portfolio.findById(portfolio._id);
      expect(unchangedPortfolio?.name).toBe('Other User Portfolio');
    });
  });

  describe('DELETE /api/portfolios/[portfolioId] - Delete Portfolio', () => {
    it('should delete portfolio if user owns it', async () => {
      (getServerSession as jest.Mock).mockResolvedValue(mockSession);

      const portfolio = await Portfolio.create({
        userId: 'test-user-id',
        name: 'To Delete',
        totalDeposit: 10000,
        coins: [{ symbol: 'BTC', percentage: 100, decimalPlaces: 8 }],
      });

      const request = new NextRequest(
        `http://localhost:3000/api/portfolios/${portfolio._id}`,
        {
          method: 'DELETE',
        }
      );

      const response = await DELETE(request, {
        params: Promise.resolve({ portfolioId: portfolio._id.toString() }),
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.message).toBe('Portfolio deleted successfully');

      // Verify portfolio is deleted
      const deletedPortfolio = await Portfolio.findById(portfolio._id);
      expect(deletedPortfolio).toBeNull();
    });

    it('should return 403 if user does not own the portfolio', async () => {
      (getServerSession as jest.Mock).mockResolvedValue(mockSession);

      // Create portfolio for different user
      const portfolio = await Portfolio.create({
        userId: 'other-user-id',
        name: 'Protected Portfolio',
        totalDeposit: 10000,
        coins: [{ symbol: 'BTC', percentage: 100, decimalPlaces: 8 }],
      });

      const request = new NextRequest(
        `http://localhost:3000/api/portfolios/${portfolio._id}`,
        {
          method: 'DELETE',
        }
      );

      const response = await DELETE(request, {
        params: Promise.resolve({ portfolioId: portfolio._id.toString() }),
      });
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Forbidden');

      // Verify portfolio still exists
      const stillExists = await Portfolio.findById(portfolio._id);
      expect(stillExists).not.toBeNull();
    });
  });
});
