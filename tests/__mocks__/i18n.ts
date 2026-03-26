/**
 * i18n Mock for Jest Tests
 * 
 * This mock provides actual translated text for tests instead of translation keys.
 * It supports dynamic language switching with proper event handling.
 */

// Import actual translation files for both languages
const landingZhCN = require('../../src/client/locales/zh-CN/landing.json');
const commonZhCN = require('../../src/client/locales/zh-CN/common.json');
const navigationZhCN = require('../../src/client/locales/zh-CN/navigation.json');
const authZhCN = require('../../src/client/locales/zh-CN/auth.json');
const tradingZhCN = require('../../src/client/locales/zh-CN/trading.json');
const dashboardZhCN = require('../../src/client/locales/zh-CN/dashboard.json');
const leaderboardZhCN = require('../../src/client/locales/zh-CN/leaderboard.json');
const settingsZhCN = require('../../src/client/locales/zh-CN/settings.json');

const landingEnUS = require('../../src/client/locales/en-US/landing.json');
const commonEnUS = require('../../src/client/locales/en-US/common.json');
const navigationEnUS = require('../../src/client/locales/en-US/navigation.json');
const authEnUS = require('../../src/client/locales/en-US/auth.json');
const tradingEnUS = require('../../src/client/locales/en-US/trading.json');
const dashboardEnUS = require('../../src/client/locales/en-US/dashboard.json');
const leaderboardEnUS = require('../../src/client/locales/en-US/leaderboard.json');
const settingsEnUS = require('../../src/client/locales/en-US/settings.json');

const landingJaJP = require('../../src/client/locales/ja-JP/landing.json');
const commonJaJP = require('../../src/client/locales/ja-JP/common.json');
const navigationJaJP = require('../../src/client/locales/ja-JP/navigation.json');
const authJaJP = require('../../src/client/locales/ja-JP/auth.json');
const tradingJaJP = require('../../src/client/locales/ja-JP/trading.json');
const dashboardJaJP = require('../../src/client/locales/ja-JP/dashboard.json');
const leaderboardJaJP = require('../../src/client/locales/ja-JP/leaderboard.json');
const settingsJaJP = require('../../src/client/locales/ja-JP/settings.json');

const landingKoKR = require('../../src/client/locales/ko-KR/landing.json');
const commonKoKR = require('../../src/client/locales/ko-KR/common.json');
const navigationKoKR = require('../../src/client/locales/ko-KR/navigation.json');
const authKoKR = require('../../src/client/locales/ko-KR/auth.json');
const tradingKoKR = require('../../src/client/locales/ko-KR/trading.json');
const dashboardKoKR = require('../../src/client/locales/ko-KR/dashboard.json');
const leaderboardKoKR = require('../../src/client/locales/ko-KR/leaderboard.json');
const settingsKoKR = require('../../src/client/locales/ko-KR/settings.json');

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
  },
};

/**
 * Current language state (mutable for testing)
 */
let currentLanguage = 'zh-CN';

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
  eventListeners.clear();
};

/**
 * Mock i18n instance with proper state management
 */
const mockI18n = {
  get language() {
    return currentLanguage;
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
  // Expose reset for tests
  _resetLanguage: resetLanguage,
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

// Export for direct access in tests if needed
module.exports = {
  mockI18n,
  resetLanguage,
  getTranslationsForLanguage,
};

console.log('[Setup] i18n mock applied with actual translations and dynamic language switching');