import { useState, useCallback, useRef, useEffect } from 'react';

interface UsePullToRefreshOptions {
  onRefresh: () => Promise<void> | void;
  threshold?: number;
  enabled?: boolean;
}

interface UsePullToRefreshReturn {
  isRefreshing: boolean;
  pullDistance: number;
  handlers: {
    onTouchStart: (e: React.TouchEvent) => void;
    onTouchMove: (e: React.TouchEvent) => void;
    onTouchEnd: () => void;
  };
  reset: () => void;
}

/**
 * Hook for pull-to-refresh gesture detection
 * 
 * Usage:
 * ```tsx
 * const { isRefreshing, pullDistance, handlers } = usePullToRefresh({
 *   onRefresh: async () => { await fetchData(); },
 *   threshold: 80,
 * });
 * 
 * <div {...handlers}>
 *   {isRefreshing && <PullToRefreshIndicator ... />}
 * </div>
 * ```
 */
export function usePullToRefresh({
  onRefresh,
  threshold = 80,
  enabled = true,
}: UsePullToRefreshOptions): UsePullToRefreshReturn {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  
  const touchStartY = useRef(0);
  const touchStartScrollTop = useRef(0);
  const isPulling = useRef(false);
  const containerRef = useRef<HTMLElement | null>(null);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    if (!enabled || isRefreshing) return;
    
    const touch = e.touches[0];
    touchStartY.current = touch.clientY;
    
    // Get the scroll container
    const target = e.currentTarget as HTMLElement;
    containerRef.current = target;
    touchStartScrollTop.current = target.scrollTop ?? window.scrollY;
    
    isPulling.current = true;
  }, [enabled, isRefreshing]);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (!enabled || !isPulling.current || isRefreshing) return;
    
    const touch = e.touches[0];
    const deltaY = touchStartY.current - touch.clientY;
    
    // Only allow pull when scrolled to top
    const isAtTop = (containerRef.current?.scrollTop ?? window.scrollY) <= 0;
    
    if (deltaY > 0 && isAtTop) {
      // User is pulling down
      const distance = Math.min(deltaY * 0.5, threshold * 1.5); // Apply resistance
      setPullDistance(distance);
      
      // Prevent default scroll behavior during pull
      if (deltaY > 10) {
        e.preventDefault();
      }
    } else {
      setPullDistance(0);
    }
  }, [enabled, isRefreshing, threshold]);

  const onTouchEnd = useCallback(async () => {
    if (!enabled || !isPulling.current) return;
    
    isPulling.current = false;
    
    if (pullDistance >= threshold && !isRefreshing) {
      setIsRefreshing(true);
      try {
        await onRefresh();
      } finally {
        setIsRefreshing(false);
        setPullDistance(0);
      }
    } else {
      // Animate back
      setPullDistance(0);
    }
  }, [enabled, pullDistance, threshold, isRefreshing, onRefresh]);

  const reset = useCallback(() => {
    setIsRefreshing(false);
    setPullDistance(0);
    isPulling.current = false;
  }, []);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      isPulling.current = false;
    };
  }, []);

  return {
    isRefreshing,
    pullDistance,
    handlers: {
      onTouchStart,
      onTouchMove,
      onTouchEnd,
    },
    reset,
  };
}

export default usePullToRefresh;