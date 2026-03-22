/**
 * Tests for Boundary Validators
 */

import {
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
} from '../validators';
import {
  AppError,
  ErrorCode,
  InvalidInputError,
  InvalidOrderError,
} from '../AppError';

describe('Validators', () => {
  describe('validateOrderParams', () => {
    it('should accept valid order parameters', () => {
      expect(() => validateOrderParams({
        symbol: 'BTCUSDT',
        side: 'buy',
        type: 'limit',
        price: 50000,
        quantity: 0.1,
      })).not.toThrow();
    });

    it('should accept valid market order without price', () => {
      expect(() => validateOrderParams({
        symbol: 'BTCUSDT',
        side: 'sell',
        type: 'market',
        quantity: 0.1,
      })).not.toThrow();
    });

    it('should throw if symbol is missing', () => {
      expect(() => validateOrderParams({
        side: 'buy',
        type: 'limit',
      })).toThrow(InvalidOrderError);
    });

    it('should throw if symbol is invalid', () => {
      expect(() => validateOrderParams({
        symbol: 'INVALID@SYMBOL',
        side: 'buy',
      })).toThrow(InvalidOrderError);
    });

    it('should throw if side is invalid', () => {
      expect(() => validateOrderParams({
        symbol: 'BTCUSDT',
        side: 'invalid',
      })).toThrow(InvalidOrderError);
    });

    it('should throw if type is invalid', () => {
      expect(() => validateOrderParams({
        symbol: 'BTCUSDT',
        type: 'invalid',
      })).toThrow(InvalidOrderError);
    });

    it('should throw if quantity is negative', () => {
      expect(() => validateOrderParams({
        symbol: 'BTCUSDT',
        quantity: -1,
      })).toThrow(InvalidOrderError);
    });

    it('should throw if quantity is zero', () => {
      expect(() => validateOrderParams({
        symbol: 'BTCUSDT',
        quantity: 0,
      })).toThrow(InvalidOrderError);
    });

    it('should throw if quantity is too small (dust)', () => {
      expect(() => validateOrderParams({
        symbol: 'BTCUSDT',
        quantity: 0.0000000001,
      })).toThrow(InvalidOrderError);
    });

    it('should throw if limit order has no price', () => {
      expect(() => validateOrderParams({
        symbol: 'BTCUSDT',
        type: 'limit',
        quantity: 1,
      })).toThrow(InvalidOrderError);
    });

    it('should throw if limit order price is negative', () => {
      expect(() => validateOrderParams({
        symbol: 'BTCUSDT',
        type: 'limit',
        price: -100,
        quantity: 1,
      })).toThrow(InvalidOrderError);
    });

    it('should accept amount instead of quantity', () => {
      expect(() => validateOrderParams({
        symbol: 'BTCUSDT',
        side: 'buy',
        amount: 1000,
      })).not.toThrow();
    });

    it('should throw if amount is negative', () => {
      expect(() => validateOrderParams({
        symbol: 'BTCUSDT',
        amount: -100,
      })).toThrow(InvalidOrderError);
    });
  });

  describe('validateConditionalOrderParams', () => {
    it('should accept valid conditional order parameters', () => {
      expect(() => validateConditionalOrderParams({
        symbol: 'BTCUSDT',
        side: 'buy',
        orderType: 'stop_loss',
        triggerPrice: 45000,
        quantity: 0.1,
      })).not.toThrow();
    });

    it('should throw if symbol is missing', () => {
      expect(() => validateConditionalOrderParams({
        side: 'buy',
        orderType: 'stop_loss',
      })).toThrow(InvalidOrderError);
    });

    it('should throw for invalid order type', () => {
      expect(() => validateConditionalOrderParams({
        symbol: 'BTCUSDT',
        orderType: 'invalid_type',
      })).toThrow(InvalidOrderError);
    });

    it('should throw if trigger price is negative', () => {
      expect(() => validateConditionalOrderParams({
        symbol: 'BTCUSDT',
        triggerPrice: -100,
      })).toThrow(InvalidOrderError);
    });

    it('should throw if expiration is in the past', () => {
      const pastDate = new Date(Date.now() - 86400000).toISOString();
      expect(() => validateConditionalOrderParams({
        symbol: 'BTCUSDT',
        expiresAt: pastDate,
      })).toThrow(InvalidOrderError);
    });

    it('should accept future expiration date', () => {
      const futureDate = new Date(Date.now() + 86400000).toISOString();
      expect(() => validateConditionalOrderParams({
        symbol: 'BTCUSDT',
        expiresAt: futureDate,
      })).not.toThrow();
    });
  });

  describe('validateBalance', () => {
    it('should pass if balance is sufficient', () => {
      expect(() => validateBalance(100, 200)).not.toThrow();
    });

    it('should pass if balance exactly matches required', () => {
      expect(() => validateBalance(100, 100)).not.toThrow();
    });

    it('should throw if balance is insufficient', () => {
      expect(() => validateBalance(200, 100)).toThrow(AppError);
      
      try {
        validateBalance(200, 100, 'USD');
      } catch (error: any) {
        expect(error.code).toBe(ErrorCode.INSUFFICIENT_BALANCE);
        expect(error.details.shortfall).toBe(100);
      }
    });

    it('should throw if required is negative', () => {
      expect(() => validateBalance(-1, 100)).toThrow(InvalidInputError);
    });

    it('should throw if available is negative', () => {
      expect(() => validateBalance(100, -1)).toThrow(InvalidInputError);
    });

    it('should throw if values are not numbers', () => {
      expect(() => validateBalance(NaN, 100)).toThrow(InvalidInputError);
      expect(() => validateBalance(100, NaN)).toThrow(InvalidInputError);
    });
  });

  describe('validateRange', () => {
    it('should pass for value in range', () => {
      expect(() => validateRange(5, 1, 10)).not.toThrow();
    });

    it('should pass for value at boundaries', () => {
      expect(() => validateRange(1, 1, 10)).not.toThrow();
      expect(() => validateRange(10, 1, 10)).not.toThrow();
    });

    it('should throw for value below range', () => {
      expect(() => validateRange(0, 1, 10)).toThrow(AppError);
    });

    it('should throw for value above range', () => {
      expect(() => validateRange(11, 1, 10)).toThrow(AppError);
    });

    it('should throw for non-number value', () => {
      expect(() => validateRange(NaN, 1, 10)).toThrow(InvalidInputError);
    });
  });

  describe('validatePositive', () => {
    it('should pass for positive values', () => {
      expect(() => validatePositive(1)).not.toThrow();
      expect(() => validatePositive(0.001)).not.toThrow();
      expect(() => validatePositive(1000)).not.toThrow();
    });

    it('should throw for zero', () => {
      expect(() => validatePositive(0)).toThrow(AppError);
    });

    it('should throw for negative values', () => {
      expect(() => validatePositive(-1)).toThrow(AppError);
    });

    it('should throw for non-number values', () => {
      expect(() => validatePositive(NaN)).toThrow(InvalidInputError);
    });
  });

  describe('validateNonNegative', () => {
    it('should pass for positive and zero values', () => {
      expect(() => validateNonNegative(0)).not.toThrow();
      expect(() => validateNonNegative(1)).not.toThrow();
    });

    it('should throw for negative values', () => {
      expect(() => validateNonNegative(-1)).toThrow(AppError);
    });
  });

  describe('validateLength', () => {
    it('should pass for valid string length', () => {
      expect(() => validateLength('hello', 1, 10)).not.toThrow();
    });

    it('should throw for string too short', () => {
      expect(() => validateLength('ab', 3, 10)).toThrow(AppError);
    });

    it('should throw for string too long', () => {
      expect(() => validateLength('hello world', 1, 5)).toThrow(AppError);
    });

    it('should throw for non-string value', () => {
      expect(() => validateLength(123 as any, 1, 10)).toThrow(InvalidInputError);
    });
  });

  describe('validateEnum', () => {
    it('should return valid enum value', () => {
      const result = validateEnum('buy', ['buy', 'sell'] as const);
      expect(result).toBe('buy');
    });

    it('should throw for invalid enum value', () => {
      expect(() => validateEnum('invalid', ['buy', 'sell'])).toThrow(InvalidInputError);
    });
  });

  describe('validateRequired', () => {
    it('should pass for defined values', () => {
      expect(() => validateRequired('value', 'field')).not.toThrow();
      expect(() => validateRequired(0, 'field')).not.toThrow();
      expect(() => validateRequired(false, 'field')).not.toThrow();
    });

    it('should throw for undefined', () => {
      expect(() => validateRequired(undefined, 'field')).toThrow(AppError);
    });

    it('should throw for null', () => {
      expect(() => validateRequired(null, 'field')).toThrow(AppError);
    });

    it('should throw for empty string', () => {
      expect(() => validateRequired('', 'field')).toThrow(AppError);
    });
  });

  describe('validateEmail', () => {
    it('should pass for valid email', () => {
      expect(() => validateEmail('test@example.com')).not.toThrow();
    });

    it('should throw for invalid email', () => {
      expect(() => validateEmail('invalid')).toThrow(AppError);
      expect(() => validateEmail('invalid@')).toThrow(AppError);
      expect(() => validateEmail('@example.com')).toThrow(AppError);
    });

    it('should throw for empty email', () => {
      expect(() => validateEmail('')).toThrow(AppError);
    });
  });

  describe('validatePagination', () => {
    it('should return default values for undefined parameters', () => {
      const result = validatePagination();
      expect(result).toEqual({ limit: 20, offset: 0 });
    });

    it('should accept valid limit and offset', () => {
      const result = validatePagination(50, 100);
      expect(result).toEqual({ limit: 50, offset: 100 });
    });

    it('should floor decimal values', () => {
      const result = validatePagination(10.5, 20.9);
      expect(result).toEqual({ limit: 10, offset: 20 });
    });

    it('should throw for limit less than 1', () => {
      expect(() => validatePagination(0)).toThrow(InvalidInputError);
      expect(() => validatePagination(-1)).toThrow(InvalidInputError);
    });

    it('should throw for limit exceeding maximum', () => {
      expect(() => validatePagination(101)).toThrow(InvalidInputError);
    });

    it('should throw for negative offset', () => {
      expect(() => validatePagination(10, -1)).toThrow(InvalidInputError);
    });

    it('should throw for non-number values', () => {
      expect(() => validatePagination(NaN)).toThrow(InvalidInputError);
      expect(() => validatePagination(10, NaN)).toThrow(InvalidInputError);
    });
  });
});