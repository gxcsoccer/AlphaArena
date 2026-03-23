/**
 * i18n Configuration
 * 
 * This module sets up internationalization using i18next with react-i18next.
 * 
 * ## Architecture Overview
 * 
 * ### Language Detection
 * - Browser language detection via i18next-browser-languagedetector
 * - Fallback language: zh-CN (Chinese Simplified)
 * - Supported languages: zh-CN, en-US
 * 
 * ### Namespace Strategy
 * Namespaces are organized by feature module for better code splitting and maintainability:
 * - `common`: Shared UI elements, buttons, labels, etc.
 * - `navigation`: Menu items, routes, page titles
 * - `auth`: Authentication related translations
 * - `trading`: Trading related translations
 * - `portfolio`: Portfolio and holdings
 * - `strategy`: Strategy management
 * - `settings`: Settings and preferences
 * - `errors`: Error messages and validation
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

// Import translation files
// Common namespace
import commonZhCN from '../locales/zh-CN/common.json';
import commonEnUS from '../locales/en-US/common.json';

// Navigation namespace
import navigationZhCN from '../locales/zh-CN/navigation.json';
import navigationEnUS from '../locales/en-US/navigation.json';

// Auth namespace
import authZhCN from '../locales/zh-CN/auth.json';
import authEnUS from '../locales/en-US/auth.json';

// Trading namespace
import tradingZhCN from '../locales/zh-CN/trading.json';
import tradingEnUS from '../locales/en-US/trading.json';

// Portfolio namespace
import portfolioZhCN from '../locales/zh-CN/portfolio.json';
import portfolioEnUS from '../locales/en-US/portfolio.json';

// Strategy namespace
import strategyZhCN from '../locales/zh-CN/strategy.json';
import strategyEnUS from '../locales/en-US/strategy.json';

// Settings namespace
import settingsZhCN from '../locales/zh-CN/settings.json';
import settingsEnUS from '../locales/en-US/settings.json';

// Errors namespace
import errorsZhCN from '../locales/zh-CN/errors.json';
import errorsEnUS from '../locales/en-US/errors.json';

// Dashboard namespace
import dashboardZhCN from '../locales/zh-CN/dashboard.json';
import dashboardEnUS from '../locales/en-US/dashboard.json';

// Leaderboard namespace
import leaderboardZhCN from '../locales/zh-CN/leaderboard.json';
import leaderboardEnUS from '../locales/en-US/leaderboard.json';

// Backtest namespace
import backtestZhCN from '../locales/zh-CN/backtest.json';
import backtestEnUS from '../locales/en-US/backtest.json';

// Notification namespace
import notificationZhCN from '../locales/zh-CN/notification.json';
import notificationEnUS from '../locales/en-US/notification.json';

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
} as const;

export type SupportedLanguage = keyof typeof SUPPORTED_LANGUAGES;
export const DEFAULT_LANGUAGE: SupportedLanguage = 'zh-CN';

// Language resources
const resources = {
  'zh-CN': {
    common: commonZhCN,
    navigation: navigationZhCN,
    auth: authZhCN,
    trading: tradingZhCN,
    portfolio: portfolioZhCN,
    strategy: strategyZhCN,
    settings: settingsZhCN,
    errors: errorsZhCN,
    dashboard: dashboardZhCN,
    leaderboard: leaderboardZhCN,
    backtest: backtestZhCN,
    notification: notificationZhCN,
  },
  'en-US': {
    common: commonEnUS,
    navigation: navigationEnUS,
    auth: authEnUS,
    trading: tradingEnUS,
    portfolio: portfolioEnUS,
    strategy: strategyEnUS,
    settings: settingsEnUS,
    errors: errorsEnUS,
    dashboard: dashboardEnUS,
    leaderboard: leaderboardEnUS,
    backtest: backtestEnUS,
    notification: notificationEnUS,
  },
};

// Initialize i18next
i18n
  // Detect user language
  .use(LanguageDetector)
  // Pass the i18n instance to react-i18next
  .use(initReactI18next)
  // Initialize configuration
  .init({
    resources,
    fallbackLng: DEFAULT_LANGUAGE,
    supportedLngs: Object.keys(SUPPORTED_LANGUAGES),
    
    // Default namespace
    ns: ['common'],
    defaultNS: 'common',
    
    // Interpolation configuration
    interpolation: {
      escapeValue: false, // React already escapes values
    },
    
    // Language detection configuration
    detection: {
      order: ['localStorage', 'navigator', 'htmlTag'],
      lookupLocalStorage: 'i18nextLng',
      caches: ['localStorage'],
    },
    
    // Development options
    debug: import.meta.env.DEV,
    
    // Performance optimization
    load: 'currentOnly',
    returnEmptyString: false,
    returnNull: false,
  });

export default i18n;