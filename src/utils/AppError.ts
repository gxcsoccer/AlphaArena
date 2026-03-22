/**
 * AppError - Unified Error Types for AlphaArena
 * 
 * Provides a consistent error handling approach across the application.
 * All errors should be instances of AppError or its subclasses.
 * 
 * @example
 * throw new ValidationError('Order quantity must be positive', { field: 'quantity' });
 * throw new NotFoundError('Strategy not found', { strategyId: '123' });
 */

/**
 * Error codes for categorizing errors
 */
export enum ErrorCode {
  // Validation errors (400)
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  INVALID_INPUT = 'INVALID_INPUT',
  MISSING_REQUIRED_FIELD = 'MISSING_REQUIRED_FIELD',
  INVALID_FORMAT = 'INVALID_FORMAT',
  OUT_OF_RANGE = 'OUT_OF_RANGE',
  
  // Authentication errors (401)
  UNAUTHORIZED = 'UNAUTHORIZED',
  INVALID_TOKEN = 'INVALID_TOKEN',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',
  
  // Authorization errors (403)
  FORBIDDEN = 'FORBIDDEN',
  INSUFFICIENT_PERMISSIONS = 'INSUFFICIENT_PERMISSIONS',
  
  // Not found errors (404)
  NOT_FOUND = 'NOT_FOUND',
  RESOURCE_NOT_FOUND = 'RESOURCE_NOT_FOUND',
  
  // Conflict errors (409)
  CONFLICT = 'CONFLICT',
  DUPLICATE_ENTRY = 'DUPLICATE_ENTRY',
  
  // Business logic errors (422)
  BUSINESS_ERROR = 'BUSINESS_ERROR',
  INSUFFICIENT_BALANCE = 'INSUFFICIENT_BALANCE',
  INVALID_ORDER = 'INVALID_ORDER',
  ORDER_NOT_FILLABLE = 'ORDER_NOT_FILLABLE',
  
  // Rate limiting (429)
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  
  // External service errors (502/503)
  EXTERNAL_SERVICE_ERROR = 'EXTERNAL_SERVICE_ERROR',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
  
  // Internal errors (500)
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  DATABASE_ERROR = 'DATABASE_ERROR',
}

/**
 * HTTP status code mapping
 */
const ErrorCodeToStatus: Record<ErrorCode, number> = {
  [ErrorCode.VALIDATION_ERROR]: 400,
  [ErrorCode.INVALID_INPUT]: 400,
  [ErrorCode.MISSING_REQUIRED_FIELD]: 400,
  [ErrorCode.INVALID_FORMAT]: 400,
  [ErrorCode.OUT_OF_RANGE]: 400,
  
  [ErrorCode.UNAUTHORIZED]: 401,
  [ErrorCode.INVALID_TOKEN]: 401,
  [ErrorCode.TOKEN_EXPIRED]: 401,
  
  [ErrorCode.FORBIDDEN]: 403,
  [ErrorCode.INSUFFICIENT_PERMISSIONS]: 403,
  
  [ErrorCode.NOT_FOUND]: 404,
  [ErrorCode.RESOURCE_NOT_FOUND]: 404,
  
  [ErrorCode.CONFLICT]: 409,
  [ErrorCode.DUPLICATE_ENTRY]: 409,
  
  [ErrorCode.BUSINESS_ERROR]: 422,
  [ErrorCode.INSUFFICIENT_BALANCE]: 422,
  [ErrorCode.INVALID_ORDER]: 422,
  [ErrorCode.ORDER_NOT_FILLABLE]: 422,
  
  [ErrorCode.RATE_LIMIT_EXCEEDED]: 429,
  
  [ErrorCode.EXTERNAL_SERVICE_ERROR]: 502,
  [ErrorCode.SERVICE_UNAVAILABLE]: 503,
  
  [ErrorCode.INTERNAL_ERROR]: 500,
  [ErrorCode.DATABASE_ERROR]: 500,
};

/**
 * User-friendly error messages (in Chinese)
 */
const ErrorMessages: Record<ErrorCode, string> = {
  [ErrorCode.VALIDATION_ERROR]: '数据验证失败',
  [ErrorCode.INVALID_INPUT]: '输入数据无效',
  [ErrorCode.MISSING_REQUIRED_FIELD]: '缺少必填字段',
  [ErrorCode.INVALID_FORMAT]: '数据格式不正确',
  [ErrorCode.OUT_OF_RANGE]: '数值超出允许范围',
  
  [ErrorCode.UNAUTHORIZED]: '请先登录',
  [ErrorCode.INVALID_TOKEN]: '登录已失效，请重新登录',
  [ErrorCode.TOKEN_EXPIRED]: '登录已过期，请重新登录',
  
  [ErrorCode.FORBIDDEN]: '没有权限执行此操作',
  [ErrorCode.INSUFFICIENT_PERMISSIONS]: '权限不足',
  
  [ErrorCode.NOT_FOUND]: '请求的资源不存在',
  [ErrorCode.RESOURCE_NOT_FOUND]: '资源未找到',
  
  [ErrorCode.CONFLICT]: '操作冲突',
  [ErrorCode.DUPLICATE_ENTRY]: '数据已存在',
  
  [ErrorCode.BUSINESS_ERROR]: '业务操作失败',
  [ErrorCode.INSUFFICIENT_BALANCE]: '余额不足',
  [ErrorCode.INVALID_ORDER]: '订单无效',
  [ErrorCode.ORDER_NOT_FILLABLE]: '订单无法成交',
  
  [ErrorCode.RATE_LIMIT_EXCEEDED]: '请求过于频繁，请稍后再试',
  
  [ErrorCode.EXTERNAL_SERVICE_ERROR]: '外部服务异常',
  [ErrorCode.SERVICE_UNAVAILABLE]: '服务暂时不可用',
  
  [ErrorCode.INTERNAL_ERROR]: '服务器内部错误',
  [ErrorCode.DATABASE_ERROR]: '数据库操作失败',
};

/**
 * Error details interface
 */
export interface ErrorDetails {
  [key: string]: any;
}

/**
 * Standardized error response format
 */
export interface ErrorResponse {
  success: false;
  error: {
    code: ErrorCode;
    message: string;
    details?: ErrorDetails;
    stack?: string; // Only in development
    requestId?: string;
  };
}

/**
 * Base AppError class
 */
export class AppError extends Error {
  public readonly code: ErrorCode;
  public readonly statusCode: number;
  public readonly details?: ErrorDetails;
  public readonly isOperational: boolean;
  public readonly userMessage: string;

  constructor(
    code: ErrorCode,
    message: string,
    details?: ErrorDetails,
    isOperational: boolean = true
  ) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.statusCode = ErrorCodeToStatus[code];
    this.details = details;
    this.isOperational = isOperational;
    this.userMessage = ErrorMessages[code];

    // Ensure proper prototype chain for instanceof checks
    Object.setPrototypeOf(this, AppError.prototype);
  }

  /**
   * Convert to API response format
   */
  toResponse(includeStack: boolean = false): ErrorResponse {
    const response: ErrorResponse = {
      success: false,
      error: {
        code: this.code,
        message: this.userMessage,
        details: this.details,
      },
    };

    if (includeStack && this.stack) {
      response.error.stack = this.stack;
    }

    return response;
  }

  /**
   * Convert to JSON
   */
  toJSON(): ErrorResponse {
    return this.toResponse(process.env.NODE_ENV === 'development');
  }
}

/**
 * Validation Error - for input validation failures
 */
export class ValidationError extends AppError {
  constructor(message: string, details?: ErrorDetails) {
    super(ErrorCode.VALIDATION_ERROR, message, details);
    this.name = 'ValidationError';
    Object.setPrototypeOf(this, ValidationError.prototype);
  }
}

/**
 * Invalid Input Error - for invalid input data
 */
export class InvalidInputError extends AppError {
  constructor(message: string, details?: ErrorDetails) {
    super(ErrorCode.INVALID_INPUT, message, details);
    this.name = 'InvalidInputError';
    Object.setPrototypeOf(this, InvalidInputError.prototype);
  }
}

/**
 * Missing Required Field Error
 */
export class MissingRequiredFieldError extends AppError {
  constructor(fieldName: string) {
    super(ErrorCode.MISSING_REQUIRED_FIELD, `Missing required field: ${fieldName}`, { field: fieldName });
    this.name = 'MissingRequiredFieldError';
    Object.setPrototypeOf(this, MissingRequiredFieldError.prototype);
  }
}

/**
 * Unauthorized Error - for authentication failures
 */
export class UnauthorizedError extends AppError {
  constructor(message: string = 'Unauthorized', details?: ErrorDetails) {
    super(ErrorCode.UNAUTHORIZED, message, details);
    this.name = 'UnauthorizedError';
    Object.setPrototypeOf(this, UnauthorizedError.prototype);
  }
}

/**
 * Forbidden Error - for authorization failures
 */
export class ForbiddenError extends AppError {
  constructor(message: string = 'Forbidden', details?: ErrorDetails) {
    super(ErrorCode.FORBIDDEN, message, details);
    this.name = 'ForbiddenError';
    Object.setPrototypeOf(this, ForbiddenError.prototype);
  }
}

/**
 * Not Found Error - for missing resources
 */
export class NotFoundError extends AppError {
  constructor(resource: string, identifier?: string | Record<string, any>) {
    const details = typeof identifier === 'string' 
      ? { id: identifier } 
      : identifier;
    super(ErrorCode.NOT_FOUND, `${resource} not found`, details);
    this.name = 'NotFoundError';
    Object.setPrototypeOf(this, NotFoundError.prototype);
  }
}

/**
 * Conflict Error - for resource conflicts
 */
export class ConflictError extends AppError {
  constructor(message: string, details?: ErrorDetails) {
    super(ErrorCode.CONFLICT, message, details);
    this.name = 'ConflictError';
    Object.setPrototypeOf(this, ConflictError.prototype);
  }
}

/**
 * Business Error - for business logic failures
 */
export class BusinessError extends AppError {
  constructor(message: string, details?: ErrorDetails) {
    super(ErrorCode.BUSINESS_ERROR, message, details);
    this.name = 'BusinessError';
    Object.setPrototypeOf(this, BusinessError.prototype);
  }
}

/**
 * Insufficient Balance Error
 */
export class InsufficientBalanceError extends AppError {
  constructor(required: number, available: number, currency: string = 'USD') {
    super(
      ErrorCode.INSUFFICIENT_BALANCE,
      `Insufficient ${currency} balance`,
      { required, available, currency }
    );
    this.name = 'InsufficientBalanceError';
    Object.setPrototypeOf(this, InsufficientBalanceError.prototype);
  }
}

/**
 * Invalid Order Error - for invalid order parameters
 */
export class InvalidOrderError extends AppError {
  constructor(message: string, details?: ErrorDetails) {
    super(ErrorCode.INVALID_ORDER, message, details);
    this.name = 'InvalidOrderError';
    Object.setPrototypeOf(this, InvalidOrderError.prototype);
  }
}

/**
 * Rate Limit Error
 */
export class RateLimitError extends AppError {
  constructor(retryAfter?: number) {
    super(
      ErrorCode.RATE_LIMIT_EXCEEDED,
      'Rate limit exceeded',
      retryAfter ? { retryAfter } : undefined
    );
    this.name = 'RateLimitError';
    Object.setPrototypeOf(this, RateLimitError.prototype);
  }
}

/**
 * External Service Error
 */
export class ExternalServiceError extends AppError {
  constructor(service: string, originalError?: Error) {
    super(
      ErrorCode.EXTERNAL_SERVICE_ERROR,
      `External service error: ${service}`,
      { 
        service,
        originalMessage: originalError?.message 
      }
    );
    this.name = 'ExternalServiceError';
    Object.setPrototypeOf(this, ExternalServiceError.prototype);
  }
}

/**
 * Database Error
 */
export class DatabaseError extends AppError {
  constructor(operation: string, originalError?: Error) {
    super(
      ErrorCode.DATABASE_ERROR,
      `Database operation failed: ${operation}`,
      { 
        operation,
        originalMessage: originalError?.message 
      },
      false // Database errors are not operational
    );
    this.name = 'DatabaseError';
    Object.setPrototypeOf(this, DatabaseError.prototype);
  }
}

/**
 * Check if an error is an AppError
 */
export function isAppError(error: any): error is AppError {
  return error instanceof AppError;
}

/**
 * Convert any error to AppError
 */
export function toAppError(error: unknown): AppError {
  if (isAppError(error)) {
    return error;
  }

  if (error instanceof Error) {
    return new AppError(
      ErrorCode.INTERNAL_ERROR,
      error.message,
      { originalName: error.name },
      false
    );
  }

  return new AppError(
    ErrorCode.INTERNAL_ERROR,
    'Unknown error occurred',
    { originalError: String(error) },
    false
  );
}

export default AppError;