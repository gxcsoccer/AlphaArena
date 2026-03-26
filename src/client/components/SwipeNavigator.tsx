import React, { useState, useCallback, useRef, useEffect, createContext, useContext } from 'react';
import { Typography, Message } from '@arco-design/web-react';
import { IconLeft, IconRight } from '@arco-design/web-react/icon';
import { useNavigate, useLocation } from 'react-router-dom';

const { Text } = Typography;

// Navigation routes for swipe navigation
const NAV_ROUTES = [
  '/dashboard',
  '/trading',
  '/holdings',
  '/trades',
  '/strategies',
  '/settings',
];

interface SwipeNavigatorProps {
  children: React.ReactNode;
  enabled?: boolean;
  threshold?: number;
}

interface SwipeNavigationContextType {
  isNavigating: boolean;
  direction: 'left' | 'right' | null;
}

const SwipeNavigationContext = createContext<SwipeNavigationContextType>({
  isNavigating: false,
  direction: null,
});

/**
 * SwipeNavigator - Enables swipe gestures for page navigation
 * 
 * Wrap your app or page content with this component to enable
 * left/right swipe navigation between pages.
 * 
 * Usage:
 * ```tsx
 * <SwipeNavigator enabled={isMobile}>
 *   <PageContent />
 * </SwipeNavigator>
 * ```
 */
const SwipeNavigator: React.FC<SwipeNavigatorProps> = ({
  children,
  enabled = true,
  threshold = 100,
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  
  const [isNavigating, setIsNavigating] = useState(false);
  const [direction, setDirection] = useState<'left' | 'right' | null>(null);
  const [indicatorVisible, setIndicatorVisible] = useState(false);
  const [indicatorProgress, setIndicatorProgress] = useState(0);
  
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const isHorizontalSwipe = useRef<boolean | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Get current route index
  const currentRouteIndex = NAV_ROUTES.findIndex(route => 
    location.pathname.startsWith(route)
  );
  
  // Get adjacent routes
  const previousRoute = currentRouteIndex > 0 ? NAV_ROUTES[currentRouteIndex - 1] : null;
  const nextRoute = currentRouteIndex < NAV_ROUTES.length - 1 ? NAV_ROUTES[currentRouteIndex + 1] : null;
  
  // Handle touch start
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (!enabled) return;
    
    // Ignore if touching interactive elements
    const target = e.target as HTMLElement;
    if (
      target.tagName === 'BUTTON' ||
      target.tagName === 'INPUT' ||
      target.tagName === 'SELECT' ||
      target.tagName === 'TEXTAREA' ||
      target.closest('button') ||
      target.closest('a') ||
      target.closest('[role="button"]')
    ) {
      return;
    }
    
    const touch = e.touches[0];
    touchStartX.current = touch.clientX;
    touchStartY.current = touch.clientY;
    isHorizontalSwipe.current = null;
  }, [enabled]);
  
  // Handle touch move
  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!enabled) return;
    
    const touch = e.touches[0];
    const deltaX = touch.clientX - touchStartX.current;
    const deltaY = touch.clientY - touchStartY.current;
    
    // Determine swipe direction on first move
    if (isHorizontalSwipe.current === null) {
      isHorizontalSwipe.current = Math.abs(deltaX) > Math.abs(deltaY) * 1.5;
    }
    
    // Only handle horizontal swipes
    if (!isHorizontalSwipe.current) return;
    
    // Check if at edge of scrollable content
    const scrollableParent = (e.target as HTMLElement).closest('[style*="overflow"]');
    if (scrollableParent) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollableParent as HTMLElement;
      const isAtLeftEdge = scrollLeft <= 0;
      const isAtRightEdge = scrollLeft + clientWidth >= scrollWidth;
      
      // Only allow swipe navigation at edges
      if ((deltaX > 0 && !isAtLeftEdge) || (deltaX < 0 && !isAtRightEdge)) {
        return;
      }
    }
    
    // Show navigation indicator
    if (Math.abs(deltaX) > 20) {
      setIndicatorVisible(true);
      
      const progress = Math.min(Math.abs(deltaX) / threshold, 1);
      setIndicatorProgress(progress);
      setDirection(deltaX > 0 ? 'right' : 'left');
    }
  }, [enabled, threshold]);
  
  // Handle touch end
  const handleTouchEnd = useCallback(() => {
    if (!enabled || !indicatorVisible) return;
    
    // Navigate if threshold met
    if (indicatorProgress >= 1) {
      if (direction === 'right' && previousRoute) {
        setIsNavigating(true);
        Message.info({
          content: '导航到上一页',
          duration: 1000,
        });
        navigate(previousRoute);
      } else if (direction === 'left' && nextRoute) {
        setIsNavigating(true);
        Message.info({
          content: '导航到下一页',
          duration: 1000,
        });
        navigate(nextRoute);
      }
    }
    
    // Reset state
    setIndicatorVisible(false);
    setIndicatorProgress(0);
    setDirection(null);
    setIsNavigating(false);
  }, [enabled, indicatorVisible, indicatorProgress, direction, previousRoute, nextRoute, navigate]);
  
  // Reset on location change
  useEffect(() => {
    setIndicatorVisible(false);
    setIndicatorProgress(0);
    setDirection(null);
    setIsNavigating(false);
  }, [location.pathname]);
  
  return (
    <SwipeNavigationContext.Provider value={{ isNavigating, direction }}>
      <div
        ref={containerRef}
        style={{
          position: 'relative',
          width: '100%',
          height: '100%',
          touchAction: 'pan-y',
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {children}
        
        {/* Navigation indicator */}
        {indicatorVisible && (
          <div
            style={{
              position: 'fixed',
              top: 0,
              bottom: 0,
              [direction === 'right' ? 'left' : 'right']: 0,
              width: 60,
              backgroundColor: `rgba(22, 93, 255, ${0.1 + indicatorProgress * 0.2})`,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              zIndex: 1000,
              transition: 'opacity 0.15s ease',
            }}
          >
            {direction === 'right' ? (
              <IconLeft style={{ fontSize: 24, color: 'var(--color-primary)' }} />
            ) : (
              <IconRight style={{ fontSize: 24, color: 'var(--color-primary)' }} />
            )}
            <Text
              style={{
                fontSize: 10,
                color: 'var(--color-primary)',
                textAlign: 'center',
                writingMode: 'vertical-rl',
              }}
            >
              {direction === 'right' && previousRoute
                ? previousRoute.slice(1).toUpperCase()
                : direction === 'left' && nextRoute
                  ? nextRoute.slice(1).toUpperCase()
                  : ''}
            </Text>
            
            {/* Progress indicator */}
            <div
              style={{
                position: 'absolute',
                [direction === 'right' ? 'right' : 'left']: 0,
                top: 0,
                bottom: 0,
                width: 3,
                backgroundColor: 'var(--color-primary)',
                transform: `scaleY(${indicatorProgress})`,
                transformOrigin: 'center',
              }}
            />
          </div>
        )}
      </div>
    </SwipeNavigationContext.Provider>
  );
};

// Hook to access swipe navigation state
export const useSwipeNavigation = () => useContext(SwipeNavigationContext);

export default SwipeNavigator;