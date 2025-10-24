// Jest setup file
// This file runs before each test

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.NEXTAUTH_SECRET = 'test-secret-key-for-testing';
process.env.NEXTAUTH_URL = 'http://localhost:3000';

// Extend Jest timeout for database operations
jest.setTimeout(30000);
