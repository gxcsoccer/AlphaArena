/**
 * i18n Configuration with Lazy Loading (Issue #618)
 * 
 * This module sets up internationalization using i18next with react-i18next.
 * Translations are lazy-loaded to reduce initial bundle size.
 * 
 * ## Architecture Overview
 * 
 * ### Language Detection
 * - Browser language detection via i18next-browser-languagedetector
 * - Fallback language: zh-CN (Chinese Simplified)
 * - Supported languages: zh-CN, en-US, ja-JP, ko-KR
 * 
 * ### Namespace Strategy
 * Namespaces are organized by feature module for better code splitting and maintainability:
 * - `common`: Shared UI elements, buttons, labels, etc. (PRELOADED)
 * - `seo`: SEO-related translations (PRELOADED for SEO purposes)
 * - `navigation`: Menu items, routes, page titles
 * - `auth`: Authentication related translations
 * - `trading`: Trading related translations
 * - `portfolio`: Portfolio and holdings
 * - `strategy`: Strategy management
 * - `settings`: Settings and preferences
 * - `errors`: Error messages and validation
 * - `dashboard`: Dashboard page
 * - `leaderboard`: Leaderboard page
 * - `backtest`: Backtest page
 * - `notification`: Notification related
 * - `landing`: Landing page
 * 
 * ### Lazy Loading
 * - Uses i18next-http-backend to load translations on-demand
 * - Only `common` and `seo` namespaces are preloaded
 * - Other namespaces are loaded when needed (route-based or component-based)
 * 
 * ### Translation Key Naming Convention
 * Keys follow a hierarchical pattern: `namespace.entity.action/state`
 * 
 * Examples:
 * - `common.button.submit` → Submit button label
 * - `trading.order.create.title` → Create order dialog title
 * - `errors.validation.required` → Required field error
 * 
 * ### Usage
 * ```tsx
 * import { useTranslation } from 'react-i18next';
 * 
 * function MyComponent() {
 *   const { t } = useTranslation('common');
 *   return <button>{t('button.submit')}</button>;
 * }
 * ```
 */

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import HttpBackend from 'i18next-http-backend';

// Define supported languages
export const SUPPORTED_LANGUAGES = {
  'zh-CN': {
    name: '简体中文',
    nativeName: '简体中文',
    arcoLocale: 'zh-CN',
  },
  'en-US': {
    name: 'English',
    nativeName: 'English',
    arcoLocale: 'en-US',
  },
  'ja-JP': {
    name: '日本語',
    nativeName: '日本語',
    arcoLocale: 'ja-JP',
  },
  'ko-KR': {
    name: '한국어',
    nativeName: '한국어',
    arcoLocale: 'ko-KR',
  },
} as const;

export type SupportedLanguage = keyof typeof SUPPORTED_LANGUAGES;
export const DEFAULT_LANGUAGE: SupportedLanguage = 'zh-CN';

// All available namespaces
export const ALL_NAMESPACES = [
  'common',
  'navigation',
  'auth',
  'trading',
  'portfolio',
  'strategy',
  'settings',
  'errors',
  'dashboard',
  'leaderboard',
  'backtest',
  'notification',
  'landing',
  'seo',
] as const;

export type Namespace = typeof ALL_NAMESPACES[number];

// Essential namespaces that should be preloaded (loaded on init)
export const ESSENTIAL_NAMESPACES: Namespace[] = ['common', 'seo'];

// Route to namespace mapping for lazy loading
export const ROUTE_NAMESPACE_MAP: Record<string, Namespace[]> = {
  '/': [], // Index page uses common only
  '/landing': ['landing'],
  '/dashboard': ['dashboard'],
  '/strategies': ['strategy'],
  '/trades': ['trading'],
  '/holdings': ['portfolio'],
  '/backtest': ['backtest'],
  '/login': ['auth'],
  '/register': ['auth'],
  '/leaderboard': ['leaderboard'],
  '/notification-preferences': ['notification'],
  '/notifications': ['notification'],
  '/settings': ['settings'],
};

/**
 * Load namespaces on demand
 * Use this to preload namespaces for a specific route
 */
export async function loadNamespaces(namespaces: Namespace[]): Promise<void> {
  const notLoaded = namespaces.filter(ns => !i18n.hasLoadedNamespace(ns));
  if (notLoaded.length > 0) {
    await i18n.loadNamespaces(notLoaded);
  }
}

/**
 * Get namespaces for a route
 */
export function getNamespacesForRoute(route: string): Namespace[] {
  // Exact match
  if (ROUTE_NAMESPACE_MAP[route]) {
    return ROUTE_NAMESPACE_MAP[route];
  }
  
  // Prefix match for routes with params
  for (const [pattern, namespaces] of Object.entries(ROUTE_NAMESPACE_MAP)) {
    if (route.startsWith(pattern + '/') || route === pattern) {
      return namespaces;
    }
  }
  
  return [];
}

// Initialize i18next with lazy loading
i18n
  // Detect user language
  .use(LanguageDetector)
  // HTTP backend for lazy loading translations
  .use(HttpBackend)
  // Pass the i18n instance to react-i18next
  .use(initReactI18next)
  // Initialize configuration
  .init({
    // No static resources - loaded via HTTP backend
    backend: {
      // Path to translation files
      loadPath: '/locales/{{lng}}/{{ns}}.json',
    },
    
    fallbackLng: DEFAULT_LANGUAGE,
    supportedLngs: Object.keys(SUPPORTED_LANGUAGES),
    
    // All available namespaces
    ns: ALL_NAMESPACES,
    // Default namespace
    defaultNS: 'common',
    // Fallback namespace
    fallbackNS: 'common',
    
    // Preload essential namespaces
    preload: ESSENTIAL_NAMESPACES,
    
    // Interpolation configuration
    interpolation: {
      escapeValue: false, // React already escapes values
    },
    
    // Language detection configuration
    // Issue #586: Added querystring support for URL parameter ?lang=en
    detection: {
      order: ['querystring', 'localStorage', 'navigator', 'htmlTag'],
      lookupQuerystring: 'lang',
      lookupLocalStorage: 'i18nextLng',
      caches: ['localStorage'],
    },
    
    // Development options
    debug: import.meta.env.DEV,
    
    // Performance optimization
    load: 'currentOnly',
    returnEmptyString: false,
    returnNull: false,
    
    // Lazy loading options
    partialBundledLanguages: false,
    loadMissing: true,
    saveMissing: import.meta.env.DEV,
    
    // React options
    react: {
      // Wait for all namespaces to be loaded before rendering
      wait: true,
      // Use suspense for loading states
      useSuspense: false,
    },
  });

export default i18n;