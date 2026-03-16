import { renderHook, act } from '@testing-library/react';
import { useTouchGestures, usePullToRefresh, useSwipeNavigation } from '../useTouchGestures';

describe('useTouchGestures', () => {
  it('should detect swipe left', () => {
    const onSwipeLeft = jest.fn();
    const { result } = renderHook(() => useTouchGestures({ onSwipeLeft }));

    const touchStart = {
      touches: [{ clientX: 100, clientY: 0 }],
    } as unknown as React.TouchEvent;

    const touchEnd = {
      changedTouches: [{ clientX: 30, clientY: 0 }],
    } as unknown as React.TouchEvent;

    act(() => {
      result.current.handlers.onTouchStart(touchStart);
      result.current.handlers.onTouchEnd(touchEnd);
    });

    expect(onSwipeLeft).toHaveBeenCalled();
  });

  it('should detect swipe right', () => {
    const onSwipeRight = jest.fn();
    const { result } = renderHook(() => useTouchGestures({ onSwipeRight }));

    const touchStart = {
      touches: [{ clientX: 30, clientY: 0 }],
    } as unknown as React.TouchEvent;

    const touchEnd = {
      changedTouches: [{ clientX: 100, clientY: 0 }],
    } as unknown as React.TouchEvent;

    act(() => {
      result.current.handlers.onTouchStart(touchStart);
      result.current.handlers.onTouchEnd(touchEnd);
    });

    expect(onSwipeRight).toHaveBeenCalled();
  });

  it('should detect tap', () => {
    const onTap = jest.fn();
    const { result } = renderHook(() => useTouchGestures({ onTap }));

    const touchStart = {
      touches: [{ clientX: 100, clientY: 100 }],
    } as unknown as React.TouchEvent;

    const touchEnd = {
      changedTouches: [{ clientX: 102, clientY: 102 }],
    } as unknown as React.TouchEvent;

    act(() => {
      result.current.handlers.onTouchStart(touchStart);
      // Simulate quick tap
      result.current.handlers.onTouchEnd(touchEnd);
    });

    expect(onTap).toHaveBeenCalled();
  });

  it('should detect double tap', () => {
    const onDoubleTap = jest.fn();
    const onTap = jest.fn();
    const { result } = renderHook(() => 
      useTouchGestures({ onDoubleTap, onTap }, { doubleTapDelay: 300 })
    );

    const touchStart = {
      touches: [{ clientX: 100, clientY: 100 }],
    } as unknown as React.TouchEvent;

    const touchEnd = {
      changedTouches: [{ clientX: 102, clientY: 102 }],
    } as unknown as React.TouchEvent;

    act(() => {
      // First tap
      result.current.handlers.onTouchStart(touchStart);
      result.current.handlers.onTouchEnd(touchEnd);
      // Second tap (double tap)
      result.current.handlers.onTouchStart(touchStart);
      result.current.handlers.onTouchEnd(touchEnd);
    });

    expect(onDoubleTap).toHaveBeenCalled();
  });

  it('should update swipe state during touch move', () => {
    const { result } = renderHook(() => useTouchGestures({}));

    const touchStart = {
      touches: [{ clientX: 100, clientY: 100 }],
    } as unknown as React.TouchEvent;

    const touchMove = {
      touches: [{ clientX: 50, clientY: 100 }],
    } as unknown as React.TouchEvent;

    act(() => {
      result.current.handlers.onTouchStart(touchStart);
    });

    expect(result.current.state.isSwiping).toBe(false);

    act(() => {
      result.current.handlers.onTouchMove(touchMove);
    });

    expect(result.current.state.isSwiping).toBe(true);
    expect(result.current.state.swipeDirection).toBe('left');
  });

  it('should not trigger swipe below threshold', () => {
    const onSwipeLeft = jest.fn();
    const { result } = renderHook(() => 
      useTouchGestures({ onSwipeLeft }, { swipeThreshold: 100 })
    );

    const touchStart = {
      touches: [{ clientX: 100, clientY: 0 }],
    } as unknown as React.TouchEvent;

    const touchEnd = {
      changedTouches: [{ clientX: 60, clientY: 0 }],
    } as unknown as React.TouchEvent;

    act(() => {
      result.current.handlers.onTouchStart(touchStart);
      result.current.handlers.onTouchEnd(touchEnd);
    });

    expect(onSwipeLeft).not.toHaveBeenCalled();
  });
});

describe('usePullToRefresh', () => {
  it('should update pull distance on touch move', () => {
    const onRefresh = jest.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => 
      usePullToRefresh(onRefresh, { threshold: 80 })
    );

    // Create a mock container
    const container = {
      scrollTop: 0,
    };
    
    // Manually set the ref
    (result.current.containerRef as any).current = container;

    const touchStart = {
      touches: [{ clientY: 100 }],
    } as unknown as React.TouchEvent;

    const touchMove = {
      touches: [{ clientY: 200 }],
      preventDefault: jest.fn(),
    } as unknown as React.TouchEvent;

    act(() => {
      result.current.handlers.onTouchStart(touchStart);
    });

    // Pull distance should be 0 initially
    expect(result.current.pullDistance).toBe(0);

    act(() => {
      result.current.handlers.onTouchMove(touchMove);
    });

    // Pull distance should be updated after touch move
    expect(result.current.pullDistance).toBeGreaterThan(0);
  });

  it('should not trigger refresh when disabled', async () => {
    const onRefresh = jest.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => 
      usePullToRefresh(onRefresh, { disabled: true })
    );

    const touchStart = {
      touches: [{ clientY: 100 }],
    } as unknown as React.TouchEvent;

    await act(async () => {
      result.current.handlers.onTouchStart(touchStart);
    });

    expect(result.current.pullDistance).toBe(0);
  });

  it('should reset pull distance on touch end', () => {
    const onRefresh = jest.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => 
      usePullToRefresh(onRefresh, { threshold: 200 }) // High threshold to not trigger refresh
    );

    const container = {
      scrollTop: 0,
    };
    (result.current.containerRef as any).current = container;

    const touchStart = {
      touches: [{ clientY: 100 }],
    } as unknown as React.TouchEvent;

    const touchMove = {
      touches: [{ clientY: 200 }],
      preventDefault: jest.fn(),
    } as unknown as React.TouchEvent;

    act(() => {
      result.current.handlers.onTouchStart(touchStart);
      result.current.handlers.onTouchMove(touchMove);
    });

    expect(result.current.pullDistance).toBeGreaterThan(0);

    act(() => {
      result.current.handlers.onTouchEnd({} as React.TouchEvent);
    });

    expect(result.current.pullDistance).toBe(0);
  });
});

describe('useSwipeNavigation', () => {
  const items = ['item1', 'item2', 'item3', 'item4'];

  it('should navigate to next item on swipe left', () => {
    const onNavigate = jest.fn();
    const { result } = renderHook(() => 
      useSwipeNavigation(items, { onNavigate })
    );

    expect(result.current.currentIndex).toBe(0);

    act(() => {
      result.current.goToNext();
    });

    expect(result.current.currentIndex).toBe(1);
    expect(result.current.currentItem).toBe('item2');
    expect(onNavigate).toHaveBeenCalledWith('item2', 1);
  });

  it('should navigate to previous item on swipe right', () => {
    const onNavigate = jest.fn();
    const { result } = renderHook(() => 
      useSwipeNavigation(items, { onNavigate })
    );

    // First go to index 2
    act(() => {
      result.current.goTo(2);
    });

    expect(result.current.currentIndex).toBe(2);

    act(() => {
      result.current.goToPrev();
    });

    expect(result.current.currentIndex).toBe(1);
    expect(result.current.currentItem).toBe('item2');
  });

  it('should loop back to start when at end', () => {
    const { result } = renderHook(() => 
      useSwipeNavigation(items, { loop: true })
    );

    act(() => {
      result.current.goTo(3); // Last item
      result.current.goToNext();
    });

    expect(result.current.currentIndex).toBe(0);
  });

  it('should not loop when loop is disabled', () => {
    const { result } = renderHook(() => 
      useSwipeNavigation(items, { loop: false })
    );

    act(() => {
      result.current.goTo(3); // Last item
      result.current.goToNext();
    });

    expect(result.current.currentIndex).toBe(3);
  });

  it('should handle goTo with valid index', () => {
    const { result } = renderHook(() => useSwipeNavigation(items));

    act(() => {
      result.current.goTo(2);
    });

    expect(result.current.currentIndex).toBe(2);
    expect(result.current.currentItem).toBe('item3');
  });

  it('should ignore invalid goTo index', () => {
    const { result } = renderHook(() => useSwipeNavigation(items));

    act(() => {
      result.current.goTo(-1);
    });

    expect(result.current.currentIndex).toBe(0);

    act(() => {
      result.current.goTo(100);
    });

    expect(result.current.currentIndex).toBe(0);
  });
});
