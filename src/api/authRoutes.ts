/**
 * Authentication Routes
 * Handles user registration, login, logout, token refresh, and user info
 */

import { Router, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { AuthDAO, User } from '../database/auth.dao';
import { authMiddleware } from './authMiddleware';
import { createLogger } from '../utils/logger';
import { getPromoCodeDAO } from '../database/promo-code.dao';

const log = createLogger('AuthRoutes');

const router = Router();

// Configuration
function getRequiredEnvVar(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`FATAL: ${name} environment variable is required. Set it before starting the server.`);
  }
  return value;
}

const JWT_SECRET = getRequiredEnvVar('JWT_SECRET');
const JWT_EXPIRES_IN = '1h';
const REFRESH_TOKEN_EXPIRES_IN_DAYS = 7;
const BCRYPT_SALT_ROUNDS = 12;
const MAX_LOGIN_ATTEMPTS = 5;
const _LOCK_DURATION_MINUTES = 30;

// Rate limiting for login attempts (in-memory, should use Redis in production)
const loginAttempts = new Map<string, { count: number; lastAttempt: Date }>();
const LOGIN_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const MAX_LOGIN_RATE_LIMIT = 10; // Max 10 attempts per IP per 15 minutes

/**
 * Generate JWT access token
 */
function generateAccessToken(user: User): string {
  return jwt.sign(
    {
      userId: user.id,
      email: user.email,
      role: user.role,
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

/**
 * Generate refresh token
 */
function generateRefreshToken(): string {
  return crypto.randomBytes(64).toString('hex');
}

/**
 * Calculate refresh token expiration date
 */
function getRefreshTokenExpiration(): Date {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_EXPIRES_IN_DAYS);
  return expiresAt;
}

/**
 * Validate password strength
 */
function validatePasswordStrength(password: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (password.length < 8) {
    errors.push('Password must be at least 8 characters long');
  }
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }
  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }
  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validate email format
 */
function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate username format
 */
function validateUsername(username: string): { valid: boolean; error?: string } {
  if (username.length < 3) {
    return { valid: false, error: 'Username must be at least 3 characters long' };
  }
  if (username.length > 50) {
    return { valid: false, error: 'Username must be at most 50 characters long' };
  }
  if (!/^[a-zA-Z0-9_]+$/.test(username)) {
    return { valid: false, error: 'Username can only contain letters, numbers, and underscores' };
  }
  return { valid: true };
}

/**
 * Check rate limit for login attempts
 */
function checkLoginRateLimit(ip: string): { allowed: boolean; remainingAttempts: number } {
  const now = new Date();
  const attempts = loginAttempts.get(ip);

  if (!attempts) {
    return { allowed: true, remainingAttempts: MAX_LOGIN_RATE_LIMIT };
  }

  const windowStart = new Date(now.getTime() - LOGIN_RATE_LIMIT_WINDOW_MS);
  if (attempts.lastAttempt < windowStart) {
    loginAttempts.delete(ip);
    return { allowed: true, remainingAttempts: MAX_LOGIN_RATE_LIMIT };
  }

  if (attempts.count >= MAX_LOGIN_RATE_LIMIT) {
    return { allowed: false, remainingAttempts: 0 };
  }

  return { allowed: true, remainingAttempts: MAX_LOGIN_RATE_LIMIT - attempts.count };
}

/**
 * Record login attempt
 */
function recordLoginAttempt(ip: string): void {
  const now = new Date();
  const attempts = loginAttempts.get(ip);

  if (attempts) {
    attempts.count++;
    attempts.lastAttempt = now;
  } else {
    loginAttempts.set(ip, { count: 1, lastAttempt: now });
  }
}

/**
 * Sanitize user object for response
 */
function sanitizeUser(user: User): Partial<User> {
  return {
    id: user.id,
    email: user.email,
    username: user.username,
    email_verified: user.email_verified,
    role: user.role,
    created_at: user.created_at,
  };
}

/**
 * POST /api/auth/register
 * Register a new user
 */
router.post('/register', async (req: Request, res: Response) => {
  try {
    const { email, username, password } = req.body;

    // Validate required fields
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Email and password are required',
      });
    }

    // Validate email
    if (!validateEmail(email)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid email format',
      });
    }

    // Validate username if provided
    if (username) {
      const usernameValidation = validateUsername(username);
      if (!usernameValidation.valid) {
        return res.status(400).json({
          success: false,
          error: usernameValidation.error,
        });
      }
    }

    // Validate password strength
    const passwordValidation = validatePasswordStrength(password);
    if (!passwordValidation.valid) {
      return res.status(400).json({
        success: false,
        error: 'Password does not meet requirements',
        details: passwordValidation.errors,
      });
    }

    // Check if user already exists
    const existingUser = await AuthDAO.getUserByEmail(email);
    if (existingUser) {
      return res.status(409).json({
        success: false,
        error: 'Email already registered',
      });
    }

    // Check if username is taken
    if (username) {
      const existingUsername = await AuthDAO.getUserByUsername(username);
      if (existingUsername) {
        return res.status(409).json({
          success: false,
          error: 'Username already taken',
        });
      }
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);

    // Create user
    const user = await AuthDAO.createUser({
      email,
      username,
      password_hash: passwordHash,
    });

    log.info(`User registered: ${user.email}`);

    // Generate tokens
    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken();
    const expiresAt = getRefreshTokenExpiration();

    // Create session
    await AuthDAO.createSession({
      user_id: user.id,
      refresh_token: refreshToken,
      device_info: req.headers['user-agent'],
      ip_address: req.ip,
      user_agent: req.headers['user-agent'],
      expires_at: expiresAt,
    });

    // Start trial for new user
    try {
      const promoDao = getPromoCodeDAO();
      await promoDao.startTrial(user.id, 14, 'pro');
      log.info(`Trial started for new user: ${user.email}`);
    } catch (trialError) {
      log.warn(`Failed to start trial for user ${user.id}:`, trialError);
      // Don't fail registration if trial creation fails
    }

    res.status(201).json({
      success: true,
      data: {
        user: sanitizeUser(user),
        accessToken,
        refreshToken,
        expiresIn: JWT_EXPIRES_IN,
      },
    });
  } catch (error) {
    log.error('Registration error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to register user',
    });
  }
});

/**
 * POST /api/auth/login
 * Login with email/username and password
 */
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { identifier, password } = req.body; // identifier can be email or username

    // Validate required fields
    if (!identifier || !password) {
      return res.status(400).json({
        success: false,
        error: 'Identifier and password are required',
      });
    }

    // Check rate limit
    const clientIp = req.ip || 'unknown';
    const rateLimit = checkLoginRateLimit(clientIp);
    if (!rateLimit.allowed) {
      return res.status(429).json({
        success: false,
        error: 'Too many login attempts. Please try again later.',
      });
    }

    // Find user by email or username
    const user = await AuthDAO.getUserByIdentifier(identifier);
    if (!user) {
      recordLoginAttempt(clientIp);
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials',
      });
    }

    // Check if account is locked
    if (user.locked_until && new Date(user.locked_until) > new Date()) {
      return res.status(403).json({
        success: false,
        error: 'Account is temporarily locked due to too many failed login attempts',
      });
    }

    // Check if user is active
    if (!user.is_active) {
      return res.status(403).json({
        success: false,
        error: 'Account is disabled',
      });
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      recordLoginAttempt(clientIp);
      
      // Increment failed login attempts
      const attempts = await AuthDAO.recordFailedLogin(user.id);
      
      if (attempts >= MAX_LOGIN_ATTEMPTS) {
        log.warn(`Account locked for user: ${user.email}`);
        return res.status(403).json({
          success: false,
          error: 'Account locked due to too many failed login attempts. Please try again later.',
        });
      }

      return res.status(401).json({
        success: false,
        error: 'Invalid credentials',
        remainingAttempts: MAX_LOGIN_ATTEMPTS - attempts,
      });
    }

    // Record successful login
    await AuthDAO.recordSuccessfulLogin(user.id);

    // Generate tokens
    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken();
    const expiresAt = getRefreshTokenExpiration();

    // Create session
    await AuthDAO.createSession({
      user_id: user.id,
      refresh_token: refreshToken,
      device_info: req.headers['user-agent'],
      ip_address: req.ip,
      user_agent: req.headers['user-agent'],
      expires_at: expiresAt,
    });

    log.info(`User logged in: ${user.email}`);

    res.json({
      success: true,
      data: {
        user: sanitizeUser(user),
        accessToken,
        refreshToken,
        expiresIn: JWT_EXPIRES_IN,
      },
    });
  } catch (error) {
    log.error('Login error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to login',
    });
  }
});

/**
 * POST /api/auth/logout
 * Logout user by invalidating refresh token
 */
router.post('/logout', async (req: Request, res: Response) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({
        success: false,
        error: 'Refresh token is required',
      });
    }

    // Delete session
    await AuthDAO.deleteSession(refreshToken);

    res.json({
      success: true,
      message: 'Logged out successfully',
    });
  } catch (error) {
    log.error('Logout error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to logout',
    });
  }
});

/**
 * POST /api/auth/refresh
 * Refresh access token using refresh token
 */
router.post('/refresh', async (req: Request, res: Response) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({
        success: false,
        error: 'Refresh token is required',
      });
    }

    // Find session
    const session = await AuthDAO.getSessionByRefreshToken(refreshToken);
    if (!session) {
      return res.status(401).json({
        success: false,
        error: 'Invalid refresh token',
      });
    }

    // Check if refresh token is expired
    if (new Date(session.expires_at) < new Date()) {
      await AuthDAO.deleteSession(refreshToken);
      return res.status(401).json({
        success: false,
        error: 'Refresh token expired',
      });
    }

    // Get user
    const user = await AuthDAO.getUserById(session.user_id);
    if (!user || !user.is_active) {
      await AuthDAO.deleteSession(refreshToken);
      return res.status(401).json({
        success: false,
        error: 'User not found or inactive',
      });
    }

    // Generate new access token
    const accessToken = generateAccessToken(user);

    // Update session last used
    await AuthDAO.updateSessionLastUsed(refreshToken);

    res.json({
      success: true,
      data: {
        accessToken,
        expiresIn: JWT_EXPIRES_IN,
      },
    });
  } catch (error) {
    log.error('Token refresh error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to refresh token',
    });
  }
});

/**
 * GET /api/auth/me
 * Get current user info
 */
router.get('/me', authMiddleware, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Not authenticated',
      });
    }

    const user = await AuthDAO.getUserById(req.user.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
      });
    }

    res.json({
      success: true,
      data: sanitizeUser(user),
    });
  } catch (error) {
    log.error('Get user info error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get user info',
    });
  }
});

/**
 * PUT /api/auth/password
 * Change password
 */
router.put('/password', authMiddleware, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Not authenticated',
      });
    }

    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        error: 'Current password and new password are required',
      });
    }

    // Validate new password strength
    const passwordValidation = validatePasswordStrength(newPassword);
    if (!passwordValidation.valid) {
      return res.status(400).json({
        success: false,
        error: 'New password does not meet requirements',
        details: passwordValidation.errors,
      });
    }

    // Get user
    const user = await AuthDAO.getUserById(req.user.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
      });
    }

    // Verify current password
    const isValidPassword = await bcrypt.compare(currentPassword, user.password_hash);
    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        error: 'Current password is incorrect',
      });
    }

    // Hash new password
    const passwordHash = await bcrypt.hash(newPassword, BCRYPT_SALT_ROUNDS);

    // Update password
    await AuthDAO.updatePassword(user.id, passwordHash);

    // Invalidate all sessions except current
    // (In a real app, you'd track the current session and exclude it)
    await AuthDAO.deleteAllUserSessions(user.id);

    log.info(`Password changed for user: ${user.email}`);

    res.json({
      success: true,
      message: 'Password changed successfully. Please login again.',
    });
  } catch (error) {
    log.error('Password change error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to change password',
    });
  }
});

/**
 * POST /api/auth/logout-all
 * Logout from all devices
 */
router.post('/logout-all', authMiddleware, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Not authenticated',
      });
    }

    await AuthDAO.deleteAllUserSessions(req.user.id);

    res.json({
      success: true,
      message: 'Logged out from all devices',
    });
  } catch (error) {
    log.error('Logout all error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to logout from all devices',
    });
  }
});

export default router;
