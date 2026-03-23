/**
 * Onboarding Service
 *
 * Business logic for user onboarding flow optimization
 *
 * @module analytics/OnboardingService
 */

import { onboardingDAO, DEFAULT_ONBOARDING_FLOW } from '../database/onboarding.dao';
import { userTrackingService } from './UserTrackingService';
import { createLogger } from '../utils/logger';
import {
  UserOnboardingState,
  OnboardingStep,
  OnboardingFlow,
  OnboardingAnalyticsEvent,
  OnboardingMetrics,
  OnboardingABTestConfig,
} from './onboarding.types';

const log = createLogger('OnboardingService');

/**
 * Storage keys for client-side state
 */
const STORAGE_KEYS = {
  ONBOARDING_COMPLETED: 'alphaarena_onboarding_completed',
  ONBOARDING_SKIPPED: 'alphaarena_onboarding_skipped',
  ONBOARDING_STEP: 'alphaarena_onboarding_step',
  ONBOARDING_VARIANT: 'alphaarena_onboarding_variant',
};

/**
 * Onboarding Service
 */
class OnboardingService {
  /**
   * Start onboarding flow for a user
   */
  async startOnboarding(
    userId: string,
    userRole: 'free' | 'pro' | 'enterprise' = 'free',
    sessionId?: string
  ): Promise<{ state: UserOnboardingState; flow: OnboardingFlow }> {
    // Check if user already has state
    let state = await onboardingDAO.getUserOnboardingState(userId);

    if (!state) {
      // Initialize new state
      const variant = await this.assignVariant(userId);
      state = await onboardingDAO.initializeOnboardingState(userId, userRole, variant);
    } else if (state.isCompleted) {
      // Return existing completed state
      log.info('User has already completed onboarding', { userId });
    }

    // Track flow started event
    await this.trackEvent({
      eventType: 'flow_started',
      userId,
      sessionId,
      flowId: DEFAULT_ONBOARDING_FLOW.id,
      variant: state.variant,
      occurredAt: new Date(),
    });

    return {
      state,
      flow: this.getFlowForVariant(DEFAULT_ONBOARDING_FLOW, state.variant),
    };
  }

  /**
   * Complete a step
   */
  async completeStep(
    userId: string,
    stepId: string,
    sessionId?: string,
    timeOnStep?: number
  ): Promise<UserOnboardingState> {
    const currentState = await onboardingDAO.getUserOnboardingState(userId);

    if (!currentState) {
      throw new Error('User onboarding state not found');
    }

    const nextStepId = onboardingDAO.getNextStepId(stepId);
    const newState = await onboardingDAO.completeStep(userId, stepId, nextStepId ?? undefined);

    // Track step completed event
    const step = onboardingDAO.getStepById(stepId);
    await this.trackEvent({
      eventType: 'step_completed',
      userId,
      sessionId,
      flowId: DEFAULT_ONBOARDING_FLOW.id,
      stepId,
      stepOrder: step?.order,
      timeOnStep,
      variant: currentState.variant,
      occurredAt: new Date(),
    });

    // Check if flow is completed
    if (newState.isCompleted) {
      await this.trackEvent({
        eventType: 'flow_completed',
        userId,
        sessionId,
        flowId: DEFAULT_ONBOARDING_FLOW.id,
        timeOnStep: this.calculateTotalTime(newState.stepTimestamps),
        variant: currentState.variant,
        occurredAt: new Date(),
      });

      // Also track via user tracking service
      await userTrackingService.trackEvent(
        {
          eventType: 'feature_used',
          eventName: 'Onboarding Completed',
          properties: {
            flowId: DEFAULT_ONBOARDING_FLOW.id,
            completedSteps: newState.completedSteps,
            totalTime: this.calculateTotalTime(newState.stepTimestamps),
            variant: currentState.variant,
          },
        },
        { 
          sessionId: sessionId || '', 
          userId,
          deviceId: '',
          pageUrl: '',
          pageTitle: '',
          userAgent: '',
          screenResolution: '',
          viewportSize: '',
          language: 'en',
          timezone: '',
        }
      );
    }

    return newState;
  }

  /**
   * Skip a step
   */
  async skipStep(
    userId: string,
    stepId: string,
    sessionId?: string
  ): Promise<UserOnboardingState> {
    const currentState = await onboardingDAO.getUserOnboardingState(userId);

    if (!currentState) {
      throw new Error('User onboarding state not found');
    }

    // Mark step as completed even when skipped (for flow progression)
    const nextStepId = onboardingDAO.getNextStepId(stepId);
    const newState = await onboardingDAO.completeStep(userId, stepId, nextStepId ?? undefined);

    // Track step skipped event
    const step = onboardingDAO.getStepById(stepId);
    await this.trackEvent({
      eventType: 'step_skipped',
      userId,
      sessionId,
      flowId: DEFAULT_ONBOARDING_FLOW.id,
      stepId,
      stepOrder: step?.order,
      variant: currentState.variant,
      occurredAt: new Date(),
    });

    return newState;
  }

  /**
   * Skip entire onboarding
   */
  async skipOnboarding(
    userId: string,
    sessionId?: string
  ): Promise<UserOnboardingState> {
    const state = await onboardingDAO.skipOnboarding(userId);

    // Track flow abandoned event
    await this.trackEvent({
      eventType: 'flow_abandoned',
      userId,
      sessionId,
      flowId: DEFAULT_ONBOARDING_FLOW.id,
      variant: state.variant,
      occurredAt: new Date(),
    });

    return state;
  }

  /**
   * Reset onboarding for replay
   */
  async replayOnboarding(
    userId: string,
    sessionId?: string
  ): Promise<{ state: UserOnboardingState; flow: OnboardingFlow }> {
    const state = await onboardingDAO.resetOnboarding(userId);

    // Track guide replayed event
    await this.trackEvent({
      eventType: 'guide_replayed',
      userId,
      sessionId,
      flowId: DEFAULT_ONBOARDING_FLOW.id,
      variant: state.variant,
      occurredAt: new Date(),
    });

    return {
      state,
      flow: this.getFlowForVariant(DEFAULT_ONBOARDING_FLOW, state.variant),
    };
  }

  /**
   * Get user's onboarding state
   */
  async getOnboardingState(userId: string): Promise<UserOnboardingState | null> {
    return onboardingDAO.getUserOnboardingState(userId);
  }

  /**
   * Get onboarding flow
   */
  getOnboardingFlow(): OnboardingFlow {
    return DEFAULT_ONBOARDING_FLOW;
  }

  /**
   * Get step by ID
   */
  getStep(stepId: string): OnboardingStep | undefined {
    return onboardingDAO.getStepById(stepId);
  }

  /**
   * Get current step for user
   */
  async getCurrentStep(userId: string): Promise<OnboardingStep | null> {
    const state = await onboardingDAO.getUserOnboardingState(userId);

    if (!state || state.isCompleted) {
      return null;
    }

    const stepId = state.currentStepId || state.lastActiveStep;
    return stepId ? onboardingDAO.getStepById(stepId) || null : null;
  }

  /**
   * Track step viewed
   */
  async trackStepViewed(
    userId: string,
    stepId: string,
    sessionId?: string
  ): Promise<void> {
    const state = await onboardingDAO.getUserOnboardingState(userId);
    const step = onboardingDAO.getStepById(stepId);

    await this.trackEvent({
      eventType: 'step_viewed',
      userId,
      sessionId,
      flowId: DEFAULT_ONBOARDING_FLOW.id,
      stepId,
      stepOrder: step?.order,
      variant: state?.variant,
      occurredAt: new Date(),
    });
  }

  /**
   * Get onboarding metrics
   */
  async getMetrics(startDate?: Date, endDate?: Date): Promise<OnboardingMetrics> {
    return onboardingDAO.getOnboardingMetrics(startDate, endDate);
  }

  /**
   * Check if user should see onboarding
   */
  async shouldShowOnboarding(userId: string): Promise<boolean> {
    const state = await onboardingDAO.getUserOnboardingState(userId);

    if (!state) {
      return true;
    }

    return !state.isCompleted && !state.skipped;
  }

  /**
   * Assign A/B test variant
   */
  private async assignVariant(userId: string): Promise<string | undefined> {
    // Simple hash-based assignment for A/B testing
    // In production, this would be more sophisticated
    const abConfig = DEFAULT_ONBOARDING_FLOW.abTestConfig;

    if (!abConfig) {
      return undefined;
    }

    // Check if user is in test (based on traffic allocation)
    const hash = this.simpleHash(userId);
    if (hash % 100 >= abConfig.trafficAllocation) {
      return undefined; // User not in test
    }

    // Assign variant based on splits
    let cumulative = 0;
    const variantHash = hash % 100;

    for (const variant of abConfig.variants) {
      cumulative += variant.split;
      if (variantHash < cumulative) {
        return variant.id;
      }
    }

    return abConfig.variants[0]?.id;
  }

  /**
   * Get flow with variant overrides
   */
  private getFlowForVariant(flow: OnboardingFlow, variantId?: string): OnboardingFlow {
    if (!variantId || !flow.abTestConfig) {
      return flow;
    }

    const variant = flow.abTestConfig.variants.find(v => v.id === variantId);
    if (!variant?.stepOverrides) {
      return flow;
    }

    // Apply step overrides
    const steps = flow.steps.map((step, index) => ({
      ...step,
      ...(variant.stepOverrides?.[index] || {}),
    }));

    return { ...flow, steps };
  }

  /**
   * Track analytics event
   */
  private async trackEvent(event: OnboardingAnalyticsEvent): Promise<void> {
    try {
      await onboardingDAO.trackOnboardingEvent(event);
    } catch (error) {
      log.error('Failed to track onboarding event', { error, event });
    }
  }

  /**
   * Calculate total time from step timestamps
   */
  private calculateTotalTime(timestamps: Record<string, Date>): number {
    const times = Object.values(timestamps);
    if (times.length < 2) return 0;

    const sorted = times.map(t => t.getTime()).sort((a, b) => a - b);
    return sorted[sorted.length - 1] - sorted[0];
  }

  /**
   * Simple hash function for consistent assignment
   */
  private simpleHash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash);
  }

  /**
   * Get storage keys (for client-side use)
   */
  getStorageKeys() {
    return STORAGE_KEYS;
  }
}

// Singleton instance
export const onboardingService = new OnboardingService();
export default onboardingService;