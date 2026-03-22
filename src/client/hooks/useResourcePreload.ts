/**
 * Resource Preloading Hook
 * 
 * Issue #513: Performance Optimization
 * Provides utilities for preloading critical resources to improve page load performance.
 */

import { useEffect, useCallback, useRef } from 'react';

interface PreloadOptions {
  /** Priority hint for the browser */
  fetchPriority?: 'high' | 'low' | 'auto';
  /** Resource type hint */
  as?: 'script' | 'style' | 'image' | 'font' | 'fetch';
  /** CORS setting */
  crossOrigin?: 'anonymous' | 'use-credentials';
  /** Resource type for content-type hint */
  type?: string;
}

interface PreloadResult {
  success: boolean;
  error?: Error;
  duration?: number;
}

/**
 * Preload a single resource
 */
export function preloadResource(
  url: string,
  options: PreloadOptions = {}
): Promise<PreloadResult> {
  const startTime = performance.now();
  
  return new Promise((resolve) => {
    // Check if already preloaded
    const existing = document.querySelector(
      `link[rel="preload"][href="${url}"], link[rel="prefetch"][href="${url}"]`
    );
    
    if (existing) {
      resolve({ success: true, duration: 0 });
      return;
    }
    
    const link = document.createElement('link');
    link.rel = 'preload';
    link.href = url;
    
    if (options.as) link.setAttribute('as', options.as);
    if (options.crossOrigin) link.crossOrigin = options.crossOrigin;
    if (options.type) link.type = options.type;
    if (options.fetchPriority) link.setAttribute('fetchpriority', options.fetchPriority);
    
    link.onload = () => {
      const duration = performance.now() - startTime;
      resolve({ success: true, duration });
    };
    
    link.onerror = () => {
      const duration = performance.now() - startTime;
      resolve({ success: false, error: new Error(`Failed to preload: ${url}`), duration });
    };
    
    document.head.appendChild(link);
  });
}

/**
 * Prefetch a resource (lower priority than preload)
 */
export function prefetchResource(
  url: string,
  options: PreloadOptions = {}
): Promise<PreloadResult> {
  const startTime = performance.now();
  
  return new Promise((resolve) => {
    const existing = document.querySelector(`link[rel="prefetch"][href="${url}"]`);
    
    if (existing) {
      resolve({ success: true, duration: 0 });
      return;
    }
    
    const link = document.createElement('link');
    link.rel = 'prefetch';
    link.href = url;
    
    if (options.crossOrigin) link.crossOrigin = options.crossOrigin;
    
    link.onload = () => {
      const duration = performance.now() - startTime;
      resolve({ success: true, duration });
    };
    
    link.onerror = () => {
      const duration = performance.now() - startTime;
      resolve({ success: false, error: new Error(`Failed to prefetch: ${url}`), duration });
    };
    
    document.head.appendChild(link);
  });
}

/**
 * Preconnect to a domain
 */
export function preconnect(url: string): void {
  const existing = document.querySelector(`link[rel="preconnect"][href="${url}"]`);
  if (existing) return;
  
  const link = document.createElement('link');
  link.rel = 'preconnect';
  link.href = url;
  document.head.appendChild(link);
}

/**
 * Hook to preload critical resources on mount
 */
export function useResourcePreload(
  resources: Array<{ url: string; options?: PreloadOptions }>,
  options: {
    /** Delay before starting preload (ms) */
    delay?: number;
    /** Enable debug logging */
    debug?: boolean;
    /** Only preload on idle callback */
    onIdle?: boolean;
  } = {}
) {
  const { delay = 0, debug = false, onIdle = true } = options;
  const preloadedRef = useRef(false);
  
  const preload = useCallback(async () => {
    if (preloadedRef.current) return;
    preloadedRef.current = true;
    
    const start = performance.now();
    let successCount = 0;
    
    for (const { url, options: preloadOptions } of resources) {
      const result = await preloadResource(url, preloadOptions);
      if (result.success) successCount++;
      if (debug) {
        console.log(`[Preload] ${url}: ${result.success ? 'success' : 'failed'} (${result.duration?.toFixed(0)}ms)`);
      }
    }
    
    if (debug) {
      console.log(`[Preload] Completed ${successCount}/${resources.length} in ${(performance.now() - start).toFixed(0)}ms`);
    }
  }, [resources, debug]);
  
  useEffect(() => {
    const executePreload = () => {
      if (delay > 0) {
        setTimeout(preload, delay);
      } else {
        preload();
      }
    };
    
    if (onIdle && 'requestIdleCallback' in window) {
      const idleId = requestIdleCallback(executePreload, { timeout: 2000 });
      return () => cancelIdleCallback(idleId);
    } else {
      executePreload();
    }
  }, [preload, delay, onIdle]);
}

/**
 * Hook to prefetch routes on hover
 */
export function useRoutePrefetch(
  routeImport: () => Promise<any>,
  options: {
    /** Delay before prefetch (ms) */
    delay?: number;
    /** Enable debug logging */
    debug?: boolean;
  } = {}
) {
  const { delay = 100, debug = false } = options;
  const prefetchedRef = useRef(false);
  
  const prefetch = useCallback(() => {
    if (prefetchedRef.current) return;
    prefetchedRef.current = true;
    
    if (debug) {
      console.log('[Prefetch] Loading route module');
    }
    
    routeImport();
  }, [routeImport, debug]);
  
  const onMouseEnter = useCallback(() => {
    setTimeout(prefetch, delay);
  }, [prefetch, delay]);
  
  const onTouchStart = useCallback(() => {
    prefetch();
  }, [prefetch]);
  
  return { onMouseEnter, onTouchStart };
}

/**
 * Hook to preload images
 */
export function useImagePreload(
  images: string[],
  options: {
    /** Delay before starting preload (ms) */
    delay?: number;
    /** Enable debug logging */
    debug?: boolean;
  } = {}
) {
  const { delay = 0, debug = false } = options;
  const loadedRef = useRef<Set<string>>(new Set());
  
  useEffect(() => {
    const loadImages = async () => {
      for (const src of images) {
        if (loadedRef.current.has(src)) continue;
        
        const img = new Image();
        img.src = src;
        loadedRef.current.add(src);
        
        if (debug) {
          console.log(`[ImagePreload] Loading: ${src}`);
        }
      }
    };
    
    if (delay > 0) {
      setTimeout(loadImages, delay);
    } else {
      loadImages();
    }
  }, [images, delay, debug]);
}

/**
 * Hook to track and report Web Vitals
 */
export function useWebVitalsReporter(
  options: {
    /** Report endpoint */
    endpoint?: string;
    /** Enable debug logging */
    debug?: boolean;
    /** Sample rate (0-1) */
    sampleRate?: number;
  } = {}
) {
  const { endpoint = '/api/performance/vitals', debug = false, sampleRate = 1 } = options;
  const reportedRef = useRef(false);
  
  useEffect(() => {
    if (reportedRef.current) return;
    if (Math.random() > sampleRate) return;
    
    const reportVitals = async () => {
      try {
        const { onCLS, onFID, onLCP, onFCP, onTTFB, onINP } = await import('web-vitals');
        
        const vitals: Record<string, number> = {};
        
        const sendVitals = () => {
          if (Object.keys(vitals).length === 0) return;
          
          const payload = {
            ...vitals,
            url: window.location.href,
            userAgent: navigator.userAgent,
            timestamp: Date.now(),
          };
          
          if (debug) {
            console.log('[WebVitals]', payload);
          }
          
          // Use sendBeacon for reliability
          navigator.sendBeacon(endpoint, JSON.stringify(payload));
          reportedRef.current = true;
        };
        
        onCLS((metric) => { vitals.cls = metric.value; });
        onFID((metric) => { vitals.fid = metric.value; });
        onLCP((metric) => { vitals.lcp = metric.value; });
        onFCP((metric) => { vitals.fcp = metric.value; });
        onTTFB((metric) => { vitals.ttfb = metric.value; });
        onINP((metric) => { vitals.inp = metric.value; });
        
        // Report on page hide
        const onVisibilityChange = () => {
          if (document.visibilityState === 'hidden') {
            sendVitals();
            document.removeEventListener('visibilitychange', onVisibilityChange);
          }
        };
        
        document.addEventListener('visibilitychange', onVisibilityChange);
        
        return () => {
          document.removeEventListener('visibilitychange', onVisibilityChange);
        };
      } catch (error) {
        if (debug) {
          console.error('[WebVitals] Failed to load web-vitals:', error);
        }
      }
    };
    
    reportVitals();
  }, [endpoint, debug, sampleRate]);
}

export default {
  preloadResource,
  prefetchResource,
  preconnect,
  useResourcePreload,
  useRoutePrefetch,
  useImagePreload,
  useWebVitalsReporter,
};