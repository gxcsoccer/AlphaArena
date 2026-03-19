/**
 * Tests for useMediaQuery Hook
 */

import { renderHook, act } from '@testing-library/react';
import { useMediaQuery, useMatchMedia, useResponsiveValue, useTouchDevice, BREAKPOINTS } from '../../../src/client/hooks/useMediaQuery';

describe('useMediaQuery Hook', () => {
  const originalInnerWidth = window.innerWidth;
  const originalInnerHeight = window.innerHeight;

  beforeEach(() => {
    // Reset window dimensions
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 1024,
    });
    Object.defineProperty(window, 'innerHeight', {
      writable: true,
      configurable: true,
      value: 768,
    });
  });

  afterEach(() => {
    // Restore original values
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: originalInnerWidth,
    });
    Object.defineProperty(window, 'innerHeight', {
      writable: true,
      configurable: true,
      value: originalInnerHeight,
    });
  });

  describe('Device Type Detection', () => {
    it('should detect mobile when width < 768px', () => {
      window.innerWidth = 375;
      window.innerHeight = 667;

      const { result } = renderHook(() => useMediaQuery());

      expect(result.current.isMobile).toBe(true);
      expect(result.current.deviceType).toBe('mobile');
    });

    it('should detect tablet when 768px <= width < 1024px', () => {
      window.innerWidth = 800;
      window.innerHeight = 600;

      const { result } = renderHook(() => useMediaQuery());

      expect(result.current.isTablet).toBe(true);
      expect(result.current.deviceType).toBe('tablet');
    });

    it('should detect desktop when width >= 1024px', () => {
      window.innerWidth = 1280;
      window.innerHeight = 720;

      const { result } = renderHook(() => useMediaQuery());

      expect(result.current.isDesktop).toBe(true);
      expect(result.current.deviceType).toBe('desktop');
    });
  });

  describe('Orientation Detection', () => {
    it('should detect landscape when width > height', () => {
      window.innerWidth = 1024;
      window.innerHeight = 768;

      const { result } = renderHook(() => useMediaQuery());

      expect(result.current.isLandscape).toBe(true);
      expect(result.current.isPortrait).toBe(false);
    });

    it('should detect portrait when width <= height', () => {
      window.innerWidth = 375;
      window.innerHeight = 667;

      const { result } = renderHook(() => useMediaQuery());

      expect(result.current.isPortrait).toBe(true);
      expect(result.current.isLandscape).toBe(false);
    });
  });

  describe('Breakpoint Detection', () => {
    it('should return correct breakpoint for extra small screens', () => {
      window.innerWidth = 300;

      const { result } = renderHook(() => useMediaQuery());

      expect(result.current.breakpoint).toBe('xs');
    });

    it('should return correct breakpoint for small screens', () => {
      window.innerWidth = 500;

      const { result } = renderHook(() => useMediaQuery());

      expect(result.current.breakpoint).toBe('sm');
    });

    it('should return correct breakpoint for medium screens (tablet)', () => {
      window.innerWidth = 800;

      const { result } = renderHook(() => useMediaQuery());

      expect(result.current.breakpoint).toBe('md');
    });

    it('should return correct breakpoint for large screens', () => {
      window.innerWidth = 1280;

      const { result } = renderHook(() => useMediaQuery());

      expect(result.current.breakpoint).toBe('lg');
    });

    it('should return correct breakpoint for extra large screens', () => {
      window.innerWidth = 1500;

      const { result } = renderHook(() => useMediaQuery());

      expect(result.current.breakpoint).toBe('xl');
    });

    it('should return correct breakpoint for extra extra large screens', () => {
      window.innerWidth = 2000;

      const { result } = renderHook(() => useMediaQuery());

      expect(result.current.breakpoint).toBe('xxl');
    });
  });

  describe('Touch Detection', () => {
    it('should detect touch capability', () => {
      // Mock touch capability
      Object.defineProperty(window, 'ontouchstart', {
        writable: true,
        value: {},
      });

      const { result } = renderHook(() => useMediaQuery());

      expect(result.current.hasTouch).toBe(true);
    });
  });

  describe('Pixel Ratio', () => {
    it('should return device pixel ratio', () => {
      Object.defineProperty(window, 'devicePixelRatio', {
        writable: true,
        value: 2,
      });

      const { result } = renderHook(() => useMediaQuery());

      expect(result.current.pixelRatio).toBe(2);
    });
  });
});

describe('useMatchMedia Hook', () => {
  beforeEach(() => {
    // Mock matchMedia
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: jest.fn().mockImplementation(query => ({
        matches: query.includes('max-width: 768'),
        media: query,
        onchange: null,
        addListener: jest.fn(),
        removeListener: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        dispatchEvent: jest.fn(),
      })),
    });
  });

  it('should return true when query matches', () => {
    const { result } = renderHook(() => useMatchMedia('(max-width: 768px)'));

    expect(result.current).toBe(true);
  });

  it('should return false when query does not match', () => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: jest.fn().mockImplementation(query => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: jest.fn(),
        removeListener: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        dispatchEvent: jest.fn(),
      })),
    });

    const { result } = renderHook(() => useMatchMedia('(min-width: 1024px)'));

    expect(result.current).toBe(false);
  });
});

describe('useResponsiveValue Hook', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 1024,
    });
  });

  it('should return mobile value on mobile', () => {
    window.innerWidth = 375;

    const { result } = renderHook(() => useResponsiveValue({
      mobile: 1,
      tablet: 2,
      desktop: 4,
    }));

    expect(result.current).toBe(1);
  });

  it('should return tablet value on tablet', () => {
    window.innerWidth = 800;

    const { result } = renderHook(() => useResponsiveValue({
      mobile: 1,
      tablet: 2,
      desktop: 4,
    }));

    expect(result.current).toBe(2);
  });

  it('should return desktop value on desktop', () => {
    window.innerWidth = 1280;

    const { result } = renderHook(() => useResponsiveValue({
      mobile: 1,
      tablet: 2,
      desktop: 4,
    }));

    expect(result.current).toBe(4);
  });

  it('should fallback to mobile value for tablet if tablet value not provided', () => {
    window.innerWidth = 800;

    const { result } = renderHook(() => useResponsiveValue({
      mobile: 1,
      desktop: 4,
    }));

    expect(result.current).toBe(1);
  });
});

describe('useTouchDevice Hook', () => {
  it('should return true when touch is available', () => {
    Object.defineProperty(window, 'ontouchstart', {
      writable: true,
      value: {},
    });
    Object.defineProperty(navigator, 'maxTouchPoints', {
      writable: true,
      value: 5,
    });

    const { result } = renderHook(() => useTouchDevice());

    expect(result.current).toBe(true);
  });

  it('should return false when touch is not available', () => {
    Object.defineProperty(window, 'ontouchstart', {
      writable: true,
      value: undefined,
    });
    Object.defineProperty(navigator, 'maxTouchPoints', {
      writable: true,
      value: 0,
    });

    const { result } = renderHook(() => useTouchDevice());

    expect(result.current).toBe(false);
  });
});

describe('BREAKPOINTS constant', () => {
  it('should have correct breakpoint values', () => {
    expect(BREAKPOINTS.xs).toBe(320);
    expect(BREAKPOINTS.sm).toBe(480);
    expect(BREAKPOINTS.md).toBe(768);
    expect(BREAKPOINTS.lg).toBe(1024);
    expect(BREAKPOINTS.xl).toBe(1440);
    expect(BREAKPOINTS.xxl).toBe(1920);
  });

  it('should have breakpoints in ascending order', () => {
    const values = Object.values(BREAKPOINTS);
    for (let i = 1; i < values.length; i++) {
      expect(values[i]).toBeGreaterThan(values[i - 1]);
    }
  });
});