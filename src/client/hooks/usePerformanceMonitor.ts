/**
 * Performance Monitoring Hook
 * Tracks render times, memory usage, and FPS for dashboard components
 */

import { useCallback, useEffect, useRef, useState, useMemo } from 'react';

interface PerformanceMetrics {
  /** Render time in milliseconds */
  renderTime: number;
  /** Average render time over last N renders */
  avgRenderTime: number;
  /** Memory usage in MB (if available) */
  memoryUsage: number | null;
  /** Current FPS */
  fps: number;
  /** Total renders count */
  renderCount: number;
  /** Last update timestamp */
  lastUpdate: number;
}

interface PerformanceOptions {
  /** Component name for logging */
  componentName: string;
  /** Number of renders to average (default: 10) */
  avgRenderCount?: number;
  /** Enable console logging (default: false) */
  enableLogging?: boolean;
  /** FPS measurement interval in ms (default: 1000) */
  fpsInterval?: number;
}

/**
 * Hook for monitoring component performance
 */
export function usePerformanceMonitor(options: PerformanceOptions) {
  const {
    componentName,
    avgRenderCount = 10,
    enableLogging = false,
    fpsInterval = 1000,
  } = options;

  const renderStartTime = useRef<number>(performance.now());
  const renderTimes = useRef<number[]>([]);
  const frameCount = useRef<number>(0);
  const lastFpsTime = useRef<number>(performance.now());
  const fpsFrameCount = useRef<number>(0);
  const animationFrameId = useRef<number | null>(null);

  const [metrics, setMetrics] = useState<PerformanceMetrics>({
    renderTime: 0,
    avgRenderTime: 0,
    memoryUsage: null,
    fps: 60,
    renderCount: 0,
    lastUpdate: Date.now(),
  });

  // Measure FPS
  useEffect(() => {
    const measureFps = () => {
      const now = performance.now();
      fpsFrameCount.current++;

      if (now - lastFpsTime.current >= fpsInterval) {
        const fps = Math.round((fpsFrameCount.current * 1000) / (now - lastFpsTime.current));
        lastFpsTime.current = now;
        fpsFrameCount.current = 0;

        setMetrics(prev => ({
          ...prev,
          fps,
          lastUpdate: Date.now(),
        }));
      }

      animationFrameId.current = requestAnimationFrame(measureFps);
    };

    animationFrameId.current = requestAnimationFrame(measureFps);

    return () => {
      if (animationFrameId.current !== null) {
        cancelAnimationFrame(animationFrameId.current);
      }
    };
  }, [fpsInterval]);

  // Track render start
  const trackRenderStart = useCallback(() => {
    renderStartTime.current = performance.now();
  }, []);

  // Track render end
  const trackRenderEnd = useCallback(() => {
    const renderTime = performance.now() - renderStartTime.current;
    renderTimes.current.push(renderTime);

    // Keep only last N render times
    if (renderTimes.current.length > avgRenderCount) {
      renderTimes.current.shift();
    }

    // Calculate average
    const avgRenderTime = renderTimes.current.reduce((sum, t) => sum + t, 0) / renderTimes.current.length;

    // Get memory usage if available (Chrome only)
    const memoryUsage = (performance as any).memory
      ? Math.round((performance as any).memory.usedJSHeapSize / (1024 * 1024))
      : null;

    setMetrics(prev => ({
      ...prev,
      renderTime,
      avgRenderTime,
      memoryUsage,
      renderCount: prev.renderCount + 1,
      lastUpdate: Date.now(),
    }));

    if (enableLogging) {
      console.log(`[${componentName}] Render: ${renderTime.toFixed(2)}ms, Avg: ${avgRenderTime.toFixed(2)}ms, FPS: ${metrics.fps}`);
    }
  }, [componentName, avgRenderCount, enableLogging, metrics.fps]);

  return {
    metrics,
    trackRenderStart,
    trackRenderEnd,
  };
}

/**
 * Hook for tracking component mount time
 */
export function useMountTime(componentName: string, threshold: number = 100) {
  const mountTime = useRef<number>(performance.now());

  useEffect(() => {
    const elapsed = performance.now() - mountTime.current;
    if (elapsed > threshold) {
      console.warn(`[${componentName}] Mount time exceeded threshold: ${elapsed.toFixed(2)}ms > ${threshold}ms`);
    } else {
      console.log(`[${componentName}] Mount time: ${elapsed.toFixed(2)}ms`);
    }
  }, [componentName, threshold]);
}

/**
 * Hook for tracking data processing time
 */
export function useDataProcessingTime<T>(
  data: T[],
  processor: (data: T[]) => any,
  dependencies: any[] = []
) {
  const [processedData, setProcessedData] = useState<any>(null);
  const [processingTime, setProcessingTime] = useState<number>(0);

  useEffect(() => {
    if (!data || data.length === 0) {
      setProcessedData(null);
      return;
    }

    const startTime = performance.now();
    const result = processor(data);
    const elapsed = performance.now() - startTime;

    setProcessedData(result);
    setProcessingTime(elapsed);

    if (elapsed > 50) {
      console.warn(`Data processing took ${elapsed.toFixed(2)}ms for ${data.length} items`);
    }
  }, [data, ...dependencies]);

  return { processedData, processingTime };
}

/**
 * Hook for lazy loading data with virtualization support
 */
export function useLazyLoad<T>(
  allData: T[],
  initialCount: number = 20,
  loadMoreCount: number = 20
) {
  const [visibleCount, setVisibleCount] = useState(initialCount);
  const [isLoading, setIsLoading] = useState(false);

  const visibleData = useMemo(() => {
    return allData.slice(0, visibleCount);
  }, [allData, visibleCount]);

  const hasMore = visibleCount < allData.length;
  const remainingCount = allData.length - visibleCount;

  const loadMore = useCallback(() => {
    if (isLoading || !hasMore) return;

    setIsLoading(true);
    
    // Simulate async loading for smoother UX
    requestAnimationFrame(() => {
      setVisibleCount(prev => Math.min(prev + loadMoreCount, allData.length));
      setIsLoading(false);
    });
  }, [isLoading, hasMore, loadMoreCount, allData.length]);

  const reset = useCallback(() => {
    setVisibleCount(initialCount);
  }, [initialCount]);

  return {
    visibleData,
    hasMore,
    remainingCount,
    isLoading,
    loadMore,
    reset,
  };
}