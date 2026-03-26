/**
 * Rate Limiting Middleware
 * Issue #641: Security Audit - API Permissions, Data Access Logging
 *
 * Implements rate limiting to protect against abuse and DDoS attacks.
 */

import { Request, Response, NextFunction } from 'express';
import { createLogger } from '../utils/logger';

const log = createLogger('RateLimitMiddleware');

/**
 * Rate limit store entry
 */
interface RateLimitEntry {
  count: number;
  resetTime: number;
  blockedAt?: number;
}

/**
 * In-memory rate limit store
 * For production, consider using Redis for distributed rate limiting
 */
class RateLimitStore {
  private store: Map<string, RateLimitEntry> = new Map();
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    // Clean up expired entries every minute
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 60000);
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.store.entries()) {
      if (entry.resetTime < now) {
        this.store.delete(key);
      }
    }
  }

  get(key: string): RateLimitEntry | undefined {
    return this.store.get(key);
  }

  set(key: string, entry: RateLimitEntry): void {
    this.store.set(key, entry);
  }

  increment(key: string, windowMs: number): { count: number; resetTime: number } {
    const now = Date.now();
    const entry = this.store.get(key);

    if (!entry || entry.resetTime < now) {
      // New window
      const newEntry: RateLimitEntry = {
        count: 1,
        resetTime: now + windowMs,
      };
      this.store.set(key, newEntry);
      return { count: 1, resetTime: newEntry.resetTime };
    }

    // Existing window - increment
    entry.count++;
    return { count: entry.count, resetTime: entry.resetTime };
  }

  decrement(key: string): void {
    const entry = this.store.get(key);
    if (entry && entry.count > 0) {
      entry.count--;
    }
  }

  reset(key: string): void {
    this.store.delete(key);
  }

  close(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
  }
}

// Global rate limit store
const globalStore = new RateLimitStore();

/**
 * Rate limit configuration
 */
export interface RateLimitConfig {
  windowMs?: number; // Time window in milliseconds
  max?: number; // Max requests per window
  message?: string; // Custom error message
  statusCode?: number; // HTTP status code for rate limited responses
  headers?: boolean; // Include rate limit headers in response
  skipFailedRequests?: boolean; // Don't count failed requests
  skipSuccessfulRequests?: boolean; // Don't count successful requests
  keyGenerator?: (req: Request) => string; // Custom key generator
  skip?: (req: Request) => boolean; // Skip rate limiting for certain requests
  handler?: (req: Request, res: Response) => void; // Custom handler
}

/**
 * Default rate limit configurations
 */
export const RATE_LIMITS = {
  // General API rate limit
  api: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // 100 requests per 15 minutes
  },
  // Strict rate limit for sensitive endpoints
  strict: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 20, // 20 requests per 15 minutes
  },
  // Login rate limit
  login: {
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 10, // 10 login attempts per hour
  },
  // Payment rate limit
  payment: {
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 30, // 30 payment operations per hour
  },
  // Export rate limit
  export: {
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 10, // 10 exports per hour
  },
  // Password reset rate limit
  passwordReset: {
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 3, // 3 password resets per hour
  },
};

/**
 * Get client IP address
 */
function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }
  if (Array.isArray(forwarded)) {
    return forwarded[0].trim();
  }
  return req.socket?.remoteAddress || 'unknown';
}

/**
 * Default key generator
 */
function defaultKeyGenerator(req: Request): string {
  const ip = getClientIp(req);
  const userId = req.user?.id || 'anonymous';
  return `${ip}:${userId}`;
}

/**
 * Rate Limit Middleware Factory
 */
export function rateLimitMiddleware(config: RateLimitConfig = {}) {
  const {
    windowMs = 15 * 60 * 1000,
    max = 100,
    message = 'Too many requests, please try again later',
    statusCode = 429,
    headers = true,
    skipFailedRequests = false,
    skipSuccessfulRequests = false,
    keyGenerator = defaultKeyGenerator,
    skip,
    handler,
  } = config;

  return (req: Request, res: Response, next: NextFunction) => {
    // Skip if configured
    if (skip && skip(req)) {
      return next();
    }

    const key = keyGenerator(req);
    const { count, resetTime } = globalStore.increment(key, windowMs);

    // Calculate remaining time
    const remainingTime = Math.max(0, resetTime - Date.now());
    const remaining = Math.max(0, max - count);

    // Set rate limit headers
    if (headers) {
      res.setHeader('X-RateLimit-Limit', max.toString());
      res.setHeader('X-RateLimit-Remaining', remaining.toString());
      res.setHeader('X-RateLimit-Reset', new Date(resetTime).toISOString());
    }

    // Check if rate limit exceeded
    if (count > max) {
      if (headers) {
        res.setHeader('Retry-After', Math.ceil(remainingTime / 1000).toString());
      }

      if (handler) {
        return handler(req, res);
      }

      log.warn(`Rate limit exceeded for ${key}: ${count} requests`);

      return res.status(statusCode).json({
        success: false,
        error: 'Too Many Requests',
        message,
        retryAfter: Math.ceil(remainingTime / 1000),
      });
    }

    // Handle response finish to potentially decrement
    res.on('finish', () => {
      // Decrement if configured to skip certain responses
      if (skipFailedRequests && res.statusCode >= 400) {
        globalStore.decrement(key);
      }
      if (skipSuccessfulRequests && res.statusCode < 400) {
        globalStore.decrement(key);
      }
    });

    next();
  };
}

/**
 * Pre-configured rate limit middlewares
 */
export const apiRateLimit = rateLimitMiddleware(RATE_LIMITS.api);
export const strictRateLimit = rateLimitMiddleware(RATE_LIMITS.strict);
export const loginRateLimit = rateLimitMiddleware(RATE_LIMITS.login);
export const paymentRateLimit = rateLimitMiddleware(RATE_LIMITS.payment);
export const exportRateLimit = rateLimitMiddleware(RATE_LIMITS.export);
export const passwordResetRateLimit = rateLimitMiddleware(RATE_LIMITS.passwordReset);

/**
 * IP-based rate limit (no user context)
 */
export function ipRateLimit(config: RateLimitConfig = {}) {
  return rateLimitMiddleware({
    ...config,
    keyGenerator: (req) => getClientIp(req),
  });
}

/**
 * User-based rate limit (requires authentication)
 */
export function userRateLimit(config: RateLimitConfig = {}) {
  return rateLimitMiddleware({
    ...config,
    keyGenerator: (req) => req.user?.id || getClientIp(req),
  });
}

/**
 * Login attempt rate limit
 * Tracks failed login attempts separately
 */
export function loginAttemptRateLimit(maxAttempts: number = 5) {
  const failedAttempts = new Map<string, { count: number; blockedUntil: number }>();

  return (req: Request, res: Response, next: NextFunction) => {
    const ip = getClientIp(req);
    const key = `login:${ip}`;
    const now = Date.now();
    const blockDuration = 30 * 60 * 1000; // 30 minutes

    const attempt = failedAttempts.get(key);

    // Check if IP is blocked
    if (attempt && attempt.blockedUntil > now) {
      const remaining = Math.ceil((attempt.blockedUntil - now) / 1000);
      log.warn(`Login blocked for IP ${ip} for ${remaining} more seconds`);

      return res.status(429).json({
        success: false,
        error: 'Too Many Requests',
        message: `Too many failed login attempts. Please try again in ${Math.ceil(remaining / 60)} minutes.`,
        retryAfter: remaining,
      });
    }

    // Clear expired blocks
    if (attempt && attempt.blockedUntil <= now) {
      failedAttempts.delete(key);
    }

    // Track response to count failures
    const originalSend = res.send;
    res.send = function (this: Response, data: any): Response {
      // Check if login failed
      if (res.statusCode === 401 || res.statusCode === 403) {
        const current = failedAttempts.get(key) || { count: 0, blockedUntil: 0 };
        current.count++;

        if (current.count >= maxAttempts) {
          current.blockedUntil = now + blockDuration;
          log.warn(`Blocking IP ${ip} for 30 minutes after ${current.count} failed attempts`);
        }

        failedAttempts.set(key, current);
      }

      // Reset on successful login
      if (res.statusCode === 200) {
        failedAttempts.delete(key);
      }

      return originalSend.call(this, data);
    };

    next();
  };
}

/**
 * Sliding window rate limit
 * More accurate rate limiting using sliding window algorithm
 */
export function slidingWindowRateLimit(config: RateLimitConfig = {}) {
  const {
    windowMs = 15 * 60 * 1000,
    max = 100,
    message = 'Too many requests, please try again later',
    statusCode = 429,
    headers = true,
    keyGenerator = defaultKeyGenerator,
  } = config;

  const timestamps = new Map<string, number[]>();

  return (req: Request, res: Response, next: NextFunction) => {
    const key = keyGenerator(req);
    const now = Date.now();
    const windowStart = now - windowMs;

    // Get timestamps for this key
    let entries = timestamps.get(key) || [];

    // Filter out entries outside the window
    entries = entries.filter(ts => ts > windowStart);

    // Count requests in current window
    const count = entries.length;
    const remaining = Math.max(0, max - count);

    // Set rate limit headers
    if (headers) {
      res.setHeader('X-RateLimit-Limit', max.toString());
      res.setHeader('X-RateLimit-Remaining', remaining.toString());
      res.setHeader('X-RateLimit-Reset', new Date(now + windowMs).toISOString());
    }

    // Check if rate limit exceeded
    if (count >= max) {
      const oldestInWindow = entries[0];
      const retryAfter = Math.ceil((oldestInWindow + windowMs - now) / 1000);

      if (headers) {
        res.setHeader('Retry-After', retryAfter.toString());
      }

      log.warn(`Sliding window rate limit exceeded for ${key}: ${count} requests`);

      return res.status(statusCode).json({
        success: false,
        error: 'Too Many Requests',
        message,
        retryAfter,
      });
    }

    // Add current request timestamp
    entries.push(now);
    timestamps.set(key, entries);

    next();
  };
}

// Cleanup on process exit
process.on('SIGTERM', () => globalStore.close());
process.on('SIGINT', () => globalStore.close());

/**
 * Export rate limiters object for easy access
 */
export const rateLimiters = {
  api: apiRateLimit,
  strict: strictRateLimit,
  login: loginRateLimit,
  payment: paymentRateLimit,
  export: exportRateLimit,
  passwordReset: passwordResetRateLimit,
  ipRateLimit,
  userRateLimit,
  loginAttemptRateLimit,
  slidingWindowRateLimit,
};

export default rateLimitMiddleware;