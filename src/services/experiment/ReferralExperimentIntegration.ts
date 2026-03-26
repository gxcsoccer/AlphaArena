/**
 * Referral Experiment Integration Example
 * 
 * This file demonstrates how to use the A/B testing framework
 * with the existing referral system.
 * 
 * Usage:
 * 1. Create an experiment with different reward configurations
 * 2. Get variant for user when they interact with referral system
 * 3. Apply variant config to reward calculations
 * 4. Track conversions when users complete desired actions
 */

import { getExperimentService } from './ExperimentService';
import { createLogger } from '../../utils/logger';

const log = createLogger('ReferralExperimentIntegration');

// ============================================
// Example: Creating a Referral Reward Experiment
// ============================================

/**
 * Example: Create an experiment to test different referral reward amounts
 * 
 * Experiment: "referral_reward_test"
 * Variants:
 *   - control: 7 days for invitee, 30 days for referrer (current)
 *   - treatment_a: 14 days for invitee, 30 days for referrer (higher invitee bonus)
 *   - treatment_b: 7 days for invitee, 60 days for referrer (higher referrer bonus)
 */
export async function createReferralRewardExperiment(): Promise<void> {
  const experimentService = getExperimentService();

  const result = await experimentService.createExperiment({
    name: 'referral_reward_test',
    description: 'Test different referral reward amounts to find optimal conversion rates',
    experimentType: 'referral',
    trafficAllocation: 100, // 100% of users
    significanceLevel: 0.05,
    minimumSampleSize: 1000,
    variants: [
      {
        name: 'control',
        description: 'Current reward structure',
        config: {
          invitee_bonus_days: 7,
          referrer_bonus_days: 30,
          activation_criteria: 'first_subscription_or_trade',
        },
        trafficPercentage: 33.33,
        isControl: true,
      },
      {
        name: 'treatment_a',
        description: 'Higher invitee bonus',
        config: {
          invitee_bonus_days: 14,
          referrer_bonus_days: 30,
          activation_criteria: 'first_subscription_or_trade',
        },
        trafficPercentage: 33.33,
        isControl: false,
      },
      {
        name: 'treatment_b',
        description: 'Higher referrer bonus',
        config: {
          invitee_bonus_days: 7,
          referrer_bonus_days: 60,
          activation_criteria: 'first_subscription_or_trade',
        },
        trafficPercentage: 33.34,
        isControl: false,
      },
    ],
  });

  log.info('Created referral reward experiment:', {
    experimentId: result.experiment.id,
    name: result.experiment.name,
    variants: result.variants.length,
  });

  // Start the experiment
  await experimentService.startExperiment(result.experiment.id);

  log.info('Experiment started');
}

// ============================================
// Example: Creating an Invite Code Style Experiment
// ============================================

/**
 * Example: Test different invite code display styles
 * 
 * Experiment: "invite_code_style_test"
 * Variants:
 *   - control: Plain code display
 *   - treatment: QR code + social share buttons
 */
export async function createInviteStyleExperiment(): Promise<void> {
  const experimentService = getExperimentService();

  const result = await experimentService.createExperiment({
    name: 'invite_code_style_test',
    description: 'Test different invite code display styles to improve share rate',
    experimentType: 'ui',
    trafficAllocation: 50, // 50% of users
    variants: [
      {
        name: 'control',
        description: 'Plain code display',
        config: {
          showQRCode: false,
          showSocialShare: false,
          layout: 'simple',
        },
        trafficPercentage: 50,
        isControl: true,
      },
      {
        name: 'treatment',
        description: 'QR code + social share',
        config: {
          showQRCode: true,
          showSocialShare: true,
          layout: 'enhanced',
        },
        trafficPercentage: 50,
        isControl: false,
      },
    ],
  });

  log.info('Created invite style experiment:', {
    experimentId: result.experiment.id,
  });

  await experimentService.startExperiment(result.experiment.id);
}

// ============================================
// Integration with Referral System
// ============================================

/**
 * Get reward configuration for a user
 * Uses A/B test variant if available, otherwise uses default
 */
export async function getRewardConfigForUser(userId: string): Promise<{
  inviteeBonusDays: number;
  referrerBonusDays: number;
  activationCriteria: string;
  experimentVariant?: string;
}> {
  const experimentService = getExperimentService();

  // Default configuration
  const defaultConfig = {
    inviteeBonusDays: 7,
    referrerBonusDays: 30,
    activationCriteria: 'first_subscription_or_trade',
  };

  try {
    // Get variant from experiment
    const config = await experimentService.getVariantConfig('referral_reward_test', userId);

    if (config) {
      log.debug('Using experiment config for user:', {
        userId,
        variant: config,
      });

      return {
        inviteeBonusDays: (config.invitee_bonus_days as number) || defaultConfig.inviteeBonusDays,
        referrerBonusDays: (config.referrer_bonus_days as number) || defaultConfig.referrerBonusDays,
        activationCriteria: (config.activation_criteria as string) || defaultConfig.activationCriteria,
        experimentVariant: config.variant_name as string,
      };
    }
  } catch (error) {
    log.error('Failed to get experiment variant, using default:', error);
  }

  return defaultConfig;
}

/**
 * Get UI configuration for invite code display
 */
export async function getInviteUIConfigForUser(userId: string): Promise<{
  showQRCode: boolean;
  showSocialShare: boolean;
  layout: 'simple' | 'enhanced';
}> {
  const experimentService = getExperimentService();

  const defaultConfig = {
    showQRCode: false,
    showSocialShare: false,
    layout: 'simple' as const,
  };

  try {
    const config = await experimentService.getVariantConfig('invite_code_style_test', userId);

    if (config) {
      return {
        showQRCode: (config.showQRCode as boolean) ?? defaultConfig.showQRCode,
        showSocialShare: (config.showSocialShare as boolean) ?? defaultConfig.showSocialShare,
        layout: (config.layout as 'simple' | 'enhanced') || defaultConfig.layout,
      };
    }
  } catch (error) {
    log.error('Failed to get UI experiment variant, using default:', error);
  }

  return defaultConfig;
}

/**
 * Track referral conversion
 * Call this when a user completes a referral action
 */
export async function trackReferralConversion(
  userId: string,
  eventType: 'referral_sent' | 'referral_registered' | 'referral_activated' | 'reward_earned',
  additionalData?: Record<string, unknown>
): Promise<void> {
  const experimentService = getExperimentService();

  try {
    // Track conversion for reward experiment
    await experimentService.trackConversion({
      experimentName: 'referral_reward_test',
      userId,
      eventName: eventType,
      eventData: additionalData,
    });

    log.debug('Tracked referral conversion:', { userId, eventType });
  } catch (error) {
    log.error('Failed to track referral conversion:', error);
  }
}

// ============================================
// Admin Dashboard Helpers
// ============================================

/**
 * Get experiment dashboard data
 */
export async function getExperimentDashboard(experimentId: string): Promise<{
  experiment: {
    id: string;
    name: string;
    status: string;
    startDate: Date | null;
    endDate: Date | null;
  };
  variants: Array<{
    name: string;
    participants: number;
    conversions: number;
    conversionRate: number;
    isControl: boolean;
  }>;
  statistics: {
    totalParticipants: number;
    totalConversions: number;
    winningVariant?: string;
    significance?: boolean;
  };
}> {
  const experimentService = getExperimentService();

  const result = await experimentService.getExperimentResults(experimentId);

  // Find if any variant is significantly better
  const winningComparison = result.statistics.comparisons?.find((c: any) => c.is_significant);

  return {
    experiment: {
      id: result.experiment.id,
      name: result.experiment.name,
      status: result.experiment.status,
      startDate: result.experiment.startDate,
      endDate: result.experiment.endDate,
    },
    variants: result.variants.map(v => ({
      name: v.name,
      participants: v.participants,
      conversions: v.conversions,
      conversionRate: v.conversionRate,
      isControl: v.isControl,
    })),
    statistics: {
      totalParticipants: result.statistics.totalParticipants,
      totalConversions: result.statistics.totalConversions,
      winningVariant: winningComparison?.variant_name,
      significance: winningComparison?.is_significant,
    },
  };
}

/**
 * Example: Check experiment and make decision
 */
export async function analyzeExperimentResults(experimentId: string): Promise<{
  shouldComplete: boolean;
  winningVariant?: string;
  recommendation: string;
}> {
  const experimentService = getExperimentService();
  const results = await experimentService.getExperimentResults(experimentId);

  const experiment = results.experiment;
  const stats = results.statistics;

  // Check if we have enough data
  if (stats.totalParticipants < experiment.minimumSampleSize) {
    return {
      shouldComplete: false,
      recommendation: `Need ${experiment.minimumSampleSize - stats.totalParticipants} more participants`,
    };
  }

  // Check for significant results
  const significantResult = stats.comparisons?.find((c: any) => c.is_significant);

  if (significantResult) {
    return {
      shouldComplete: true,
      winningVariant: significantResult.variant_name,
      recommendation: `Variant ${significantResult.variant_name} shows ${significantResult.lift?.toFixed(1)}% improvement with statistical significance (p=${significantResult.p_value})`,
    };
  }

  // No significant results yet
  return {
    shouldComplete: false,
    recommendation: 'No statistically significant difference found yet. Continue running.',
  };
}

// ============================================
// Example Usage in Referral Flow
// ============================================

/**
 * Example: How to use in referral registration flow
 * 
 * This would be called in the referral registration handler
 */
export async function processReferralWithExperiment(
  inviteToken: string,
  inviteeUserId: string,
  referrerUserId: string
): Promise<{
  success: boolean;
  inviteeBonusDays: number;
  referrerBonusDays: number;
}> {
  // Get experiment variant for referrer
  const rewardConfig = await getRewardConfigForUser(referrerUserId);

  log.info('Processing referral with experiment config:', {
    referrerUserId,
    inviteeUserId,
    config: rewardConfig,
  });

  // Apply the reward configuration
  // (This would integrate with the existing referral system)
  
  // Track conversion
  await trackReferralConversion(referrerUserId, 'referral_registered', {
    inviteeUserId,
    inviteeBonusDays: rewardConfig.inviteeBonusDays,
  });

  return {
    success: true,
    inviteeBonusDays: rewardConfig.inviteeBonusDays,
    referrerBonusDays: rewardConfig.referrerBonusDays,
  };
}

/**
 * Example: Complete referral activation flow
 */
export async function processReferralActivationWithExperiment(
  inviteeUserId: string,
  referrerUserId: string
): Promise<void> {
  const rewardConfig = await getRewardConfigForUser(referrerUserId);

  log.info('Processing referral activation:', {
    referrerUserId,
    inviteeUserId,
    referrerBonusDays: rewardConfig.referrerBonusDays,
  });

  // Track conversion event
  await trackReferralConversion(referrerUserId, 'referral_activated', {
    inviteeUserId,
    referrerBonusDays: rewardConfig.referrerBonusDays,
  });

  await trackReferralConversion(referrerUserId, 'reward_earned', {
    amount: rewardConfig.referrerBonusDays,
    type: 'vip_days',
  });
}