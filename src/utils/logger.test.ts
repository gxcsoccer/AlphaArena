/**
 * Tests for structured logger
 */

import { Logger, LogLevel, createLogger } from './logger';

// Mock console methods
const originalConsole = {
  debug: console.debug,
  info: console.info,
  warn: console.warn,
  error: console.error,
};

describe('Logger', () => {
  let mockConsole: {
    debug: jest.Mock;
    info: jest.Mock;
    warn: jest.Mock;
    error: jest.Mock;
  };

  beforeEach(() => {
    mockConsole = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };
    console.debug = mockConsole.debug;
    console.info = mockConsole.info;
    console.warn = mockConsole.warn;
    console.error = mockConsole.error;
  });

  afterEach(() => {
    console.debug = originalConsole.debug;
    console.info = originalConsole.info;
    console.warn = originalConsole.warn;
    console.error = originalConsole.error;
  });

  describe('createLogger', () => {
    it('should create a logger with module name', () => {
      const log = createLogger('TestModule');
      expect(log).toBeInstanceOf(Logger);
    });
  });

  describe('log levels', () => {
    it('should log debug messages when level is DEBUG', () => {
      const log = new Logger({ module: 'Test', level: LogLevel.DEBUG });
      log.debug('test message');
      expect(mockConsole.debug).toHaveBeenCalled();
    });

    it('should not log debug messages when level is INFO', () => {
      const log = new Logger({ module: 'Test', level: LogLevel.INFO });
      log.debug('test message');
      expect(mockConsole.debug).not.toHaveBeenCalled();
    });

    it('should log info messages when level is INFO', () => {
      const log = new Logger({ module: 'Test', level: LogLevel.INFO });
      log.info('test message');
      expect(mockConsole.info).toHaveBeenCalled();
    });

    it('should log warn messages when level is WARN', () => {
      const log = new Logger({ module: 'Test', level: LogLevel.WARN });
      log.warn('test message');
      expect(mockConsole.warn).toHaveBeenCalled();
    });

    it('should not log info messages when level is WARN', () => {
      const log = new Logger({ module: 'Test', level: LogLevel.WARN });
      log.info('test message');
      expect(mockConsole.info).not.toHaveBeenCalled();
    });

    it('should log error messages when level is ERROR', () => {
      const log = new Logger({ module: 'Test', level: LogLevel.ERROR });
      log.error('test message');
      expect(mockConsole.error).toHaveBeenCalled();
    });

    it('should not log warn messages when level is ERROR', () => {
      const log = new Logger({ module: 'Test', level: LogLevel.ERROR });
      log.warn('test message');
      expect(mockConsole.warn).not.toHaveBeenCalled();
    });

    it('should not log anything when level is NONE', () => {
      const log = new Logger({ module: 'Test', level: LogLevel.NONE });
      log.debug('debug');
      log.info('info');
      log.warn('warn');
      log.error('error');
      expect(mockConsole.debug).not.toHaveBeenCalled();
      expect(mockConsole.info).not.toHaveBeenCalled();
      expect(mockConsole.warn).not.toHaveBeenCalled();
      expect(mockConsole.error).not.toHaveBeenCalled();
    });
  });

  describe('log output format', () => {
    it('should include module name in output', () => {
      const log = new Logger({ module: 'MyModule', level: LogLevel.INFO });
      log.info('test message');
      const output = mockConsole.info.mock.calls[0][0];
      expect(output).toContain('[MyModule]');
    });

    it('should include message in output', () => {
      const log = new Logger({ module: 'Test', level: LogLevel.INFO });
      log.info('Hello World');
      const output = mockConsole.info.mock.calls[0][0];
      expect(output).toContain('Hello World');
    });

    it('should include data object in output', () => {
      const log = new Logger({ module: 'Test', level: LogLevel.INFO });
      log.info('test', { foo: 'bar' });
      const output = mockConsole.info.mock.calls[0][0];
      expect(output).toContain('{"foo":"bar"}');
    });

    it('should include error details', () => {
      const log = new Logger({ module: 'Test', level: LogLevel.ERROR });
      const error = new Error('test error');
      log.error('Something failed', error);
      const output = mockConsole.error.mock.calls[0][0];
      expect(output).toContain('Error: Error: test error');
    });

    it('should include level indicator', () => {
      const log = new Logger({ module: 'Test', level: LogLevel.DEBUG });
      log.debug('debug');
      log.info('info');
      log.warn('warn');
      log.error('error');
      
      expect(mockConsole.debug.mock.calls[0][0]).toContain('[DEBUG]');
      expect(mockConsole.info.mock.calls[0][0]).toContain('[INFO]');
      expect(mockConsole.warn.mock.calls[0][0]).toContain('[WARN]');
      expect(mockConsole.error.mock.calls[0][0]).toContain('[ERROR]');
    });
  });

  describe('setLevel', () => {
    it('should change log level at runtime', () => {
      const log = new Logger({ module: 'Test', level: LogLevel.INFO });
      log.debug('should not appear');
      expect(mockConsole.debug).not.toHaveBeenCalled();
      
      log.setLevel(LogLevel.DEBUG);
      log.debug('should appear now');
      expect(mockConsole.debug).toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('should handle error as second argument', () => {
      const log = new Logger({ module: 'Test', level: LogLevel.ERROR });
      const error = new Error('boom');
      log.error('Operation failed', error);
      const output = mockConsole.error.mock.calls[0][0];
      expect(output).toContain('Operation failed');
      expect(output).toContain('boom');
    });

    it('should handle non-Error error', () => {
      const log = new Logger({ module: 'Test', level: LogLevel.ERROR });
      log.error('Something went wrong', 'string error');
      expect(mockConsole.error).toHaveBeenCalled();
    });
  });
});
