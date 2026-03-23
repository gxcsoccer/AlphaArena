/**
 * useResourcePreload Hook
 * React hook for preloading resources with automatic cleanup
 */

import { useEffect, useCallback, useRef, useState } from 'react';
import {
  preloadImage,
  preloadScript,
  preloadCSS,
  prefetchPage,
  lazyLoadScript,
  lazyLoadCSS,
  preconnect,
} from '../utils/resourcePreload';

export interface PreloadOptions {
  /** Preload when component mounts */
  preloadOnMount?: boolean;
  /** Preload when hovering */
  preloadOnHover?: boolean;
  /** Preload when visible in viewport */
  preloadOnVisible?: boolean;
  /** Delay before preloading (ms) */
  delay?: number;
  /** Priority hint */
  priority?: 'high' | 'low' | 'auto';
}

/**
 * Hook for preloading a single image
 */
export function usePreloadImage(
  src: string | null,
  options: PreloadOptions = {}
): {
  isLoaded: boolean;
  error: Error | null;
  preload: () => void;
} {
  const { preloadOnMount = true, delay = 0 } = options;
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout>();

  const preload = useCallback(() => {
    if (!src) return;

    const doPreload = () => {
      const img = new Image();
      img.onload = () => {
        setIsLoaded(true);
        preloadImage(src);
      };
      img.onerror = () => {
        setError(new Error(`Failed to preload image: ${src}`));
      };
      img.src = src;
    };

    if (delay > 0) {
      timeoutRef.current = setTimeout(doPreload, delay);
    } else {
      doPreload();
    }
  }, [src, delay]);

  useEffect(() => {
    if (preloadOnMount && src) {
      preload();
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [preloadOnMount, preload, src]);

  return { isLoaded, error, preload };
}

/**
 * Hook for preloading multiple images
 */
export function usePreloadImages(
  sources: string[],
  options: PreloadOptions = {}
): {
  loadedCount: number;
  totalCount: number;
  progress: number;
  errors: Error[];
  preload: () => void;
} {
  const { preloadOnMount = true, delay = 0 } = options;
  const [loadedCount, setLoadedCount] = useState(0);
  const [errors, setErrors] = useState<Error[]>([]);
  const totalCount = sources.length;
  const progress = totalCount > 0 ? loadedCount / totalCount : 0;

  const preload = useCallback(() => {
    if (sources.length === 0) return;

    const doPreload = () => {
      sources.forEach((src) => {
        const img = new Image();
        img.onload = () => {
          setLoadedCount((prev) => prev + 1);
          preloadImage(src);
        };
        img.onerror = () => {
          setErrors((prev) => [...prev, new Error(`Failed to load: ${src}`)]);
        };
        img.src = src;
      });
    };

    if (delay > 0) {
      setTimeout(doPreload, delay);
    } else {
      doPreload();
    }
  }, [sources, delay]);

  useEffect(() => {
    if (preloadOnMount) {
      preload();
    }
  }, [preloadOnMount, preload]);

  return { loadedCount, totalCount, progress, errors, preload };
}

/**
 * Hook for preloading a script
 */
export function usePreloadScript(
  src: string | null,
  options: PreloadOptions = {}
): {
  isLoaded: boolean;
  error: Error | null;
  preload: () => Promise<void>;
} {
  const { preloadOnMount = false } = options;
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const loadedRef = useRef(false);

  const preload = useCallback(async () => {
    if (!src || loadedRef.current) return;

    try {
      await lazyLoadScript(src);
      setIsLoaded(true);
      loadedRef.current = true;
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to load script'));
    }
  }, [src]);

  useEffect(() => {
    if (preloadOnMount && src) {
      preload();
    }
  }, [preloadOnMount, preload, src]);

  return { isLoaded, error, preload };
}

/**
 * Hook for preloading CSS
 */
export function usePreloadCSS(
  href: string | null,
  options: PreloadOptions = {}
): {
  isLoaded: boolean;
  error: Error | null;
  preload: () => Promise<void>;
} {
  const { preloadOnMount = false } = options;
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const loadedRef = useRef(false);

  const preload = useCallback(async () => {
    if (!href || loadedRef.current) return;

    try {
      await lazyLoadCSS(href);
      setIsLoaded(true);
      loadedRef.current = true;
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to load CSS'));
    }
  }, [href]);

  useEffect(() => {
    if (preloadOnMount && href) {
      preload();
    }
  }, [preloadOnMount, preload, href]);

  return { isLoaded, error, preload };
}

/**
 * Hook for preloading a page on hover
 */
export function usePrefetchOnHover(
  href: string,
  options: { delay?: number } = {}
): {
  onMouseEnter: () => void;
  onTouchStart: () => void;
} {
  const { delay = 100 } = options;
  const timeoutRef = useRef<NodeJS.Timeout>();
  const prefetchedRef = useRef(false);

  const prefetch = useCallback(() => {
    if (prefetchedRef.current) return;
    prefetchedRef.current = true;
    prefetchPage(href);
  }, [href]);

  const handleMouseEnter = useCallback(() => {
    if (delay > 0) {
      timeoutRef.current = setTimeout(prefetch, delay);
    } else {
      prefetch();
    }
  }, [prefetch, delay]);

  const handleTouchStart = useCallback(() => {
    prefetch();
  }, [prefetch]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return {
    onMouseEnter: handleMouseEnter,
    onTouchStart: handleTouchStart,
  };
}

/**
 * Hook for preloading on viewport visibility
 */
export function usePreloadOnVisible<T extends HTMLElement>(
  options: IntersectionObserverInit = {}
): {
  ref: React.RefObject<T>;
  isVisible: boolean;
  hasBeenVisible: boolean;
} {
  const [isVisible, setIsVisible] = useState(false);
  const [hasBeenVisible, setHasBeenVisible] = useState(false);
  const ref = useRef<T>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsVisible(entry.isIntersecting);
        if (entry.isIntersecting) {
          setHasBeenVisible(true);
        }
      },
      { threshold: 0.1, ...options }
    );

    observer.observe(element);

    return () => {
      observer.unobserve(element);
    };
  }, [options]);

  return { ref, isVisible, hasBeenVisible };
}

/**
 * Hook for preconnecting to domains
 */
export function usePreconnect(
  origins: string[],
  options: { enabled?: boolean } = {}
): void {
  const { enabled = true } = options;

  useEffect(() => {
    if (!enabled) return;

    origins.forEach((origin) => {
      preconnect(origin);
    });
  }, [origins, enabled]);
}

/**
 * Hook for resource preload queue
 * Manages a queue of resources to preload with priority
 */
export function usePreloadQueue(): {
  add: (resources: { type: 'image' | 'script' | 'css'; src: string }[]) => void;
  flush: () => void;
  clear: () => void;
  pending: number;
} {
  const queueRef = useRef<Array<{ type: 'image' | 'script' | 'css'; src: string }>>([]);
  const [pending, setPending] = useState(0);

  const add = useCallback(
    (resources: { type: 'image' | 'script' | 'css'; src: string }[]) => {
      queueRef.current.push(...resources);
      setPending(queueRef.current.length);
    },
    []
  );

  const flush = useCallback(() => {
    const items = [...queueRef.current];
    queueRef.current = [];
    setPending(0);

    // Process items with requestIdleCallback for better performance
    const processItem = (index: number) => {
      if (index >= items.length) return;

      const item = items[index];
      switch (item.type) {
        case 'image':
          preloadImage(item.src);
          break;
        case 'script':
          preloadScript(item.src);
          break;
        case 'css':
          preloadCSS(item.src);
          break;
      }

      // Use requestIdleCallback if available
      if ('requestIdleCallback' in window) {
        requestIdleCallback(() => processItem(index + 1));
      } else {
        setTimeout(() => processItem(index + 1), 0);
      }
    };

    processItem(0);
  }, []);

  const clear = useCallback(() => {
    queueRef.current = [];
    setPending(0);
  }, []);

  return { add, flush, clear, pending };
}

export default {
  usePreloadImage,
  usePreloadImages,
  usePreloadScript,
  usePreloadCSS,
  usePrefetchOnHover,
  usePreloadOnVisible,
  usePreconnect,
  usePreloadQueue,
};