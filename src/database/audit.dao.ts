/**
 * Audit Log Data Access Object
 * Issue #641: Security Audit - API Permissions, Data Access Logging
 */

import { getSupabaseAdminClient } from './client';
import { createLogger } from '../utils/logger';

const log = createLogger('AuditDAO');

// Types
export type AuditActionCategory = 
  | 'auth'
  | 'data_access'
  | 'payment'
  | 'subscription'
  | 'export'
  | 'admin'
  | 'security';

export type AuditRiskLevel = 'low' | 'medium' | 'high' | 'critical';

export interface AuditLog {
  id: string;
  user_id?: string;
  user_email?: string;
  user_role?: string;
  action: string;
  action_category: AuditActionCategory;
  resource_type?: string;
  resource_id?: string;
  resource_owner_id?: string;
  ip_address?: string;
  user_agent?: string;
  request_method?: string;
  request_path?: string;
  request_params?: Record<string, any>;
  request_id?: string;
  response_status?: number;
  response_time_ms?: number;
  metadata?: Record<string, any>;
  is_sensitive?: boolean;
  risk_level?: AuditRiskLevel;
  created_at: string;
}

export interface CreateAuditLogInput {
  user_id?: string;
  user_email?: string;
  user_role?: string;
  action: string;
  action_category: AuditActionCategory;
  resource_type?: string;
  resource_id?: string;
  resource_owner_id?: string;
  ip_address?: string;
  user_agent?: string;
  request_method?: string;
  request_path?: string;
  request_params?: Record<string, any>;
  request_id?: string;
  response_status?: number;
  response_time_ms?: number;
  metadata?: Record<string, any>;
  is_sensitive?: boolean;
  risk_level?: AuditRiskLevel;
}

export interface AuditLogFilters {
  user_id?: string;
  action?: string;
  action_category?: AuditActionCategory;
  resource_type?: string;
  resource_id?: string;
  ip_address?: string;
  risk_level?: AuditRiskLevel;
  is_sensitive?: boolean;
  start_date?: string;
  end_date?: string;
  response_status_min?: number;
  response_status_max?: number;
}

export interface AuditLogQueryOptions extends AuditLogFilters {
  limit?: number;
  offset?: number;
  sort_by?: 'created_at' | 'response_time_ms' | 'risk_level';
  sort_order?: 'asc' | 'desc';
}

export interface DailyAuditStats {
  id: string;
  date: string;
  total_actions: number;
  auth_actions: number;
  data_access_actions: number;
  payment_actions: number;
  subscription_actions: number;
  export_actions: number;
  admin_actions: number;
  security_actions: number;
  high_risk_count: number;
  critical_risk_count: number;
  sensitive_actions: number;
  failed_requests: number;
  unique_users: number;
  unique_ips: number;
  top_actions: Record<string, number>;
  top_ips: Record<string, number>;
  calculated_at: string;
  created_at: string;
}

export interface SuspiciousActivity {
  risk_type: string;
  details: Record<string, any>;
}

// Predefined action configurations
export const SENSITIVE_ACTIONS: Record<string, { 
  category: AuditActionCategory; 
  risk_level: AuditRiskLevel;
  is_sensitive: boolean;
}> = {
  // Authentication
  'login': { category: 'auth', risk_level: 'low', is_sensitive: true },
  'login_failed': { category: 'auth', risk_level: 'medium', is_sensitive: true },
  'logout': { category: 'auth', risk_level: 'low', is_sensitive: false },
  'password_change': { category: 'security', risk_level: 'high', is_sensitive: true },
  'password_reset': { category: 'security', risk_level: 'medium', is_sensitive: true },
  'email_change': { category: 'security', risk_level: 'high', is_sensitive: true },
  'mfa_enabled': { category: 'security', risk_level: 'medium', is_sensitive: true },
  'mfa_disabled': { category: 'security', risk_level: 'high', is_sensitive: true },
  
  // Subscription
  'subscription_created': { category: 'subscription', risk_level: 'medium', is_sensitive: true },
  'subscription_upgraded': { category: 'subscription', risk_level: 'medium', is_sensitive: true },
  'subscription_downgraded': { category: 'subscription', risk_level: 'medium', is_sensitive: true },
  'subscription_canceled': { category: 'subscription', risk_level: 'high', is_sensitive: true },
  
  // Payment
  'payment_initiated': { category: 'payment', risk_level: 'medium', is_sensitive: true },
  'payment_completed': { category: 'payment', risk_level: 'low', is_sensitive: true },
  'payment_failed': { category: 'payment', risk_level: 'medium', is_sensitive: true },
  'refund_requested': { category: 'payment', risk_level: 'high', is_sensitive: true },
  
  // Data access
  'data_export': { category: 'export', risk_level: 'medium', is_sensitive: true },
  'data_delete': { category: 'export', risk_level: 'high', is_sensitive: true },
  'api_key_created': { category: 'security', risk_level: 'medium', is_sensitive: true },
  'api_key_revoked': { category: 'security', risk_level: 'medium', is_sensitive: true },
  
  // Admin
  'admin_user_update': { category: 'admin', risk_level: 'high', is_sensitive: true },
  'admin_role_change': { category: 'admin', risk_level: 'critical', is_sensitive: true },
  'admin_settings_change': { category: 'admin', risk_level: 'high', is_sensitive: true },
};

/**
 * Audit Log DAO
 */
export class AuditDAO {
  /**
   * Create an audit log entry
   */
  static async createAuditLog(input: CreateAuditLogInput): Promise<string> {
    try {
      const supabase = getSupabaseAdminClient();
      
      // Get action config if predefined
      const actionConfig = SENSITIVE_ACTIONS[input.action];
      
      // Apply defaults from action config
      const auditData = {
        ...input,
        action_category: input.action_category || actionConfig?.category || 'data_access',
        risk_level: input.risk_level || actionConfig?.risk_level || 'low',
        is_sensitive: input.is_sensitive ?? actionConfig?.is_sensitive ?? false,
      };
      
      const { data, error } = await supabase
        .from('audit_logs')
        .insert(auditData)
        .select('id')
        .single();
      
      if (error) {
        log.error('Failed to create audit log:', error);
        throw error;
      }
      
      log.debug(`Audit log created: ${data.id}`);
      return data.id;
    } catch (error) {
      log.error('Error creating audit log:', error);
      // Don't throw - audit logging should not break the request
      return '';
    }
  }
  
  /**
   * Get audit logs with filters and pagination
   */
  static async getAuditLogs(options: AuditLogQueryOptions = {}): Promise<{
    logs: AuditLog[];
    total: number;
  }> {
    try {
      const supabase = getSupabaseAdminClient();
      
      const {
        limit = 50,
        offset = 0,
        sort_by = 'created_at',
        sort_order = 'desc',
        ...filters
      } = options;
      
      let query = supabase
        .from('audit_logs')
        .select('*', { count: 'exact' });
      
      // Apply filters
      if (filters.user_id) {
        query = query.eq('user_id', filters.user_id);
      }
      if (filters.action) {
        query = query.eq('action', filters.action);
      }
      if (filters.action_category) {
        query = query.eq('action_category', filters.action_category);
      }
      if (filters.resource_type) {
        query = query.eq('resource_type', filters.resource_type);
      }
      if (filters.resource_id) {
        query = query.eq('resource_id', filters.resource_id);
      }
      if (filters.ip_address) {
        query = query.eq('ip_address', filters.ip_address);
      }
      if (filters.risk_level) {
        query = query.eq('risk_level', filters.risk_level);
      }
      if (filters.is_sensitive !== undefined) {
        query = query.eq('is_sensitive', filters.is_sensitive);
      }
      if (filters.start_date) {
        query = query.gte('created_at', filters.start_date);
      }
      if (filters.end_date) {
        query = query.lte('created_at', filters.end_date);
      }
      if (filters.response_status_min) {
        query = query.gte('response_status', filters.response_status_min);
      }
      if (filters.response_status_max) {
        query = query.lte('response_status', filters.response_status_max);
      }
      
      // Apply sorting and pagination
      query = query
        .order(sort_by, { ascending: sort_order === 'asc' })
        .range(offset, offset + limit - 1);
      
      const { data, error, count } = await query;
      
      if (error) {
        log.error('Failed to get audit logs:', error);
        throw error;
      }
      
      return {
        logs: data || [],
        total: count || 0,
      };
    } catch (error) {
      log.error('Error getting audit logs:', error);
      throw error;
    }
  }
  
  /**
   * Get a single audit log by ID
   */
  static async getAuditLogById(id: string): Promise<AuditLog | null> {
    try {
      const supabase = getSupabaseAdminClient();
      
      const { data, error } = await supabase
        .from('audit_logs')
        .select('*')
        .eq('id', id)
        .single();
      
      if (error) {
        if (error.code === 'PGRST116') {
          return null; // Not found
        }
        log.error('Failed to get audit log:', error);
        throw error;
      }
      
      return data;
    } catch (error) {
      log.error('Error getting audit log:', error);
      throw error;
    }
  }
  
  /**
   * Get audit logs for a specific user
   */
  static async getUserAuditLogs(
    userId: string, 
    options: Omit<AuditLogQueryOptions, 'user_id'> = {}
  ): Promise<{
    logs: AuditLog[];
    total: number;
  }> {
    return this.getAuditLogs({ ...options, user_id: userId });
  }
  
  /**
   * Get audit logs for a specific resource
   */
  static async getResourceAuditLogs(
    resourceType: string,
    resourceId: string,
    options: Omit<AuditLogQueryOptions, 'resource_type' | 'resource_id'> = {}
  ): Promise<{
    logs: AuditLog[];
    total: number;
  }> {
    return this.getAuditLogs({ ...options, resource_type: resourceType, resource_id: resourceId });
  }
  
  /**
   * Get daily audit statistics
   */
  static async getDailyStats(startDate?: string, endDate?: string): Promise<DailyAuditStats[]> {
    try {
      const supabase = getSupabaseAdminClient();
      
      let query = supabase
        .from('daily_audit_stats')
        .select('*')
        .order('date', { ascending: false });
      
      if (startDate) {
        query = query.gte('date', startDate);
      }
      if (endDate) {
        query = query.lte('date', endDate);
      }
      
      const { data, error } = await query;
      
      if (error) {
        log.error('Failed to get daily audit stats:', error);
        throw error;
      }
      
      return data || [];
    } catch (error) {
      log.error('Error getting daily audit stats:', error);
      throw error;
    }
  }
  
  /**
   * Get today's statistics
   */
  static async getTodayStats(): Promise<DailyAuditStats | null> {
    try {
      const supabase = getSupabaseAdminClient();
      const today = new Date().toISOString().split('T')[0];
      
      const { data, error } = await supabase
        .from('daily_audit_stats')
        .select('*')
        .eq('date', today)
        .single();
      
      if (error) {
        if (error.code === 'PGRST116') {
          return null;
        }
        throw error;
      }
      
      return data;
    } catch (error) {
      log.error('Error getting today stats:', error);
      return null;
    }
  }
  
  /**
   * Detect suspicious activity
   */
  static async detectSuspiciousActivity(
    userId?: string,
    ipAddress?: string,
    timeWindowHours: number = 24
  ): Promise<SuspiciousActivity[]> {
    try {
      const supabase = getSupabaseAdminClient();
      
      const { data, error } = await supabase.rpc('detect_suspicious_activity', {
        p_user_id: userId,
        p_ip_address: ipAddress,
        p_time_window_hours: timeWindowHours,
      });
      
      if (error) {
        log.error('Failed to detect suspicious activity:', error);
        throw error;
      }
      
      return data || [];
    } catch (error) {
      log.error('Error detecting suspicious activity:', error);
      return [];
    }
  }
  
  /**
   * Aggregate daily stats for a specific date
   */
  static async aggregateDailyStats(date?: string): Promise<void> {
    try {
      const supabase = getSupabaseAdminClient();
      const targetDate = date || new Date().toISOString().split('T')[0];
      
      const { error } = await supabase.rpc('aggregate_daily_audit_stats', {
        target_date: targetDate,
      });
      
      if (error) {
        log.error('Failed to aggregate daily stats:', error);
        throw error;
      }
      
      log.info(`Aggregated audit stats for ${targetDate}`);
    } catch (error) {
      log.error('Error aggregating daily stats:', error);
    }
  }
  
  /**
   * Clean old audit logs
   */
  static async cleanOldLogs(daysToKeep: number = 365): Promise<number> {
    try {
      const supabase = getSupabaseAdminClient();
      
      const { data, error } = await supabase.rpc('clean_old_audit_logs', {
        days_to_keep: daysToKeep,
      });
      
      if (error) {
        log.error('Failed to clean old audit logs:', error);
        throw error;
      }
      
      const deletedCount = data || 0;
      log.info(`Cleaned ${deletedCount} old audit logs`);
      return deletedCount;
    } catch (error) {
      log.error('Error cleaning old audit logs:', error);
      return 0;
    }
  }
  
  /**
   * Get audit summary for a user
   */
  static async getUserAuditSummary(userId: string, days: number = 30): Promise<{
    total_actions: number;
    sensitive_actions: number;
    last_login?: string;
    last_activity?: string;
    top_actions: Record<string, number>;
  }> {
    try {
      const supabase = getSupabaseAdminClient();
      const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
      
      // Get total and sensitive counts
      const { data: countData, error: countError } = await supabase
        .from('audit_logs')
        .select('action, is_sensitive, created_at')
        .eq('user_id', userId)
        .gte('created_at', startDate);
      
      if (countError) {
        throw countError;
      }
      
      const logs = countData || [];
      const total_actions = logs.length;
      const sensitive_actions = logs.filter(l => l.is_sensitive).length;
      
      // Get last login
      const lastLogin = logs.find(l => l.action === 'login');
      const lastActivity = logs[0]; // Most recent due to default ordering
      
      // Count actions
      const topActions: Record<string, number> = {};
      for (const log of logs) {
        topActions[log.action] = (topActions[log.action] || 0) + 1;
      }
      
      return {
        total_actions,
        sensitive_actions,
        last_login: lastLogin?.created_at,
        last_activity: lastActivity?.created_at,
        top_actions: topActions,
      };
    } catch (error) {
      log.error('Error getting user audit summary:', error);
      return {
        total_actions: 0,
        sensitive_actions: 0,
        top_actions: {},
      };
    }
  }
}

export default AuditDAO;