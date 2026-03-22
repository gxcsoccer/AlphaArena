/**
 * OptimizedImage Component
 * 
 * Issue #513: Performance Optimization
 * Provides lazy loading, placeholder, and optimized image loading.
 */

import React, { memo, useState, useCallback, useRef, useEffect } from 'react';

interface OptimizedImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  /** Image source URL */
  src: string;
  /** Placeholder blur data URL or solid color */
  placeholder?: string;
  /** Low quality image placeholder (LQIP) */
  lqip?: string;
  /** Loading strategy */
  loading?: 'lazy' | 'eager';
  /** Enable blur-up effect */
  blur?: boolean;
  /** Aspect ratio for layout stability (width/height) */
  aspectRatio?: number;
  /** Fallback image on error */
  fallback?: string;
  /** Maximum width */
  maxWidth?: number;
  /** Maximum height */
  maxHeight?: number;
  /** Enable intersection observer for custom lazy loading */
  useIntersectionObserver?: boolean;
  /** Root margin for intersection observer */
  rootMargin?: string;
  /** Threshold for intersection observer */
  threshold?: number;
}

/**
 * Optimized Image Component with lazy loading and blur-up effect
 */
const OptimizedImage: React.FC<OptimizedImageProps> = memo(({
  src,
  placeholder,
  lqip,
  loading = 'lazy',
  blur = true,
  aspectRatio,
  fallback,
  maxWidth,
  maxHeight,
  useIntersectionObserver = true,
  rootMargin = '200px',
  threshold = 0.1,
  alt = '',
  style,
  className,
  onLoad,
  onError,
  ...props
}) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [isVisible, setIsVisible] = useState(!useIntersectionObserver);
  const imgRef = useRef<HTMLImageElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  // Intersection observer for custom lazy loading
  useEffect(() => {
    if (!useIntersectionObserver || loading === 'eager') {
      setIsVisible(true);
      return;
    }

    const img = imgRef.current;
    if (!img) return;

    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsVisible(true);
            observerRef.current?.disconnect();
          }
        });
      },
      { rootMargin, threshold }
    );

    observerRef.current.observe(img);

    return () => {
      observerRef.current?.disconnect();
    };
  }, [useIntersectionObserver, loading, rootMargin, threshold]);

  // Handle image load
  const handleLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    setIsLoaded(true);
    onLoad?.(e);
  }, [onLoad]);

  // Handle image error
  const handleError = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    setHasError(true);
    onError?.(e);
  }, [onError]);

  // Determine which src to use
  const imageSrc = hasError && fallback ? fallback : (isVisible ? src : undefined);
  const showPlaceholder = !isLoaded || !isVisible;
  const placeholderSrc = lqip || placeholder || 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300"%3E%3Crect fill="%23f0f0f0" width="400" height="300"/%3E%3C/svg%3E';

  // Calculate container style for aspect ratio
  const containerStyle: React.CSSProperties = {
    position: 'relative',
    overflow: 'hidden',
    maxWidth: maxWidth ? `${maxWidth}px` : undefined,
    maxHeight: maxHeight ? `${maxHeight}px` : undefined,
    ...(aspectRatio && {
      paddingBottom: `${(1 / aspectRatio) * 100}%`,
    }),
    ...style,
  };

  // Image style with blur effect
  const imageStyle: React.CSSProperties = {
    display: 'block',
    width: '100%',
    height: aspectRatio ? '100%' : 'auto',
    objectFit: 'cover',
    transition: 'filter 0.3s ease, opacity 0.3s ease',
    ...(showPlaceholder && blur && { filter: 'blur(20px)' }),
    ...(aspectRatio && { position: 'absolute', top: 0, left: 0 }),
  };

  return (
    <div style={containerStyle} className={className}>
      {/* Placeholder */}
      {showPlaceholder && (
        <img
          src={placeholderSrc}
          alt={alt}
          style={{
            ...imageStyle,
            position: aspectRatio ? 'absolute' : 'relative',
            top: aspectRatio ? 0 : undefined,
            left: aspectRatio ? 0 : undefined,
          }}
          aria-hidden="true"
        />
      )}
      
      {/* Main image */}
      {isVisible && (
        <img
          ref={imgRef}
          src={imageSrc}
          alt={alt}
          loading={loading === 'lazy' && !useIntersectionObserver ? 'lazy' : undefined}
          onLoad={handleLoad}
          onError={handleError}
          style={{
            ...imageStyle,
            opacity: isLoaded ? 1 : 0,
          }}
          {...props}
        />
      )}
    </div>
  );
});

OptimizedImage.displayName = 'OptimizedImage';

/**
 * ResponsiveImage Component with srcset support
 */
interface ResponsiveImageProps extends OptimizedImageProps {
  /** Image sources with different widths */
  sources?: Array<{ src: string; width: number }>;
  /** Sizes attribute for responsive images */
  sizes?: string;
}

export const ResponsiveImage: React.FC<ResponsiveImageProps> = memo(({
  sources,
  sizes,
  ...props
}) => {
  // Generate srcSet from sources
  const srcSet = sources?.map(s => `${s.src} ${s.width}w`).join(', ');

  return (
    <OptimizedImage
      {...props}
      srcSet={srcSet}
      sizes={sizes}
    />
  );
});

ResponsiveImage.displayName = 'ResponsiveImage';

export default OptimizedImage;