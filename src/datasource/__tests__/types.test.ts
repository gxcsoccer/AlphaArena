/**
 * Tests for Data Source Types
 */

import {
  DataSourceStatus,
  DataSourceErrorType,
  DataSourceError,
} from '../types';

describe('DataSourceStatus', () => {
  it('should have correct status values', () => {
    expect(DataSourceStatus.DISCONNECTED).toBe('disconnected');
    expect(DataSourceStatus.CONNECTING).toBe('connecting');
    expect(DataSourceStatus.CONNECTED).toBe('connected');
    expect(DataSourceStatus.RECONNECTING).toBe('reconnecting');
    expect(DataSourceStatus.ERROR).toBe('error');
  });
});

describe('DataSourceErrorType', () => {
  it('should have correct error types', () => {
    expect(DataSourceErrorType.CONNECTION_ERROR).toBe('connection_error');
    expect(DataSourceErrorType.AUTHENTICATION_ERROR).toBe('authentication_error');
    expect(DataSourceErrorType.RATE_LIMIT_ERROR).toBe('rate_limit_error');
    expect(DataSourceErrorType.INVALID_SYMBOL).toBe('invalid_symbol');
    expect(DataSourceErrorType.INVALID_INTERVAL).toBe('invalid_interval');
    expect(DataSourceErrorType.TIMEOUT).toBe('timeout');
    expect(DataSourceErrorType.SUBSCRIPTION_ERROR).toBe('subscription_error');
    expect(DataSourceErrorType.UNKNOWN).toBe('unknown');
  });
});

describe('DataSourceError', () => {
  it('should create error with all properties', () => {
    const originalError = new Error('Original error');
    const error = new DataSourceError(
      DataSourceErrorType.CONNECTION_ERROR,
      'Connection failed',
      'mock',
      originalError
    );

    expect(error.name).toBe('DataSourceError');
    expect(error.type).toBe(DataSourceErrorType.CONNECTION_ERROR);
    expect(error.message).toBe('Connection failed');
    expect(error.providerId).toBe('mock');
    expect(error.originalError).toBe(originalError);
  });

  it('should create error with minimal properties', () => {
    const error = new DataSourceError(
      DataSourceErrorType.UNKNOWN,
      'Unknown error'
    );

    expect(error.name).toBe('DataSourceError');
    expect(error.type).toBe(DataSourceErrorType.UNKNOWN);
    expect(error.message).toBe('Unknown error');
    expect(error.providerId).toBeUndefined();
    expect(error.originalError).toBeUndefined();
  });
});