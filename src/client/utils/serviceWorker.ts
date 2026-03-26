/**
 * Service Worker Registration
 * 
 * Issue #628: PWA 支持与离线能力
 * Issue #559: Image and Static Resource Optimization
 * 
 * This module handles service worker registration with vite-plugin-pwa integration.
 */

// Type for PWA registration options
type PWAConfig = {
  onSuccess?: (registration: ServiceWorkerRegistration) => void;
  onUpdate?: (registration: ServiceWorkerRegistration) => void;
};

// Store for update callback
let updateCallback: (() => void) | null = null;

/**
 * Set callback for when a new version is available
 */
export function onUpdateAvailable(callback: () => void): void {
  updateCallback = callback;
}

/**
 * Register service worker with error handling
 * Uses vite-plugin-pwa's virtual module when available
 */
export function registerServiceWorker(config?: PWAConfig): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    console.log('[SW] Service workers not supported');
    return Promise.resolve(null);
  }

  // Skip registration in development mode
  if (import.meta.env.DEV) {
    console.log('[SW] Skipping registration in development');
    return Promise.resolve(null);
  }

  // Try to use vite-plugin-pwa's virtual module
  return registerWithVirtualModule(config)
    .catch(() => registerFallback(config));
}

/**
 * Register using vite-plugin-pwa virtual module
 */
async function registerWithVirtualModule(config?: PWAConfig): Promise<ServiceWorkerRegistration | null> {
  try {
    // Dynamic import of vite-plugin-pwa virtual module
    const { registerSW } = await import('virtual:pwa-register');
    
    const updateSW = registerSW({
      immediate: true,
      onNeedRefresh() {
        console.log('[SW] New content available, please refresh.');
        config?.onUpdate?.(null as any);
        updateCallback?.();
      },
      onOfflineReady() {
        console.log('[SW] App ready to work offline.');
        config?.onSuccess?.(null as any);
      },
      onRegistered(registration) {
        console.log('[SW] Service worker registered:', registration?.scope);
      },
      onRegisterError(error) {
        console.error('[SW] Registration error:', error);
      },
    });

    // Return a mock registration for consistency
    return {} as ServiceWorkerRegistration;
  } catch (error) {
    // Virtual module not available, fall back to manual registration
    console.log('[SW] Virtual module not available, using fallback');
    throw error;
  }
}

/**
 * Fallback registration without virtual module
 */
async function registerFallback(config?: PWAConfig): Promise<ServiceWorkerRegistration | null> {
  const swUrl = '/sw.js';

  try {
    const registration = await navigator.serviceWorker.register(swUrl, { scope: '/' });
    console.log('[SW] Service worker registered:', registration.scope);

    // Check for updates
    registration.addEventListener('updatefound', () => {
      const newWorker = registration.installing;
      if (!newWorker) return;

      newWorker.addEventListener('statechange', () => {
        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
          // New version available
          console.log('[SW] New version available');
          config?.onUpdate?.(registration);
          updateCallback?.();
        } else if (newWorker.state === 'installed' && !navigator.serviceWorker.controller) {
          // First install, ready for offline
          console.log('[SW] Content cached for offline use');
          config?.onSuccess?.(registration);
        }
      });
    });

    return registration;
  } catch (error) {
    console.error('[SW] Service worker registration failed:', error);
    return null;
  }
}

/**
 * Unregister service worker
 */
export async function unregisterServiceWorker(): Promise<boolean> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return false;
  }

  try {
    const registrations = await navigator.serviceWorker.getRegistrations();
    const results = await Promise.all(
      registrations.map((registration) => registration.unregister())
    );
    return results.every(Boolean);
  } catch (error) {
    console.error('[SW] Service worker unregistration failed:', error);
    return false;
  }
}

/**
 * Check if service worker is active
 */
export async function isServiceWorkerActive(): Promise<boolean> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return false;
  }

  try {
    const registration = await navigator.serviceWorker.getRegistration();
    return !!registration?.active;
  } catch {
    return false;
  }
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

/**
 * Prompt user to update to new version
 */
export function promptUpdate(): void {
  if (confirm('新版本已可用，是否刷新页面？')) {
    window.location.reload();
  }
}

export default {
  registerServiceWorker,
  unregisterServiceWorker,
  isServiceWorkerActive,
  clearAllCaches,
  getCacheStats,
  onUpdateAvailable,
  promptUpdate,
};