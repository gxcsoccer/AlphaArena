/**
 * SEO Utilities Tests
 * Issue #617: International SEO Optimization
 */

import {
  updateSEO,
  updateSEOMeta,
  generateShareUrl,
  copyShareUrl,
  generateWebsiteStructuredData,
  generateSoftwareStructuredData,
  updateHreflangTags,
  getUrlWithLang,
  SITE_URL,
} from '../../src/client/utils/seo';

describe('SEO Utilities', () => {
  beforeEach(() => {
    // Clear document head
    document.head.innerHTML = '';
    document.title = '';
  });

  describe('updateSEO (legacy)', () => {
    it('updates document title', () => {
      updateSEO({ title: 'Test Title' });
      expect(document.title).toBe('Test Title');
    });

    it('creates meta description tag', () => {
      updateSEO({ description: 'Test description' });
      const meta = document.querySelector('meta[name="description"]');
      expect(meta).not.toBeNull();
      expect(meta?.getAttribute('content')).toBe('Test description');
    });

    it('creates Open Graph meta tags', () => {
      updateSEO({ 
        title: 'OG Title',
        ogType: 'website' 
      });
      
      const ogTitle = document.querySelector('meta[property="og:title"]');
      expect(ogTitle).not.toBeNull();
      expect(ogTitle?.getAttribute('content')).toBe('OG Title');
      
      const ogType = document.querySelector('meta[property="og:type"]');
      expect(ogType).not.toBeNull();
    });

    it('creates Twitter meta tags', () => {
      updateSEO({ 
        title: 'Twitter Title',
        twitterCard: 'summary_large_image' 
      });
      
      const twitterCard = document.querySelector('meta[name="twitter:card"]');
      expect(twitterCard).not.toBeNull();
      expect(twitterCard?.getAttribute('content')).toBe('summary_large_image');
      
      const twitterTitle = document.querySelector('meta[name="twitter:title"]');
      expect(twitterTitle).not.toBeNull();
      expect(twitterTitle?.getAttribute('content')).toBe('Twitter Title');
    });

    it('creates keywords meta tag', () => {
      updateSEO({ keywords: ['test', 'keywords'] });
      const meta = document.querySelector('meta[name="keywords"]');
      expect(meta).not.toBeNull();
      expect(meta?.getAttribute('content')).toBe('test, keywords');
    });

    it('creates canonical link', () => {
      updateSEO({ canonicalUrl: 'https://example.com' });
      const link = document.querySelector('link[rel="canonical"]');
      expect(link).not.toBeNull();
      expect(link?.getAttribute('href')).toBe('https://example.com');
    });
  });

  describe('updateSEOMeta (i18n)', () => {
    it('updates document title with language suffix for non-default languages', () => {
      updateSEOMeta({
        title: 'Test Title',
        description: 'Test description',
      }, 'en-US');
      
      expect(document.title).toContain('Test Title');
      expect(document.title).toContain('English');
    });

    it('does not add language suffix for default language', () => {
      updateSEOMeta({
        title: 'Test Title',
        description: 'Test description',
      }, 'zh-CN');
      
      expect(document.title).toBe('Test Title');
    });

    it('creates hreflang tags when path is provided', () => {
      updateSEOMeta({
        title: 'Test',
        description: 'Test',
      }, 'zh-CN', '/test');
      
      const hreflangs = document.querySelectorAll('link[rel="alternate"][hreflang]');
      expect(hreflangs.length).toBeGreaterThan(0);
      
      // Should have x-default
      const xDefault = document.querySelector('link[hreflang="x-default"]');
      expect(xDefault).not.toBeNull();
    });
  });

  describe('generateShareUrl', () => {
    it('generates URL with UTM parameters', () => {
      const url = generateShareUrl('twitter', 'social', 'landing');
      expect(url).toContain('utm_source=twitter');
      expect(url).toContain('utm_medium=social');
      expect(url).toContain('utm_campaign=landing');
    });

    it('uses default medium and campaign', () => {
      const url = generateShareUrl('web');
      expect(url).toContain('utm_source=web');
      expect(url).toContain('utm_medium=share');
      expect(url).toContain('utm_campaign=landing');
    });
  });

  describe('copyShareUrl', () => {
    it('copies URL to clipboard', async () => {
      const mockWriteText = jest.fn().mockResolvedValue(undefined);
      Object.defineProperty(navigator, 'clipboard', {
        value: { writeText: mockWriteText },
        writable: true,
      });

      const result = await copyShareUrl('web');
      expect(result).toBe(true);
      expect(mockWriteText).toHaveBeenCalled();
    });
  });

  describe('generateWebsiteStructuredData', () => {
    it('generates valid JSON-LD for WebSite', () => {
      const data = generateWebsiteStructuredData('zh-CN');
      expect(data).toHaveProperty('@context', 'https://schema.org');
      expect(data).toHaveProperty('@type', 'WebSite');
      expect(data).toHaveProperty('name', 'AlphaArena');
      expect(data).toHaveProperty('potentialAction');
    });

    it('generates language-specific descriptions', () => {
      const zhData = generateWebsiteStructuredData('zh-CN');
      const enData = generateWebsiteStructuredData('en-US');
      
      // Both should have descriptions
      expect((zhData as any).description).toBeDefined();
      expect((enData as any).description).toBeDefined();
    });
  });

  describe('generateSoftwareStructuredData', () => {
    it('generates valid JSON-LD for SoftwareApplication', () => {
      const data = generateSoftwareStructuredData();
      expect(data).toHaveProperty('@context', 'https://schema.org');
      expect(data).toHaveProperty('@type', 'SoftwareApplication');
      expect(data).toHaveProperty('name', 'AlphaArena');
      expect(data).toHaveProperty('offers');
      expect(data).toHaveProperty('aggregateRating');
    });
  });

  describe('getUrlWithLang', () => {
    it('returns URL without lang parameter for default language', () => {
      const url = getUrlWithLang('/test', 'zh-CN');
      expect(url).toBe(`${SITE_URL}/test`);
      expect(url).not.toContain('?lang=');
    });

    it('returns URL with lang parameter for non-default languages', () => {
      const url = getUrlWithLang('/test', 'en-US');
      expect(url).toBe(`${SITE_URL}/test?lang=en-US`);
    });
  });

  describe('updateHreflangTags', () => {
    it('creates hreflang tags for all supported languages', () => {
      updateHreflangTags('/test', 'zh-CN');
      
      const hreflangs = document.querySelectorAll('link[rel="alternate"][hreflang]');
      expect(hreflangs.length).toBe(5); // 4 languages + x-default
      
      // Check for x-default
      const xDefault = document.querySelector('link[hreflang="x-default"]');
      expect(xDefault).not.toBeNull();
      
      // Check for each language
      ['zh-CN', 'en-US', 'ja-JP', 'ko-KR'].forEach(lang => {
        const link = document.querySelector(`link[hreflang="${lang}"]`);
        expect(link).not.toBeNull();
      });
    });
  });
});