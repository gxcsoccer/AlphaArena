/**
 * API Key Types - Type definitions for API key management
 *
 * Supports external API authentication with rate limiting and permissions
 */

/**
 * API Key permission levels
 */
export type ApiKeyPermission = 'read' | 'trade' | 'admin';

/**
 * API Key status
 */
export type ApiKeyStatus = 'active' | 'disabled' | 'revoked';

/**
 * API Key configuration
 */
export interface ApiKey {
  /** Unique key identifier (used as the key prefix for identification) */
  id: string;
  /** The actual secret key (hashed for storage) */
  keyHash: string;
  /** Human-readable name for the key */
  name: string;
  /** User ID that owns this key */
  userId: string;
  /** Permission level */
  permission: ApiKeyPermission;
  /** Key status */
  status: ApiKeyStatus;
  /** Rate limit: requests per minute */
  rateLimitPerMinute: number;
  /** Rate limit: requests per day */
  rateLimitPerDay: number;
  /** Optional IP whitelist */
  ipWhitelist?: string[];
  /** Optional allowed endpoints (for fine-grained control) */
  allowedEndpoints?: string[];
  /** Key creation timestamp */
  createdAt: Date;
  /** Last used timestamp */
  lastUsedAt?: Date;
  /** Key expiration date (optional) */
  expiresAt?: Date;
  /** Key description/notes */
  description?: string;
}

/**
 * Create API key request
 */
export interface CreateApiKeyRequest {
  name: string;
  userId: string;
  permission: ApiKeyPermission;
  rateLimitPerMinute?: number;
  rateLimitPerDay?: number;
  ipWhitelist?: string[];
  allowedEndpoints?: string[];
  expiresAt?: Date;
  description?: string;
}

/**
 * API Key with secret (returned only on creation)
 */
export interface ApiKeyWithSecret extends ApiKey {
  /** The actual secret key (shown only once) */
  secretKey: string;
}

/**
 * API Key usage tracking
 */
export interface ApiKeyUsage {
  keyId: string;
  minuteCount: number;
  minuteResetAt: Date;
  dayCount: number;
  dayResetAt: Date;
}

/**
 * API Key statistics
 */
export interface ApiKeyStats {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  lastUsedAt?: Date;
  topEndpoints: { endpoint: string; count: number }[];
}

/**
 * Rate limit result
 */
export interface RateLimitResult {
  allowed: boolean;
  remainingMinute: number;
  remainingDay: number;
  resetAtMinute: Date;
  resetAtDay: Date;
}

/**
 * Generate a unique API key ID
 */
export function generateApiKeyId(): string {
  return `apikey-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Generate a secure API key secret
 * Format: aa_live_<random_string> or aa_test_<random_string>
 */
export function generateApiKeySecret(test: boolean = false): string {
  const prefix = test ? 'aa_test' : 'aa_live';
  const random = Buffer.from(Math.random().toString(36).substr(2, 32) + Date.now().toString(36))
    .toString('base64')
    .replace(/[+/=]/g, '') // Remove special chars
    .substr(0, 32);
  return `${prefix}_${random}`;
}

/**
 * Hash an API key secret for storage
 */
export async function hashApiKey(key: string): Promise<string> {
  const crypto = await import('crypto');
  return crypto.createHash('sha256').update(key).digest('hex');
}

/**
 * Verify an API key against a hash
 */
export async function verifyApiKey(key: string, hash: string): Promise<boolean> {
  const keyHash = await hashApiKey(key);
  return keyHash === hash;
}

/**
 * Extract key ID from secret key
 * Key format: aa_live_<random> or aa_test_<random>
 */
export function extractKeyIdFromSecret(_secretKey: string): string | null {
  // The key ID should be stored separately and looked up by prefix
  // For now, return null - the actual ID will be looked up via database
  return null;
}

/**
 * Default rate limits by permission level
 */
export const DEFAULT_RATE_LIMITS: Record<ApiKeyPermission, { minute: number; day: number }> = {
  read: { minute: 60, day: 10000 },
  trade: { minute: 120, day: 20000 },
  admin: { minute: 300, day: 50000 },
};
