/**
 * Reward Service
 * Main service for managing referral rewards
 */

import { getSupabaseAdminClient } from '../../database/client';
import { createLogger } from '../../utils/logger';
import { getReferralDAO, Referral } from '../../database/referral.dao';
import { getRewardRulesEngine, RewardCalculationResult } from './RewardRulesEngine';
import { getAntiFraudService, FraudCheckResult } from './AntiFraudService';
import { getRewardNotificationService } from './RewardNotificationService';

const log = createLogger('RewardService');

// ============================================
// Type Definitions
// ============================================

export type TriggerEvent = 'registration' | 'first_payment' | 'subscription' | 'trade';

export interface ProcessRewardInput {
  triggerEvent: TriggerEvent;
  referrerUserId: string;
  inviteeUserId: string;
  referralId?: string;
  context?: {
    subscriptionAmount?: number;
    tradeCount?: number;
    hasPaid?: boolean;
    deviceFingerprint?: string;
    ipAddress?: string;
    userAgent?: string;
  };
}

export interface ProcessRewardResult {
  success: boolean;
  referrerReward?: {
    amount: number;
    type: string;
    vipDays: number;
    status: 'pending' | 'processed';
    scheduledAt?: Date;
  };
  inviteeReward?: {
    amount: number;
    type: string;
    vipDays: number;
    status: 'pending' | 'processed';
  };
  fraudCheck?: FraudCheckResult;
  error?: string;
}

export interface RewardHistoryEntry {
  id: string;
  referralId: string | null;
  rewardType: string;
  amount: number;
  vipDays: number;
  status: string;
  sourceUserId: string | null;
  description: string | null;
  scheduledAt: Date | null;
  processedAt: Date | null;
  createdAt: Date;
  ruleName?: string;
}

export interface RewardHistoryOptions {
  userId: string;
  limit?: number;
  offset?: number;
  status?: 'pending' | 'processed' | 'cancelled';
  rewardType?: string;
}

export interface RewardStats {
  totalEarned: number;
  totalVipDays: number;
  pending: number;
  pendingVipDays: number;
  processed: number;
  processedVipDays: number;
  byType: Record<string, { count: number; amount: number; vipDays: number }>;
  recentRewards: RewardHistoryEntry[];
}

// ============================================
// Reward Service Class
// ============================================

export class RewardService {
  /**
   * Process a reward event
   */
  async processReward(input: ProcessRewardInput): Promise<ProcessRewardResult> {
    const { triggerEvent, referrerUserId, inviteeUserId, referralId, context } = input;
    
    log.info('Processing reward:', { triggerEvent, referrerUserId, inviteeUserId });

    try {
      // Step 1: Run fraud check
      const antiFraudService = getAntiFraudService();
      
      // Get referrer's history for fraud check
      const referralDAO = getReferralDAO();
      const { referrals: referrerReferrals } = await referralDAO.getReferralsByReferrerUserId(
        referrerUserId,
        { limit: 100 }
      );
      
      const { rewards: flaggedRewards } = await referralDAO.getRewardsByUserId(
        referrerUserId,
        { status: 'cancelled' }
      );
      
      const fraudCheckResult = await antiFraudService.checkForFraud({
        referrerUserId,
        inviteeUserId,
        deviceFingerprint: context?.deviceFingerprint,
        ipAddress: context?.ipAddress,
        userAgent: context?.userAgent,
        referrerHistory: {
          totalReferrals: referrerReferrals.length,
          recentReferrals: referrerReferrals.filter(
            r => new Date(r.invitedAt) > new Date(Date.now() - 24 * 60 * 60 * 1000)
          ).length,
          flaggedReferrals: flaggedRewards.length,
        },
      });

      // If fraud detected, block and record
      if (fraudCheckResult.recommendation === 'block') {
        log.warn('Fraud detected, blocking reward:', {
          referrerUserId,
          inviteeUserId,
          riskScore: fraudCheckResult.riskScore,
        });

        // Record fraud flags
        if (referralId) {
          for (const flag of fraudCheckResult.flags) {
            await antiFraudService.recordFraudFlag(
              referralId,
              flag.type,
              flag.severity,
              flag.details,
              fraudCheckResult.riskScore
            );
          }
        }

        return {
          success: false,
          fraudCheck: fraudCheckResult,
          error: 'FRAUD_DETECTED',
        };
      }

      // Record flags for 'review' or 'flag' recommendations
      if (fraudCheckResult.recommendation === 'review' || fraudCheckResult.recommendation === 'flag') {
        if (referralId) {
          for (const flag of fraudCheckResult.flags) {
            await antiFraudService.recordFraudFlag(
              referralId,
              flag.type,
              flag.severity,
              flag.details,
              fraudCheckResult.riskScore
            );
          }
        }
      }

      // Step 2: Calculate rewards using rules engine
      const rulesEngine = getRewardRulesEngine();
      const rewardCalculation = await rulesEngine.calculateRewards(triggerEvent, {
        referrerUserId,
        inviteeUserId,
        subscriptionAmount: context?.subscriptionAmount,
        tradeCount: context?.tradeCount,
        hasPaid: context?.hasPaid,
      });

      if (!rewardCalculation) {
        log.debug('No matching reward rule found:', { triggerEvent });
        return {
          success: true,
          fraudCheck: fraudCheckResult,
        };
      }

      // Step 3: Create and process rewards
      const result = await this.createRewards(
        rewardCalculation,
        referrerUserId,
        inviteeUserId,
        referralId,
        fraudCheckResult.recommendation === 'review'
      );

      // Step 4: Send notifications
      const notificationService = getRewardNotificationService();
      
      if (result.referrerReward && result.referrerReward.status === 'processed') {
        await notificationService.notifyRewardEarned(
          referrerUserId,
          result.referrerReward.vipDays,
          result.referrerReward.type
        );
      } else if (result.referrerReward && result.referrerReward.status === 'pending') {
        await notificationService.notifyRewardPending(
          referrerUserId,
          result.referrerReward.vipDays,
          result.referrerReward.scheduledAt!
        );
      }

      if (result.inviteeReward && result.inviteeReward.status === 'processed') {
        await notificationService.notifyRewardEarned(
          inviteeUserId,
          result.inviteeReward.vipDays,
          result.inviteeReward.type
        );
      }

      return {
        success: true,
        ...result,
        fraudCheck: fraudCheckResult,
      };
    } catch (error) {
      log.error('Failed to process reward:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get reward history for a user
   */
  async getRewardHistory(options: RewardHistoryOptions): Promise<{
    rewards: RewardHistoryEntry[];
    total: number;
  }> {
    const referralDAO = getReferralDAO();
    const { rewards, total } = await referralDAO.getRewardsByUserId(options.userId, {
      status: options.status,
      limit: options.limit,
      offset: options.offset,
    });

    // Enrich with rule names
    const rulesEngine = getRewardRulesEngine();
    const enrichedRewards = await Promise.all(
      rewards.map(async (reward) => {
        const metadata = reward.metadata as Record<string, unknown>;
        let ruleName: string | undefined;
        
        if (metadata?.ruleId) {
          const rule = await rulesEngine.getRuleById(metadata.ruleId as string);
          ruleName = rule?.name;
        }
        
        return {
          id: reward.id,
          referralId: reward.referralId,
          rewardType: reward.rewardType,
          amount: reward.amount,
          vipDays: (reward.metadata?.vip_days as number) || 0,
          status: reward.status,
          sourceUserId: reward.sourceUserId,
          description: reward.description,
          scheduledAt: reward.scheduledAt,
          processedAt: reward.processedAt,
          createdAt: reward.createdAt,
          ruleName,
        };
      })
    );

    return {
      rewards: enrichedRewards,
      total,
    };
  }

  /**
   * Get reward statistics for a user
   */
  async getRewardStats(userId: string): Promise<RewardStats> {
    const referralDAO = getReferralDAO();
    const { rewards } = await referralDAO.getRewardsByUserId(userId, { limit: 1000 });

    const stats: RewardStats = {
      totalEarned: 0,
      totalVipDays: 0,
      pending: 0,
      pendingVipDays: 0,
      processed: 0,
      processedVipDays: 0,
      byType: {},
      recentRewards: [],
    };

    for (const reward of rewards) {
      const vipDays = (reward.metadata?.vip_days as number) || 0;
      
      stats.totalEarned += reward.amount;
      stats.totalVipDays += vipDays;
      
      if (reward.status === 'pending') {
        stats.pending += reward.amount;
        stats.pendingVipDays += vipDays;
      } else if (reward.status === 'processed') {
        stats.processed += reward.amount;
        stats.processedVipDays += vipDays;
      }

      // Group by type
      const type = reward.rewardType;
      if (!stats.byType[type]) {
        stats.byType[type] = { count: 0, amount: 0, vipDays: 0 };
      }
      stats.byType[type].count++;
      stats.byType[type].amount += reward.amount;
      stats.byType[type].vipDays += vipDays;
    }

    // Get recent rewards
    stats.recentRewards = rewards.slice(0, 10).map(reward => ({
      id: reward.id,
      referralId: reward.referralId,
      rewardType: reward.rewardType,
      amount: reward.amount,
      vipDays: (reward.metadata?.vip_days as number) || 0,
      status: reward.status,
      sourceUserId: reward.sourceUserId,
      description: reward.description,
      scheduledAt: reward.scheduledAt,
      processedAt: reward.processedAt,
      createdAt: reward.createdAt,
    }));

    return stats;
  }

  /**
   * Process pending rewards (cron job)
   */
  async processPendingRewards(): Promise<{
    processed: number;
    failed: number;
    total: number;
  }> {
    const supabase = getSupabaseAdminClient();
    const notificationService = getRewardNotificationService();
    
    // Get pending rewards that are due
    const { data: pendingRewards, error } = await supabase
      .from('rewards')
      .select('*')
      .eq('status', 'pending')
      .not('scheduled_at', 'is', null)
      .lte('scheduled_at', new Date().toISOString());

    if (error) {
      log.error('Failed to fetch pending rewards:', error);
      throw error;
    }

    const result = {
      processed: 0,
      failed: 0,
      total: pendingRewards?.length || 0,
    };

    for (const reward of pendingRewards || []) {
      try {
        // Grant VIP days via database function
        const vipDays = (reward.metadata?.vip_days as number) || Math.floor(reward.amount / 100 * 30);
        
        const { data: grantResult, error: grantError } = await supabase.rpc('grant_vip_days', {
          p_user_id: reward.user_id,
          p_days: vipDays,
          p_reason: reward.reward_type,
        });

        if (grantError) {
          throw grantError;
        }

        if (grantResult?.success) {
          // Update reward status
          const { error: updateError } = await supabase
            .from('rewards')
            .update({
              status: 'processed',
              processed_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              metadata: {
                ...reward.metadata,
                vip_days: vipDays,
                grant_result: grantResult,
              },
            })
            .eq('id', reward.id);

          if (updateError) {
            throw updateError;
          }

          // Update referral code stats
          await supabase.rpc('update_referral_code_stats', {
            p_user_id: reward.user_id,
            p_amount: reward.amount,
          });

          // Send notification
          await notificationService.notifyRewardProcessed(
            reward.user_id,
            vipDays,
            new Date()
          );

          result.processed++;
          log.info('Reward processed:', { rewardId: reward.id, vipDays });
        } else {
          throw new Error(grantResult?.message || 'Failed to grant VIP days');
        }
      } catch (err) {
        result.failed++;
        log.error('Failed to process reward:', { rewardId: reward.id, error: err });
        
        // Record failure in metadata
        await supabase
          .from('rewards')
          .update({
            metadata: {
              ...reward.metadata,
              processing_error: err instanceof Error ? err.message : 'Unknown error',
              processing_attempts: ((reward.metadata?.processing_attempts as number) || 0) + 1,
            },
          })
          .eq('id', reward.id);
      }
    }

    return result;
  }

  /**
   * Retry failed rewards
   */
  async retryFailedRewards(): Promise<{
    retried: number;
    succeeded: number;
    failed: number;
  }> {
    const supabase = getSupabaseAdminClient();
    
    // Get rewards with processing errors
    const { data: failedRewards, error } = await supabase
      .from('rewards')
      .select('*')
      .eq('status', 'pending')
      .not('metadata->processing_error', 'is', null)
      .lt('metadata->processing_attempts', 3);

    if (error) {
      log.error('Failed to fetch failed rewards:', error);
      throw error;
    }

    const result = {
      retried: failedRewards?.length || 0,
      succeeded: 0,
      failed: 0,
    };

    for (const reward of failedRewards || []) {
      try {
        const vipDays = (reward.metadata?.vip_days as number) || Math.floor(reward.amount / 100 * 30);
        
        const { data: grantResult, error: grantError } = await supabase.rpc('grant_vip_days', {
          p_user_id: reward.user_id,
          p_days: vipDays,
          p_reason: reward.reward_type,
        });

        if (grantError) throw grantError;

        if (grantResult?.success) {
          await supabase
            .from('rewards')
            .update({
              status: 'processed',
              processed_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              metadata: {
                ...reward.metadata,
                grant_result: grantResult,
                processing_error: null,
              },
            })
            .eq('id', reward.id);

          result.succeeded++;
        } else {
          throw new Error(grantResult?.message || 'Failed to grant VIP days');
        }
      } catch (err) {
        result.failed++;
        
        await supabase
          .from('rewards')
          .update({
            metadata: {
              ...reward.metadata,
              processing_error: err instanceof Error ? err.message : 'Unknown error',
              processing_attempts: ((reward.metadata?.processing_attempts as number) || 0) + 1,
            },
          })
          .eq('id', reward.id);
      }
    }

    return result;
  }

  // ============================================
  // Private Methods
  // ============================================

  private async createRewards(
    calculation: RewardCalculationResult,
    referrerUserId: string,
    inviteeUserId: string,
    referralId?: string,
    holdForReview?: boolean
  ): Promise<{
    referrerReward?: ProcessRewardResult['referrerReward'];
    inviteeReward?: ProcessRewardResult['inviteeReward'];
  }> {
    const supabase = getSupabaseAdminClient();
    const result: ProcessRewardResult = { success: true };
    
    // Process invitee reward (usually immediate)
    if (calculation.inviteeReward.amount > 0) {
      const vipDays = calculation.inviteeReward.type === 'vip_days' 
        ? calculation.inviteeReward.amount 
        : 0;

      if (calculation.inviteeReward.immediate && !holdForReview) {
        // Grant immediately
        const { data: grantResult, error } = await supabase.rpc('grant_vip_days', {
          p_user_id: inviteeUserId,
          p_days: vipDays,
          p_reason: 'invitee_bonus',
        });

        if (!error && grantResult?.success) {
          // Record the reward
          await supabase.from('rewards').insert({
            user_id: inviteeUserId,
            referral_id: referralId,
            reward_type: 'invitee_bonus',
            amount: vipDays * 100 / 30,
            source_user_id: referrerUserId,
            status: 'processed',
            scheduled_at: new Date().toISOString(),
            processed_at: new Date().toISOString(),
            description: `New user bonus: ${vipDays} days VIP Pro`,
            metadata: {
              vip_days: vipDays,
              rule_id: calculation.ruleId,
              rule_name: calculation.ruleName,
            },
          });

          result.inviteeReward = {
            amount: calculation.inviteeReward.amount,
            type: calculation.inviteeReward.type,
            vipDays,
            status: 'processed',
          };
        }
      } else {
        // Schedule for later
        const scheduledAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
        
        await supabase.from('rewards').insert({
          user_id: inviteeUserId,
          referral_id: referralId,
          reward_type: 'invitee_bonus',
          amount: vipDays * 100 / 30,
          source_user_id: referrerUserId,
          status: 'pending',
          scheduled_at: scheduledAt.toISOString(),
          description: `New user bonus: ${vipDays} days VIP Pro`,
          metadata: {
            vip_days: vipDays,
            rule_id: calculation.ruleId,
            rule_name: calculation.ruleName,
          },
        });

        result.inviteeReward = {
          amount: calculation.inviteeReward.amount,
          type: calculation.inviteeReward.type,
          vipDays,
          status: 'pending',
        };
      }
    }

    // Process referrer reward
    if (calculation.referrerReward.amount > 0) {
      const vipDays = calculation.referrerReward.type === 'vip_days' 
        ? calculation.referrerReward.amount 
        : 0;

      if (calculation.referrerReward.delayDays === 0 && !holdForReview) {
        // Grant immediately
        const { data: grantResult, error } = await supabase.rpc('grant_vip_days', {
          p_user_id: referrerUserId,
          p_days: vipDays,
          p_reason: 'referral_bonus',
        });

        if (!error && grantResult?.success) {
          await supabase.from('rewards').insert({
            user_id: referrerUserId,
            referral_id: referralId,
            reward_type: 'referral_bonus',
            amount: vipDays * 100 / 30,
            source_user_id: inviteeUserId,
            status: 'processed',
            scheduled_at: new Date().toISOString(),
            processed_at: new Date().toISOString(),
            description: `Referral bonus: ${vipDays} days VIP Pro`,
            metadata: {
              vip_days: vipDays,
              rule_id: calculation.ruleId,
              rule_name: calculation.ruleName,
            },
          });

          result.referrerReward = {
            amount: calculation.referrerReward.amount,
            type: calculation.referrerReward.type,
            vipDays,
            status: 'processed',
          };
        }
      } else {
        // Schedule for later
        const scheduledAt = new Date(
          Date.now() + (calculation.referrerReward.delayDays || 7) * 24 * 60 * 60 * 1000
        );
        
        await supabase.from('rewards').insert({
          user_id: referrerUserId,
          referral_id: referralId,
          reward_type: 'referral_bonus',
          amount: vipDays * 100 / 30,
          source_user_id: inviteeUserId,
          status: 'pending',
          scheduled_at: scheduledAt.toISOString(),
          description: `Referral bonus: ${vipDays} days VIP Pro`,
          metadata: {
            vip_days: vipDays,
            rule_id: calculation.ruleId,
            rule_name: calculation.ruleName,
          },
        });

        result.referrerReward = {
          amount: calculation.referrerReward.amount,
          type: calculation.referrerReward.type,
          vipDays,
          status: 'pending',
          scheduledAt,
        };
      }
    }

    return {
      referrerReward: result.referrerReward,
      inviteeReward: result.inviteeReward,
    };
  }
}

// Singleton instance
let rewardService: RewardService | null = null;

export function getRewardService(): RewardService {
  if (!rewardService) {
    rewardService = new RewardService();
  }
  return rewardService;
}

export default RewardService;