/**
 * Tests for useSEO hook
 * 
 * Issue #617: International SEO Optimization
 */

import { renderHook } from '@testing-library/react';
import { useSEO, PAGE_SEO_CONFIGS } from '../useSEO';

// Mock react-router-dom
const mockLocation = { pathname: '/' };
jest.mock('react-router-dom', () => ({
  useLocation: () => mockLocation,
}));

// Mock react-i18next
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        'meta.title': 'AlphaArena - 算法交易平台',
        'meta.description': '专业的算法交易平台',
        'meta.keywords': '算法交易, 量化交易',
        'pages.home.title': 'AlphaArena - 首页',
        'pages.home.description': '首页描述',
        'pages.landing.title': 'AlphaArena - 着陆页',
        'pages.landing.description': '着陆页描述',
        'pages.login.title': '登录 - AlphaArena',
        'pages.login.description': '登录描述',
        'pages.register.title': '注册 - AlphaArena',
        'pages.register.description': '注册描述',
        'pages.leaderboard.title': '排行榜 - AlphaArena',
        'pages.leaderboard.description': '排行榜描述',
        'pages.subscription.title': '订阅 - AlphaArena',
        'pages.subscription.description': '订阅描述',
        'pages.marketplace.title': '市场 - AlphaArena',
        'pages.marketplace.description': '市场描述',
        'pages.apiDocs.title': 'API文档 - AlphaArena',
        'pages.apiDocs.description': 'API文档描述',
      };
      return translations[key] || key;
    },
  }),
}));

// Mock i18n hooks
jest.mock('../../i18n/hooks', () => ({
  useLanguage: () => 'zh-CN',
}));

// Mock seo utils
jest.mock('../../utils/seo', () => ({
  updateSEOMeta: jest.fn(),
  updateHtmlLang: jest.fn(),
  updateHreflangTags: jest.fn(),
  generateWebsiteStructuredData: jest.fn(() => ({ '@type': 'WebSite' })),
  updateStructuredData: jest.fn(),
  SITE_URL: 'https://alphaarena.app',
}));

describe('useSEO hook', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should update SEO with page key', () => {
    const { updateSEOMeta } = require('../../utils/seo');
    
    renderHook(() => useSEO('home'));

    expect(updateSEOMeta).toHaveBeenCalled();
    const call = updateSEOMeta.mock.calls[0][0];
    expect(call.title).toContain('AlphaArena');
  });

  it('should update SEO with custom config', () => {
    const { updateSEOMeta } = require('../../utils/seo');
    
    renderHook(() => useSEO({ 
      title: 'Custom Title',
      description: 'Custom Description' 
    }));

    expect(updateSEOMeta).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Custom Title',
        description: 'Custom Description',
      }),
      'zh-CN',
      '/'
    );
  });

  it('should merge page config with custom config', () => {
    const { updateSEOMeta } = require('../../utils/seo');
    
    renderHook(() => useSEO('home', { 
      title: 'Custom Title',
    }));

    expect(updateSEOMeta).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Custom Title',
        ogType: 'website', // From page config
      }),
      'zh-CN',
      '/'
    );
  });

  it('should handle noIndex for private pages', () => {
    const { updateSEOMeta } = require('../../utils/seo');
    
    renderHook(() => useSEO('dashboard'));

    expect(updateSEOMeta).toHaveBeenCalledWith(
      expect.objectContaining({
        noIndex: true,
      }),
      'zh-CN',
      '/'
    );
  });

  it('should convert keywords array to string', () => {
    const { updateSEOMeta } = require('../../utils/seo');
    
    renderHook(() => useSEO({ 
      keywords: ['trading', 'algorithm', 'AI'],
    }));

    expect(updateSEOMeta).toHaveBeenCalledWith(
      expect.objectContaining({
        keywords: 'trading, algorithm, AI',
      }),
      'zh-CN',
      '/'
    );
  });
});

describe('PAGE_SEO_CONFIGS', () => {
  it('should have config for all key pages', () => {
    const expectedPages = [
      'home',
      'landing',
      'dashboard',
      'strategies',
      'trades',
      'holdings',
      'leaderboard',
      'performance',
      'backtest',
      'marketplace',
      'subscription',
      'login',
      'register',
      'apiDocs',
    ];

    expectedPages.forEach(page => {
      expect(PAGE_SEO_CONFIGS[page as keyof typeof PAGE_SEO_CONFIGS]).toBeDefined();
    });
  });

  it('should have ogType for public pages', () => {
    const publicPages = ['home', 'landing', 'login', 'register', 'leaderboard', 'subscription', 'marketplace', 'apiDocs'];
    
    publicPages.forEach(page => {
      const config = PAGE_SEO_CONFIGS[page as keyof typeof PAGE_SEO_CONFIGS];
      expect(config.ogType).toBe('website');
    });
  });

  it('should have noIndex for private pages', () => {
    const privatePages = ['dashboard', 'strategies', 'trades', 'holdings', 'performance', 'backtest'];
    
    privatePages.forEach(page => {
      const config = PAGE_SEO_CONFIGS[page as keyof typeof PAGE_SEO_CONFIGS];
      expect(config.noIndex).toBe(true);
    });
  });

  it('login page should have noIndex', () => {
    // Login pages should typically have noIndex to prevent search indexing
    // But we allow it for SEO purposes in this case
    expect(PAGE_SEO_CONFIGS.login.noIndex).toBe(true);
  });

  it('register page should have ogType website', () => {
    expect(PAGE_SEO_CONFIGS.register.ogType).toBe('website');
  });
});