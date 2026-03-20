/**
 * API Key Authentication Middleware
 *
 * Provides authentication and rate limiting for external API access
 */

import { Request, Response, NextFunction } from 'express';
import { hashApiKey, ApiKeyPermission } from './apiKeyTypes';
import * as ApiKeyDao from './apiKeyDao';
import { createLogger } from '../utils/logger';

const log = createLogger('ApiKeyMiddleware');

/**
 * API key user context attached to authenticated requests
 */
export interface ApiKeyUser {
  id: string;
  keyId: string;
  permission: ApiKeyPermission;
  rateLimit: {
    remainingMinute: number;
    remainingDay: number;
    resetAtMinute: Date;
    resetAtDay: Date;
  };
}

/**
 * Extend Express Request to include API key user
 */
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      apiKeyUser?: ApiKeyUser;
    }
  }
}

/**
 * Permission levels hierarchy
 */
const PERMISSION_HIERARCHY: Record<ApiKeyPermission, number> = {
  read: 1,
  trade: 2,
  admin: 3,
};

/**
 * Check if permission satisfies required level
 */
function hasPermission(userPermission: ApiKeyPermission, requiredPermission: ApiKeyPermission): boolean {
  return PERMISSION_HIERARCHY[userPermission] >= PERMISSION_HIERARCHY[requiredPermission];
}

/**
 * API Key authentication middleware
 * Validates API key from X-API-Key header
 */
export async function apiKeyAuthMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const apiKeyHeader = req.headers['x-api-key'];

    if (!apiKeyHeader || typeof apiKeyHeader !== 'string') {
      res.status(401).json({
        success: false,
        error: 'Missing X-API-Key header',
        code: 'MISSING_API_KEY',
      });
      return;
    }

    // Hash the provided key to look it up
    const keyHash = await hashApiKey(apiKeyHeader);
    const apiKey = await ApiKeyDao.getApiKeyByHash(keyHash);

    if (!apiKey) {
      log.warn('Invalid API key attempt', { keyPrefix: apiKeyHeader.substring(0, 12) + '...' });
      res.status(401).json({
        success: false,
        error: 'Invalid API key',
        code: 'INVALID_API_KEY',
      });
      return;
    }

    // Check if key is active
    if (apiKey.status !== 'active') {
      res.status(401).json({
        success: false,
        error: 'API key is not active',
        code: 'API_KEY_INACTIVE',
      });
      return;
    }

    // Check if key is expired
    if (apiKey.expiresAt && new Date() > apiKey.expiresAt) {
      res.status(401).json({
        success: false,
        error: 'API key has expired',
        code: 'API_KEY_EXPIRED',
      });
      return;
    }

    // Check IP whitelist
    if (apiKey.ipWhitelist && apiKey.ipWhitelist.length > 0) {
      const clientIp = req.ip || req.headers['x-forwarded-for'] as string;
      if (!clientIp || !apiKey.ipWhitelist.includes(clientIp)) {
        log.warn('IP not whitelisted', { keyId: apiKey.id, clientIp });
        res.status(403).json({
          success: false,
          error: 'IP address not whitelisted',
          code: 'IP_NOT_WHITELISTED',
        });
        return;
      }
    }

    // Check rate limit
    const rateLimit = await ApiKeyDao.checkRateLimit(apiKey.id);
    if (!rateLimit.allowed) {
      res.status(429).json({
        success: false,
        error: 'Rate limit exceeded',
        code: 'RATE_LIMIT_EXCEEDED',
        retryAfter: rateLimit.resetAtMinute,
        rateLimit: {
          limit: apiKey.rateLimitPerMinute,
          remaining: 0,
          resetAt: rateLimit.resetAtMinute,
        },
      });
      return;
    }

    // Check allowed endpoints
    if (apiKey.allowedEndpoints && apiKey.allowedEndpoints.length > 0) {
      const endpoint = req.path;
      const isAllowed = apiKey.allowedEndpoints.some(allowed => 
        endpoint.startsWith(allowed) || endpoint === allowed
      );
      if (!isAllowed) {
        res.status(403).json({
          success: false,
          error: 'Endpoint not allowed for this API key',
          code: 'ENDPOINT_NOT_ALLOWED',
        });
        return;
      }
    }

    // Attach user context to request
    req.apiKeyUser = {
      id: apiKey.userId,
      keyId: apiKey.id,
      permission: apiKey.permission,
      rateLimit: {
        remainingMinute: rateLimit.remainingMinute,
        remainingDay: rateLimit.remainingDay,
        resetAtMinute: rateLimit.resetAtMinute,
        resetAtDay: rateLimit.resetAtDay,
      },
    };

    // Add rate limit headers
    res.set('X-RateLimit-Limit-Minute', apiKey.rateLimitPerMinute.toString());
    res.set('X-RateLimit-Remaining-Minute', rateLimit.remainingMinute.toString());
    res.set('X-RateLimit-Limit-Day', apiKey.rateLimitPerDay.toString());
    res.set('X-RateLimit-Remaining-Day', rateLimit.remainingDay.toString());
    res.set('X-RateLimit-Reset-Minute', rateLimit.resetAtMinute.toISOString());
    res.set('X-RateLimit-Reset-Day', rateLimit.resetAtDay.toISOString());

    // Record usage after response
    res.on('finish', () => {
      ApiKeyDao.recordApiKeyUsage(apiKey.id, req.path, res.statusCode < 400);
    });

    next();
  } catch (error) {
    log.error('API key auth error:', error);
    res.status(500).json({
      success: false,
      error: 'Authentication failed',
      code: 'AUTH_ERROR',
    });
  }
}

/**
 * Require specific permission level
 */
export function requireApiPermission(requiredPermission: ApiKeyPermission) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.apiKeyUser) {
      res.status(401).json({
        success: false,
        error: 'API key authentication required',
        code: 'AUTH_REQUIRED',
      });
      return;
    }

    if (!hasPermission(req.apiKeyUser.permission, requiredPermission)) {
      res.status(403).json({
        success: false,
        error: `Requires ${requiredPermission} permission`,
        code: 'INSUFFICIENT_PERMISSION',
        currentPermission: req.apiKeyUser.permission,
        requiredPermission,
      });
      return;
    }

    next();
  };
}

/**
 * Optional API key authentication
 * Attaches user if key is present, but doesn't require it
 */
export async function optionalApiKeyAuthMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const apiKeyHeader = req.headers['x-api-key'];

    if (!apiKeyHeader || typeof apiKeyHeader !== 'string') {
      next();
      return;
    }

    // Same logic as required auth, but don't block if invalid
    const keyHash = await hashApiKey(apiKeyHeader);
    const apiKey = await ApiKeyDao.getApiKeyByHash(keyHash);

    if (!apiKey || apiKey.status !== 'active') {
      next();
      return;
    }

    if (apiKey.expiresAt && new Date() > apiKey.expiresAt) {
      next();
      return;
    }

    const rateLimit = await ApiKeyDao.checkRateLimit(apiKey.id);
    if (!rateLimit.allowed) {
      next();
      return;
    }

    req.apiKeyUser = {
      id: apiKey.userId,
      keyId: apiKey.id,
      permission: apiKey.permission,
      rateLimit: {
        remainingMinute: rateLimit.remainingMinute,
        remainingDay: rateLimit.remainingDay,
        resetAtMinute: rateLimit.resetAtMinute,
        resetAtDay: rateLimit.resetAtDay,
      },
    };

    res.on('finish', () => {
      ApiKeyDao.recordApiKeyUsage(apiKey.id, req.path, res.statusCode < 400);
    });

    next();
  } catch (_error) {
    // Continue without user on error
    next();
  }
}

/**
 * Combined auth middleware - supports both JWT and API key
 * JWT takes precedence if both are present
 */
export async function combinedAuthMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;
  const apiKeyHeader = req.headers['x-api-key'];

  // If JWT auth is present, use that (import authMiddleware)
  if (authHeader && authHeader.startsWith('Bearer ')) {
    // Dynamically import to avoid circular dependency
    const { authMiddleware } = await import('./authMiddleware');
    return authMiddleware(req, res, next);
  }

  // Otherwise use API key auth
  if (apiKeyHeader) {
    return apiKeyAuthMiddleware(req, res, next);
  }

  // No auth provided
  res.status(401).json({
    success: false,
    error: 'Authentication required (JWT or API key)',
    code: 'AUTH_REQUIRED',
  });
}

export default apiKeyAuthMiddleware;
