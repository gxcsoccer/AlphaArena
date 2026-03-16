/**
 * Lazy Loading with Cache-Busting on Chunk Error
 * 
 * Handles "Failed to fetch dynamically imported module" errors that occur when:
 * - A new deployment changes chunk hashes
 * - Browser cache holds old bundle with stale chunk references
 * - Network issues during chunk loading
 * 
 * IMPORTANT: The browser caches both successful AND failed dynamic imports.
 * Retrying the same import() will return the cached error, not fetch fresh code.
 * 
 * Solution: Force immediate hard reload with cache-busting on chunk error.
 */

import React, { ComponentType, LazyExoticComponent } from 'react';

// Key for storing the intended route before reload
const PENDING_ROUTE_KEY = '__vite_pending_route__';

/**
 * Wrap a dynamic import with chunk error handling
 * 
 * Usage:
 *   const MyComponent = lazyWithRetry(() => import('./MyComponent'));
 */
export function lazyWithRetry<T extends ComponentType<any>>(
  importFn: () => Promise<{ default: T }>
): LazyExoticComponent<T> {
  return React.lazy(() => loadWithRetry(importFn));
}

/**
 * Load a module with immediate hard reload on chunk error
 * 
 * Note: We don't retry the import because the browser caches failed imports.
 * Retrying the same import() returns the cached error, wasting time.
 */
async function loadWithRetry<T extends ComponentType<any>>(
  importFn: () => Promise<{ default: T }>
): Promise<{ default: T }> {
  try {
    const module = await importFn();
    return module;
  } catch (error) {
    // Check if this is a chunk loading error
    const isChunkError = error instanceof Error && (
      error.message.includes('Failed to fetch dynamically imported module') ||
      error.message.includes('Loading chunk') ||
      error.message.includes('Loading CSS chunk') ||
      error.name === 'ChunkLoadError'
    );
    
    if (!isChunkError) {
      // Not a chunk error, re-throw normally
      throw error;
    }
    
    console.error('[ChunkError] Chunk loading failed, forcing hard reload...');
    console.error('[ChunkError] Error:', error);
    
    // Store current route for restoration after reload
    try {
      const currentPath = window.location.pathname + window.location.search + window.location.hash;
      sessionStorage.setItem(PENDING_ROUTE_KEY, currentPath);
    } catch (e) {
      // Ignore sessionStorage errors
    }
    
    // Force hard reload with cache-busting
    // Using location.href with cache-busting query ensures fresh fetch
    const cacheBuster = `__t=${Date.now()}`;
    const currentUrl = window.location.href;
    const separator = currentUrl.includes('?') ? '&' : '?';
    
    // Force reload - this will fetch all chunks fresh
    window.location.href = currentUrl + separator + cacheBuster;
    
    // Return a never-resolving promise while reload happens
    // This prevents React from showing error UI briefly
    return new Promise(() => {});
  }
}

/**
 * Check if there's a pending route to restore after reload
 * Call this on app startup
 */
export function getPendingRoute(): string | null {
  try {
    const route = sessionStorage.getItem(PENDING_ROUTE_KEY);
    if (route) {
      sessionStorage.removeItem(PENDING_ROUTE_KEY);
    }
    return route;
  } catch {
    return null;
  }
}

/**
 * Restore pending route if available
 * Call this in the app's root component after router is ready
 */
export function restorePendingRoute(): void {
  const pendingRoute = getPendingRoute();
  if (pendingRoute && pendingRoute !== window.location.pathname + window.location.search + window.location.hash) {
    // Use history.replaceState to avoid adding to history stack
    window.history.replaceState(null, '', pendingRoute);
    // Trigger a popstate event so the router picks up the change
    window.dispatchEvent(new PopStateEvent('popstate'));
  }
}

export default lazyWithRetry;
