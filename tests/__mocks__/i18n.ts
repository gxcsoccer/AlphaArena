/**
 * i18n Mock for Jest Tests
 * 
 * This mock provides actual translated text for tests instead of translation keys.
 * It imports the zh-CN translation files to match the default language.
 */

// Import actual translation files (use zh-CN as default for tests)
const landingZhCN = require('../../src/client/locales/zh-CN/landing.json');
const commonZhCN = require('../../src/client/locales/zh-CN/common.json');
const navigationZhCN = require('../../src/client/locales/zh-CN/navigation.json');
const authZhCN = require('../../src/client/locales/zh-CN/auth.json');
const tradingZhCN = require('../../src/client/locales/zh-CN/trading.json');
const dashboardZhCN = require('../../src/client/locales/zh-CN/dashboard.json');
const leaderboardZhCN = require('../../src/client/locales/zh-CN/leaderboard.json');

// Combined translations
const translations: Record<string, Record<string, any>> = {
  landing: landingZhCN,
  common: commonZhCN,
  navigation: navigationZhCN,
  auth: authZhCN,
  trading: tradingZhCN,
  dashboard: dashboardZhCN,
  leaderboard: leaderboardZhCN,
};

/**
 * Helper function to get nested value from object using dot notation
 * e.g., getNestedValue(obj, 'hero.title') returns obj.hero.title
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
 * Mock t function that returns actual translations
 */
const createTFunction = (namespace: string) => {
  return (key: string, options?: any): string => {
    const nsTranslations = translations[namespace] || {};
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
 * Mock useTranslation hook
 */
const useTranslation = (namespace?: string | string[]) => {
  // Handle array of namespaces (return first namespace's t function)
  const ns = Array.isArray(namespace) ? namespace[0] : namespace || 'common';
  
  return {
    t: createTFunction(ns),
    i18n: {
      language: 'zh-CN',
      changeLanguage: jest.fn(),
      t: createTFunction(ns),
    },
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

// Mock react-i18next module
jest.mock('react-i18next', () => ({
  useTranslation,
  Trans,
  initReactI18next: {
    type: '3rdParty',
    init: jest.fn(),
  },
}));

// Mock i18next module
jest.mock('i18next', () => {
  const mockI18n = {
    language: 'zh-CN',
    changeLanguage: jest.fn((lang: string) => Promise.resolve()),
    t: (key: string, ns?: string) => {
      const namespace = ns || 'common';
      return getNestedValue(translations[namespace] || {}, key);
    },
    use: jest.fn(() => mockI18n),
    init: jest.fn(() => Promise.resolve()),
    on: jest.fn(),
    off: jest.fn(),
  };
  
  return {
    __esModule: true,
    default: mockI18n,
    ...mockI18n,
  };
});

console.log('[Setup] i18n mock applied with actual translations');