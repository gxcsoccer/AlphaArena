/**
 * Authentication Data Access Object
 * Handles database operations for user authentication
 */

import { getSupabaseClient } from './client';
import { createLogger } from '../utils/logger';

const log = createLogger('AuthDAO');

export interface User {
  id: string;
  email: string;
  username?: string;
  password_hash: string;
  email_verified: boolean;
  is_active: boolean;
  role: string;
  last_login_at?: Date;
  login_count: number;
  failed_login_attempts: number;
  locked_until?: Date;
  metadata?: Record<string, any>;
  created_at: Date;
  updated_at: Date;
}

export interface Session {
  id: string;
  user_id: string;
  refresh_token: string;
  device_info?: string;
  ip_address?: string;
  user_agent?: string;
  expires_at: Date;
  created_at: Date;
  last_used_at: Date;
}

export interface PasswordResetToken {
  id: string;
  user_id: string;
  token: string;
  expires_at: Date;
  used_at?: Date;
  created_at: Date;
}

export interface EmailVerificationToken {
  id: string;
  user_id: string;
  token: string;
  email: string;
  expires_at: Date;
  used_at?: Date;
  created_at: Date;
}

export interface CreateUserData {
  email: string;
  username?: string;
  password_hash: string;
  role?: string;
  metadata?: Record<string, any>;
}

export interface CreateSessionData {
  user_id: string;
  refresh_token: string;
  device_info?: string;
  ip_address?: string;
  user_agent?: string;
  expires_at: Date;
}

export class AuthDAO {
  /**
   * Create a new user
   */
  static async createUser(data: CreateUserData): Promise<User> {
    const supabase = getSupabaseClient();
    
    const { data: user, error } = await supabase
      .from('app_users')
      .insert({
        email: data.email.toLowerCase(),
        username: data.username?.toLowerCase(),
        password_hash: data.password_hash,
        role: data.role || 'user',
        metadata: data.metadata || {},
      })
      .select()
      .single();

    if (error) {
      log.error('Error creating user:', error);
      throw new Error(`Failed to create user: ${error.message}`);
    }

    return user;
  }

  /**
   * Get user by ID
   */
  static async getUserById(id: string): Promise<User | null> {
    const supabase = getSupabaseClient();
    
    const { data: user, error } = await supabase
      .from('app_users')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // Not found
      log.error('Error getting user by ID:', error);
      throw new Error(`Failed to get user: ${error.message}`);
    }

    return user;
  }

  /**
   * Get user by email
   */
  static async getUserByEmail(email: string): Promise<User | null> {
    const supabase = getSupabaseClient();
    
    const { data: user, error } = await supabase
      .from('app_users')
      .select('*')
      .eq('email', email.toLowerCase())
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // Not found
      log.error('Error getting user by email:', error);
      throw new Error(`Failed to get user: ${error.message}`);
    }

    return user;
  }

  /**
   * Get user by username
   */
  static async getUserByUsername(username: string): Promise<User | null> {
    const supabase = getSupabaseClient();
    
    const { data: user, error } = await supabase
      .from('app_users')
      .select('*')
      .eq('username', username.toLowerCase())
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // Not found
      log.error('Error getting user by username:', error);
      throw new Error(`Failed to get user: ${error.message}`);
    }

    return user;
  }

  /**
   * Get user by email or username
   */
  static async getUserByIdentifier(identifier: string): Promise<User | null> {
    const lowerIdentifier = identifier.toLowerCase();
    
    // Try email first
    let user = await this.getUserByEmail(lowerIdentifier);
    
    // If not found, try username
    if (!user) {
      user = await this.getUserByUsername(lowerIdentifier);
    }

    return user;
  }

  /**
   * Update user
   */
  static async updateUser(id: string, updates: Partial<User>): Promise<User> {
    const supabase = getSupabaseClient();
    
    const { data: user, error } = await supabase
      .from('app_users')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      log.error('Error updating user:', error);
      throw new Error(`Failed to update user: ${error.message}`);
    }

    return user;
  }

  /**
   * Update password
   */
  static async updatePassword(userId: string, passwordHash: string): Promise<void> {
    const supabase = getSupabaseClient();
    
    const { error } = await supabase
      .from('app_users')
      .update({ password_hash: passwordHash })
      .eq('id', userId);

    if (error) {
      log.error('Error updating password:', error);
      throw new Error(`Failed to update password: ${error.message}`);
    }
  }

  /**
   * Increment login count and clear failed attempts
   */
  static async recordSuccessfulLogin(userId: string): Promise<void> {
    const supabase = getSupabaseClient();
    
    const { error } = await supabase
      .from('app_users')
      .update({
        login_count: 1, // Will be incremented via raw query
        last_login_at: new Date().toISOString(),
        failed_login_attempts: 0,
        locked_until: null,
      })
      .eq('id', userId);

    if (error) {
      log.error('Error recording successful login:', error);
      throw new Error(`Failed to record login: ${error.message}`);
    }
    
    // Use RPC for atomic increment
    await supabase.rpc('increment_login_count', { user_uuid: userId });
  }

  /**
   * Increment failed login attempts
   */
  static async recordFailedLogin(userId: string): Promise<number> {
    const supabase = getSupabaseClient();
    
    const { data, error } = await supabase.rpc('increment_failed_login', {
      user_uuid: userId,
    });

    if (error) {
      log.error('Error recording failed login:', error);
      throw new Error(`Failed to record failed login: ${error.message}`);
    }

    return data;
  }

  /**
   * Create a session
   */
  static async createSession(data: CreateSessionData): Promise<Session> {
    const supabase = getSupabaseClient();
    
    const { data: session, error } = await supabase
      .from('user_sessions')
      .insert({
        user_id: data.user_id,
        refresh_token: data.refresh_token,
        device_info: data.device_info,
        ip_address: data.ip_address,
        user_agent: data.user_agent,
        expires_at: data.expires_at.toISOString(),
      })
      .select()
      .single();

    if (error) {
      log.error('Error creating session:', error);
      throw new Error(`Failed to create session: ${error.message}`);
    }

    return session;
  }

  /**
   * Get session by refresh token
   */
  static async getSessionByRefreshToken(refreshToken: string): Promise<Session | null> {
    const supabase = getSupabaseClient();
    
    const { data: session, error } = await supabase
      .from('user_sessions')
      .select('*')
      .eq('refresh_token', refreshToken)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // Not found
      log.error('Error getting session:', error);
      throw new Error(`Failed to get session: ${error.message}`);
    }

    return session;
  }

  /**
   * Delete session (logout)
   */
  static async deleteSession(refreshToken: string): Promise<void> {
    const supabase = getSupabaseClient();
    
    const { error } = await supabase
      .from('user_sessions')
      .delete()
      .eq('refresh_token', refreshToken);

    if (error) {
      log.error('Error deleting session:', error);
      throw new Error(`Failed to delete session: ${error.message}`);
    }
  }

  /**
   * Delete all sessions for a user (logout all devices)
   */
  static async deleteAllUserSessions(userId: string): Promise<void> {
    const supabase = getSupabaseClient();
    
    const { error } = await supabase
      .from('user_sessions')
      .delete()
      .eq('user_id', userId);

    if (error) {
      log.error('Error deleting all sessions:', error);
      throw new Error(`Failed to delete sessions: ${error.message}`);
    }
  }

  /**
   * Update session last used
   */
  static async updateSessionLastUsed(refreshToken: string): Promise<void> {
    const supabase = getSupabaseClient();
    
    const { error } = await supabase
      .from('user_sessions')
      .update({ last_used_at: new Date().toISOString() })
      .eq('refresh_token', refreshToken);

    if (error) {
      log.error('Error updating session:', error);
      // Don't throw, this is not critical
    }
  }

  /**
   * Cleanup expired sessions
   */
  static async cleanupExpiredSessions(): Promise<void> {
    const supabase = getSupabaseClient();
    
    const { error } = await supabase.rpc('cleanup_expired_sessions');

    if (error) {
      log.error('Error cleaning up sessions:', error);
      // Don't throw, this is a cleanup task
    }
  }

  /**
   * Create password reset token
   */
  static async createPasswordResetToken(
    userId: string,
    token: string,
    expiresAt: Date
  ): Promise<PasswordResetToken> {
    const supabase = getSupabaseClient();
    
    const { data: resetToken, error } = await supabase
      .from('password_reset_tokens')
      .insert({
        user_id: userId,
        token,
        expires_at: expiresAt.toISOString(),
      })
      .select()
      .single();

    if (error) {
      log.error('Error creating password reset token:', error);
      throw new Error(`Failed to create reset token: ${error.message}`);
    }

    return resetToken;
  }

  /**
   * Get password reset token
   */
  static async getPasswordResetToken(token: string): Promise<PasswordResetToken | null> {
    const supabase = getSupabaseClient();
    
    const { data: resetToken, error } = await supabase
      .from('password_reset_tokens')
      .select('*')
      .eq('token', token)
      .is('used_at', null)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // Not found
      log.error('Error getting reset token:', error);
      throw new Error(`Failed to get reset token: ${error.message}`);
    }

    return resetToken;
  }

  /**
   * Mark password reset token as used
   */
  static async usePasswordResetToken(token: string): Promise<void> {
    const supabase = getSupabaseClient();
    
    const { error } = await supabase
      .from('password_reset_tokens')
      .update({ used_at: new Date().toISOString() })
      .eq('token', token);

    if (error) {
      log.error('Error using reset token:', error);
      throw new Error(`Failed to use reset token: ${error.message}`);
    }
  }

  /**
   * Create email verification token
   */
  static async createEmailVerificationToken(
    userId: string,
    email: string,
    token: string,
    expiresAt: Date
  ): Promise<EmailVerificationToken> {
    const supabase = getSupabaseClient();
    
    const { data: verificationToken, error } = await supabase
      .from('email_verification_tokens')
      .insert({
        user_id: userId,
        email,
        token,
        expires_at: expiresAt.toISOString(),
      })
      .select()
      .single();

    if (error) {
      log.error('Error creating email verification token:', error);
      throw new Error(`Failed to create verification token: ${error.message}`);
    }

    return verificationToken;
  }

  /**
   * Get email verification token
   */
  static async getEmailVerificationToken(token: string): Promise<EmailVerificationToken | null> {
    const supabase = getSupabaseClient();
    
    const { data: verificationToken, error } = await supabase
      .from('email_verification_tokens')
      .select('*')
      .eq('token', token)
      .is('used_at', null)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // Not found
      log.error('Error getting verification token:', error);
      throw new Error(`Failed to get verification token: ${error.message}`);
    }

    return verificationToken;
  }

  /**
   * Mark email verification token as used and verify user email
   */
  static async useEmailVerificationToken(token: string, userId: string): Promise<void> {
    const supabase = getSupabaseClient();
    
    // Mark token as used
    const { error: tokenError } = await supabase
      .from('email_verification_tokens')
      .update({ used_at: new Date().toISOString() })
      .eq('token', token);

    if (tokenError) {
      log.error('Error using verification token:', tokenError);
      throw new Error(`Failed to use verification token: ${tokenError.message}`);
    }

    // Verify user email
    const { error: userError } = await supabase
      .from('app_users')
      .update({ email_verified: true })
      .eq('id', userId);

    if (userError) {
      log.error('Error verifying email:', userError);
      throw new Error(`Failed to verify email: ${userError.message}`);
    }
  }
}

export default AuthDAO;
