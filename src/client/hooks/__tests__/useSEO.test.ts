/**
 * Tests for useSEO hook
 */

import { renderHook, act } from '@testing-library/react';
import { useSEO, PAGE_SEO_CONFIGS } from '../useSEO';
import { updateSEO, addStructuredData } from '../../utils/seo';

// Mock the seo utils
jest.mock('../../utils/seo', () => ({
  updateSEO: jest.fn(),
  addStructuredData: jest.fn(),
}));

describe('useSEO hook', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should call updateSEO with provided config', () => {
    const config = {
      title: 'Test Page - AlphaArena',
      description: 'Test description',
      keywords: ['test', 'page'],
    };

    renderHook(() => useSEO(config));

    expect(updateSEO).toHaveBeenCalledWith(config);
  });

  it('should call updateSEO with empty object by default', () => {
    renderHook(() => useSEO());

    expect(updateSEO).toHaveBeenCalledWith({});
  });

  it('should add structured data when provided', () => {
    const structuredData = {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: 'Test Page',
    };

    renderHook(() => useSEO({ structuredData }));

    expect(addStructuredData).toHaveBeenCalledWith(structuredData);
  });

  it('should add multiple structured data items when array provided', () => {
    const structuredData = [
      { '@type': 'WebPage', name: 'Page 1' },
      { '@type': 'Article', name: 'Article 1' },
    ];

    renderHook(() => useSEO({ structuredData }));

    expect(addStructuredData).toHaveBeenCalledTimes(2);
    expect(addStructuredData).toHaveBeenCalledWith(structuredData[0]);
    expect(addStructuredData).toHaveBeenCalledWith(structuredData[1]);
  });

  it('should update SEO when config changes', () => {
    const { rerender } = renderHook(
      ({ title }) => useSEO({ title }),
      { initialProps: { title: 'Initial Title' } }
    );

    expect(updateSEO).toHaveBeenCalledWith({ title: 'Initial Title' });

    rerender({ title: 'Updated Title' });

    expect(updateSEO).toHaveBeenCalledWith({ title: 'Updated Title' });
    expect(updateSEO).toHaveBeenCalledTimes(3); // Initial + cleanup + updated
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
      expect(PAGE_SEO_CONFIGS[page]).toBeDefined();
      expect(PAGE_SEO_CONFIGS[page].title).toBeDefined();
      expect(PAGE_SEO_CONFIGS[page].description).toBeDefined();
    });
  });

  it('should have proper title format', () => {
    Object.entries(PAGE_SEO_CONFIGS).forEach(([page, config]) => {
      // All titles should include AlphaArena
      expect(config.title).toContain('AlphaArena');
    });
  });

  it('should have Chinese descriptions for Chinese market', () => {
    // Check that descriptions are in Chinese for key pages
    const chineseKeywords = ['交易', '平台', '策略', '投资'];
    
    Object.entries(PAGE_SEO_CONFIGS).forEach(([page, config]) => {
      const hasChinese = chineseKeywords.some(keyword => 
        config.description?.includes(keyword)
      );
      // Most pages should have Chinese in description
      // Exception might be API docs or other technical pages
      if (['home', 'landing', 'dashboard', 'strategies'].includes(page)) {
        expect(hasChinese).toBe(true);
      }
    });
  });

  it('login and register pages should have ogType website', () => {
    expect(PAGE_SEO_CONFIGS.login.ogType).toBe('website');
    expect(PAGE_SEO_CONFIGS.register.ogType).toBe('website');
  });
});