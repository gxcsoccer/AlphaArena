/**
 * GDPR DAO Tests
 */

import { GDPRDAO } from '../gdpr.dao';

// Mock Supabase client
jest.mock('../client', () => ({
  getSupabaseClient: () => ({
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          single: jest.fn(),
          limit: jest.fn(),
          order: jest.fn(),
          in: jest.fn(),
          lte: jest.fn(),
        })),
      })),
      insert: jest.fn(() => ({
        single: jest.fn(),
      })),
      update: jest.fn(() => ({
        eq: jest.fn(),
      })),
      delete: jest.fn(() => ({
        eq: jest.fn(),
      })),
      rpc: jest.fn(),
    })),
  }),
}));

describe('GDPR DAO', () => {
  describe('exportUserData', () => {
    it('should export all user data', async () => {
      // The mock is set up in the jest.mock above
      const result = await GDPRDAO.exportUserData('test-user-id');
      
      expect(result).toHaveProperty('exportId');
      expect(result).toHaveProperty('userId', 'test-user-id');
      expect(result).toHaveProperty('exportedAt');
      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('metadata');
    });
  });

  describe('createExportRequest', () => {
    it('should create an export request', async () => {
      // This will use the mocked Supabase client
      const result = await GDPRDAO.createExportRequest('test-user-id', 'json');
      
      // Just verify it doesn't throw with the mock
      expect(result).toBeDefined();
    });
  });

  describe('createDeletionRequest', () => {
    it('should create deletion request with confirmation code', async () => {
      const result = await GDPRDAO.createDeletionRequest('test-user-id', {
        ipAddress: '127.0.0.1',
        userAgent: 'test-agent',
      });
      
      expect(result).toBeDefined();
    });
  });

  describe('confirmDeletionRequest', () => {
    it('should confirm valid deletion request', async () => {
      // This tests the logic of confirming a deletion
      const result = await GDPRDAO.confirmDeletionRequest('request-id', '123456');
      
      expect(result).toHaveProperty('success');
    });
  });

  describe('cancelDeletionRequest', () => {
    it('should cancel deletion request', async () => {
      const result = await GDPRDAO.cancelDeletionRequest('request-id', 'user-id');
      
      expect(result).toHaveProperty('success');
    });
  });
});