/**
 * LazyImage Component
 * Optimized image loading with lazy loading, blur placeholder, and error handling
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Spin } from '@arco-design/web-react';

export interface LazyImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  /** Image source URL */
  src: string;
  /** Placeholder source (shown while loading) */
  placeholderSrc?: string;
  /** Blur hash for placeholder */
  blurhash?: string;
  /** Width of the image */
  width?: number | string;
  /** Height of the image */
  height?: number | string;
  /** Alt text for accessibility */
  alt: string;
  /** Object fit style */
  objectFit?: 'contain' | 'cover' | 'fill' | 'none' | 'scale-down';
  /** Border radius */
  borderRadius?: number | string;
  /** Show loading spinner */
  showSpinner?: boolean;
  /** Background color while loading */
  backgroundColor?: string;
  /** Intersection observer root margin */
  rootMargin?: string;
  /** Intersection observer threshold */
  threshold?: number;
  /** Callback when image loads */
  onLoad?: () => void;
  /** Callback when image fails to load */
  onError?: () => void;
  /** Custom loading component */
  loadingComponent?: React.ReactNode;
  /** Custom error component */
  errorComponent?: React.ReactNode;
  /** Enable fade-in animation */
  fadeIn?: boolean;
  /** Fade-in duration in ms */
  fadeInDuration?: number;
}

/**
 * Lazy-loaded image component with optimized loading behavior
 */
export const LazyImage: React.FC<LazyImageProps> = ({
  src,
  placeholderSrc,
  blurhash,
  width,
  height,
  alt,
  objectFit = 'cover',
  borderRadius,
  showSpinner = true,
  backgroundColor = 'var(--color-fill-2)',
  rootMargin = '200px',
  threshold = 0.1,
  onLoad,
  onError,
  loadingComponent,
  errorComponent,
  fadeIn = true,
  fadeInDuration = 300,
  style,
  className,
  ...props
}) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isInView, setIsInView] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [currentSrc, setCurrentSrc] = useState<string | null>(null);
  const imgRef = useRef<HTMLDivElement>(null);

  // Generate blur placeholder style
  const blurPlaceholderStyle = blurhash
    ? {
        background: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 10 10'%3E%3Crect fill='${blurhash}' width='10' height='10'/%3E%3C/svg%3E")`,
        backgroundSize: 'cover',
        filter: 'blur(10px)',
      }
    : {};

  // Intersection observer for lazy loading
  useEffect(() => {
    const element = imgRef.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
          observer.unobserve(element);
        }
      },
      {
        rootMargin,
        threshold,
      }
    );

    observer.observe(element);

    return () => {
      observer.unobserve(element);
    };
  }, [rootMargin, threshold]);

  // Load image when in view
  useEffect(() => {
    if (!isInView || !src) return;

    const img = new Image();
    
    img.onload = () => {
      setCurrentSrc(src);
      setIsLoaded(true);
      onLoad?.();
    };
    
    img.onerror = () => {
      setHasError(true);
      onError?.();
    };
    
    img.src = src;
  }, [isInView, src, onLoad, onError]);

  // Handle load success
  const handleLoad = useCallback(() => {
    setIsLoaded(true);
    onLoad?.();
  }, [onLoad]);

  // Handle load error
  const handleError = useCallback(() => {
    setHasError(true);
    onError?.();
  }, [onError]);

  // Container style
  const containerStyle: React.CSSProperties = {
    position: 'relative',
    width: typeof width === 'number' ? `${width}px` : width,
    height: typeof height === 'number' ? `${height}px` : height,
    backgroundColor,
    borderRadius: typeof borderRadius === 'number' ? `${borderRadius}px` : borderRadius,
    overflow: 'hidden',
    ...style,
  };

  // Image style
  const imageStyle: React.CSSProperties = {
    width: '100%',
    height: '100%',
    objectFit,
    opacity: isLoaded && fadeIn ? 1 : 0,
    transition: fadeIn ? `opacity ${fadeInDuration}ms ease-in-out` : 'none',
  };

  // Loading state
  const renderLoading = () => {
    if (loadingComponent) return loadingComponent;
    if (placeholderSrc) {
      return (
        <img
          src={placeholderSrc}
          alt=""
          style={{
            ...imageStyle,
            opacity: 1,
            filter: 'blur(10px)',
          }}
        />
      );
    }
    if (showSpinner) {
      return (
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
          }}
        >
          <Spin size={24} />
        </div>
      );
    }
    return null;
  };

  // Error state
  const renderError = () => {
    if (errorComponent) return errorComponent;
    return (
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--color-text-3)',
          fontSize: 12,
        }}
      >
        加载失败
      </div>
    );
  };

  return (
    <div ref={imgRef} style={containerStyle} className={className}>
      {/* Blur placeholder */}
      {(blurhash || placeholderSrc) && !isLoaded && !hasError && (
        <div style={{ ...blurPlaceholderStyle, width: '100%', height: '100%' }} />
      )}

      {/* Loading state */}
      {!isLoaded && !hasError && renderLoading()}

      {/* Error state */}
      {hasError && renderError()}

      {/* Actual image */}
      {currentSrc && !hasError && (
        <img
          {...props}
          src={currentSrc}
          alt={alt}
          style={imageStyle}
          onLoad={handleLoad}
          onError={handleError}
          loading="lazy"
        />
      )}
    </div>
  );
};

/**
 * Responsive image component with srcset support
 */
export interface ResponsiveImageProps extends Omit<LazyImageProps, 'src'> {
  /** Image sources for different widths */
  sources: Array<{
    src: string;
    width: number;
    descriptor?: string;
  }>;
  /** Fallback source */
  fallbackSrc: string;
  /** Sizes attribute */
  sizes?: string;
}

export const ResponsiveImage: React.FC<ResponsiveImageProps> = ({
  sources,
  fallbackSrc,
  sizes,
  ...props
}) => {
  const srcSet = sources
    .map((s) => `${s.src} ${s.descriptor || `${s.width}w`}`)
    .join(', ');

  return (
    <picture>
      {sources.map((source, index) => (
        <source
          key={index}
          srcSet={source.src}
          media={`(min-width: ${source.width}px)`}
        />
      ))}
      <LazyImage {...props} src={fallbackSrc} />
    </picture>
  );
};

/**
 * Progressive image component with quality progression
 */
export interface ProgressiveImageProps extends LazyImageProps {
  /** Low quality image source */
  lowQualitySrc: string;
  /** High quality image source */
  highQualitySrc: string;
  /** Quality levels to load */
  qualityLevels?: Array<{
    src: string;
    quality: 'low' | 'medium' | 'high';
  }>;
}

export const ProgressiveImage: React.FC<ProgressiveImageProps> = ({
  lowQualitySrc,
  highQualitySrc,
  qualityLevels,
  ...props
}) => {
  const [currentSrc, setCurrentSrc] = useState(lowQualitySrc);
  const [loadedQuality, setLoadedQuality] = useState<'low' | 'medium' | 'high'>('low');

  useEffect(() => {
    // First load low quality immediately
    setCurrentSrc(lowQualitySrc);
    setLoadedQuality('low');

    // Then load high quality
    const img = new Image();
    img.onload = () => {
      setCurrentSrc(highQualitySrc);
      setLoadedQuality('high');
    };
    img.src = highQualitySrc;
  }, [lowQualitySrc, highQualitySrc]);

  // If custom quality levels are provided
  useEffect(() => {
    if (!qualityLevels || qualityLevels.length === 0) return;

    qualityLevels.forEach((level, index) => {
      if (index === 0) return; // Skip first level (already loaded)

      setTimeout(() => {
        const img = new Image();
        img.onload = () => {
          setCurrentSrc(level.src);
          setLoadedQuality(level.quality);
        };
        img.src = level.src;
      }, index * 500); // Stagger loading
    });
  }, [qualityLevels]);

  return (
    <LazyImage
      {...props}
      src={currentSrc}
      placeholderSrc={lowQualitySrc}
      fadeIn={loadedQuality !== 'low'}
    />
  );
};

export default LazyImage;