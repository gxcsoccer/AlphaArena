/**
 * Service Worker Registration
 * 
 * Issue #559: Image and Static Resource Optimization
 */

/**
 * Register service worker with error handling
 */
export function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    console.log('[SW] Service workers not supported');
    return Promise.resolve(null);
  }

  return navigator.serviceWorker
    .register('/sw.js', { scope: '/' })
    .then((registration) => {
      console.log('[SW] Service worker registered:', registration.scope);

      // Check for updates
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        if (!newWorker) return;

        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            // New version available
            console.log('[SW] New version available, refreshing...');
            // Optionally prompt user to refresh
            if (confirm('新版本已可用，是否刷新页面？')) {
              newWorker.postMessage({ type: 'SKIP_WAITING' });
              window.location.reload();
            }
          }
        });
      });

      return registration;
    })
    .catch((error) => {
      console.error('[SW] Service worker registration failed:', error);
      return null;
    });
}

/**
 * Unregister service worker
 */
export function unregisterServiceWorker(): Promise<boolean> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return Promise.resolve(false);
  }

  return navigator.serviceWorker
    .getRegistrations()
    .then((registrations) => {
      return Promise.all(
        registrations.map((registration) => registration.unregister())
      );
    })
    .then((results) => results.every(Boolean))
    .catch((error) => {
      console.error('[SW] Service worker unregistration failed:', error);
      return false;
    });
}

/**
 * Check if service worker is active
 */
export function isServiceWorkerActive(): Promise<boolean> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return Promise.resolve(false);
  }

  return navigator.serviceWorker
    .getRegistration()
    .then((registration) => !!registration?.active)
    .catch(() => false);
}

/**
 * Clear all caches
 */
export async function clearAllCaches(): Promise<boolean> {
  if (typeof window === 'undefined' || !('caches' in window)) {
    return false;
  }

  try {
    const cacheNames = await caches.keys();
    await Promise.all(cacheNames.map((name) => caches.delete(name)));
    console.log('[SW] All caches cleared');
    return true;
  } catch (error) {
    console.error('[SW] Failed to clear caches:', error);
    return false;
  }
}

/**
 * Get cache statistics
 */
export async function getCacheStats(): Promise<{
  caches: { name: string; size: number }[];
  totalSize: number;
}> {
  if (typeof window === 'undefined' || !('caches' in window)) {
    return { caches: [], totalSize: 0 };
  }

  const cacheNames = await caches.keys();
  const stats: { name: string; size: number }[] = [];

  for (const name of cacheNames) {
    const cache = await caches.open(name);
    const keys = await cache.keys();
    stats.push({ name, size: keys.length });
  }

  return {
    caches: stats,
    totalSize: stats.reduce((sum, c) => sum + c.size, 0),
  };
}

export default {
  registerServiceWorker,
  unregisterServiceWorker,
  isServiceWorkerActive,
  clearAllCaches,
  getCacheStats,
};