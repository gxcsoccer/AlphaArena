/**
 * Mobile Optimized Component Wrapper
 * 
 * Issue #631: Apply lazy loading optimizations to heavy components
 */

import React, { Suspense, lazy, useEffect, useState, useCallback } from 'react';
import { Spin, Empty } from '@arco-design/web-react';
import { LazyLoadWrapper } from './LazyLoadWrapper';
import { shouldPrefetch, getPrefetchDelay } from '../utils/dataPreload';

interface MobileOptimizedProps {
  children: React.ReactNode;
  /** Minimum height to prevent layout shift */
  minHeight?: number;
  /** Enable lazy loading on mobile */
  lazyOnMobile?: boolean;
  /** Enable prefetching */
  prefetch?: boolean;
  /** Placeholder while loading */
  placeholder?: React.ReactNode;
  /** Root margin for intersection observer */
  rootMargin?: string;
}

/**
 * Mobile Optimized Component Wrapper
 * Applies lazy loading and prefetching optimizations for mobile
 */
export const MobileOptimized: React.FC<MobileOptimizedProps> = ({
  children,
  minHeight = 200,
  lazyOnMobile = true,
  prefetch = true,
  placeholder,
  rootMargin = '200px',
}) => {
  const [isMobile, setIsMobile] = useState(false);
  const [isPrefetched, setIsPrefetched] = useState(false);

  useEffect(() => {
    setIsMobile(window.innerWidth <= 768);
  }, []);

  // Prefetch on hover/focus (desktop only)
  const handleMouseEnter = useCallback(() => {
    if (!isMobile && prefetch && !isPrefetched && shouldPrefetch()) {
      // Trigger prefetch
      setIsPrefetched(true);
    }
  }, [isMobile, prefetch, isPrefetched]);

  // If not mobile or lazy loading disabled, render directly
  if (!isMobile || !lazyOnMobile) {
    return <>{children}</>;
  }

  // Mobile: wrap with lazy loading
  return (
    <div onMouseEnter={handleMouseEnter} onFocus={handleMouseEnter}>
      <LazyLoadWrapper
        placeholder={placeholder || (
          <div style={{ minHeight, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Spin />
          </div>
        )}
        rootMargin={rootMargin}
        minHeight={minHeight}
      >
        {children}
      </LazyLoadWrapper>
    </div>
  );
};

/**
 * Create a lazy-loaded component with automatic chunk splitting
 */
export function createLazyComponent<T extends React.ComponentType<any>>(
  importFn: () => Promise<{ default: T }>,
  options: {
    fallback?: React.ReactNode;
    retryTimes?: number;
    retryDelay?: number;
  } = {}
) {
  const { fallback = <Spin />, retryTimes = 3, retryDelay = 1000 } = options;

  const LazyComponent = lazy(() => {
    let retries = 0;

    const load = async (): Promise<{ default: T }> => {
      try {
        return await importFn();
      } catch (error) {
        if (retries < retryTimes) {
          retries++;
          await new Promise(resolve => setTimeout(resolve, retryDelay));
          return load();
        }
        throw error;
      }
    };

    return load();
  });

  const WrappedComponent: React.FC<React.ComponentProps<T>> = (props) => (
    <Suspense fallback={fallback}>
      <LazyComponent {...props} />
    </Suspense>
  );

  WrappedComponent.displayName = `Lazy(${LazyComponent.displayName || 'Component'})`;

  return WrappedComponent;
}

/**
 * Intersection Observer Hook for Lazy Loading
 */
export function useIntersectionObserver(
  options: IntersectionObserverInit = {}
): [React.RefCallback<Element>, boolean] {
  const [isIntersecting, setIsIntersecting] = useState(false);
  const [element, setElement] = useState<Element | null>(null);

  useEffect(() => {
    if (!element) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsIntersecting(true);
          observer.unobserve(element);
        }
      },
      {
        threshold: 0.1,
        rootMargin: '100px',
        ...options,
      }
    );

    observer.observe(element);

    return () => {
      observer.unobserve(element);
    };
  }, [element, options]);

  return [setElement, isIntersecting];
}

/**
 * Deferred Render Component
 * Renders children after a delay to prioritize critical content
 */
export const DeferredRender: React.FC<{
  children: React.ReactNode;
  delay?: number;
  placeholder?: React.ReactNode;
}> = ({ children, delay = 100, placeholder = null }) => {
  const [shouldRender, setShouldRender] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setShouldRender(true);
    }, delay);

    return () => clearTimeout(timer);
  }, [delay]);

  if (!shouldRender) {
    return <>{placeholder}</>;
  }

  return <>{children}</>;
};

/**
 * Image Gallery with Lazy Loading
 * Optimized for mobile with progressive loading
 */
export const LazyImageGallery: React.FC<{
  images: Array<{ src: string; alt: string }>;
  columns?: number;
  gap?: number;
}> = ({ images, columns = 2, gap = 8 }) => {
  const [loadedImages, setLoadedImages] = useState<Set<string>>(new Set());

  const handleImageLoad = useCallback((src: string) => {
    setLoadedImages(prev => new Set(prev).add(src));
  }, []);

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${columns}, 1fr)`,
        gap: `${gap}px`,
      }}
    >
      {images.map((image, index) => (
        <LazyLoadWrapper
          key={image.src}
          rootMargin="100px"
          minHeight={200}
          placeholder={
            <div
              style={{
                width: '100%',
                paddingBottom: '100%',
                backgroundColor: 'var(--color-fill-2)',
                borderRadius: 4,
              }}
            />
          }
        >
          <img
            src={image.src}
            alt={image.alt}
            loading="lazy"
            onLoad={() => handleImageLoad(image.src)}
            style={{
              width: '100%',
              height: 'auto',
              display: 'block',
              opacity: loadedImages.has(image.src) ? 1 : 0,
              transition: 'opacity 0.3s ease',
              borderRadius: 4,
            }}
          />
        </LazyLoadWrapper>
      ))}
    </div>
  );
};

export default MobileOptimized;