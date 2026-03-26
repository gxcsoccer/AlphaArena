/**
 * Reward Module
 * Exports all reward-related functionality
 */

// Reward Rules Engine
export {
  RewardRulesEngine,
  getRewardRulesEngine,
  default as rewardRulesEngine,
} from './RewardRulesEngine.js';

export type {
  RewardRule,
  RewardType,
  TriggerEvent,
  RewardLevel,
  RewardCalculationResult,
  CreateRewardRuleInput,
} from './RewardRulesEngine.js';

// Anti-Fraud Service
export {
  AntiFraudService,
  getAntiFraudService,
  default as antiFraudService,
} from './AntiFraudService.js';

export type {
  FraudFlag,
  FraudFlagType,
  FraudSeverity,
  FraudCheckResult,
  FraudCheckContext,
} from './AntiFraudService.js';

// Reward Notification Service
export {
  RewardNotificationService,
  getRewardNotificationService,
  default as rewardNotificationService,
} from './RewardNotificationService.js';

export type {
  RewardNotificationType,
  RewardNotificationData,
  NotificationTemplate,
} from './RewardNotificationService.js';

// Reward Service (main service)
export {
  RewardService,
  getRewardService,
  default as rewardService,
} from './RewardService.js';

export type {
  ProcessRewardInput,
  ProcessRewardResult,
  RewardHistoryEntry,
  RewardHistoryOptions,
  RewardStats,
} from './RewardService.js';