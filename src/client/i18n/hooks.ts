/**
 * i18n Hooks and Utilities
 * 
 * Provides React hooks and utility functions for internationalization.
 */

import { useTranslation } from 'react-i18next';
import { useCallback, useMemo, useEffect, useState } from 'react';
import i18n, { SupportedLanguage, SUPPORTED_LANGUAGES, DEFAULT_LANGUAGE, Namespace, loadNamespaces, getNamespacesForRoute } from './index';

// Re-export useTranslation from react-i18next for convenience
export { useTranslation } from 'react-i18next';

/**
 * Hook for language switching functionality
 */
export function useLanguage() {
  // Ensure currentLanguage is a valid SupportedLanguage
  const rawLanguage = i18n.language;
  const currentLanguage = (
    rawLanguage && rawLanguage in SUPPORTED_LANGUAGES 
      ? rawLanguage 
      : DEFAULT_LANGUAGE
  ) as SupportedLanguage;

  const changeLanguage = useCallback(async (lang: SupportedLanguage) => {
    await i18n.changeLanguage(lang);
  }, []);

  const supportedLanguages = useMemo(() => 
    Object.entries(SUPPORTED_LANGUAGES).map(([code, info]) => ({
      code: code as SupportedLanguage,
      ...info,
    })),
  []);

  const currentLanguageInfo = SUPPORTED_LANGUAGES[currentLanguage] || SUPPORTED_LANGUAGES[DEFAULT_LANGUAGE];

  return {
    currentLanguage,
    currentLanguageInfo,
    changeLanguage,
    supportedLanguages,
    isSupported: (lang: string): lang is SupportedLanguage => lang in SUPPORTED_LANGUAGES,
  };
}

/**
 * Hook for Arco Design locale
 * Returns the appropriate Arco Design locale based on current i18n language
 */
export function useArcoLocale() {
  const { currentLanguage } = useLanguage();
  
  // Map i18n language to Arco Design locale
  const arcoLocaleCode = SUPPORTED_LANGUAGES[currentLanguage]?.arcoLocale || 'zh-CN';
  
  return {
    arcoLocaleCode,
    // Import Arco locale dynamically based on current language
    // This is used in LocaleProvider
  };
}

/**
 * Get translation with fallback
 * Useful for cases where a key might not exist
 */
export function useSafeTranslation(namespace?: string) {
  const { t, i18n: i18nInstance } = useTranslation(namespace);
  
  const safeT = useCallback(
    (key: string, options?: Record<string, unknown>) => {
      const translation = t(key, { ...options, defaultValue: key });
      return translation || key;
    },
    [t],
  );

  return {
    t: safeT,
    i18n: i18nInstance,
  };
}

/**
 * Format number with locale-aware formatting
 */
export function useNumberFormatter() {
  const { currentLanguage } = useLanguage();
  
  return useMemo(() => {
    const locale = currentLanguage === 'zh-CN' ? 'zh-CN' : 'en-US';
    
    return {
      formatNumber: (value: number, options?: Intl.NumberFormatOptions) => 
        new Intl.NumberFormat(locale, options).format(value),
      formatCurrency: (value: number, currency = 'USD', options?: Intl.NumberFormatOptions) =>
        new Intl.NumberFormat(locale, { style: 'currency', currency, ...options }).format(value),
      formatPercent: (value: number, options?: Intl.NumberFormatOptions) =>
        new Intl.NumberFormat(locale, { style: 'percent', ...options }).format(value),
    };
  }, [currentLanguage]);
}

/**
 * Format date with locale-aware formatting
 */
export function useDateFormatter() {
  const { currentLanguage } = useLanguage();
  
  return useMemo(() => {
    const locale = currentLanguage === 'zh-CN' ? 'zh-CN' : 'en-US';
    
    return {
      formatDate: (date: Date | string | number, options?: Intl.DateTimeFormatOptions) =>
        new Intl.DateTimeFormat(locale, { dateStyle: 'medium', ...options }).format(new Date(date)),
      formatTime: (date: Date | string | number, options?: Intl.DateTimeFormatOptions) =>
        new Intl.DateTimeFormat(locale, { timeStyle: 'short', ...options }).format(new Date(date)),
      formatDateTime: (date: Date | string | number, options?: Intl.DateTimeFormatOptions) =>
        new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short', ...options }).format(new Date(date)),
    };
  }, [currentLanguage]);
}

/**
 * Hook to lazy load namespaces on demand with retry support
 * Use this in components that need specific namespaces
 * 
 * @param namespaces - Array of namespaces to load
 * @param options - Configuration options
 * @param options.maxRetries - Maximum number of retry attempts (default: 3)
 * @param options.retryDelay - Base delay between retries in ms (default: 1000, uses exponential backoff)
 */
export function useLazyNamespaces(
  namespaces: Namespace[],
  options?: { maxRetries?: number; retryDelay?: number }
) {
  const { maxRetries = 3, retryDelay = 1000 } = options || {};
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  
  const loadWithRetry = useCallback(async (attempt: number) => {
    const notLoaded = namespaces.filter(ns => !i18n.hasLoadedNamespace(ns));
    
    if (notLoaded.length === 0) {
      setLoading(false);
      setError(null);
      return;
    }
    
    if (attempt > maxRetries) {
      const err = new Error(`Failed to load namespaces after ${maxRetries} attempts: ${notLoaded.join(', ')}`);
      console.error('[i18n] Max retries exceeded:', err.message);
      setError(err);
      setLoading(false);
      return;
    }
    
    try {
      setLoading(true);
      await loadNamespaces(notLoaded);
      setLoading(false);
      setError(null);
      setRetryCount(0);
    } catch (err) {
      console.error(`[i18n] Failed to load namespaces (attempt ${attempt}/${maxRetries}):`, notLoaded, err);
      
      // Exponential backoff retry
      const delay = retryDelay * Math.pow(2, attempt - 1);
      setTimeout(() => {
        setRetryCount(attempt);
        loadWithRetry(attempt + 1);
      }, delay);
    }
  }, [namespaces, maxRetries, retryDelay]);
  
  useEffect(() => {
    const notLoaded = namespaces.filter(ns => !i18n.hasLoadedNamespace(ns));
    
    if (notLoaded.length === 0) {
      return;
    }
    
    // Reset retry count when namespaces change
    setRetryCount(0);
    loadWithRetry(1);
  }, [namespaces.join(',')]); // eslint-disable-line react-hooks/exhaustive-deps
  
  const retry = useCallback(() => {
    setRetryCount(0);
    setError(null);
    loadWithRetry(1);
  }, [loadWithRetry]);
  
  return {
    loading,
    error,
    loaded: namespaces.every(ns => i18n.hasLoadedNamespace(ns)),
    retryCount,
    retry,
  };
}

/**
 * Hook to load namespaces for current route
 * Use this in page components to load their required translations
 */
export function useRouteNamespaces(route: string) {
  const namespaces = useMemo(() => getNamespacesForRoute(route), [route]);
  return useLazyNamespaces(namespaces);
}

/**
 * Hook for translation with automatic namespace loading
 * Combines useTranslation with useLazyNamespaces for convenience
 */
export function useTranslationWithLoading(namespace: Namespace | Namespace[]) {
  const namespaces = Array.isArray(namespace) ? namespace : [namespace];
  const { loading, error, loaded } = useLazyNamespaces(namespaces);
  const { t, i18n: i18nInstance } = useTranslation(namespace);
  
  return {
    t,
    i18n: i18nInstance,
    loading,
    error,
    loaded,
  };
}

export { SUPPORTED_LANGUAGES, DEFAULT_LANGUAGE, loadNamespaces, getNamespacesForRoute };
export type { SupportedLanguage, Namespace };