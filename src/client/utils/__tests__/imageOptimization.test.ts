/**
 * Image Optimization Utilities Tests
 * 
 * Issue #559: Image and Static Resource Optimization
 */

import {
  supportsWebp,
  supportsAvif,
  getBestSupportedFormat,
  isCdnUrl,
  getOptimizedImageUrl,
  generateSrcSet,
  generateSizes,
  generateBlurPlaceholder,
  generateGradientPlaceholder,
  calculateAspectRatio,
  calculateHeight,
  calculateWidth,
  IMAGE_PRESETS,
} from '../imageOptimization';
import type { ImageBreakpoint } from '../../components/Picture';

// Mock canvas
HTMLCanvasElement.prototype.getContext = jest.fn().mockReturnValue({});
HTMLCanvasElement.prototype.toDataURL = jest.fn((type: string) => {
  if (type === 'image/webp') return 'data:image/webp;base64,test';
  return 'data:image/png;base64,test';
});

describe('Image Optimization Utilities', () => {
  describe('Format Detection', () => {
    it('detects WebP support', () => {
      const result = supportsWebp();
      expect(typeof result).toBe('boolean');
    });

    it('detects AVIF support', () => {
      const result = supportsAvif();
      expect(typeof result).toBe('boolean');
    });

    it('returns best supported format', () => {
      const format = getBestSupportedFormat();
      expect(['original', 'webp', 'avif']).toContain(format);
    });
  });

  describe('URL Generation', () => {
    it('returns data URLs unchanged', () => {
      const dataUrl = 'data:image/png;base64,test';
      const result = getOptimizedImageUrl(dataUrl);
      expect(result).toBe(dataUrl);
    });

    it('adds format parameter to URL', () => {
      const result = getOptimizedImageUrl('/test.jpg', { format: 'webp' });
      expect(result).toContain('format=webp');
    });

    it('adds width parameter to URL', () => {
      const result = getOptimizedImageUrl('/test.jpg', { width: 200 });
      expect(result).toContain('width=200');
    });

    it('adds quality parameter to URL', () => {
      const result = getOptimizedImageUrl('/test.jpg', { quality: 90 });
      expect(result).toContain('quality=90');
    });

    it('combines multiple parameters', () => {
      const result = getOptimizedImageUrl('/test.jpg', {
        format: 'webp',
        width: 200,
        quality: 90,
      });
      expect(result).toContain('format=webp');
      expect(result).toContain('width=200');
      expect(result).toContain('quality=90');
    });
  });

  describe('CDN Detection', () => {
    it('identifies CDN URLs', () => {
      const result = isCdnUrl('https://cdn.example.com/image.jpg', ['cdn.example.com']);
      expect(result).toBe(true);
    });

    it('returns false for non-CDN URLs', () => {
      const result = isCdnUrl('/local/image.jpg', ['cdn.example.com']);
      expect(result).toBe(false);
    });

    it('returns false for relative URLs', () => {
      const result = isCdnUrl('/image.jpg', []);
      expect(result).toBe(false);
    });
  });

  describe('srcset Generation', () => {
    const breakpoints: ImageBreakpoint[] = [
      { width: 100, imageWidth: 100, descriptor: '100w' },
      { width: 200, imageWidth: 200, descriptor: '200w' },
    ];

    it('generates srcset from breakpoints', () => {
      const result = generateSrcSet('/test.jpg', breakpoints);
      expect(result).toContain('100w');
      expect(result).toContain('200w');
    });

    it('includes format parameter', () => {
      const result = generateSrcSet('/test.jpg', breakpoints, { format: 'webp' });
      expect(result).toContain('format=webp');
    });
  });

  describe('Sizes Generation', () => {
    const breakpoints: ImageBreakpoint[] = [
      { width: 320, imageWidth: 320, descriptor: '320w' },
      { width: 768, imageWidth: 768, descriptor: '768w' },
    ];

    it('generates sizes attribute from breakpoints', () => {
      const result = generateSizes(breakpoints);
      expect(result).toContain('max-width');
      expect(result).toContain('px');
    });

    it('returns default size if no breakpoints', () => {
      const result = generateSizes([], '100vw');
      expect(result).toBe('100vw');
    });
  });

  describe('Placeholder Generation', () => {
    it('generates blur placeholder', () => {
      const result = generateBlurPlaceholder(10, 10, '#f0f0f0');
      expect(result).toContain('data:image/svg+xml');
      expect(result).toContain('f0f0f0');
    });

    it('generates gradient placeholder', () => {
      const result = generateGradientPlaceholder(10, 10, ['#fff', '#000']);
      expect(result).toContain('data:image/svg+xml');
      expect(result).toContain('linearGradient');
    });
  });

  describe('Aspect Ratio Calculations', () => {
    it('calculates aspect ratio', () => {
      const result = calculateAspectRatio(1920, 1080);
      expect(result).toBeCloseTo(16/9, 2);
    });

    it('calculates height from width and aspect ratio', () => {
      const result = calculateHeight(1920, 16/9);
      expect(result).toBe(1080);
    });

    it('calculates width from height and aspect ratio', () => {
      const result = calculateWidth(1080, 16/9);
      expect(result).toBe(1920);
    });
  });

  describe('Image Presets', () => {
    it('THUMBNAIL preset has correct breakpoints', () => {
      expect(IMAGE_PRESETS.thumbnail.breakpoints).toHaveLength(3);
      expect(IMAGE_PRESETS.thumbnail.breakpoints[0].width).toBe(100);
    });

    it('AVATAR preset has correct breakpoints', () => {
      expect(IMAGE_PRESETS.avatar.breakpoints).toHaveLength(3);
      expect(IMAGE_PRESETS.avatar.sizes).toBe('40px');
    });

    it('HERO preset has correct breakpoints', () => {
      expect(IMAGE_PRESETS.hero.breakpoints).toHaveLength(5);
      expect(IMAGE_PRESETS.hero.sizes).toBe('100vw');
    });

    it('CARD preset has correct breakpoints', () => {
      expect(IMAGE_PRESETS.card.breakpoints).toHaveLength(3);
    });
  });
});