/**
 * Lazy Load Wrapper Component
 * Provides intersection observer-based lazy loading for components
 */

import React, { useEffect, useRef, useState } from 'react';
import { Spin } from '@arco-design/web-react';
import { useIntersectionObserver } from '../utils/performance';

interface LazyLoadWrapperProps {
  children: React.ReactNode;
  /** Placeholder while loading */
  placeholder?: React.ReactNode;
  /** Root margin for intersection observer */
  rootMargin?: string;
  /** Threshold for intersection observer */
  threshold?: number | number[];
  /** Force load immediately */
  forceLoad?: boolean;
  /** Minimum height to prevent layout shift */
  minHeight?: number;
  /** On visible callback */
  onVisible?: () => void;
  /** Debounce delay in ms */
  debounceDelay?: number;
}

/**
 * LazyLoadWrapper Component
 * Renders children only when they come into view
 */
export const LazyLoadWrapper: React.FC<LazyLoadWrapperProps> = ({
  children,
  placeholder,
  rootMargin = '100px',
  threshold = 0.1,
  forceLoad = false,
  minHeight = 200,
  onVisible,
  debounceDelay = 0,
}) => {
  const [hasLoaded, setHasLoaded] = useState(forceLoad);
  const [ref, isIntersecting] = useIntersectionObserver({
    rootMargin,
    threshold: Array.isArray(threshold) ? threshold : [threshold],
  });
  const debounceTimerRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    if (forceLoad) {
      setHasLoaded(true);
      return;
    }

    if (isIntersecting && !hasLoaded) {
      if (debounceDelay > 0) {
        debounceTimerRef.current = setTimeout(() => {
          setHasLoaded(true);
          onVisible?.();
        }, debounceDelay);
      } else {
        setHasLoaded(true);
        onVisible?.();
      }
    }

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [isIntersecting, hasLoaded, forceLoad, onVisible, debounceDelay]);

  if (hasLoaded) {
    return <>{children}</>;
  }

  return (
    <div ref={ref as any} style={{ minHeight }}>
      {placeholder || (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight,
          }}
        >
          <Spin />
        </div>
      )}
    </div>
  );
};

/**
 * LazyComponent - Higher-order component for lazy loading
 */
export function withLazyLoad<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  options: Omit<LazyLoadWrapperProps, 'children'> = {}
) {
  const LazyComponent: React.FC<P> = (props) => (
    <LazyLoadWrapper {...options}>
      <WrappedComponent {...props} />
    </LazyLoadWrapper>
  );

  LazyComponent.displayName = `LazyLoad(${WrappedComponent.displayName || WrappedComponent.name || 'Component'})`;

  return LazyComponent;
}

/**
 * DeferredLoad Component
 * Defers loading using requestIdleCallback
 */
export const DeferredLoad: React.FC<{
  children: React.ReactNode;
  placeholder?: React.ReactNode;
  timeout?: number;
}> = ({ children, placeholder, timeout = 2000 }) => {
  const [shouldRender, setShouldRender] = useState(false);
  const timerRef = useRef<number>();

  useEffect(() => {
    if ('requestIdleCallback' in window) {
      timerRef.current = window.requestIdleCallback(
        () => {
          setShouldRender(true);
        },
        { timeout }
      );
    } else {
      // Fallback for browsers without requestIdleCallback
      timerRef.current = window.setTimeout(() => {
        setShouldRender(true);
      }, 100);
    }

    return () => {
      if (timerRef.current) {
        if ('cancelIdleCallback' in window) {
          window.cancelIdleCallback(timerRef.current);
        } else {
          clearTimeout(timerRef.current);
        }
      }
    };
  }, [timeout]);

  if (shouldRender) {
    return <>{children}</>;
  }

  return <>{placeholder}</>;
};

/**
 * ProgressiveLoad Component
 * Loads content progressively in chunks
 */
export const ProgressiveLoad: React.FC<{
  chunks: React.ReactNode[];
  delay?: number;
  placeholder?: React.ReactNode;
}> = ({ chunks, delay = 100, placeholder }) => {
  const [loadedChunks, setLoadedChunks] = useState<React.ReactNode[]>([]);

  useEffect(() => {
    let mounted = true;
    let index = 0;

    const loadNext = () => {
      if (!mounted || index >= chunks.length) return;

      setLoadedChunks((prev) => [...prev, chunks[index]]);
      index++;

      if (index < chunks.length) {
        setTimeout(loadNext, delay);
      }
    };

    // Start loading after initial render
    setTimeout(loadNext, delay);

    return () => {
      mounted = false;
    };
  }, [chunks, delay]);

  if (loadedChunks.length === 0 && placeholder) {
    return <>{placeholder}</>;
  }

  return <>{loadedChunks}</>;
};

/**
 * VisibilityTrigger Component
 * Triggers a callback when element becomes visible
 */
export const VisibilityTrigger: React.FC<{
  onVisible: () => void;
  children?: React.ReactNode;
  threshold?: number;
  rootMargin?: string;
  once?: boolean;
}> = ({ onVisible, children, threshold = 0.1, rootMargin = '0px', once = true }) => {
  const [hasTriggered, setHasTriggered] = useState(false);
  const [ref, isIntersecting] = useIntersectionObserver({
    rootMargin,
    threshold: [threshold],
  });

  useEffect(() => {
    if (isIntersecting && (!once || !hasTriggered)) {
      onVisible();
      if (once) {
        setHasTriggered(true);
      }
    }
  }, [isIntersecting, onVisible, once, hasTriggered]);

  return <div ref={ref as any}>{children}</div>;
};

/**
 * SkeletonWrapper Component
 * Shows skeleton while loading, then renders content
 */
export const SkeletonWrapper: React.FC<{
  loading: boolean;
  skeleton: React.ReactNode;
  children: React.ReactNode;
  /** Minimum time to show skeleton (prevents flash) */
  minLoadTime?: number;
}> = ({ loading, skeleton, children, minLoadTime = 0 }) => {
  const [showSkeleton, setShowSkeleton] = useState(loading);
  const loadStartTimeRef = useRef<number>(Date.now());

  useEffect(() => {
    if (loading) {
      loadStartTimeRef.current = Date.now();
      setShowSkeleton(true);
    } else {
      const elapsed = Date.now() - loadStartTimeRef.current;
      const remaining = minLoadTime - elapsed;

      if (remaining > 0) {
        setTimeout(() => {
          setShowSkeleton(false);
        }, remaining);
      } else {
        setShowSkeleton(false);
      }
    }
  }, [loading, minLoadTime]);

  if (showSkeleton) {
    return <>{skeleton}</>;
  }

  return <>{children}</>;
};

export default LazyLoadWrapper;