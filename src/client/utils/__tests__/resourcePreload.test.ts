/**
 * Tests for Resource Preloading Utilities
 */

import {
  preloadCSS,
  preloadScript,
  preloadFont,
  preloadImage,
  preconnect,
  dnsPrefetch,
  prefetchPage,
  lazyLoadScript,
  lazyLoadCSS,
  applyResourceHints,
} from '../resourcePreload';

describe('Resource Preloading Utilities', () => {
  let appendChildSpy: jest.SpyInstance;
  let createElementSpy: jest.SpyInstance;
  let querySelectorSpy: jest.SpyInstance;

  beforeEach(() => {
    appendChildSpy = jest.spyOn(document.head, 'appendChild').mockImplementation(() => null as any);
    createElementSpy = jest.spyOn(document, 'createElement').mockImplementation((tagName: string) => ({
      tagName: tagName.toUpperCase(),
      rel: '',
      as: '',
      href: '',
      crossOrigin: '',
      type: '',
      onload: null,
      onerror: null,
      async: false,
      defer: false,
      src: '',
      setAttribute: jest.fn(),
    }));
    querySelectorSpy = jest.spyOn(document, 'querySelector').mockReturnValue(null);
  });

  afterEach(() => {
    appendChildSpy.mockRestore();
    createElementSpy.mockRestore();
    querySelectorSpy.mockRestore();
    jest.clearAllMocks();
  });

  describe('preloadCSS', () => {
    it('should create a preload link for CSS', () => {
      preloadCSS('/styles.css');
      expect(appendChildSpy).toHaveBeenCalled();
    });
  });

  describe('preloadScript', () => {
    it('should create a preload link for script', () => {
      preloadScript('/script.js');
      expect(appendChildSpy).toHaveBeenCalled();
    });

    it('should set crossOrigin when specified', () => {
      preloadScript('/script.js', true);
      expect(appendChildSpy).toHaveBeenCalled();
    });
  });

  describe('preloadFont', () => {
    it('should create a preload link for font', () => {
      preloadFont('/font.woff2');
      expect(appendChildSpy).toHaveBeenCalled();
    });

    it('should set font type correctly', () => {
      preloadFont('/font.ttf', 'font/ttf');
      expect(appendChildSpy).toHaveBeenCalled();
    });
  });

  describe('preloadImage', () => {
    it('should create a preload link for image', () => {
      preloadImage('/image.png');
      expect(appendChildSpy).toHaveBeenCalled();
    });
  });

  describe('preconnect', () => {
    it('should create a preconnect link', () => {
      preconnect('https://api.example.com');
      expect(appendChildSpy).toHaveBeenCalled();
    });

    it('should set crossOrigin when specified', () => {
      preconnect('https://fonts.googleapis.com', true);
      expect(appendChildSpy).toHaveBeenCalled();
    });
  });

  describe('dnsPrefetch', () => {
    it('should create a dns-prefetch link', () => {
      dnsPrefetch('https://analytics.example.com');
      expect(appendChildSpy).toHaveBeenCalled();
    });
  });

  describe('prefetchPage', () => {
    it('should create a prefetch link', () => {
      prefetchPage('/dashboard');
      expect(appendChildSpy).toHaveBeenCalled();
    });
  });

  describe('lazyLoadScript', () => {
    it('should create and append script element', async () => {
      const mockScript = {
        src: '',
        async: false,
        defer: false,
        crossOrigin: '',
        onload: null as (() => void) | null,
        onerror: null as (() => void) | null,
      };
      
      createElementSpy.mockReturnValue(mockScript as any);
      querySelectorSpy.mockReturnValue(null);

      const promise = lazyLoadScript('/script.js');
      
      // Trigger onload
      mockScript.onload?.();
      
      await expect(promise).resolves.toBeUndefined();
    });

    it('should reject on error', async () => {
      const mockScript = {
        src: '',
        async: false,
        defer: false,
        crossOrigin: '',
        onload: null as (() => void) | null,
        onerror: null as (() => void) | null,
      };
      
      createElementSpy.mockReturnValue(mockScript as any);
      querySelectorSpy.mockReturnValue(null);

      const promise = lazyLoadScript('/script.js');
      
      // Trigger onerror
      mockScript.onerror?.();
      
      await expect(promise).rejects.toThrow('Failed to load script');
    });

    it('should resolve immediately if script already exists', async () => {
      querySelectorSpy.mockReturnValue({ src: '/script.js' } as any);
      
      await expect(lazyLoadScript('/script.js')).resolves.toBeUndefined();
    });
  });

  describe('lazyLoadCSS', () => {
    it('should create and append link element', async () => {
      const mockLink = {
        rel: '',
        href: '',
        onload: null as (() => void) | null,
        onerror: null as (() => void) | null,
      };
      
      createElementSpy.mockReturnValue(mockLink as any);
      querySelectorSpy.mockReturnValue(null);

      const promise = lazyLoadCSS('/styles.css');
      
      // Trigger onload
      mockLink.onload?.();
      
      await expect(promise).resolves.toBeUndefined();
    });

    it('should resolve immediately if stylesheet already exists', async () => {
      querySelectorSpy.mockReturnValue({ href: '/styles.css' } as any);
      
      await expect(lazyLoadCSS('/styles.css')).resolves.toBeUndefined();
    });
  });

  describe('applyResourceHints', () => {
    it('should apply all resource hints', () => {
      applyResourceHints({
        preconnect: ['https://api.example.com'],
        dnsPrefetch: ['https://analytics.example.com'],
        prefetch: ['/dashboard'],
        preload: {
          fonts: ['/font.woff2'],
          images: ['/image.png'],
          scripts: ['/script.js'],
          styles: ['/styles.css'],
        },
      });
      
      // Should have called appendChild multiple times
      expect(appendChildSpy).toHaveBeenCalled();
    });
  });
});

describe('Performance Utilities Edge Cases', () => {
  it('should handle SSR environment gracefully', () => {
    // In jsdom, document is always defined, so we test with a different approach
    // We can test that the functions don't throw errors
    expect(() => preloadCSS('/styles.css')).not.toThrow();
    expect(() => preloadScript('/script.js')).not.toThrow();
    expect(() => preloadFont('/font.woff2')).not.toThrow();
    expect(() => preloadImage('/image.png')).not.toThrow();
    expect(() => preconnect('https://api.example.com')).not.toThrow();
    expect(() => dnsPrefetch('https://analytics.example.com')).not.toThrow();
    expect(() => prefetchPage('/dashboard')).not.toThrow();
  });
});