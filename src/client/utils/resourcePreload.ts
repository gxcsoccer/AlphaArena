/**
 * Resource Preloading Utilities
 * Optimizes critical resource loading for better performance
 */

/**
 * Preload a critical CSS file
 */
export function preloadCSS(href: string): void {
  if (typeof document === 'undefined') return;
  
  const link = document.createElement('link');
  link.rel = 'preload';
  link.as = 'style';
  link.href = href;
  document.head.appendChild(link);
  
  // Convert to stylesheet after preload
  link.onload = () => {
    link.rel = 'stylesheet';
  };
}

/**
 * Preload a critical JavaScript file
 */
export function preloadScript(href: string, crossOrigin?: boolean): void {
  if (typeof document === 'undefined') return;
  
  const link = document.createElement('link');
  link.rel = 'preload';
  link.as = 'script';
  link.href = href;
  if (crossOrigin) {
    link.crossOrigin = 'anonymous';
  }
  document.head.appendChild(link);
}

/**
 * Preload a font
 */
export function preloadFont(
  href: string,
  type: string = 'font/woff2',
  crossOrigin: boolean = true
): void {
  if (typeof document === 'undefined') return;
  
  const link = document.createElement('link');
  link.rel = 'preload';
  link.as = 'font';
  link.type = type;
  link.href = href;
  if (crossOrigin) {
    link.crossOrigin = 'anonymous';
  }
  document.head.appendChild(link);
}

/**
 * Preload an image
 */
export function preloadImage(
  href: string,
  as: string = 'image'
): void {
  if (typeof document === 'undefined') return;
  
  const link = document.createElement('link');
  link.rel = 'preload';
  link.as = as;
  link.href = href;
  document.head.appendChild(link);
}

/**
 * Preconnect to a domain
 */
export function preconnect(href: string, crossOrigin: boolean = false): void {
  if (typeof document === 'undefined') return;
  
  const link = document.createElement('link');
  link.rel = 'preconnect';
  link.href = href;
  if (crossOrigin) {
    link.crossOrigin = 'anonymous';
  }
  document.head.appendChild(link);
}

/**
 * DNS prefetch for domains that will be used
 */
export function dnsPrefetch(href: string): void {
  if (typeof document === 'undefined') return;
  
  const link = document.createElement('link');
  link.rel = 'dns-prefetch';
  link.href = href;
  document.head.appendChild(link);
}

/**
 * Prefetch a page for faster navigation
 */
export function prefetchPage(href: string): void {
  if (typeof document === 'undefined') return;
  
  const link = document.createElement('link');
  link.rel = 'prefetch';
  link.href = href;
  document.head.appendChild(link);
}

/**
 * Module preload for ES modules
 */
export function preloadModule(href: string, crossOrigin?: boolean): void {
  if (typeof document === 'undefined') return;
  
  const link = document.createElement('link');
  link.rel = 'modulepreload';
  link.href = href;
  if (crossOrigin) {
    link.crossOrigin = 'anonymous';
  }
  document.head.appendChild(link);
}

/**
 * Initialize critical resource preloading
 * Call this early in app initialization
 */
export function initCriticalPreloading(): void {
  if (typeof document === 'undefined') return;
  
  // Preconnect to API and CDN domains
  const apiUrls = import.meta.env.VITE_API_URL;
  if (apiUrls) {
    try {
      const url = new URL(apiUrls);
      preconnect(url.origin);
    } catch {
      // Invalid URL, skip
    }
  }
  
  // Preconnect to common CDN domains
  preconnect('https://fonts.googleapis.com');
  preconnect('https://fonts.gstatic.com', true);
  
  // Preload critical fonts if using custom fonts
  // Example: preloadFont('/fonts/custom-font.woff2');
  
  // DNS prefetch for analytics and other services
  dnsPrefetch('https://www.googletagmanager.com');
}

/**
 * Lazy load a script dynamically
 */
export function lazyLoadScript(
  src: string,
  options: {
    async?: boolean;
    defer?: boolean;
    crossOrigin?: boolean;
    onLoad?: () => void;
    onError?: (error: Error) => void;
  } = {}
): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof document === 'undefined') {
      reject(new Error('Document not available'));
      return;
    }
    
    // Check if script already exists
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) {
      resolve();
      return;
    }
    
    const script = document.createElement('script');
    script.src = src;
    if (options.async !== false) script.async = true;
    if (options.defer) script.defer = true;
    if (options.crossOrigin) script.crossOrigin = 'anonymous';
    
    script.onload = () => {
      options.onLoad?.();
      resolve();
    };
    
    script.onerror = () => {
      const error = new Error(`Failed to load script: ${src}`);
      options.onError?.(error);
      reject(error);
    };
    
    document.head.appendChild(script);
  });
}

/**
 * Lazy load CSS dynamically
 */
export function lazyLoadCSS(href: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof document === 'undefined') {
      reject(new Error('Document not available'));
      return;
    }
    
    // Check if stylesheet already exists
    const existing = document.querySelector(`link[href="${href}"]`);
    if (existing) {
      resolve();
      return;
    }
    
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    
    link.onload = () => resolve();
    link.onerror = () => reject(new Error(`Failed to load CSS: ${href}`));
    
    document.head.appendChild(link);
  });
}

/**
 * Check if a resource is already cached
 */
export function isResourceCached(url: string): boolean {
  if (typeof window === 'undefined' || !('caches' in window)) {
    return false;
  }
  
  // Use Cache API to check if resource is cached
  return caches.match(url).then((response) => !!response).catch(() => false) as unknown as boolean;
}

/**
 * Resource hints configuration
 */
export interface ResourceHintsConfig {
  preconnect?: string[];
  dnsPrefetch?: string[];
  prefetch?: string[];
  preload?: {
    fonts?: string[];
    images?: string[];
    scripts?: string[];
    styles?: string[];
  };
}

/**
 * Apply resource hints configuration
 */
export function applyResourceHints(config: ResourceHintsConfig): void {
  if (typeof document === 'undefined') return;
  
  // Apply preconnect hints
  config.preconnect?.forEach((href) => {
    preconnect(href);
  });
  
  // Apply DNS prefetch hints
  config.dnsPrefetch?.forEach((href) => {
    dnsPrefetch(href);
  });
  
  // Apply prefetch hints
  config.prefetch?.forEach((href) => {
    prefetchPage(href);
  });
  
  // Apply preload hints
  config.preload?.fonts?.forEach((href) => {
    preloadFont(href);
  });
  
  config.preload?.images?.forEach((href) => {
    preloadImage(href);
  });
  
  config.preload?.scripts?.forEach((href) => {
    preloadScript(href);
  });
  
  config.preload?.styles?.forEach((href) => {
    preloadCSS(href);
  });
}

export default {
  preloadCSS,
  preloadScript,
  preloadFont,
  preloadImage,
  preloadModule,
  preconnect,
  dnsPrefetch,
  prefetchPage,
  initCriticalPreloading,
  lazyLoadScript,
  lazyLoadCSS,
  isResourceCached,
  applyResourceHints,
};