/**
 * i18n Hooks and Utilities
 * 
 * Provides React hooks and utility functions for internationalization.
 */

import { useTranslation } from 'react-i18next';
import { useCallback, useMemo } from 'react';
import { i18n, SupportedLanguage, SUPPORTED_LANGUAGES, DEFAULT_LANGUAGE } from '../i18n';

// Re-export useTranslation from react-i18next for convenience
export { useTranslation } from 'react-i18next';

/**
 * Hook for language switching functionality
 */
export function useLanguage() {
  const currentLanguage = i18n.language as SupportedLanguage;

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

export { SUPPORTED_LANGUAGES, DEFAULT_LANGUAGE };
export type { SupportedLanguage };