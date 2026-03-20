/**
 * Authentication Middleware for Leaderboard Routes
 * Provides authentication and authorization for API endpoints
 */

import { Request, Response, NextFunction } from 'express';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { createLogger } from '../utils/logger';

const log = createLogger('AuthMiddleware');

/**
 * User context attached to authenticated requests
 */
export interface AuthUser {
  id: string;
  email?: string;
  role?: string;
}

/**
 * Extend Express Request to include user
 */
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

/**
 * Get Supabase client for auth verification
 */
function getSupabaseAuthClient(): SupabaseClient {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing Supabase credentials for auth');
  }

  return createClient(supabaseUrl, supabaseKey);
}

/**
 * Authentication middleware
 * Verifies JWT token from Authorization header
 */
export async function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        success: false,
        error: 'Missing or invalid authorization header',
      });
      return;
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    const supabase = getSupabaseAuthClient();

    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      log.warn('Auth failed:', error?.message);
      res.status(401).json({
        success: false,
        error: 'Invalid or expired token',
      });
      return;
    }

    // Attach user to request
    req.user = {
      id: user.id,
      email: user.email,
      role: user.user_metadata?.role || 'user',
    };

    next();
  } catch (error) {
    log.error('Auth middleware error:', error);
    res.status(500).json({
      success: false,
      error: 'Authentication failed',
    });
  }
}

/**
 * Optional authentication middleware
 * Attaches user if token is present, but doesn't require it
 */
export async function optionalAuthMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      // No token, continue without user
      next();
      return;
    }

    const token = authHeader.substring(7);
    const supabase = getSupabaseAuthClient();

    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (!error && user) {
      req.user = {
        id: user.id,
        email: user.email,
        role: user.user_metadata?.role || 'user',
      };
    }

    next();
  } catch (_error) {
    // Continue without user on error
    next();
  }
}

/**
 * Authorization middleware - require specific role
 */
export function requireRole(role: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
      return;
    }

    if (req.user.role !== role && req.user.role !== 'admin') {
      res.status(403).json({
        success: false,
        error: 'Insufficient permissions',
      });
      return;
    }

    next();
  };
}

/**
 * Resource ownership middleware
 * Ensures the authenticated user owns the resource
 */
export function requireOwnership(userIdParam: string = 'userId') {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
      return;
    }

    const resourceUserId = req.params[userIdParam] || req.body[userIdParam];

    if (resourceUserId && resourceUserId !== req.user.id) {
      res.status(403).json({
        success: false,
        error: 'You can only access your own resources',
      });
      return;
    }

    next();
  };
}

/**
 * Validation that user ID in body matches authenticated user
 */
export function validateUserOwnership(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (!req.user) {
    res.status(401).json({
      success: false,
      error: 'Authentication required',
    });
    return;
  }

  const bodyUserId = req.body.userId || req.body.followerId;

  if (bodyUserId && bodyUserId !== req.user.id) {
    res.status(403).json({
      success: false,
      error: 'User ID must match authenticated user',
    });
    return;
  }

  next();
}

/**
 * Admin authorization middleware
 * Requires the authenticated user to have admin role
 * Must be used after authMiddleware
 */
export function requireAdmin(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (!req.user) {
    res.status(401).json({
      success: false,
      error: 'Authentication required',
    });
    return;
  }

  if (req.user.role !== 'admin') {
    res.status(403).json({
      success: false,
      error: 'Admin access required',
    });
    return;
  }

  next();
}

export default authMiddleware;
