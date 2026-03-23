/**
 * User Onboarding Types
 *
 * Types for user onboarding flow optimization
 *
 * @module analytics/onboarding.types
 */

/**
 * Onboarding step definition
 */
export interface OnboardingStep {
  /** Unique identifier for the step */
  id: string;
  /** Display title */
  title: string;
  /** Description text */
  description: string;
  /** Step order in the flow */
  order: number;
  /** CSS selector for the target element (for spotlight/tooltip) */
  targetSelector?: string;
  /** Step type */
  type: 'modal' | 'tooltip' | 'spotlight' | 'html';
  /** Side position for tooltip */
  side?: 'top' | 'bottom' | 'left' | 'right';
  /** Alignment for tooltip */
  align?: 'start' | 'center' | 'end';
  /** Icon name or URL */
  icon?: string;
  /** Link to navigate to */
  link?: string;
  /** Required user role to show this step */
  requiredRole?: 'free' | 'pro' | 'enterprise';
  /** Condition to check before showing */
  condition?: OnboardingCondition;
  /** Whether this step is skippable */
  skippable?: boolean;
  /** Custom content (for html type) */
  customContent?: string;
}

/**
 * Condition for showing a step
 */
export interface OnboardingCondition {
  /** Check if feature has been used */
  featureUsed?: string;
  /** Check if setting is configured */
  settingConfigured?: string;
  /** Check if a specific event has occurred */
  eventOccurred?: string;
  /** Custom condition function name */
  customCondition?: string;
}

/**
 * User onboarding state
 */
export interface UserOnboardingState {
  /** User ID */
  userId: string;
  /** Total steps completed */
  completedSteps: number;
  /** IDs of completed steps */
  completedStepIds: string[];
  /** Current step ID */
  currentStepId: string | null;
  /** Whether onboarding is completed */
  isCompleted: boolean;
  /** When onboarding started */
  startedAt: Date;
  /** When onboarding completed */
  completedAt?: Date;
  /** Whether user skipped onboarding */
  skipped?: boolean;
  /** Last active step */
  lastActiveStep: string;
  /** Step completion timestamps */
  stepTimestamps: Record<string, Date>;
  /** A/B test variant assigned */
  variant?: string;
  /** User role at time of onboarding */
  userRole: 'free' | 'pro' | 'enterprise';
  /** Custom properties */
  properties?: Record<string, any>;
}

/**
 * Onboarding flow definition
 */
export interface OnboardingFlow {
  /** Flow ID */
  id: string;
  /** Flow name */
  name: string;
  /** Flow description */
  description?: string;
  /** Target audience */
  targetAudience: 'all' | 'new_users' | 'returning_users' | 'upgraded_users';
  /** Steps in the flow */
  steps: OnboardingStep[];
  /** Whether this flow is active */
  isActive: boolean;
  /** Priority for multiple flows */
  priority: number;
  /** A/B test configuration */
  abTestConfig?: OnboardingABTestConfig;
}

/**
 * A/B test configuration for onboarding
 */
export interface OnboardingABTestConfig {
  /** Test ID */
  testId: string;
  /** Test name */
  testName: string;
  /** Variants */
  variants: OnboardingABTestVariant[];
  /** Traffic allocation (0-100) */
  trafficAllocation: number;
  /** Start date */
  startDate?: Date;
  /** End date */
  endDate?: Date;
}

/**
 * A/B test variant
 */
export interface OnboardingABTestVariant {
  /** Variant ID */
  id: string;
  /** Variant name */
  name: string;
  /** Step overrides for this variant */
  stepOverrides?: Partial<OnboardingStep>[];
  /** Traffic split percentage (0-100) */
  split: number;
}

/**
 * Onboarding analytics event
 */
export interface OnboardingAnalyticsEvent {
  /** Event type */
  eventType: 'step_viewed' | 'step_completed' | 'step_skipped' | 
             'flow_started' | 'flow_completed' | 'flow_abandoned' |
             'guide_replayed' | 'guide_dismissed';
  /** User ID */
  userId?: string;
  /** Session ID */
  sessionId?: string;
  /** Flow ID */
  flowId: string;
  /** Step ID */
  stepId?: string;
  /** Step order */
  stepOrder?: number;
  /** Time spent on step (ms) */
  timeOnStep?: number;
  /** A/B test variant */
  variant?: string;
  /** Additional properties */
  properties?: Record<string, any>;
  /** When event occurred */
  occurredAt: Date;
}

/**
 * Onboarding completion metrics
 */
export interface OnboardingMetrics {
  /** Total users started onboarding */
  totalStarted: number;
  /** Total users completed onboarding */
  totalCompleted: number;
  /** Overall completion rate */
  completionRate: number;
  /** Average time to complete (ms) */
  avgCompletionTime: number;
  /** Skip rate */
  skipRate: number;
  /** Per-step metrics */
  stepMetrics: OnboardingStepMetrics[];
  /** A/B test results (if applicable) */
  abTestResults?: OnboardingABTestResults;
}

/**
 * Per-step metrics
 */
export interface OnboardingStepMetrics {
  /** Step ID */
  stepId: string;
  /** Step name */
  stepName: string;
  /** Step order */
  order: number;
  /** Users who viewed this step */
  viewed: number;
  /** Users who completed this step */
  completed: number;
  /** Users who skipped this step */
  skipped: number;
  /** Completion rate for this step */
  completionRate: number;
  /** Average time on step (ms) */
  avgTimeOnStep: number;
  /** Drop-off rate from previous step */
  dropOffRate: number;
}

/**
 * A/B test results
 */
export interface OnboardingABTestResults {
  /** Test ID */
  testId: string;
  /** Test name */
  testName: string;
  /** Per-variant results */
  variantResults: Array<{
    variantId: string;
    variantName: string;
    usersAssigned: number;
    completionRate: number;
    avgCompletionTime: number;
    conversionRate?: number;
  }>;
  /** Winning variant (if determined) */
  winner?: string;
  /** Statistical significance */
  significance?: number;
}

/**
 * Client-side onboarding state
 */
export interface ClientOnboardingState {
  /** Whether onboarding is active */
  isActive: boolean;
  /** Current step index */
  currentStepIndex: number;
  /** Total steps */
  totalSteps: number;
  /** Completed step IDs */
  completedSteps: string[];
  /** Current flow */
  currentFlow: OnboardingFlow | null;
  /** User's onboarding state from server */
  userState: UserOnboardingState | null;
  /** Whether showing progress indicator */
  showProgress: boolean;
}

/**
 * Onboarding context for hooks
 */
export interface OnboardingContextValue extends ClientOnboardingState {
  /** Start onboarding flow */
  startFlow: (flowId?: string) => Promise<void>;
  /** Move to next step */
  nextStep: () => void;
  /** Move to previous step */
  prevStep: () => void;
  /** Go to specific step */
  goToStep: (stepId: string) => void;
  /** Complete current step */
  completeStep: (stepId: string) => Promise<void>;
  /** Skip current step */
  skipStep: () => Promise<void>;
  /** Skip entire flow */
  skipFlow: () => Promise<void>;
  /** Complete flow */
  completeFlow: () => Promise<void>;
  /** Reset and replay */
  replay: () => Promise<void>;
  /** Hide onboarding */
  hide: () => void;
  /** Show onboarding */
  show: () => void;
}