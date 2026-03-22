/**
 * useUserTracking Hook
 *
 * React hook for user behavior tracking in client-side applications
 *
 * @module client/hooks/useUserTracking
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  TrackingEventType,
  EventCategory,
  TrackEventInput,
  TrackerConfig,
  TrackingContext,
  EVENT_CATEGORY_MAP,
  PageViewProperties,
  UserAuthProperties,
  TradingEventProperties,
  ButtonClickProperties,
  ErrorEventProperties,
} from '../../analytics/userTracking.types';

// Storage keys
const DEVICE_ID_KEY = 'tracking_device_id';
const SESSION_ID_KEY = 'tracking_session_id';
const SESSION_TIMESTAMP_KEY = 'tracking_session_timestamp';

// Default configuration
const DEFAULT_CONFIG: Required<Omit<TrackerConfig, 'userId'>> = {
  endpoint: '/api/tracking',
  batchSize: 10,
  flushInterval: 5000,
  debug: false,
  respectDoNotTrack: true,
  autoTrackPageViews: true,
  trackPerformance: true,
  sessionTimeout: 30 * 60 * 1000, // 30 minutes
  deviceId: '',
};

/**
 * User Tracking Hook
 */
export function useUserTracking(config: TrackerConfig = {}) {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };
  
  // State
  const [sessionId, setSessionId] = useState<string>('');
  const [deviceId, setDeviceId] = useState<string>('');
  const [userId, setUserId] = useState<string | undefined>(config.userId);
  
  // Refs for batching
  const eventQueueRef = useRef<TrackEventInput[]>([]);
  const flushTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isInitializedRef = useRef(false);

  /**
   * Initialize session and device IDs
   */
  useEffect(() => {
    if (isInitializedRef.current) return;
    isInitializedRef.current = true;

    // Check Do Not Track
    if (finalConfig.respectDoNotTrack && navigator.doNotTrack === '1') {
      if (finalConfig.debug) {
        console.log('[Tracking] Do Not Track is enabled, skipping initialization');
      }
      return;
    }

    // Get or create device ID
    let storedDeviceId = localStorage.getItem(DEVICE_ID_KEY);
    if (!storedDeviceId) {
      storedDeviceId = generateId('dev');
      localStorage.setItem(DEVICE_ID_KEY, storedDeviceId);
    }
    setDeviceId(storedDeviceId);

    // Get or create session ID
    const storedSessionId = sessionStorage.getItem(SESSION_ID_KEY);
    const storedSessionTimestamp = sessionStorage.getItem(SESSION_TIMESTAMP_KEY);
    
    if (storedSessionId && storedSessionTimestamp) {
      const sessionAge = Date.now() - parseInt(storedSessionTimestamp, 10);
      
      if (sessionAge < finalConfig.sessionTimeout) {
        // Session is still valid
        setSessionId(storedSessionId);
        updateSessionTimestamp();
      } else {
        // Session expired, create new one
        createNewSession();
      }
    } else {
      createNewSession();
    }

    // Set up flush timer
    flushTimerRef.current = setInterval(flushQueue, finalConfig.flushInterval);

    // Flush on page unload
    const handleBeforeUnload = () => {
      flushQueue(true);
    };
    window.addEventListener('beforeunload', handleBeforeUnload);

    // Track initial page view
    if (finalConfig.autoTrackPageViews) {
      trackPageView();
    }

    // Track performance metrics
    if (finalConfig.trackPerformance) {
      trackPerformanceMetrics();
    }

    return () => {
      if (flushTimerRef.current) {
        clearInterval(flushTimerRef.current);
      }
      window.removeEventListener('beforeunload', handleBeforeUnload);
      flushQueue(true);
    };
  }, []);

  /**
   * Update user ID when it changes
   */
  useEffect(() => {
    setUserId(config.userId);
  }, [config.userId]);

  /**
   * Create a new session
   */
  const createNewSession = useCallback(() => {
    const newSessionId = generateId('sess');
    sessionStorage.setItem(SESSION_ID_KEY, newSessionId);
    updateSessionTimestamp();
    setSessionId(newSessionId);
  }, []);

  /**
   * Update session timestamp
   */
  const updateSessionTimestamp = () => {
    sessionStorage.setItem(SESSION_TIMESTAMP_KEY, Date.now().toString());
  };

  /**
   * Get tracking context
   */
  const getContext = useCallback((): TrackingContext => {
    return {
      sessionId,
      deviceId,
      userId,
      pageUrl: window.location.href,
      pageTitle: document.title,
      referrer: document.referrer,
      userAgent: navigator.userAgent,
      screenResolution: `${screen.width}x${screen.height}`,
      viewportSize: `${window.innerWidth}x${window.innerHeight}`,
      language: navigator.language,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    };
  }, [sessionId, deviceId, userId]);

  /**
   * Track an event
   */
  const track = useCallback((input: TrackEventInput) => {
    // Check Do Not Track
    if (finalConfig.respectDoNotTrack && navigator.doNotTrack === '1') {
      return;
    }

    // Update session timestamp
    updateSessionTimestamp();

    const event: TrackEventInput = {
      ...input,
      eventCategory: input.eventCategory || EVENT_CATEGORY_MAP[input.eventType] || 'custom',
    };

    eventQueueRef.current.push(event);

    if (finalConfig.debug) {
      console.log('[Tracking] Event queued:', event);
    }

    // Flush if batch size reached
    if (eventQueueRef.current.length >= finalConfig.batchSize) {
      flushQueue();
    }
  }, [finalConfig]);

  /**
   * Flush the event queue
   */
  const flushQueue = useCallback(async (sync: boolean = false) => {
    if (eventQueueRef.current.length === 0) return;

    const events = [...eventQueueRef.current];
    eventQueueRef.current = [];

    if (finalConfig.debug) {
      console.log('[Tracking] Flushing events:', events.length);
    }

    const context = getContext();
    const payload = {
      events: events.map(event => ({
        ...event,
        ...context,
        occurredAt: new Date().toISOString(),
      })),
    };

    try {
      if (sync && navigator.sendBeacon) {
        // Use sendBeacon for page unload
        navigator.sendBeacon(
          `${finalConfig.endpoint}/events`,
          JSON.stringify(payload)
        );
      } else {
        // Use fetch for normal operations
        await fetch(`${finalConfig.endpoint}/events`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          keepalive: true,
        });
      }
    } catch (error) {
      if (finalConfig.debug) {
        console.error('[Tracking] Failed to flush events:', error);
      }
      // Re-queue events on failure (with limit to prevent memory leak)
      if (eventQueueRef.current.length < 100) {
        eventQueueRef.current = [...events, ...eventQueueRef.current];
      }
    }
  }, [finalConfig, getContext]);

  /**
   * Track page view
   */
  const trackPageView = useCallback((properties?: PageViewProperties) => {
    track({
      eventType: 'page_view',
      eventName: 'Page View',
      properties: {
        path: properties?.path || window.location.pathname,
        title: properties?.title || document.title,
        search: properties?.search || window.location.search,
        hash: properties?.hash || window.location.hash,
        from: properties?.from || document.referrer,
        loadTime: properties?.loadTime,
      },
    });
  }, [track]);

  /**
   * Track user authentication
   */
  const trackAuth = useCallback((
    type: 'login' | 'signup' | 'logout',
    properties?: UserAuthProperties
  ) => {
    const eventType: TrackingEventType = 
      type === 'login' ? 'user_login' :
      type === 'signup' ? 'user_signup' : 'user_logout';

    track({
      eventType,
      eventName: type.charAt(0).toUpperCase() + type.slice(1),
      properties: properties || {},
    });

    // Update user ID on login/signup
    if (type === 'login' || type === 'signup') {
      // The user ID should be set externally via the config
    }
  }, [track]);

  /**
   * Track trading event
   */
  const trackTrade = useCallback((
    action: 'order_placed' | 'order_cancelled' | 'order_filled' | 'position_opened' | 'position_closed',
    properties: TradingEventProperties
  ) => {
    track({
      eventType: action,
      eventName: action.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
      properties,
    });
  }, [track]);

  /**
   * Track button click
   */
  const trackButtonClick = useCallback((properties: ButtonClickProperties) => {
    track({
      eventType: 'button_click',
      eventName: 'Button Click',
      properties,
    });
  }, [track]);

  /**
   * Track link click
   */
  const trackLinkClick = useCallback((properties: {
    url: string;
    text?: string;
    location?: string;
    external?: boolean;
  }) => {
    track({
      eventType: 'link_click',
      eventName: 'Link Click',
      properties,
    });
  }, [track]);

  /**
   * Track form submission
   */
  const trackFormSubmit = useCallback((properties: {
    formName: string;
    success?: boolean;
    error?: string;
    fields?: string[];
  }) => {
    track({
      eventType: 'form_submit',
      eventName: 'Form Submit',
      properties,
    });
  }, [track]);

  /**
   * Track search
   */
  const trackSearch = useCallback((properties: {
    query: string;
    resultsCount?: number;
    filters?: Record<string, any>;
  }) => {
    track({
      eventType: 'search',
      eventName: 'Search',
      properties,
    });
  }, [track]);

  /**
   * Track error
   */
  const trackError = useCallback((properties: ErrorEventProperties) => {
    track({
      eventType: 'error',
      eventName: 'Error',
      properties,
    });
  }, [track]);

  /**
   * Track API error
   */
  const trackApiError = useCallback((properties: {
    endpoint: string;
    method: string;
    statusCode?: number;
    message: string;
    requestId?: string;
  }) => {
    track({
      eventType: 'api_error',
      eventName: 'API Error',
      properties,
    });
  }, [track]);

  /**
   * Track feature usage
   */
  const trackFeature = useCallback((properties: {
    featureName: string;
    action?: string;
    metadata?: Record<string, any>;
  }) => {
    track({
      eventType: 'feature_used',
      eventName: 'Feature Used',
      properties,
    });
  }, [track]);

  /**
   * Track strategy event
   */
  const trackStrategy = useCallback((
    action: 'created' | 'started' | 'stopped' | 'shared',
    properties: {
      strategyId: string;
      strategyName?: string;
      strategyType?: string;
    }
  ) => {
    const eventType: TrackingEventType = `strategy_${action}` as TrackingEventType;
    track({
      eventType,
      eventName: `Strategy ${action.charAt(0).toUpperCase() + action.slice(1)}`,
      properties,
    });
  }, [track]);

  /**
   * Track backtest event
   */
  const trackBacktest = useCallback((
    action: 'started' | 'completed' | 'failed',
    properties: {
      backtestId: string;
      strategyId?: string;
      duration?: number;
      error?: string;
    }
  ) => {
    const eventType: TrackingEventType = `backtest_${action}` as TrackingEventType;
    track({
      eventType,
      eventName: `Backtest ${action.charAt(0).toUpperCase() + action.slice(1)}`,
      properties,
    });
  }, [track]);

  /**
   * Track performance metrics
   */
  const trackPerformanceMetrics = useCallback(() => {
    // Wait for page load
    if (document.readyState === 'complete') {
      sendPerformanceMetrics();
    } else {
      window.addEventListener('load', sendPerformanceMetrics);
    }
  }, []);

  /**
   * Send performance metrics
   */
  const sendPerformanceMetrics = useCallback(() => {
    const perfEntries = performance.getEntriesByType('navigation');
    if (perfEntries.length > 0) {
      const navEntry = perfEntries[0] as PerformanceNavigationTiming;
      
      track({
        eventType: 'performance_issue',
        eventName: 'Page Load Performance',
        properties: {
          loadTime: navEntry.loadEventEnd - navEntry.fetchStart,
          domContentLoaded: navEntry.domContentLoadedEventEnd - navEntry.fetchStart,
          firstPaint: navEntry.responseStart - navEntry.fetchStart,
          ttfb: navEntry.responseStart - navEntry.requestStart,
        },
        loadTimeMs: navEntry.loadEventEnd - navEntry.fetchStart,
      });
    }
  }, [track]);

  /**
   * Set user ID (for login)
   */
  const identify = useCallback((newUserId: string) => {
    setUserId(newUserId);
    track({
      eventType: 'user_login',
      eventName: 'User Identified',
      properties: { userId: newUserId },
    });
  }, [track]);

  /**
   * Reset session (for logout)
   */
  const reset = useCallback(() => {
    track({
      eventType: 'user_logout',
      eventName: 'User Logout',
      properties: {},
    });
    
    // Clear user ID
    setUserId(undefined);
    
    // Create new session
    createNewSession();
  }, [track, createNewSession]);

  return {
    // State
    sessionId,
    deviceId,
    userId,
    
    // Core tracking
    track,
    flush: () => flushQueue(),
    
    // Convenience methods
    trackPageView,
    trackAuth,
    trackTrade,
    trackButtonClick,
    trackLinkClick,
    trackFormSubmit,
    trackSearch,
    trackError,
    trackApiError,
    trackFeature,
    trackStrategy,
    trackBacktest,
    
    // Session management
    identify,
    reset,
    getSessionId: () => sessionId,
    getDeviceId: () => deviceId,
  };
}

/**
 * Generate a unique ID
 */
function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
}

/**
 * Tracking Provider Props
 */
export interface TrackingProviderProps {
  config?: TrackerConfig;
  children: React.ReactNode;
}

/**
 * Tracking Context
 */
import { createContext, useContext } from 'react';

const TrackingContext = createContext<ReturnType<typeof useUserTracking> | null>(null);

/**
 * Tracking Provider Component
 */
export function TrackingProvider({ config, children }: TrackingProviderProps) {
  const tracking = useUserTracking(config);
  
  return (
    <TrackingContext.Provider value={tracking}>
      {children}
    </TrackingContext.Provider>
  );
}

/**
 * Use Tracking Context Hook
 */
export function useTracking() {
  const context = useContext(TrackingContext);
  if (!context) {
    throw new Error('useTracking must be used within a TrackingProvider');
  }
  return context;
}

/**
 * HOC for tracking page views automatically
 */
export function withPageTracking<P extends object>(
  Component: React.ComponentType<P>,
  pageName?: string
) {
  return function TrackedComponent(props: P) {
    const { trackPageView } = useTracking();
    
    useEffect(() => {
      trackPageView({
        title: pageName || document.title,
      });
    }, [trackPageView]);
    
    return <Component {...props} />;
  };
}

export default useUserTracking;