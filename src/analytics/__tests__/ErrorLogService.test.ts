/**
 * Error Log Service Tests
 */

import { ErrorLogService } from '../ErrorLogService';
import { ErrorCode, AppError, ValidationError, NotFoundError } from '../../utils/AppError';

// Mock the database client
jest.mock('../../database/client', () => ({
  getSupabaseAdminClient: jest.fn(() => ({
    from: jest.fn(() => ({
      insert: jest.fn(() => ({
        select: jest.fn(() => ({
          single: jest.fn(() => ({
            data: {
              id: 'test-error-id',
              timestamp: new Date().toISOString(),
              error_code: 'VALIDATION_ERROR',
              error_name: 'ValidationError',
              message: 'Test error',
              status_code: 400,
            },
          })),
        })),
      })),
      select: jest.fn(() => ({
        gte: jest.fn(() => ({
          lte: jest.fn(() => ({
            order: jest.fn(() => ({
              data: [],
              error: null,
            })),
          })),
        })),
        single: jest.fn(),
        eq: jest.fn(() => ({
          single: jest.fn(),
        })),
      })),
    })),
    rpc: jest.fn(),
  })),
}));

// Mock user tracking service
jest.mock('../UserTrackingService', () => ({
  userTrackingService: {
    trackEvent: jest.fn(),
  },
}));

describe('ErrorLogService', () => {
  let service: ErrorLogService;

  beforeEach(() => {
    service = new ErrorLogService();
    jest.clearAllMocks();
  });

  describe('logError', () => {
    it('should log an error entry', async () => {
      const errorEntry = {
        timestamp: new Date(),
        errorCode: ErrorCode.VALIDATION_ERROR,
        errorName: 'ValidationError',
        message: 'Invalid input',
        statusCode: 400,
        path: '/api/test',
        method: 'POST',
      };

      const result = await service.logError(errorEntry);

      expect(result).toBeDefined();
      expect(result.errorCode).toBe(ErrorCode.VALIDATION_ERROR);
      expect(result.message).toBe('Invalid input');
    });
  });

  describe('logAppError', () => {
    it('should log an AppError with context', async () => {
      const appError = new ValidationError('Invalid field', { field: 'email' });
      const context = {
        userId: 'user-123',
        sessionId: 'session-456',
        requestId: 'req-789',
        path: '/api/users',
        method: 'POST',
        userAgent: 'Mozilla/5.0',
        ip: '127.0.0.1',
      };

      const result = await service.logAppError(appError, context);

      expect(result).toBeDefined();
      expect(result.errorCode).toBe(ErrorCode.VALIDATION_ERROR);
      expect(result.userId).toBe('user-123');
      expect(result.path).toBe('/api/users');
    });
  });

  describe('parseUserAgent', () => {
    it('should parse Chrome on Windows', () => {
      const ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36';
      
      // Access private method via any cast
      const result = (service as any).parseUserAgent(ua);

      expect(result.browser).toBe('Chrome');
      expect(result.os).toBe('Windows');
      expect(result.device).toBe('Desktop');
    });

    it('should parse Safari on iOS', () => {
      const ua = 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1';
      
      const result = (service as any).parseUserAgent(ua);

      expect(result.browser).toBe('Safari');
      expect(result.os).toBe('iOS');
      expect(result.device).toBe('Mobile');
    });

    it('should parse Firefox on macOS', () => {
      const ua = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:89.0) Gecko/20100101 Firefox/89.0';
      
      const result = (service as any).parseUserAgent(ua);

      expect(result.browser).toBe('Firefox');
      expect(result.os).toBe('macOS');
      expect(result.device).toBe('Desktop');
    });
  });
});