/**
 * i18n Module Exports
 * 
 * Public API for internationalization functionality.
 */

// Core i18n instance and configuration
export { default as i18n } from './index';
export { SUPPORTED_LANGUAGES, DEFAULT_LANGUAGE } from './index';
export type { SupportedLanguage } from './index';

// Locale Provider for React apps
export { LocaleProvider, LanguageSwitcher, useLocaleContext } from './LocaleProvider';

// Hooks for translations and formatting
export {
  useTranslation,
  useLanguage,
  useArcoLocale,
  useSafeTranslation,
  useNumberFormatter,
  useDateFormatter,
} from './hooks';