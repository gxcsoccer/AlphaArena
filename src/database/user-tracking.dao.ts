/**
 * User Tracking DAO
 *
 * Data access layer for user behavior tracking and analytics
 *
 * @module database/user-tracking.dao
 */

import { getSupabaseAdminClient } from './client';
import { createLogger } from '../utils/logger';
import {
  TrackingEvent,
  UserSession,
  DailyAnalyticsSummary,
  UserAnalyticsQueryOptions,
  EventCountResult,
  UserEngagementMetrics,
  FunnelStep,
  FunnelAnalysis,
} from '../analytics/userTracking.types';

const log = createLogger('UserTrackingDAO');

/**
 * User Tracking Data Access Object
 */
class UserTrackingDAO {
  /**
   * Track a single event
   */
  async trackEvent(event: TrackingEvent): Promise<TrackingEvent> {
    const supabase = getSupabaseAdminClient();
    
    const { data, error } = await supabase
      .from('user_tracking_events')
      .insert({
        user_id: event.userId,
        session_id: event.sessionId,
        device_id: event.deviceId,
        event_type: event.eventType,
        event_category: event.eventCategory,
        event_name: event.eventName,
        properties: event.properties || {},
        page_url: event.pageUrl,
        page_title: event.pageTitle,
        referrer: event.referrer,
        user_agent: event.userAgent,
        screen_resolution: event.screenResolution,
        viewport_size: event.viewportSize,
        language: event.language,
        timezone: event.timezone,
        country: event.country,
        region: event.region,
        city: event.city,
        load_time_ms: event.loadTimeMs,
        occurred_at: event.occurredAt || new Date(),
      })
      .select()
      .single();
    
    if (error) {
      log.error('Failed to track event:', error);
      throw new Error(`Failed to track event: ${error.message}`);
    }
    
    return this.mapEventFromDb(data);
  }

  /**
   * Track multiple events in batch
   */
  async trackEvents(events: TrackingEvent[]): Promise<TrackingEvent[]> {
    if (events.length === 0) return [];
    
    const supabase = getSupabaseAdminClient();
    
    const insertData = events.map(event => ({
      user_id: event.userId,
      session_id: event.sessionId,
      device_id: event.deviceId,
      event_type: event.eventType,
      event_category: event.eventCategory,
      event_name: event.eventName,
      properties: event.properties || {},
      page_url: event.pageUrl,
      page_title: event.pageTitle,
      referrer: event.referrer,
      user_agent: event.userAgent,
      screen_resolution: event.screenResolution,
      viewport_size: event.viewportSize,
      language: event.language,
      timezone: event.timezone,
      country: event.country,
      region: event.region,
      city: event.city,
      load_time_ms: event.loadTimeMs,
      occurred_at: event.occurredAt || new Date(),
    }));
    
    const { data, error } = await supabase
      .from('user_tracking_events')
      .insert(insertData)
      .select();
    
    if (error) {
      log.error('Failed to track events batch:', error);
      throw new Error(`Failed to track events: ${error.message}`);
    }
    
    return data.map(this.mapEventFromDb);
  }

  /**
   * Get events with filters
   */
  async getEvents(options: UserAnalyticsQueryOptions): Promise<TrackingEvent[]> {
    const supabase = getSupabaseAdminClient();
    
    let query = supabase
      .from('user_tracking_events')
      .select('*')
      .gte('occurred_at', options.startDate.toISOString())
      .lte('occurred_at', options.endDate.toISOString())
      .order('occurred_at', { ascending: false });
    
    if (options.userId) {
      query = query.eq('user_id', options.userId);
    }
    
    if (options.eventType) {
      query = query.eq('event_type', options.eventType);
    }
    
    if (options.eventCategory) {
      query = query.eq('event_category', options.eventCategory);
    }
    
    if (options.limit) {
      query = query.limit(options.limit);
    }
    
    if (options.offset) {
      query = query.range(options.offset, options.offset + (options.limit || 100) - 1);
    }
    
    const { data, error } = await query;
    
    if (error) {
      log.error('Failed to get events:', error);
      throw new Error(`Failed to get events: ${error.message}`);
    }
    
    return data.map(this.mapEventFromDb);
  }

  /**
   * Get event counts by type/category
   */
  async getEventCounts(options: UserAnalyticsQueryOptions): Promise<EventCountResult[]> {
    const supabase = getSupabaseAdminClient();
    
    const { data, error } = await supabase
      .rpc('get_event_counts', {
        start_date: options.startDate.toISOString(),
        end_date: options.endDate.toISOString(),
        user_id_filter: options.userId || null,
        granularity: options.granularity || 'day',
      });
    
    if (error) {
      log.error('Failed to get event counts:', error);
      // Fallback to basic query
      return this.getEventCountsFallback(options);
    }
    
    return data || [];
  }

  /**
   * Fallback event count query if RPC is not available
   */
  private async getEventCountsFallback(options: UserAnalyticsQueryOptions): Promise<EventCountResult[]> {
    const events = await this.getEvents({ ...options, limit: 10000 });
    
    const counts = new Map<string, { eventType: string; eventCategory: string; count: number }>();
    
    for (const event of events) {
      const key = `${event.eventType}:${event.eventCategory}`;
      const existing = counts.get(key) || {
        eventType: event.eventType,
        eventCategory: event.eventCategory,
        count: 0,
      };
      existing.count++;
      counts.set(key, existing);
    }
    
    return Array.from(counts.values());
  }

  /**
   * Get session by ID
   */
  async getSession(sessionId: string): Promise<UserSession | null> {
    const supabase = getSupabaseAdminClient();
    
    const { data, error } = await supabase
      .from('user_sessions')
      .select('*')
      .eq('session_id', sessionId)
      .single();
    
    if (error) {
      if (error.code === 'PGRST116') return null;
      log.error('Failed to get session:', error);
      throw new Error(`Failed to get session: ${error.message}`);
    }
    
    if (!data) return null;
    
    return this.mapSessionFromDb(data);
  }

  /**
   * Get sessions for a user
   */
  async getUserSessions(userId: string, limit: number = 50): Promise<UserSession[]> {
    const supabase = getSupabaseAdminClient();
    
    const { data, error } = await supabase
      .from('user_sessions')
      .select('*')
      .eq('user_id', userId)
      .order('first_event_at', { ascending: false })
      .limit(limit);
    
    if (error) {
      log.error('Failed to get user sessions:', error);
      throw new Error(`Failed to get user sessions: ${error.message}`);
    }
    
    return data.map(this.mapSessionFromDb);
  }

  /**
   * End a session
   */
  async endSession(sessionId: string): Promise<void> {
    const supabase = getSupabaseAdminClient();
    
    const { error } = await supabase
      .from('user_sessions')
      .update({
        is_active: false,
        ended_at: new Date().toISOString(),
      })
      .eq('session_id', sessionId);
    
    if (error) {
      log.error('Failed to end session:', error);
      throw new Error(`Failed to end session: ${error.message}`);
    }
  }

  /**
   * Get daily analytics summary
   */
  async getDailySummary(startDate: Date, endDate: Date): Promise<DailyAnalyticsSummary[]> {
    const supabase = getSupabaseAdminClient();
    
    const { data, error } = await supabase
      .from('daily_analytics_summary')
      .select('*')
      .gte('date', startDate.toISOString().split('T')[0])
      .lte('date', endDate.toISOString().split('T')[0])
      .order('date', { ascending: false });
    
    if (error) {
      log.error('Failed to get daily summary:', error);
      throw new Error(`Failed to get daily summary: ${error.message}`);
    }
    
    return data.map(this.mapSummaryFromDb);
  }

  /**
   * Aggregate daily analytics for a specific date
   */
  async aggregateDailyAnalytics(date: Date): Promise<void> {
    const supabase = getSupabaseAdminClient();
    
    const { error } = await supabase
      .rpc('aggregate_daily_analytics', {
        target_date: date.toISOString().split('T')[0],
      });
    
    if (error) {
      log.error('Failed to aggregate daily analytics:', error);
      throw new Error(`Failed to aggregate daily analytics: ${error.message}`);
    }
  }

  /**
   * Get user engagement metrics
   */
  async getUserEngagementMetrics(days: number = 30): Promise<UserEngagementMetrics> {
    const supabase = getSupabaseAdminClient();
    
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const dayStart = (d: number) => {
      const date = new Date(today);
      date.setDate(date.getDate() - d);
      return date.toISOString().split('T')[0];
    };
    
    // Get DAU for today
    const { data: dauData } = await supabase
      .from('user_tracking_events')
      .select('user_id', { count: 'exact', head: false })
      .eq('event_date', dayStart(0))
      .not('user_id', 'is', null);
    
    // Get WAU (last 7 days)
    const { data: wauData } = await supabase
      .from('user_tracking_events')
      .select('user_id')
      .gte('event_date', dayStart(7))
      .not('user_id', 'is', null);
    
    // Get MAU (last 30 days)
    const { data: mauData } = await supabase
      .from('user_tracking_events')
      .select('user_id')
      .gte('event_date', dayStart(30))
      .not('user_id', 'is', null);
    
    // Calculate unique users
    const uniqueUsers = (data: any[] | null) => 
      data ? new Set(data.map(d => d.user_id)).size : 0;
    
    const dau = uniqueUsers(dauData);
    const wau = uniqueUsers(wauData);
    const mau = uniqueUsers(mauData);
    
    // Get session metrics
    const { data: sessionData } = await supabase
      .from('user_sessions')
      .select('duration_seconds, user_id')
      .gte('first_event_at', dayStart(30));
    
    let avgSessionDuration = 0;
    let avgSessionsPerUser = 0;
    
    if (sessionData && sessionData.length > 0) {
      const validDurations = sessionData
        .filter(s => s.duration_seconds != null)
        .map(s => s.duration_seconds);
      
      if (validDurations.length > 0) {
        avgSessionDuration = validDurations.reduce((a, b) => a + b, 0) / validDurations.length;
      }
      
      const userSessions = new Map<string, number>();
      for (const s of sessionData) {
        if (s.user_id) {
          userSessions.set(s.user_id, (userSessions.get(s.user_id) || 0) + 1);
        }
      }
      
      if (userSessions.size > 0) {
        avgSessionsPerUser = Array.from(userSessions.values()).reduce((a, b) => a + b, 0) / userSessions.size;
      }
    }
    
    // Calculate retention (simplified)
    const retention = await this.calculateRetention(supabase);
    
    return {
      dau,
      wau,
      mau,
      stickiness: mau > 0 ? (dau / mau) * 100 : 0,
      retention,
      avgSessionDuration,
      avgSessionsPerUser,
    };
  }

  /**
   * Calculate retention rates
   */
  private async calculateRetention(supabase: any): Promise<{ day1: number; day7: number; day30: number }> {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    // Get users who signed up N days ago
    const getCohort = async (daysAgo: number) => {
      const targetDate = new Date(today);
      targetDate.setDate(targetDate.getDate() - daysAgo);
      const dateStr = targetDate.toISOString().split('T')[0];
      
      const { data: day0Users } = await supabase
        .from('user_tracking_events')
        .select('user_id')
        .eq('event_date', dateStr)
        .eq('event_type', 'user_signup')
        .not('user_id', 'is', null);
      
      if (!day0Users || day0Users.length === 0) return { total: 0, retained: 0 };
      
      const userIds = [...new Set(day0Users.map((d: any) => d.user_id))];
      
      // Check if they returned on day N
      const checkDate = new Date(targetDate);
      checkDate.setDate(checkDate.getDate() + daysAgo);
      const checkDateStr = checkDate.toISOString().split('T')[0];
      
      const { data: returnedUsers } = await supabase
        .from('user_tracking_events')
        .select('user_id')
        .eq('event_date', checkDateStr)
        .in('user_id', userIds);
      
      const returned = returnedUsers ? new Set(returnedUsers.map((d: any) => d.user_id)).size : 0;
      
      return {
        total: userIds.length,
        retained: returned,
      };
    };
    
    const [day1, day7, day30] = await Promise.all([
      getCohort(1),
      getCohort(7),
      getCohort(30),
    ]);
    
    const rate = (cohort: { total: number; retained: number }) =>
      cohort.total > 0 ? (cohort.retained / cohort.total) * 100 : 0;
    
    return {
      day1: rate(day1),
      day7: rate(day7),
      day30: rate(day30),
    };
  }

  /**
   * Analyze conversion funnel
   */
  async analyzeFunnel(
    name: string,
    steps: Array<{ name: string; eventType: string }>,
    startDate: Date,
    endDate: Date
  ): Promise<FunnelAnalysis> {
    const supabase = getSupabaseAdminClient();
    
    // Get all users who completed the first step
    const { data: firstStepUsers } = await supabase
      .from('user_tracking_events')
      .select('user_id, session_id')
      .eq('event_type', steps[0].eventType)
      .gte('occurred_at', startDate.toISOString())
      .lte('occurred_at', endDate.toISOString())
      .not('user_id', 'is', null);
    
    if (!firstStepUsers || firstStepUsers.length === 0) {
      return {
        name,
        steps: steps.map((s, i) => ({
          name: s.name,
          order: i,
          completedCount: 0,
          conversionRate: i === 0 ? 0 : 100,
          dropOffRate: i === 0 ? 100 : 0,
        })),
        overallConversionRate: 0,
        period: { start: startDate, end: endDate },
        totalUsers: 0,
        completedUsers: 0,
      };
    }
    
    const totalUsers = new Set(firstStepUsers.map(u => u.user_id)).size;
    const funnelSteps: FunnelStep[] = [];
    let prevCount = totalUsers;
    
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      
      const { data: stepUsers } = await supabase
        .from('user_tracking_events')
        .select('user_id')
        .eq('event_type', step.eventType)
        .gte('occurred_at', startDate.toISOString())
        .lte('occurred_at', endDate.toISOString())
        .in('user_id', [...new Set(firstStepUsers.map(u => u.user_id))]);
      
      const completedCount = stepUsers ? new Set(stepUsers.map(u => u.user_id)).size : 0;
      
      funnelSteps.push({
        name: step.name,
        order: i,
        completedCount,
        conversionRate: prevCount > 0 ? (completedCount / prevCount) * 100 : 0,
        dropOffRate: prevCount > 0 ? ((prevCount - completedCount) / prevCount) * 100 : 0,
      });
      
      prevCount = completedCount;
    }
    
    const completedUsers = funnelSteps[funnelSteps.length - 1].completedCount;
    
    return {
      name,
      steps: funnelSteps,
      overallConversionRate: totalUsers > 0 ? (completedUsers / totalUsers) * 100 : 0,
      period: { start: startDate, end: endDate },
      totalUsers,
      completedUsers,
    };
  }

  /**
   * Get page view counts
   */
  async getPageViews(
    startDate: Date,
    endDate: Date,
    limit: number = 20
  ): Promise<Array<{ url: string; views: number; uniqueVisitors: number }>> {
    const supabase = getSupabaseAdminClient();
    
    const { data, error } = await supabase
      .from('user_tracking_events')
      .select('page_url, user_id')
      .eq('event_type', 'page_view')
      .gte('occurred_at', startDate.toISOString())
      .lte('occurred_at', endDate.toISOString())
      .not('page_url', 'is', null);
    
    if (error) {
      log.error('Failed to get page views:', error);
      throw new Error(`Failed to get page views: ${error.message}`);
    }
    
    const pageMap = new Map<string, { views: number; users: Set<string> }>();
    
    for (const row of data || []) {
      const url = row.page_url;
      if (!url) continue;
      
      const existing = pageMap.get(url) || { views: 0, users: new Set() };
      existing.views++;
      if (row.user_id) existing.users.add(row.user_id);
      pageMap.set(url, existing);
    }
    
    return Array.from(pageMap.entries())
      .map(([url, data]) => ({
        url,
        views: data.views,
        uniqueVisitors: data.users.size,
      }))
      .sort((a, b) => b.views - a.views)
      .slice(0, limit);
  }

  /**
   * Delete old events (data retention)
   */
  async deleteOldEvents(olderThanDays: number): Promise<number> {
    const supabase = getSupabaseAdminClient();
    
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);
    
    const { data, error } = await supabase
      .from('user_tracking_events')
      .delete()
      .lt('occurred_at', cutoffDate.toISOString())
      .select('id');
    
    if (error) {
      log.error('Failed to delete old events:', error);
      throw new Error(`Failed to delete old events: ${error.message}`);
    }
    
    return data?.length || 0;
  }

  // ============== Mapping Functions ==============

  private mapEventFromDb(data: any): TrackingEvent {
    return {
      id: data.id,
      userId: data.user_id,
      sessionId: data.session_id,
      deviceId: data.device_id,
      eventType: data.event_type,
      eventCategory: data.event_category,
      eventName: data.event_name,
      properties: data.properties || {},
      pageUrl: data.page_url,
      pageTitle: data.page_title,
      referrer: data.referrer,
      userAgent: data.user_agent,
      screenResolution: data.screen_resolution,
      viewportSize: data.viewport_size,
      language: data.language,
      timezone: data.timezone,
      country: data.country,
      region: data.region,
      city: data.city,
      loadTimeMs: data.load_time_ms,
      occurredAt: new Date(data.occurred_at),
    };
  }

  private mapSessionFromDb(data: any): UserSession {
    return {
      sessionId: data.session_id,
      userId: data.user_id,
      deviceId: data.device_id,
      firstEventAt: new Date(data.first_event_at),
      lastEventAt: new Date(data.last_event_at),
      eventCount: data.event_count,
      entryPage: data.entry_page,
      exitPage: data.exit_page,
      entryReferrer: data.entry_referrer,
      userAgent: data.user_agent,
      screenResolution: data.screen_resolution,
      language: data.language,
      timezone: data.timezone,
      country: data.country,
      region: data.region,
      city: data.city,
      utmSource: data.utm_source,
      utmMedium: data.utm_medium,
      utmCampaign: data.utm_campaign,
      utmTerm: data.utm_term,
      utmContent: data.utm_content,
      isActive: data.is_active,
      endedAt: data.ended_at ? new Date(data.ended_at) : undefined,
      durationSeconds: data.duration_seconds,
    };
  }

  private mapSummaryFromDb(data: any): DailyAnalyticsSummary {
    return {
      date: new Date(data.date),
      pageViews: data.page_views || 0,
      uniqueVisitors: data.unique_visitors || 0,
      uniqueSessions: data.unique_sessions || 0,
      avgSessionDurationSeconds: data.avg_session_duration_seconds || 0,
      bounceRate: data.bounce_rate || 0,
      pagesPerSession: data.pages_per_session || 0,
      eventCounts: data.event_counts || {},
      topPages: data.top_pages || [],
      trafficSources: data.traffic_sources || [],
      topCountries: data.top_countries || [],
      deviceBreakdown: data.device_breakdown || { mobile: 0, desktop: 0 },
    };
  }
}

// Singleton instance
export const userTrackingDAO = new UserTrackingDAO();
export default userTrackingDAO;