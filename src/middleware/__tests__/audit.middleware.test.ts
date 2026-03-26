/**
 * Tests for Audit Middleware
 * Issue #641: Security Audit - API Permissions, Data Access Logging
 */

import { Request, Response } from 'express';
import { auditMiddleware } from '../audit.middleware';

// Mock timers
jest.useFakeTimers();

describe('Audit Middleware', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: jest.Mock;
  let finishCallbacks: Map<string, () => void>;

  beforeEach(() => {
    jest.clearAllMocks();
    
    finishCallbacks = new Map();
    
    mockReq = {
      method: 'GET',
      path: '/api/test',
      headers: {},
      query: {},
      body: {},
      params: {},
      user: {
        id: 'user-123',
        email: 'test@example.com',
        role: 'user',
      },
      socket: {
        remoteAddress: '127.0.0.1',
      } as any,
    };
    
    mockRes = {
      statusCode: 200,
      setHeader: jest.fn(),
      end: jest.fn(),
      on: jest.fn((event: string, callback: () => void) => {
        if (event === 'finish') {
          finishCallbacks.set('finish', callback);
        }
      }),
      headersSent: false,
    } as Partial<Response>;
    
    mockNext = jest.fn();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('auditMiddleware', () => {
    it('should skip excluded paths', async () => {
      mockReq.path = '/health';
      
      const middleware = auditMiddleware();
      await middleware(mockReq as Request, mockRes as Response, mockNext);
      
      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.on).not.toHaveBeenCalled();
    });

    it('should call next for non-excluded paths', async () => {
      const middleware = auditMiddleware();
      await middleware(mockReq as Request, mockRes as Response, mockNext);
      
      expect(mockNext).toHaveBeenCalled();
    });

    it('should register finish event listener', async () => {
      const middleware = auditMiddleware();
      await middleware(mockReq as Request, mockRes as Response, mockNext);
      
      expect(mockRes.on).toHaveBeenCalledWith('finish', expect.any(Function));
    });

    it('should initialize audit context', async () => {
      const middleware = auditMiddleware();
      await middleware(mockReq as Request, mockRes as Response, mockNext);
      
      expect(mockReq.auditContext).toBeDefined();
      expect(mockReq.auditContext?.startTime).toBeDefined();
    });
  });
});