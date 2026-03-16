/**
 * Structured Logger System for AlphaArena
 * 
 * Features:
 * - Structured log output with JSON format in production
 * - Log level control (DEBUG, INFO, WARN, ERROR)
 * - Environment-aware (development vs production)
 * - Module context for easy tracking
 * - Request ID support for request tracing
 * - Configurable via environment variables and localStorage
 */

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  NONE = 4,
}

interface LogContext {
  module: string;
  requestId?: string;
  timestamp: string;
  level: string;
  message: string;
  data?: unknown;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

interface LoggerConfig {
  level?: LogLevel;
  module: string;
  requestId?: string;
}

// Environment detection
const isProduction = (): boolean => {
  // Check for browser environment
  if (typeof window !== 'undefined') {
    // In Vite browser build, check for production mode
    // Use type assertion to avoid TypeScript error
    try {
      // @ts-expect-error - Vite specific property
      const viteEnv = window.__VITE_ENV__;
      if (viteEnv === 'production') return true;
    } catch {
      // Ignore
    }
    // Fallback to checking hostname
    return window.location.hostname !== 'localhost' && 
           window.location.hostname !== '127.0.0.1';
  }
  // Node.js environment
  return process.env.NODE_ENV === 'production';
};

// Get log level from environment or localStorage
const getConfiguredLogLevel = (): LogLevel => {
  // Check localStorage first (for runtime debugging)
  if (typeof window !== 'undefined') {
    const storedLevel = localStorage.getItem('LOG_LEVEL');
    if (storedLevel) {
      const level = LogLevel[storedLevel as keyof typeof LogLevel];
      if (typeof level === 'number') {
        return level;
      }
    }
  }

  // Check environment variable
  if (typeof process !== 'undefined' && process.env?.LOG_LEVEL) {
    const level = LogLevel[process.env.LOG_LEVEL as keyof typeof LogLevel];
    if (typeof level === 'number') {
      return level;
    }
  }

  // Default based on environment
  return isProduction() ? LogLevel.WARN : LogLevel.DEBUG;
};

// Global request ID for request tracing
let globalRequestId: string | undefined;

export const setGlobalRequestId = (id: string | undefined): void => {
  globalRequestId = id;
};

export const getGlobalRequestId = (): string | undefined => globalRequestId;

/**
 * Logger class for structured logging
 */
export class Logger {
  private module: string;
  private level: LogLevel;
  private requestId?: string;

  constructor(config: string | LoggerConfig) {
    if (typeof config === 'string') {
      this.module = config;
      this.level = getConfiguredLogLevel();
    } else {
      this.module = config.module;
      this.level = config.level ?? getConfiguredLogLevel();
      this.requestId = config.requestId;
    }
  }

  /**
   * Create a child logger with the same module but additional context
   */
  child(options: { requestId?: string }): Logger {
    return new Logger({
      module: this.module,
      level: this.level,
      requestId: options.requestId ?? this.requestId,
    });
  }

  /**
   * Set log level at runtime
   */
  setLevel(level: LogLevel): void {
    this.level = level;
  }

  /**
   * Format timestamp in ISO format
   */
  private getTimestamp(): string {
    return new Date().toISOString();
  }

  /**
   * Build log context object
   */
  private buildContext(
    level: string,
    message: string,
    data?: unknown,
    error?: Error
  ): LogContext {
    const context: LogContext = {
      module: this.module,
      requestId: this.requestId ?? globalRequestId,
      timestamp: this.getTimestamp(),
      level,
      message,
    };

    if (data !== undefined) {
      context.data = data;
    }

    if (error) {
      context.error = {
        name: error.name,
        message: error.message,
        stack: error.stack,
      };
    }

    return context;
  }

  /**
   * Format log output based on environment
   */
  private formatOutput(context: LogContext): string {
    if (isProduction()) {
      // JSON structured logging for production
      return JSON.stringify(context);
    }

    // Human-readable format for development
    const parts: string[] = [];

    // Timestamp and level
    parts.push(`[${context.timestamp}]`);

    // Level with color indicator
    const levelColors: Record<string, string> = {
      DEBUG: '\x1b[36m', // Cyan
      INFO: '\x1b[32m', // Green
      WARN: '\x1b[33m', // Yellow
      ERROR: '\x1b[31m', // Red
    };
    const reset = '\x1b[0m';
    const color = levelColors[context.level] ?? '';
    parts.push(`${color}[${context.level}]${reset}`);

    // Module
    parts.push(`[${context.module}]`);

    // Request ID if present
    if (context.requestId) {
      parts.push(`[${context.requestId}]`);
    }

    // Message
    parts.push(context.message);

    // Data if present
    if (context.data !== undefined) {
      if (typeof context.data === 'object') {
        parts.push(JSON.stringify(context.data));
      } else {
        parts.push(String(context.data));
      }
    }

    // Error if present
    if (context.error) {
      parts.push(`\n  Error: ${context.error.name}: ${context.error.message}`);
      if (context.error.stack) {
        parts.push(`\n  Stack: ${context.error.stack}`);
      }
    }

    return parts.join(' ');
  }

  /**
   * Internal log method
   */
  private log(level: LogLevel, levelName: string, message: string, data?: unknown, error?: Error): void {
    if (level < this.level) {
      return;
    }

    const context = this.buildContext(levelName, message, data, error);
    const output = this.formatOutput(context);

    // Use appropriate console method
    switch (level) {
      case LogLevel.DEBUG:
        console.debug(output);
        break;
      case LogLevel.INFO:
        console.info(output);
        break;
      case LogLevel.WARN:
        console.warn(output);
        break;
      case LogLevel.ERROR:
        console.error(output);
        break;
    }
  }

  /**
   * Log debug message (development only by default)
   */
  debug(message: string, data?: unknown): void {
    this.log(LogLevel.DEBUG, 'DEBUG', message, data);
  }

  /**
   * Log info message
   */
  info(message: string, data?: unknown): void {
    this.log(LogLevel.INFO, 'INFO', message, data);
  }

  /**
   * Log warning message
   */
  warn(message: string, data?: unknown): void {
    this.log(LogLevel.WARN, 'WARN', message, data);
  }

  /**
   * Log error message
   */
  error(message: string, error?: Error | unknown, data?: unknown): void {
    const err = error instanceof Error ? error : undefined;
    const extraData = error instanceof Error ? data : error;
    this.log(LogLevel.ERROR, 'ERROR', message, extraData, err);
  }
}

/**
 * Factory function to create a logger for a module
 * 
 * @example
 * const log = createLogger('KLineChart');
 * log.debug('Initializing chart', { symbol });
 * log.info('Chart ready', { symbol, dataPoints });
 */
export const createLogger = (module: string): Logger => new Logger(module);

/**
 * Set global log level via localStorage (browser only)
 * Useful for debugging in production
 */
export const setLogLevel = (level: LogLevel): void => {
  if (typeof window !== 'undefined') {
    localStorage.setItem('LOG_LEVEL', LogLevel[level]);
    console.info(`Log level set to ${LogLevel[level]}`);
  }
};

/**
 * Get current log level name
 */
export const getLogLevelName = (): string => {
  return LogLevel[getConfiguredLogLevel()];
};

// Export LogLevel for convenience
export { LogLevel as Level };
