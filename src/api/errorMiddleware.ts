/**
 * Error Handling Middleware
 * 
 * Provides centralized error handling for Express routes.
 * Converts all errors to standardized API responses.
 * 
 * @example
 * // In your route handler:
 * app.get('/api/users/:id', async (req, res, next) => {
 *   try {
 *     const user = await getUser(req.params.id);
 *     if (!user) throw new NotFoundError('User', req.params.id);
 *     res.json({ success: true, data: user });
 *   } catch (error) {
 *     next(error); // Will be handled by errorMiddleware
 *   }
 * });
 */

import { Request, Response, NextFunction } from 'express';
import { AppError, isAppError, toAppError, ErrorCode } from '../utils/AppError';
import { createLogger } from '../utils/logger';

const log = createLogger('ErrorMiddleware');

/**
 * Extended Request interface with request ID
 */
declare global {
  namespace Express {
    interface Request {
      requestId?: string;
    }
  }
}

/**
 * Generate a unique request ID
 */
function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Request ID middleware
 * Adds a unique request ID to each request for tracing
 */
export function requestIdMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  req.requestId = req.headers['x-request-id'] as string || generateRequestId();
  res.setHeader('X-Request-Id', req.requestId);
  next();
}

/**
 * 404 Not Found middleware
 * Catches requests to undefined routes
 */
export function notFoundMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const error = new AppError(
    ErrorCode.NOT_FOUND,
    `Route ${req.method} ${req.path} not found`,
    { method: req.method, path: req.path }
  );
  next(error);
}

/**
 * Async handler wrapper
 * Catches errors in async route handlers and passes them to Express error middleware
 * 
 * @example
 * router.get('/users/:id', asyncHandler(async (req, res) => {
 *   const user = await getUser(req.params.id);
 *   res.json({ success: true, data: user });
 * }));
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * Main error handling middleware
 * Must be registered after all routes
 */
export function errorMiddleware(
  error: Error | AppError,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  // Convert to AppError if needed
  const appError = isAppError(error) ? error : toAppError(error);
  
  // Get request ID for tracing
  const requestId = req.requestId || generateRequestId();

  // Log the error
  const logData = {
    requestId,
    method: req.method,
    path: req.path,
    query: req.query,
    body: req.body ? '[body present]' : undefined,
    errorCode: appError.code,
    statusCode: appError.statusCode,
    message: appError.message,
    details: appError.details,
    stack: appError.stack,
    user: (req as any).user?.id,
    ip: req.ip,
  };

  if (appError.statusCode >= 500) {
    // Server errors - log as error
    log.error('Server error:', logData);
  } else if (appError.statusCode >= 400) {
    // Client errors - log as warning
    log.warn('Client error:', logData);
  } else {
    log.info('Request error:', logData);
  }

  // Prepare response
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  const errorResponse = appError.toResponse(isDevelopment);
  errorResponse.error.requestId = requestId;

  // Add recovery suggestions for common errors
  const recoverySuggestion = getRecoverySuggestion(appError);
  if (recoverySuggestion) {
    errorResponse.error.details = {
      ...errorResponse.error.details,
      recoverySuggestion,
    };
  }

  // Send response
  res.status(appError.statusCode).json(errorResponse);
}

/**
 * Get recovery suggestion for an error
 */
function getRecoverySuggestion(error: AppError): string | null {
  switch (error.code) {
    case ErrorCode.UNAUTHORIZED:
    case ErrorCode.INVALID_TOKEN:
    case ErrorCode.TOKEN_EXPIRED:
      return '请刷新页面重新登录';
      
    case ErrorCode.FORBIDDEN:
    case ErrorCode.INSUFFICIENT_PERMISSIONS:
      return '如需此权限，请联系管理员';
      
    case ErrorCode.NOT_FOUND:
    case ErrorCode.RESOURCE_NOT_FOUND:
      return '请检查请求的资源ID是否正确';
      
    case ErrorCode.RATE_LIMIT_EXCEEDED:
      return '请等待几分钟后重试';
      
    case ErrorCode.INSUFFICIENT_BALANCE:
      return '请充值后重试';
      
    case ErrorCode.SERVICE_UNAVAILABLE:
      return '服务正在维护中，请稍后重试';
      
    case ErrorCode.EXTERNAL_SERVICE_ERROR:
      return '外部服务暂时不可用，请稍后重试';
      
    case ErrorCode.DATABASE_ERROR:
    case ErrorCode.INTERNAL_ERROR:
      return '系统遇到了问题，我们已收到通知并正在处理';
      
    default:
      return null;
  }
}

/**
 * Validation helper functions
 * These can be used in route handlers for input validation
 */
export const validators = {
  /**
   * Validate required fields
   */
  requireFields: (fields: string[]) => {
    return (req: Request, res: Response, next: NextFunction): void => {
      const missing = fields.filter(field => {
        const value = req.body[field];
        return value === undefined || value === null || value === '';
      });

      if (missing.length > 0) {
        const error = new AppError(
          ErrorCode.MISSING_REQUIRED_FIELD,
          `Missing required fields: ${missing.join(', ')}`,
          { missingFields: missing }
        );
        next(error);
        return;
      }

      next();
    };
  },

  /**
   * Validate numeric fields
   */
  requirePositive: (fieldName: string, value: number, context?: string): void => {
    if (typeof value !== 'number' || isNaN(value)) {
      throw new AppError(
        ErrorCode.INVALID_INPUT,
        `${context ? context + ': ' : ''}${fieldName} must be a number`,
        { field: fieldName, value }
      );
    }
    if (value <= 0) {
      throw new AppError(
        ErrorCode.OUT_OF_RANGE,
        `${context ? context + ': ' : ''}${fieldName} must be positive`,
        { field: fieldName, value, min: 0 }
      );
    }
  },

  /**
   * Validate numeric range
   */
  requireRange: (
    fieldName: string,
    value: number,
    min: number,
    max: number,
    context?: string
  ): void => {
    if (typeof value !== 'number' || isNaN(value)) {
      throw new AppError(
        ErrorCode.INVALID_INPUT,
        `${context ? context + ': ' : ''}${fieldName} must be a number`,
        { field: fieldName, value }
      );
    }
    if (value < min || value > max) {
      throw new AppError(
        ErrorCode.OUT_OF_RANGE,
        `${context ? context + ': ' : ''}${fieldName} must be between ${min} and ${max}`,
        { field: fieldName, value, min, max }
      );
    }
  },

  /**
   * Validate enum value
   */
  requireEnum: <T extends string>(
    fieldName: string,
    value: string,
    allowed: T[],
    context?: string
  ): T => {
    if (!allowed.includes(value as T)) {
      throw new AppError(
        ErrorCode.INVALID_INPUT,
        `${context ? context + ': ' : ''}${fieldName} must be one of: ${allowed.join(', ')}`,
        { field: fieldName, value, allowed }
      );
    }
    return value as T;
  },

  /**
   * Validate string length
   */
  requireLength: (
    fieldName: string,
    value: string,
    minLength: number,
    maxLength: number,
    context?: string
  ): void => {
    if (typeof value !== 'string') {
      throw new AppError(
        ErrorCode.INVALID_INPUT,
        `${context ? context + ': ' : ''}${fieldName} must be a string`,
        { field: fieldName, value }
      );
    }
    if (value.length < minLength || value.length > maxLength) {
      throw new AppError(
        ErrorCode.OUT_OF_RANGE,
        `${context ? context + ': ' : ''}${fieldName} length must be between ${minLength} and ${maxLength}`,
        { field: fieldName, length: value.length, minLength, maxLength }
      );
    }
  },

  /**
   * Validate email format
   */
  requireEmail: (fieldName: string, value: string, context?: string): void => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(value)) {
      throw new AppError(
        ErrorCode.INVALID_FORMAT,
        `${context ? context + ': ' : ''}${fieldName} must be a valid email`,
        { field: fieldName, value }
      );
    }
  },

  /**
   * Validate order parameters
   */
  validateOrderParams: (params: {
    symbol?: string;
    side?: string;
    type?: string;
    price?: number;
    quantity?: number;
  }): void => {
    const { symbol, side, type, price, quantity } = params;

    // Symbol is required
    if (!symbol) {
      throw new AppError(
        ErrorCode.MISSING_REQUIRED_FIELD,
        'Order symbol is required',
        { field: 'symbol' }
      );
    }

    // Side must be buy or sell
    if (side && !['buy', 'sell'].includes(side)) {
      throw new AppError(
        ErrorCode.INVALID_INPUT,
        'Order side must be "buy" or "sell"',
        { field: 'side', value: side }
      );
    }

    // Type must be limit or market
    if (type && !['limit', 'market'].includes(type)) {
      throw new AppError(
        ErrorCode.INVALID_INPUT,
        'Order type must be "limit" or "market"',
        { field: 'type', value: type }
      );
    }

    // Quantity must be positive
    if (quantity !== undefined) {
      validators.requirePositive('quantity', quantity, 'Order');
    }

    // Price must be positive for limit orders
    if (type === 'limit' && price !== undefined) {
      validators.requirePositive('price', price, 'Limit order');
    }

    // Limit orders require a price
    if (type === 'limit' && !price) {
      throw new AppError(
        ErrorCode.MISSING_REQUIRED_FIELD,
        'Limit orders require a price',
        { field: 'price' }
      );
    }
  },
};

export default errorMiddleware;