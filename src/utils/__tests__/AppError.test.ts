/**
 * Tests for AppError and Error Handling
 */

import {
  AppError,
  ValidationError,
  InvalidInputError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  BusinessError,
  InvalidOrderError,
  RateLimitError,
  ExternalServiceError,
  DatabaseError,
  ErrorCode,
  isAppError,
  toAppError,
} from '../AppError';

describe('AppError', () => {
  describe('Base AppError', () => {
    it('should create an AppError with correct properties', () => {
      const error = new AppError(
        ErrorCode.VALIDATION_ERROR,
        'Test validation error',
        { field: 'test' }
      );

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(AppError);
      expect(error.code).toBe(ErrorCode.VALIDATION_ERROR);
      expect(error.statusCode).toBe(400);
      expect(error.message).toBe('Test validation error');
      expect(error.details).toEqual({ field: 'test' });
      expect(error.userMessage).toBe('数据验证失败');
      expect(error.isOperational).toBe(true);
    });

    it('should generate correct API response', () => {
      const error = new AppError(
        ErrorCode.NOT_FOUND,
        'Resource not found',
        { id: '123' }
      );

      const response = error.toResponse(false);

      expect(response.success).toBe(false);
      expect(response.error.code).toBe(ErrorCode.NOT_FOUND);
      expect(response.error.message).toBe('请求的资源不存在');
      expect(response.error.details).toEqual({ id: '123' });
      expect(response.error.stack).toBeUndefined();
    });

    it('should include stack trace in development mode', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      const error = new AppError(ErrorCode.INTERNAL_ERROR, 'Test error');
      const response = error.toResponse(true);

      expect(response.error.stack).toBeDefined();

      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('ValidationError', () => {
    it('should create a validation error', () => {
      const error = new ValidationError('Invalid input', { field: 'email' });

      expect(error).toBeInstanceOf(AppError);
      expect(error).toBeInstanceOf(ValidationError);
      expect(error.code).toBe(ErrorCode.VALIDATION_ERROR);
      expect(error.statusCode).toBe(400);
    });
  });

  describe('InvalidInputError', () => {
    it('should create an invalid input error', () => {
      const error = new InvalidInputError('Invalid format');

      expect(error.code).toBe(ErrorCode.INVALID_INPUT);
      expect(error.statusCode).toBe(400);
    });
  });

  describe('UnauthorizedError', () => {
    it('should create an unauthorized error', () => {
      const error = new UnauthorizedError('Token expired');

      expect(error.code).toBe(ErrorCode.UNAUTHORIZED);
      expect(error.statusCode).toBe(401);
    });
  });

  describe('ForbiddenError', () => {
    it('should create a forbidden error', () => {
      const error = new ForbiddenError('Access denied');

      expect(error.code).toBe(ErrorCode.FORBIDDEN);
      expect(error.statusCode).toBe(403);
    });
  });

  describe('NotFoundError', () => {
    it('should create a not found error with string identifier', () => {
      const error = new NotFoundError('Strategy', '123');

      expect(error.code).toBe(ErrorCode.NOT_FOUND);
      expect(error.statusCode).toBe(404);
      expect(error.message).toBe('Strategy not found');
      expect(error.details).toEqual({ id: '123' });
    });

    it('should create a not found error with object identifier', () => {
      const error = new NotFoundError('Order', { symbol: 'BTCUSDT', orderId: '456' });

      expect(error.message).toBe('Order not found');
      expect(error.details).toEqual({ symbol: 'BTCUSDT', orderId: '456' });
    });
  });

  describe('ConflictError', () => {
    it('should create a conflict error', () => {
      const error = new ConflictError('Resource already exists');

      expect(error.code).toBe(ErrorCode.CONFLICT);
      expect(error.statusCode).toBe(409);
    });
  });

  describe('BusinessError', () => {
    it('should create a business error', () => {
      const error = new BusinessError('Cannot close position');

      expect(error.code).toBe(ErrorCode.BUSINESS_ERROR);
      expect(error.statusCode).toBe(422);
    });
  });

  describe('InvalidOrderError', () => {
    it('should create an invalid order error', () => {
      const error = new InvalidOrderError('Quantity must be positive', { quantity: -1 });

      expect(error.code).toBe(ErrorCode.INVALID_ORDER);
      expect(error.statusCode).toBe(422);
      expect(error.details).toEqual({ quantity: -1 });
    });
  });

  describe('RateLimitError', () => {
    it('should create a rate limit error with retry-after', () => {
      const error = new RateLimitError(60);

      expect(error.code).toBe(ErrorCode.RATE_LIMIT_EXCEEDED);
      expect(error.statusCode).toBe(429);
      expect(error.details).toEqual({ retryAfter: 60 });
    });

    it('should create a rate limit error without retry-after', () => {
      const error = new RateLimitError();

      expect(error.code).toBe(ErrorCode.RATE_LIMIT_EXCEEDED);
      expect(error.details).toBeUndefined();
    });
  });

  describe('ExternalServiceError', () => {
    it('should create an external service error', () => {
      const originalError = new Error('Connection timeout');
      const error = new ExternalServiceError('ExchangeAPI', originalError);

      expect(error.code).toBe(ErrorCode.EXTERNAL_SERVICE_ERROR);
      expect(error.statusCode).toBe(502);
      expect(error.details?.service).toBe('ExchangeAPI');
      expect(error.details?.originalMessage).toBe('Connection timeout');
    });
  });

  describe('DatabaseError', () => {
    it('should create a database error', () => {
      const originalError = new Error('Connection refused');
      const error = new DatabaseError('insert', originalError);

      expect(error.code).toBe(ErrorCode.DATABASE_ERROR);
      expect(error.statusCode).toBe(500);
      expect(error.isOperational).toBe(false);
      expect(error.details?.operation).toBe('insert');
    });
  });

  describe('isAppError', () => {
    it('should return true for AppError instances', () => {
      const error = new ValidationError('Test');
      expect(isAppError(error)).toBe(true);
    });

    it('should return false for non-AppError errors', () => {
      const error = new Error('Test');
      expect(isAppError(error)).toBe(false);
    });

    it('should return false for null/undefined', () => {
      expect(isAppError(null)).toBe(false);
      expect(isAppError(undefined)).toBe(false);
    });
  });

  describe('toAppError', () => {
    it('should return the same AppError if already an AppError', () => {
      const error = new ValidationError('Test');
      const converted = toAppError(error);

      expect(converted).toBe(error);
    });

    it('should convert Error to AppError', () => {
      const error = new Error('Test error');
      const converted = toAppError(error);

      expect(converted).toBeInstanceOf(AppError);
      expect(converted.code).toBe(ErrorCode.INTERNAL_ERROR);
      expect(converted.message).toBe('Test error');
      expect(converted.isOperational).toBe(false);
    });

    it('should convert non-Error to AppError', () => {
      const converted = toAppError('string error');

      expect(converted).toBeInstanceOf(AppError);
      expect(converted.code).toBe(ErrorCode.INTERNAL_ERROR);
      expect(converted.details?.originalError).toBe('string error');
    });
  });

  describe('Error Codes and Status Codes', () => {
    it('should have correct status codes for validation errors', () => {
      expect(new ValidationError('test').statusCode).toBe(400);
      expect(new InvalidInputError('test').statusCode).toBe(400);
    });

    it('should have correct status codes for auth errors', () => {
      expect(new UnauthorizedError().statusCode).toBe(401);
      expect(new ForbiddenError().statusCode).toBe(403);
    });

    it('should have correct status codes for not found errors', () => {
      expect(new NotFoundError('Test').statusCode).toBe(404);
    });

    it('should have correct status codes for conflict errors', () => {
      expect(new ConflictError('test').statusCode).toBe(409);
    });

    it('should have correct status codes for business errors', () => {
      expect(new BusinessError('test').statusCode).toBe(422);
      expect(new InvalidOrderError('test').statusCode).toBe(422);
    });

    it('should have correct status codes for rate limit errors', () => {
      expect(new RateLimitError().statusCode).toBe(429);
    });

    it('should have correct status codes for server errors', () => {
      expect(new ExternalServiceError('test').statusCode).toBe(502);
      expect(new DatabaseError('test').statusCode).toBe(500);
    });
  });
});