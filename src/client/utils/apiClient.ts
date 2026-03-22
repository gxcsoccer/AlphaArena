/**
 * Unified API Client for AlphaArena Frontend
 * 
 * Provides centralized error handling, retries, and user-friendly error messages.
 * This is a wrapper around the existing api.ts functions.
 * 
 * @example
 * const result = await apiClient.get('/api/strategies');
 * if (result.success) {
 *   console.log(result.data);
 * } else {
 *   // Error already displayed to user via toast
 *   console.error(result.error);
 * }
 */

import { Message } from '@arco-design/web-react';

/**
 * Error codes from backend (must match AppError.ts)
 */
export enum ErrorCode {
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  INVALID_INPUT = 'INVALID_INPUT',
  MISSING_REQUIRED_FIELD = 'MISSING_REQUIRED_FIELD',
  INVALID_FORMAT = 'INVALID_FORMAT',
  OUT_OF_RANGE = 'OUT_OF_RANGE',
  UNAUTHORIZED = 'UNAUTHORIZED',
  INVALID_TOKEN = 'INVALID_TOKEN',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',
  FORBIDDEN = 'FORBIDDEN',
  INSUFFICIENT_PERMISSIONS = 'INSUFFICIENT_PERMISSIONS',
  NOT_FOUND = 'NOT_FOUND',
  RESOURCE_NOT_FOUND = 'RESOURCE_NOT_FOUND',
  CONFLICT = 'CONFLICT',
  DUPLICATE_ENTRY = 'DUPLICATE_ENTRY',
  BUSINESS_ERROR = 'BUSINESS_ERROR',
  INSUFFICIENT_BALANCE = 'INSUFFICIENT_BALANCE',
  INVALID_ORDER = 'INVALID_ORDER',
  ORDER_NOT_FILLABLE = 'ORDER_NOT_FILLABLE',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  EXTERNAL_SERVICE_ERROR = 'EXTERNAL_SERVICE_ERROR',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  DATABASE_ERROR = 'DATABASE_ERROR',
}

/**
 * API Error interface
 */
export interface APIError {
  code: ErrorCode;
  message: string;
  details?: Record<string, any>;
  recoverySuggestion?: string;
  requestId?: string;
}

/**
 * API Response interface
 */
export interface APIResponse<T = any> {
  success: boolean;
  data?: T;
  error?: APIError;
}

/**
 * Request options
 */
export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: any;
  headers?: Record<string, string>;
  showToast?: boolean; // Show error toast automatically
  retryCount?: number;
  retryDelay?: number;
  signal?: AbortSignal;
}

/**
 * User-friendly error messages in Chinese
 */
const UserFriendlyMessages: Record<ErrorCode, string> = {
  [ErrorCode.VALIDATION_ERROR]: '提交的数据有问题，请检查后重试',
  [ErrorCode.INVALID_INPUT]: '输入的数据格式不正确',
  [ErrorCode.MISSING_REQUIRED_FIELD]: '有必填项未填写',
  [ErrorCode.INVALID_FORMAT]: '数据格式不正确',
  [ErrorCode.OUT_OF_RANGE]: '数值超出了允许范围',
  
  [ErrorCode.UNAUTHORIZED]: '请先登录',
  [ErrorCode.INVALID_TOKEN]: '登录已失效，请重新登录',
  [ErrorCode.TOKEN_EXPIRED]: '登录已过期，请重新登录',
  
  [ErrorCode.FORBIDDEN]: '您没有权限执行此操作',
  [ErrorCode.INSUFFICIENT_PERMISSIONS]: '权限不足',
  
  [ErrorCode.NOT_FOUND]: '请求的内容不存在',
  [ErrorCode.RESOURCE_NOT_FOUND]: '资源未找到',
  
  [ErrorCode.CONFLICT]: '操作冲突，请刷新后重试',
  [ErrorCode.DUPLICATE_ENTRY]: '该数据已存在',
  
  [ErrorCode.BUSINESS_ERROR]: '操作失败',
  [ErrorCode.INSUFFICIENT_BALANCE]: '余额不足，请充值后重试',
  [ErrorCode.INVALID_ORDER]: '订单参数无效',
  [ErrorCode.ORDER_NOT_FILLABLE]: '当前无法成交此订单',
  
  [ErrorCode.RATE_LIMIT_EXCEEDED]: '操作太频繁了，请稍后再试',
  
  [ErrorCode.EXTERNAL_SERVICE_ERROR]: '外部服务暂时不可用',
  [ErrorCode.SERVICE_UNAVAILABLE]: '服务暂时不可用，请稍后重试',
  
  [ErrorCode.INTERNAL_ERROR]: '服务器遇到了问题，请稍后重试',
  [ErrorCode.DATABASE_ERROR]: '数据库操作失败，请稍后重试',
};

/**
 * Get user-friendly error message
 */
export function getUserFriendlyMessage(error: APIError): string {
  // If there's a recovery suggestion, append it
  const baseMessage = UserFriendlyMessages[error.code] || error.message || '操作失败';
  
  if (error.recoverySuggestion) {
    return `${baseMessage}。${error.recoverySuggestion}`;
  }
  
  return baseMessage;
}

/**
 * Check if error is network related
 */
function isNetworkError(error: any): boolean {
  return (
    error instanceof TypeError ||
    error.message?.includes('network') ||
    error.message?.includes('Network') ||
    error.message?.includes('Failed to fetch') ||
    error.message?.includes('CORS')
  );
}

/**
 * Check if error is a timeout
 */
function isTimeoutError(error: any): boolean {
  return error.name === 'AbortError' || error.message?.includes('timeout');
}

/**
 * Sleep utility for retries
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * API configuration
 */
const config = {
  baseUrl: import.meta.env.VITE_API_URL || '/api',
  defaultTimeout: 30000, // 30 seconds
  defaultRetryCount: 2,
  defaultRetryDelay: 1000, // 1 second
};

/**
 * Make an API request with error handling
 */
export async function apiRequest<T = any>(
  path: string,
  options: RequestOptions = {}
): Promise<APIResponse<T>> {
  const {
    method = 'GET',
    body,
    headers = {},
    showToast = true,
    retryCount = config.defaultRetryCount,
    retryDelay = config.defaultRetryDelay,
    signal,
  } = options;

  let lastError: APIError | null = null;
  let attempts = 0;

  while (attempts <= retryCount) {
    attempts++;

    try {
      const url = path.startsWith('http') ? path : `${config.baseUrl}${path}`;
      
      const fetchOptions: RequestInit = {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...headers,
        },
        body: body ? JSON.stringify(body) : undefined,
        signal,
      };

      const response = await fetch(url, fetchOptions);

      // Parse response
      const data = await response.json();

      // Success response
      if (response.ok && data.success !== false) {
        return {
          success: true,
          data: data.data !== undefined ? data.data : data,
        };
      }

      // Error response from server
      const apiError: APIError = data.error || {
        code: ErrorCode.INTERNAL_ERROR,
        message: data.error || `HTTP ${response.status}`,
      };

      // Don't retry client errors (4xx)
      if (response.status >= 400 && response.status < 500) {
        if (showToast) {
          showErrorToast(apiError);
        }
        return { success: false, error: apiError };
      }

      // Server error - might retry
      lastError = apiError;

    } catch (error: any) {
      // Network or timeout error
      if (isNetworkError(error)) {
        lastError = {
          code: ErrorCode.SERVICE_UNAVAILABLE,
          message: '网络连接失败，请检查网络',
          recoverySuggestion: '请检查网络连接后重试',
        };
      } else if (isTimeoutError(error)) {
        lastError = {
          code: ErrorCode.SERVICE_UNAVAILABLE,
          message: '请求超时',
          recoverySuggestion: '请检查网络连接后重试',
        };
      } else {
        lastError = {
          code: ErrorCode.INTERNAL_ERROR,
          message: error.message || 'Unknown error',
        };
      }
    }

    // Retry logic for server errors
    if (attempts <= retryCount && lastError) {
      console.warn(`API request failed (attempt ${attempts}/${retryCount + 1}):`, lastError);
      await sleep(retryDelay * attempts); // Exponential backoff
    }
  }

  // All retries failed
  if (lastError && showToast) {
    showErrorToast(lastError);
  }

  return { success: false, error: lastError! };
}

/**
 * Show error toast to user
 */
export function showErrorToast(error: APIError): void {
  const message = getUserFriendlyMessage(error);
  
  Message.error({
    content: message,
    duration: 5000,
    closable: true,
  });
}

/**
 * Show success toast to user
 */
export function showSuccessToast(message: string): void {
  Message.success({
    content: message,
    duration: 3000,
  });
}

/**
 * Convenience methods
 */
export const apiClient = {
  get: <T = any>(path: string, options?: RequestOptions) => 
    apiRequest<T>(path, { ...options, method: 'GET' }),
  
  post: <T = any>(path: string, body?: any, options?: RequestOptions) => 
    apiRequest<T>(path, { ...options, method: 'POST', body }),
  
  put: <T = any>(path: string, body?: any, options?: RequestOptions) => 
    apiRequest<T>(path, { ...options, method: 'PUT', body }),
  
  patch: <T = any>(path: string, body?: any, options?: RequestOptions) => 
    apiRequest<T>(path, { ...options, method: 'PATCH', body }),
  
  delete: <T = any>(path: string, options?: RequestOptions) => 
    apiRequest<T>(path, { ...options, method: 'DELETE' }),
};

/**
 * Handle authentication errors
 * Redirect to login page if unauthorized
 */
export function handleAuthError(error: APIError): void {
  if (
    error.code === ErrorCode.UNAUTHORIZED ||
    error.code === ErrorCode.INVALID_TOKEN ||
    error.code === ErrorCode.TOKEN_EXPIRED
  ) {
    // Clear auth state
    localStorage.removeItem('auth_token');
    localStorage.removeItem('refresh_token');
    
    // Redirect to login
    const currentPath = window.location.pathname;
    if (currentPath !== '/login' && currentPath !== '/register') {
      window.location.href = `/login?redirect=${encodeURIComponent(currentPath)}`;
    }
  }
}

export default apiClient;