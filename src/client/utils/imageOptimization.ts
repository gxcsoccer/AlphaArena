/**
 * Image Optimization Utilities
 * 
 * Issue #559: Image and Static Resource Optimization
 * 
 * Provides utilities for:
 * - WebP/AVIF format detection
 * - Responsive image generation
 * - CDN URL construction
 * - Blur placeholder generation
 */

import type { ImageBreakpoint, ImageFormat } from '../components/Picture';

/**
 * Check browser support for WebP
 */
export function supportsWebp(): boolean {
  if (typeof document === 'undefined') return true;
  
  try {
    const canvas = document.createElement('canvas');
    if (canvas.getContext && canvas.getContext('2d')) {
      return canvas.toDataURL('image/webp').indexOf('data:image/webp') === 0;
    }
  } catch {
    // Canvas not supported
  }
  return false;
}

/**
 * Check browser support for AVIF
 */
export function supportsAvif(): boolean {
  if (typeof document === 'undefined') return false;
  
  try {
    const canvas = document.createElement('canvas');
    if (canvas.getContext && canvas.getContext('2d')) {
      return canvas.toDataURL('image/avif').indexOf('data:image/avif') === 0;
    }
  } catch {
    // Canvas not supported
  }
  return false;
}

/**
 * Get the best supported image format
 */
export function getBestSupportedFormat(): ImageFormat {
  if (supportsAvif()) return 'avif';
  if (supportsWebp()) return 'webp';
  return 'original';
}

/**
 * Check if image URL is from CDN
 */
export function isCdnUrl(url: string, cdnDomains: string[] = []): boolean {
  if (!url.startsWith('http')) return false;
  
  try {
    const urlObj = new URL(url);
    return cdnDomains.some(domain => urlObj.hostname.includes(domain));
  } catch {
    return false;
  }
}

/**
 * Generate optimized image URL with format and size parameters
 */
export function getOptimizedImageUrl(
  src: string,
  options: {
    width?: number;
    height?: number;
    format?: ImageFormat;
    quality?: number;
    cdnBaseUrl?: string;
  } = {}
): string {
  const { width, height, format = 'webp', quality = 80, cdnBaseUrl } = options;

  // Don't modify data URLs
  if (src.startsWith('data:')) return src;

  // Build URL with optimization parameters
  const url = new URL(src, window?.location?.origin || 'http://localhost');
  
  // Add optimization parameters
  if (format !== 'original') {
    url.searchParams.set('format', format);
  }
  
  if (width) {
    url.searchParams.set('width', String(width));
  }
  
  if (height) {
    url.searchParams.set('height', String(height));
  }
  
  if (quality !== 80) {
    url.searchParams.set('quality', String(quality));
  }

  // If CDN base URL is provided, rewrite the URL
  if (cdnBaseUrl && !src.startsWith('http')) {
    const cdnUrl = new URL(cdnBaseUrl);
    url.hostname = cdnUrl.hostname;
    url.protocol = cdnUrl.protocol;
  }

  return url.toString();
}

/**
 * Generate srcset string from breakpoints
 */
export function generateSrcSet(
  src: string,
  breakpoints: ImageBreakpoint[],
  options: {
    format?: ImageFormat;
    quality?: number;
    cdnBaseUrl?: string;
  } = {}
): string {
  const { format = 'webp', quality = 80, cdnBaseUrl } = options;

  return breakpoints
    .map((bp) => {
      const width = bp.imageWidth || bp.width;
      const optimizedUrl = getOptimizedImageUrl(src, {
        width,
        format,
        quality,
        cdnBaseUrl,
      });
      const descriptor = bp.descriptor || `${width}w`;
      return `${optimizedUrl} ${descriptor}`;
    })
    .join(', ');
}

/**
 * Generate sizes attribute from breakpoints
 */
export function generateSizes(
  breakpoints: ImageBreakpoint[],
  defaultSize?: string
): string {
  const sortedBreakpoints = [...breakpoints].sort((a, b) => a.width - b.width);
  
  return sortedBreakpoints
    .map((bp, index) => {
      if (index === sortedBreakpoints.length - 1) {
        return `${bp.width}px`;
      }
      return `(max-width: ${bp.width}px) ${bp.width}px`;
    })
    .join(', ') || defaultSize || '100vw';
}

/**
 * Generate a simple blur placeholder
 */
export function generateBlurPlaceholder(
  width: number = 10,
  height: number = 10,
  color: string = '#f0f0f0'
): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}">
    <rect fill="${color}" width="${width}" height="${height}"/>
  </svg>`;
  
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

/**
 * Generate a gradient blur placeholder
 */
export function generateGradientPlaceholder(
  width: number = 10,
  height: number = 10,
  colors: string[] = ['#f0f0f0', '#e0e0e0']
): string {
  const gradientStops = colors
    .map((color, index) => {
      const offset = (index / (colors.length - 1)) * 100;
      return `<stop offset="${offset}%" stop-color="${color}"/>`;
    })
    .join('');

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}">
    <defs>
      <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
        ${gradientStops}
      </linearGradient>
    </defs>
    <rect fill="url(#g)" width="${width}" height="${height}"/>
  </svg>`;
  
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

/**
 * Calculate aspect ratio from dimensions
 */
export function calculateAspectRatio(width: number, height: number): number {
  return width / height;
}

/**
 * Calculate height from width and aspect ratio
 */
export function calculateHeight(width: number, aspectRatio: number): number {
  return Math.round(width / aspectRatio);
}

/**
 * Calculate width from height and aspect ratio
 */
export function calculateWidth(height: number, aspectRatio: number): number {
  return Math.round(height * aspectRatio);
}

/**
 * Image size presets
 */
export const IMAGE_PRESETS = {
  thumbnail: {
    breakpoints: [
      { width: 100, imageWidth: 100, descriptor: '100w' },
      { width: 200, imageWidth: 200, descriptor: '200w' },
      { width: 300, imageWidth: 300, descriptor: '300w' },
    ] as ImageBreakpoint[],
    sizes: '(max-width: 200px) 200px, (max-width: 300px) 300px, 100px',
  },
  avatar: {
    breakpoints: [
      { width: 40, imageWidth: 40, descriptor: '1x' },
      { width: 80, imageWidth: 80, descriptor: '2x' },
      { width: 120, imageWidth: 120, descriptor: '3x' },
    ] as ImageBreakpoint[],
    sizes: '40px',
  },
  hero: {
    breakpoints: [
      { width: 640, imageWidth: 640, descriptor: '640w' },
      { width: 768, imageWidth: 768, descriptor: '768w' },
      { width: 1024, imageWidth: 1024, descriptor: '1024w' },
      { width: 1280, imageWidth: 1280, descriptor: '1280w' },
      { width: 1920, imageWidth: 1920, descriptor: '1920w' },
    ] as ImageBreakpoint[],
    sizes: '100vw',
  },
  card: {
    breakpoints: [
      { width: 320, imageWidth: 320, descriptor: '320w' },
      { width: 480, imageWidth: 480, descriptor: '480w' },
      { width: 640, imageWidth: 640, descriptor: '640w' },
    ] as ImageBreakpoint[],
    sizes: '(max-width: 480px) 320px, (max-width: 768px) 480px, 640px',
  },
} as const;

/**
 * Preload an image
 */
export function preloadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

/**
 * Batch preload images
 */
export async function preloadImages(
  srcs: string[],
  options: { concurrency?: number } = {}
): Promise<HTMLImageElement[]> {
  const { concurrency = 4 } = options;
  const results: HTMLImageElement[] = [];

  for (let i = 0; i < srcs.length; i += concurrency) {
    const batch = srcs.slice(i, i + concurrency);
    const batchResults = await Promise.all(batch.map(preloadImage));
    results.push(...batchResults);
  }

  return results;
}

export default {
  supportsWebp,
  supportsAvif,
  getBestSupportedFormat,
  isCdnUrl,
  getOptimizedImageUrl,
  generateSrcSet,
  generateSizes,
  generateBlurPlaceholder,
  generateGradientPlaceholder,
  calculateAspectRatio,
  calculateHeight,
  calculateWidth,
  IMAGE_PRESETS,
  preloadImage,
  preloadImages,
};