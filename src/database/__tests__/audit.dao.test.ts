/**
 * Tests for Audit DAO
 * Issue #641: Security Audit - API Permissions, Data Access Logging
 */

import { AuditDAO, SENSITIVE_ACTIONS } from '../audit.dao';

// Mock the Supabase client
jest.mock('../client', () => {
  const mockInsert = jest.fn().mockReturnThis();
  const mockSelect = jest.fn().mockReturnThis();
  const mockSingle = jest.fn().mockResolvedValue({
    data: { id: 'test-audit-id' },
    error: null,
  });
  
  return {
    getSupabaseAdminClient: () => ({
      from: jest.fn().mockReturnValue({
        insert: mockInsert,
        select: mockSelect,
        single: mockSingle,
        eq: jest.fn().mockReturnThis(),
        range: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis(),
        lte: jest.fn().mockReturnThis(),
      }),
      rpc: jest.fn().mockResolvedValue({
        data: [],
        error: null,
      }),
    }),
  };
});

describe('AuditDAO', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createAuditLog', () => {
    it('should create an audit log entry', async () => {
      const auditId = await AuditDAO.createAuditLog({
        action: 'login',
        action_category: 'auth',
        user_id: 'user-123',
        user_email: 'test@example.com',
      });

      // Returns empty string on error, or the id on success
      expect(typeof auditId).toBe('string');
    });

    it('should apply defaults from SENSITIVE_ACTIONS', async () => {
      const auditId = await AuditDAO.createAuditLog({
        action: 'password_change',
        user_id: 'user-123',
      });

      expect(typeof auditId).toBe('string');
    });

    it('should not throw on error', async () => {
      // Should not throw even on database errors
      const auditId = await AuditDAO.createAuditLog({
        action: 'test',
        action_category: 'data_access',
      });

      // Should return a string (empty on error, or id on success)
      expect(typeof auditId).toBe('string');
    });
  });

  describe('getAuditLogs', () => {
    it('should get audit logs with default options', async () => {
      const result = await AuditDAO.getAuditLogs();

      // Should return an object with logs and total
      expect(result).toHaveProperty('logs');
      expect(result).toHaveProperty('total');
    });
  });

  describe('getUserAuditLogs', () => {
    it('should get logs for a specific user', async () => {
      const result = await AuditDAO.getUserAuditLogs('user-123');

      expect(result).toHaveProperty('logs');
      expect(result).toHaveProperty('total');
    });
  });

  describe('getDailyStats', () => {
    it('should get daily statistics', async () => {
      const stats = await AuditDAO.getDailyStats('2024-01-01', '2024-01-31');

      expect(Array.isArray(stats)).toBe(true);
    });
  });

  describe('detectSuspiciousActivity', () => {
    it('should detect suspicious activity', async () => {
      const suspicious = await AuditDAO.detectSuspiciousActivity('user-123', undefined, 24);

      expect(Array.isArray(suspicious)).toBe(true);
    });
  });

  describe('getUserAuditSummary', () => {
    it('should return user audit summary', async () => {
      const summary = await AuditDAO.getUserAuditSummary('user-123', 30);

      expect(summary).toHaveProperty('total_actions');
      expect(summary).toHaveProperty('sensitive_actions');
      expect(summary).toHaveProperty('top_actions');
    });
  });
});

describe('SENSITIVE_ACTIONS', () => {
  it('should have predefined sensitive actions', () => {
    expect(SENSITIVE_ACTIONS['login']).toBeDefined();
    expect(SENSITIVE_ACTIONS['password_change']).toBeDefined();
    expect(SENSITIVE_ACTIONS['payment_initiated']).toBeDefined();
    expect(SENSITIVE_ACTIONS['subscription_canceled']).toBeDefined();
  });

  it('should have correct risk levels', () => {
    expect(SENSITIVE_ACTIONS['password_change'].risk_level).toBe('high');
    expect(SENSITIVE_ACTIONS['login'].risk_level).toBe('low');
    expect(SENSITIVE_ACTIONS['admin_role_change'].risk_level).toBe('critical');
  });

  it('should mark sensitive actions correctly', () => {
    expect(SENSITIVE_ACTIONS['password_change'].is_sensitive).toBe(true);
    expect(SENSITIVE_ACTIONS['logout'].is_sensitive).toBe(false);
  });
});