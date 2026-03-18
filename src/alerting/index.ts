/**
 * AlphaArena Alerting Module
 * 
 * Exports all alerting-related services and utilities.
 */

export {
  AlertService,
  getAlertService,
  AlertContext,
  SchedulerAlertContext,
  AlertNotifierConfig,
} from './AlertService';

export type {
  AlertRule,
  AlertRuleType,
  AlertSeverity,
  EntityType,
  CreateAlertRuleInput,
  UpdateAlertRuleInput,
  AlertRuleFilters,
} from '../database/alert-rules.dao';

export type {
  AlertHistory,
  NotificationStatus,
  CreateAlertHistoryInput,
  UpdateAlertHistoryInput,
  AlertHistoryFilters,
} from '../database/alert-history.dao';

export type {
  AlertConfiguration,
  UpdateAlertConfigurationInput,
} from '../database/alert-configurations.dao';

export { alertRulesDao } from '../database/alert-rules.dao';
export { alertHistoryDao } from '../database/alert-history.dao';
export { alertConfigurationsDao } from '../database/alert-configurations.dao';
