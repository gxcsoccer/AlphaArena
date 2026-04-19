import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

// JWT imports
import { encode as base64Encode } from 'https://deno.land/std@0.208.0/encoding/base64.ts';

const JWT_SECRET = Deno.env.get('JWT_SECRET') || 'your-secret-key-change-in-production';
const JWT_EXPIRES_IN = '1h';
const REFRESH_TOKEN_EXPIRES_IN_DAYS = 7;
const BCRYPT_SALT_ROUNDS = 12;
const MAX_LOGIN_ATTEMPTS = 5;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey',
};

// Simple password hashing using Web Crypto API
async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + JWT_SECRET);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const newHash = await hashPassword(password);
  return newHash === hash;
}

// Simple JWT implementation
function base64UrlEncode(str: string): string {
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function generateJWT(payload: any, secret: string, expiresIn: string): string {
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const exp = now + parseExpiresIn(expiresIn);
  
  const jwtPayload = { ...payload, iat: now, exp };
  
  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(jwtPayload));
  
  const signature = hmacSha256(`${encodedHeader}.${encodedPayload}`, secret);
  
  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

function parseExpiresIn(expiresIn: string): number {
  if (expiresIn.endsWith('h')) {
    return parseInt(expiresIn) * 60 * 60;
  } else if (expiresIn.endsWith('d')) {
    return parseInt(expiresIn) * 24 * 60 * 60;
  }
  return parseInt(expiresIn);
}

async function hmacSha256(message: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const messageData = encoder.encode(message);
  
  const key = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  const signature = await crypto.subtle.sign('HMAC', key, messageData);
  const signatureArray = Array.from(new Uint8Array(signature));
  return signatureArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

function generateRefreshToken(): string {
  const bytes = new Uint8Array(64);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

function getRefreshTokenExpiration(): Date {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_EXPIRES_IN_DAYS);
  return expiresAt;
}

// Password validation
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

function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

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

function sanitizeUser(user: any): any {
  return {
    id: user.id,
    email: user.email,
    username: user.username,
    email_verified: user.email_verified,
    role: user.role,
    created_at: user.created_at,
  };
}

Deno.serve(async (req: Request) => {
  const url = new URL(req.url);
  const path = url.pathname;
  const method = req.method;

  // Handle CORS preflight
  if (method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // POST /auth/register
    if (method === 'POST' && (path === '/auth/register' || path === '/api/auth/register')) {
      const body = await req.json();
      const { email: rawEmail, username: rawUsername, password, ref } = body;

      // Trim email and username to avoid validation issues with accidental whitespace
      const email = (rawEmail || '').trim().toLowerCase();
      const username = rawUsername ? rawUsername.trim() : undefined;

      // Validate required fields
      if (!email || !password) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Email and password are required',
        }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      // Validate email (already trimmed)
      if (!validateEmail(email)) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Invalid email format',
        }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      // Validate username if provided (already trimmed)
      if (username) {
        const usernameValidation = validateUsername(username);
        if (!usernameValidation.valid) {
          return new Response(JSON.stringify({
            success: false,
            error: usernameValidation.error,
          }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
      }

      // Validate password strength
      const passwordValidation = validatePasswordStrength(password);
      if (!passwordValidation.valid) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Password does not meet requirements',
          details: passwordValidation.errors,
        }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      // Check if user already exists
      const { data: existingUser } = await supabase
        .from('app_users')
        .select('id')
        .eq('email', email.toLowerCase())
        .single();

      if (existingUser) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Email already registered',
        }), { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      // Check if username is taken
      if (username) {
        const { data: existingUsername } = await supabase
          .from('app_users')
          .select('id')
          .eq('username', username.toLowerCase())
          .single();

        if (existingUsername) {
          return new Response(JSON.stringify({
            success: false,
            error: 'Username already taken',
          }), { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
      }

      // Hash password
      const passwordHash = await hashPassword(password);

      // Create user
      const { data: user, error: createError } = await supabase
        .from('app_users')
        .insert({
          email: email, // Already trimmed and lowercased
          username: username?.toLowerCase(), // Only lowercase username
          password_hash: passwordHash,
          role: 'user',
          email_verified: false,
          is_active: true,
          login_count: 0,
          failed_login_attempts: 0,
        })
        .select()
        .single();

      if (createError) {
        console.error('Error creating user:', createError);
        return new Response(JSON.stringify({
          success: false,
          error: 'Failed to create user: ' + createError.message,
        }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      console.log(`User registered: ${user.email}`);

      // Generate tokens
      const accessToken = generateJWT(
        { userId: user.id, email: user.email, role: user.role },
        JWT_SECRET,
        JWT_EXPIRES_IN
      );
      const refreshToken = generateRefreshToken();
      const expiresAt = getRefreshTokenExpiration();

      // Create session
      await supabase.from('user_sessions').insert({
        user_id: user.id,
        refresh_token: refreshToken,
        device_info: req.headers.get('user-agent'),
        ip_address: req.headers.get('x-forwarded-for') || 'unknown',
        expires_at: expiresAt.toISOString(),
      });

      // Start trial for new user (if trial system exists)
      try {
        const trialExpiresAt = new Date();
        trialExpiresAt.setDate(trialExpiresAt.getDate() + 14);
        
        await supabase.from('user_subscriptions').insert({
          user_id: user.id,
          plan: 'pro',
          status: 'trialing',
          trial_ends_at: trialExpiresAt.toISOString(),
        });
        console.log(`Trial started for new user: ${user.email}`);
      } catch (trialError) {
        console.warn('Failed to start trial:', trialError);
        // Don't fail registration if trial creation fails
      }

      return new Response(JSON.stringify({
        success: true,
        data: {
          user: sanitizeUser(user),
          accessToken,
          refreshToken,
          expiresIn: JWT_EXPIRES_IN,
        },
      }), { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // POST /auth/login
    if (method === 'POST' && (path === '/auth/login' || path === '/api/auth/login')) {
      const body = await req.json();
      const { identifier: rawIdentifier, password } = body;

      // Trim and lowercase identifier to handle accidental whitespace
      const identifier = (rawIdentifier || '').trim().toLowerCase();

      // Validate required fields
      if (!identifier || !password) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Identifier and password are required',
        }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      // Find user by email or username (already trimmed and lowercased)
      const { data: user } = await supabase
        .from('app_users')
        .select('*')
        .or(`email.eq.${identifier},username.eq.${identifier}`)
        .single();

      if (!user) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Invalid credentials',
        }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      // Check if account is locked
      if (user.locked_until && new Date(user.locked_until) > new Date()) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Account is temporarily locked due to too many failed login attempts',
        }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      // Check if user is active
      if (!user.is_active) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Account is disabled',
        }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      // Verify password
      const isValidPassword = await verifyPassword(password, user.password_hash);
      if (!isValidPassword) {
        // Increment failed login attempts
        const newAttempts = (user.failed_login_attempts || 0) + 1;
        
        await supabase
          .from('app_users')
          .update({ failed_login_attempts: newAttempts })
          .eq('id', user.id);
        
        if (newAttempts >= MAX_LOGIN_ATTEMPTS) {
          const lockUntil = new Date();
          lockUntil.setMinutes(lockUntil.getMinutes() + 30);
          
          await supabase
            .from('app_users')
            .update({ locked_until: lockUntil.toISOString() })
            .eq('id', user.id);
          
          return new Response(JSON.stringify({
            success: false,
            error: 'Account locked due to too many failed login attempts. Please try again later.',
          }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        return new Response(JSON.stringify({
          success: false,
          error: 'Invalid credentials',
          remainingAttempts: MAX_LOGIN_ATTEMPTS - newAttempts,
        }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      // Record successful login
      await supabase
        .from('app_users')
        .update({
          last_login_at: new Date().toISOString(),
          login_count: (user.login_count || 0) + 1,
          failed_login_attempts: 0,
        })
        .eq('id', user.id);

      // Generate tokens
      const accessToken = generateJWT(
        { userId: user.id, email: user.email, role: user.role },
        JWT_SECRET,
        JWT_EXPIRES_IN
      );
      const refreshToken = generateRefreshToken();
      const expiresAt = getRefreshTokenExpiration();

      // Create session
      await supabase.from('user_sessions').insert({
        user_id: user.id,
        refresh_token: refreshToken,
        device_info: req.headers.get('user-agent'),
        ip_address: req.headers.get('x-forwarded-for') || 'unknown',
        expires_at: expiresAt.toISOString(),
      });

      console.log(`User logged in: ${user.email}`);

      return new Response(JSON.stringify({
        success: true,
        data: {
          user: sanitizeUser(user),
          accessToken,
          refreshToken,
          expiresIn: JWT_EXPIRES_IN,
        },
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // POST /auth/logout
    if (method === 'POST' && (path === '/auth/logout' || path === '/api/auth/logout')) {
      const body = await req.json();
      const { refreshToken } = body;

      if (refreshToken) {
        await supabase
          .from('user_sessions')
          .delete()
          .eq('refresh_token', refreshToken);
      }

      return new Response(JSON.stringify({
        success: true,
        message: 'Logged out successfully',
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // POST /auth/refresh
    if (method === 'POST' && (path === '/auth/refresh' || path === '/api/auth/refresh')) {
      const body = await req.json();
      const { refreshToken } = body;

      if (!refreshToken) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Refresh token is required',
        }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      // Find session
      const { data: session } = await supabase
        .from('user_sessions')
        .select('*')
        .eq('refresh_token', refreshToken)
        .single();

      if (!session) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Invalid refresh token',
        }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      // Check if refresh token is expired
      if (new Date(session.expires_at) < new Date()) {
        await supabase.from('user_sessions').delete().eq('refresh_token', refreshToken);
        return new Response(JSON.stringify({
          success: false,
          error: 'Refresh token expired',
        }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      // Get user
      const { data: user } = await supabase
        .from('app_users')
        .select('*')
        .eq('id', session.user_id)
        .single();

      if (!user || !user.is_active) {
        await supabase.from('user_sessions').delete().eq('refresh_token', refreshToken);
        return new Response(JSON.stringify({
          success: false,
          error: 'User not found or inactive',
        }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      // Generate new access token
      const accessToken = generateJWT(
        { userId: user.id, email: user.email, role: user.role },
        JWT_SECRET,
        JWT_EXPIRES_IN
      );

      // Update session last used
      await supabase
        .from('user_sessions')
        .update({ last_used_at: new Date().toISOString() })
        .eq('refresh_token', refreshToken);

      return new Response(JSON.stringify({
        success: true,
        data: {
          accessToken,
          expiresIn: JWT_EXPIRES_IN,
        },
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // GET /auth/me - Get current user info
    if (method === 'GET' && (path === '/auth/me' || path === '/api/auth/me')) {
      const authHeader = req.headers.get('Authorization');
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Not authenticated',
        }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      const token = authHeader.substring(7);
      
      // For now, decode the JWT to get user ID
      // In production, verify the signature
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        
        if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
          return new Response(JSON.stringify({
            success: false,
            error: 'Token expired',
          }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        const { data: user } = await supabase
          .from('app_users')
          .select('*')
          .eq('id', payload.userId)
          .single();

        if (!user) {
          return new Response(JSON.stringify({
            success: false,
            error: 'User not found',
          }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        return new Response(JSON.stringify({
          success: true,
          data: sanitizeUser(user),
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      } catch (e) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Invalid token',
        }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    }

    // Not found
    return new Response(JSON.stringify({
      success: false,
      error: 'Not found',
    }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error: any) {
    console.error('Auth error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message || 'Internal server error',
    }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});