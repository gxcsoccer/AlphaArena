/**
 * API Key Data Access Object
 *
 * ⚠️ IMPORTANT: In-Memory Storage Limitation
 * ─────────────────────────────────────────
 * This implementation uses in-memory storage (Map objects) for API keys.
 * All API keys and usage data are LOST when the server restarts.
 *
 * This is suitable for development and testing only.
 * For production, replace with a persistent database (PostgreSQL, Redis, etc.).
 *
 * Migration path:
 * 1. Create database tables for api_keys and api_key_usage
 * 2. Replace Map operations with database queries
 * 3. Add connection pooling and error handling
 */

import {
  ApiKey,
  ApiKeyWithSecret,
  ApiKeyUsage,
  ApiKeyStats,
  CreateApiKeyRequest,
  generateApiKeyId,
  generateApiKeySecret,
  hashApiKey,
  DEFAULT_RATE_LIMITS,
} from './apiKeyTypes';
import { createLogger } from '../utils/logger';

const log = createLogger('ApiKeyDao');

/**
 * In-memory storage for API keys
 * Key: API key ID
 */
const apiKeys = new Map<string, ApiKey>();

/**
 * In-memory storage for API key usage tracking
 * Key: API key ID
 */
const apiKeyUsage = new Map<string, ApiKeyUsage>();

/**
 * API Key lookup by key hash (for authentication)
 */
const apiKeyByHash = new Map<string, ApiKey>();

/**
 * API Key lookup by user ID
 */
const apiKeysByUser = new Map<string, Set<string>>();

/**
 * Request log for statistics
 */
interface RequestLog {
  keyId: string;
  endpoint: string;
  success: boolean;
  timestamp: Date;
}
const requestLogs: RequestLog[] = [];

/**
 * Create a new API key
 */
export async function createApiKey(request: CreateApiKeyRequest): Promise<ApiKeyWithSecret> {
  const id = generateApiKeyId();
  const secretKey = generateApiKeySecret(false);
  const keyHash = await hashApiKey(secretKey);
  const now = new Date();

  const defaultLimits = DEFAULT_RATE_LIMITS[request.permission];

  const apiKey: ApiKey = {
    id,
    keyHash,
    name: request.name,
    userId: request.userId,
    permission: request.permission,
    status: 'active',
    rateLimitPerMinute: request.rateLimitPerMinute ?? defaultLimits.minute,
    rateLimitPerDay: request.rateLimitPerDay ?? defaultLimits.day,
    ipWhitelist: request.ipWhitelist,
    allowedEndpoints: request.allowedEndpoints,
    createdAt: now,
    expiresAt: request.expiresAt,
    description: request.description,
  };

  // Store the key
  apiKeys.set(id, apiKey);
  apiKeyByHash.set(keyHash, apiKey);

  // Add to user's keys
  if (!apiKeysByUser.has(request.userId)) {
    apiKeysByUser.set(request.userId, new Set());
  }
  apiKeysByUser.get(request.userId)!.add(id);

  // Initialize usage tracking
  apiKeyUsage.set(id, {
    keyId: id,
    minuteCount: 0,
    minuteResetAt: new Date(now.getTime() + 60000),
    dayCount: 0,
    dayResetAt: new Date(now.getTime() + 86400000),
  });

  log.info('API key created', { id, name: request.name, userId: request.userId, permission: request.permission });

  return { ...apiKey, secretKey };
}

/**
 * Get API key by ID
 */
export async function getApiKey(id: string): Promise<ApiKey | null> {
  return apiKeys.get(id) || null;
}

/**
 * Get API key by key hash (for authentication)
 */
export async function getApiKeyByHash(keyHash: string): Promise<ApiKey | null> {
  return apiKeyByHash.get(keyHash) || null;
}

/**
 * Get all API keys for a user
 */
export async function getApiKeysByUser(userId: string): Promise<ApiKey[]> {
  const keyIds = apiKeysByUser.get(userId);
  if (!keyIds) return [];

  const keys: ApiKey[] = [];
  for (const id of keyIds) {
    const key = apiKeys.get(id);
    if (key) keys.push(key);
  }
  return keys;
}

/**
 * Get all API keys (admin only)
 */
export async function getAllApiKeys(): Promise<ApiKey[]> {
  return Array.from(apiKeys.values());
}

/**
 * Update API key
 */
export async function updateApiKey(
  id: string,
  updates: Partial<Pick<ApiKey, 'name' | 'status' | 'rateLimitPerMinute' | 'rateLimitPerDay' | 'ipWhitelist' | 'allowedEndpoints' | 'description'>>
): Promise<ApiKey | null> {
  const key = apiKeys.get(id);
  if (!key) return null;

  const updatedKey: ApiKey = {
    ...key,
    ...updates,
  };

  apiKeys.set(id, updatedKey);
  apiKeyByHash.set(key.keyHash, updatedKey);

  log.info('API key updated', { id, updates: Object.keys(updates) });

  return updatedKey;
}

/**
 * Revoke API key
 */
export async function revokeApiKey(id: string): Promise<boolean> {
  const key = apiKeys.get(id);
  if (!key) return false;

  key.status = 'revoked';
  apiKeys.set(id, key);
  apiKeyByHash.set(key.keyHash, key);

  log.info('API key revoked', { id });

  return true;
}

/**
 * Delete API key
 */
export async function deleteApiKey(id: string): Promise<boolean> {
  const key = apiKeys.get(id);
  if (!key) return false;

  apiKeys.delete(id);
  apiKeyByHash.delete(key.keyHash);
  apiKeyUsage.delete(id);

  const userKeys = apiKeysByUser.get(key.userId);
  if (userKeys) {
    userKeys.delete(id);
  }

  log.info('API key deleted', { id });

  return true;
}

/**
 * Record API key usage
 */
export async function recordApiKeyUsage(id: string, endpoint: string, success: boolean): Promise<void> {
  const usage = apiKeyUsage.get(id);
  if (!usage) return;

  const now = new Date();

  // Reset minute counter if needed
  if (now >= usage.minuteResetAt) {
    usage.minuteCount = 0;
    usage.minuteResetAt = new Date(now.getTime() + 60000);
  }

  // Reset day counter if needed
  if (now >= usage.dayResetAt) {
    usage.dayCount = 0;
    usage.dayResetAt = new Date(now.getTime() + 86400000);
  }

  usage.minuteCount++;
  usage.dayCount++;

  // Update last used timestamp on the key
  const key = apiKeys.get(id);
  if (key) {
    key.lastUsedAt = now;
  }

  // Log the request
  requestLogs.push({
    keyId: id,
    endpoint,
    success,
    timestamp: now,
  });

  // Keep only last 10000 request logs
  if (requestLogs.length > 10000) {
    requestLogs.splice(0, requestLogs.length - 10000);
  }
}

/**
 * Check rate limit for API key
 */
export async function checkRateLimit(id: string): Promise<{ allowed: boolean; remainingMinute: number; remainingDay: number; resetAtMinute: Date; resetAtDay: Date }> {
  const key = apiKeys.get(id);
  if (!key) {
    return {
      allowed: false,
      remainingMinute: 0,
      remainingDay: 0,
      resetAtMinute: new Date(),
      resetAtDay: new Date(),
    };
  }

  const usage = apiKeyUsage.get(id);
  if (!usage) {
    // Initialize usage if not exists
    const now = new Date();
    apiKeyUsage.set(id, {
      keyId: id,
      minuteCount: 0,
      minuteResetAt: new Date(now.getTime() + 60000),
      dayCount: 0,
      dayResetAt: new Date(now.getTime() + 86400000),
    });
    return {
      allowed: true,
      remainingMinute: key.rateLimitPerMinute,
      remainingDay: key.rateLimitPerDay,
      resetAtMinute: new Date(Date.now() + 60000),
      resetAtDay: new Date(Date.now() + 86400000),
    };
  }

  const now = new Date();

  // Reset minute counter if needed
  if (now >= usage.minuteResetAt) {
    usage.minuteCount = 0;
    usage.minuteResetAt = new Date(now.getTime() + 60000);
  }

  // Reset day counter if needed
  if (now >= usage.dayResetAt) {
    usage.dayCount = 0;
    usage.dayResetAt = new Date(now.getTime() + 86400000);
  }

  const remainingMinute = Math.max(0, key.rateLimitPerMinute - usage.minuteCount);
  const remainingDay = Math.max(0, key.rateLimitPerDay - usage.dayCount);

  const allowed = usage.minuteCount < key.rateLimitPerMinute && usage.dayCount < key.rateLimitPerDay;

  return {
    allowed,
    remainingMinute,
    remainingDay,
    resetAtMinute: usage.minuteResetAt,
    resetAtDay: usage.dayResetAt,
  };
}

/**
 * Get API key usage statistics
 */
export async function getApiKeyStats(id: string): Promise<ApiKeyStats | null> {
  const key = apiKeys.get(id);
  if (!key) return null;

  const logs = requestLogs.filter(l => l.keyId === id);
  const successful = logs.filter(l => l.success).length;
  const failed = logs.filter(l => !l.success).length;

  // Count endpoint usage
  const endpointCounts = new Map<string, number>();
  for (const log of logs) {
    endpointCounts.set(log.endpoint, (endpointCounts.get(log.endpoint) || 0) + 1);
  }

  const topEndpoints = Array.from(endpointCounts.entries())
    .map(([endpoint, count]) => ({ endpoint, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  return {
    totalRequests: logs.length,
    successfulRequests: successful,
    failedRequests: failed,
    lastUsedAt: key.lastUsedAt,
    topEndpoints,
  };
}

/**
 * Get API key usage data
 */
export async function getApiKeyUsage(id: string): Promise<ApiKeyUsage | null> {
  return apiKeyUsage.get(id) || null;
}

/**
 * Clean up expired request logs (call periodically)
 */
export function cleanupRequestLogs(maxAge: number = 7 * 24 * 60 * 60 * 1000): void {
  const cutoff = new Date(Date.now() - maxAge);
  const index = requestLogs.findIndex(l => l.timestamp >= cutoff);
  if (index > 0) {
    requestLogs.splice(0, index);
    log.info('Cleaned up request logs', { removed: index });
  }
}

export default {
  createApiKey,
  getApiKey,
  getApiKeyByHash,
  getApiKeysByUser,
  getAllApiKeys,
  updateApiKey,
  revokeApiKey,
  deleteApiKey,
  recordApiKeyUsage,
  checkRateLimit,
  getApiKeyStats,
  getApiKeyUsage,
  cleanupRequestLogs,
};
