/**
 * Service Worker for AlphaArena
 * 
 * Issue #559: Image and Static Resource Optimization
 * 
 * Caching strategies:
 * - Static assets (JS, CSS): Cache-first with long TTL
 * - Images: Cache-first with stale-while-revalidate
 * - Fonts: Cache-first with long TTL
 * - API calls: Network-first with cache fallback
 */

/// <reference lib="webworker" />

const CACHE_NAME = 'alphaarena-v1';
const STATIC_CACHE_NAME = 'alphaarena-static-v1';
const IMAGE_CACHE_NAME = 'alphaarena-images-v1';
const FONT_CACHE_NAME = 'alphaarena-fonts-v1';
const API_CACHE_NAME = 'alphaarena-api-v1';

// Cache durations (in seconds)
const CACHE_DURATION = {
  static: 365 * 24 * 60 * 60, // 1 year
  image: 30 * 24 * 60 * 60,   // 30 days
  font: 365 * 24 * 60 * 60,   // 1 year
  api: 5 * 60,                // 5 minutes
};

// Static assets to cache on install
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
];

// Patterns for different resource types
const STATIC_PATTERNS = [
  /\.js$/,
  /\.css$/,
  /\/assets\//,
];

const IMAGE_PATTERNS = [
  /\.png$/,
  /\.jpg$/,
  /\.jpeg$/,
  /\.gif$/,
  /\.webp$/,
  /\.avif$/,
  /\.svg$/,
  /\.ico$/,
  /\/assets\/images\//,
];

const FONT_PATTERNS = [
  /\.woff2?$/,
  /\.eot$/,
  /\.ttf$/,
  /\.otf$/,
  /\/assets\/fonts\//,
];

const API_PATTERNS = [
  /\/api\//,
];

/**
 * Get cache by resource type
 */
function getCacheForRequest(request: Request): string {
  const url = new URL(request.url);
  
  if (IMAGE_PATTERNS.some(pattern => pattern.test(url.pathname))) {
    return IMAGE_CACHE_NAME;
  }
  
  if (FONT_PATTERNS.some(pattern => pattern.test(url.pathname))) {
    return FONT_CACHE_NAME;
  }
  
  if (API_PATTERNS.some(pattern => pattern.test(url.pathname))) {
    return API_CACHE_NAME;
  }
  
  if (STATIC_PATTERNS.some(pattern => pattern.test(url.pathname))) {
    return STATIC_CACHE_NAME;
  }
  
  return CACHE_NAME;
}

/**
 * Check if cached response is still fresh
 */
function isCacheFresh(response: Response, maxAge: number): boolean {
  if (!response) return false;
  
  const dateHeader = response.headers.get('date');
  if (!dateHeader) return false;
  
  const date = new Date(dateHeader).getTime();
  const now = Date.now();
  
  return (now - date) < (maxAge * 1000);
}

/**
 * Cache-first strategy for static assets
 */
async function cacheFirst(request: Request, cacheName: string, maxAge: number): Promise<Response> {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  
  if (cached && isCacheFresh(cached, maxAge)) {
    return cached;
  }
  
  try {
    const response = await fetch(request);
    
    if (response.ok) {
      // Clone response before caching
      const responseToCache = response.clone();
      cache.put(request, responseToCache);
    }
    
    return response;
  } catch (error) {
    // Return cached version if network fails
    if (cached) {
      return cached;
    }
    throw error;
  }
}

/**
 * Stale-while-revalidate strategy for images
 */
async function staleWhileRevalidate(request: Request, cacheName: string): Promise<Response> {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  
  // Start fetching in background
  const fetchPromise = fetch(request).then(response => {
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  }).catch(() => {
    // Network failed, will use cache if available
    return null;
  });
  
  // Return cached version immediately if available
  if (cached) {
    return cached;
  }
  
  // Otherwise wait for network
  return fetchPromise;
}

/**
 * Network-first strategy for API calls
 */
async function networkFirst(request: Request, cacheName: string, maxAge: number): Promise<Response> {
  const cache = await caches.open(cacheName);
  
  try {
    const response = await fetch(request);
    
    if (response.ok) {
      cache.put(request, response.clone());
    }
    
    return response;
  } catch (error) {
    // Network failed, try cache
    const cached = await cache.match(request);
    
    if (cached && isCacheFresh(cached, maxAge)) {
      return cached;
    }
    
    throw error;
  }
}

// Install event - precache static assets
self.addEventListener('install', (event: ExtendableEvent) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(PRECACHE_ASSETS);
    }).then(() => {
      // Activate immediately
      return (self as any).skipWaiting();
    })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event: ExtendableEvent) => {
  const cacheNames = [
    CACHE_NAME,
    STATIC_CACHE_NAME,
    IMAGE_CACHE_NAME,
    FONT_CACHE_NAME,
    API_CACHE_NAME,
  ];
  
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys
          .filter(key => !cacheNames.includes(key))
          .map(key => caches.delete(key))
      );
    }).then(() => {
      // Take control of all pages immediately
      return (self as any).clients.claim();
    })
  );
});

// Fetch event - handle requests with appropriate strategy
self.addEventListener('fetch', (event: FetchEvent) => {
  const request = event.request;
  
  // Only handle GET requests
  if (request.method !== 'GET') {
    return;
  }
  
  // Skip non-http(s) requests
  const url = new URL(request.url);
  if (!url.protocol.startsWith('http')) {
    return;
  }
  
  // Determine cache strategy based on resource type
  if (IMAGE_PATTERNS.some(pattern => pattern.test(url.pathname))) {
    event.respondWith(staleWhileRevalidate(request, IMAGE_CACHE_NAME));
    return;
  }
  
  if (FONT_PATTERNS.some(pattern => pattern.test(url.pathname))) {
    event.respondWith(cacheFirst(request, FONT_CACHE_NAME, CACHE_DURATION.font));
    return;
  }
  
  if (API_PATTERNS.some(pattern => pattern.test(url.pathname))) {
    event.respondWith(networkFirst(request, API_CACHE_NAME, CACHE_DURATION.api));
    return;
  }
  
  if (STATIC_PATTERNS.some(pattern => pattern.test(url.pathname))) {
    event.respondWith(cacheFirst(request, STATIC_CACHE_NAME, CACHE_DURATION.static));
    return;
  }
  
  // For navigation requests, use network-first
  if (request.mode === 'navigate') {
    event.respondWith(
      networkFirst(request, CACHE_NAME, CACHE_DURATION.api).catch(() => {
        // Return cached index.html for SPA routing
        return caches.match('/index.html');
      })
    );
    return;
  }
});

// Export for TypeScript
export {};