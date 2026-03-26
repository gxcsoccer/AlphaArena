/**
 * Audit Middleware
 * Issue #641: Security Audit - API Permissions, Data Access Logging
 *
 * Logs all API access for security auditing and compliance.
 */

import { Request, Response, NextFunction } from 'express';
import { AuditDAO, SENSITIVE_ACTIONS } from '../database/audit.dao';
import { createLogger } from '../utils/logger';

const log = createLogger('AuditMiddleware');

/**
 * Paths to exclude from audit logging
 */
const EXCLUDED_PATHS = [
  '/health',
  '/metrics',
  '/docs',
  '/favicon.ico',
  '/api/health',
];

/**
 * Paths that are sensitive and should always be logged with more detail
 */
const SENSITIVE_PATH_PATTERNS = [
  /\/api\/auth\//,
  /\/api\/payments\//,
  /\/api\/subscriptions\//,
  /\/api\/keys\//,
  /\/api\/admin\//,
  /\/api\/user\/preferences/,
];

/**
 * Request context for audit logging
 */
interface AuditContext {
  startTime: number;
  requestId?: string;
}

/**
 * Extend Express Request to include audit context
 */
declare module 'express' {
  interface Request {
    auditContext?: AuditContext;
    auditAction?: string;
    auditOptions?: {
      resourceType?: string;
      riskLevel?: 'low' | 'medium' | 'high' | 'critical';
    };
  }
}

/**
 * Check if path should be excluded from audit logging
 */
function shouldExclude(path: string): boolean {
  return EXCLUDED_PATHS.some(excluded => path.startsWith(excluded));
}

/**
 * Check if path is sensitive
 */
function isSensitivePath(path: string): boolean {
  return SENSITIVE_PATH_PATTERNS.some(pattern => pattern.test(path));
}

/**
 * Determine action category based on request path
 */
function categorizeAction(path: string, method: string): string {
  if (path.includes('/auth/')) return 'auth';
  if (path.includes('/payments/')) return 'payment';
  if (path.includes('/subscriptions/')) return 'subscription';
  if (path.includes('/export/')) return 'export';
  if (path.includes('/admin/')) return 'admin';
  if (method === 'DELETE') return 'security';
  return 'data_access';
}

/**
 * Determine risk level based on action and status
 */
function determineRiskLevel(
  action: string,
  statusCode: number,
  path: string
): 'low' | 'medium' | 'high' | 'critical' {
  // Critical actions
  if (action.includes('admin_role_change') || action.includes('mfa_disabled')) {
    return 'critical';
  }

  // High risk actions
  if (
    action.includes('password_change') ||
    action.includes('subscription_cancel') ||
    action.includes('refund') ||
    action.includes('data_delete')
  ) {
    return 'high';
  }

  // Failed auth attempts
  if (action.includes('login') && statusCode >= 400) {
    return 'medium';
  }

  // Failed requests on sensitive paths
  if (isSensitivePath(path) && statusCode >= 400) {
    return 'medium';
  }

  return 'low';
}

/**
 * Extract action name from request
 */
function extractAction(method: string, path: string): string {
  // Extract meaningful action name from path
  const pathParts = path.split('/').filter(Boolean);
  const resource = pathParts[1] || 'unknown';
  const action = pathParts[2] || 'list';

  // Map HTTP methods to actions
  const methodActions: Record<string, string> = {
    GET: action === 'list' ? `${resource}_list` : `${resource}_view`,
    POST: `${resource}_create`,
    PUT: `${resource}_update`,
    PATCH: `${resource}_update`,
    DELETE: `${resource}_delete`,
  };

  return methodActions[method] || `${resource}_${method.toLowerCase()}`;
}

/**
 * Extract resource info from request
 */
function extractResourceInfo(
  req: Request
): { resourceType?: string; resourceId?: string; resourceOwnerId?: string } {
  const pathParts = req.path.split('/').filter(Boolean);

  // Common patterns:
  // /api/users/:userId/...
  // /api/strategies/:strategyId/...
  // /api/subscriptions/:subscriptionId/...
  if (pathParts.length >= 3) {
    const resourceType = pathParts[1]?.replace(/s$/, ''); // Remove plural s
    const resourceId = pathParts[2];

    // Check for owner ID in params or body
    const resourceOwnerId =
      req.params?.userId ||
      req.body?.userId ||
      req.body?.ownerId;

    return {
      resourceType: resourceType || undefined,
      resourceId: resourceId && !resourceId.match(/^\d+$/) ? resourceId : undefined,
      resourceOwnerId: resourceOwnerId,
    };
  }

  return {};
}

/**
 * Get client IP address
 */
function getClientIp(req: Request): string | undefined {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }
  if (Array.isArray(forwarded)) {
    return forwarded[0].trim();
  }
  return req.socket?.remoteAddress || undefined;
}

/**
 * Sanitize request params for logging (remove sensitive data)
 */
function sanitizeParams(params: Record<string, any>): Record<string, any> {
  const sensitiveKeys = ['password', 'token', 'secret', 'apiKey', 'credit_card', 'cvv'];
  const sanitized: Record<string, any> = {};

  for (const [key, value] of Object.entries(params)) {
    if (sensitiveKeys.some(sk => key.toLowerCase().includes(sk))) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeParams(value);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

/**
 * Audit Middleware
 * Logs all API access for security auditing
 */
export function auditMiddleware() {
  return async (req: Request, res: Response, next: NextFunction) => {
    // Skip excluded paths
    if (shouldExclude(req.path)) {
      return next();
    }

    // Initialize audit context
    req.auditContext = {
      startTime: Date.now(),
      requestId: req.headers['x-request-id'] as string,
    };

    // Log after response is finished
    res.on('finish', () => {
      const responseTime = Date.now() - (req.auditContext?.startTime || Date.now());

      // Log the audit event asynchronously (don't block response)
      setImmediate(async () => {
        try {
          await logAuditEvent(req, res, responseTime);
        } catch (error) {
          log.error('Failed to log audit event:', error);
        }
      });
    });

    next();
  };
}

/**
 * Log audit event to database
 */
async function logAuditEvent(
  req: Request,
  res: Response,
  responseTime: number
): Promise<void> {
  try {
    const method = req.method;
    const path = req.path;
    const statusCode = res.statusCode;

    // Skip successful health checks and static assets
    if (shouldExclude(path) && statusCode < 400) {
      return;
    }

    const user = req.user;
    const action = extractAction(method, path);
    const resourceInfo = extractResourceInfo(req);

    // Determine action category and risk
    const actionCategory = categorizeAction(path, method) as any;
    const riskLevel = determineRiskLevel(action, statusCode, path);
    const isSensitive = isSensitivePath(path) || !!SENSITIVE_ACTIONS[action];

    // Build audit log entry
    await AuditDAO.createAuditLog({
      user_id: user?.id,
      user_email: user?.email,
      user_role: user?.role,
      action: action,
      action_category: actionCategory,
      resource_type: resourceInfo.resourceType,
      resource_id: resourceInfo.resourceId,
      resource_owner_id: resourceInfo.resourceOwnerId,
      ip_address: getClientIp(req),
      user_agent: req.headers['user-agent'],
      request_method: method,
      request_path: path,
      request_params: sanitizeParams({ ...req.query, ...req.body }),
      request_id: req.auditContext?.requestId,
      response_status: statusCode,
      response_time_ms: responseTime,
      is_sensitive: isSensitive,
      risk_level: riskLevel,
    });
  } catch (error) {
    log.error('Error logging audit event:', error);
  }
}

/**
 * Log a specific sensitive action (useful for non-HTTP events)
 */
export async function logSensitiveAction(
  action: string,
  context: {
    userId?: string;
    userEmail?: string;
    userRole?: string;
    resourceType?: string;
    resourceId?: string;
    resourceOwnerId?: string;
    ipAddress?: string;
    userAgent?: string;
    metadata?: Record<string, any>;
    riskLevel?: 'low' | 'medium' | 'high' | 'critical';
  }
): Promise<string> {
  const actionConfig = SENSITIVE_ACTIONS[action];

  return AuditDAO.createAuditLog({
    user_id: context.userId,
    user_email: context.userEmail,
    user_role: context.userRole,
    action: action,
    action_category: actionConfig?.category || 'security',
    resource_type: context.resourceType,
    resource_id: context.resourceId,
    resource_owner_id: context.resourceOwnerId,
    ip_address: context.ipAddress,
    user_agent: context.userAgent,
    metadata: context.metadata,
    is_sensitive: true,
    risk_level: context.riskLevel || actionConfig?.risk_level || 'medium',
  });
}

/**
 * Audit middleware for specific routes with custom action name
 */
export function auditAction(action: string, options?: {
  resourceType?: string;
  riskLevel?: 'low' | 'medium' | 'high' | 'critical';
}) {
  return async (req: Request, res: Response, next: NextFunction) => {
    // Store action for later use
    req.auditAction = action;
    req.auditOptions = options;

    // Initialize audit context
    req.auditContext = {
      startTime: Date.now(),
      requestId: req.headers['x-request-id'] as string,
    };

    // Log after response is finished
    res.on('finish', () => {
      const responseTime = Date.now() - (req.auditContext?.startTime || Date.now());

      // Log the audit event asynchronously
      setImmediate(async () => {
        try {
          const user = req.user;
          const resourceInfo = extractResourceInfo(req);
          const actionConfig = SENSITIVE_ACTIONS[action];

          await AuditDAO.createAuditLog({
            user_id: user?.id,
            user_email: user?.email,
            user_role: user?.role,
            action: action,
            action_category: actionConfig?.category || 'data_access',
            resource_type: options?.resourceType || resourceInfo.resourceType,
            resource_id: resourceInfo.resourceId,
            resource_owner_id: resourceInfo.resourceOwnerId,
            ip_address: getClientIp(req),
            user_agent: req.headers['user-agent'],
            request_method: req.method,
            request_path: req.path,
            request_params: sanitizeParams({ ...req.query, ...req.body }),
            request_id: req.auditContext?.requestId,
            response_status: res.statusCode,
            response_time_ms: responseTime,
            is_sensitive: true,
            risk_level: options?.riskLevel || actionConfig?.risk_level || 'medium',
          });
        } catch (error) {
          log.error('Error logging audit event:', error);
        }
      });
    });

    next();
  };
}

export default auditMiddleware;