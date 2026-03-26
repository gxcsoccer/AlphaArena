/**
 * i18n Module Exports
 * 
 * Public API for internationalization functionality.
 */

// Core i18n instance and configuration
export { default as i18n } from './index';
export { 
  SUPPORTED_LANGUAGES, 
  DEFAULT_LANGUAGE, 
  ALL_NAMESPACES,
  ESSENTIAL_NAMESPACES,
  ROUTE_NAMESPACE_MAP,
} from './index';
export type { SupportedLanguage, Namespace } from './index';

// Locale Provider for React apps
export { LocaleProvider, useLocaleContext } from './LocaleProvider';

// Language Switcher component (Issue #586)
export { LanguageSwitcher } from '../components/LanguageSwitcher';

// Hooks for translations and formatting
export {
  useTranslation,
  useLanguage,
  useArcoLocale,
  useSafeTranslation,
  useNumberFormatter,
  useDateFormatter,
  // Lazy loading hooks (Issue #618)
  useLazyNamespaces,
  useRouteNamespaces,
  useTranslationWithLoading,
  loadNamespaces,
  getNamespacesForRoute,
} from './hooks';