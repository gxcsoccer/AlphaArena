/**
 * Input Validation Utilities
 * Provides validation functions for API inputs
 */

/**
 * UUID validation regex
 */
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Validate UUID format
 */
export function isValidUUID(value: string): boolean {
  return typeof value === 'string' && UUID_REGEX.test(value);
}

/**
 * Validate UUID and throw error if invalid
 */
export function validateUUID(value: string, fieldName: string = 'id'): void {
  if (!isValidUUID(value)) {
    throw new Error(`Invalid ${fieldName}: must be a valid UUID`);
  }
}

/**
 * Sanitize string input to prevent XSS
 * Removes potentially dangerous HTML/script tags
 */
export function sanitizeString(value: string): string {
  if (typeof value !== 'string') return '';
  
  return value
    // Remove script tags
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    // Remove event handlers
    .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '')
    // Remove javascript: URLs
    .replace(/javascript:/gi, '')
    // Remove data: URLs
    .replace(/data:/gi, '')
    // Trim whitespace
    .trim();
}

/**
 * Sanitize HTML content - allows safe tags only
 */
export function sanitizeHTML(value: string): string {
  if (typeof value !== 'string') return '';
  
  // List of allowed tags
  const allowedTags = ['b', 'i', 'u', 'strong', 'em', 'p', 'br', 'span'];
  
  // Remove all tags except allowed ones
  const tagPattern = /<\/?([a-z][a-z0-9]*)\b[^>]*>/gi;
  
  return value.replace(tagPattern, (match, tagName) => {
    if (allowedTags.includes(tagName.toLowerCase())) {
      return match;
    }
    return '';
  }).trim();
}

/**
 * Validate and sanitize comment content
 */
export function sanitizeCommentContent(content: string, maxLength: number = 2000): string {
  if (typeof content !== 'string') {
    throw new Error('Content must be a string');
  }
  
  if (content.length === 0) {
    throw new Error('Content cannot be empty');
  }
  
  if (content.length > maxLength) {
    throw new Error(`Content exceeds maximum length of ${maxLength} characters`);
  }
  
  return sanitizeString(content);
}

/**
 * Validate pagination parameters
 */
export function validatePagination(
  limit?: string | number,
  offset?: string | number,
  maxLimit: number = 100
): { limit: number; offset: number } {
  const parsedLimit = typeof limit === 'string' ? parseInt(limit, 10) : limit ?? 50;
  const parsedOffset = typeof offset === 'string' ? parseInt(offset, 10) : offset ?? 0;
  
  if (isNaN(parsedLimit) || parsedLimit < 1) {
    throw new Error('Invalid limit: must be a positive number');
  }
  
  if (parsedLimit > maxLimit) {
    throw new Error(`Limit exceeds maximum of ${maxLimit}`);
  }
  
  if (isNaN(parsedOffset) || parsedOffset < 0) {
    throw new Error('Invalid offset: must be a non-negative number');
  }
  
  return { limit: parsedLimit, offset: parsedOffset };
}

/**
 * Validate required string field
 */
export function validateRequiredString(value: unknown, fieldName: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`${fieldName} is required and must be a non-empty string`);
  }
  return value.trim();
}

/**
 * Validate optional string field
 */
export function validateOptionalString(value: unknown, fieldName: string, maxLength?: number): string | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  
  if (typeof value !== 'string') {
    throw new Error(`${fieldName} must be a string`);
  }
  
  const trimmed = value.trim();
  
  if (maxLength && trimmed.length > maxLength) {
    throw new Error(`${fieldName} exceeds maximum length of ${maxLength}`);
  }
  
  return trimmed;
}

/**
 * Number validation options
 */
interface NumberValidationOptions {
  min?: number;
  max?: number;
  required?: boolean;
}

/**
 * Validate number field
 */
export function validateNumber(
  value: unknown,
  fieldName: string,
  options: NumberValidationOptions = {}
): number | undefined {
  if (value === undefined || value === null) {
    if (options.required) {
      throw new Error(`${fieldName} is required`);
    }
    return undefined;
  }
  
  let num: number;
  if (typeof value === 'string') {
    num = parseFloat(value);
  } else if (typeof value === 'number') {
    num = value;
  } else {
    throw new Error(`${fieldName} must be a valid number`);
  }
  
  if (isNaN(num)) {
    throw new Error(`${fieldName} must be a valid number`);
  }
  
  if (options.min !== undefined && num < options.min) {
    throw new Error(`${fieldName} must be at least ${options.min}`);
  }
  
  if (options.max !== undefined && num > options.max) {
    throw new Error(`${fieldName} must be at most ${options.max}`);
  }
  
  return num;
}

/**
 * Validation result
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Validate multiple fields and collect errors
 */
export class Validator {
  private errors: string[] = [];

  validateUUID(value: string, fieldName: string): this {
    try {
      validateUUID(value, fieldName);
    } catch (error) {
      this.errors.push((error as Error).message);
    }
    return this;
  }

  validateRequired(value: unknown, fieldName: string): this {
    if (value === undefined || value === null || value === '') {
      this.errors.push(`${fieldName} is required`);
    }
    return this;
  }

  validateString(value: unknown, fieldName: string, options?: { minLength?: number; maxLength?: number }): this {
    if (value !== undefined && value !== null) {
      if (typeof value !== 'string') {
        this.errors.push(`${fieldName} must be a string`);
      } else {
        if (options?.minLength && value.length < options.minLength) {
          this.errors.push(`${fieldName} must be at least ${options.minLength} characters`);
        }
        if (options?.maxLength && value.length > options.maxLength) {
          this.errors.push(`${fieldName} must be at most ${options.maxLength} characters`);
        }
      }
    }
    return this;
  }

  validateNumber(value: unknown, fieldName: string, options?: { min?: number; max?: number }): this {
    if (value !== undefined && value !== null) {
      let num: number;
      if (typeof value === 'string') {
        num = parseFloat(value);
      } else if (typeof value === 'number') {
        num = value;
      } else {
        this.errors.push(`${fieldName} must be a valid number`);
        return this;
      }
      
      if (isNaN(num)) {
        this.errors.push(`${fieldName} must be a valid number`);
      } else {
        if (options?.min !== undefined && num < options.min) {
          this.errors.push(`${fieldName} must be at least ${options.min}`);
        }
        if (options?.max !== undefined && num > options.max) {
          this.errors.push(`${fieldName} must be at most ${options.max}`);
        }
      }
    }
    return this;
  }

  addError(message: string): this {
    this.errors.push(message);
    return this;
  }

  result(): ValidationResult {
    return {
      valid: this.errors.length === 0,
      errors: this.errors,
    };
  }

  throwIfInvalid(): void {
    if (this.errors.length > 0) {
      throw new Error(`Validation failed: ${this.errors.join(', ')}`);
    }
  }
}

export default Validator;
