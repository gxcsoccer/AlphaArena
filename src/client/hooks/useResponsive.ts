import { useState, useEffect, useCallback } from 'react';

/**
 * Breakpoint definitions matching Tailwind CSS defaults
 */
export const breakpoints = {
  sm: 640,   // Small phones
  md: 768,   // Large phones / small tablets
  lg: 1024,  // Tablets / small laptops
  xl: 1280,  // Desktop
  '2xl': 1536, // Large desktop
} as const;

export type Breakpoint = keyof typeof breakpoints;

export interface ResponsiveState {
  /** Current window width */
  width: number;
  /** Current window height */
  height: number;
  /** Is mobile device (width <= 768px) */
  isMobile: boolean;
  /** Is tablet device (width > 768px && width <= 1024px) */
  isTablet: boolean;
  /** Is desktop device (width > 1024px) */
  isDesktop: boolean;
  /** Is touch device */
  isTouchDevice: boolean;
  /** Current breakpoint name */
  breakpoint: Breakpoint;
  /** Safe area insets for notched devices */
  safeAreaInsets: {
    top: number;
    bottom: number;
    left: number;
    right: number;
  };
}

/**
 * Get safe area insets from CSS environment variables
 */
function getSafeAreaInsets(): ResponsiveState['safeAreaInsets'] {
  if (typeof window === 'undefined') {
    return { top: 0, bottom: 0, left: 0, right: 0 };
  }

  const computedStyle = getComputedStyle(document.documentElement);
  return {
    top: parseInt(computedStyle.getPropertyValue('--safe-area-inset-top') || '0', 10),
    bottom: parseInt(computedStyle.getPropertyValue('--safe-area-inset-bottom') || '0', 10),
    left: parseInt(computedStyle.getPropertyValue('--safe-area-inset-left') || '0', 10),
    right: parseInt(computedStyle.getPropertyValue('--safe-area-inset-right') || '0', 10),
  };
}

/**
 * Detect if device supports touch
 */
function detectTouchDevice(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    'ontouchstart' in window ||
    navigator.maxTouchPoints > 0 ||
    // @ts-ignore
    navigator.msMaxTouchPoints > 0
  );
}

/**
 * Get current breakpoint name based on window width
 */
function getBreakpoint(width: number): Breakpoint {
  if (width < breakpoints.sm) return 'sm';
  if (width < breakpoints.md) return 'sm';
  if (width < breakpoints.lg) return 'md';
  if (width < breakpoints.xl) return 'lg';
  if (width < breakpoints['2xl']) return 'xl';
  return '2xl';
}

/**
 * Hook for responsive design with mobile-first approach
 * 
 * @example
 * ```tsx
 * const { isMobile, isTablet, isDesktop, width } = useResponsive();
 * 
 * return (
 *   <div style={{ padding: isMobile ? 8 : 24 }}>
 *     {isMobile ? <MobileNav /> : <DesktopNav />}
 *   </div>
 * );
 * ```
 */
export function useResponsive(): ResponsiveState {
  const [state, setState] = useState<ResponsiveState>(() => {
    if (typeof window === 'undefined') {
      return {
        width: 1024,
        height: 768,
        isMobile: false,
        isTablet: false,
        isDesktop: true,
        isTouchDevice: false,
        breakpoint: 'lg',
        safeAreaInsets: { top: 0, bottom: 0, left: 0, right: 0 },
      };
    }

    const width = window.innerWidth;
    const height = window.innerHeight;
    const isMobile = width <= breakpoints.md;
    const isTablet = width > breakpoints.md && width <= breakpoints.lg;
    const isDesktop = width > breakpoints.lg;

    return {
      width,
      height,
      isMobile,
      isTablet,
      isDesktop,
      isTouchDevice: detectTouchDevice(),
      breakpoint: getBreakpoint(width),
      safeAreaInsets: getSafeAreaInsets(),
    };
  });

  const handleResize = useCallback(() => {
    const width = window.innerWidth;
    const height = window.innerHeight;
    const isMobile = width <= breakpoints.md;
    const isTablet = width > breakpoints.md && width <= breakpoints.lg;
    const isDesktop = width > breakpoints.lg;

    setState({
      width,
      height,
      isMobile,
      isTablet,
      isDesktop,
      isTouchDevice: detectTouchDevice(),
      breakpoint: getBreakpoint(width),
      safeAreaInsets: getSafeAreaInsets(),
    });
  }, []);

  useEffect(() => {
    // Initial measurement
    handleResize();

    // Add resize listener
    window.addEventListener('resize', handleResize);

    // Add orientation change listener for mobile devices
    window.addEventListener('orientationchange', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
    };
  }, [handleResize]);

  return state;
}

/**
 * Hook for media query matching
 * 
 * @example
 * ```tsx
 * const matches = useMediaQuery('(max-width: 768px)');
 * ```
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const mediaQuery = window.matchMedia(query);
    setMatches(mediaQuery.matches);

    const handler = (event: MediaQueryListEvent) => {
      setMatches(event.matches);
    };

    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, [query]);

  return matches;
}

/**
 * Hook for detecting landscape orientation
 */
export function useIsLandscape(): boolean {
  const { width, height } = useResponsive();
  return width > height;
}

/**
 * Hook for detecting portrait orientation
 */
export function useIsPortrait(): boolean {
  const { width, height } = useResponsive();
  return width <= height;
}

export default useResponsive;
