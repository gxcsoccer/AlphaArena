/**
 * i18n Mock for Jest Tests
 * 
 * This mock provides actual translated text for tests instead of translation keys.
 * It supports dynamic language switching with proper event handling.
 * Updated for lazy loading support (Issue #618).
 */

// Import actual translation files from public/locales (HTTP backend location)
const landingZhCN = require('../../public/locales/zh-CN/landing.json');
const commonZhCN = require('../../public/locales/zh-CN/common.json');
const navigationZhCN = require('../../public/locales/zh-CN/navigation.json');
const authZhCN = require('../../public/locales/zh-CN/auth.json');
const tradingZhCN = require('../../public/locales/zh-CN/trading.json');
const dashboardZhCN = require('../../public/locales/zh-CN/dashboard.json');
const leaderboardZhCN = require('../../public/locales/zh-CN/leaderboard.json');
const settingsZhCN = require('../../public/locales/zh-CN/settings.json');
const strategyZhCN = require('../../public/locales/zh-CN/strategy.json');
const portfolioZhCN = require('../../public/locales/zh-CN/portfolio.json');
const backtestZhCN = require('../../public/locales/zh-CN/backtest.json');
const notificationZhCN = require('../../public/locales/zh-CN/notification.json');
const seoZhCN = require('../../public/locales/zh-CN/seo.json');
const errorsZhCN = require('../../public/locales/zh-CN/errors.json');

const landingEnUS = require('../../public/locales/en-US/landing.json');
const commonEnUS = require('../../public/locales/en-US/common.json');
const navigationEnUS = require('../../public/locales/en-US/navigation.json');
const authEnUS = require('../../public/locales/en-US/auth.json');
const tradingEnUS = require('../../public/locales/en-US/trading.json');
const dashboardEnUS = require('../../public/locales/en-US/dashboard.json');
const leaderboardEnUS = require('../../public/locales/en-US/leaderboard.json');
const settingsEnUS = require('../../public/locales/en-US/settings.json');
const strategyEnUS = require('../../public/locales/en-US/strategy.json');
const portfolioEnUS = require('../../public/locales/en-US/portfolio.json');
const backtestEnUS = require('../../public/locales/en-US/backtest.json');
const notificationEnUS = require('../../public/locales/en-US/notification.json');
const seoEnUS = require('../../public/locales/en-US/seo.json');
const errorsEnUS = require('../../public/locales/en-US/errors.json');

const landingJaJP = require('../../public/locales/ja-JP/landing.json');
const commonJaJP = require('../../public/locales/ja-JP/common.json');
const navigationJaJP = require('../../public/locales/ja-JP/navigation.json');
const authJaJP = require('../../public/locales/ja-JP/auth.json');
const tradingJaJP = require('../../public/locales/ja-JP/trading.json');
const dashboardJaJP = require('../../public/locales/ja-JP/dashboard.json');
const leaderboardJaJP = require('../../public/locales/ja-JP/leaderboard.json');
const settingsJaJP = require('../../public/locales/ja-JP/settings.json');
const strategyJaJP = require('../../public/locales/ja-JP/strategy.json');
const portfolioJaJP = require('../../public/locales/ja-JP/portfolio.json');
const backtestJaJP = require('../../public/locales/ja-JP/backtest.json');
const notificationJaJP = require('../../public/locales/ja-JP/notification.json');
const seoJaJP = require('../../public/locales/ja-JP/seo.json');
const errorsJaJP = require('../../public/locales/ja-JP/errors.json');

const landingKoKR = require('../../public/locales/ko-KR/landing.json');
const commonKoKR = require('../../public/locales/ko-KR/common.json');
const navigationKoKR = require('../../public/locales/ko-KR/navigation.json');
const authKoKR = require('../../public/locales/ko-KR/auth.json');
const tradingKoKR = require('../../public/locales/ko-KR/trading.json');
const dashboardKoKR = require('../../public/locales/ko-KR/dashboard.json');
const leaderboardKoKR = require('../../public/locales/ko-KR/leaderboard.json');
const settingsKoKR = require('../../public/locales/ko-KR/settings.json');
const strategyKoKR = require('../../public/locales/ko-KR/strategy.json');
const portfolioKoKR = require('../../public/locales/ko-KR/portfolio.json');
const backtestKoKR = require('../../public/locales/ko-KR/backtest.json');
const notificationKoKR = require('../../public/locales/ko-KR/notification.json');
const seoKoKR = require('../../public/locales/ko-KR/seo.json');
const errorsKoKR = require('../../public/locales/ko-KR/errors.json');

// Combined translations for both languages
const allTranslations: Record<string, Record<string, Record<string, any>>> = {
  'zh-CN': {
    landing: landingZhCN,
    common: commonZhCN,
    navigation: navigationZhCN,
    auth: authZhCN,
    trading: tradingZhCN,
    dashboard: dashboardZhCN,
    leaderboard: leaderboardZhCN,
    settings: settingsZhCN,
    strategy: strategyZhCN,
    portfolio: portfolioZhCN,
    backtest: backtestZhCN,
    notification: notificationZhCN,
    seo: seoZhCN,
    errors: errorsZhCN,
  },
  'en-US': {
    landing: landingEnUS,
    common: commonEnUS,
    navigation: navigationEnUS,
    auth: authEnUS,
    trading: tradingEnUS,
    dashboard: dashboardEnUS,
    leaderboard: leaderboardEnUS,
    settings: settingsEnUS,
    strategy: strategyEnUS,
    portfolio: portfolioEnUS,
    backtest: backtestEnUS,
    notification: notificationEnUS,
    seo: seoEnUS,
    errors: errorsEnUS,
  },
  'ja-JP': {
    landing: landingJaJP,
    common: commonJaJP,
    navigation: navigationJaJP,
    auth: authJaJP,
    trading: tradingJaJP,
    dashboard: dashboardJaJP,
    leaderboard: leaderboardJaJP,
    settings: settingsJaJP,
    strategy: strategyJaJP,
    portfolio: portfolioJaJP,
    backtest: backtestJaJP,
    notification: notificationJaJP,
    seo: seoJaJP,
    errors: errorsJaJP,
  },
  'ko-KR': {
    landing: landingKoKR,
    common: commonKoKR,
    navigation: navigationKoKR,
    auth: authKoKR,
    trading: tradingKoKR,
    dashboard: dashboardKoKR,
    leaderboard: leaderboardKoKR,
    settings: settingsKoKR,
    strategy: strategyKoKR,
    portfolio: portfolioKoKR,
    backtest: backtestKoKR,
    notification: notificationKoKR,
    seo: seoKoKR,
    errors: errorsKoKR,
  },
};

/**
 * Current language state (mutable for testing)
 */
let currentLanguage = 'zh-CN';

/**
 * Track loaded namespaces for lazy loading mock
 * Preload essential namespaces (common, seo) as per Issue #618
 */
const loadedNamespaces: Set<string> = new Set(['common', 'seo', 'landing', 'navigation', 'auth', 'trading', 'dashboard', 'strategy', 'portfolio', 'settings', 'errors', 'backtest', 'leaderboard', 'notification']);

/**
 * Event listeners storage
 */
const eventListeners: Map<string, Set<Function>> = new Map();

/**
 * Helper function to get nested value from object using dot notation
 */
function getNestedValue(obj: any, path: string): string {
  const keys = path.split('.');
  let current = obj;
  
  for (const key of keys) {
    if (current === null || current === undefined) {
      return path; // Return key if path doesn't exist
    }
    current = current[key];
  }
  
  // Return the value if it's a string, otherwise return the key
  return typeof current === 'string' ? current : path;
}

/**
 * Get translations for current language
 */
function getTranslationsForLanguage(lang: string, namespace: string): Record<string, any> {
  const langTranslations = allTranslations[lang] || allTranslations['zh-CN'];
  return langTranslations[namespace] || {};
}

/**
 * Mock t function that returns actual translations for current language
 */
const createTFunction = (namespace: string, lang?: string) => {
  const language = lang || currentLanguage;
  return (key: string, options?: any): string => {
    const nsTranslations = getTranslationsForLanguage(language, namespace);
    const value = getNestedValue(nsTranslations, key);
    
    // Handle interpolation if options are provided
    if (options && typeof value === 'string') {
      let result = value;
      Object.keys(options).forEach((optKey) => {
        result = result.replace(new RegExp(`{{\\s*${optKey}\\s*}}`, 'g'), String(options[optKey]));
      });
      return result;
    }
    
    return value;
  };
};

/**
 * Reset language to default (useful for tests)
 */
const resetLanguage = () => {
  currentLanguage = 'zh-CN';
  loadedNamespaces.clear();
  loadedNamespaces.add('common');
  loadedNamespaces.add('seo');
  eventListeners.clear();
};

/**
 * Mock i18n instance with proper state management and lazy loading support
 */
const mockI18n = {
  get language() {
    return currentLanguage;
  },
  get isInitialized() {
    return true;
  },
  changeLanguage: jest.fn((lang: string) => {
    const previousLanguage = currentLanguage;
    currentLanguage = lang;
    // Emit languageChanged event
    const listeners = eventListeners.get('languageChanged');
    if (listeners) {
      listeners.forEach(listener => listener(lang, previousLanguage));
    }
    return Promise.resolve();
  }),
  t: (key: string, options?: any) => {
    return createTFunction('common')(key, options);
  },
  use: jest.fn(() => mockI18n),
  init: jest.fn(() => Promise.resolve()),
  on: jest.fn((event: string, callback: Function) => {
    if (!eventListeners.has(event)) {
      eventListeners.set(event, new Set());
    }
    eventListeners.get(event)!.add(callback);
    return mockI18n;
  }),
  off: jest.fn((event: string, callback: Function) => {
    const listeners = eventListeners.get(event);
    if (listeners) {
      listeners.delete(callback);
    }
    return mockI18n;
  }),
  emit: (event: string, ...args: any[]) => {
    const listeners = eventListeners.get(event);
    if (listeners) {
      listeners.forEach(listener => listener(...args));
    }
  },
  // Lazy loading support (Issue #618)
  hasLoadedNamespace: jest.fn((ns: string) => {
    return loadedNamespaces.has(ns);
  }),
  loadNamespaces: jest.fn((namespaces: string | string[]) => {
    const nsArray = Array.isArray(namespaces) ? namespaces : [namespaces];
    nsArray.forEach(ns => loadedNamespaces.add(ns));
    return Promise.resolve();
  }),
  loadNamespace: jest.fn((ns: string) => {
    loadedNamespaces.add(ns);
    return Promise.resolve();
  }),
  // Expose reset for tests
  _resetLanguage: resetLanguage,
  _loadedNamespaces: loadedNamespaces,
};

/**
 * Mock useTranslation hook with dynamic language
 */
const useTranslation = (namespace?: string | string[]) => {
  // Handle array of namespaces (return first namespace's t function)
  const ns = Array.isArray(namespace) ? namespace[0] : namespace || 'common';
  
  return {
    t: createTFunction(ns),
    i18n: mockI18n,
    ready: true,
  };
};

/**
 * Mock Trans component (returns children or translated text)
 * Using React.createElement to avoid JSX
 */
const React = require('react');
const Trans = ({ i18nKey, ns = 'common', children }: { i18nKey: string; ns?: string; children?: any }) => {
  const t = createTFunction(ns);
  return React.createElement(React.Fragment, null, children || t(i18nKey));
};

/**
 * Mock I18nextProvider component - simple passthrough that renders children
 */
const I18nextProvider = ({ children }: { children: React.ReactNode }) => {
  return React.createElement(React.Fragment, null, children);
};

// Mock react-i18next module
jest.mock('react-i18next', () => ({
  useTranslation,
  Trans,
  I18nextProvider,
  initReactI18next: {
    type: '3rdParty',
    init: jest.fn(),
  },
}));

// Mock i18next module
jest.mock('i18next', () => {
  return {
    __esModule: true,
    default: mockI18n,
    ...mockI18n,
  };
});

// Mock i18next-http-backend module (Issue #618)
jest.mock('i18next-http-backend', () => {
  return {
    __esModule: true,
    default: jest.fn(() => mockI18n),
  };
});

// Mock i18next-browser-languagedetector module
jest.mock('i18next-browser-languagedetector', () => {
  return {
    __esModule: true,
    default: jest.fn(() => mockI18n),
  };
});

// Export for direct access in tests if needed
module.exports = {
  mockI18n,
  resetLanguage,
  getTranslationsForLanguage,
};

console.log('[Setup] i18n mock applied with actual translations, dynamic language switching, and lazy loading support');