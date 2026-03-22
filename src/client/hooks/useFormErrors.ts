/**
 * useFormErrors - Form Error Handling Hook
 * 
 * Provides centralized form validation and error handling.
 * Displays user-friendly error messages and handles API errors.
 * 
 * @example
 * const { errors, setFieldError, clearErrors, handleAPIError } = useFormErrors();
 * 
 * // Set a field error
 * setFieldError('email', '请输入有效的邮箱地址');
 * 
 * // Handle API error response
 * const result = await apiClient.post('/api/users', formData);
 * if (!result.success) {
 *   handleAPIError(result.error);
 * }
 */

import { useState, useCallback } from 'react';
import { Message } from '@arco-design/web-react';
import { APIError, ErrorCode } from '../utils/apiClient';

/**
 * Form errors type - maps field names to error messages
 */
export type FormErrors = Record<string, string | string[] | undefined>;

/**
 * Hook options
 */
interface UseFormErrorsOptions {
  /** Show toast on general errors */
  showToastOnGeneralError?: boolean;
  /** Callback when auth error occurs */
  onAuthError?: () => void;
}

/**
 * Hook return type
 */
interface UseFormErrorsReturn {
  /** Current form errors */
  errors: FormErrors;
  /** Set error for a specific field */
  setFieldError: (field: string, error: string | string[]) => void;
  /** Clear error for a specific field */
  clearFieldError: (field: string) => void;
  /** Clear all errors */
  clearErrors: () => void;
  /** Check if a field has an error */
  hasError: (field: string) => boolean;
  /** Get error for a specific field */
  getError: (field: string) => string | string[] | undefined;
  /** Handle API error response */
  handleAPIError: (error: APIError) => void;
  /** General error message (non-field specific) */
  generalError: string | null;
  /** Set general error message */
  setGeneralError: (message: string | null) => void;
  /** Validate required fields */
  validateRequired: (fields: Record<string, any>, fieldNames: Record<string, string>) => boolean;
  /** Validate email format */
  validateEmail: (email: string, fieldName?: string) => boolean;
  /** Validate number range */
  validateRange: (value: number, min: number, max: number, fieldName?: string) => boolean;
  /** Validate positive number */
  validatePositive: (value: number, fieldName?: string) => boolean;
}

/**
 * Map API error codes to user-friendly messages
 */
const getValidationMessage = (code: ErrorCode, details?: Record<string, any>): string => {
  switch (code) {
    case ErrorCode.MISSING_REQUIRED_FIELD:
      return '此项为必填项';
    case ErrorCode.INVALID_FORMAT:
      return '格式不正确';
    case ErrorCode.INVALID_INPUT:
      return '输入无效';
    case ErrorCode.OUT_OF_RANGE:
      if (details?.min !== undefined && details?.max !== undefined) {
        return `数值必须在 ${details.min} 到 ${details.max} 之间`;
      }
      if (details?.min !== undefined) {
        return `数值不能小于 ${details.min}`;
      }
      if (details?.max !== undefined) {
        return `数值不能大于 ${details.max}`;
      }
      return '数值超出允许范围';
    default:
      return '验证失败';
  }
};

/**
 * Form errors hook
 */
export function useFormErrors(options: UseFormErrorsOptions = {}): UseFormErrorsReturn {
  const { showToastOnGeneralError = true, onAuthError } = options;
  
  const [errors, setErrors] = useState<FormErrors>({});
  const [generalError, setGeneralError] = useState<string | null>(null);

  /**
   * Set error for a specific field
   */
  const setFieldError = useCallback((field: string, error: string | string[]) => {
    setErrors(prev => ({ ...prev, [field]: error }));
  }, []);

  /**
   * Clear error for a specific field
   */
  const clearFieldError = useCallback((field: string) => {
    setErrors(prev => {
      const newErrors = { ...prev };
      delete newErrors[field];
      return newErrors;
    });
  }, []);

  /**
   * Clear all errors
   */
  const clearErrors = useCallback(() => {
    setErrors({});
    setGeneralError(null);
  }, []);

  /**
   * Check if a field has an error
   */
  const hasError = useCallback((field: string) => {
    return !!errors[field];
  }, [errors]);

  /**
   * Get error for a specific field
   */
  const getError = useCallback((field: string) => {
    return errors[field];
  }, [errors]);

  /**
   * Handle API error response
   */
  const handleAPIError = useCallback((error: APIError) => {
    // Handle auth errors specially
    if (
      error.code === ErrorCode.UNAUTHORIZED ||
      error.code === ErrorCode.INVALID_TOKEN ||
      error.code === ErrorCode.TOKEN_EXPIRED
    ) {
      if (onAuthError) {
        onAuthError();
      }
      return;
    }

    // If error has field-specific details, map to form errors
    if (error.details) {
      const { field, fields, missingFields } = error.details as any;
      
      // Single field error
      if (field) {
        setFieldError(field, getValidationMessage(error.code, error.details));
        return;
      }

      // Multiple fields error
      if (fields && Array.isArray(fields)) {
        fields.forEach((f: string) => {
          setFieldError(f, getValidationMessage(error.code));
        });
        return;
      }

      // Missing required fields
      if (missingFields && Array.isArray(missingFields)) {
        missingFields.forEach((f: string) => {
          setFieldError(f, '此项为必填项');
        });
        return;
      }
    }

    // General error - show as toast or general error
    const message = error.recoverySuggestion 
      ? `${error.message}。${error.recoverySuggestion}`
      : error.message;
    
    if (showToastOnGeneralError) {
      Message.error({
        content: message,
        duration: 5000,
      });
    } else {
      setGeneralError(message);
    }
  }, [setFieldError, showToastOnGeneralError, onAuthError]);

  /**
   * Validate required fields
   */
  const validateRequired = useCallback((
    fields: Record<string, any>,
    fieldNames: Record<string, string>
  ): boolean => {
    let isValid = true;
    
    Object.entries(fields).forEach(([key, value]) => {
      if (value === undefined || value === null || value === '') {
        setFieldError(key, `${fieldNames[key] || key}为必填项`);
        isValid = false;
      }
    });

    return isValid;
  }, [setFieldError]);

  /**
   * Validate email format
   */
  const validateEmail = useCallback((email: string, fieldName: string = 'email'): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    
    if (!email) {
      setFieldError(fieldName, '请输入邮箱地址');
      return false;
    }
    
    if (!emailRegex.test(email)) {
      setFieldError(fieldName, '请输入有效的邮箱地址');
      return false;
    }
    
    clearFieldError(fieldName);
    return true;
  }, [setFieldError, clearFieldError]);

  /**
   * Validate number range
   */
  const validateRange = useCallback((
    value: number,
    min: number,
    max: number,
    fieldName: string = 'value'
  ): boolean => {
    if (typeof value !== 'number' || isNaN(value)) {
      setFieldError(fieldName, '请输入有效的数字');
      return false;
    }
    
    if (value < min || value > max) {
      setFieldError(fieldName, `数值必须在 ${min} 到 ${max} 之间`);
      return false;
    }
    
    clearFieldError(fieldName);
    return true;
  }, [setFieldError, clearFieldError]);

  /**
   * Validate positive number
   */
  const validatePositive = useCallback((value: number, fieldName: string = 'value'): boolean => {
    if (typeof value !== 'number' || isNaN(value)) {
      setFieldError(fieldName, '请输入有效的数字');
      return false;
    }
    
    if (value <= 0) {
      setFieldError(fieldName, '数值必须大于 0');
      return false;
    }
    
    clearFieldError(fieldName);
    return true;
  }, [setFieldError, clearFieldError]);

  return {
    errors,
    setFieldError,
    clearFieldError,
    clearErrors,
    hasError,
    getError,
    handleAPIError,
    generalError,
    setGeneralError,
    validateRequired,
    validateEmail,
    validateRange,
    validatePositive,
  };
}

export default useFormErrors;