/**
 * Picture Component
 * 
 * Issue #559: Image and Static Resource Optimization
 * 
 * Features:
 * - WebP/AVIF format support with fallbacks
 * - Responsive images with srcset
 * - Lazy loading with intersection observer
 * - Blur placeholder support
 * - CDN URL generation
 */

import React, { useState, useRef, useEffect, memo, useMemo } from 'react';

/**
 * Image format types
 */
export type ImageFormat = 'original' | 'webp' | 'avif';

/**
 * Responsive image breakpoint
 */
export interface ImageBreakpoint {
  /** Screen width breakpoint */
  width: number;
  /** Image width at this breakpoint */
  imageWidth?: number;
  /** Descriptor for srcset (e.g., '2x' or '500w') */
  descriptor?: string;
}

/**
 * Picture component props
 */
export interface PictureProps {
  /** Image source URL */
  src: string;
  /** Alt text for accessibility */
  alt: string;
  /** Image width */
  width?: number | string;
  /** Image height */
  height?: number | string;
  /** Responsive breakpoints */
  breakpoints?: ImageBreakpoint[];
  /** Image formats to generate/use */
  formats?: ImageFormat[];
  /** Object fit style */
  objectFit?: 'contain' | 'cover' | 'fill' | 'none' | 'scale-down';
  /** Object position */
  objectPosition?: string;
  /** Border radius */
  borderRadius?: number | string;
  /** Placeholder blur data URL */
  placeholder?: string;
  /** Low quality image placeholder (LQIP) */
  lqip?: string;
  /** Loading strategy */
  loading?: 'lazy' | 'eager';
  /** Enable intersection observer for lazy loading */
  useIntersectionObserver?: boolean;
  /** Root margin for intersection observer */
  rootMargin?: string;
  /** Threshold for intersection observer */
  threshold?: number;
  /** Fallback image on error */
  fallback?: string;
  /** Background color while loading */
  backgroundColor?: string;
  /** Enable fade-in animation */
  fadeIn?: boolean;
  /** Fade-in duration in ms */
  fadeInDuration?: number;
  /** CDN base URL for image optimization */
  cdnBaseUrl?: string;
  /** Enable responsive images */
  responsive?: boolean;
  /** Sizes attribute for responsive images */
  sizes?: string;
  /** Aspect ratio for layout stability (width/height) */
  aspectRatio?: number;
  /** Additional class name */
  className?: string;
  /** Additional styles */
  style?: React.CSSProperties;
  /** onLoad callback */
  onLoad?: () => void;
  /** onError callback */
  onError?: () => void;
}

/**
 * Default CDN configuration
 */
const DEFAULT_CDN_BASE_URL = '';

/**
 * Check if WebP is supported
 */
function checkWebpSupport(): boolean {
  if (typeof document === 'undefined') return true;
  
  const canvas = document.createElement('canvas');
  if (canvas.getContext && canvas.getContext('2d')) {
    return canvas.toDataURL('image/webp').indexOf('data:image/webp') === 0;
  }
  return false;
}

/**
 * Check if AVIF is supported
 */
function checkAvifSupport(): boolean {
  if (typeof document === 'undefined') return false;
  
  const canvas = document.createElement('canvas');
  if (canvas.getContext && canvas.getContext('2d')) {
    return canvas.toDataURL('image/avif').indexOf('data:image/avif') === 0;
  }
  return false;
}

/**
 * Generate optimized image URL with format conversion
 */
function generateImageUrl(
  src: string,
  format: ImageFormat,
  width?: number,
  cdnBaseUrl?: string
): string {
  // If already an absolute URL, don't modify
  if (src.startsWith('http://') || src.startsWith('https://') || src.startsWith('data:')) {
    if (format === 'original' || !cdnBaseUrl) {
      return src;
    }
    
    // Use CDN URL with format parameter
    try {
      const url = new URL(src, window.location.origin);
      url.searchParams.set('format', format);
      if (width) {
        url.searchParams.set('width', String(width));
      }
      return url.toString();
    } catch {
      return src;
    }
  }
  
  // For local images, use Vite's image optimization
  if (format === 'original') {
    return src;
  }
  
  // Construct URL with format query param for Vite imagetools
  const separator = src.includes('?') ? '&' : '?';
  let url = `${src}${separator}format=${format}`;
  if (width) {
    url += `&width=${width}`;
  }
  
  return url;
}

/**
 * Generate srcset string for responsive images
 */
function generateSrcSet(
  src: string,
  breakpoints: ImageBreakpoint[],
  format: ImageFormat,
  cdnBaseUrl?: string
): string {
  return breakpoints
    .map((bp) => {
      const width = bp.imageWidth || bp.width;
      const url = generateImageUrl(src, format, width, cdnBaseUrl);
      const descriptor = bp.descriptor || `${width}w`;
      return `${url} ${descriptor}`;
    })
    .join(', ');
}

/**
 * Picture Component with WebP/AVIF support and responsive images
 */
export const Picture: React.FC<PictureProps> = memo(({
  src,
  alt,
  width,
  height,
  breakpoints,
  formats = ['webp', 'original'],
  objectFit = 'cover',
  objectPosition = 'center',
  borderRadius,
  placeholder,
  lqip,
  loading = 'lazy',
  useIntersectionObserver = true,
  rootMargin = '200px',
  threshold = 0.1,
  fallback,
  backgroundColor = 'var(--color-fill-2, #f0f0f0)',
  fadeIn = true,
  fadeInDuration = 300,
  cdnBaseUrl = DEFAULT_CDN_BASE_URL,
  responsive = true,
  sizes,
  aspectRatio,
  className,
  style,
  onLoad,
  onError,
}) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [isVisible, setIsVisible] = useState(!useIntersectionObserver || loading === 'eager');
  const [supportsWebp, setSupportsWebp] = useState(true);
  const [supportsAvif, setSupportsAvif] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  // Check format support on mount
  useEffect(() => {
    setSupportsWebp(checkWebpSupport());
    setSupportsAvif(checkAvifSupport());
  }, []);

  // Intersection observer for lazy loading
  useEffect(() => {
    if (!useIntersectionObserver || loading === 'eager') {
      setIsVisible(true);
      return;
    }

    const container = containerRef.current;
    if (!container) return;

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

    observerRef.current.observe(container);

    return () => {
      observerRef.current?.disconnect();
    };
  }, [useIntersectionObserver, loading, rootMargin, threshold]);

  // Handle image load
  const handleLoad = () => {
    setIsLoaded(true);
    onLoad?.();
  };

  // Handle image error
  const handleError = () => {
    setHasError(true);
    onError?.();
  };

  // Filter formats based on browser support
  const supportedFormats = useMemo(() => {
    return formats.filter((format) => {
      if (format === 'avif') return supportsAvif;
      if (format === 'webp') return supportsWebp;
      return true;
    });
  }, [formats, supportsWebp, supportsAvif]);

  // Generate sources for picture element
  const sources = useMemo(() => {
    if (!isVisible || !responsive) return [];

    return supportedFormats
      .filter((format) => format !== 'original')
      .map((format) => ({
        format,
        srcSet: breakpoints
          ? generateSrcSet(src, breakpoints, format, cdnBaseUrl)
          : generateImageUrl(src, format, undefined, cdnBaseUrl),
        type: `image/${format}`,
      }));
  }, [isVisible, responsive, supportedFormats, src, breakpoints, cdnBaseUrl]);

  // Generate srcset for img element
  const imgSrcSet = useMemo(() => {
    if (!isVisible || !responsive || !breakpoints) return undefined;
    return generateSrcSet(src, breakpoints, 'original', cdnBaseUrl);
  }, [isVisible, responsive, src, breakpoints, cdnBaseUrl]);

  // Current image source
  const currentSrc = useMemo(() => {
    if (hasError && fallback) return fallback;
    if (!isVisible) return placeholder || lqip || '';
    return src;
  }, [hasError, fallback, isVisible, src, placeholder, lqip]);

  // Placeholder to show while loading
  const placeholderSrc = lqip || placeholder || 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300"%3E%3Crect fill="%23f0f0f0" width="400" height="300"/%3E%3C/svg%3E';

  // Container style
  const containerStyle: React.CSSProperties = {
    position: 'relative',
    overflow: 'hidden',
    width: typeof width === 'number' ? `${width}px` : width,
    height: typeof height === 'number' ? `${height}px` : height,
    borderRadius: typeof borderRadius === 'number' ? `${borderRadius}px` : borderRadius,
    backgroundColor,
    ...(aspectRatio && {
      paddingBottom: `${(1 / aspectRatio) * 100}%`,
      height: height ? (typeof height === 'number' ? `${height}px` : height) : 0,
    }),
    ...style,
  };

  // Image style
  const imageStyle: React.CSSProperties = {
    display: 'block',
    width: '100%',
    height: aspectRatio ? '100%' : 'auto',
    objectFit,
    objectPosition,
    transition: fadeIn ? `opacity ${fadeInDuration}ms ease-in-out` : 'none',
    opacity: isLoaded ? 1 : 0,
    ...(aspectRatio && { position: 'absolute', top: 0, left: 0 }),
  };

  // Placeholder style
  const placeholderStyle: React.CSSProperties = {
    ...imageStyle,
    opacity: 1,
    filter: 'blur(10px)',
  };

  // Generate sizes attribute
  const sizesAttr = useMemo(() => {
    if (sizes) return sizes;
    if (!breakpoints) return undefined;
    return breakpoints
      .map((bp, i, arr) => {
        const isLast = i === arr.length - 1;
        return isLast ? `${bp.width}px` : `(max-width: ${bp.width}px) ${bp.width}px`;
      })
      .join(', ');
  }, [sizes, breakpoints]);

  return (
    <div ref={containerRef} style={containerStyle} className={className}>
      {/* Placeholder */}
      {!isLoaded && !hasError && (
        <img
          src={placeholderSrc}
          alt=""
          style={placeholderStyle}
          aria-hidden="true"
        />
      )}

      {/* Picture element with format fallbacks */}
      {isVisible && !hasError && (
        <picture>
          {/* Generate source elements for each format */}
          {sources.map((source, index) => (
            <source
              key={`${source.format}-${index}`}
              srcSet={source.srcSet}
              type={source.type}
              sizes={sizesAttr}
            />
          ))}
          
          {/* Fallback img element */}
          <img
            ref={imgRef}
            src={currentSrc}
            srcSet={imgSrcSet}
            sizes={sizesAttr}
            alt={alt}
            loading={loading === 'lazy' && !useIntersectionObserver ? 'lazy' : undefined}
            decoding="async"
            onLoad={handleLoad}
            onError={handleError}
            style={imageStyle}
            width={typeof width === 'number' ? width : undefined}
            height={typeof height === 'number' ? height : undefined}
          />
        </picture>
      )}

      {/* Error state */}
      {hasError && fallback && (
        <img
          src={fallback}
          alt={alt}
          style={{ ...imageStyle, opacity: 1 }}
          width={typeof width === 'number' ? width : undefined}
          height={typeof height === 'number' ? height : undefined}
        />
      )}
    </div>
  );
});

Picture.displayName = 'Picture';

/**
 * Default image breakpoints for responsive images
 */
export const DEFAULT_BREAKPOINTS: ImageBreakpoint[] = [
  { width: 320, imageWidth: 320, descriptor: '320w' },
  { width: 480, imageWidth: 480, descriptor: '480w' },
  { width: 768, imageWidth: 768, descriptor: '768w' },
  { width: 1024, imageWidth: 1024, descriptor: '1024w' },
  { width: 1280, imageWidth: 1280, descriptor: '1280w' },
  { width: 1920, imageWidth: 1920, descriptor: '1920w' },
];

/**
 * Mobile-optimized breakpoints
 */
export const MOBILE_BREAKPOINTS: ImageBreakpoint[] = [
  { width: 320, imageWidth: 320, descriptor: '320w' },
  { width: 480, imageWidth: 480, descriptor: '480w' },
  { width: 640, imageWidth: 640, descriptor: '640w' },
];

/**
 * Thumbnail breakpoints for small images
 */
export const THUMBNAIL_BREAKPOINTS: ImageBreakpoint[] = [
  { width: 100, imageWidth: 100, descriptor: '100w' },
  { width: 200, imageWidth: 200, descriptor: '200w' },
  { width: 300, imageWidth: 300, descriptor: '300w' },
];

/**
 * Avatar breakpoints for profile images
 */
export const AVATAR_BREAKPOINTS: ImageBreakpoint[] = [
  { width: 40, imageWidth: 40, descriptor: '1x' },
  { width: 80, imageWidth: 80, descriptor: '2x' },
  { width: 120, imageWidth: 120, descriptor: '3x' },
];

export default Picture;