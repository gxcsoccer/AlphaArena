/**
 * Tests for Audit Middleware and DAO
 * Issue #641: Security Audit - API Permissions, Data Access Logging
 */

import { Request, Response } from 'express';
import { AuditDAO, SENSITIVE_ACTIONS } from '../../database/audit.dao';

// Mock the database
jest.mock('../../database/client', () => ({
  getSupabaseAdminClient: () => ({
    from: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    gte: jest.fn().mockReturnThis(),
    lte: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    range: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue({ data: { id: 'test-id' }, error: null }),
    rpc: jest.fn().mockResolvedValue({ data: [], error: null }),
  }),
}));

describe('AuditDAO', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('SENSITIVE_ACTIONS', () => {
    it('should have predefined sensitive actions', () => {
      expect(SENSITIVE_ACTIONS['login']).toBeDefined();
      expect(SENSITIVE_ACTIONS['login'].category).toBe('auth');
      expect(SENSITIVE_ACTIONS['password_change']).toBeDefined();
      expect(SENSITIVE_ACTIONS['password_change'].risk_level).toBe('high');
    });

    it('should mark password changes as high risk', () => {
      expect(SENSITIVE_ACTIONS['password_change'].risk_level).toBe('high');
      expect(SENSITIVE_ACTIONS['password_change'].is_sensitive).toBe(true);
    });

    it('should mark payment actions as sensitive', () => {
      expect(SENSITIVE_ACTIONS['payment_initiated'].category).toBe('payment');
      expect(SENSITIVE_ACTIONS['payment_completed'].is_sensitive).toBe(true);
    });

    it('should mark admin actions as high risk', () => {
      expect(SENSITIVE_ACTIONS['admin_role_change'].risk_level).toBe('critical');
      expect(SENSITIVE_ACTIONS['admin_user_update'].risk_level).toBe('high');
    });
  });

  describe('createAuditLog', () => {
    it('should create an audit log entry', async () => {
      const input = {
        action: 'test_action',
        action_category: 'data_access' as const,
        user_id: 'user-123',
      };

      const result = await AuditDAO.createAuditLog(input);
      expect(result).toBe('test-id');
    });
  });
});

describe('Audit Middleware', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockReq = {
      method: 'GET',
      path: '/api/test',
      headers: {},
      query: {},
      body: {},
      socket: { remoteAddress: '127.0.0.1' } as any,
    };
    mockRes = {
      statusCode: 200,
      setHeader: jest.fn(),
      getHeader: jest.fn(),
      end: jest.fn().mockReturnThis(),
      on: jest.fn(), // Add the on method mock
    };
    mockNext = jest.fn();
  });

  describe('auditMiddleware', () => {
    // Note: The actual middleware is tested in audit.middleware.test.ts
    // This is just a placeholder for additional integration tests
    
    it('should have skipAudit property on request', () => {
      mockReq.skipAudit = true;
      expect(mockReq.skipAudit).toBe(true);
    });
  });
});