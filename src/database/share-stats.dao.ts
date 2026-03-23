/**
 * Share Statistics Data Access Object
 * Handles database operations for tracking social shares
 */

import { getSupabaseClient, getSupabaseAdminClient } from './client';
import { createLogger } from '../utils/logger';
import { SupabaseClient } from '@supabase/supabase-js';

const log = createLogger('ShareStatsDAO');

// ============================================
// Type Definitions
// ============================================

export type SharePlatform = 
  | 'wechat' 
  | 'wechat_moments' 
  | 'weibo' 
  | 'twitter' 
  | 'linkedin' 
  | 'facebook' 
  | 'clipboard' 
  | 'native';

export type ShareContentType = 
  | 'profile' 
  | 'trade_result' 
  | 'strategy_performance' 
  | 'referral_link'
  | 'leaderboard'
  | 'custom';

export interface ShareEvent {
  id: string;
  userId: string | null;
  platform: SharePlatform;
  contentType: ShareContentType;
  contentId: string | null;
  referralCode: string | null;
  utmSource: string;
  utmMedium: string;
  utmCampaign: string;
  shareUrl: string;
  userAgent: string | null;
  ipAddress: string | null;
  metadata: Record<string, unknown>;
  createdAt: Date;
}

export interface ShareStats {
  totalShares: number;
  platformDistribution: Record<SharePlatform, number>;
  contentTypeDistribution: Record<ShareContentType, number>;
  recentShares: Array<{
    platform: SharePlatform;
    contentType: ShareContentType;
    createdAt: Date;
  }>;
  trendData: Array<{
    date: string;
    count: number;
  }>;
}

export interface UserShareStats {
  userId: string;
  totalShares: number;
  referralShares: number;
  platformDistribution: Record<SharePlatform, number>;
  topContentType: ShareContentType;
  sharesTrend: Array<{
    date: string;
    count: number;
  }>;
}

export interface CreateShareEventInput {
  userId?: string;
  platform: SharePlatform;
  contentType: ShareContentType;
  contentId?: string;
  referralCode?: string;
  utmSource: string;
  utmMedium: string;
  utmCampaign: string;
  shareUrl: string;
  userAgent?: string;
  ipAddress?: string;
  metadata?: Record<string, unknown>;
}

export interface ShareStatsQuery {
  userId?: string;
  platform?: SharePlatform;
  contentType?: ShareContentType;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}

// ============================================
// DAO Class
// ============================================

export class ShareStatsDAO {
  private anonClient: SupabaseClient;
  private adminClient: SupabaseClient;

  constructor(anonClient: SupabaseClient, adminClient: SupabaseClient) {
    this.anonClient = anonClient;
    this.adminClient = adminClient;
  }

  // ============================================
  // Share Event Operations
  // ============================================

  /**
   * Record a share event
   */
  async recordShareEvent(input: CreateShareEventInput): Promise<ShareEvent> {
    const { data, error } = await this.adminClient
      .from('share_events')
      .insert({
        user_id: input.userId || null,
        platform: input.platform,
        content_type: input.contentType,
        content_id: input.contentId || null,
        referral_code: input.referralCode || null,
        utm_source: input.utmSource,
        utm_medium: input.utmMedium,
        utm_campaign: input.utmCampaign,
        share_url: input.shareUrl,
        user_agent: input.userAgent || null,
        ip_address: input.ipAddress || null,
        metadata: input.metadata || {},
      })
      .select()
      .single();

    if (error) {
      log.error('Failed to record share event:', error);
      throw error;
    }

    return this.mapShareEventRow(data);
  }

  /**
   * Get share events by query
   */
  async getShareEvents(query: ShareStatsQuery): Promise<{ events: ShareEvent[]; total: number }> {
    let queryBuilder = this.anonClient
      .from('share_events')
      .select('*', { count: 'exact' });

    if (query.userId) {
      queryBuilder = queryBuilder.eq('user_id', query.userId);
    }
    if (query.platform) {
      queryBuilder = queryBuilder.eq('platform', query.platform);
    }
    if (query.contentType) {
      queryBuilder = queryBuilder.eq('content_type', query.contentType);
    }
    if (query.startDate) {
      queryBuilder = queryBuilder.gte('created_at', query.startDate.toISOString());
    }
    if (query.endDate) {
      queryBuilder = queryBuilder.lte('created_at', query.endDate.toISOString());
    }

    const limit = query.limit ?? 50;
    const offset = query.offset ?? 0;

    queryBuilder = queryBuilder
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    const { data, error, count } = await queryBuilder;

    if (error) {
      log.error('Failed to get share events:', error);
      throw error;
    }

    return {
      events: (data || []).map(this.mapShareEventRow),
      total: count || 0,
    };
  }

  // ============================================
  // Statistics Operations
  // ============================================

  /**
   * Get global share statistics
   */
  async getGlobalStats(startDate?: Date, endDate?: Date): Promise<ShareStats> {
    const { data, error } = await this.adminClient.rpc('get_share_stats', {
      p_start_date: startDate?.toISOString() || null,
      p_end_date: endDate?.toISOString() || null,
    });

    if (error) {
      log.error('Failed to get global share stats:', error);
      // Return empty stats if RPC doesn't exist
      return this.getEmptyStats();
    }

    return this.mapShareStats(data);
  }

  /**
   * Get user's share statistics
   */
  async getUserStats(userId: string): Promise<UserShareStats> {
    const { data, error } = await this.adminClient.rpc('get_user_share_stats', {
      p_user_id: userId,
    });

    if (error) {
      log.error('Failed to get user share stats:', error);
      // Fallback to direct queries
      return this.getUserStatsFallback(userId);
    }

    return this.mapUserShareStats(data, userId);
  }

  /**
   * Get share count by content type
   */
  async getShareCountByContent(
    contentType: ShareContentType,
    contentId?: string
  ): Promise<number> {
    let query = this.anonClient
      .from('share_events')
      .select('id', { count: 'exact', head: true })
      .eq('content_type', contentType);

    if (contentId) {
      query = query.eq('content_id', contentId);
    }

    const { count, error } = await query;

    if (error) {
      log.error('Failed to get share count by content:', error);
      throw error;
    }

    return count || 0;
  }

  /**
   * Get platform distribution
   */
  async getPlatformDistribution(
    userId?: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<Record<SharePlatform, number>> {
    let query = this.adminClient
      .from('share_events')
      .select('platform');

    if (userId) {
      query = query.eq('user_id', userId);
    }
    if (startDate) {
      query = query.gte('created_at', startDate.toISOString());
    }
    if (endDate) {
      query = query.lte('created_at', endDate.toISOString());
    }

    const { data, error } = await query;

    if (error) {
      log.error('Failed to get platform distribution:', error);
      return this.getEmptyPlatformDistribution();
    }

    const distribution = this.getEmptyPlatformDistribution();
    for (const row of data || []) {
      distribution[row.platform as SharePlatform]++;
    }

    return distribution;
  }

  /**
   * Get conversion rate (shares that led to signups)
   */
  async getConversionRate(
    startDate?: Date,
    endDate?: Date
  ): Promise<{ shares: number; conversions: number; rate: number }> {
    const { data, error } = await this.adminClient.rpc('get_share_conversion_rate', {
      p_start_date: startDate?.toISOString() || null,
      p_end_date: endDate?.toISOString() || null,
    });

    if (error) {
      log.error('Failed to get conversion rate:', error);
      return { shares: 0, conversions: 0, rate: 0 };
    }

    return {
      shares: data?.total_shares || 0,
      conversions: data?.total_conversions || 0,
      rate: data?.conversion_rate || 0,
    };
  }

  // ============================================
  // Helper Methods
  // ============================================

  private async getUserStatsFallback(userId: string): Promise<UserShareStats> {
    const { data, error } = await this.anonClient
      .from('share_events')
      .select('*')
      .eq('user_id', userId);

    if (error) {
      throw error;
    }

    const events = data || [];
    const platformDistribution = this.getEmptyPlatformDistribution();
    const contentTypeCounts: Record<ShareContentType, number> = {
      profile: 0,
      trade_result: 0,
      strategy_performance: 0,
      referral_link: 0,
      leaderboard: 0,
      custom: 0,
    };

    let referralShares = 0;

    for (const event of events) {
      platformDistribution[event.platform as SharePlatform]++;
      contentTypeCounts[event.content_type as ShareContentType]++;
      if (event.content_type === 'referral_link') {
        referralShares++;
      }
    }

    const topContentType = (Object.entries(contentTypeCounts)
      .sort((a, b) => b[1] - a[1])[0]?.[0] as ShareContentType) || 'profile';

    return {
      userId,
      totalShares: events.length,
      referralShares,
      platformDistribution,
      topContentType,
      sharesTrend: [],
    };
  }

  private getEmptyStats(): ShareStats {
    return {
      totalShares: 0,
      platformDistribution: this.getEmptyPlatformDistribution(),
      contentTypeDistribution: {
        profile: 0,
        trade_result: 0,
        strategy_performance: 0,
        referral_link: 0,
        leaderboard: 0,
        custom: 0,
      },
      recentShares: [],
      trendData: [],
    };
  }

  private getEmptyPlatformDistribution(): Record<SharePlatform, number> {
    return {
      wechat: 0,
      wechat_moments: 0,
      weibo: 0,
      twitter: 0,
      linkedin: 0,
      facebook: 0,
      clipboard: 0,
      native: 0,
    };
  }

  private mapShareEventRow(row: Record<string, unknown>): ShareEvent {
    return {
      id: row.id as string,
      userId: row.user_id as string | null,
      platform: row.platform as SharePlatform,
      contentType: row.content_type as ShareContentType,
      contentId: row.content_id as string | null,
      referralCode: row.referral_code as string | null,
      utmSource: row.utm_source as string,
      utmMedium: row.utm_medium as string,
      utmCampaign: row.utm_campaign as string,
      shareUrl: row.share_url as string,
      userAgent: row.user_agent as string | null,
      ipAddress: row.ip_address as string | null,
      metadata: (row.metadata as Record<string, unknown>) || {},
      createdAt: new Date(row.created_at as string),
    };
  }

  private mapShareStats(data: Record<string, unknown> | null): ShareStats {
    if (!data) {
      return this.getEmptyStats();
    }

    return {
      totalShares: data.total_shares as number || 0,
      platformDistribution: (data.platform_distribution as Record<SharePlatform, number>) || this.getEmptyPlatformDistribution(),
      contentTypeDistribution: (data.content_type_distribution as Record<ShareContentType, number>) || {},
      recentShares: ((data.recent_shares as Array<Record<string, unknown>>) || []).map(s => ({
        platform: s.platform as SharePlatform,
        contentType: s.content_type as ShareContentType,
        createdAt: new Date(s.created_at as string),
      })),
      trendData: ((data.trend_data as Array<Record<string, unknown>>) || []).map(t => ({
        date: t.date as string,
        count: t.count as number,
      })),
    };
  }

  private mapUserShareStats(data: Record<string, unknown> | null, userId: string): UserShareStats {
    if (!data) {
      return {
        userId,
        totalShares: 0,
        referralShares: 0,
        platformDistribution: this.getEmptyPlatformDistribution(),
        topContentType: 'profile',
        sharesTrend: [],
      };
    }

    return {
      userId,
      totalShares: data.total_shares as number || 0,
      referralShares: data.referral_shares as number || 0,
      platformDistribution: (data.platform_distribution as Record<SharePlatform, number>) || this.getEmptyPlatformDistribution(),
      topContentType: (data.top_content_type as ShareContentType) || 'profile',
      sharesTrend: ((data.shares_trend as Array<Record<string, unknown>>) || []).map(t => ({
        date: t.date as string,
        count: t.count as number,
      })),
    };
  }
}

// Export singleton instance
let shareStatsDAO: ShareStatsDAO | null = null;

export function getShareStatsDAO(): ShareStatsDAO {
  if (!shareStatsDAO) {
    shareStatsDAO = new ShareStatsDAO(getSupabaseClient(), getSupabaseAdminClient());
  }
  return shareStatsDAO;
}

export default ShareStatsDAO;