import { useCallback, useRef, useState, useEffect } from 'react';

/**
 * Touch gesture types
 */
export interface TouchGestures {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onSwipeUp?: () => void;
  onSwipeDown?: () => void;
  onPinch?: (scale: number) => void;
  onTap?: () => void;
  onDoubleTap?: () => void;
  onLongPress?: () => void;
}

export interface TouchGestureState {
  isSwiping: boolean;
  swipeDirection: 'left' | 'right' | 'up' | 'down' | null;
  swipeOffset: { x: number; y: number };
  scale: number;
}

/**
 * Hook for handling touch gestures with configurable thresholds
 */
export function useTouchGestures(
  gestures: TouchGestures,
  options: {
    swipeThreshold?: number;
    pinchThreshold?: number;
    longPressDelay?: number;
    doubleTapDelay?: number;
  } = {}
) {
  const {
    swipeThreshold = 50,
    pinchThreshold = 0.1,
    longPressDelay = 500,
    doubleTapDelay = 300,
  } = options;

  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const lastTapRef = useRef<number>(0);
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const initialPinchDistanceRef = useRef<number | null>(null);
  
  const [state, setState] = useState<TouchGestureState>({
    isSwiping: false,
    swipeDirection: null,
    swipeOffset: { x: 0, y: 0 },
    scale: 1,
  });

  // Clear long press timer
  const clearLongPressTimer = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  // Handle touch start
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    touchStartRef.current = {
      x: touch.clientX,
      y: touch.clientY,
      time: Date.now(),
    };

    // Start long press timer
    if (gestures.onLongPress) {
      clearLongPressTimer();
      longPressTimerRef.current = setTimeout(() => {
        gestures.onLongPress?.();
      }, longPressDelay);
    }

    // Handle pinch start (two fingers)
    if (e.touches.length === 2 && gestures.onPinch) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      initialPinchDistanceRef.current = Math.sqrt(dx * dx + dy * dy);
    }

    setState(prev => ({ ...prev, isSwiping: false, swipeDirection: null }));
  }, [gestures, longPressDelay, clearLongPressTimer]);

  // Handle touch move
  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!touchStartRef.current) return;

    const touch = e.touches[0];
    const deltaX = touch.clientX - touchStartRef.current.x;
    const deltaY = touch.clientY - touchStartRef.current.y;

    // Cancel long press if moved
    if (Math.abs(deltaX) > 10 || Math.abs(deltaY) > 10) {
      clearLongPressTimer();
    }

    // Update swipe state
    const isHorizontalSwipe = Math.abs(deltaX) > Math.abs(deltaY);
    const isVerticalSwipe = Math.abs(deltaY) > Math.abs(deltaX);

    setState(prev => ({
      ...prev,
      isSwiping: Math.abs(deltaX) > 10 || Math.abs(deltaY) > 10,
      swipeDirection: isHorizontalSwipe 
        ? (deltaX > 0 ? 'right' : 'left')
        : isVerticalSwipe 
          ? (deltaY > 0 ? 'down' : 'up')
          : null,
      swipeOffset: { x: deltaX, y: deltaY },
    }));

    // Handle pinch (two fingers)
    if (e.touches.length === 2 && initialPinchDistanceRef.current && gestures.onPinch) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const currentDistance = Math.sqrt(dx * dx + dy * dy);
      const scale = currentDistance / initialPinchDistanceRef.current;
      
      setState(prev => ({ ...prev, scale }));
      gestures.onPinch(scale);
    }
  }, [gestures, clearLongPressTimer]);

  // Handle touch end
  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    clearLongPressTimer();

    if (!touchStartRef.current) return;

    const touch = e.changedTouches[0];
    const deltaX = touch.clientX - touchStartRef.current.x;
    const deltaY = touch.clientY - touchStartRef.current.y;
    const deltaTime = Date.now() - touchStartRef.current.time;

    // Detect swipe
    if (Math.abs(deltaX) > swipeThreshold) {
      if (deltaX > 0) {
        gestures.onSwipeRight?.();
      } else {
        gestures.onSwipeLeft?.();
      }
    } else if (Math.abs(deltaY) > swipeThreshold) {
      if (deltaY > 0) {
        gestures.onSwipeDown?.();
      } else {
        gestures.onSwipeUp?.();
      }
    }
    // Detect tap (short touch with minimal movement)
    else if (deltaTime < 200 && Math.abs(deltaX) < 10 && Math.abs(deltaY) < 10) {
      const now = Date.now();
      const timeSinceLastTap = now - lastTapRef.current;

      if (timeSinceLastTap < doubleTapDelay && gestures.onDoubleTap) {
        gestures.onDoubleTap();
        lastTapRef.current = 0; // Reset to prevent triple tap
      } else if (gestures.onTap) {
        gestures.onTap();
        lastTapRef.current = now;
      }
    }

    touchStartRef.current = null;
    initialPinchDistanceRef.current = null;

    setState(prev => ({
      ...prev,
      isSwiping: false,
      swipeDirection: null,
      swipeOffset: { x: 0, y: 0 },
      scale: 1,
    }));
  }, [gestures, swipeThreshold, doubleTapDelay, clearLongPressTimer]);

  // Cleanup
  useEffect(() => {
    return () => {
      clearLongPressTimer();
    };
  }, [clearLongPressTimer]);

  return {
    state,
    handlers: {
      onTouchStart: handleTouchStart,
      onTouchMove: handleTouchMove,
      onTouchEnd: handleTouchEnd,
    },
  };
}

/**
 * Hook for pull-to-refresh functionality
 */
export function usePullToRefresh(
  onRefresh: () => Promise<void>,
  options: {
    threshold?: number;
    disabled?: boolean;
  } = {}
) {
  const { threshold = 80, disabled = false } = options;
  
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const touchStartRef = useRef<number>(0);
  const isPullingRef = useRef(false);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (disabled || isRefreshing) return;

    const container = containerRef.current;
    if (container && container.scrollTop === 0) {
      touchStartRef.current = e.touches[0].clientY;
      isPullingRef.current = true;
    }
  }, [disabled, isRefreshing]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isPullingRef.current || disabled || isRefreshing) return;

    const container = containerRef.current;
    if (!container || container.scrollTop > 0) {
      isPullingRef.current = false;
      return;
    }

    const deltaY = e.touches[0].clientY - touchStartRef.current;
    
    if (deltaY > 0) {
      e.preventDefault();
      const distance = Math.min(deltaY * 0.5, threshold * 1.5);
      setPullDistance(distance);
    }
  }, [disabled, isRefreshing, threshold]);

  const handleTouchEnd = useCallback(async () => {
    if (!isPullingRef.current || disabled || isRefreshing) return;

    isPullingRef.current = false;

    if (pullDistance >= threshold) {
      setIsRefreshing(true);
      try {
        await onRefresh();
      } finally {
        setIsRefreshing(false);
      }
    }

    setPullDistance(0);
  }, [pullDistance, threshold, onRefresh, disabled, isRefreshing]);

  return {
    containerRef,
    isRefreshing,
    pullDistance,
    pullIndicatorStyle: {
      transform: 'translateY(' + pullDistance + 'px)',
      opacity: Math.min(pullDistance / threshold, 1),
    },
    handlers: {
      onTouchStart: handleTouchStart,
      onTouchMove: handleTouchMove,
      onTouchEnd: handleTouchEnd,
    },
  };
}

/**
 * Hook for swipe navigation between items
 */
export function useSwipeNavigation<T>(
  items: T[],
  options: {
    loop?: boolean;
    onNavigate?: (item: T, index: number) => void;
  } = {}
) {
  const { loop = true, onNavigate } = options;
  const [currentIndex, setCurrentIndex] = useState(0);

  const goToNext = useCallback(() => {
    setCurrentIndex(prev => {
      const next = prev + 1;
      if (next >= items.length) {
        const newIndex = loop ? 0 : prev;
        onNavigate?.(items[newIndex], newIndex);
        return newIndex;
      }
      onNavigate?.(items[next], next);
      return next;
    });
  }, [items, loop, onNavigate]);

  const goToPrev = useCallback(() => {
    setCurrentIndex(prev => {
      const next = prev - 1;
      if (next < 0) {
        const newIndex = loop ? items.length - 1 : 0;
        onNavigate?.(items[newIndex], newIndex);
        return newIndex;
      }
      onNavigate?.(items[next], next);
      return next;
    });
  }, [items, loop, onNavigate]);

  const goTo = useCallback((index: number) => {
    if (index >= 0 && index < items.length) {
      setCurrentIndex(index);
      onNavigate?.(items[index], index);
    }
  }, [items, onNavigate]);

  const touchGestures = useTouchGestures({
    onSwipeLeft: goToNext,
    onSwipeRight: goToPrev,
  });

  return {
    currentIndex,
    currentItem: items[currentIndex],
    goToNext,
    goToPrev,
    goTo,
    touchHandlers: touchGestures.handlers,
    isSwiping: touchGestures.state.isSwiping,
    swipeDirection: touchGestures.state.swipeDirection,
  };
}

export default useTouchGestures;
