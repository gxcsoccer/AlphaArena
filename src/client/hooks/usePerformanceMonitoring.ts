/**
 * Performance Monitoring Hook
 * 
 * Collects Core Web Vitals and custom performance metrics
 * for the mobile performance monitoring dashboard.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

// Core Web Vitals types
interface WebVitals {
  fcp: number | null;  // First Contentful Paint
  lcp: number | null;  // Largest Contentful Paint
  fid: number | null;  // First Input Delay
  cls: number | null;  // Cumulative Layout Shift
  ttfb: number | null; // Time to First Byte
  inp: number | null;  // Interaction to Next Paint
}

// Custom metrics
interface CustomMetrics {
  tti: number | null;        // Time to Interactive
  memoryUsed: number | null;  // JS Heap Used
  memoryLimit: number | null; // JS Heap Limit
  apiLatency: number | null;  // Average API latency
  wsLatency: number | null;   // WebSocket latency
  wsConnected: boolean;       // WebSocket connection status
}

// Device info
interface DeviceInfo {
  deviceType: 'mobile' | 'tablet' | 'desktop';
  os: string;
  browser: string;
  screenWidth: number;
  screenHeight: number;
  connectionType: string;
  effectiveType: string;
}

// Combined metrics
export interface PerformanceMetrics extends WebVitals, CustomMetrics {
  page: string;
  route: string;
  sessionId: string;
  timestamp: number;
}

// Options for the hook
interface UsePerformanceMonitoringOptions {
  /** Enable automatic reporting (default: true) */
  autoReport?: boolean;
  /** Report interval in milliseconds (default: 30000) */
  reportInterval?: number;
  /** Custom API endpoint for reporting */
  endpoint?: string;
  /** Enable console logging for debugging */
  debug?: boolean;
  /** Batch metrics before sending */
  batchEnabled?: boolean;
  /** Max batch size before forcing send */
  maxBatchSize?: number;
}

// Default options
const DEFAULT_OPTIONS: Required<UsePerformanceMonitoringOptions> = {
  autoReport: true,
  reportInterval: 30000, // 30 seconds
  endpoint: '/api/performance/metrics',
  debug: false,
  batchEnabled: true,
  maxBatchSize: 10,
};

/**
 * Detect device type based on screen width
 */
function detectDeviceType(): 'mobile' | 'tablet' | 'desktop' {
  const width = window.innerWidth;
  if (width < 768) return 'mobile';
  if (width < 1024) return 'tablet';
  return 'desktop';
}

/**
 * Parse user agent to get OS and browser info
 */
function parseUserAgent(): { os: string; browser: string } {
  const ua = navigator.userAgent;
  let os = 'unknown';
  let browser = 'unknown';

  // Detect OS
  if (ua.includes('Win')) os = 'Windows';
  else if (ua.includes('Mac')) os = 'MacOS';
  else if (ua.includes('Linux')) os = 'Linux';
  else if (ua.includes('Android')) os = 'Android';
  else if (ua.includes('iOS') || ua.includes('iPhone') || ua.includes('iPad')) os = 'iOS';

  // Detect browser
  if (ua.includes('Firefox')) browser = 'Firefox';
  else if (ua.includes('Edg')) browser = 'Edge';
  else if (ua.includes('Chrome')) browser = 'Chrome';
  else if (ua.includes('Safari')) browser = 'Safari';

  return { os, browser };
}

/**
 * Get network connection info
 */
function getConnectionInfo(): { connectionType: string; effectiveType: string } {
  const connection = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;
  
  if (connection) {
    return {
      connectionType: connection.type || 'unknown',
      effectiveType: connection.effectiveType || 'unknown',
    };
  }
  
  return { connectionType: 'unknown', effectiveType: 'unknown' };
}

/**
 * Generate a unique session ID
 */
function generateSessionId(): string {
  const stored = sessionStorage.getItem('perf_session_id');
  if (stored) return stored;
  
  const id = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  sessionStorage.setItem('perf_session_id', id);
  return id;
}

/**
 * Hook for collecting and reporting performance metrics
 */
export function usePerformanceMonitoring(options: UsePerformanceMonitoringOptions = {}) {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  
  // Metrics state
  const [metrics, setMetrics] = useState<PerformanceMetrics | null>(null);
  const [isReporting, setIsReporting] = useState(false);
  
  // Refs for tracking metrics
  const webVitalsRef = useRef<WebVitals>({
    fcp: null,
    lcp: null,
    fid: null,
    cls: null,
    ttfb: null,
    inp: null,
  });
  
  const customMetricsRef = useRef<CustomMetrics>({
    tti: null,
    memoryUsed: null,
    memoryLimit: null,
    apiLatency: null,
    wsLatency: null,
    wsConnected: false,
  });
  
  const batchRef = useRef<PerformanceMetrics[]>([]);
  const lastReportRef = useRef<number>(Date.now());
  
  // Session and device info (computed once)
  const sessionIdRef = useRef<string>(generateSessionId());
  const deviceInfoRef = useRef<DeviceInfo>(() => {
    const { os, browser } = parseUserAgent();
    const { connectionType, effectiveType } = getConnectionInfo();
    
    return {
      deviceType: detectDeviceType(),
      os,
      browser,
      screenWidth: window.innerWidth,
      screenHeight: window.innerHeight,
      connectionType,
      effectiveType,
    };
  });

  /**
   * Initialize web-vitals measurement
   */
  useEffect(() => {
    // Dynamic import of web-vitals (ESM)
    import('web-vitals').then(({ onFCP, onLCP, onFID, onCLS, onTTFB, onINP }) => {
      onFCP((metric) => {
        webVitalsRef.current.fcp = metric.value;
        if (opts.debug) console.log('[Perf] FCP:', metric.value);
      });
      
      onLCP((metric) => {
        webVitalsRef.current.lcp = metric.value;
        if (opts.debug) console.log('[Perf] LCP:', metric.value);
      });
      
      onFID((metric) => {
        webVitalsRef.current.fid = metric.value;
        if (opts.debug) console.log('[Perf] FID:', metric.value);
      });
      
      onCLS((metric) => {
        webVitalsRef.current.cls = metric.value;
        if (opts.debug) console.log('[Perf] CLS:', metric.value);
      });
      
      onTTFB((metric) => {
        webVitalsRef.current.ttfb = metric.value;
        if (opts.debug) console.log('[Perf] TTFB:', metric.value);
      });
      
      onINP((metric) => {
        webVitalsRef.current.inp = metric.value;
        if (opts.debug) console.log('[Perf] INP:', metric.value);
      });
    }).catch(err => {
      console.warn('[Perf] Failed to load web-vitals:', err);
    });
  }, [opts.debug]);

  /**
   * Collect current metrics
   */
  const collectMetrics = useCallback((): PerformanceMetrics => {
    const deviceInfo = deviceInfoRef.current;
    
    // Get memory info if available
    const memory = (performance as any).memory;
    if (memory) {
      customMetricsRef.current.memoryUsed = memory.usedJSHeapSize;
      customMetricsRef.current.memoryLimit = memory.totalJSHeapSize;
    }
    
    // Calculate TTI approximation (time since DOMContentLoaded)
    const navEntry = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
    if (navEntry) {
      customMetricsRef.current.tti = navEntry.domContentLoadedEventEnd - navEntry.fetchStart;
    }
    
    return {
      ...webVitalsRef.current,
      ...customMetricsRef.current,
      page: window.location.pathname,
      route: window.location.pathname, // Could be enhanced with router
      sessionId: sessionIdRef.current,
      timestamp: Date.now(),
    };
  }, []);

  /**
   * Report metrics to server
   */
  const reportMetrics = useCallback(async (metricsToReport?: PerformanceMetrics | PerformanceMetrics[]) => {
    const data = metricsToReport || collectMetrics();
    const dataArray = Array.isArray(data) ? data : [data];
    
    if (dataArray.length === 0) return;
    
    setIsReporting(true);
    
    try {
      const deviceInfo = deviceInfoRef.current;
      const token = localStorage.getItem('token') || localStorage.getItem('supabase_token');
      
      const payload = dataArray.map(m => ({
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
        ws_latency: m.wsLatency,
        ws_connected: m.wsConnected,
        page: m.page,
        route: m.route,
        device_type: deviceInfo.deviceType,
        os: deviceInfo.os,
        browser: deviceInfo.browser,
        screen_width: deviceInfo.screenWidth,
        screen_height: deviceInfo.screenHeight,
        connection_type: deviceInfo.connectionType,
        effective_type: deviceInfo.effectiveType,
      }));
      
      const endpoint = dataArray.length > 1 ? `${opts.endpoint}/batch` : opts.endpoint;
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(
          dataArray.length > 1 ? { metrics: payload } : payload[0]
        ),
      });
      
      if (!response.ok) {
        throw new Error(`Report failed: ${response.status}`);
      }
      
      if (opts.debug) {
        console.log('[Perf] Reported', dataArray.length, 'metrics');
      }
      
      // Clear batch on success
      batchRef.current = [];
      lastReportRef.current = Date.now();
    } catch (error) {
      console.error('[Perf] Failed to report metrics:', error);
      
      // Keep metrics in batch for retry if batch is enabled
      if (opts.batchEnabled && !Array.isArray(metricsToReport)) {
        batchRef.current.push(dataArray[0]);
      }
    } finally {
      setIsReporting(false);
    }
  }, [collectMetrics, opts.endpoint, opts.debug, opts.batchEnabled]);

  /**
   * Track API latency
   */
  const trackApiLatency = useCallback((latency: number) => {
    customMetricsRef.current.apiLatency = latency;
  }, []);

  /**
   * Track WebSocket latency
   */
  const trackWsLatency = useCallback((latency: number) => {
    customMetricsRef.current.wsLatency = latency;
  }, []);

  /**
   * Update WebSocket connection status
   */
  const setWsConnected = useCallback((connected: boolean) => {
    customMetricsRef.current.wsConnected = connected;
  }, []);

  /**
   * Auto-reporting interval
   */
  useEffect(() => {
    if (!opts.autoReport) return;
    
    const intervalId = setInterval(() => {
      const currentMetrics = collectMetrics();
      setMetrics(currentMetrics);
      
      if (opts.batchEnabled) {
        batchRef.current.push(currentMetrics);
        
        // Send if batch is full or interval passed
        const timeSinceLastReport = Date.now() - lastReportRef.current;
        const shouldSend = batchRef.current.length >= opts.maxBatchSize || 
                          timeSinceLastReport >= opts.reportInterval;
        
        if (shouldSend) {
          reportMetrics([...batchRef.current]);
        }
      } else {
        reportMetrics(currentMetrics);
      }
    }, opts.reportInterval);
    
    return () => clearInterval(intervalId);
  }, [opts.autoReport, opts.batchEnabled, opts.maxBatchSize, opts.reportInterval, collectMetrics, reportMetrics]);

  /**
   * Report on page unload
   */
  useEffect(() => {
    const handleUnload = () => {
      const finalMetrics = collectMetrics();
      
      // Use sendBeacon for reliable delivery on page unload
      const token = localStorage.getItem('token') || localStorage.getItem('supabase_token');
      const deviceInfo = deviceInfoRef.current;
      
      const payload = {
        session_id: finalMetrics.sessionId,
        fcp: finalMetrics.fcp,
        lcp: finalMetrics.lcp,
        fid: finalMetrics.fid,
        cls: finalMetrics.cls,
        ttfb: finalMetrics.ttfb,
        inp: finalMetrics.inp,
        tti: finalMetrics.tti,
        memory_used: finalMetrics.memoryUsed,
        memory_limit: finalMetrics.memoryLimit,
        api_latency: finalMetrics.apiLatency,
        ws_latency: finalMetrics.wsLatency,
        ws_connected: finalMetrics.wsConnected,
        page: finalMetrics.page,
        route: finalMetrics.route,
        device_type: deviceInfo.deviceType,
        os: deviceInfo.os,
        browser: deviceInfo.browser,
        screen_width: deviceInfo.screenWidth,
        screen_height: deviceInfo.screenHeight,
        connection_type: deviceInfo.connectionType,
        effective_type: deviceInfo.effectiveType,
      };
      
      navigator.sendBeacon(opts.endpoint, JSON.stringify(payload));
    };
    
    window.addEventListener('beforeunload', handleUnload);
    return () => window.removeEventListener('beforeunload', handleUnload);
  }, [collectMetrics, opts.endpoint]);

  return {
    metrics,
    collectMetrics,
    reportMetrics,
    trackApiLatency,
    trackWsLatency,
    setWsConnected,
    isReporting,
    sessionId: sessionIdRef.current,
    deviceInfo: deviceInfoRef.current,
  };
}

export default usePerformanceMonitoring;