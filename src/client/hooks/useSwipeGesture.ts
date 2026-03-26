import { useState, useCallback, useRef } from 'react';

export type SwipeDirection = 'left' | 'right' | 'up' | 'down';

interface SwipeGestureOptions {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onSwipeUp?: () => void;
  onSwipeDown?: () => void;
  threshold?: number;
  preventDefaultOnSwipe?: boolean;
}

interface SwipeGestureReturn {
  handlers: {
    onTouchStart: (e: React.TouchEvent) => void;
    onTouchMove: (e: React.TouchEvent) => void;
    onTouchEnd: () => void;
  };
  isSwiping: boolean;
  swipeDirection: SwipeDirection | null;
  swipeDistance: { x: number; y: number };
}

/**
 * Hook for detecting swipe gestures
 * 
 * Usage:
 * ```tsx
 * const { handlers, swipeDirection } = useSwipeGesture({
 *   onSwipeLeft: () => goToNextPage(),
 *   onSwipeRight: () => goToPrevPage(),
 *   threshold: 50,
 * });
 * 
 * <div {...handlers}>Swipe me</div>
 * ```
 */
export function useSwipeGesture({
  onSwipeLeft,
  onSwipeRight,
  onSwipeUp,
  onSwipeDown,
  threshold = 50,
  preventDefaultOnSwipe = true,
}: SwipeGestureOptions): SwipeGestureReturn {
  const [isSwiping, setIsSwiping] = useState(false);
  const [swipeDirection, setSwipeDirection] = useState<SwipeDirection | null>(null);
  const [swipeDistance, setSwipeDistance] = useState({ x: 0, y: 0 });
  
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const isSwipingRef = useRef(false);
  
  const onTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    touchStartX.current = touch.clientX;
    touchStartY.current = touch.clientY;
    isSwipingRef.current = true;
    setIsSwiping(true);
    setSwipeDirection(null);
    setSwipeDistance({ x: 0, y: 0 });
  }, []);
  
  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isSwipingRef.current) return;
    
    const touch = e.touches[0];
    const deltaX = touch.clientX - touchStartX.current;
    const deltaY = touch.clientY - touchStartY.current;
    
    setSwipeDistance({ x: deltaX, y: deltaY });
    
    // Determine direction
    const absX = Math.abs(deltaX);
    const absY = Math.abs(deltaY);
    
    if (absX > absY && absX > threshold) {
      setSwipeDirection(deltaX > 0 ? 'right' : 'left');
      if (preventDefaultOnSwipe) {
        e.preventDefault();
      }
    } else if (absY > absX && absY > threshold) {
      setSwipeDirection(deltaY > 0 ? 'down' : 'up');
      if (preventDefaultOnSwipe) {
        e.preventDefault();
      }
    }
  }, [threshold, preventDefaultOnSwipe]);
  
  const onTouchEnd = useCallback(() => {
    if (!isSwipingRef.current) return;
    
    isSwipingRef.current = false;
    setIsSwiping(false);
    
    // Trigger callback based on direction
    switch (swipeDirection) {
      case 'left':
        onSwipeLeft?.();
        break;
      case 'right':
        onSwipeRight?.();
        break;
      case 'up':
        onSwipeUp?.();
        break;
      case 'down':
        onSwipeDown?.();
        break;
    }
    
    setSwipeDirection(null);
    setSwipeDistance({ x: 0, y: 0 });
  }, [swipeDirection, onSwipeLeft, onSwipeRight, onSwipeUp, onSwipeDown]);
  
  return {
    handlers: {
      onTouchStart,
      onTouchMove,
      onTouchEnd,
    },
    isSwiping,
    swipeDirection,
    swipeDistance,
  };
}

export default useSwipeGesture;