/**
 * Push Providers Interface
 * Defines the contract for push notification service providers
 */

import { createLogger } from '../utils/logger.js';

const log = createLogger('PushProviders');

/**
 * Push notification device token
 */
export interface PushDeviceToken {
  token: string;
  platform: 'ios' | 'android' | 'web';
  deviceId?: string;
  userId?: string;
}

/**
 * Push notification data payload
 */
export interface PushData {
  [key: string]: string | number | boolean | object;
}

/**
 * Push notification options
 */
export interface PushOptions {
  /**
   * Notification icon (Android/Web)
   */
  icon?: string;

  /**
   * Notification image (rich notification)
   */
  image?: string;

  /**
   * Badge count (iOS)
   */
  badge?: number;

  /**
   * Sound to play
   */
  sound?: string;

  /**
   * Priority level (high/normal)
   */
  priority?: 'high' | 'normal';

  /**
   * Time-to-live in seconds
   */
  ttl?: number;

  /**
   * Scheduled delivery time
   */
  scheduledAt?: Date;

  /**
   * Collapse key for grouping
   */
  collapseKey?: string;

  /**
   * Custom data payload
   */
  data?: PushData;

  /**
   * Action buttons
   */
  actions?: PushAction[];

  /**
   * Tags for analytics
   */
  tags?: Record<string, string>;

  /**
   * Channel ID (Android 8.0+)
   */
  channelId?: string;
}

/**
 * Push notification action button
 */
export interface PushAction {
  id: string;
  title: string;
  icon?: string;
}

/**
 * Push notification message structure
 */
export interface PushMessage {
  /**
   * Target device tokens
   */
  tokens: PushDeviceToken[];

  /**
   * Notification title
   */
  title: string;

  /**
   * Notification body/message
   */
  body: string;

  /**
   * Additional options
   */
  options?: PushOptions;
}

/**
 * Push send result for a single token
 */
export interface PushTokenResult {
  token: string;
  success: boolean;
  error?: string;
  messageId?: string;
}

/**
 * Push send result
 */
export interface PushSendResult {
  success: boolean;
  provider?: string;
  messageId?: string;
  results?: PushTokenResult[];
  error?: string;
  totalSent: number;
  totalFailed: number;
}

/**
 * Base interface for push providers
 */
export interface IPushProvider {
  readonly name: string;
  readonly isConfigured: boolean;
  send(message: PushMessage): Promise<PushSendResult>;
}

/**
 * Mock Push Provider
 * Used for development and testing - logs push notifications instead of sending
 */
export class MockPushProvider implements IPushProvider {
  readonly name = 'mock';
  readonly isConfigured = true;

  async send(message: PushMessage): Promise<PushSendResult> {
    const tokenList = message.tokens.map(t => 
      `${t.platform}:${t.token.substring(0, 12)}...`
    );

    log.info('[MOCK PUSH] Push notification would be sent:', {
      tokens: tokenList,
      title: message.title,
      body: message.body,
      options: message.options,
    });

    // In development, also log full notification content for debugging
    if (process.env.NODE_ENV !== 'production') {
      console.log('\n========== MOCK PUSH ==========');
      console.log('Tokens:', tokenList.join(', '));
      console.log('Title:', message.title);
      console.log('Body:', message.body);
      if (message.options?.data) {
        console.log('Data:', JSON.stringify(message.options.data, null, 2));
      }
      if (message.options?.actions) {
        console.log('Actions:', message.options.actions.map(a => a.title).join(', '));
      }
      console.log('=================================\n');
    }

    // Generate mock results for each token
    const results: PushTokenResult[] = message.tokens.map(token => ({
      token: token.token,
      success: true,
      messageId: `mock_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    }));

    return {
      success: true,
      provider: 'mock',
      messageId: `mock_batch_${Date.now()}`,
      results,
      totalSent: message.tokens.length,
      totalFailed: 0,
    };
  }
}

/**
 * Firebase Cloud Messaging (FCM) Provider Configuration
 */
export interface FCMConfig {
  /**
   * Path to service account JSON file
   */
  serviceAccountPath?: string;

  /**
   * Or raw service account JSON
   */
  serviceAccount?: object;

  /**
   * Project ID (optional, extracted from service account)
   */
  projectId?: string;
}

/**
 * Firebase Cloud Messaging (FCM) Provider
 * Note: Actual implementation requires firebase-admin package
 */
export class FCMProvider implements IPushProvider {
  readonly name = 'fcm';
  private config: FCMConfig;

  constructor(config?: FCMConfig) {
    this.config = {
      serviceAccountPath: config?.serviceAccountPath ?? process.env.FCM_SERVICE_ACCOUNT_PATH,
      serviceAccount: config?.serviceAccount,
      projectId: config?.projectId ?? process.env.FCM_PROJECT_ID,
    };
  }

  get isConfigured(): boolean {
    return !!(this.config.serviceAccountPath || this.config.serviceAccount);
  }

  async send(message: PushMessage): Promise<PushSendResult> {
    if (!this.isConfigured) {
      return {
        success: false,
        provider: 'fcm',
        error: 'Firebase credentials not configured. Set FCM_SERVICE_ACCOUNT_PATH or provide serviceAccount.',
        totalSent: 0,
        totalFailed: message.tokens.length,
      };
    }

    // Placeholder for actual FCM implementation
    // To implement: install firebase-admin and use it here
    log.warn('FCM provider not fully implemented - falling back to mock');

    const results: PushTokenResult[] = message.tokens.map(token => ({
      token: token.token,
      success: false,
      error: 'FCM integration not implemented. Install firebase-admin and implement the send method.',
    }));

    return {
      success: false,
      provider: 'fcm',
      error: 'FCM integration not implemented. Install firebase-admin and implement the send method.',
      results,
      totalSent: 0,
      totalFailed: message.tokens.length,
    };
  }
}

/**
 * OneSignal Provider Configuration
 */
export interface OneSignalConfig {
  appId: string;
  apiKey: string;
}

/**
 * OneSignal Push Provider
 * Note: Actual implementation requires onesignal-node or direct API calls
 */
export class OneSignalProvider implements IPushProvider {
  readonly name = 'onesignal';
  private appId: string | null = null;
  private apiKey: string | null = null;

  constructor(config?: OneSignalConfig) {
    this.appId = config?.appId ?? process.env.ONESIGNAL_APP_ID ?? null;
    this.apiKey = config?.apiKey ?? process.env.ONESIGNAL_API_KEY ?? null;
  }

  get isConfigured(): boolean {
    return !!(this.appId && this.apiKey);
  }

  async send(message: PushMessage): Promise<PushSendResult> {
    if (!this.isConfigured) {
      return {
        success: false,
        provider: 'onesignal',
        error: 'OneSignal credentials not configured. Set ONESIGNAL_APP_ID and ONESIGNAL_API_KEY.',
        totalSent: 0,
        totalFailed: message.tokens.length,
      };
    }

    // Placeholder for actual OneSignal implementation
    // To implement: use fetch or onesignal-node package
    log.warn('OneSignal provider not fully implemented - falling back to mock');

    const results: PushTokenResult[] = message.tokens.map(token => ({
      token: token.token,
      success: false,
      error: 'OneSignal integration not implemented.',
    }));

    return {
      success: false,
      provider: 'onesignal',
      error: 'OneSignal integration not implemented.',
      results,
      totalSent: 0,
      totalFailed: message.tokens.length,
    };
  }
}

/**
 * Expo Push Notifications Provider Configuration
 */
export interface ExpoPushConfig {
  /**
   * Expo access token (optional for basic usage)
   */
  accessToken?: string;
}

/**
 * Expo Push Notifications Provider
 * For React Native apps using Expo
 * Note: Requires expo-server-sdk-node package
 */
export class ExpoPushProvider implements IPushProvider {
  readonly name = 'expo';
  private accessToken: string | null = null;

  constructor(config?: ExpoPushConfig) {
    this.accessToken = config?.accessToken ?? process.env.EXPO_ACCESS_TOKEN ?? null;
  }

  get isConfigured(): boolean {
    return true; // Expo doesn't require configuration for basic usage
  }

  async send(message: PushMessage): Promise<PushSendResult> {
    // Placeholder for actual Expo implementation
    // To implement: install expo-server-sdk-node and use it here
    log.warn('Expo Push provider not fully implemented - falling back to mock');

    const results: PushTokenResult[] = message.tokens.map(token => ({
      token: token.token,
      success: false,
      error: 'Expo Push integration not implemented. Install expo-server-sdk-node.',
    }));

    return {
      success: false,
      provider: 'expo',
      error: 'Expo Push integration not implemented. Install expo-server-sdk-node.',
      results,
      totalSent: 0,
      totalFailed: message.tokens.length,
    };
  }
}

/**
 * Web Push Provider Configuration
 */
export interface WebPushConfig {
  vapidPublicKey?: string;
  vapidPrivateKey?: string;
  subject?: string; // mailto: or https:// URL
}

/**
 * Web Push Provider (Web Push Protocol - VAPID)
 * For browser-based push notifications
 * Note: Requires web-push package
 */
export class WebPushProvider implements IPushProvider {
  readonly name = 'webpush';
  private config: WebPushConfig;

  constructor(config?: WebPushConfig) {
    this.config = {
      vapidPublicKey: config?.vapidPublicKey ?? process.env.VAPID_PUBLIC_KEY,
      vapidPrivateKey: config?.vapidPrivateKey ?? process.env.VAPID_PRIVATE_KEY,
      subject: config?.subject ?? process.env.VAPID_SUBJECT ?? 'mailto:noreply@alphaarena.com',
    };
  }

  get isConfigured(): boolean {
    return !!(this.config.vapidPublicKey && this.config.vapidPrivateKey);
  }

  async send(message: PushMessage): Promise<PushSendResult> {
    if (!this.isConfigured) {
      return {
        success: false,
        provider: 'webpush',
        error: 'VAPID keys not configured. Set VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY.',
        totalSent: 0,
        totalFailed: message.tokens.length,
      };
    }

    // Placeholder for actual Web Push implementation
    // To implement: install web-push and use it here
    log.warn('Web Push provider not fully implemented - falling back to mock');

    const results: PushTokenResult[] = message.tokens.map(token => ({
      token: token.token,
      success: false,
      error: 'Web Push integration not implemented. Install web-push.',
    }));

    return {
      success: false,
      provider: 'webpush',
      error: 'Web Push integration not implemented. Install web-push.',
      results,
      totalSent: 0,
      totalFailed: message.tokens.length,
    };
  }
}

/**
 * Provider type enum
 */
export type PushProviderType = 'mock' | 'fcm' | 'onesignal' | 'expo' | 'webpush';

/**
 * Push Provider Factory Configuration
 */
export interface PushProviderConfig {
  default?: PushProviderType;
  fcm?: FCMConfig;
  onesignal?: OneSignalConfig;
  expo?: ExpoPushConfig;
  webpush?: WebPushConfig;
}

/**
 * Create a push provider instance
 */
export function createPushProvider(type: PushProviderType, config?: PushProviderConfig): IPushProvider {
  switch (type) {
    case 'fcm':
      return new FCMProvider(config?.fcm);
    case 'onesignal':
      return new OneSignalProvider(config?.onesignal);
    case 'expo':
      return new ExpoPushProvider(config?.expo);
    case 'webpush':
      return new WebPushProvider(config?.webpush);
    case 'mock':
    default:
      return new MockPushProvider();
  }
}

export default {
  MockPushProvider,
  FCMProvider,
  OneSignalProvider,
  ExpoPushProvider,
  WebPushProvider,
  createPushProvider,
};