import { Session } from 'next-auth';

/**
 * Create a mock session for testing
 */
export const createMockSession = (userId = 'test-user-id'): Session => {
  return {
    user: {
      id: userId,
      email: 'test@example.com',
      name: 'Test User',
    },
    expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours from now
  };
};

/**
 * Mock getServerSession to return a test session
 */
export const mockGetServerSession = (session: Session | null = createMockSession()) => {
  const { getServerSession } = require('next-auth');
  (getServerSession as jest.Mock) = jest.fn().mockResolvedValue(session);
  return getServerSession;
};
