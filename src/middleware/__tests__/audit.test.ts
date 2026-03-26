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
    it('should skip excluded paths', async () => {
      mockReq.path = '/health';
      
      const { auditMiddleware } = await import('../audit.middleware');
      const middleware = auditMiddleware();

      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should initialize audit context', async () => {
      mockReq.path = '/api/users';
      
      const { auditMiddleware } = await import('../audit.middleware');
      const middleware = auditMiddleware();

      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockReq.auditContext).toBeDefined();
      expect(mockReq.auditContext?.startTime).toBeDefined();
    });

    it('should register finish event listener', async () => {
      mockReq.path = '/api/users';
      
      const { auditMiddleware } = await import('../audit.middleware');
      const middleware = auditMiddleware();

      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.on).toHaveBeenCalledWith('finish', expect.any(Function));
    });
  });
});

describe('Security Headers Middleware', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: jest.Mock;

  beforeEach(() => {
    mockReq = {
      method: 'GET',
      path: '/api/test',
      headers: {},
    };
    mockRes = {
      setHeader: jest.fn(),
      removeHeader: jest.fn(),
    };
    mockNext = jest.fn();
  });

  it('should set security headers', async () => {
    const { securityHeadersMiddleware } = await import('../security.middleware');
    const middleware = securityHeadersMiddleware();

    middleware(mockReq as Request, mockRes as Response, mockNext);

    expect(mockRes.setHeader).toHaveBeenCalledWith('X-Content-Type-Options', 'nosniff');
    expect(mockRes.setHeader).toHaveBeenCalledWith('X-Frame-Options', 'SAMEORIGIN');
    expect(mockRes.setHeader).toHaveBeenCalledWith('X-XSS-Protection', '1; mode=block');
  });

  it('should set HSTS header', async () => {
    const { securityHeadersMiddleware } = await import('../security.middleware');
    const middleware = securityHeadersMiddleware();

    middleware(mockReq as Request, mockRes as Response, mockNext);

    expect(mockRes.setHeader).toHaveBeenCalledWith(
      'Strict-Transport-Security',
      expect.stringContaining('max-age=')
    );
  });
});

describe('Rate Limit Middleware', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: jest.Mock;

  beforeEach(() => {
    mockReq = {
      method: 'GET',
      path: '/api/test',
      headers: {},
      socket: { remoteAddress: '127.0.0.1' } as any,
      user: { id: 'user-123', email: 'test@example.com' },
    };
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      setHeader: jest.fn(),
      on: jest.fn(), // Add the on method mock
    };
    mockNext = jest.fn();
  });

  it('should allow requests under limit', async () => {
    const { rateLimitMiddleware } = await import('../rateLimit.middleware');
    const middleware = rateLimitMiddleware({ max: 10, windowMs: 60000 });

    middleware(mockReq as Request, mockRes as Response, mockNext);

    expect(mockNext).toHaveBeenCalled();
    expect(mockRes.setHeader).toHaveBeenCalledWith('X-RateLimit-Limit', '10');
  });

  it('should include rate limit headers', async () => {
    const { rateLimitMiddleware } = await import('../rateLimit.middleware');
    const middleware = rateLimitMiddleware({ max: 10, windowMs: 60000 });

    middleware(mockReq as Request, mockRes as Response, mockNext);

    expect(mockRes.setHeader).toHaveBeenCalledWith('X-RateLimit-Limit', '10');
    expect(mockRes.setHeader).toHaveBeenCalledWith('X-RateLimit-Remaining', expect.any(String));
    expect(mockRes.setHeader).toHaveBeenCalledWith('X-RateLimit-Reset', expect.any(String));
  });

  it('should register finish event listener', async () => {
    const { rateLimitMiddleware } = await import('../rateLimit.middleware');
    const middleware = rateLimitMiddleware({ max: 10, windowMs: 60000 });

    middleware(mockReq as Request, mockRes as Response, mockNext);

    expect(mockRes.on).toHaveBeenCalledWith('finish', expect.any(Function));
  });
});