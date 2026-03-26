/**
 * Application Performance Monitoring (APM) Service
 * 
 * Provides comprehensive frontend monitoring:
 * - Error tracking with context and deduplication
 * - Core Web Vitals collection
 * - API response time monitoring
 * - User experience metrics
 * 
 * Issue #663: Added error deduplication, memory optimization, and improved reporting
 */

import { onCLS, onLCP, onFCP, onTTFB, onINP, CLSMetric, LCPMetric, FCPMetric, TTFBMetric, INPMetric } from 'web-vitals';

// Types
export interface ErrorEvent {
  id: string;
  message: string;
  name: string;
  stack?: string;
  type: 'javascript' | 'promise' | 'react' | 'resource' | 'unknown';
  severity: 'low' | 'medium' | 'high' | 'critical';
  context: ErrorContext;
  timestamp: number;
  url: string;
  userAgent: string;
  breadcrumbs: Breadcrumb[];
  fingerprint?: string; // For deduplication
  occurrenceCount?: number;
}

export interface ErrorContext {
  userId?: string;
  sessionId: string;
  page: string;
  route?: string;
  componentStack?: string;
  metadata?: Record<string, unknown>;
}

export interface Breadcrumb {
  type: 'navigation' | 'click' | 'api' | 'error' | 'user' | 'console';
  message: string;
  timestamp: number;
  data?: Record<string, unknown>;
}

export interface PerformanceMetricReport {
  sessionId: string;
  page: string;
  route?: string;
  deviceType: 'mobile' | 'tablet' | 'desktop';
  connectionType?: string;
  effectiveType?: string;
  
  // Core Web Vitals
  fcp?: number;
  lcp?: number;
  fid?: number;
  cls?: number;
  ttfb?: number;
  inp?: number;
  
  // Custom metrics
  tti?: number;
  memoryUsed?: number;
  memoryLimit?: number;
  
  // API latency
  apiLatency?: number;
  
  timestamp: number;
}

export interface ApiLatencyRecord {
  endpoint: string;
  method: string;
  duration: number;
  status: number;
  success: boolean;
  timestamp: number;
}

// Configuration
interface APMConfig {
  apiEndpoint?: string;
  sessionId: string;
  userId?: string;
  sampleRate: number;
  enablePerformanceMonitoring: boolean;
  enableErrorTracking: boolean;
  enableApiLatency: boolean;
  maxBreadcrumbs: number;
  maxErrors: number; // Max errors to keep in memory
  maxApiLatencies: number; // Max API latencies to keep in memory
  deduplicationWindow: number; // Window for deduplication in ms
  environment: string;
}

// Default config
const defaultConfig: APMConfig = {
  apiEndpoint: '/api/performance',
  sessionId: generateSessionId(),
  sampleRate: 1.0,
  enablePerformanceMonitoring: true,
  enableErrorTracking: true,
  enableApiLatency: true,
  maxBreadcrumbs: 50,
  maxErrors: 100,
  maxApiLatencies: 200,
  deduplicationWindow: 60000, // 1 minute
  environment: import.meta.env.MODE || 'production',
};

// Generate a unique session ID
function generateSessionId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// Get device type
function getDeviceType(): 'mobile' | 'tablet' | 'desktop' {
  const width = window.innerWidth;
  if (width < 768) return 'mobile';
  if (width < 1024) return 'tablet';
  return 'desktop';
}

// Get connection info
function getConnectionInfo(): { connectionType?: string; effectiveType?: string } {
  const connection = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;
  if (connection) {
    return {
      connectionType: connection.type,
      effectiveType: connection.effectiveType,
    };
  }
  return {};
}

/**
 * Generate error fingerprint for deduplication
 */
function generateErrorFingerprint(error: Error | string, type: string): string {
  const message = typeof error === 'string' ? error : error.message;
  const name = typeof error === 'string' ? 'Error' : error.name;
  
  // Create a simple hash of error signature
  const signature = `${name}:${message.substring(0, 100)}:${type}`;
  let hash = 0;
  for (let i = 0; i < signature.length; i++) {
    const char = signature.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(36);
}

/**
 * APM Service Class
 */
class APMService {
  private config: APMConfig;
  private breadcrumbs: Breadcrumb[] = [];
  private errors: ErrorEvent[] = [];
  private errorFingerprints: Map<string, { count: number; lastSeen: number }> = new Map();
  private apiLatencies: ApiLatencyRecord[] = [];
  private performanceMetrics: Partial<PerformanceMetricReport> = {};
  private pendingReports: Array<() => Promise<void>> = [];
  private isInitialized = false;
  private reportTimer: ReturnType<typeof setInterval> | null = null;
  private flushTimer: ReturnType<typeof setInterval> | null = null;
  private pendingErrorBatch: ErrorEvent[] = [];

  constructor() {
    this.config = { ...defaultConfig };
  }

  /**
   * Initialize APM service
   */
  init(options: Partial<APMConfig> = {}): void {
    if (this.isInitialized) {
      console.warn('[APM] Already initialized');
      return;
    }

    this.config = { ...defaultConfig, ...options };
    this.performanceMetrics.sessionId = this.config.sessionId;
    this.performanceMetrics.deviceType = getDeviceType();
    
    const connectionInfo = getConnectionInfo();
    this.performanceMetrics.connectionType = connectionInfo.connectionType;
    this.performanceMetrics.effectiveType = connectionInfo.effectiveType;
    this.performanceMetrics.timestamp = Date.now();

    // Initialize monitoring
    if (this.config.enableErrorTracking) {
      this.initErrorTracking();
    }

    if (this.config.enablePerformanceMonitoring) {
      this.initPerformanceMonitoring();
    }

    if (this.config.enableApiLatency) {
      this.initApiLatencyTracking();
    }

    // Track navigation breadcrumbs
    this.initBreadcrumbs();

    // Start periodic reporting
    this.startPeriodicReporting();

    // Start batch flush timer
    this.startBatchFlush();

    this.isInitialized = true;
    console.log('[APM] Initialized with session:', this.config.sessionId);
  }

  /**
   * Set user ID for context
   */
  setUserId(userId: string | undefined): void {
    this.config.userId = userId;
  }

  /**
   * Track a JavaScript error with deduplication
   */
  trackError(
    error: Error | string,
    options: {
      type?: ErrorEvent['type'];
      severity?: ErrorEvent['severity'];
      context?: Record<string, unknown>;
      componentStack?: string;
    } = {}
  ): void {
    const errorObj = error instanceof Error ? error : new Error(String(error));
    const type = options.type || 'javascript';
    const fingerprint = generateErrorFingerprint(error, type);
    
    // Check for deduplication
    const now = Date.now();
    const existingFingerprint = this.errorFingerprints.get(fingerprint);
    
    if (existingFingerprint) {
      const timeSinceLastSeen = now - existingFingerprint.lastSeen;
      
      // If within deduplication window, just increment count
      if (timeSinceLastSeen < this.config.deduplicationWindow) {
        existingFingerprint.count++;
        existingFingerprint.lastSeen = now;
        
        // Log but don't create new error event
        if (this.config.environment === 'development') {
          console.debug('[APM] Duplicate error suppressed:', fingerprint, 'count:', existingFingerprint.count);
        }
        return;
      }
    }
    
    // Create new fingerprint entry or update
    this.errorFingerprints.set(fingerprint, { count: 1, lastSeen: now });
    
    // Cleanup old fingerprints (keep max 100)
    if (this.errorFingerprints.size > 100) {
      const entries = Array.from(this.errorFingerprints.entries());
      const sorted = entries.sort((a, b) => b[1].lastSeen - a[1].lastSeen);
      this.errorFingerprints = new Map(sorted.slice(0, 100));
    }
    
    const errorEvent: ErrorEvent = {
      id: `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      message: errorObj.message,
      name: errorObj.name,
      stack: errorObj.stack,
      type,
      severity: options.severity || this.determineSeverity(errorObj, type),
      context: {
        userId: this.config.userId,
        sessionId: this.config.sessionId,
        page: window.location.pathname,
        route: this.getCurrentRoute(),
        componentStack: options.componentStack,
        metadata: options.context,
      },
      timestamp: now,
      url: window.location.href,
      userAgent: navigator.userAgent,
      breadcrumbs: [...this.breadcrumbs],
      fingerprint,
    };

    this.errors.push(errorEvent);
    
    // Limit errors in memory
    if (this.errors.length > this.config.maxErrors) {
      this.errors = this.errors.slice(-this.config.maxErrors);
    }
    
    this.addBreadcrumb('error', `${errorObj.name}: ${errorObj.message}`);
    
    // Log to console in development
    if (this.config.environment === 'development') {
      console.error('[APM Error]', errorEvent);
    }

    // Add to pending batch for reporting
    this.pendingErrorBatch.push(errorEvent);

    // Immediately report critical errors
    if (errorEvent.severity === 'critical') {
      this.reportError(errorEvent);
    }
  }

  /**
   * Determine error severity based on error type and message
   */
  private determineSeverity(error: Error, type: string): ErrorEvent['severity'] {
    // Network errors are usually less severe
    if (type === 'resource') return 'low';
    
    // Promise rejections could be important
    if (type === 'promise') return 'high';
    
    // React errors are usually critical
    if (type === 'react') return 'critical';
    
    // Check for specific error messages
    const message = error.message.toLowerCase();
    if (message.includes('chunk') || message.includes('loading')) return 'medium';
    if (message.includes('network') || message.includes('fetch')) return 'medium';
    if (message.includes('unauthorized') || message.includes('forbidden')) return 'high';
    if (message.includes('crash') || message.includes('fatal')) return 'critical';
    
    return 'medium';
  }

  /**
   * Track React error
   */
  trackReactError(error: Error, componentStack: string): void {
    this.trackError(error, {
      type: 'react',
      severity: 'critical',
      componentStack,
    });
  }

  /**
   * Track API call latency
   */
  trackApiCall(
    endpoint: string,
    method: string,
    duration: number,
    status: number,
    success: boolean
  ): void {
    const record: ApiLatencyRecord = {
      endpoint,
      method: method.toUpperCase(),
      duration,
      status,
      success,
      timestamp: Date.now(),
    };

    this.apiLatencies.push(record);
    
    // Limit API latencies in memory
    if (this.apiLatencies.length > this.config.maxApiLatencies) {
      this.apiLatencies = this.apiLatencies.slice(-this.config.maxApiLatencies);
    }

    // Update average API latency in metrics
    const recentLatencies = this.apiLatencies.slice(-10);
    const avgLatency = recentLatencies.reduce((sum, l) => sum + l.duration, 0) / recentLatencies.length;
    this.performanceMetrics.apiLatency = avgLatency;

    // Track slow API calls
    if (duration > 2000) {
      this.addBreadcrumb('api', `Slow API: ${method} ${endpoint} (${duration}ms)`, {
        duration,
        status,
      });
    }
  }

  /**
   * Add a breadcrumb for context
   */
  addBreadcrumb(
    type: Breadcrumb['type'],
    message: string,
    data?: Record<string, unknown>
  ): void {
    const breadcrumb: Breadcrumb = {
      type,
      message,
      timestamp: Date.now(),
      data,
    };

    this.breadcrumbs.push(breadcrumb);

    // Keep only recent breadcrumbs
    if (this.breadcrumbs.length > this.config.maxBreadcrumbs) {
      this.breadcrumbs = this.breadcrumbs.slice(-this.config.maxBreadcrumbs);
    }
  }

  /**
   * Get current route
   */
  private getCurrentRoute(): string | undefined {
    // Try to get route from React Router if available
    const routeMatch = window.location.pathname.match(/\/([^/]+)/);
    return routeMatch ? routeMatch[1] : undefined;
  }

  /**
   * Initialize error tracking
   */
  private initErrorTracking(): void {
    // Global error handler
    window.addEventListener('error', (event) => {
      // Check if it's a resource error
      if (event.target !== window) {
        const target = event.target as HTMLElement;
        const src = target.getAttribute('src') || target.getAttribute('href') || 'unknown';
        
        this.trackError(new Error(`Resource failed to load: ${src}`), {
          type: 'resource',
          severity: 'low',
          context: {
            tagName: target.tagName,
            src,
          },
        });
        return;
      }
      
      this.trackError(event.error || event.message, {
        type: 'javascript',
        severity: 'high',
      });
    });

    // Unhandled promise rejection
    window.addEventListener('unhandledrejection', (event) => {
      const error = event.reason instanceof Error 
        ? event.reason 
        : new Error(String(event.reason));
      
      this.trackError(error, {
        type: 'promise',
        severity: 'high',
      });
    });
  }

  /**
   * Initialize performance monitoring
   */
  private initPerformanceMonitoring(): void {
    // Collect Core Web Vitals
    onFCP((metric: FCPMetric) => {
      this.performanceMetrics.fcp = metric.value;
    });

    onLCP((metric: LCPMetric) => {
      this.performanceMetrics.lcp = metric.value;
    });

    onCLS((metric: CLSMetric) => {
      this.performanceMetrics.cls = metric.value;
    });

    onTTFB((metric: TTFBMetric) => {
      this.performanceMetrics.ttfb = metric.value;
    });

    onINP((metric: INPMetric) => {
      this.performanceMetrics.inp = metric.value;
    });

    // Collect memory info if available
    if ('memory' in performance && (performance as any).memory) {
      const memory = (performance as any).memory;
      this.performanceMetrics.memoryUsed = memory.usedJSHeapSize;
      this.performanceMetrics.memoryLimit = memory.jsHeapSizeLimit;
    }

    // Measure Time to Interactive (approximation)
    if (document.readyState === 'complete') {
      this.measureTTI();
    } else {
      window.addEventListener('load', () => {
        setTimeout(() => this.measureTTI(), 0);
      });
    }
  }

  /**
   * Measure Time to Interactive (approximation)
   */
  private measureTTI(): void {
    // Use requestIdleCallback to approximate TTI
    if ('requestIdleCallback' in window) {
      const start = performance.now();
      (window as any).requestIdleCallback(() => {
        this.performanceMetrics.tti = performance.now() - start;
      });
    }
  }

  /**
   * Initialize API latency tracking
   */
  private initApiLatencyTracking(): void {
    // Intercept fetch
    const originalFetch = window.fetch;
    window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const startTime = performance.now();
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      const method = init?.method || 'GET';

      try {
        const response = await originalFetch(input, init);
        const duration = performance.now() - startTime;
        
        this.trackApiCall(url, method, duration, response.status, response.ok);
        
        return response;
      } catch (error) {
        const duration = performance.now() - startTime;
        this.trackApiCall(url, method, duration, 0, false);
        throw error;
      }
    };
  }

  /**
   * Initialize breadcrumb tracking
   */
  private initBreadcrumbs(): void {
    // Track clicks
    document.addEventListener('click', (event) => {
      const target = event.target as HTMLElement;
      const description = target.tagName + 
        (target.id ? `#${target.id}` : '') +
        (target.className ? `.${target.className.split(' ').join('.')}` : '');
      
      this.addBreadcrumb('click', `Clicked ${description}`);
    }, { passive: true });

    // Track navigation
    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;

    history.pushState = (...args) => {
      originalPushState.apply(history, args);
      this.addBreadcrumb('navigation', `Navigated to ${window.location.pathname}`);
      this.performanceMetrics.page = window.location.pathname;
    };

    history.replaceState = (...args) => {
      originalReplaceState.apply(history, args);
      this.addBreadcrumb('navigation', `Replaced to ${window.location.pathname}`);
    };

    window.addEventListener('popstate', () => {
      this.addBreadcrumb('navigation', `Popstate to ${window.location.pathname}`);
      this.performanceMetrics.page = window.location.pathname;
    });

    // Track console errors
    const originalConsoleError = console.error;
    console.error = (...args) => {
      this.addBreadcrumb('console', `Console error: ${args.map(a => String(a)).join(' ')}`);
      originalConsoleError.apply(console, args);
    };
  }

  /**
   * Start periodic reporting
   */
  private startPeriodicReporting(): void {
    // Report performance metrics every 30 seconds
    this.reportTimer = setInterval(() => {
      this.reportMetrics();
    }, 30000);

    // Report on page unload
    window.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        this.reportMetrics(true);
        this.flushErrorBatch(true);
      }
    });

    window.addEventListener('beforeunload', () => {
      this.reportMetrics(true);
      this.flushErrorBatch(true);
    });
  }

  /**
   * Start batch flush timer
   */
  private startBatchFlush(): void {
    // Flush error batch every 10 seconds
    this.flushTimer = setInterval(() => {
      this.flushErrorBatch();
    }, 10000);
  }

  /**
   * Report metrics to server
   */
  private async reportMetrics(useBeacon = false): Promise<void> {
    if (!this.performanceMetrics.lcp && !this.performanceMetrics.fcp) {
      // Don't report if no metrics collected yet
      return;
    }

    const report: PerformanceMetricReport = {
      sessionId: this.performanceMetrics.sessionId!,
      page: this.performanceMetrics.page || window.location.pathname,
      route: this.performanceMetrics.route,
      deviceType: this.performanceMetrics.deviceType!,
      connectionType: this.performanceMetrics.connectionType,
      effectiveType: this.performanceMetrics.effectiveType,
      fcp: this.performanceMetrics.fcp,
      lcp: this.performanceMetrics.lcp,
      fid: this.performanceMetrics.fid,
      cls: this.performanceMetrics.cls,
      ttfb: this.performanceMetrics.ttfb,
      inp: this.performanceMetrics.inp,
      tti: this.performanceMetrics.tti,
      memoryUsed: this.performanceMetrics.memoryUsed,
      memoryLimit: this.performanceMetrics.memoryLimit,
      apiLatency: this.performanceMetrics.apiLatency,
      timestamp: Date.now(),
    };

    const endpoint = this.config.apiEndpoint || '/api/performance/metrics';

    try {
      if (useBeacon && navigator.sendBeacon) {
        // Use sendBeacon for page unload
        navigator.sendBeacon(endpoint, JSON.stringify(report));
      } else {
        await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(report),
          keepalive: true,
        });
      }
    } catch (error) {
      // Silently fail - don't impact user experience
      if (this.config.environment === 'development') {
        console.warn('[APM] Failed to report metrics:', error);
      }
    }
  }

  /**
   * Report error to server
   */
  private async reportError(error: ErrorEvent): Promise<void> {
    const endpoint = '/api/apm/errors';

    try {
      await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(error),
        keepalive: true,
      });
    } catch (e) {
      // Silently fail
      if (this.config.environment === 'development') {
        console.warn('[APM] Failed to report error:', e);
      }
    }
  }

  /**
   * Flush error batch to server
   */
  private async flushErrorBatch(useBeacon = false): Promise<void> {
    if (this.pendingErrorBatch.length === 0) return;

    const batch = [...this.pendingErrorBatch];
    this.pendingErrorBatch = [];

    const endpoint = '/api/apm/errors/batch';

    try {
      if (useBeacon && navigator.sendBeacon) {
        navigator.sendBeacon(endpoint, JSON.stringify({ errors: batch }));
      } else {
        await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ errors: batch }),
          keepalive: true,
        });
      }
    } catch (e) {
      // Re-add to pending batch on failure (with limit)
      if (this.pendingErrorBatch.length < 50) {
        this.pendingErrorBatch.unshift(...batch);
      }
      
      if (this.config.environment === 'development') {
        console.warn('[APM] Failed to flush error batch:', e);
      }
    }
  }

  /**
   * Get current metrics snapshot
   */
  getMetrics(): Partial<PerformanceMetricReport> {
    return { ...this.performanceMetrics };
  }

  /**
   * Get collected errors
   */
  getErrors(): ErrorEvent[] {
    return [...this.errors];
  }

  /**
   * Get error statistics
   */
  getErrorStats(): { total: number; byType: Record<string, number>; bySeverity: Record<string, number> } {
    const byType: Record<string, number> = {};
    const bySeverity: Record<string, number> = {};

    for (const error of this.errors) {
      byType[error.type] = (byType[error.type] || 0) + 1;
      bySeverity[error.severity] = (bySeverity[error.severity] || 0) + 1;
    }

    return {
      total: this.errors.length,
      byType,
      bySeverity,
    };
  }

  /**
   * Get API latency records
   */
  getApiLatencies(): ApiLatencyRecord[] {
    return [...this.apiLatencies];
  }

  /**
   * Get breadcrumbs
   */
  getBreadcrumbs(): Breadcrumb[] {
    return [...this.breadcrumbs];
  }

  /**
   * Cleanup
   */
  destroy(): void {
    if (this.reportTimer) {
      clearInterval(this.reportTimer);
      this.reportTimer = null;
    }
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
    
    // Final flush
    this.reportMetrics(true);
    this.flushErrorBatch(true);
    
    this.isInitialized = false;
  }
}

// Singleton instance
export const apm = new APMService();

// Export convenience functions
export const initAPM = (options?: Partial<APMConfig>) => apm.init(options);
export const trackError = (error: Error | string, options?: Parameters<typeof apm.trackError>[1]) => 
  apm.trackError(error, options);
export const trackReactError = (error: Error, componentStack: string) => 
  apm.trackReactError(error, componentStack);
export const trackApiCall = (endpoint: string, method: string, duration: number, status: number, success: boolean) =>
  apm.trackApiCall(endpoint, method, duration, status, success);
export const addBreadcrumb = (type: Breadcrumb['type'], message: string, data?: Record<string, unknown>) =>
  apm.addBreadcrumb(type, message, data);

export default apm;