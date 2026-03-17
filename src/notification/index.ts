/**
 * Notification Module
 * Export all notification-related functionality
 */

export { NotificationService, default as notificationService } from './NotificationService.js';
export { NotificationTemplates, default as notificationTemplates } from './NotificationTemplates.js';

export type {
  Notification,
  NotificationType,
  NotificationPriority,
  SignalNotificationData,
  RiskNotificationData,
  PerformanceNotificationData,
  SystemNotificationData,
} from './NotificationService.js';

export type { NotificationTemplate } from './NotificationTemplates.js';
