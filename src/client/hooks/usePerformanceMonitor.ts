/**
 * Performance Monitor Hook
 * Tracks and reports performance metrics
 */

import { useEffect, useRef, useState, useCallback } from 'react';

interface PerformanceMetrics {
  // Timing metrics
  loadTime: number;
  renderTime: number;
  interactionTime: number;

  // Resource metrics
  memoryUsage: number;
  cacheHitRate: number;
  apiCalls: number;

  // User experience metrics
  timeToFirstByte: number;
  firstContentfulPaint: number;
  largestContentfulPaint: number;
  cumulativeLayoutShift: number;
  firstInputDelay: number;

  // Custom metrics
  customMetrics: Record<string, number>;
}

class PerformanceMonitor {
  private static instance: PerformanceMonitor;
  private metrics: Partial<PerformanceMetrics> = {};
  private customMetrics: Map<string, number> = new Map();
  private apiCallCount = 0;
  private observers: PerformanceObserver[] = [];

  static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor();
    }
    return PerformanceMonitor.instance;
  }

  constructor() {
    if (typeof window !== 'undefined') {
      this.initObservers();
    }
  }

  private initObservers() {
    // Observe paint timing
    if ('PerformanceObserver' in window) {
      try {
        const paintObserver = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (entry.name === 'first-contentful-paint') {
              this.metrics.firstContentfulPaint = entry.startTime;
            }
          }
        });
        paintObserver.observe({ entryTypes: ['paint'] });
        this.observers.push(paintObserver);
      } catch (_e) {
        // Paint observer not supported
      }

      // Observe largest contentful paint
      try {
        const lcpObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          const lastEntry = entries[entries.length - 1];
          this.metrics.largestContentfulPaint = lastEntry.startTime;
        });
        lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });
        this.observers.push(lcpObserver);
      } catch (_e) {
        // LCP observer not supported
      }

      // Observe layout shift
      try {
        let clsValue = 0;
        const clsObserver = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (!(entry as any).hadRecentInput) {
              clsValue += (entry as any).value;
            }
          }
          this.metrics.cumulativeLayoutShift = clsValue;
        });
        clsObserver.observe({ entryTypes: ['layout-shift'] });
        this.observers.push(clsObserver);
      } catch (_e) {
        // CLS observer not supported
      }

      // Observe first input delay
      try {
        const fidObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          this.metrics.firstInputDelay = entries[0].duration;
        });
        fidObserver.observe({ entryTypes: ['first-input'] });
        this.observers.push(fidObserver);
      } catch (_e) {
        // FID observer not supported
      }
    }
  }

  /**
   * Mark the start of an operation
   */
  markStart(name: string): void {
    if (typeof performance !== 'undefined') {
      performance.mark(`${name}-start`);
    }
  }

  /**
   * Mark the end of an operation and measure duration
   */
  markEnd(name: string): number {
    if (typeof performance !== 'undefined') {
      performance.mark(`${name}-end`);
      try {
        performance.measure(name, `${name}-start`, `${name}-end`);
        const measure = performance.getEntriesByName(name, 'measure')[0];
        return measure?.duration || 0;
      } catch (_e) {
        return 0;
      }
    }
    return 0;
  }

  /**
   * Record API call
   */
  recordApiCall(): void {
    this.apiCallCount++;
  }

  /**
   * Set custom metric
   */
  setMetric(name: string, value: number): void {
    this.customMetrics.set(name, value);
  }

  /**
   * Get all metrics
   */
  getMetrics(): Partial<PerformanceMetrics> {
    // Get memory usage (Chrome only)
    const memory = (performance as any).memory;
    const memoryUsage = memory ? memory.usedJSHeapSize / memory.jsHeapSizeLimit : 0;

    return {
      ...this.metrics,
      memoryUsage,
      apiCalls: this.apiCallCount,
      customMetrics: Object.fromEntries(this.customMetrics),
    };
  }

  /**
   * Get navigation timing
   */
  getNavigationTiming(): PerformanceNavigationTiming | null {
    if (typeof performance === 'undefined') return null;

    const entries = performance.getEntriesByType('navigation');
    return entries[0] as PerformanceNavigationTiming;
  }

  /**
   * Get resource timing
   */
  getResourceTiming(): PerformanceResourceTiming[] {
    if (typeof performance === 'undefined') return [];

    return performance.getEntriesByType('resource') as PerformanceResourceTiming[];
  }

  /**
   * Clear all metrics
   */
  clear(): void {
    this.metrics = {};
    this.customMetrics.clear();
    this.apiCallCount = 0;
  }

  /**
   * Cleanup observers
   */
  disconnect(): void {
    this.observers.forEach((observer) => observer.disconnect());
    this.observers = [];
  }
}

// Singleton instance
const performanceMonitor = PerformanceMonitor.getInstance();

/**
 * Hook to track component render performance
 */
export function usePerformanceTracking(componentName: string) {
  const renderStartRef = useRef<number>(0);
  const renderCountRef = useRef<number>(0);

  useEffect(() => {
    renderStartRef.current = performance.now();
    renderCountRef.current++;

    return () => {
      const renderTime = performance.now() - renderStartRef.current;
      performanceMonitor.setMetric(`${componentName}_render_${renderCountRef.current}`, renderTime);
    };
  });
}

/**
 * Hook to measure operation performance
 */
export function useMeasurePerformance(name: string) {
  const measure = useCallback((operation: () => void) => {
    performanceMonitor.markStart(name);
    operation();
    const duration = performanceMonitor.markEnd(name);
    return duration;
  }, [name]);

  const measureAsync = useCallback(async <T>(operation: () => Promise<T>): Promise<{ result: T; duration: number }> => {
    performanceMonitor.markStart(name);
    const result = await operation();
    const duration = performanceMonitor.markEnd(name);
    return { result, duration };
  }, [name]);

  return { measure, measureAsync };
}

/**
 * Hook to get performance metrics
 */
export function usePerformanceMetrics() {
  const [metrics, setMetrics] = useState<Partial<PerformanceMetrics>>({});

  useEffect(() => {
    const updateMetrics = () => {
      setMetrics(performanceMonitor.getMetrics());
    };

    // Update immediately
    updateMetrics();

    // Update periodically
    const interval = setInterval(updateMetrics, 1000);

    return () => {
      clearInterval(interval);
    };
  }, []);

  const recordApiCall = useCallback(() => {
    performanceMonitor.recordApiCall();
  }, []);

  const setMetric = useCallback((name: string, value: number) => {
    performanceMonitor.setMetric(name, value);
  }, []);

  const clear = useCallback(() => {
    performanceMonitor.clear();
  }, []);

  return {
    metrics,
    recordApiCall,
    setMetric,
    clear,
  };
}

/**
 * Hook to track memory usage
 */
export function useMemoryMonitor() {
  const [memoryInfo, setMemoryInfo] = useState<{
    usedJSHeapSize: number;
    totalJSHeapSize: number;
    jsHeapSizeLimit: number;
    usagePercent: number;
  } | null>(null);

  useEffect(() => {
    const updateMemory = () => {
      const memory = (performance as any).memory;
      if (memory) {
        setMemoryInfo({
          usedJSHeapSize: memory.usedJSHeapSize,
          totalJSHeapSize: memory.totalJSHeapSize,
          jsHeapSizeLimit: memory.jsHeapSizeLimit,
          usagePercent: (memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100,
        });
      }
    };

    updateMemory();
    const interval = setInterval(updateMemory, 5000);

    return () => clearInterval(interval);
  }, []);

  return memoryInfo;
}

/**
 * Hook to detect slow renders
 */
export function useSlowRenderDetector(threshold: number = 16) {
  const slowRendersRef = useRef<Array<{ timestamp: number; duration: number }>>([]);

  useEffect(() => {
    const startTime = performance.now();

    return () => {
      const duration = performance.now() - startTime;
      if (duration > threshold) {
        slowRendersRef.current.push({
          timestamp: Date.now(),
          duration,
        });
      }
    };
  });

  return slowRendersRef.current;
}

export { performanceMonitor };
export default performanceMonitor;