/**
 * Lazy Loading with Retry Logic
 * 
 * Handles "Failed to fetch dynamically imported module" errors that occur when:
 * - A new deployment changes chunk hashes
 * - Browser cache holds old bundle with stale chunk references
 * - Network issues during chunk loading
 * 
 * Solution: Retry the import and if that fails, force a page reload to get the latest bundle.
 */

import React, { ComponentType, LazyExoticComponent } from 'react';

// Track retry attempts to prevent infinite loops
const RETRY_LIMIT = 3;
const RETRY_DELAY = 500; // ms

// Store for tracking failed imports
const failedImports = new Set<string>();

/**
 * Wrap a dynamic import with retry logic
 * 
 * Usage:
 *   const MyComponent = lazyWithRetry(() => import('./MyComponent'));
 */
export function lazyWithRetry<T extends ComponentType<any>>(
  importFn: () => Promise<{ default: T }>
): LazyExoticComponent<T> {
  return React.lazy(() => retryImport(importFn));
}

/**
 * Retry an import with reload fallback
 */
async function retryImport<T extends ComponentType<any>>(
  importFn: () => Promise<{ default: T }>,
  attempt: number = 1
): Promise<{ default: T }> {
  try {
    const module = await importFn();
    
    // Clear any previous failure tracking on success
    const importPath = importFn.toString();
    failedImports.delete(importPath);
    
    return module;
  } catch (error) {
    const importPath = importFn.toString();
    
    console.error(`[LazyLoad] Import failed (attempt ${attempt}/${RETRY_LIMIT}):`, error);
    
    // Check if this is a chunk loading error
    const isChunkError = error instanceof Error && (
      error.message.includes('Failed to fetch dynamically imported module') ||
      error.message.includes('Loading chunk') ||
      error.message.includes('Loading CSS chunk') ||
      error.name === 'ChunkLoadError'
    );
    
    if (!isChunkError) {
      // Not a chunk error, re-throw
      throw error;
    }
    
    // Check if we've already tried too many times
    if (attempt >= RETRY_LIMIT) {
      console.error('[LazyLoad] Max retries reached, forcing page reload...');
      
      // Track this import as failed
      failedImports.add(importPath);
      
      // Force reload to get fresh bundle
      // Use setTimeout to ensure error is logged
      setTimeout(() => {
        // Preserve the current URL so user returns to the same page
        window.location.reload();
      }, 100);
      
      // Re-throw to show error boundary temporarily
      throw error;
    }
    
    // Wait before retrying
    await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * attempt));
    
    console.log(`[LazyLoad] Retrying import (attempt ${attempt + 1})...`);
    
    return retryImport(importFn, attempt + 1);
  }
}

/**
 * Check if we're in a retry loop for a specific import
 */
export function isImportFailed(importFn: () => Promise<any>): boolean {
  return failedImports.has(importFn.toString());
}

/**
 * Clear all failed import tracking
 */
export function clearFailedImports(): void {
  failedImports.clear();
}

export default lazyWithRetry;
