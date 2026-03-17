/**
 * Tests for API Key Data Access Object
 */

import * as ApiKeyDao from '../apiKeyDao';

describe('ApiKeyDao', () => {
  // Clear all data before each test
  beforeEach(async () => {
    // Get all keys and delete them
    const keys = await ApiKeyDao.getAllApiKeys();
    for (const key of keys) {
      await ApiKeyDao.deleteApiKey(key.id);
    }
  });

  describe('createApiKey', () => {
    it('should create a new API key with default values', async () => {
      const request = {
        name: 'Test Key',
        userId: 'user-123',
        permission: 'read' as const,
      };

      const result = await ApiKeyDao.createApiKey(request);

      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
      expect(result.secretKey).toBeDefined();
      expect(result.secretKey).toMatch(/^aa_live_/);
      expect(result.name).toBe('Test Key');
      expect(result.userId).toBe('user-123');
      expect(result.permission).toBe('read');
      expect(result.status).toBe('active');
      expect(result.rateLimitPerMinute).toBe(60); // Default for 'read'
      expect(result.rateLimitPerDay).toBe(10000); // Default for 'read'
    });

    it('should create an API key with custom rate limits', async () => {
      const request = {
        name: 'Custom Limits Key',
        userId: 'user-123',
        permission: 'trade' as const,
        rateLimitPerMinute: 200,
        rateLimitPerDay: 50000,
      };

      const result = await ApiKeyDao.createApiKey(request);

      expect(result.rateLimitPerMinute).toBe(200);
      expect(result.rateLimitPerDay).toBe(50000);
      expect(result.permission).toBe('trade');
    });

    it('should create an admin key with admin rate limits', async () => {
      const request = {
        name: 'Admin Key',
        userId: 'user-123',
        permission: 'admin' as const,
      };

      const result = await ApiKeyDao.createApiKey(request);

      expect(result.rateLimitPerMinute).toBe(300); // Default for 'admin'
      expect(result.rateLimitPerDay).toBe(50000); // Default for 'admin'
    });
  });

  describe('getApiKey', () => {
    it('should retrieve an API key by ID', async () => {
      const created = await ApiKeyDao.createApiKey({
        name: 'Test Key',
        userId: 'user-123',
        permission: 'read',
      });

      const retrieved = await ApiKeyDao.getApiKey(created.id);

      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(created.id);
      expect(retrieved?.name).toBe('Test Key');
    });

    it('should return null for non-existent key', async () => {
      const result = await ApiKeyDao.getApiKey('non-existent');
      expect(result).toBeNull();
    });
  });

  describe('getApiKeysByUser', () => {
    it('should return all keys for a user', async () => {
      await ApiKeyDao.createApiKey({
        name: 'Key 1',
        userId: 'user-123',
        permission: 'read',
      });

      await ApiKeyDao.createApiKey({
        name: 'Key 2',
        userId: 'user-123',
        permission: 'trade',
      });

      await ApiKeyDao.createApiKey({
        name: 'Key 3',
        userId: 'user-456',
        permission: 'read',
      });

      const userKeys = await ApiKeyDao.getApiKeysByUser('user-123');

      expect(userKeys).toHaveLength(2);
      expect(userKeys.map(k => k.name)).toContain('Key 1');
      expect(userKeys.map(k => k.name)).toContain('Key 2');
    });
  });

  describe('updateApiKey', () => {
    it('should update API key properties', async () => {
      const created = await ApiKeyDao.createApiKey({
        name: 'Original Name',
        userId: 'user-123',
        permission: 'read',
      });

      const updated = await ApiKeyDao.updateApiKey(created.id, {
        name: 'New Name',
        rateLimitPerMinute: 100,
      });

      expect(updated?.name).toBe('New Name');
      expect(updated?.rateLimitPerMinute).toBe(100);
    });

    it('should return null for non-existent key', async () => {
      const result = await ApiKeyDao.updateApiKey('non-existent', { name: 'New Name' });
      expect(result).toBeNull();
    });
  });

  describe('revokeApiKey', () => {
    it('should revoke an API key', async () => {
      const created = await ApiKeyDao.createApiKey({
        name: 'Test Key',
        userId: 'user-123',
        permission: 'read',
      });

      const revoked = await ApiKeyDao.revokeApiKey(created.id);
      expect(revoked).toBe(true);

      const key = await ApiKeyDao.getApiKey(created.id);
      expect(key?.status).toBe('revoked');
    });
  });

  describe('deleteApiKey', () => {
    it('should delete an API key', async () => {
      const created = await ApiKeyDao.createApiKey({
        name: 'Test Key',
        userId: 'user-123',
        permission: 'read',
      });

      const deleted = await ApiKeyDao.deleteApiKey(created.id);
      expect(deleted).toBe(true);

      const key = await ApiKeyDao.getApiKey(created.id);
      expect(key).toBeNull();
    });
  });

  describe('rate limiting', () => {
    it('should track API key usage', async () => {
      const created = await ApiKeyDao.createApiKey({
        name: 'Test Key',
        userId: 'user-123',
        permission: 'read',
        rateLimitPerMinute: 10,
      });

      // Record some usage
      await ApiKeyDao.recordApiKeyUsage(created.id, '/api/bot', true);
      await ApiKeyDao.recordApiKeyUsage(created.id, '/api/bot', true);
      await ApiKeyDao.recordApiKeyUsage(created.id, '/api/bot', false);

      const rateLimit = await ApiKeyDao.checkRateLimit(created.id);
      expect(rateLimit.allowed).toBe(true);
      expect(rateLimit.remainingMinute).toBe(7); // 10 - 3 = 7
    });

    it('should deny when rate limit is exceeded', async () => {
      const created = await ApiKeyDao.createApiKey({
        name: 'Test Key',
        userId: 'user-123',
        permission: 'read',
        rateLimitPerMinute: 2,
      });

      // Use up the limit
      await ApiKeyDao.recordApiKeyUsage(created.id, '/api/bot', true);
      await ApiKeyDao.recordApiKeyUsage(created.id, '/api/bot', true);

      const rateLimit = await ApiKeyDao.checkRateLimit(created.id);
      expect(rateLimit.allowed).toBe(false);
      expect(rateLimit.remainingMinute).toBe(0);
    });
  });

  describe('getApiKeyStats', () => {
    it('should return usage statistics', async () => {
      const created = await ApiKeyDao.createApiKey({
        name: 'Test Key',
        userId: 'user-123',
        permission: 'read',
      });

      await ApiKeyDao.recordApiKeyUsage(created.id, '/api/bot', true);
      await ApiKeyDao.recordApiKeyUsage(created.id, '/api/bot', true);
      await ApiKeyDao.recordApiKeyUsage(created.id, '/api/keys', false);

      const stats = await ApiKeyDao.getApiKeyStats(created.id);

      expect(stats).toBeDefined();
      expect(stats?.totalRequests).toBe(3);
      expect(stats?.successfulRequests).toBe(2);
      expect(stats?.failedRequests).toBe(1);
      expect(stats?.topEndpoints).toHaveLength(2);
    });
  });
});
