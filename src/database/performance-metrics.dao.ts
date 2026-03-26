/**
 * Performance Metrics DAO
 * 
 * Handles storage and retrieval of mobile/web performance metrics
 * for the performance monitoring dashboard.
 * 
 * Uses admin client to bypass RLS for server-side queries.
 */

import { getSupabaseAdminClient } from './client';
import type { SupabaseClient } from '@supabase/supabase-js';

// Core Web Vitals and custom metrics
export interface PerformanceMetric {
  id: string;
  user_id?: string;
  session_id: string;
  
  // Core Web Vitals
  fcp?: number;  // First Contentful Paint (ms)
  lcp?: number;  // Largest Contentful Paint (ms)
  fid?: number;  // First Input Delay (ms)
  cls?: number;  // Cumulative Layout Shift (score)
  ttfb?: number; // Time to First Byte (ms)
  inp?: number;  // Interaction to Next Paint (ms)
  
  // Custom metrics
  tti?: number;         // Time to Interactive (ms)
  memory_used?: number;   // JS Heap Size (bytes)
  memory_limit?: number;  // JS Heap Limit (bytes)
  
  // Network metrics
  api_latency?: number;    // Average API latency (ms)
  ws_latency?: number;    // WebSocket latency (ms)
  ws_connected?: boolean; // WebSocket connection status
  
  // Page/App context
  page: string;           // Current page/route
  route?: string;         // Route name
  
  // Device/Environment info
  device_type: 'mobile' | 'tablet' | 'desktop';
  os?: string;
  browser?: string;
  screen_width?: number;
  screen_height?: number;
  connection_type?: string; // 4g, 3g, wifi, etc.
  effective_type?: string;  // slow-2g, 2g, 3g, 4g
  
  // Timestamps
  created_at: string;
  
  // Additional context
  user_agent?: string;
  referrer?: string;
}

export interface CreatePerformanceMetricInput {
  user_id?: string;
  session_id: string;
  fcp?: number;
  lcp?: number;
  fid?: number;
  cls?: number;
  ttfb?: number;
  inp?: number;
  tti?: number;
  memory_used?: number;
  memory_limit?: number;
  api_latency?: number;
  ws_latency?: number;
  ws_connected?: boolean;
  page: string;
  route?: string;
  device_type: 'mobile' | 'tablet' | 'desktop';
  os?: string;
  browser?: string;
  screen_width?: number;
  screen_height?: number;
  connection_type?: string;
  effective_type?: string;
  user_agent?: string;
  referrer?: string;
}

export interface PerformanceFilters {
  user_id?: string;
  device_type?: 'mobile' | 'tablet' | 'desktop';
  page?: string;
  start_date?: string;
  end_date?: string;
  limit?: number;
  offset?: number;
}

export interface AggregatedMetrics {
  period: string;
  avg_fcp: number;
  avg_lcp: number;
  avg_fid: number;
  avg_cls: number;
  avg_tti: number;
  avg_api_latency: number;
  avg_ws_latency: number;
  p50_fcp: number;
  p50_lcp: number;
  p75_fcp: number;
  p75_lcp: number;
  p95_fcp: number;
  p95_lcp: number;
  sample_count: number;
  error_count: number;
}

export interface DeviceDistribution {
  device_type: string;
  count: number;
  percentage: number;
  avg_lcp: number;
  avg_fcp: number;
}

export interface ConnectionDistribution {
  connection_type: string;
  count: number;
  percentage: number;
  avg_latency: number;
}

export interface PerformanceAlert {
  id: string;
  metric_type: string;
  threshold_value: number;
  current_value: number;
  severity: 'warning' | 'critical';
  page?: string;
  device_type?: string;
  created_at: string;
  resolved: boolean;
  resolved_at?: string;
}

export class PerformanceMetricsDAO {
  private client: SupabaseClient;

  constructor() {
    // Use admin client to bypass RLS for server-side queries
    // This is necessary because server-side API calls don't have user JWT context
    this.client = getSupabaseAdminClient();
  }

  /**
   * Insert a new performance metric
   */
  async create(data: CreatePerformanceMetricInput): Promise<PerformanceMetric> {
    const { data: result, error } = await this.client
      .from('performance_metrics')
      .insert({
        ...data,
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating performance metric:', error);
      throw error;
    }

    return result;
  }

  /**
   * Batch insert performance metrics
   */
  async createBatch(metrics: CreatePerformanceMetricInput[]): Promise<PerformanceMetric[]> {
    const { data: result, error } = await this.client
      .from('performance_metrics')
      .insert(metrics.map(m => ({
        ...m,
        created_at: new Date().toISOString(),
      })))
      .select();

    if (error) {
      console.error('Error batch creating performance metrics:', error);
      throw error;
    }

    return result || [];
  }

  /**
   * Get metrics with filters
   */
  async getMetrics(filters: PerformanceFilters): Promise<PerformanceMetric[]> {
    let query = this.client
      .from('performance_metrics')
      .select('*');

    if (filters.user_id) {
      query = query.eq('user_id', filters.user_id);
    }
    if (filters.device_type) {
      query = query.eq('device_type', filters.device_type);
    }
    if (filters.page) {
      query = query.eq('page', filters.page);
    }
    if (filters.start_date) {
      query = query.gte('created_at', filters.start_date);
    }
    if (filters.end_date) {
      query = query.lte('created_at', filters.end_date);
    }

    query = query.order('created_at', { ascending: false });

    if (filters.limit) {
      query = query.limit(filters.limit);
    }
    if (filters.offset) {
      query = query.range(filters.offset, filters.offset + (filters.limit || 100) - 1);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching performance metrics:', error);
      throw error;
    }

    return data || [];
  }

  /**
   * Get aggregated metrics for a time period
   */
  async getAggregatedMetrics(
    startDate: string,
    endDate: string,
    granularity: 'hour' | 'day' | 'week' = 'day'
  ): Promise<AggregatedMetrics[]> {
    const { data, error } = await this.client
      .rpc('get_aggregated_performance_metrics', {
        start_date: startDate,
        end_date: endDate,
        granularity,
      });

    if (error) {
      console.error('Error fetching aggregated metrics:', error);
      // Return empty array if RPC doesn't exist yet
      return [];
    }

    return data || [];
  }

  /**
   * Get device type distribution
   */
  async getDeviceDistribution(startDate?: string, endDate?: string): Promise<DeviceDistribution[]> {
    let query = this.client
      .from('performance_metrics')
      .select('device_type, lcp, fcp');

    if (startDate) {
      query = query.gte('created_at', startDate);
    }
    if (endDate) {
      query = query.lte('created_at', endDate);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching device distribution:', error);
      return [];
    }

    // Aggregate by device type
    const grouped: Record<string, { count: number; lcpSum: number; fcpSum: number }> = {};
    const total = data?.length || 0;

    for (const row of data || []) {
      const type = row.device_type || 'unknown';
      if (!grouped[type]) {
        grouped[type] = { count: 0, lcpSum: 0, fcpSum: 0 };
      }
      grouped[type].count++;
      if (row.lcp) grouped[type].lcpSum += row.lcp;
      if (row.fcp) grouped[type].fcpSum += row.fcp;
    }

    return Object.entries(grouped).map(([device_type, stats]) => ({
      device_type,
      count: stats.count,
      percentage: total > 0 ? (stats.count / total) * 100 : 0,
      avg_lcp: stats.count > 0 ? stats.lcpSum / stats.count : 0,
      avg_fcp: stats.count > 0 ? stats.fcpSum / stats.count : 0,
    }));
  }

  /**
   * Get connection type distribution
   */
  async getConnectionDistribution(startDate?: string, endDate?: string): Promise<ConnectionDistribution[]> {
    let query = this.client
      .from('performance_metrics')
      .select('connection_type, effective_type, api_latency');

    if (startDate) {
      query = query.gte('created_at', startDate);
    }
    if (endDate) {
      query = query.lte('created_at', endDate);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching connection distribution:', error);
      return [];
    }

    // Aggregate by connection type
    const grouped: Record<string, { count: number; latencySum: number }> = {};
    const total = data?.length || 0;

    for (const row of data || []) {
      const type = row.effective_type || row.connection_type || 'unknown';
      if (!grouped[type]) {
        grouped[type] = { count: 0, latencySum: 0 };
      }
      grouped[type].count++;
      if (row.api_latency) grouped[type].latencySum += row.api_latency;
    }

    return Object.entries(grouped).map(([connection_type, stats]) => ({
      connection_type,
      count: stats.count,
      percentage: total > 0 ? (stats.count / total) * 100 : 0,
      avg_latency: stats.count > 0 ? stats.latencySum / stats.count : 0,
    }));
  }

  /**
   * Get page-level performance stats
   */
  async getPagePerformance(startDate?: string, endDate?: string): Promise<{
    page: string;
    count: number;
    avg_lcp: number;
    avg_fcp: number;
    avg_fid: number;
    avg_cls: number;
    avg_tti: number;
  }[]> {
    let query = this.client
      .from('performance_metrics')
      .select('page, lcp, fcp, fid, cls, tti');

    if (startDate) {
      query = query.gte('created_at', startDate);
    }
    if (endDate) {
      query = query.lte('created_at', endDate);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching page performance:', error);
      return [];
    }

    // Aggregate by page
    const grouped: Record<string, { 
      count: number; 
      lcpSum: number; 
      fcpSum: number; 
      fidSum: number; 
      clsSum: number; 
      ttiSum: number;
    }> = {};

    for (const row of data || []) {
      const page = row.page || 'unknown';
      if (!grouped[page]) {
        grouped[page] = { count: 0, lcpSum: 0, fcpSum: 0, fidSum: 0, clsSum: 0, ttiSum: 0 };
      }
      grouped[page].count++;
      if (row.lcp) grouped[page].lcpSum += row.lcp;
      if (row.fcp) grouped[page].fcpSum += row.fcp;
      if (row.fid) grouped[page].fidSum += row.fid;
      if (row.cls) grouped[page].clsSum += row.cls;
      if (row.tti) grouped[page].ttiSum += row.tti;
    }

    return Object.entries(grouped).map(([page, stats]) => ({
      page,
      count: stats.count,
      avg_lcp: stats.count > 0 ? stats.lcpSum / stats.count : 0,
      avg_fcp: stats.count > 0 ? stats.fcpSum / stats.count : 0,
      avg_fid: stats.count > 0 ? stats.fidSum / stats.count : 0,
      avg_cls: stats.count > 0 ? stats.clsSum / stats.count : 0,
      avg_tti: stats.count > 0 ? stats.ttiSum / stats.count : 0,
    }));
  }

  /**
   * Get performance summary
   */
  async getSummary(startDate?: string, endDate?: string): Promise<{
    total_samples: number;
    unique_sessions: number;
    unique_users: number;
    avg_lcp: number;
    avg_fcp: number;
    avg_fid: number;
    avg_cls: number;
    avg_tti: number;
    avg_api_latency: number;
    mobile_samples: number;
    desktop_samples: number;
    tablet_samples: number;
    good_lcp_percent: number;  // < 2.5s
    needs_improvement_lcp_percent: number; // 2.5s - 4s
    poor_lcp_percent: number; // > 4s
    good_fcp_percent: number;  // < 1.8s
    needs_improvement_fcp_percent: number; // 1.8s - 3s
    poor_fcp_percent: number; // > 3s
  }> {
    let query = this.client
      .from('performance_metrics')
      .select('session_id, user_id, lcp, fcp, fid, cls, tti, api_latency, device_type');

    if (startDate) {
      query = query.gte('created_at', startDate);
    }
    if (endDate) {
      query = query.lte('created_at', endDate);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching performance summary:', error);
      return {
        total_samples: 0,
        unique_sessions: 0,
        unique_users: 0,
        avg_lcp: 0,
        avg_fcp: 0,
        avg_fid: 0,
        avg_cls: 0,
        avg_tti: 0,
        avg_api_latency: 0,
        mobile_samples: 0,
        desktop_samples: 0,
        tablet_samples: 0,
        good_lcp_percent: 0,
        needs_improvement_lcp_percent: 0,
        poor_lcp_percent: 0,
        good_fcp_percent: 0,
        needs_improvement_fcp_percent: 0,
        poor_fcp_percent: 0,
      };
    }

    const samples = data || [];
    const sessions = new Set(samples.map(s => s.session_id).filter(Boolean));
    const users = new Set(samples.map(s => s.user_id).filter(Boolean));

    const avgField = (field: string) => {
      const values = samples.map(s => (s as any)[field]).filter(v => v != null);
      return values.length > 0 ? values.reduce((a: number, b: number) => a + b, 0) / values.length : 0;
    };

    const lcpValues = samples.map(s => s.lcp).filter(v => v != null) as number[];
    const fcpValues = samples.map(s => s.fcp).filter(v => v != null) as number[];

    const classifyLcp = (lcp: number) => {
      if (lcp <= 2500) return 'good';
      if (lcp <= 4000) return 'needs_improvement';
      return 'poor';
    };

    const classifyFcp = (fcp: number) => {
      if (fcp <= 1800) return 'good';
      if (fcp <= 3000) return 'needs_improvement';
      return 'poor';
    };

    const lcpClassification = { good: 0, needs_improvement: 0, poor: 0 };
    const fcpClassification = { good: 0, needs_improvement: 0, poor: 0 };

    for (const lcp of lcpValues) {
      lcpClassification[classifyLcp(lcp)]++;
    }
    for (const fcp of fcpValues) {
      fcpClassification[classifyFcp(fcp)]++;
    }

    const lcpTotal = lcpValues.length || 1;
    const fcpTotal = fcpValues.length || 1;

    return {
      total_samples: samples.length,
      unique_sessions: sessions.size,
      unique_users: users.size,
      avg_lcp: avgField('lcp'),
      avg_fcp: avgField('fcp'),
      avg_fid: avgField('fid'),
      avg_cls: avgField('cls'),
      avg_tti: avgField('tti'),
      avg_api_latency: avgField('api_latency'),
      mobile_samples: samples.filter(s => s.device_type === 'mobile').length,
      desktop_samples: samples.filter(s => s.device_type === 'desktop').length,
      tablet_samples: samples.filter(s => s.device_type === 'tablet').length,
      good_lcp_percent: (lcpClassification.good / lcpTotal) * 100,
      needs_improvement_lcp_percent: (lcpClassification.needs_improvement / lcpTotal) * 100,
      poor_lcp_percent: (lcpClassification.poor / lcpTotal) * 100,
      good_fcp_percent: (fcpClassification.good / fcpTotal) * 100,
      needs_improvement_fcp_percent: (fcpClassification.needs_improvement / fcpTotal) * 100,
      poor_fcp_percent: (fcpClassification.poor / fcpTotal) * 100,
    };
  }

  /**
   * Clean up old metrics (keep last 30 days)
   */
  async cleanupOldData(daysToKeep: number = 30): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    const { data, error } = await this.client
      .from('performance_metrics')
      .delete()
      .select('id')
      .lt('created_at', cutoffDate.toISOString());

    if (error) {
      console.error('Error cleaning up old performance metrics:', error);
      return 0;
    }

    return data?.length || 0;
  }
}

// Singleton instance
let performanceMetricsDAO: PerformanceMetricsDAO | null = null;

export function getPerformanceMetricsDAO(): PerformanceMetricsDAO {
  if (!performanceMetricsDAO) {
    performanceMetricsDAO = new PerformanceMetricsDAO();
  }
  return performanceMetricsDAO;
}