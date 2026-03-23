/**
 * A/B Testing SDK for Client-Side Experiment Assignment and Event Tracking
 *
 * This SDK provides utilities for:
 * - Fetching and caching variant assignments
 * - Tracking events (impressions, clicks, conversions)
 * - Managing experiment state
 */

// Types
export interface ExperimentConfig {
  apiUrl: string;
  sessionId?: string;
  userId?: string;
  deviceId?: string;
  debug?: boolean;
}

export interface VariantAssignment {
  variantId: string;
  variantKey: string;
  config: Record<string, any>;
}

export interface ExperimentAssignments {
  [experimentId: string]: VariantAssignment | null;
}

// Event types
export type ExperimentEventType = 'impression' | 'click' | 'conversion' | 'custom';

// Logger for debug mode
const createLogger = (debug: boolean) => ({
  log: (...args: any[]) => debug && console.log('[AB Testing]', ...args),
  warn: (...args: any[]) => debug && console.warn('[AB Testing]', ...args),
  error: (...args: any[]) => console.error('[AB Testing]', ...args),
});

/**
 * Generate a unique session ID
 */
export function generateSessionId(): string {
  return `sess_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
}

/**
 * Generate a unique device ID (persisted in localStorage)
 */
export function getOrCreateDeviceId(): string {
  const STORAGE_KEY = 'ab_device_id';

  if (typeof window === 'undefined') {
    return `dev_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  let deviceId = localStorage.getItem(STORAGE_KEY);
  if (!deviceId) {
    deviceId = `dev_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    localStorage.setItem(STORAGE_KEY, deviceId);
  }
  return deviceId;
}

/**
 * Get or create session ID (persisted in sessionStorage)
 */
export function getOrCreateSessionId(): string {
  const STORAGE_KEY = 'ab_session_id';

  if (typeof window === 'undefined') {
    return generateSessionId();
  }

  let sessionId = sessionStorage.getItem(STORAGE_KEY);
  if (!sessionId) {
    sessionId = generateSessionId();
    sessionStorage.setItem(STORAGE_KEY, sessionId);
  }
  return sessionId;
}

/**
 * A/B Testing SDK Class
 */
export class ABTestingSDK {
  private config: ExperimentConfig;
  private assignments: ExperimentAssignments = {};
  private pendingEvents: Array<{
    experimentId: string;
    variantId: string;
    eventType: ExperimentEventType;
    eventName?: string;
    eventValue?: number;
    properties?: Record<string, any>;
  }> = [];
  private flushInterval: number | null = null;
  private logger: ReturnType<typeof createLogger>;

  constructor(config: ExperimentConfig) {
    this.config = {
      sessionId: getOrCreateSessionId(),
      deviceId: getOrCreateDeviceId(),
      debug: false,
      ...config,
    };
    this.logger = createLogger(this.config.debug || false);
    this.logger.log('SDK initialized with config:', this.config);
  }

  /**
   * Get the current session ID
   */
  getSessionId(): string {
    return this.config.sessionId || getOrCreateSessionId();
  }

  /**
   * Set user ID (call when user logs in)
   */
  setUserId(userId: string): void {
    this.config.userId = userId;
    this.logger.log('User ID set:', userId);
  }

  /**
   * Fetch variant assignments for given experiments
   */
  async fetchAssignments(experimentIds: string[]): Promise<ExperimentAssignments> {
    try {
      const response = await fetch(`${this.config.apiUrl}/assign`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          experiments: experimentIds,
          sessionId: this.getSessionId(),
          userId: this.config.userId,
          deviceId: this.config.deviceId,
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch assignments: ${response.status}`);
      }

      const data = await response.json();

      if (data.success) {
        this.assignments = { ...this.assignments, ...data.data };
        this.logger.log('Assignments fetched:', this.assignments);
      }

      return this.assignments;
    } catch (error) {
      this.logger.error('Failed to fetch assignments:', error);
      return {};
    }
  }

  /**
   * Get variant assignment for a specific experiment
   */
  getVariant(experimentId: string): VariantAssignment | null {
    return this.assignments[experimentId] || null;
  }

  /**
   * Get variant key for a specific experiment
   */
  getVariantKey(experimentId: string): string | null {
    const variant = this.getVariant(experimentId);
    return variant?.variantKey || null;
  }

  /**
   * Check if user is assigned to a specific variant
   */
  isVariant(experimentId: string, variantKey: string): boolean {
    const variant = this.getVariant(experimentId);
    return variant?.variantKey === variantKey;
  }

  /**
   * Check if user is in the control group
   */
  isControl(experimentId: string): boolean {
    return this.isVariant(experimentId, 'control');
  }

  /**
   * Get variant config value
   */
  getConfigValue(experimentId: string, key: string, defaultValue?: any): any {
    const variant = this.getVariant(experimentId);
    return variant?.config?.[key] ?? defaultValue;
  }

  /**
   * Track an event
   */
  async trackEvent(
    experimentId: string,
    eventType: ExperimentEventType,
    options: {
      eventName?: string;
      eventValue?: number;
      properties?: Record<string, any>;
    } = {}
  ): Promise<boolean> {
    const variant = this.getVariant(experimentId);
    if (!variant) {
      this.logger.warn(`No variant assignment for experiment: ${experimentId}`);
      return false;
    }

    const event = {
      experimentId,
      variantId: variant.variantId,
      eventType,
      eventName: options.eventName,
      eventValue: options.eventValue,
      properties: options.properties,
    };

    // Add to pending events
    this.pendingEvents.push(event);
    this.logger.log('Event tracked:', event);

    // Auto-flush if we have more than 10 events
    if (this.pendingEvents.length >= 10) {
      await this.flushEvents();
    }

    return true;
  }

  /**
   * Track an impression
   */
  async trackImpression(experimentId: string, properties?: Record<string, any>): Promise<boolean> {
    return this.trackEvent(experimentId, 'impression', { properties });
  }

  /**
   * Track a click
   */
  async trackClick(experimentId: string, properties?: Record<string, any>): Promise<boolean> {
    return this.trackEvent(experimentId, 'click', { properties });
  }

  /**
   * Track a conversion
   */
  async trackConversion(
    experimentId: string,
    options: { eventName?: string; eventValue?: number; properties?: Record<string, any> } = {}
  ): Promise<boolean> {
    return this.trackEvent(experimentId, 'conversion', options);
  }

  /**
   * Track a custom event
   */
  async trackCustomEvent(
    experimentId: string,
    eventName: string,
    options: { eventValue?: number; properties?: Record<string, any> } = {}
  ): Promise<boolean> {
    return this.trackEvent(experimentId, 'custom', { eventName, ...options });
  }

  /**
   * Flush pending events to the server
   */
  async flushEvents(): Promise<void> {
    if (this.pendingEvents.length === 0) return;

    const events = [...this.pendingEvents];
    this.pendingEvents = [];

    try {
      // Send events in parallel
      const promises = events.map((event) =>
        fetch(`${this.config.apiUrl}/track`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            ...event,
            sessionId: this.getSessionId(),
            userId: this.config.userId,
          }),
        })
      );

      await Promise.all(promises);
      this.logger.log(`Flushed ${events.length} events`);
    } catch (error) {
      this.logger.error('Failed to flush events:', error);
      // Re-add failed events
      this.pendingEvents = [...events, ...this.pendingEvents];
    }
  }

  /**
   * Start automatic event flushing
   */
  startAutoFlush(intervalMs: number = 5000): void {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
    }
    this.flushInterval = window.setInterval(() => {
      this.flushEvents();
    }, intervalMs);
    this.logger.log('Auto-flush started');
  }

  /**
   * Stop automatic event flushing
   */
  stopAutoFlush(): void {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
      this.logger.log('Auto-flush stopped');
    }
  }

  /**
   * Clean up and flush remaining events
   */
  async destroy(): Promise<void> {
    this.stopAutoFlush();
    await this.flushEvents();
    this.logger.log('SDK destroyed');
  }
}

// Singleton instance
let sdkInstance: ABTestingSDK | null = null;

/**
 * Initialize the A/B Testing SDK
 */
export function initABTesting(config: ExperimentConfig): ABTestingSDK {
  if (sdkInstance) {
    sdkInstance.destroy();
  }
  sdkInstance = new ABTestingSDK(config);
  sdkInstance.startAutoFlush();
  return sdkInstance;
}

/**
 * Get the SDK instance
 */
export function getABTesting(): ABTestingSDK | null {
  return sdkInstance;
}

/**
 * React Hook for A/B Testing
 */
export function useExperiment(experimentId: string): {
  variant: VariantAssignment | null;
  variantKey: string | null;
  isControl: boolean;
  isVariant: (key: string) => boolean;
  trackImpression: () => void;
  trackClick: () => void;
  trackConversion: (options?: { eventName?: string; eventValue?: number }) => void;
  getConfigValue: (key: string, defaultValue?: any) => any;
} {
  const sdk = getABTesting();
  const variant = sdk?.getVariant(experimentId) || null;
  const variantKey = variant?.variantKey || null;

  return {
    variant,
    variantKey,
    isControl: variantKey === 'control',
    isVariant: (key: string) => variantKey === key,
    trackImpression: () => sdk?.trackImpression(experimentId),
    trackClick: () => sdk?.trackClick(experimentId),
    trackConversion: (options) => sdk?.trackConversion(experimentId, options),
    getConfigValue: (key, defaultValue) => variant?.config?.[key] ?? defaultValue,
  };
}

/**
 * React Hook for fetching experiment assignments
 */
export function useExperiments(experimentIds: string[]): {
  assignments: ExperimentAssignments;
  isLoading: boolean;
  error: Error | null;
} {
  const [assignments, setAssignments] = React.useState<ExperimentAssignments>({});
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<Error | null>(null);

  React.useEffect(() => {
    const sdk = getABTesting();
    if (!sdk) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    sdk.fetchAssignments(experimentIds)
      .then((result) => {
        setAssignments(result);
        setError(null);
      })
      .catch((err) => {
        setError(err);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, experimentIds);

  return { assignments, isLoading, error };
}

// Import React for hooks
import React from 'react';

export default ABTestingSDK;