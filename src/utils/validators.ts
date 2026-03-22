/**
 * Boundary Validation Utilities
 * 
 * Provides validation functions for common boundary cases in trading operations.
 * These validators throw appropriate AppError instances with user-friendly messages.
 * 
 * @example
 * validateOrderParams({
 *   symbol: 'BTCUSDT',
 *   side: 'buy',
 *   type: 'limit',
 *   price: 50000,
 *   quantity: 0.1
 * });
 */

import {
  AppError,
  ErrorCode,
  InvalidInputError,
  InvalidOrderError,
  ValidationError,
} from './AppError';

/**
 * Trading pair symbol pattern (e.g., BTCUSDT, ETH-USDT)
 */
const SYMBOL_PATTERN = /^[A-Z0-9]{2,20}[-_]?[A-Z0-9]{2,10}$/;

/**
 * Validate order parameters
 */
export function validateOrderParams(params: {
  symbol?: string | null;
  side?: string | null;
  type?: string | null;
  price?: number | null;
  quantity?: number | null;
  amount?: number | null;
}): void {
  const { symbol, side, type, price, quantity, amount } = params;

  // Validate symbol
  if (!symbol) {
    throw new InvalidOrderError('Order symbol is required', { field: 'symbol' });
  }

  if (typeof symbol !== 'string' || !SYMBOL_PATTERN.test(symbol.toUpperCase())) {
    throw new InvalidOrderError(
      `Invalid trading pair symbol: ${symbol}`,
      { field: 'symbol', value: symbol }
    );
  }

  // Validate side
  if (side !== undefined && side !== null) {
    if (!['buy', 'sell', 'BUY', 'SELL'].includes(side.toLowerCase())) {
      throw new InvalidOrderError(
        `Order side must be "buy" or "sell", got: ${side}`,
        { field: 'side', value: side, allowed: ['buy', 'sell'] }
      );
    }
  }

  // Validate type
  if (type !== undefined && type !== null) {
    const validTypes = ['limit', 'market', 'LIMIT', 'MARKET'];
    if (!validTypes.includes(type.toLowerCase())) {
      throw new InvalidOrderError(
        `Order type must be "limit" or "market", got: ${type}`,
        { field: 'type', value: type, allowed: ['limit', 'market'] }
      );
    }
  }

  // Validate quantity
  if (quantity !== undefined && quantity !== null) {
    if (typeof quantity !== 'number' || isNaN(quantity)) {
      throw new InvalidOrderError(
        'Quantity must be a number',
        { field: 'quantity', value: quantity }
      );
    }

    if (quantity <= 0) {
      throw new InvalidOrderError(
        `Quantity must be positive, got: ${quantity}`,
        { field: 'quantity', value: quantity, min: 0, exclusive: true }
      );
    }

    // Check for unreasonably small quantity (dust)
    if (quantity < 0.00000001) {
      throw new InvalidOrderError(
        `Quantity too small: ${quantity}. Minimum is 0.00000001`,
        { field: 'quantity', value: quantity, min: 0.00000001 }
      );
    }
  }

  // Validate amount (alternative to quantity)
  if (amount !== undefined && amount !== null) {
    if (typeof amount !== 'number' || isNaN(amount)) {
      throw new InvalidOrderError(
        'Amount must be a number',
        { field: 'amount', value: amount }
      );
    }

    if (amount <= 0) {
      throw new InvalidOrderError(
        `Amount must be positive, got: ${amount}`,
        { field: 'amount', value: amount, min: 0, exclusive: true }
      );
    }
  }

  // Validate price for limit orders
  if (type?.toLowerCase() === 'limit') {
    if (price === undefined || price === null) {
      throw new InvalidOrderError(
        'Limit orders require a price',
        { field: 'price', orderType: 'limit' }
      );
    }

    if (typeof price !== 'number' || isNaN(price)) {
      throw new InvalidOrderError(
        'Price must be a number',
        { field: 'price', value: price }
      );
    }

    if (price <= 0) {
      throw new InvalidOrderError(
        `Price must be positive, got: ${price}`,
        { field: 'price', value: price, min: 0, exclusive: true }
      );
    }
  }

  // Either quantity or amount must be provided
  if (quantity === undefined && quantity === null && 
      amount === undefined && amount === null) {
    throw new InvalidOrderError(
      'Either quantity or amount must be provided',
      { fields: ['quantity', 'amount'] }
    );
  }
}

/**
 * Validate conditional order parameters
 */
export function validateConditionalOrderParams(params: {
  symbol?: string | null;
  side?: string | null;
  orderType?: string | null;
  triggerPrice?: number | null;
  quantity?: number | null;
  expiresAt?: string | null;
}): void {
  const { symbol, side, orderType, triggerPrice, quantity, expiresAt } = params;

  // Validate symbol
  if (!symbol) {
    throw new InvalidOrderError('Symbol is required', { field: 'symbol' });
  }

  // Validate side
  if (side !== undefined && side !== null) {
    if (!['buy', 'sell', 'BUY', 'SELL'].includes(side.toLowerCase())) {
      throw new InvalidOrderError(
        `Side must be "buy" or "sell", got: ${side}`,
        { field: 'side', value: side }
      );
    }
  }

  // Validate order type
  if (orderType !== undefined && orderType !== null) {
    const validTypes = ['stop_loss', 'take_profit', 'stop_loss_limit', 'take_profit_limit'];
    if (!validTypes.includes(orderType.toLowerCase())) {
      throw new InvalidOrderError(
        `Conditional order type must be one of: ${validTypes.join(', ')}`,
        { field: 'orderType', value: orderType, allowed: validTypes }
      );
    }
  }

  // Validate trigger price
  if (triggerPrice !== undefined && triggerPrice !== null) {
    if (typeof triggerPrice !== 'number' || isNaN(triggerPrice)) {
      throw new InvalidOrderError(
        'Trigger price must be a number',
        { field: 'triggerPrice', value: triggerPrice }
      );
    }

    if (triggerPrice <= 0) {
      throw new InvalidOrderError(
        `Trigger price must be positive, got: ${triggerPrice}`,
        { field: 'triggerPrice', value: triggerPrice }
      );
    }
  }

  // Validate quantity
  if (quantity !== undefined && quantity !== null) {
    if (typeof quantity !== 'number' || isNaN(quantity)) {
      throw new InvalidOrderError(
        'Quantity must be a number',
        { field: 'quantity', value: quantity }
      );
    }

    if (quantity <= 0) {
      throw new InvalidOrderError(
        `Quantity must be positive, got: ${quantity}`,
        { field: 'quantity', value: quantity }
      );
    }
  }

  // Validate expiration date
  if (expiresAt !== undefined && expiresAt !== null) {
    const expirationDate = new Date(expiresAt);
    if (isNaN(expirationDate.getTime())) {
      throw new InvalidOrderError(
        `Invalid expiration date: ${expiresAt}`,
        { field: 'expiresAt', value: expiresAt }
      );
    }

    if (expirationDate <= new Date()) {
      throw new InvalidOrderError(
        'Expiration date must be in the future',
        { field: 'expiresAt', value: expiresAt }
      );
    }
  }
}

/**
 * Validate balance sufficiency
 */
export function validateBalance(
  required: number,
  available: number,
  currency: string = 'USD'
): void {
  if (typeof required !== 'number' || isNaN(required)) {
    throw new InvalidInputError(
      'Required amount must be a number',
      { field: 'required', value: required }
    );
  }

  if (typeof available !== 'number' || isNaN(available)) {
    throw new InvalidInputError(
      'Available balance must be a number',
      { field: 'available', value: available }
    );
  }

  if (required < 0) {
    throw new InvalidInputError(
      `Required amount cannot be negative: ${required}`,
      { field: 'required', value: required }
    );
  }

  if (available < 0) {
    throw new InvalidInputError(
      `Available balance cannot be negative: ${available}`,
      { field: 'available', value: available }
    );
  }

  if (required > available) {
    throw new AppError(
      ErrorCode.INSUFFICIENT_BALANCE,
      `Insufficient ${currency} balance`,
      {
        required,
        available,
        currency,
        shortfall: required - available,
      }
    );
  }
}

/**
 * Validate numeric range
 */
export function validateRange(
  value: number,
  min: number,
  max: number,
  fieldName: string = 'value'
): void {
  if (typeof value !== 'number' || isNaN(value)) {
    throw new InvalidInputError(
      `${fieldName} must be a number`,
      { field: fieldName, value }
    );
  }

  if (value < min || value > max) {
    throw new AppError(
      ErrorCode.OUT_OF_RANGE,
      `${fieldName} must be between ${min} and ${max}`,
      { field: fieldName, value, min, max }
    );
  }
}

/**
 * Validate positive number
 */
export function validatePositive(value: number, fieldName: string = 'value'): void {
  if (typeof value !== 'number' || isNaN(value)) {
    throw new InvalidInputError(
      `${fieldName} must be a number`,
      { field: fieldName, value }
    );
  }

  if (value <= 0) {
    throw new AppError(
      ErrorCode.OUT_OF_RANGE,
      `${fieldName} must be positive`,
      { field: fieldName, value, min: 0, exclusive: true }
    );
  }
}

/**
 * Validate non-negative number
 */
export function validateNonNegative(value: number, fieldName: string = 'value'): void {
  if (typeof value !== 'number' || isNaN(value)) {
    throw new InvalidInputError(
      `${fieldName} must be a number`,
      { field: fieldName, value }
    );
  }

  if (value < 0) {
    throw new AppError(
      ErrorCode.OUT_OF_RANGE,
      `${fieldName} cannot be negative`,
      { field: fieldName, value }
    );
  }
}

/**
 * Validate string length
 */
export function validateLength(
  value: string,
  minLength: number,
  maxLength: number,
  fieldName: string = 'value'
): void {
  if (typeof value !== 'string') {
    throw new InvalidInputError(
      `${fieldName} must be a string`,
      { field: fieldName, value }
    );
  }

  if (value.length < minLength || value.length > maxLength) {
    throw new AppError(
      ErrorCode.OUT_OF_RANGE,
      `${fieldName} length must be between ${minLength} and ${maxLength}`,
      { field: fieldName, length: value.length, minLength, maxLength }
    );
  }
}

/**
 * Validate enum value
 */
export function validateEnum<T extends string>(
  value: string,
  allowed: T[],
  fieldName: string = 'value'
): T {
  if (!allowed.includes(value as T)) {
    throw new InvalidInputError(
      `${fieldName} must be one of: ${allowed.join(', ')}`,
      { field: fieldName, value, allowed }
    );
  }
  return value as T;
}

/**
 * Validate required field
 */
export function validateRequired(value: any, fieldName: string): void {
  if (value === undefined || value === null || value === '') {
    throw new AppError(
      ErrorCode.MISSING_REQUIRED_FIELD,
      `${fieldName} is required`,
      { field: fieldName }
    );
  }
}

/**
 * Validate email format
 */
export function validateEmail(email: string, fieldName: string = 'email'): void {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  
  if (!email) {
    throw new AppError(
      ErrorCode.MISSING_REQUIRED_FIELD,
      `${fieldName} is required`,
      { field: fieldName }
    );
  }

  if (!emailRegex.test(email)) {
    throw new AppError(
      ErrorCode.INVALID_FORMAT,
      `Invalid email format`,
      { field: fieldName, value: email }
    );
  }
}

/**
 * Validate pagination parameters
 */
export function validatePagination(
  limit?: number,
  offset?: number
): { limit: number; offset: number } {
  const defaultLimit = 20;
  const maxLimit = 100;
  const defaultOffset = 0;

  let validatedLimit = defaultLimit;
  let validatedOffset = defaultOffset;

  if (limit !== undefined) {
    if (typeof limit !== 'number' || isNaN(limit)) {
      throw new InvalidInputError('Limit must be a number', { field: 'limit', value: limit });
    }
    if (limit < 1) {
      throw new InvalidInputError('Limit must be at least 1', { field: 'limit', value: limit });
    }
    if (limit > maxLimit) {
      throw new InvalidInputError(`Limit cannot exceed ${maxLimit}`, { field: 'limit', value: limit, max: maxLimit });
    }
    validatedLimit = Math.floor(limit);
  }

  if (offset !== undefined) {
    if (typeof offset !== 'number' || isNaN(offset)) {
      throw new InvalidInputError('Offset must be a number', { field: 'offset', value: offset });
    }
    if (offset < 0) {
      throw new InvalidInputError('Offset cannot be negative', { field: 'offset', value: offset });
    }
    validatedOffset = Math.floor(offset);
  }

  return { limit: validatedLimit, offset: validatedOffset };
}

export default {
  validateOrderParams,
  validateConditionalOrderParams,
  validateBalance,
  validateRange,
  validatePositive,
  validateNonNegative,
  validateLength,
  validateEnum,
  validateRequired,
  validateEmail,
  validatePagination,
};