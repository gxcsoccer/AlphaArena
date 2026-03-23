/**
 * Onboarding DAO
 *
 * Data access layer for user onboarding state
 *
 * @module database/onboarding.dao
 */

import { getSupabaseAdminClient } from './client';
import { createLogger } from '../utils/logger';
import {
  UserOnboardingState,
  OnboardingAnalyticsEvent,
  OnboardingMetrics,
  OnboardingStepMetrics,
  OnboardingFlow,
} from '../analytics/onboarding.types';

const log = createLogger('OnboardingDAO');

/**
 * Default onboarding flow definition
 */
export const DEFAULT_ONBOARDING_FLOW: OnboardingFlow = {
  id: 'default-new-user',
  name: 'New User Onboarding',
  description: 'Standard onboarding flow for new users',
  targetAudience: 'new_users',
  isActive: true,
  priority: 100,
  steps: [
    {
      id: 'welcome',
      title: '欢迎来到 AlphaArena',
      description: '您的专业算法交易平台。让我们快速了解核心功能。',
      order: 1,
      type: 'modal',
      icon: 'trophy',
      skippable: true,
    },
    {
      id: 'market',
      title: '实时行情',
      description: '查看实时市场数据和价格走势。选择交易对，分析图表。',
      order: 2,
      type: 'spotlight',
      targetSelector: '[data-onboarding="market-panel"]',
      side: 'right',
      icon: 'chart',
      link: '/',
    },
    {
      id: 'trading',
      title: '交易面板',
      description: '在这里快速下单。支持市价单、限价单等多种订单类型。',
      order: 3,
      type: 'tooltip',
      targetSelector: '[data-onboarding="trading-panel"]',
      side: 'left',
      icon: 'trade',
      skippable: true,
    },
    {
      id: 'orderbook',
      title: '订单簿深度',
      description: '实时买卖盘数据，帮助您判断市场深度和流动性。',
      order: 4,
      type: 'tooltip',
      targetSelector: '[data-onboarding="orderbook"]',
      side: 'left',
      icon: 'book',
      skippable: true,
    },
    {
      id: 'strategies',
      title: '智能策略',
      description: '使用预设策略或创建自定义策略进行自动化交易。',
      order: 5,
      type: 'spotlight',
      targetSelector: '[data-onboarding="strategies-nav"]',
      side: 'right',
      icon: 'experiment',
      link: '/strategies',
    },
    {
      id: 'ai-assistant',
      title: 'AI 策略助手',
      description: '点击右下角按钮，随时向 AI 助手咨询市场分析和策略建议。',
      order: 6,
      type: 'spotlight',
      targetSelector: '[data-onboarding="ai-assistant"]',
      side: 'left',
      icon: 'robot',
    },
    {
      id: 'alerts',
      title: '价格提醒',
      description: '设置价格提醒，不错过任何交易机会。',
      order: 7,
      type: 'tooltip',
      targetSelector: '[data-onboarding="notification-bell"]',
      side: 'bottom',
      icon: 'notification',
      skippable: true,
    },
    {
      id: 'complete',
      title: '准备就绪！',
      description: '您已了解核心功能。开始探索 AlphaArena 的强大能力吧！',
      order: 8,
      type: 'modal',
      icon: 'check-circle',
    },
  ],
};

/**
 * Onboarding Data Access Object
 */
class OnboardingDAO {
  /**
   * Get user's onboarding state
   */
  async getUserOnboardingState(userId: string): Promise<UserOnboardingState | null> {
    const supabase = getSupabaseAdminClient();

    const { data, error } = await supabase
      .from('user_onboarding')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      log.error('Failed to get user onboarding state:', error);
      throw new Error(`Failed to get user onboarding state: ${error.message}`);
    }

    return this.mapStateFromDb(data);
  }

  /**
   * Initialize onboarding state for a new user
   */
  async initializeOnboardingState(
    userId: string,
    userRole: 'free' | 'pro' | 'enterprise' = 'free',
    variant?: string
  ): Promise<UserOnboardingState> {
    const supabase = getSupabaseAdminClient();

    const { data, error } = await supabase
      .from('user_onboarding')
      .insert({
        user_id: userId,
        completed_steps: 0,
        completed_step_ids: [],
        current_step_id: DEFAULT_ONBOARDING_FLOW.steps[0]?.id || null,
        is_completed: false,
        started_at: new Date().toISOString(),
        skipped: false,
        last_active_step: DEFAULT_ONBOARDING_FLOW.steps[0]?.id || '',
        step_timestamps: {},
        variant,
        user_role: userRole,
      })
      .select()
      .single();

    if (error) {
      log.error('Failed to initialize onboarding state:', error);
      throw new Error(`Failed to initialize onboarding state: ${error.message}`);
    }

    return this.mapStateFromDb(data);
  }

  /**
   * Update onboarding state
   */
  async updateOnboardingState(
    userId: string,
    updates: Partial<UserOnboardingState>
  ): Promise<UserOnboardingState> {
    const supabase = getSupabaseAdminClient();

    const dbUpdates: Record<string, any> = {};

    if (updates.completedSteps !== undefined) {
      dbUpdates.completed_steps = updates.completedSteps;
    }
    if (updates.completedStepIds !== undefined) {
      dbUpdates.completed_step_ids = updates.completedStepIds;
    }
    if (updates.currentStepId !== undefined) {
      dbUpdates.current_step_id = updates.currentStepId;
    }
    if (updates.isCompleted !== undefined) {
      dbUpdates.is_completed = updates.isCompleted;
    }
    if (updates.completedAt !== undefined) {
      dbUpdates.completed_at = updates.completedAt?.toISOString();
    }
    if (updates.skipped !== undefined) {
      dbUpdates.skipped = updates.skipped;
    }
    if (updates.lastActiveStep !== undefined) {
      dbUpdates.last_active_step = updates.lastActiveStep;
    }
    if (updates.stepTimestamps !== undefined) {
      dbUpdates.step_timestamps = updates.stepTimestamps;
    }
    if (updates.properties !== undefined) {
      dbUpdates.properties = updates.properties;
    }

    const { data, error } = await supabase
      .from('user_onboarding')
      .update(dbUpdates)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      log.error('Failed to update onboarding state:', error);
      throw new Error(`Failed to update onboarding state: ${error.message}`);
    }

    return this.mapStateFromDb(data);
  }

  /**
   * Complete a step
   */
  async completeStep(
    userId: string,
    stepId: string,
    nextStepId?: string
  ): Promise<UserOnboardingState> {
    const currentState = await this.getUserOnboardingState(userId);

    if (!currentState) {
      throw new Error('User onboarding state not found');
    }

    const completedStepIds = [...new Set([...currentState.completedStepIds, stepId])];
    const stepTimestamps: Record<string, Date> = {
      ...currentState.stepTimestamps,
      [stepId]: new Date(),
    };

    const totalSteps = DEFAULT_ONBOARDING_FLOW.steps.length;
    const isCompleted = completedStepIds.length >= totalSteps;

    return this.updateOnboardingState(userId, {
      completedSteps: completedStepIds.length,
      completedStepIds,
      currentStepId: nextStepId || null,
      lastActiveStep: stepId,
      stepTimestamps,
      isCompleted,
      completedAt: isCompleted ? new Date() : undefined,
    });
  }

  /**
   * Skip onboarding
   */
  async skipOnboarding(userId: string): Promise<UserOnboardingState> {
    return this.updateOnboardingState(userId, {
      skipped: true,
      isCompleted: true,
      completedAt: new Date(),
    });
  }

  /**
   * Reset onboarding for replay
   */
  async resetOnboarding(userId: string): Promise<UserOnboardingState> {
    const supabase = getSupabaseAdminClient();

    const { data, error } = await supabase
      .from('user_onboarding')
      .update({
        completed_steps: 0,
        completed_step_ids: [],
        current_step_id: DEFAULT_ONBOARDING_FLOW.steps[0]?.id || null,
        is_completed: false,
        completed_at: null,
        skipped: false,
        last_active_step: DEFAULT_ONBOARDING_FLOW.steps[0]?.id || '',
        step_timestamps: {},
        started_at: new Date().toISOString(),
      })
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      log.error('Failed to reset onboarding:', error);
      throw new Error(`Failed to reset onboarding: ${error.message}`);
    }

    return this.mapStateFromDb(data);
  }

  /**
   * Track onboarding analytics event
   */
  async trackOnboardingEvent(event: OnboardingAnalyticsEvent): Promise<void> {
    const supabase = getSupabaseAdminClient();

    const { error } = await supabase
      .from('onboarding_analytics')
      .insert({
        user_id: event.userId,
        session_id: event.sessionId,
        event_type: event.eventType,
        flow_id: event.flowId,
        step_id: event.stepId,
        step_order: event.stepOrder,
        time_on_step: event.timeOnStep,
        variant: event.variant,
        properties: event.properties || {},
        occurred_at: event.occurredAt.toISOString(),
      });

    if (error) {
      log.error('Failed to track onboarding event:', error);
      // Don't throw - analytics shouldn't break the flow
    }
  }

  /**
   * Get onboarding metrics
   */
  async getOnboardingMetrics(
    startDate?: Date,
    endDate?: Date
  ): Promise<OnboardingMetrics> {
    const supabase = getSupabaseAdminClient();

    const start = startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate || new Date();

    // Get total started
    const { data: startedData } = await supabase
      .from('onboarding_analytics')
      .select('user_id', { count: 'exact', head: false })
      .eq('event_type', 'flow_started')
      .gte('occurred_at', start.toISOString())
      .lte('occurred_at', end.toISOString());

    // Get total completed
    const { data: completedData } = await supabase
      .from('onboarding_analytics')
      .select('user_id', { count: 'exact', head: false })
      .eq('event_type', 'flow_completed')
      .gte('occurred_at', start.toISOString())
      .lte('occurred_at', end.toISOString());

    // Get skipped
    const { data: skippedData } = await supabase
      .from('onboarding_analytics')
      .select('user_id', { count: 'exact', head: false })
      .eq('event_type', 'flow_abandoned')
      .gte('occurred_at', start.toISOString())
      .lte('occurred_at', end.toISOString());

    const totalStarted = new Set(startedData?.map(d => d.user_id) || []).size;
    const totalCompleted = new Set(completedData?.map(d => d.user_id) || []).size;
    const totalSkipped = new Set(skippedData?.map(d => d.user_id) || []).size;

    // Get average completion time
    const { data: completionTimes } = await supabase
      .from('onboarding_analytics')
      .select('user_id, time_on_step')
      .eq('event_type', 'flow_completed')
      .gte('occurred_at', start.toISOString())
      .lte('occurred_at', end.toISOString())
      .not('time_on_step', 'is', null);

    const avgCompletionTime = completionTimes && completionTimes.length > 0
      ? completionTimes.reduce((sum, d) => sum + (d.time_on_step || 0), 0) / completionTimes.length
      : 0;

    // Get step metrics
    const stepMetrics = await this.getStepMetrics(start, end);

    return {
      totalStarted,
      totalCompleted,
      completionRate: totalStarted > 0 ? (totalCompleted / totalStarted) * 100 : 0,
      avgCompletionTime,
      skipRate: totalStarted > 0 ? (totalSkipped / totalStarted) * 100 : 0,
      stepMetrics,
    };
  }

  /**
   * Get step-level metrics
   */
  private async getStepMetrics(startDate: Date, endDate: Date): Promise<OnboardingStepMetrics[]> {
    const supabase = getSupabaseAdminClient();
    const stepMetrics: OnboardingStepMetrics[] = [];

    for (const step of DEFAULT_ONBOARDING_FLOW.steps) {
      // Get views
      const { data: viewedData } = await supabase
        .from('onboarding_analytics')
        .select('user_id')
        .eq('event_type', 'step_viewed')
        .eq('step_id', step.id)
        .gte('occurred_at', startDate.toISOString())
        .lte('occurred_at', endDate.toISOString());

      // Get completions
      const { data: completedData } = await supabase
        .from('onboarding_analytics')
        .select('user_id, time_on_step')
        .eq('event_type', 'step_completed')
        .eq('step_id', step.id)
        .gte('occurred_at', startDate.toISOString())
        .lte('occurred_at', endDate.toISOString());

      // Get skips
      const { data: skippedData } = await supabase
        .from('onboarding_analytics')
        .select('user_id')
        .eq('event_type', 'step_skipped')
        .eq('step_id', step.id)
        .gte('occurred_at', startDate.toISOString())
        .lte('occurred_at', endDate.toISOString());

      const viewed = new Set(viewedData?.map(d => d.user_id) || []).size;
      const completed = new Set(completedData?.map(d => d.user_id) || []).size;
      const skipped = new Set(skippedData?.map(d => d.user_id) || []).size;

      const times = completedData?.map(d => d.time_on_step).filter(Boolean) || [];
      const avgTimeOnStep = times.length > 0
        ? times.reduce((sum: number, t: any) => sum + t, 0) / times.length
        : 0;

      stepMetrics.push({
        stepId: step.id,
        stepName: step.title,
        order: step.order,
        viewed,
        completed,
        skipped,
        completionRate: viewed > 0 ? (completed / viewed) * 100 : 0,
        avgTimeOnStep,
        dropOffRate: 0, // Calculated after we have all steps
      });
    }

    // Calculate drop-off rates
    for (let i = 1; i < stepMetrics.length; i++) {
      const prev = stepMetrics[i - 1];
      const curr = stepMetrics[i];
      curr.dropOffRate = prev.completed > 0
        ? ((prev.completed - curr.viewed) / prev.completed) * 100
        : 0;
    }

    return stepMetrics;
  }

  /**
   * Get default onboarding flow
   */
  getDefaultFlow(): OnboardingFlow {
    return DEFAULT_ONBOARDING_FLOW;
  }

  /**
   * Get next step ID
   */
  getNextStepId(currentStepId: string): string | null {
    const steps = DEFAULT_ONBOARDING_FLOW.steps;
    const currentIndex = steps.findIndex(s => s.id === currentStepId);
    
    if (currentIndex === -1 || currentIndex >= steps.length - 1) {
      return null;
    }
    
    return steps[currentIndex + 1].id;
  }

  /**
   * Get step by ID
   */
  getStepById(stepId: string) {
    return DEFAULT_ONBOARDING_FLOW.steps.find(s => s.id === stepId);
  }

  /**
   * Map database record to state object
   */
  private mapStateFromDb(data: any): UserOnboardingState {
    return {
      userId: data.user_id,
      completedSteps: data.completed_steps || 0,
      completedStepIds: data.completed_step_ids || [],
      currentStepId: data.current_step_id,
      isCompleted: data.is_completed,
      startedAt: new Date(data.started_at),
      completedAt: data.completed_at ? new Date(data.completed_at) : undefined,
      skipped: data.skipped || false,
      lastActiveStep: data.last_active_step,
      stepTimestamps: this.mapTimestamps(data.step_timestamps),
      variant: data.variant,
      userRole: data.user_role || 'free',
      properties: data.properties,
    };
  }

  /**
   * Map timestamps from database
   */
  private mapTimestamps(timestamps: Record<string, string | Date> | null): Record<string, Date> {
    if (!timestamps) return {};
    const result: Record<string, Date> = {};
    for (const [key, value] of Object.entries(timestamps)) {
      result[key] = value instanceof Date ? value : new Date(value);
    }
    return result;
  }
}

// Singleton instance
export const onboardingDAO = new OnboardingDAO();
export default onboardingDAO;