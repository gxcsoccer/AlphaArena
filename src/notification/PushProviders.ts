/**
 * Push Providers Interface
 * Defines the contract for push notification service providers
 */

import { createLogger } from '../utils/logger.js';
import { initializeApp, cert, App, getApps } from 'firebase-admin/app';
import { getMessaging, Messaging } from 'firebase-admin/messaging';

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
   * Project ID (can be set via environment variable)
   */
  projectId?: string;

  /**
   * Client email from service account (for environment variable config)
   */
  clientEmail?: string;

  /**
   * Private key from service account (for environment variable config)
   */
  privateKey?: string;
}

/**
 * Firebase Cloud Messaging (FCM) Provider
 * Requires firebase-admin package
 */
export class FCMProvider implements IPushProvider {
  readonly name = 'fcm';
  private config: FCMConfig;
  private app: App | null = null;
  private messaging: Messaging | null = null;
  private initialized = false;

  constructor(config?: FCMConfig) {
    this.config = {
      serviceAccountPath: config?.serviceAccountPath ?? process.env.FCM_SERVICE_ACCOUNT_PATH,
      serviceAccount: config?.serviceAccount,
      projectId: config?.projectId ?? process.env.FIREBASE_PROJECT_ID ?? process.env.FCM_PROJECT_ID,
      clientEmail: config?.clientEmail ?? process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: config?.privateKey ?? process.env.FIREBASE_PRIVATE_KEY,
    };

    this.initialize();
  }

  /**
   * Initialize Firebase Admin SDK
   */
  private initialize(): void {
    if (this.initialized) {
      return;
    }

    try {
      // Check if already initialized
      const apps = getApps();
      if (apps.length > 0) {
        this.app = apps[0];
        this.messaging = getMessaging(this.app);
        this.initialized = true;
        log.info('FCM: Using existing Firebase app instance');
        return;
      }

      // Initialize from service account path
      if (this.config.serviceAccountPath) {
        const serviceAccount = require(this.config.serviceAccountPath);
        this.app = initializeApp({
          credential: cert(serviceAccount),
        });
        this.messaging = getMessaging(this.app);
        this.initialized = true;
        log.info('FCM: Initialized from service account file', {
          projectId: serviceAccount.project_id,
        });
        return;
      }

      // Initialize from service account object
      if (this.config.serviceAccount) {
        this.app = initializeApp({
          credential: cert(this.config.serviceAccount as any),
        });
        this.messaging = getMessaging(this.app);
        this.initialized = true;
        log.info('FCM: Initialized from service account object');
        return;
      }

      // Initialize from environment variables
      if (this.config.projectId && this.config.clientEmail && this.config.privateKey) {
        // Handle escaped newlines in private key
        const privateKey = this.config.privateKey.replace(/\\n/g, '\n');

        this.app = initializeApp({
          credential: cert({
            projectId: this.config.projectId,
            clientEmail: this.config.clientEmail,
            privateKey: privateKey,
          }),
        });
        this.messaging = getMessaging(this.app);
        this.initialized = true;
        log.info('FCM: Initialized from environment variables', {
          projectId: this.config.projectId,
        });
        return;
      }

      log.warn('FCM: Not configured - missing credentials. Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY environment variables.');
    } catch (error) {
      log.error('FCM: Failed to initialize', error);
      this.initialized = false;
    }
  }

  get isConfigured(): boolean {
    return this.initialized && this.messaging !== null;
  }

  async send(message: PushMessage): Promise<PushSendResult> {
    if (!this.isConfigured || !this.messaging) {
      return {
        success: false,
        provider: 'fcm',
        error: 'Firebase not configured. Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY environment variables.',
        totalSent: 0,
        totalFailed: message.tokens.length,
      };
    }

    try {
      log.debug('FCM: Sending push notification', {
        tokenCount: message.tokens.length,
        title: message.title,
      });

      // Build FCM message for each token
      const results: PushTokenResult[] = [];
      let successCount = 0;
      let failureCount = 0;

      // FCM supports multicast (up to 500 tokens per request)
      const tokens = message.tokens.map(t => t.token);

      // Build the notification payload
      const notification = {
        title: message.title,
        body: message.body,
      };

      // Build the Android-specific options
      const android: any = {};
      if (message.options) {
        android.notification = {};
        
        if (message.options.icon) {
          android.notification.icon = message.options.icon;
        }
        if (message.options.sound) {
          android.notification.sound = message.options.sound;
        }
        if (message.options.channelId) {
          android.notification.channel_id = message.options.channelId;
        }
        if (message.options.priority === 'high') {
          android.priority = 'high';
        }
        if (message.options.ttl) {
          android.ttl = message.options.ttl;
        }
        if (message.options.collapseKey) {
          android.collapseKey = message.options.collapseKey;
        }
      }

      // Build the APNS (iOS) specific options
      const apns: any = {
        payload: {
          aps: {},
        },
      };
      if (message.options) {
        if (message.options.badge !== undefined) {
          apns.payload.aps.badge = message.options.badge;
        }
        if (message.options.sound) {
          apns.payload.aps.sound = message.options.sound;
        }
        if (message.options.priority === 'high') {
          apns.headers = {
            'apns-priority': '10',
          };
        }
      }

      // Build the data payload
      const data: Record<string, string> = {};
      if (message.options?.data) {
        for (const [key, value] of Object.entries(message.options.data)) {
          // FCM data values must be strings
          data[key] = typeof value === 'string' ? value : JSON.stringify(value);
        }
      }

      // Send multicast message
      const multicastMessage: any = {
        tokens: tokens,
        notification: notification,
        data: Object.keys(data).length > 0 ? data : undefined,
        android: Object.keys(android).length > 0 ? android : undefined,
        apns: apns,
      };

      // Remove undefined values
      Object.keys(multicastMessage).forEach(key => {
        if (multicastMessage[key] === undefined) {
          delete multicastMessage[key];
        }
      });

      log.debug('FCM: Sending multicast', {
        tokenCount: tokens.length,
        notification: notification,
      });

      const response = await this.messaging.sendEachForMulticast(multicastMessage);

      log.info('FCM: Send completed', {
        successCount: response.successCount,
        failureCount: response.failureCount,
      });

      // Process responses
      response.responses.forEach((resp, index) => {
        const token = tokens[index];
        if (resp.success) {
          successCount++;
          results.push({
            token: token,
            success: true,
            messageId: resp.messageId,
          });
        } else {
          failureCount++;
          const errorInfo = resp.error;
          const errorMessage = errorInfo 
            ? `${errorInfo.code}: ${errorInfo.message}`
            : 'Unknown FCM error';
          
          results.push({
            token: token,
            success: false,
            error: errorMessage,
          });

          // Log specific errors for debugging
          if (errorInfo) {
            if (errorInfo.code === 'messaging/invalid-registration-token' ||
                errorInfo.code === 'messaging/registration-token-not-registered') {
              log.warn('FCM: Invalid or unregistered token', { token: token.substring(0, 20) + '...' });
            } else {
              log.error('FCM: Failed to send to token', errorInfo);
            }
          }
        }
      });

      return {
        success: failureCount === 0,
        provider: 'fcm',
        messageId: response.successCount > 0 
          ? `fcm_batch_${Date.now()}` 
          : undefined,
        results,
        totalSent: successCount,
        totalFailed: failureCount,
        error: failureCount > 0 
          ? `${failureCount} of ${tokens.length} messages failed` 
          : undefined,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      log.error('FCM: Exception while sending push notification', error);

      return {
        success: false,
        provider: 'fcm',
        error: `FCM error: ${errorMessage}`,
        totalSent: 0,
        totalFailed: message.tokens.length,
      };
    }
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