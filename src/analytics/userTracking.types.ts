/**
 * User Tracking Types
 *
 * Type definitions for user behavior analytics and tracking
 *
 * @module analytics/userTracking.types
 */

// ============================================================
// Event Types
// ============================================================

/**
 * Core event types supported by the tracking system
 */
export type TrackingEventType =
  // Page/Screen tracking
  | 'page_view'
  | 'screen_view'
  // User authentication
  | 'user_signup'
  | 'user_login'
  | 'user_logout'
  | 'user_delete'
  // Trading events
  | 'order_placed'
  | 'order_cancelled'
  | 'order_filled'
  | 'position_opened'
  | 'position_closed'
  // Strategy events
  | 'strategy_created'
  | 'strategy_started'
  | 'strategy_stopped'
  | 'strategy_shared'
  // Backtest events
  | 'backtest_started'
  | 'backtest_completed'
  | 'backtest_failed'
  // Subscription events
  | 'subscription_started'
  | 'subscription_cancelled'
  | 'subscription_renewed'
  // User engagement
  | 'button_click'
  | 'link_click'
  | 'form_submit'
  | 'form_error'
  | 'search'
  | 'filter_apply'
  // Error tracking
  | 'error'
  | 'api_error'
  | 'performance_issue'
  // Feature usage
  | 'feature_used'
  | 'feature_discovered'
  // Notification events
  | 'notification_sent'
  | 'notification_clicked'
  | 'notification_dismissed'
  // Copy trading
  | 'copy_started'
  | 'copy_stopped'
  | 'follower_gained'
  | 'follower_lost'
  // Custom
  | 'custom';

/**
 * Event categories for grouping related events
 */
export type EventCategory =
  | 'navigation'      // Page/screen views
  | 'authentication'  // Login/signup/logout
  | 'trading'         // Order/position events
  | 'strategy'        // Strategy management
  | 'backtest'        // Backtesting
  | 'subscription'    // Subscription management
  | 'engagement'      // User interactions
  | 'error'           // Errors and issues
  | 'feature'         // Feature usage
  | 'notification'    // Notification events
  | 'social'          // Social/copy trading
  | 'performance'     // Performance monitoring
  | 'custom';         // Custom events

/**
 * Tracking event structure
 */
export interface TrackingEvent {
  /** Unique event ID (generated server-side) */
  id?: string;
  
  /** User ID if authenticated */
  userId?: string;
  
  /** Session ID for grouping events */
  sessionId: string;
  
  /** Device fingerprint for cross-session tracking */
  deviceId?: string;
  
  /** Event type */
  eventType: TrackingEventType;
  
  /** Event category */
  eventCategory: EventCategory;
  
  /** Human-readable event name */
  eventName: string;
  
  /** Custom properties */
  properties?: Record<string, any>;
  
  /** Page URL where event occurred */
  pageUrl?: string;
  
  /** Page title */
  pageTitle?: string;
  
  /** Referrer URL */
  referrer?: string;
  
  /** User agent string */
  userAgent?: string;
  
  /** Screen resolution (e.g., '1920x1080') */
  screenResolution?: string;
  
  /** Viewport size */
  viewportSize?: string;
  
  /** Browser language */
  language?: string;
  
  /** User timezone */
  timezone?: string;
  
  /** Country (from IP) */
  country?: string;
  
  /** Region/state */
  region?: string;
  
  /** City */
  city?: string;
  
  /** Page load time in milliseconds */
  loadTimeMs?: number;
  
  /** When the event occurred */
  occurredAt?: Date;
}

/**
 * Batch of tracking events
 */
export interface TrackingEventBatch {
  events: TrackingEvent[];
  sentAt: Date;
}

// ============================================================
// Session Types
// ============================================================

/**
 * User session information
 */
export interface UserSession {
  /** Unique session ID */
  sessionId: string;
  
  /** User ID if authenticated */
  userId?: string;
  
  /** Device fingerprint */
  deviceId?: string;
  
  /** First event timestamp */
  firstEventAt: Date;
  
  /** Last event timestamp */
  lastEventAt: Date;
  
  /** Total events in session */
  eventCount: number;
  
  /** Entry page URL */
  entryPage?: string;
  
  /** Exit page URL */
  exitPage?: string;
  
  /** Entry referrer */
  entryReferrer?: string;
  
  /** User agent */
  userAgent?: string;
  
  /** Screen resolution */
  screenResolution?: string;
  
  /** Browser language */
  language?: string;
  
  /** Timezone */
  timezone?: string;
  
  /** Country */
  country?: string;
  
  /** Region */
  region?: string;
  
  /** City */
  city?: string;
  
  /** UTM source */
  utmSource?: string;
  
  /** UTM medium */
  utmMedium?: string;
  
  /** UTM campaign */
  utmCampaign?: string;
  
  /** UTM term */
  utmTerm?: string;
  
  /** UTM content */
  utmContent?: string;
  
  /** Is session active */
  isActive: boolean;
  
  /** When session ended */
  endedAt?: Date;
  
  /** Session duration in seconds */
  durationSeconds?: number;
}

// ============================================================
// Analytics Types
// ============================================================

/**
 * Daily analytics summary
 */
export interface DailyAnalyticsSummary {
  /** Summary date */
  date: Date;
  
  /** Total page views */
  pageViews: number;
  
  /** Unique visitors */
  uniqueVisitors: number;
  
  /** Unique sessions */
  uniqueSessions: number;
  
  /** Average session duration in seconds */
  avgSessionDurationSeconds: number;
  
  /** Bounce rate (percentage) */
  bounceRate: number;
  
  /** Average pages per session */
  pagesPerSession: number;
  
  /** Event counts by category */
  eventCounts: Record<string, number>;
  
  /** Top pages by views */
  topPages: Array<{ url: string; views: number }>;
  
  /** Traffic sources */
  trafficSources: Array<{ source: string; sessions: number }>;
  
  /** Top countries */
  topCountries: Array<{ country: string; sessions: number }>;
  
  /** Device breakdown */
  deviceBreakdown: {
    mobile: number;
    desktop: number;
  };
}

/**
 * User analytics query options
 */
export interface UserAnalyticsQueryOptions {
  /** Start date */
  startDate: Date;
  
  /** End date */
  endDate: Date;
  
  /** Filter by user ID */
  userId?: string;
  
  /** Filter by event type */
  eventType?: TrackingEventType;
  
  /** Filter by event category */
  eventCategory?: EventCategory;
  
  /** Group by granularity */
  granularity?: 'hour' | 'day' | 'week' | 'month';
  
  /** Limit results */
  limit?: number;
  
  /** Offset for pagination */
  offset?: number;
}

/**
 * Analytics event count result
 */
export interface EventCountResult {
  /** Event type */
  eventType: string;
  
  /** Event category */
  eventCategory: string;
  
  /** Count */
  count: number;
  
  /** Date/time bucket */
  date?: Date;
}

/**
 * User engagement metrics
 */
export interface UserEngagementMetrics {
  /** DAU (Daily Active Users) */
  dau: number;
  
  /** WAU (Weekly Active Users) */
  wau: number;
  
  /** MAU (Monthly Active Users) */
  mau: number;
  
  /** DAU/MAU ratio (stickiness) */
  stickiness: number;
  
  /** Retention rates */
  retention: {
    day1: number;
    day7: number;
    day30: number;
  };
  
  /** Average session duration */
  avgSessionDuration: number;
  
  /** Average sessions per user */
  avgSessionsPerUser: number;
}

/**
 * Funnel step
 */
export interface FunnelStep {
  /** Step name */
  name: string;
  
  /** Step order */
  order: number;
  
  /** Users who completed this step */
  completedCount: number;
  
  /** Conversion rate from previous step */
  conversionRate: number;
  
  /** Drop-off from previous step */
  dropOffRate: number;
}

/**
 * Funnel analysis result
 */
export interface FunnelAnalysis {
  /** Funnel name */
  name: string;
  
  /** Steps in the funnel */
  steps: FunnelStep[];
  
  /** Overall conversion rate */
  overallConversionRate: number;
  
  /** Time period */
  period: {
    start: Date;
    end: Date;
  };
  
  /** Total users who started the funnel */
  totalUsers: number;
  
  /** Users who completed the funnel */
  completedUsers: number;
}

// ============================================================
// Client-side Types
// ============================================================

/**
 * Tracker configuration
 */
export interface TrackerConfig {
  /** API endpoint for tracking */
  endpoint?: string;
  
  /** Batch size before sending */
  batchSize?: number;
  
  /** Flush interval in milliseconds */
  flushInterval?: number;
  
  /** Enable debug logging */
  debug?: boolean;
  
  /** Respect Do Not Track */
  respectDoNotTrack?: boolean;
  
  /** Track page views automatically */
  autoTrackPageViews?: boolean;
  
  /** Track performance metrics */
  trackPerformance?: boolean;
  
  /** Session timeout in milliseconds (default: 30 min) */
  sessionTimeout?: number;
  
  /** User ID (if authenticated) */
  userId?: string;
  
  /** Device ID (persisted) */
  deviceId?: string;
}

/**
 * Client-side tracking context
 */
export interface TrackingContext {
  /** Session ID */
  sessionId: string;
  
  /** Device ID */
  deviceId: string;
  
  /** User ID */
  userId?: string;
  
  /** Current page URL */
  pageUrl: string;
  
  /** Page title */
  pageTitle: string;
  
  /** Referrer */
  referrer?: string;
  
  /** User agent */
  userAgent: string;
  
  /** Screen resolution */
  screenResolution: string;
  
  /** Viewport size */
  viewportSize: string;
  
  /** Language */
  language: string;
  
  /** Timezone */
  timezone: string;
}

/**
 * Tracking event input (client-side)
 */
export interface TrackEventInput {
  /** Event type */
  eventType: TrackingEventType;
  
  /** Event category (auto-derived if not provided) */
  eventCategory?: EventCategory;
  
  /** Event name */
  eventName: string;
  
  /** Custom properties */
  properties?: Record<string, any>;
  
  /** Page URL (uses current if not provided) */
  pageUrl?: string;
  
  /** Page title (uses current if not provided) */
  pageTitle?: string;
  
  /** Load time in ms */
  loadTimeMs?: number;
}

/**
 * Page view event properties
 */
export interface PageViewProperties {
  /** Page path */
  path: string;
  
  /** Page title */
  title: string;
  
  /** Search query string */
  search?: string;
  
  /** Hash fragment */
  hash?: string;
  
  /** Load time */
  loadTime?: number;
  
  /** Previous page URL */
  from?: string;
}

/**
 * User authentication event properties
 */
export interface UserAuthProperties {
  /** Authentication method */
  method: 'email' | 'google' | 'apple' | 'wallet' | 'other';
  
  /** Is new user */
  isNewUser?: boolean;
  
  /** User plan */
  plan?: 'free' | 'pro' | 'enterprise';
}

/**
 * Trading event properties
 */
export interface TradingEventProperties {
  /** Order/Position ID */
  id: string;
  
  /** Symbol */
  symbol?: string;
  
  /** Side (buy/sell) */
  side?: 'buy' | 'sell';
  
  /** Order type */
  orderType?: 'market' | 'limit' | 'stop' | 'stop_limit';
  
  /** Quantity */
  quantity?: number;
  
  /** Price */
  price?: number;
  
  /** Strategy ID if applicable */
  strategyId?: string;
  
  /** Success status */
  success?: boolean;
  
  /** Error message if failed */
  error?: string;
}

/**
 * Button click event properties
 */
export interface ButtonClickProperties {
  /** Button text or aria-label */
  text?: string;
  
  /** Button ID */
  buttonId?: string;
  
  /** Button location/section */
  location?: string;
  
  /** Intent/action */
  intent?: string;
}

/**
 * Error event properties
 */
export interface ErrorEventProperties {
  /** Error message */
  message: string;
  
  /** Error code */
  code?: string;
  
  /** Stack trace */
  stack?: string;
  
  /** Component where error occurred */
  component?: string;
  
  /** Additional context */
  context?: Record<string, any>;
}

// ============================================================
// API Types
// ============================================================

/**
 * Track events request
 */
export interface TrackEventsRequest {
  events: TrackingEvent[];
}

/**
 * Track events response
 */
export interface TrackEventsResponse {
  success: boolean;
  received: number;
  processed: number;
}

/**
 * Get analytics request
 */
export interface GetAnalyticsRequest {
  startDate: string;
  endDate: string;
  userId?: string;
  eventType?: TrackingEventType;
  eventCategory?: EventCategory;
  granularity?: 'hour' | 'day' | 'week' | 'month';
  limit?: number;
  offset?: number;
}

/**
 * Get analytics response
 */
export interface GetAnalyticsResponse {
  success: boolean;
  data: {
    summary?: DailyAnalyticsSummary[];
    events?: TrackingEvent[];
    eventCounts?: EventCountResult[];
    engagement?: UserEngagementMetrics;
    funnel?: FunnelAnalysis;
  };
  pagination?: {
    total: number;
    limit: number;
    offset: number;
  };
}

/**
 * Event category mapping for auto-categorization
 */
export const EVENT_CATEGORY_MAP: Record<TrackingEventType, EventCategory> = {
  page_view: 'navigation',
  screen_view: 'navigation',
  user_signup: 'authentication',
  user_login: 'authentication',
  user_logout: 'authentication',
  user_delete: 'authentication',
  order_placed: 'trading',
  order_cancelled: 'trading',
  order_filled: 'trading',
  position_opened: 'trading',
  position_closed: 'trading',
  strategy_created: 'strategy',
  strategy_started: 'strategy',
  strategy_stopped: 'strategy',
  strategy_shared: 'strategy',
  backtest_started: 'backtest',
  backtest_completed: 'backtest',
  backtest_failed: 'backtest',
  subscription_started: 'subscription',
  subscription_cancelled: 'subscription',
  subscription_renewed: 'subscription',
  button_click: 'engagement',
  link_click: 'engagement',
  form_submit: 'engagement',
  form_error: 'engagement',
  search: 'engagement',
  filter_apply: 'engagement',
  error: 'error',
  api_error: 'error',
  performance_issue: 'performance',
  feature_used: 'feature',
  feature_discovered: 'feature',
  notification_sent: 'notification',
  notification_clicked: 'notification',
  notification_dismissed: 'notification',
  copy_started: 'social',
  copy_stopped: 'social',
  follower_gained: 'social',
  follower_lost: 'social',
  custom: 'custom',
};