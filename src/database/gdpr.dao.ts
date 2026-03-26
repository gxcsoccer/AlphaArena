/**
 * GDPR Data Access Object
 * Handles user data export and deletion for GDPR compliance
 */

import { getSupabaseClient } from './client';
import { createLogger } from '../utils/logger';

const log = createLogger('GDPRDAO');

/**
 * User data export result
 */
export interface UserDataExport {
  exportId: string;
  userId: string;
  exportedAt: string;
  data: {
    profile: UserProfileData | null;
    sessions: SessionData[];
    strategies: StrategyData[];
    trades: TradeData[];
    portfolios: PortfolioData[];
    subscriptions: SubscriptionData[];
    payments: PaymentData[];
    notifications: NotificationData[];
    preferences: PreferencesData | null;
    referrals: ReferralData[];
    feedback: FeedbackData[];
    exchangeAccounts: ExchangeAccountData[];
    apiKeys: ApiKeyData[];
    auditLogs: AuditLogData[];
  };
  metadata: {
    totalRecords: number;
    exportFormat: 'json';
    version: string;
  };
}

export interface UserProfileData {
  id: string;
  email: string;
  username?: string;
  email_verified: boolean;
  role: string;
  created_at: string;
  updated_at: string;
  last_login_at?: string;
  login_count: number;
  metadata?: Record<string, any>;
}

export interface SessionData {
  id: string;
  device_info?: string;
  ip_address?: string;
  user_agent?: string;
  created_at: string;
  last_used_at: string;
  expires_at: string;
}

export interface StrategyData {
  id: string;
  name: string;
  description?: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface TradeData {
  id: string;
  symbol: string;
  side: string;
  quantity: number;
  price: number;
  total: number;
  created_at: string;
}

export interface PortfolioData {
  id: string;
  strategy_id?: string;
  total_value: number;
  cash_balance: number;
  created_at: string;
}

export interface SubscriptionData {
  id: string;
  plan_id: string;
  status: string;
  current_period_start: string;
  current_period_end: string;
  created_at: string;
}

export interface PaymentData {
  id: string;
  amount: number;
  currency: string;
  status: string;
  created_at: string;
}

export interface NotificationData {
  id: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  created_at: string;
}

export interface PreferencesData {
  theme: string;
  language: string;
  notifications_enabled: boolean;
  email_notifications: boolean;
  push_notifications: boolean;
  created_at: string;
  updated_at: string;
}

export interface ReferralData {
  id: string;
  referral_code: string;
  referred_email?: string;
  status: string;
  reward_amount: number;
  created_at: string;
}

export interface FeedbackData {
  id: string;
  type: string;
  subject: string;
  message: string;
  status: string;
  created_at: string;
}

export interface ExchangeAccountData {
  id: string;
  exchange_name: string;
  account_name: string;
  created_at: string;
}

export interface ApiKeyData {
  id: string;
  name: string;
  prefix: string;
  permissions: string[];
  created_at: string;
  last_used_at?: string;
  expires_at?: string;
}

export interface AuditLogData {
  id: string;
  action: string;
  resource_type: string;
  resource_id?: string;
  ip_address?: string;
  user_agent?: string;
  created_at: string;
}

/**
 * Data deletion request
 */
export interface DataDeletionRequest {
  id: string;
  user_id: string;
  status: 'pending' | 'confirmed' | 'processing' | 'completed' | 'cancelled';
  confirmation_code: string;
  requested_at: string;
  confirmed_at?: string;
  scheduled_deletion_at?: string;
  completed_at?: string;
  cancelled_at?: string;
  ip_address?: string;
  user_agent?: string;
}

/**
 * Data export request
 */
export interface DataExportRequest {
  id: string;
  user_id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  format: 'json' | 'csv';
  requested_at: string;
  completed_at?: string;
  download_url?: string;
  expires_at?: string;
  error_message?: string;
}

/**
 * Tables to export user data from
 */
const USER_DATA_TABLES = [
  { table: 'app_users', idField: 'id', exportName: 'profile', single: true },
  { table: 'user_sessions', idField: 'user_id', exportName: 'sessions' },
  { table: 'strategies', idField: 'user_id', exportName: 'strategies' },
  { table: 'trades', idField: 'user_id', exportName: 'trades' },
  { table: 'portfolios', idField: 'user_id', exportName: 'portfolios' },
  { table: 'subscriptions', idField: 'user_id', exportName: 'subscriptions' },
  { table: 'payments', idField: 'user_id', exportName: 'payments' },
  { table: 'notifications', idField: 'user_id', exportName: 'notifications' },
  { table: 'user_preferences', idField: 'user_id', exportName: 'preferences', single: true },
  { table: 'referrals', idField: 'referrer_id', exportName: 'referrals' },
  { table: 'feedback', idField: 'user_id', exportName: 'feedback' },
  { table: 'exchange_accounts', idField: 'user_id', exportName: 'exchangeAccounts' },
  { table: 'api_keys', idField: 'user_id', exportName: 'apiKeys' },
  { table: 'audit_logs', idField: 'user_id', exportName: 'auditLogs' },
];

/**
 * Tables to delete user data from (in order of dependencies)
 * Note: Some data may be retained for legal/tax purposes
 */
const USER_DATA_DELETE_TABLES = [
  'user_sessions',
  'api_keys',
  'notifications',
  'user_preferences',
  'referrals',
  'feedback',
  'exchange_accounts',
  'portfolios',
  'trades',
  'strategies',
  'audit_logs',
];

export class GDPRDAO {
  /**
   * Export all user data for GDPR compliance
   */
  static async exportUserData(userId: string): Promise<UserDataExport> {
    const supabase = getSupabaseClient();
    const exportId = `export_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    log.info('Starting user data export', { userId, exportId });

    const data: UserDataExport['data'] = {
      profile: null,
      sessions: [],
      strategies: [],
      trades: [],
      portfolios: [],
      subscriptions: [],
      payments: [],
      notifications: [],
      preferences: null,
      referrals: [],
      feedback: [],
      exchangeAccounts: [],
      apiKeys: [],
      auditLogs: [],
    };

    let totalRecords = 0;

    // Export data from each table
    for (const { table, idField, exportName, single } of USER_DATA_TABLES) {
      try {
        const { data: tableData, error } = await supabase
          .from(table)
          .select('*')
          .eq(idField, userId);

        if (error) {
          log.warn(`Failed to export from ${table}`, { error: error.message });
          continue;
        }

        if (tableData && tableData.length > 0) {
          // Sanitize sensitive fields
          const sanitizedData = tableData.map(row => sanitizeRow(row, table));
          
          if (single) {
            (data as any)[exportName] = sanitizedData[0] || null;
            totalRecords += sanitizedData.length;
          } else {
            (data as any)[exportName] = sanitizedData;
            totalRecords += sanitizedData.length;
          }
        }
      } catch (err) {
        log.warn(`Error exporting from ${table}`, { error: err });
      }
    }

    log.info('User data export completed', { userId, exportId, totalRecords });

    return {
      exportId,
      userId,
      exportedAt: new Date().toISOString(),
      data,
      metadata: {
        totalRecords,
        exportFormat: 'json',
        version: '1.0.0',
      },
    };
  }

  /**
   * Create a data export request
   */
  static async createExportRequest(
    userId: string,
    format: 'json' | 'csv' = 'json'
  ): Promise<DataExportRequest> {
    const supabase = getSupabaseClient();
    
    const { data: request, error } = await supabase
      .from('data_export_requests')
      .insert({
        user_id: userId,
        status: 'pending',
        format,
        requested_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      log.error('Failed to create export request', error);
      throw new Error(`Failed to create export request: ${error.message}`);
    }

    return request;
  }

  /**
   * Get export request by ID
   */
  static async getExportRequest(requestId: string): Promise<DataExportRequest | null> {
    const supabase = getSupabaseClient();
    
    const { data: request, error } = await supabase
      .from('data_export_requests')
      .select('*')
      .eq('id', requestId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      log.error('Failed to get export request', error);
      throw new Error(`Failed to get export request: ${error.message}`);
    }

    return request;
  }

  /**
   * Get export requests for a user
   */
  static async getUserExportRequests(userId: string): Promise<DataExportRequest[]> {
    const supabase = getSupabaseClient();
    
    const { data: requests, error } = await supabase
      .from('data_export_requests')
      .select('*')
      .eq('user_id', userId)
      .order('requested_at', { ascending: false })
      .limit(10);

    if (error) {
      log.error('Failed to get user export requests', error);
      throw new Error(`Failed to get export requests: ${error.message}`);
    }

    return requests || [];
  }

  /**
   * Update export request status
   */
  static async updateExportRequest(
    requestId: string,
    updates: Partial<DataExportRequest>
  ): Promise<void> {
    const supabase = getSupabaseClient();
    
    const { error } = await supabase
      .from('data_export_requests')
      .update(updates)
      .eq('id', requestId);

    if (error) {
      log.error('Failed to update export request', error);
      throw new Error(`Failed to update export request: ${error.message}`);
    }
  }

  /**
   * Create a data deletion request
   */
  static async createDeletionRequest(
    userId: string,
    metadata?: { ipAddress?: string; userAgent?: string }
  ): Promise<DataDeletionRequest> {
    const supabase = getSupabaseClient();
    
    // Generate a 6-digit confirmation code
    const confirmationCode = Math.floor(100000 + Math.random() * 900000).toString();
    
    const { data: request, error } = await supabase
      .from('data_deletion_requests')
      .insert({
        user_id: userId,
        status: 'pending',
        confirmation_code: confirmationCode,
        requested_at: new Date().toISOString(),
        ip_address: metadata?.ipAddress,
        user_agent: metadata?.userAgent,
      })
      .select()
      .single();

    if (error) {
      log.error('Failed to create deletion request', error);
      throw new Error(`Failed to create deletion request: ${error.message}`);
    }

    log.info('Data deletion request created', { userId, requestId: request.id });

    return request;
  }

  /**
   * Get deletion request by ID
   */
  static async getDeletionRequest(requestId: string): Promise<DataDeletionRequest | null> {
    const supabase = getSupabaseClient();
    
    const { data: request, error } = await supabase
      .from('data_deletion_requests')
      .select('*')
      .eq('id', requestId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      log.error('Failed to get deletion request', error);
      throw new Error(`Failed to get deletion request: ${error.message}`);
    }

    return request;
  }

  /**
   * Get active deletion request for a user
   */
  static async getActiveDeletionRequest(userId: string): Promise<DataDeletionRequest | null> {
    const supabase = getSupabaseClient();
    
    const { data: request, error } = await supabase
      .from('data_deletion_requests')
      .select('*')
      .eq('user_id', userId)
      .in('status', ['pending', 'confirmed', 'processing'])
      .order('requested_at', { ascending: false })
      .limit(1)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      log.error('Failed to get active deletion request', error);
      throw new Error(`Failed to get deletion request: ${error.message}`);
    }

    return request;
  }

  /**
   * Confirm deletion request with code
   */
  static async confirmDeletionRequest(
    requestId: string,
    confirmationCode: string
  ): Promise<{ success: boolean; message: string }> {
    const supabase = getSupabaseClient();
    
    const request = await this.getDeletionRequest(requestId);
    
    if (!request) {
      return { success: false, message: 'Deletion request not found' };
    }

    if (request.status !== 'pending') {
      return { success: false, message: 'Deletion request is not in pending status' };
    }

    if (request.confirmation_code !== confirmationCode) {
      return { success: false, message: 'Invalid confirmation code' };
    }

    // Calculate scheduled deletion date (30 days cooling-off period)
    const scheduledDeletionAt = new Date();
    scheduledDeletionAt.setDate(scheduledDeletionAt.getDate() + 30);

    const { error } = await supabase
      .from('data_deletion_requests')
      .update({
        status: 'confirmed',
        confirmed_at: new Date().toISOString(),
        scheduled_deletion_at: scheduledDeletionAt.toISOString(),
      })
      .eq('id', requestId);

    if (error) {
      log.error('Failed to confirm deletion request', error);
      throw new Error(`Failed to confirm deletion request: ${error.message}`);
    }

    log.info('Deletion request confirmed', { requestId, scheduledDeletionAt });

    return {
      success: true,
      message: `Account deletion confirmed. Your account will be deleted on ${scheduledDeletionAt.toLocaleDateString()}. You can cancel this request before then.`,
    };
  }

  /**
   * Cancel deletion request
   */
  static async cancelDeletionRequest(
    requestId: string,
    userId: string
  ): Promise<{ success: boolean; message: string }> {
    const supabase = getSupabaseClient();
    
    const request = await this.getDeletionRequest(requestId);
    
    if (!request) {
      return { success: false, message: 'Deletion request not found' };
    }

    if (request.user_id !== userId) {
      return { success: false, message: 'Unauthorized' };
    }

    if (!['pending', 'confirmed'].includes(request.status)) {
      return { success: false, message: 'Deletion request cannot be cancelled' };
    }

    const { error } = await supabase
      .from('data_deletion_requests')
      .update({
        status: 'cancelled',
        cancelled_at: new Date().toISOString(),
      })
      .eq('id', requestId);

    if (error) {
      log.error('Failed to cancel deletion request', error);
      throw new Error(`Failed to cancel deletion request: ${error.message}`);
    }

    log.info('Deletion request cancelled', { requestId, userId });

    return { success: true, message: 'Account deletion request cancelled successfully.' };
  }

  /**
   * Execute user data deletion
   * This should be called by a background job after the cooling-off period
   */
  static async executeDataDeletion(userId: string): Promise<void> {
    const supabase = getSupabaseClient();
    
    log.info('Starting data deletion execution', { userId });

    // Delete data from each table
    for (const table of USER_DATA_DELETE_TABLES) {
      try {
        const { error } = await supabase
          .from(table)
          .delete()
          .eq('user_id', userId);

        if (error) {
          log.warn(`Failed to delete from ${table}`, { error: error.message });
        } else {
          log.info(`Deleted data from ${table}`, { userId });
        }
      } catch (err) {
        log.warn(`Error deleting from ${table}`, { error: err });
      }
    }

    // Anonymize the user record instead of deleting (for audit trail)
    // Retain minimal data for legal/tax compliance
    const { error: userError } = await supabase
      .from('app_users')
      .update({
        email: `deleted_${userId}@alphaarena.com`,
        username: null,
        password_hash: '',
        metadata: { deleted: true, deleted_at: new Date().toISOString() },
        is_active: false,
      })
      .eq('id', userId);

    if (userError) {
      log.error('Failed to anonymize user', userError);
      throw new Error(`Failed to complete deletion: ${userError.message}`);
    }

    log.info('Data deletion completed', { userId });
  }

  /**
   * Get deletion requests pending execution
   */
  static async getPendingDeletions(): Promise<DataDeletionRequest[]> {
    const supabase = getSupabaseClient();
    const now = new Date().toISOString();
    
    const { data: requests, error } = await supabase
      .from('data_deletion_requests')
      .select('*')
      .eq('status', 'confirmed')
      .lte('scheduled_deletion_at', now);

    if (error) {
      log.error('Failed to get pending deletions', error);
      throw new Error(`Failed to get pending deletions: ${error.message}`);
    }

    return requests || [];
  }
}

/**
 * Sanitize sensitive fields from a row
 */
function sanitizeRow(row: Record<string, any>, table: string): Record<string, any> {
  const sanitized = { ...row };
  
  // Remove password hashes
  if ('password_hash' in sanitized) {
    delete sanitized.password_hash;
  }
  
  // Remove sensitive API keys
  if (table === 'exchange_accounts' && 'api_key' in sanitized) {
    delete sanitized.api_key;
    delete sanitized.api_secret;
  }
  
  if (table === 'api_keys' && 'key_hash' in sanitized) {
    delete sanitized.key_hash;
  }
  
  // Remove refresh tokens
  if ('refresh_token' in sanitized) {
    delete sanitized.refresh_token;
  }

  return sanitized;
}

export default GDPRDAO;