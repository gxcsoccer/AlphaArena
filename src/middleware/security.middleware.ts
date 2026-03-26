/**
 * Security Headers Middleware
 * Issue #641: Security Audit - API Permissions, Data Access Logging
 *
 * Applies security headers to all responses for protection against
 * common web vulnerabilities.
 */

import { Request, Response, NextFunction } from 'express';
import { createLogger } from '../utils/logger';

const log = createLogger('SecurityMiddleware');

/**
 * Security headers configuration
 */
interface SecurityHeadersConfig {
  contentSecurityPolicy?: boolean | string;
  hsts?: boolean;
  hstsMaxAge?: number;
  hstsIncludeSubDomains?: boolean;
  hstsPreload?: boolean;
  xFrameOptions?: 'DENY' | 'SAMEORIGIN' | false;
  xContentTypeOptions?: boolean;
  xXssProtection?: boolean;
  referrerPolicy?: string;
  permissionsPolicy?: string;
}

/**
 * Default security headers configuration
 */
const defaultConfig: SecurityHeadersConfig = {
  contentSecurityPolicy: true,
  hsts: true,
  hstsMaxAge: 31536000, // 1 year
  hstsIncludeSubDomains: true,
  hstsPreload: false,
  xFrameOptions: 'SAMEORIGIN',
  xContentTypeOptions: true,
  xXssProtection: true,
  referrerPolicy: 'strict-origin-when-cross-origin',
  permissionsPolicy: "geolocation=(), microphone=(), camera=()",
};

/**
 * Content Security Policy directives for API
 */
const cspDirectives = {
  'default-src': ["'self'"],
  'script-src': ["'self'"],
  'style-src': ["'self'", "'unsafe-inline'"],
  'img-src': ["'self'", 'data:', 'https:'],
  'font-src': ["'self'"],
  'connect-src': ["'self'", 'https://api.supabase.io', 'wss://realtime.supabase.io'],
  'frame-ancestors': ["'self'"],
  'base-uri': ["'self'"],
  'form-action': ["'self'"],
};

/**
 * Build CSP header value
 */
function buildCSP(directives: Record<string, string[]>): string {
  return Object.entries(directives)
    .map(([directive, sources]) => `${directive} ${sources.join(' ')}`)
    .join('; ');
}

/**
 * Security Headers Middleware
 * Adds security-related headers to all responses
 */
export function securityHeadersMiddleware(config: SecurityHeadersConfig = {}) {
  const finalConfig = { ...defaultConfig, ...config };

  return (req: Request, res: Response, next: NextFunction) => {
    // Content Security Policy
    if (finalConfig.contentSecurityPolicy) {
      const cspValue = typeof finalConfig.contentSecurityPolicy === 'string'
        ? finalConfig.contentSecurityPolicy
        : buildCSP(cspDirectives);
      res.setHeader('Content-Security-Policy', cspValue);
    }

    // HTTP Strict Transport Security (HSTS)
    if (finalConfig.hsts) {
      let hstsValue = `max-age=${finalConfig.hstsMaxAge}`;
      if (finalConfig.hstsIncludeSubDomains) {
        hstsValue += '; includeSubDomains';
      }
      if (finalConfig.hstsPreload) {
        hstsValue += '; preload';
      }
      res.setHeader('Strict-Transport-Security', hstsValue);
    }

    // X-Frame-Options (Clickjacking protection)
    if (finalConfig.xFrameOptions) {
      res.setHeader('X-Frame-Options', finalConfig.xFrameOptions);
    }

    // X-Content-Type-Options (MIME sniffing protection)
    if (finalConfig.xContentTypeOptions) {
      res.setHeader('X-Content-Type-Options', 'nosniff');
    }

    // X-XSS-Protection (XSS filter for legacy browsers)
    if (finalConfig.xXssProtection) {
      res.setHeader('X-XSS-Protection', '1; mode=block');
    }

    // Referrer Policy
    if (finalConfig.referrerPolicy) {
      res.setHeader('Referrer-Policy', finalConfig.referrerPolicy);
    }

    // Permissions Policy (formerly Feature Policy)
    if (finalConfig.permissionsPolicy) {
      res.setHeader('Permissions-Policy', finalConfig.permissionsPolicy);
    }

    // Cache Control for API responses
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Surrogate-Control', 'no-store');

    // Remove server identification
    res.removeHeader('X-Powered-By');

    next();
  };
}

/**
 * CORS Preflight Security
 * Additional security for CORS preflight requests
 */
export function corsPreflightSecurity(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // For preflight requests, add additional headers
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Max-Age', '86400'); // 24 hours
  }
  next();
}

/**
 * IP Whitelist Middleware
 * Restricts access to specific IP addresses
 */
export function ipWhitelistMiddleware(allowedIps: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const clientIp = getClientIp(req);

    if (!clientIp) {
      log.warn('Request without IP address');
      return res.status(403).json({
        success: false,
        error: 'Access denied',
      });
    }

    // Allow localhost for development
    if (clientIp === '::1' || clientIp === '127.0.0.1') {
      return next();
    }

    // Check whitelist
    const isAllowed = allowedIps.some(allowed => {
      // Support CIDR notation (simplified)
      if (allowed.includes('/')) {
        return clientIp.startsWith(allowed.split('/')[0].split('.').slice(0, 3).join('.'));
      }
      return clientIp === allowed || clientIp.endsWith(allowed);
    });

    if (!isAllowed) {
      log.warn(`IP ${clientIp} not in whitelist`);
      return res.status(403).json({
        success: false,
        error: 'Access denied',
      });
    }

    next();
  };
}

/**
 * Request Size Limit Middleware
 * Validates request body size
 */
export function requestSizeLimit(maxSizeBytes: number = 10 * 1024 * 1024) {
  return (req: Request, res: Response, next: NextFunction) => {
    const contentLength = parseInt(req.headers['content-length'] || '0', 10);

    if (contentLength > maxSizeBytes) {
      log.warn(`Request too large: ${contentLength} bytes (max: ${maxSizeBytes})`);
      return res.status(413).json({
        success: false,
        error: 'Request entity too large',
      });
    }

    next();
  };
}

/**
 * No Sniff Middleware
 * Prevents browsers from MIME-sniffing a response
 */
export function noSniffMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  next();
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

export default securityHeadersMiddleware;