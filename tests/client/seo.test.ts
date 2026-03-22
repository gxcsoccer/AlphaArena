/**
 * SEO Utilities Tests
 */

import {
  updateSEO,
  generateShareUrl,
  copyShareUrl,
  generateWebsiteStructuredData,
  generateSoftwareStructuredData,
} from '../../src/client/utils/seo';

describe('SEO Utilities', () => {
  beforeEach(() => {
    // Clear document head
    document.head.innerHTML = '';
  });

  describe('updateSEO', () => {
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
      const data = generateWebsiteStructuredData();
      expect(data).toHaveProperty('@context', 'https://schema.org');
      expect(data).toHaveProperty('@type', 'WebSite');
      expect(data).toHaveProperty('name', 'AlphaArena');
      expect(data).toHaveProperty('potentialAction');
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
});