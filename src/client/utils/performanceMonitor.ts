/**
 * Performance Monitoring SDK
 * 
 * Collects and reports Core Web Vitals and custom performance metrics
 * to the backend for monitoring and alerting.
 * 
 * Features:
 * - Core Web Vitals (LCP, FCP, FID, CLS, TTFB, INP)
 * - Custom metrics (TTI, memory, API latency)
 * - Automatic batching and reporting
 * - Real-time alert subscription
 */

import { v4 as uuidv4 } from 'uuid';

// Types
export interface CoreWebVitals {
  lcp?: number;  // Largest Contentful Paint
  fcp?: number;  // First Contentful Paint
  fid?: number;  // First Input Delay
  cls?: number;  // Cumulative Layout Shift
  ttfb?: number; // Time to First Byte
  inp?: number;  // Interaction to Next Paint
}

export interface CustomMetrics {
  tti?: number;          // Time to Interactive
  memoryUsed?: number;   // JS Heap Size Used
  memoryLimit?: number;  // JS Heap Size Limit
  apiLatency?: number;   // Average API response time
  wsLatency?: number;    // WebSocket latency
}

export interface DeviceInfo {
  deviceType: 'mobile' | 'tablet' | 'desktop';
  os?: string;
  browser?: string;
  screenWidth?: number;
  screenHeight?: number;
  connectionType?: string;
  effectiveType?: string;
}

export interface PerformanceMetric extends CoreWebVitals, CustomMetrics {
  sessionId: string;
  page: string;
  route?: string;
  timestamp: number;
  device: DeviceInfo;
}

export interface PerformanceAlert {
  id: string;
  type: 'lcp' | 'fcp' | 'fid' | 'cls' | 'ttfb' | 'inp' | 'api_latency' | 'error_rate';
  severity: 'warning' | 'critical';
  message: string;
  value: number;
  threshold: number;
  timestamp: number;
  page?: string;
}

export interface PerformanceMonitorConfig {
  /** Endpoint for reporting metrics */
  endpoint?: string;
  /** Batch size before sending */
  batchSize?: number;
  /** Flush interval in ms */
  flushInterval?: number;
  /** Enable automatic page load tracking */
  trackPageLoads?: boolean;
  /** Enable API latency tracking */
  trackApiLatency?: boolean;
  /** Enable WebSocket latency tracking */
  trackWsLatency?: boolean;
  /** Sample rate for metrics (0-1) */
  sampleRate?: number;
  /** Debug mode */
  debug?: boolean;
}

// Default configuration
const DEFAULT_CONFIG: Required<PerformanceMonitorConfig> = {
  endpoint: '/api/performance/metrics',
  batchSize: 10,
  flushInterval: 10000, // 10 seconds
  trackPageLoads: true,
  trackApiLatency: true,
  trackWsLatency: true,
  sampleRate: 1,
  debug: false,
};

// Performance thresholds (Google's recommendations)
const PERFORMANCE_THRESHOLDS = {
  lcp: { good: 2500, poor: 4000 },
  fcp: { good: 1800, poor: 3000 },
  fid: { good: 100, poor: 300 },
  cls: { good: 0.1, poor: 0.25 },
  ttfb: { good: 800, poor: 1800 },
  inp: { good: 200, poor: 500 },
  apiLatency: { good: 200, poor: 1000 },
};

/**
 * Performance Monitor SDK
 */
export class PerformanceMonitor {
  private config: Required<PerformanceMonitorConfig>;
  private sessionId: string;
  private metricsQueue: PerformanceMetric[] = [];
  private flushTimer?: NodeJS.Timeout;
  private observers: PerformanceObserver[] = [];
  private apiLatencies: number[] = [];
  private alertCallbacks: ((alert: PerformanceAlert) => void)[] = [];

  constructor(config: Partial<PerformanceMonitorConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.sessionId = this.getOrCreateSessionId();

    if (this.shouldSample()) {
      this.init();
    }
  }

  /**
   * Initialize performance monitoring
   */
  private init(): void {
    if (typeof window === 'undefined' || typeof performance === 'undefined') {
      return;
    }

    // Track page load metrics
    if (this.config.trackPageLoads) {
      this.trackPageLoad();
    }

    // Setup observers for Core Web Vitals
    this.setupObservers();

    // Start flush timer
    this.startFlushTimer();

    // Track page visibility for session tracking
    this.trackVisibility();

    // Track navigation
    this.trackNavigation();

    // Cleanup on page unload
    window.addEventListener('beforeunload', () => {
      this.flush();
    });

    this.log('Performance monitor initialized');
  }

  /**
   * Get or create session ID
   */
  private getOrCreateSessionId(): string {
    if (typeof window === 'undefined') return uuidv4();

    const storageKey = 'perf_session_id';
    const storedId = sessionStorage.getItem(storageKey);
    
    if (storedId) {
      return storedId;
    }

    const newId = uuidv4();
    sessionStorage.setItem(storageKey, newId);
    return newId;
  }

  /**
   * Check if this session should be sampled
   */
  private shouldSample(): boolean {
    return Math.random() <= this.config.sampleRate;
  }

  /**
   * Setup Performance Observers for Core Web Vitals
   */
  private setupObservers(): void {
    // LCP Observer
    this.observePerformanceEntry('largest-contentful-paint', (entries) => {
      const lcp = entries[entries.length - 1] as LargestContentfulPaint;
      if (lcp) {
        this.recordMetric('lcp', lcp.startTime);
      }
    });

    // FCP Observer
    this.observePerformanceEntry('paint', (entries) => {
      const fcp = entries.find(e => e.name === 'first-contentful-paint');
      if (fcp) {
        this.recordMetric('fcp', fcp.startTime);
      }
    });

    // FID Observer
    this.observePerformanceEntry('first-input', (entries) => {
      const fid = entries[0] as FirstInputEntry;
      if (fid) {
        this.recordMetric('fid', fid.processingStart - fid.startTime);
      }
    });

    // CLS Observer
    this.observePerformanceEntry('layout-shift', (entries) => {
      let clsValue = 0;
      for (const entry of entries as LayoutShift[]) {
        if (!entry.hadRecentInput) {
          clsValue += entry.value;
        }
      }
      if (clsValue > 0) {
        this.recordMetric('cls', clsValue);
      }
    });

    // INP Observer (Interaction to Next Paint)
    this.observePerformanceEntry('event', (entries) => {
      let maxDuration = 0;
      for (const entry of entries as EventTimingEntry[]) {
        if (entry.interactionId > 0) {
          maxDuration = Math.max(maxDuration, entry.duration);
        }
      }
      if (maxDuration > 0) {
        this.recordMetric('inp', maxDuration);
      }
    });

    // TTFB from Navigation Timing
    const navEntry = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
    if (navEntry) {
      const ttfb = navEntry.responseStart - navEntry.requestStart;
      this.recordMetric('ttfb', ttfb);
    }
  }

  /**
   * Observe performance entries of a specific type
   */
  private observePerformanceEntry(
    entryType: string,
    callback: (entries: PerformanceEntry[]) => void
  ): void {
    try {
      const observer = new PerformanceObserver((list) => {
        callback(list.getEntries());
      });
      observer.observe({ type: entryType, buffered: true });
      this.observers.push(observer);
    } catch (e) {
      this.log(`Observer not supported: ${entryType}`);
    }
  }

  /**
   * Track page load metrics
   */
  private trackPageLoad(): void {
    if (document.readyState === 'complete') {
      this.collectPageLoadMetrics();
    } else {
      window.addEventListener('load', () => {
        this.collectPageLoadMetrics();
      });
    }
  }

  /**
   * Collect page load metrics from Navigation Timing
   */
  private collectPageLoadMetrics(): void {
    const navEntry = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
    
    if (!navEntry) return;

    const metrics: Partial<PerformanceMetric> = {
      ttfb: navEntry.responseStart - navEntry.requestStart,
      page: window.location.pathname,
      timestamp: Date.now(),
    };

    // Calculate TTI (approximate)
    const tti = navEntry.domInteractive - navEntry.fetchStart;
    metrics.tti = tti;

    // Memory info if available
    if ((performance as any).memory) {
      const memory = (performance as any).memory;
      metrics.memoryUsed = memory.usedJSHeapSize;
      metrics.memoryLimit = memory.totalJSHeapSize;
    }

    this.addToQueue({
      ...metrics,
      sessionId: this.sessionId,
      device: this.getDeviceInfo(),
    } as PerformanceMetric);
  }

  /**
   * Record a single metric
   */
  recordMetric(name: keyof CoreWebVitals | keyof CustomMetrics, value: number): void {
    const metric: Partial<PerformanceMetric> = {
      page: window.location.pathname,
      timestamp: Date.now(),
      [name]: value,
    };

    this.addToQueue({
      ...metric,
      sessionId: this.sessionId,
      device: this.getDeviceInfo(),
    } as PerformanceMetric);

    // Check thresholds and emit alerts
    this.checkThreshold(name, value);
  }

  /**
   * Record API latency
   */
  recordApiLatency(duration: number, endpoint?: string): void {
    this.apiLatencies.push(duration);
    
    // Keep only last 100 measurements
    if (this.apiLatencies.length > 100) {
      this.apiLatencies = this.apiLatencies.slice(-100);
    }

    const avgLatency = this.apiLatencies.reduce((a, b) => a + b, 0) / this.apiLatencies.length;
    
    this.recordMetric('apiLatency', avgLatency);
    this.checkThreshold('apiLatency', avgLatency);
  }

  /**
   * Add metric to queue
   */
  private addToQueue(metric: PerformanceMetric): void {
    this.metricsQueue.push(metric);
    this.log('Metric added to queue:', metric);

    if (this.metricsQueue.length >= this.config.batchSize) {
      this.flush();
    }
  }

  /**
   * Check threshold and emit alert if exceeded
   */
  private checkThreshold(
    name: keyof typeof PERFORMANCE_THRESHOLDS,
    value: number
  ): void {
    const threshold = PERFORMANCE_THRESHOLDS[name];
    if (!threshold) return;

    let severity: 'warning' | 'critical' | null = null;
    
    if (value > threshold.poor) {
      severity = 'critical';
    } else if (value > threshold.good) {
      severity = 'warning';
    }

    if (severity) {
      const alert: PerformanceAlert = {
        id: uuidv4(),
        type: name as PerformanceAlert['type'],
        severity,
        message: `${name.toUpperCase()} is ${severity}: ${value.toFixed(2)}ms (threshold: ${threshold[severity === 'critical' ? 'poor' : 'good']}ms)`,
        value,
        threshold: threshold[severity === 'critical' ? 'poor' : 'good'],
        timestamp: Date.now(),
        page: window.location.pathname,
      };

      this.emitAlert(alert);
    }
  }

  /**
   * Emit alert to subscribers
   */
  private emitAlert(alert: PerformanceAlert): void {
    this.log('Performance alert:', alert);
    for (const callback of this.alertCallbacks) {
      try {
        callback(alert);
      } catch (e) {
        console.error('Error in alert callback:', e);
      }
    }
  }

  /**
   * Subscribe to performance alerts
   */
  onAlert(callback: (alert: PerformanceAlert) => void): () => void {
    this.alertCallbacks.push(callback);
    return () => {
      const index = this.alertCallbacks.indexOf(callback);
      if (index > -1) {
        this.alertCallbacks.splice(index, 1);
      }
    };
  }

  /**
   * Get device info
   */
  private getDeviceInfo(): DeviceInfo {
    const ua = navigator.userAgent;
    let deviceType: DeviceInfo['deviceType'] = 'desktop';
    
    if (/mobile/i.test(ua)) {
      deviceType = 'mobile';
    } else if (/tablet/i.test(ua) || /ipad/i.test(ua)) {
      deviceType = 'tablet';
    }

    // Parse OS
    let os = 'unknown';
    if (/windows/i.test(ua)) os = 'Windows';
    else if (/mac/i.test(ua)) os = 'MacOS';
    else if (/linux/i.test(ua)) os = 'Linux';
    else if (/android/i.test(ua)) os = 'Android';
    else if (/ios|iphone|ipad/i.test(ua)) os = 'iOS';

    // Parse browser
    let browser = 'unknown';
    if (/firefox/i.test(ua)) browser = 'Firefox';
    else if (/edg/i.test(ua)) browser = 'Edge';
    else if (/chrome/i.test(ua)) browser = 'Chrome';
    else if (/safari/i.test(ua)) browser = 'Safari';

    // Connection info
    const connection = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;

    return {
      deviceType,
      os,
      browser,
      screenWidth: window.screen.width,
      screenHeight: window.screen.height,
      connectionType: connection?.type,
      effectiveType: connection?.effectiveType,
    };
  }

  /**
   * Track visibility changes
   */
  private trackVisibility(): void {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        this.flush();
      }
    });
  }

  /**
   * Track navigation (SPA routing)
   */
  private trackNavigation(): void {
    // Track route changes for SPAs
    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;

    history.pushState = (...args) => {
      originalPushState.apply(history, args);
      this.onRouteChange();
    };

    history.replaceState = (...args) => {
      originalReplaceState.apply(history, args);
      this.onRouteChange();
    };

    window.addEventListener('popstate', () => {
      this.onRouteChange();
    });
  }

  /**
   * Handle route change
   */
  private onRouteChange(): void {
    // Create new session for new route
    this.sessionId = uuidv4();
    sessionStorage.setItem('perf_session_id', this.sessionId);

    // Collect metrics for the new page
    this.collectPageLoadMetrics();
  }

  /**
   * Start flush timer
   */
  private startFlushTimer(): void {
    this.flushTimer = setInterval(() => {
      if (this.metricsQueue.length > 0) {
        this.flush();
      }
    }, this.config.flushInterval);
  }

  /**
   * Flush metrics to server
   */
  async flush(): Promise<void> {
    if (this.metricsQueue.length === 0) return;

    const metrics = [...this.metricsQueue];
    this.metricsQueue = [];

    try {
      const response = await fetch(this.config.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          metrics: metrics.map(m => ({
            session_id: m.sessionId,
            fcp: m.fcp,
            lcp: m.lcp,
            fid: m.fid,
            cls: m.cls,
            ttfb: m.ttfb,
            inp: m.inp,
            tti: m.tti,
            memory_used: m.memoryUsed,
            memory_limit: m.memoryLimit,
            api_latency: m.apiLatency,
            page: m.page,
            route: m.route,
            device_type: m.device.deviceType,
            os: m.device.os,
            browser: m.device.browser,
            screen_width: m.device.screenWidth,
            screen_height: m.device.screenHeight,
            connection_type: m.device.connectionType,
            effective_type: m.device.effectiveType,
          })),
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to send metrics: ${response.status}`);
      }

      this.log(`Flushed ${metrics.length} metrics`);
    } catch (error) {
      console.error('Failed to flush performance metrics:', error);
      // Re-add metrics to queue for retry
      this.metricsQueue.unshift(...metrics);
    }
  }

  /**
   * Get current metrics
   */
  getCurrentMetrics(): {
    coreWebVitals: CoreWebVitals;
    customMetrics: CustomMetrics;
    apiLatencies: number[];
  } {
    const navEntry = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
    
    return {
      coreWebVitals: {
        lcp: this.getLatestMetric('lcp'),
        fcp: this.getLatestMetric('fcp'),
        fid: this.getLatestMetric('fid'),
        cls: this.getLatestMetric('cls'),
        ttfb: navEntry ? navEntry.responseStart - navEntry.requestStart : undefined,
        inp: this.getLatestMetric('inp'),
      },
      customMetrics: {
        tti: this.getLatestMetric('tti'),
        memoryUsed: (performance as any).memory?.usedJSHeapSize,
        memoryLimit: (performance as any).memory?.totalJSHeapSize,
        apiLatency: this.apiLatencies.length > 0 
          ? this.apiLatencies.reduce((a, b) => a + b, 0) / this.apiLatencies.length 
          : undefined,
      },
      apiLatencies: [...this.apiLatencies],
    };
  }

  /**
   * Get latest metric value from queue
   */
  private getLatestMetric(name: string): number | undefined {
    for (let i = this.metricsQueue.length - 1; i >= 0; i--) {
      const value = (this.metricsQueue[i] as any)[name];
      if (value !== undefined) {
        return value;
      }
    }
    return undefined;
  }

  /**
   * Debug logging
   */
  private log(message: string, ...args: any[]): void {
    if (this.config.debug) {
      console.log(`[PerformanceMonitor] ${message}`, ...args);
    }
  }

  /**
   * Cleanup observers and timers
   */
  destroy(): void {
    for (const observer of this.observers) {
      observer.disconnect();
    }
    
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }

    this.flush();
  }
}

// Singleton instance
let performanceMonitorInstance: PerformanceMonitor | null = null;

/**
 * Get or create the performance monitor instance
 */
export function getPerformanceMonitor(
  config?: Partial<PerformanceMonitorConfig>
): PerformanceMonitor {
  if (!performanceMonitorInstance) {
    performanceMonitorInstance = new PerformanceMonitor(config);
  }
  return performanceMonitorInstance;
}

/**
 * Initialize performance monitoring
 */
export function initPerformanceMonitoring(
  config?: Partial<PerformanceMonitorConfig>
): PerformanceMonitor {
  return getPerformanceMonitor(config);
}

// Type declarations for Performance Observer entries
interface LargestContentfulPaint extends PerformanceEntry {
  startTime: number;
  size: number;
  element: Element;
}

interface FirstInputEntry extends PerformanceEntry {
  processingStart: number;
  startTime: number;
}

interface LayoutShift extends PerformanceEntry {
  value: number;
  hadRecentInput: boolean;
}

interface EventTimingEntry extends PerformanceEntry {
  duration: number;
  interactionId: number;
}

export default PerformanceMonitor;