/**
 * Tests for Performance Utilities
 */

import {
  useDebounce,
  useThrottle,
  sampleDataForChart,
  chunkArray,
  useMemoizedSelector,
} from '../performance';
import { renderHook, act } from '@testing-library/react';

describe('Performance Utilities', () => {
  describe('useDebounce', () => {
    it('should debounce value updates', () => {
      jest.useFakeTimers();

      const { result, rerender } = renderHook(({ value, wait }) => useDebounce(value, wait), {
        initialProps: { value: 'initial', wait: 500 },
      });

      expect(result.current).toBe('initial');

      // Update value
      rerender({ value: 'updated', wait: 500 });
      expect(result.current).toBe('initial'); // Still initial

      // Fast forward time
      act(() => {
        jest.advanceTimersByTime(500);
      });

      expect(result.current).toBe('updated'); // Now updated

      jest.useRealTimers();
    });
  });

  describe('useThrottle', () => {
    it('should throttle value updates', () => {
      jest.useFakeTimers();

      const { result, rerender } = renderHook(({ value, limit }) => useThrottle(value, limit), {
        initialProps: { value: 'initial', limit: 500 },
      });

      expect(result.current).toBe('initial');

      // Update multiple times quickly
      rerender({ value: 'update1', limit: 500 });
      rerender({ value: 'update2', limit: 500 });
      rerender({ value: 'update3', limit: 500 });

      // Should still be initial (throttled)
      expect(result.current).toBe('initial');

      // Advance time
      act(() => {
        jest.advanceTimersByTime(600);
      });

      // Should have the latest value
      expect(result.current).toBe('update3');

      jest.useRealTimers();
    });
  });

  describe('sampleDataForChart', () => {
    it('should return data as-is if under max points', () => {
      const data = [
        { timestamp: 1, value: 10 },
        { timestamp: 2, value: 20 },
        { timestamp: 3, value: 30 },
      ];

      const result = sampleDataForChart(data, 10);
      expect(result).toEqual(data);
    });

    it('should sample data to max points', () => {
      const data = Array.from({ length: 1000 }, (_, i) => ({
        timestamp: i,
        value: i * 10,
      }));

      const result = sampleDataForChart(data, 100);
      expect(result.length).toBe(100);
    });

    it('should include last point', () => {
      const data = Array.from({ length: 1000 }, (_, i) => ({
        timestamp: i,
        value: i * 10,
      }));

      const result = sampleDataForChart(data, 100);
      expect(result[result.length - 1]).toEqual(data[data.length - 1]);
    });
  });

  describe('chunkArray', () => {
    it('should split array into chunks', () => {
      const array = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      const result = chunkArray(array, 3);

      expect(result).toEqual([[1, 2, 3], [4, 5, 6], [7, 8, 9], [10]]);
    });

    it('should handle empty array', () => {
      const result = chunkArray([], 3);
      expect(result).toEqual([]);
    });

    it('should handle chunk size larger than array', () => {
      const array = [1, 2, 3];
      const result = chunkArray(array, 10);
      expect(result).toEqual([[1, 2, 3]]);
    });
  });
});