import { useState, useEffect, useCallback } from 'react';

/**
 * Breakpoint definitions matching the CSS media queries
 * These extend the basic breakpoints in useResponsive.ts with more granular mobile sizes
 */
export const BREAKPOINTS = {
  xs: 320,    // Extra small phones
  sm: 480,    // Small phones
  md: 768,    // Tablets / small laptops
  lg: 1024,   // Desktops
  xl: 1440,   // Large desktops
  xxl: 1920,  // Extra large screens
} as const;

// Re-export from useResponsive for backward compatibility
export { breakpoints, useIsLandscape, useIsPortrait } from './useResponsive';

/**
 * Device type based on screen width
 */
export type DeviceType = 'mobile' | 'tablet' | 'desktop';

/**
 * Screen size information
 */
export interface ScreenInfo {
  width: number;
  height: number;
  deviceType: DeviceType;
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  isLandscape: boolean;
  isPortrait: boolean;
  hasTouch: boolean;
  pixelRatio: number;
  breakpoint: keyof typeof BREAKPOINTS;
}

/**
 * Hook for responsive design with media query support
 * 
 * @example
 * const { isMobile, deviceType, width } = useMediaQuery();
 * 
 * if (isMobile) {
 *   return <MobileLayout />;
 * }
 */
export function useMediaQuery(): ScreenInfo {
  const getScreenInfo = useCallback((): ScreenInfo => {
    const width = typeof window !== 'undefined' ? window.innerWidth : 1024;
    const height = typeof window !== 'undefined' ? window.innerHeight : 768;
    
    let deviceType: DeviceType = 'desktop';
    let breakpoint: keyof typeof BREAKPOINTS = 'lg';
    
    if (width < BREAKPOINTS.md) {
      deviceType = 'mobile';
      breakpoint = width < BREAKPOINTS.xs ? 'xs' : 
                   width < BREAKPOINTS.sm ? 'sm' : 'sm'; // 480-768 is still 'sm' for mobile
    } else if (width < BREAKPOINTS.lg) {
      deviceType = 'tablet';
      breakpoint = 'md';
    } else {
      deviceType = 'desktop';
      breakpoint = width < BREAKPOINTS.xl ? 'lg' : 
                   width < BREAKPOINTS.xxl ? 'xl' : 'xxl';
    }
    
    return {
      width,
      height,
      deviceType,
      isMobile: deviceType === 'mobile',
      isTablet: deviceType === 'tablet',
      isDesktop: deviceType === 'desktop',
      isLandscape: width > height,
      isPortrait: width <= height,
      hasTouch: typeof window !== 'undefined' && (
        'ontouchstart' in window || 
        navigator.maxTouchPoints > 0
      ),
      pixelRatio: typeof window !== 'undefined' ? window.devicePixelRatio : 1,
      breakpoint,
    };
  }, []);

  const [screenInfo, setScreenInfo] = useState<ScreenInfo>(getScreenInfo);

  useEffect(() => {
    const handleResize = () => {
      setScreenInfo(getScreenInfo());
    };

    // Debounced resize handler for performance
    let resizeTimer: NodeJS.Timeout;
    const debouncedResize = () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(handleResize, 100);
    };

    window.addEventListener('resize', debouncedResize);
    window.addEventListener('orientationchange', handleResize);

    return () => {
      window.removeEventListener('resize', debouncedResize);
      window.removeEventListener('orientationchange', handleResize);
      clearTimeout(resizeTimer);
    };
  }, [getScreenInfo]);

  return screenInfo;
}

/**
 * Hook for simple boolean media query matching
 * 
 * @example
 * const isMobile = useMatchMedia('(max-width: 768px)');
 */
export function useMatchMedia(query: string): boolean {
  const [matches, setMatches] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.matchMedia(query).matches;
    }
    return false;
  });

  useEffect(() => {
    const mediaQuery = window.matchMedia(query);
    
    const handler = (event: MediaQueryListEvent) => {
      setMatches(event.matches);
    };

    // Set initial value
    setMatches(mediaQuery.matches);

    // Modern browsers
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handler);
      return () => mediaQuery.removeEventListener('change', handler);
    }
    // Legacy browsers (Safari < 14)
    mediaQuery.addListener(handler);
    return () => mediaQuery.removeListener(handler);
  }, [query]);

  return matches;
}

/**
 * Hook for detecting if the device has touch capability
 */
export function useTouchDevice(): boolean {
  const [hasTouch, setHasTouch] = useState(() => {
    if (typeof window !== 'undefined') {
      return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    }
    return false;
  });

  useEffect(() => {
    const checkTouch = () => {
      setHasTouch('ontouchstart' in window || navigator.maxTouchPoints > 0);
    };

    window.addEventListener('touchstart', checkTouch, { once: true, passive: true });
    
    return () => {
      window.removeEventListener('touchstart', checkTouch);
    };
  }, []);

  return hasTouch;
}

/**
 * Hook for detecting safe area insets (for notched devices)
 */
export function useSafeAreaInsets() {
  const [insets, setInsets] = useState({
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  });

  useEffect(() => {
    const computeInsets = () => {
      const style = getComputedStyle(document.documentElement);
      
      setInsets({
        top: parseInt(style.getPropertyValue('--safe-area-inset-top') || '0', 10),
        right: parseInt(style.getPropertyValue('--safe-area-inset-right') || '0', 10),
        bottom: parseInt(style.getPropertyValue('--safe-area-inset-bottom') || '0', 10),
        left: parseInt(style.getPropertyValue('--safe-area-inset-left') || '0', 10),
      });
    };

    computeInsets();
    window.addEventListener('resize', computeInsets);
    
    return () => window.removeEventListener('resize', computeInsets);
  }, []);

  return insets;
}

/**
 * Hook for responsive value selection
 * Returns different values based on screen size
 * 
 * @example
 * const columns = useResponsiveValue({
 *   mobile: 1,
 *   tablet: 2,
 *   desktop: 4,
 * });
 */
export function useResponsiveValue<T>(values: {
  mobile: T;
  tablet?: T;
  desktop: T;
}): T {
  const { deviceType } = useMediaQuery();
  
  if (deviceType === 'mobile') {
    return values.mobile;
  }
  
  if (deviceType === 'tablet') {
    return values.tablet ?? values.mobile;
  }
  
  return values.desktop;
}

export default useMediaQuery;