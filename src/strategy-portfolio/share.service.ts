/**
 * Portfolio Share Service
 * 
 * Manages sharing of portfolio configurations:
 * - Generate share codes
 * - Manage permissions
 * - Track sharing statistics
 */

import {
  SharedPortfolio,
  ShareConfig,
  SharePermission,
  StrategyPortfolio,
} from './types';
import { getSupabaseClient } from '../database/client';
import { createLogger } from '../utils/logger';

const log = createLogger('ShareService');

/**
 * Characters used for share codes
 */
const SHARE_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const SHARE_CODE_LENGTH = 8;

/**
 * Portfolio Share Service class
 */
export class PortfolioShareService {
  private supabase: any;

  constructor() {
    this.supabase = getSupabaseClient();
  }

  /**
   * Generate a unique share code
   */
  private generateShareCode(): string {
    let code = '';
    for (let i = 0; i < SHARE_CODE_LENGTH; i++) {
      code += SHARE_CODE_CHARS.charAt(
        Math.floor(Math.random() * SHARE_CODE_CHARS.length)
      );
    }
    return code;
  }

  /**
   * Create a share for a portfolio
   */
  async createShare(
    portfolioId: string,
    userId: string,
    config: ShareConfig
  ): Promise<SharedPortfolio> {
    // Generate unique share code
    let shareCode = this.generateShareCode();
    let attempts = 0;

    // Ensure uniqueness
    while (await this.shareCodeExists(shareCode)) {
      shareCode = this.generateShareCode();
      attempts++;
      if (attempts > 10) {
        throw new Error('Failed to generate unique share code');
      }
    }

    // Calculate expiration
    const expiresAt = config.expiresIn
      ? new Date(Date.now() + config.expiresIn * 24 * 60 * 60 * 1000)
      : undefined;

    const sharedPortfolio: SharedPortfolio = {
      id: `share_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      portfolioId,
      shareCode,
      ownerUserId: userId,
      sharedWith: [],
      isPublic: config.isPublic,
      expiresAt,
      createdAt: new Date(),
      viewCount: 0,
      copyCount: 0,
    };

    try {
      const { error } = await this.supabase
        .from('shared_portfolios')
        .insert([this.mapToRow(sharedPortfolio)]);

      if (error) {
        log.error('Failed to create share:', error);
        throw new Error('Failed to create share');
      }

      return sharedPortfolio;
    } catch (error) {
      log.error('Failed to create share:', error);
      throw error;
    }
  }

  /**
   * Check if share code already exists
   */
  private async shareCodeExists(code: string): Promise<boolean> {
    try {
      const { data } = await this.supabase
        .from('shared_portfolios')
        .select('id')
        .eq('share_code', code)
        .single();

      return !!data;
    } catch {
      return false;
    }
  }

  /**
   * Get share by code
   */
  async getShareByCode(code: string): Promise<SharedPortfolio | null> {
    try {
      const { data, error } = await this.supabase
        .from('shared_portfolios')
        .select('*')
        .eq('share_code', code.toUpperCase())
        .single();

      if (error || !data) {
        return null;
      }

      // Check expiration
      const share = this.mapToShare(data);
      if (share.expiresAt && new Date() > share.expiresAt) {
        return null;  // Share has expired
      }

      return share;
    } catch (error) {
      log.error('Failed to get share:', error);
      return null;
    }
  }

  /**
   * Get shares for a portfolio
   */
  async getPortfolioShares(portfolioId: string): Promise<SharedPortfolio[]> {
    try {
      const { data, error } = await this.supabase
        .from('shared_portfolios')
        .select('*')
        .eq('portfolio_id', portfolioId)
        .order('created_at', { ascending: false });

      if (error || !data) {
        return [];
      }

      return data.map(this.mapToShare);
    } catch (error) {
      log.error('Failed to get portfolio shares:', error);
      return [];
    }
  }

  /**
   * Get shares owned by user
   */
  async getUserShares(userId: string): Promise<SharedPortfolio[]> {
    try {
      const { data, error } = await this.supabase
        .from('shared_portfolios')
        .select('*')
        .eq('owner_user_id', userId)
        .order('created_at', { ascending: false });

      if (error || !data) {
        return [];
      }

      return data.map(this.mapToShare);
    } catch (error) {
      log.error('Failed to get user shares:', error);
      return [];
    }
  }

  /**
   * Increment view count
   */
  async incrementViewCount(shareCode: string): Promise<void> {
    try {
      await this.supabase.rpc('increment_share_view', { share_code: shareCode });
    } catch (error) {
      // Ignore errors for view count increment
      log.debug('Failed to increment view count:', error);
    }
  }

  /**
   * Increment copy count
   */
  async incrementCopyCount(shareCode: string): Promise<void> {
    try {
      await this.supabase.rpc('increment_share_copy', { share_code: shareCode });
    } catch (error) {
      log.debug('Failed to increment copy count:', error);
    }
  }

  /**
   * Share with specific user
   */
  async shareWithUser(
    shareId: string,
    targetUserId: string,
    permission: SharePermission
  ): Promise<boolean> {
    try {
      const { data: share, error: fetchError } = await this.supabase
        .from('shared_portfolios')
        .select('*')
        .eq('id', shareId)
        .single();

      if (fetchError || !share) {
        return false;
      }

      const sharedWith = share.shared_with || [];
      const existingIndex = sharedWith.findIndex(
        (s: any) => s.userId === targetUserId
      );

      const newEntry = {
        userId: targetUserId,
        permission,
        sharedAt: new Date().toISOString(),
      };

      if (existingIndex >= 0) {
        sharedWith[existingIndex] = newEntry;
      } else {
        sharedWith.push(newEntry);
      }

      const { error } = await this.supabase
        .from('shared_portfolios')
        .update({ shared_with: sharedWith })
        .eq('id', shareId);

      return !error;
    } catch (error) {
      log.error('Failed to share with user:', error);
      return false;
    }
  }

  /**
   * Revoke share
   */
  async revokeShare(shareId: string, userId: string): Promise<boolean> {
    try {
      const { error } = await this.supabase
        .from('shared_portfolios')
        .delete()
        .eq('id', shareId)
        .eq('owner_user_id', userId);

      return !error;
    } catch (error) {
      log.error('Failed to revoke share:', error);
      return false;
    }
  }

  /**
   * Revoke user access
   */
  async revokeUserAccess(
    shareId: string,
    targetUserId: string,
    ownerUserId: string
  ): Promise<boolean> {
    try {
      const { data: share, error: fetchError } = await this.supabase
        .from('shared_portfolios')
        .select('*')
        .eq('id', shareId)
        .eq('owner_user_id', ownerUserId)
        .single();

      if (fetchError || !share) {
        return false;
      }

      const sharedWith = (share.shared_with || []).filter(
        (s: any) => s.userId !== targetUserId
      );

      const { error } = await this.supabase
        .from('shared_portfolios')
        .update({ shared_with: sharedWith })
        .eq('id', shareId);

      return !error;
    } catch (error) {
      log.error('Failed to revoke user access:', error);
      return false;
    }
  }

  /**
   * Check if user has permission to access share
   */
  async checkPermission(
    shareCode: string,
    userId: string
  ): Promise<{ hasAccess: boolean; permission: SharePermission | null }> {
    const share = await this.getShareByCode(shareCode);

    if (!share) {
      return { hasAccess: false, permission: null };
    }

    // Owner has full access
    if (share.ownerUserId === userId) {
      return { hasAccess: true, permission: 'edit' };
    }

    // Check if shared with user
    const sharedEntry = share.sharedWith.find(s => s.userId === userId);
    if (sharedEntry) {
      return { hasAccess: true, permission: sharedEntry.permission };
    }

    // Public shares allow view
    if (share.isPublic) {
      return { hasAccess: true, permission: 'view' };
    }

    return { hasAccess: false, permission: null };
  }

  /**
   * Get share statistics
   */
  async getShareStats(shareId: string): Promise<{
    viewCount: number;
    copyCount: number;
    uniqueViewers: number;
  }> {
    try {
      const { data, error } = await this.supabase
        .from('shared_portfolios')
        .select('view_count, copy_count, shared_with')
        .eq('id', shareId)
        .single();

      if (error || !data) {
        return { viewCount: 0, copyCount: 0, uniqueViewers: 0 };
      }

      return {
        viewCount: data.view_count || 0,
        copyCount: data.copy_count || 0,
        uniqueViewers: (data.shared_with || []).length,
      };
    } catch (error) {
      log.error('Failed to get share stats:', error);
      return { viewCount: 0, copyCount: 0, uniqueViewers: 0 };
    }
  }

  /**
   * Map database row to SharedPortfolio
   */
  private mapToShare(row: any): SharedPortfolio {
    return {
      id: row.id,
      portfolioId: row.portfolio_id,
      shareCode: row.share_code,
      ownerUserId: row.owner_user_id,
      sharedWith: (row.shared_with || []).map((s: any) => ({
        userId: s.userId,
        permission: s.permission,
        sharedAt: new Date(s.sharedAt),
      })),
      isPublic: row.is_public,
      expiresAt: row.expires_at ? new Date(row.expires_at) : undefined,
      createdAt: new Date(row.created_at),
      viewCount: row.view_count || 0,
      copyCount: row.copy_count || 0,
    };
  }

  /**
   * Map SharedPortfolio to database row
   */
  private mapToRow(share: SharedPortfolio): any {
    return {
      id: share.id,
      portfolio_id: share.portfolioId,
      share_code: share.shareCode,
      owner_user_id: share.ownerUserId,
      shared_with: share.sharedWith.map(s => ({
        userId: s.userId,
        permission: s.permission,
        sharedAt: s.sharedAt.toISOString(),
      })),
      is_public: share.isPublic,
      expires_at: share.expiresAt?.toISOString(),
      created_at: share.createdAt.toISOString(),
      view_count: share.viewCount,
      copy_count: share.copyCount,
    };
  }
}

// Singleton instance
export const portfolioShareService = new PortfolioShareService();