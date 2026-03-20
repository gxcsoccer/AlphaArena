/**
 * Notification Module
 * Export all notification-related functionality
 */

export { NotificationService, default as notificationService } from './NotificationService.js';
export { NotificationTemplates, default as notificationTemplates } from './NotificationTemplates.js';

// Email Service exports
export { 
  EmailService, 
  getEmailService, 
  resetEmailService,
  default as emailService,
} from './EmailService.js';

export {
  MockEmailProvider,
  SendGridProvider,
  AWSSESProvider,
  ResendProvider,
  SMTPProvider,
  createEmailProvider,
  default as emailProviders,
} from './EmailProviders.js';

// Push Service exports
export {
  PushService,
  getPushService,
  resetPushService,
  default as pushService,
} from './PushService.js';

export {
  MockPushProvider,
  FCMProvider,
  OneSignalProvider,
  ExpoPushProvider,
  WebPushProvider,
  createPushProvider,
  default as pushProviders,
} from './PushProviders.js';

export type {
  // Notification types
  Notification,
  NotificationType,
  NotificationPriority,
  SignalNotificationData,
  RiskNotificationData,
  PerformanceNotificationData,
  SystemNotificationData,
} from './NotificationService.js';

export type { NotificationTemplate } from './NotificationTemplates.js';

// Email types
export type {
  EmailMessage,
  EmailSendResult,
  EmailAddress,
  EmailAttachment,
  EmailServiceConfig,
  EmailTemplateType,
  EmailTemplate,
  TemplateData,
} from './EmailService.js';

export type {
  IEmailProvider,
  EmailProviderType,
  EmailProviderConfig,
  SendGridConfig,
  AWSESConfig,
  ResendConfig,
  SMTPConfig,
} from './EmailProviders.js';

// Push types
export type {
  PushMessage,
  PushSendResult,
  PushDeviceToken,
  PushOptions,
  PushData,
  PushServiceConfig,
  PushTemplateType,
  PushTemplate,
  PushTemplateData,
} from './PushService.js';

export type {
  IPushProvider,
  PushProviderType,
  PushProviderConfig,
  PushDeviceToken as PushDeviceTokenType,
  PushOptions as PushOptionsType,
  PushData as PushDataType,
  PushMessage as PushMessageType,
  PushSendResult as PushSendResultType,
  PushTokenResult,
  PushAction,
  FCMConfig,
  OneSignalConfig,
  ExpoPushConfig,
  WebPushConfig,
} from './PushProviders.js';
