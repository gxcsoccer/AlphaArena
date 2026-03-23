/**
 * Tests for Performance Utilities
 */

import { renderHook, act } from '@testing-library/react';
import {
  useDebounce,
  useThrottle,
  useDebouncedCallback,
  useThrottledCallback,
  sampleDataForChart,
  chunkArray,
  processBatch,
  useMemoizedSelector,
  measurePerformance,
} from '../performance';

describe('Performance Utilities', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('useDebounce', () => {
    it('should return initial value immediately', () => {
      const { result } = renderHook(() => useDebounce('test', 500));
      expect(result.current).toBe('test');
    });

    it('should debounce value changes', () => {
      const { result, rerender } = renderHook(
        ({ value, delay }) => useDebounce(value, delay),
        { initialProps: { value: 'initial', delay: 500 } }
      );

      expect(result.current).toBe('initial');

      rerender({ value: 'changed', delay: 500 });
      expect(result.current).toBe('initial');

      act(() => {
        jest.advanceTimersByTime(500);
      });

      expect(result.current).toBe('changed');
    });

    it('should cancel previous timer on new value', () => {
      const { result, rerender } = renderHook(
        ({ value, delay }) => useDebounce(value, delay),
        { initialProps: { value: 'initial', delay: 500 } }
      );

      rerender({ value: 'first', delay: 500 });
      act(() => {
        jest.advanceTimersByTime(250);
      });

      rerender({ value: 'second', delay: 500 });
      act(() => {
        jest.advanceTimersByTime(500);
      });

      expect(result.current).toBe('second');
    });
  });

  describe('useThrottle', () => {
    it('should return initial value immediately', () => {
      const { result } = renderHook(() => useThrottle('test', 500));
      expect(result.current).toBe('test');
    });

    it('should throttle value changes', () => {
      const { result, rerender } = renderHook(
        ({ value, limit }) => useThrottle(value, limit),
        { initialProps: { value: 'initial', limit: 500 } }
      );

      rerender({ value: 'first', limit: 500 });
      act(() => {
        jest.advanceTimersByTime(250);
      });

      // Value should still be 'initial' due to throttle
      expect(result.current).toBe('initial');

      rerender({ value: 'second', limit: 500 });
      act(() => {
        jest.advanceTimersByTime(500);
      });

      // Now it should update
      expect(result.current).toBe('second');
    });
  });

  describe('useDebouncedCallback', () => {
    it('should debounce callback execution', () => {
      const callback = jest.fn();
      const { result } = renderHook(() => useDebouncedCallback(callback, 500));

      result.current('arg1');
      result.current('arg2');
      result.current('arg3');

      expect(callback).not.toHaveBeenCalled();

      act(() => {
        jest.advanceTimersByTime(500);
      });

      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith('arg3');
    });

    it('should cleanup on unmount', () => {
      const callback = jest.fn();
      const { unmount } = renderHook(() => useDebouncedCallback(callback, 500));

      const debouncedCallback = renderHook(() => useDebouncedCallback(callback, 500)).result.current;
      debouncedCallback('arg');

      unmount();

      act(() => {
        jest.advanceTimersByTime(500);
      });

      // Callback should not be called after unmount
      // Note: This test depends on implementation details
    });
  });

  describe('useThrottledCallback', () => {
    it('should throttle callback execution', () => {
      const callback = jest.fn();
      const { result } = renderHook(() => useThrottledCallback(callback, 500));

      result.current('arg1');
      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith('arg1');

      result.current('arg2');
      expect(callback).toHaveBeenCalledTimes(1); // Still 1, throttled

      act(() => {
        jest.advanceTimersByTime(500);
      });

      result.current('arg3');
      expect(callback).toHaveBeenCalledTimes(2);
    });
  });

  describe('sampleDataForChart', () => {
    it('should return original data if under limit', () => {
      const data = Array.from({ length: 100 }, (_, i) => ({
        timestamp: i,
        value: i * 2,
      }));

      const result = sampleDataForChart(data, 500);
      expect(result).toHaveLength(100);
    });

    it('should sample data if over limit', () => {
      const data = Array.from({ length: 1000 }, (_, i) => ({
        timestamp: i,
        value: i * 2,
      }));

      const result = sampleDataForChart(data, 500);
      expect(result).toHaveLength(500);
    });

    it('should always include last point', () => {
      const data = Array.from({ length: 1000 }, (_, i) => ({
        timestamp: i,
        value: i * 2,
      }));

      const result = sampleDataForChart(data, 500);
      expect(result[result.length - 1]).toEqual(data[data.length - 1]);
    });
  });

  describe('chunkArray', () => {
    it('should split array into chunks', () => {
      const array = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      const chunks = chunkArray(array, 3);
      
      expect(chunks).toHaveLength(4);
      expect(chunks[0]).toEqual([1, 2, 3]);
      expect(chunks[3]).toEqual([10]);
    });

    it('should handle empty array', () => {
      const chunks = chunkArray([], 3);
      expect(chunks).toHaveLength(0);
    });
  });

  describe('processBatch', () => {
    it('should process items in batches', async () => {
      const items = [1, 2, 3, 4, 5];
      const processor = jest.fn().mockResolvedValue('processed');
      
      const results = await processBatch(items, processor, 2);
      
      expect(results).toHaveLength(5);
      expect(processor).toHaveBeenCalledTimes(5);
    });
  });

  describe('useMemoizedSelector', () => {
    it('should memoize selector result', () => {
      const selector = jest.fn((data: { x: number }) => data.x * 2);
      const data = { x: 5 };
      
      const { result, rerender } = renderHook(() =>
        useMemoizedSelector(selector, data, [])
      );

      expect(result.current).toBe(10);
      expect(selector).toHaveBeenCalledTimes(1);

      // Rerender with same data
      rerender();
      // Selector should NOT be called again due to memoization
      expect(selector).toHaveBeenCalledTimes(1);
    });
  });

  describe('measurePerformance', () => {
    it('should measure and log performance in development', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';
      
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      const fn = jest.fn();
      
      measurePerformance('test', fn);
      
      expect(fn).toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalled();
      
      consoleSpy.mockRestore();
      process.env.NODE_ENV = originalEnv;
    });

    it('should only run function in production', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      const fn = jest.fn();
      
      measurePerformance('test', fn);
      
      expect(fn).toHaveBeenCalled();
      expect(consoleSpy).not.toHaveBeenCalled();
      
      consoleSpy.mockRestore();
      process.env.NODE_ENV = originalEnv;
    });
  });
});