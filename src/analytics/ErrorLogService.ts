/**
 * Error Log Service
 *
 * Collects and aggregates error logs for analytics
 * Integrates with the user tracking system for comprehensive analysis
 *
 * @module analytics/ErrorLogService
 */

import { getSupabaseAdminClient } from '../database/client';
import { userTrackingService } from './UserTrackingService';
import { createLogger } from '../utils/logger';
import { ErrorCode, AppError } from '../utils/AppError';

const log = createLogger('ErrorLogService');

/**
 * Error log entry
 */
export interface ErrorLogEntry {
  id?: string;
  timestamp: Date;
  errorCode: ErrorCode | string;
  errorName: string;
  message: string;
  stack?: string;
  userId?: string;
  sessionId?: string;
  requestId?: string;
  path?: string;
  method?: string;
  statusCode: number;
  details?: Record<string, any>;
  environment?: {
    userAgent?: string;
    ip?: string;
    browser?: string;
    os?: string;
    device?: string;
  };
  recovered?: boolean;
  recoveryAction?: string;
}

/**
 * Error summary for analytics
 */
export interface ErrorSummary {
  totalErrors: number;
  uniqueErrors: number;
  byErrorCode: Array<{ code: string; count: number; percentage: number }>;
  byPath: Array<{ path: string; count: number }>;
  byUser: Array<{ userId: string; count: number }>;
  recentErrors: ErrorLogEntry[];
  errorRate: number; // errors per 1000 requests
  trend: 'up' | 'down' | 'stable';
}

/**
 * Error trend data
 */
export interface ErrorTrend {
  date: string;
  count: number;
  byCode: Record<string, number>;
}

/**
 * Error Log Service
 */
class ErrorLogService {
  /**
   * Log an error to the database
   */
  async logError(error: ErrorLogEntry): Promise<ErrorLogEntry> {
    const supabase = getSupabaseAdminClient();

    // Parse user agent
    const environment = error.environment || {};
    const parsedEnv = this.parseUserAgent(environment.userAgent || '');

    const { data, error: dbError } = await supabase
      .from('error_logs')
      .insert({
        timestamp: error.timestamp || new Date(),
        error_code: error.errorCode,
        error_name: error.errorName,
        message: error.message,
        stack: error.stack,
        user_id: error.userId,
        session_id: error.sessionId,
        request_id: error.requestId,
        path: error.path,
        method: error.method,
        status_code: error.statusCode,
        details: error.details || {},
        user_agent: environment.userAgent,
        ip: environment.ip,
        browser: parsedEnv.browser,
        os: parsedEnv.os,
        device: parsedEnv.device,
        recovered: error.recovered || false,
        recovery_action: error.recoveryAction,
      })
      .select()
      .single();

    if (dbError) {
      log.error('Failed to log error:', dbError);
      // Don't throw, just log - we don't want to break the app
      return error;
    }

    // Also track as a user tracking event
    try {
      await userTrackingService.trackEvent(
        {
          eventType: 'error',
          eventName: error.errorName,
          eventCategory: 'error',
          properties: {
            errorCode: error.errorCode,
            statusCode: error.statusCode,
            path: error.path,
            message: error.message,
          },
        },
        {
          sessionId: error.sessionId || '',
          userId: error.userId,
          pageUrl: error.path || '',
          pageTitle: '',
          userAgent: environment.userAgent || '',
          deviceId: '',
          screenResolution: '',
          viewportSize: '',
          language: '',
          timezone: '',
        }
      );
    } catch (trackError) {
      log.warn('Failed to track error event:', trackError);
    }

    return {
      ...error,
      id: data?.id,
    };
  }

  /**
   * Log an AppError
   */
  async logAppError(
    appError: AppError,
    context: {
      userId?: string;
      sessionId?: string;
      requestId?: string;
      path?: string;
      method?: string;
      userAgent?: string;
      ip?: string;
    }
  ): Promise<ErrorLogEntry> {
    return this.logError({
      timestamp: new Date(),
      errorCode: appError.code,
      errorName: appError.name,
      message: appError.message,
      stack: appError.stack,
      statusCode: appError.statusCode,
      details: appError.details,
      ...context,
      environment: {
        userAgent: context.userAgent,
        ip: context.ip,
      },
    });
  }

  /**
   * Get error summary
   */
  async getErrorSummary(days: number = 7): Promise<ErrorSummary> {
    const supabase = getSupabaseAdminClient();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const { data: errors, error } = await supabase
      .from('error_logs')
      .select('*')
      .gte('timestamp', startDate.toISOString())
      .order('timestamp', { ascending: false });

    if (error) {
      log.error('Failed to get error summary:', error);
      throw new Error(`Failed to get error summary: ${error.message}`);
    }

    const errorList = errors || [];

    // Calculate summary
    const byErrorCode = new Map<string, number>();
    const byPath = new Map<string, number>();
    const byUser = new Map<string, number>();
    const uniqueMessages = new Set<string>();

    for (const e of errorList) {
      // By error code
      const code = e.error_code || 'UNKNOWN';
      byErrorCode.set(code, (byErrorCode.get(code) || 0) + 1);

      // By path
      if (e.path) {
        byPath.set(e.path, (byPath.get(e.path) || 0) + 1);
      }

      // By user
      if (e.user_id) {
        byUser.set(e.user_id, (byUser.get(e.user_id) || 0) + 1);
      }

      // Unique errors (by message)
      uniqueMessages.add(e.message);
    }

    const totalErrors = errorList.length;
    const totalRequests = await this.getTotalRequests(startDate);

    // Calculate trend
    const trend = await this.calculateTrend(days);

    return {
      totalErrors,
      uniqueErrors: uniqueMessages.size,
      byErrorCode: Array.from(byErrorCode.entries())
        .map(([code, count]) => ({
          code,
          count,
          percentage: totalErrors > 0 ? (count / totalErrors) * 100 : 0,
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10),
      byPath: Array.from(byPath.entries())
        .map(([path, count]) => ({ path, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10),
      byUser: Array.from(byUser.entries())
        .map(([userId, count]) => ({ userId, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10),
      recentErrors: errorList.slice(0, 20).map(this.mapFromDb),
      errorRate: totalRequests > 0 ? (totalErrors / totalRequests) * 1000 : 0,
      trend,
    };
  }

  /**
   * Get error trends
   */
  async getErrorTrends(days: number = 30): Promise<ErrorTrend[]> {
    const supabase = getSupabaseAdminClient();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const { data, error } = await supabase
      .from('error_logs')
      .select('timestamp, error_code')
      .gte('timestamp', startDate.toISOString())
      .order('timestamp', { ascending: true });

    if (error) {
      log.error('Failed to get error trends:', error);
      throw new Error(`Failed to get error trends: ${error.message}`);
    }

    // Group by day
    const dailyData = new Map<string, { count: number; byCode: Record<string, number> }>();

    for (const e of data || []) {
      const date = new Date(e.timestamp).toISOString().split('T')[0];
      const existing = dailyData.get(date) || { count: 0, byCode: {} };
      existing.count++;
      const code = e.error_code || 'UNKNOWN';
      existing.byCode[code] = (existing.byCode[code] || 0) + 1;
      dailyData.set(date, existing);
    }

    return Array.from(dailyData.entries())
      .map(([date, data]) => ({
        date,
        count: data.count,
        byCode: data.byCode,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  /**
   * Get errors for a specific user
   */
  async getUserErrors(userId: string, limit: number = 50): Promise<ErrorLogEntry[]> {
    const supabase = getSupabaseAdminClient();

    const { data, error } = await supabase
      .from('error_logs')
      .select('*')
      .eq('user_id', userId)
      .order('timestamp', { ascending: false })
      .limit(limit);

    if (error) {
      log.error('Failed to get user errors:', error);
      throw new Error(`Failed to get user errors: ${error.message}`);
    }

    return (data || []).map(this.mapFromDb);
  }

  /**
   * Get critical errors (5xx)
   */
  async getCriticalErrors(hours: number = 24): Promise<ErrorLogEntry[]> {
    const supabase = getSupabaseAdminClient();
    const startDate = new Date();
    startDate.setHours(startDate.getHours() - hours);

    const { data, error } = await supabase
      .from('error_logs')
      .select('*')
      .gte('status_code', 500)
      .gte('timestamp', startDate.toISOString())
      .order('timestamp', { ascending: false });

    if (error) {
      log.error('Failed to get critical errors:', error);
      throw new Error(`Failed to get critical errors: ${error.message}`);
    }

    return (data || []).map(this.mapFromDb);
  }

  /**
   * Mark error as recovered
   */
  async markRecovered(errorId: string, recoveryAction?: string): Promise<void> {
    const supabase = getSupabaseAdminClient();

    const { error } = await supabase
      .from('error_logs')
      .update({
        recovered: true,
        recovery_action: recoveryAction,
      })
      .eq('id', errorId);

    if (error) {
      log.error('Failed to mark error as recovered:', error);
      throw new Error(`Failed to mark error as recovered: ${error.message}`);
    }
  }

  /**
   * Clean up old error logs
   */
  async cleanupOldErrors(olderThanDays: number = 90): Promise<number> {
    const supabase = getSupabaseAdminClient();
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    const { data, error } = await supabase
      .from('error_logs')
      .delete()
      .lt('timestamp', cutoffDate.toISOString())
      .select('id');

    if (error) {
      log.error('Failed to cleanup old errors:', error);
      throw new Error(`Failed to cleanup old errors: ${error.message}`);
    }

    return data?.length || 0;
  }

  /**
   * Aggregate daily error statistics
   */
  async runDailyAggregation(date?: Date): Promise<void> {
    const targetDate = date || new Date(Date.now() - 24 * 60 * 60 * 1000);
    const dateStr = targetDate.toISOString().split('T')[0];

    const supabase = getSupabaseAdminClient();

    // Get error counts for the day
    const { data: errors } = await supabase
      .from('error_logs')
      .select('error_code, status_code')
      .gte('timestamp', `${dateStr}T00:00:00Z`)
      .lte('timestamp', `${dateStr}T23:59:59Z`);

    const errorCounts = {
      total: errors?.length || 0,
      byCode: {} as Record<string, number>,
      byStatus: {} as Record<number, number>,
    };

    for (const e of errors || []) {
      const code = e.error_code || 'UNKNOWN';
      errorCounts.byCode[code] = (errorCounts.byCode[code] || 0) + 1;
      errorCounts.byStatus[e.status_code] = (errorCounts.byStatus[e.status_code] || 0) + 1;
    }

    // Store aggregation
    const { error } = await supabase
      .from('daily_error_stats')
      .upsert({
        date: dateStr,
        total_errors: errorCounts.total,
        errors_by_code: errorCounts.byCode,
        errors_by_status: errorCounts.byStatus,
        calculated_at: new Date(),
      });

    if (error) {
      log.error('Failed to store daily error stats:', error);
      throw new Error(`Failed to store daily error stats: ${error.message}`);
    }

    log.info('Daily error aggregation completed', { date: dateStr, total: errorCounts.total });
  }

  // ============== Private Methods ==============

  private async getTotalRequests(startDate: Date): Promise<number> {
    const supabase = getSupabaseAdminClient();

    const { count } = await supabase
      .from('user_tracking_events')
      .select('*', { count: 'exact', head: true })
      .gte('occurred_at', startDate.toISOString());

    return count || 0;
  }

  private async calculateTrend(days: number): Promise<'up' | 'down' | 'stable'> {
    const midPoint = Math.floor(days / 2);
    const endDate = new Date();
    const midDate = new Date();
    midDate.setDate(midDate.getDate() - midPoint);
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const supabase = getSupabaseAdminClient();

    // First half
    const { count: firstHalf } = await supabase
      .from('error_logs')
      .select('*', { count: 'exact', head: true })
      .gte('timestamp', startDate.toISOString())
      .lt('timestamp', midDate.toISOString());

    // Second half
    const { count: secondHalf } = await supabase
      .from('error_logs')
      .select('*', { count: 'exact', head: true })
      .gte('timestamp', midDate.toISOString())
      .lte('timestamp', endDate.toISOString());

    const first = firstHalf || 0;
    const second = secondHalf || 0;

    if (first === 0) return second > 0 ? 'up' : 'stable';

    const changePercent = ((second - first) / first) * 100;

    if (changePercent > 10) return 'up';
    if (changePercent < -10) return 'down';
    return 'stable';
  }

  private parseUserAgent(userAgent: string): { browser: string; os: string; device: string } {
    const ua = userAgent.toLowerCase();

    // Browser detection
    let browser = 'Unknown';
    if (ua.includes('firefox')) browser = 'Firefox';
    else if (ua.includes('edg')) browser = 'Edge';
    else if (ua.includes('chrome')) browser = 'Chrome';
    else if (ua.includes('safari')) browser = 'Safari';
    else if (ua.includes('opera') || ua.includes('opr')) browser = 'Opera';

    // OS detection (check iOS/iPhone/iPad before macOS since they contain "Mac OS X")
    let os = 'Unknown';
    if (ua.includes('windows')) os = 'Windows';
    else if (ua.includes('iphone') || ua.includes('ipad') || ua.includes('ios')) os = 'iOS';
    else if (ua.includes('mac os') || ua.includes('macos')) os = 'macOS';
    else if (ua.includes('android')) os = 'Android';
    else if (ua.includes('linux')) os = 'Linux';

    // Device type
    let device = 'Desktop';
    if (ua.includes('mobile') || ua.includes('android') || ua.includes('iphone')) {
      device = 'Mobile';
    } else if (ua.includes('tablet') || ua.includes('ipad')) {
      device = 'Tablet';
    }

    return { browser, os, device };
  }

  private mapFromDb(data: any): ErrorLogEntry {
    return {
      id: data.id,
      timestamp: new Date(data.timestamp),
      errorCode: data.error_code,
      errorName: data.error_name,
      message: data.message,
      stack: data.stack,
      userId: data.user_id,
      sessionId: data.session_id,
      requestId: data.request_id,
      path: data.path,
      method: data.method,
      statusCode: data.status_code,
      details: data.details,
      environment: {
        userAgent: data.user_agent,
        ip: data.ip,
        browser: data.browser,
        os: data.os,
        device: data.device,
      },
      recovered: data.recovered,
      recoveryAction: data.recovery_action,
    };
  }
}

// Singleton instance
export { ErrorLogService };
export const errorLogService = new ErrorLogService();
export default errorLogService;