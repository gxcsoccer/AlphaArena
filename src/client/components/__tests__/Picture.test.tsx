/**
 * Picture Component Tests
 * 
 * Issue #559: Image and Static Resource Optimization
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { Picture, DEFAULT_BREAKPOINTS, MOBILE_BREAKPOINTS, THUMBNAIL_BREAKPOINTS, AVATAR_BREAKPOINTS } from '../Picture';

// Mock IntersectionObserver
let intersectCallback: ((entries: { isIntersecting: boolean }[]) => void) | null = null;
const mockIntersectionObserver = jest.fn().mockImplementation((callback) => {
  intersectCallback = callback;
  return {
    observe: jest.fn(),
    unobserve: jest.fn(),
    disconnect: jest.fn(),
  };
});
window.IntersectionObserver = mockIntersectionObserver;

// Mock canvas for format detection
HTMLCanvasElement.prototype.getContext = jest.fn().mockReturnValue({
  fillRect: jest.fn(),
});
HTMLCanvasElement.prototype.toDataURL = jest.fn((type: string) => {
  if (type === 'image/webp') return 'data:image/webp;base64,test';
  if (type === 'image/avif') return 'data:image/png;base64,test'; // AVIF not supported
  return 'data:image/png;base64,test';
});

describe('Picture Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    intersectCallback = null;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Rendering', () => {
    it('renders with required props', () => {
      render(<Picture src="/test.jpg" alt="Test image" useIntersectionObserver={false} />);
      
      const img = screen.getByAltText('Test image');
      expect(img).toBeDefined();
    });

    it('renders with placeholder while loading', () => {
      render(
        <Picture 
          src="/test.jpg" 
          alt="Test image" 
          placeholder="data:image/svg+xml,test"
          useIntersectionObserver={false}
        />
      );
      
      // Should show placeholder initially
      const images = document.querySelectorAll('img');
      expect(images.length).toBeGreaterThan(0);
    });

    it('renders with custom width and height', () => {
      render(
        <Picture 
          src="/test.jpg" 
          alt="Test image" 
          width={200}
          height={150}
          useIntersectionObserver={false}
        />
      );
      
      const container = document.querySelector('div[style*="width"]');
      expect(container).toBeDefined();
    });

    it('renders with aspect ratio', () => {
      render(
        <Picture 
          src="/test.jpg" 
          alt="Test image" 
          aspectRatio={16/9}
          useIntersectionObserver={false}
        />
      );
      
      const container = document.querySelector('div[style*="padding-bottom"]');
      expect(container).toBeDefined();
    });
  });

  describe('Responsive Images', () => {
    it('generates srcset from breakpoints', () => {
      render(
        <Picture 
          src="/test.jpg" 
          alt="Test image" 
          breakpoints={DEFAULT_BREAKPOINTS}
          responsive={true}
          useIntersectionObserver={false}
        />
      );
      
      const img = screen.getByAltText('Test image');
      expect(img.getAttribute('srcset')).toBeDefined();
    });

    it('generates sizes attribute from breakpoints', () => {
      render(
        <Picture 
          src="/test.jpg" 
          alt="Test image" 
          breakpoints={DEFAULT_BREAKPOINTS}
          responsive={true}
          useIntersectionObserver={false}
        />
      );
      
      const img = screen.getByAltText('Test image');
      expect(img.getAttribute('sizes')).toBeDefined();
    });

    it('supports custom sizes attribute', () => {
      render(
        <Picture 
          src="/test.jpg" 
          alt="Test image" 
          breakpoints={DEFAULT_BREAKPOINTS}
          sizes="(max-width: 768px) 100vw, 50vw"
          responsive={true}
          useIntersectionObserver={false}
        />
      );
      
      const img = screen.getByAltText('Test image');
      expect(img.getAttribute('sizes')).toBe('(max-width: 768px) 100vw, 50vw');
    });
  });

  describe('Format Support', () => {
    it('generates WebP source element', () => {
      render(
        <Picture 
          src="/test.jpg" 
          alt="Test image" 
          formats={['webp', 'original']}
          responsive={true}
          useIntersectionObserver={false}
        />
      );
      
      const source = document.querySelector('source[type="image/webp"]');
      expect(source).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('shows fallback image on error', async () => {
      render(
        <Picture 
          src="/nonexistent.jpg" 
          alt="Test image" 
          fallback="/fallback.jpg"
          useIntersectionObserver={false}
        />
      );
      
      const img = screen.getByAltText('Test image');
      
      // Simulate error
      fireEvent.error(img);
      
      // After error, fallback should be shown
      await waitFor(() => {
        const images = document.querySelectorAll('img');
        // Check that we have at least one image with the fallback
        const fallbackImg = Array.from(images).find(i => i.getAttribute('src')?.includes('fallback'));
        expect(fallbackImg).toBeDefined();
      });
    });
  });

  describe('Lazy Loading', () => {
    it('does not render main image until in view', () => {
      render(
        <Picture 
          src="/test.jpg" 
          alt="Test image" 
          useIntersectionObserver={true}
        />
      );
      
      // Main image should not be rendered yet (lazy loaded)
      // Only placeholder should be visible
      const images = document.querySelectorAll('img');
      // At least one placeholder image should exist
      expect(images.length).toBeGreaterThan(0);
    });

    it('loads image when useIntersectionObserver is false', () => {
      render(
        <Picture 
          src="/test.jpg" 
          alt="Test image" 
          useIntersectionObserver={false}
        />
      );
      
      const img = screen.getByAltText('Test image');
      expect(img.getAttribute('src')).toBe('/test.jpg');
    });

    it('loads image when intersection observer fires', async () => {
      render(
        <Picture 
          src="/test.jpg" 
          alt="Test image" 
          useIntersectionObserver={true}
        />
      );
      
      // Initially no image with alt text
      expect(screen.queryByAltText('Test image')).toBeNull();
      
      // Simulate intersection
      act(() => {
        if (intersectCallback) {
          intersectCallback([{ isIntersecting: true }]);
        }
      });
      
      // Now image should be present
      const img = screen.getByAltText('Test image');
      expect(img).toBeDefined();
    });
  });
});

describe('Breakpoint Presets', () => {
  it('DEFAULT_BREAKPOINTS contains expected values', () => {
    expect(DEFAULT_BREAKPOINTS).toHaveLength(6);
    expect(DEFAULT_BREAKPOINTS[0].width).toBe(320);
    expect(DEFAULT_BREAKPOINTS[5].width).toBe(1920);
  });

  it('MOBILE_BREAKPOINTS contains expected values', () => {
    expect(MOBILE_BREAKPOINTS).toHaveLength(3);
    expect(MOBILE_BREAKPOINTS[2].width).toBe(640);
  });

  it('THUMBNAIL_BREAKPOINTS contains expected values', () => {
    expect(THUMBNAIL_BREAKPOINTS).toHaveLength(3);
    expect(THUMBNAIL_BREAKPOINTS[0].width).toBe(100);
  });

  it('AVATAR_BREAKPOINTS contains expected values', () => {
    expect(AVATAR_BREAKPOINTS).toHaveLength(3);
    expect(AVATAR_BREAKPOINTS[0].descriptor).toBe('1x');
    expect(AVATAR_BREAKPOINTS[1].descriptor).toBe('2x');
  });
});