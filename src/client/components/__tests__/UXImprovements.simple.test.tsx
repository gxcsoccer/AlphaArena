/**
 * UX Improvements Basic Test Suite
 * 
 * Issue #514: UX 改进 - 交易界面交互优化
 * 基础功能测试
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

// Test skeleton components (simple, no state)
describe('Skeleton Components', () => {
  it('should render OrderBook skeleton without errors', async () => {
    const { OrderBookSkeleton } = await import('../TradingSkeleton');
    const { container } = render(<OrderBookSkeleton rows={5} />);
    expect(container.firstChild).toBeInTheDocument();
  });

  it('should render TradingOrder skeleton without errors', async () => {
    const { TradingOrderSkeleton } = await import('../TradingSkeleton');
    const { container } = render(<TradingOrderSkeleton />);
    expect(container.firstChild).toBeInTheDocument();
  });

  it('should render KLineChart skeleton without errors', async () => {
    const { KLineChartSkeleton } = await import('../TradingSkeleton');
    const { container } = render(<KLineChartSkeleton height={300} />);
    expect(container.firstChild).toBeInTheDocument();
  });
});

// Test utility functions
describe('UX Utilities', () => {
  let uxHelpers: typeof import('../../utils/uxHelpers');

  beforeAll(async () => {
    uxHelpers = await import('../../utils/uxHelpers');
  });

  describe('formatCurrency', () => {
    it('should format currency correctly', () => {
      const result = uxHelpers.formatCurrency(1234.56);
      expect(result).toContain('1,234.56');
    });

    it('should handle zero', () => {
      const result = uxHelpers.formatCurrency(0);
      expect(result).toContain('0.00');
    });
  });

  describe('formatPercentage', () => {
    it('should format positive percentage', () => {
      const result = uxHelpers.formatPercentage(5.67);
      expect(result).toBe('+5.67%');
    });

    it('should format negative percentage', () => {
      const result = uxHelpers.formatPercentage(-3.21);
      expect(result).toBe('-3.21%');
    });
  });

  describe('formatNumber', () => {
    it('should format numbers correctly', () => {
      const result = uxHelpers.formatNumber(1234.5678, 2);
      expect(result).toContain('1,234.57');
    });
  });

  describe('LocalCache', () => {
    beforeEach(() => {
      localStorage.clear();
    });

    it('should store and retrieve values', () => {
      uxHelpers.LocalCache.set('test-key', { data: 'test-value' });
      const result = uxHelpers.LocalCache.get('test-key');
      expect(result).toEqual({ data: 'test-value' });
    });

    it('should return null for non-existent keys', () => {
      const result = uxHelpers.LocalCache.get('non-existent');
      expect(result).toBeNull();
    });

    it('should remove values', () => {
      uxHelpers.LocalCache.set('test-key', 'test-value');
      uxHelpers.LocalCache.remove('test-key');
      const result = uxHelpers.LocalCache.get('test-key');
      expect(result).toBeNull();
    });

    it('should handle TTL expiration', async () => {
      uxHelpers.LocalCache.set('expiring-key', 'value', 100); // 100ms TTL
      
      // Should exist immediately
      expect(uxHelpers.LocalCache.get('expiring-key')).toBe('value');
      
      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 150));
      
      // Should be expired
      expect(uxHelpers.LocalCache.get('expiring-key')).toBeNull();
    });
  });

  describe('debounce', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should debounce function calls', () => {
      const mockFn = jest.fn();
      const debouncedFn = uxHelpers.debounce(mockFn, 100);

      debouncedFn();
      debouncedFn();
      debouncedFn();

      expect(mockFn).not.toHaveBeenCalled();

      jest.advanceTimersByTime(100);

      expect(mockFn).toHaveBeenCalledTimes(1);
    });
  });

  describe('throttle', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should throttle function calls', () => {
      const mockFn = jest.fn();
      const throttledFn = uxHelpers.throttle(mockFn, 100);

      throttledFn(); // First call should execute
      throttledFn(); // Should be throttled
      throttledFn(); // Should be throttled

      expect(mockFn).toHaveBeenCalledTimes(1);

      jest.advanceTimersByTime(100);
      throttledFn(); // Should execute now

      expect(mockFn).toHaveBeenCalledTimes(2);
    });
  });

  describe('copyToClipboard', () => {
    it('should attempt to copy text in secure context', async () => {
      // Mock secure context
      Object.defineProperty(window, 'isSecureContext', {
        value: true,
        writable: true,
      });
      
      // Mock clipboard API
      const mockWriteText = jest.fn().mockResolvedValue(undefined);
      Object.assign(navigator, {
        clipboard: {
          writeText: mockWriteText,
        },
      });

      const result = await uxHelpers.copyToClipboard('test text');
      expect(mockWriteText).toHaveBeenCalledWith('test text');
      expect(result).toBe(true);
    });
    
    it('should handle copy failure gracefully', async () => {
      // Mock clipboard API to reject
      const mockWriteText = jest.fn().mockRejectedValue(new Error('Copy failed'));
      Object.assign(navigator, {
        clipboard: {
          writeText: mockWriteText,
        },
      });

      const result = await uxHelpers.copyToClipboard('test text');
      expect(result).toBe(false);
    });
  });

  describe('detectDevice', () => {
    it('should detect device type', () => {
      const result = uxHelpers.detectDevice();
      
      expect(result).toHaveProperty('isMobile');
      expect(result).toHaveProperty('isTablet');
      expect(result).toHaveProperty('isDesktop');
      expect(result).toHaveProperty('isTouchDevice');
      expect(result).toHaveProperty('os');
      expect(typeof result.isMobile).toBe('boolean');
      expect(typeof result.isTablet).toBe('boolean');
      expect(typeof result.isDesktop).toBe('boolean');
    });
  });

  describe('detectBrowserFeatures', () => {
    it('should detect browser features', () => {
      const result = uxHelpers.detectBrowserFeatures();
      
      expect(result).toHaveProperty('hasWebGL');
      expect(result).toHaveProperty('hasWebSocket');
      expect(result).toHaveProperty('hasServiceWorker');
      expect(result).toHaveProperty('hasLocalStorage');
      expect(typeof result.hasWebSocket).toBe('boolean');
      // Note: hasWebGL will be false in jsdom environment
      expect(typeof result.hasWebGL).toBe('boolean');
    });
  });

  describe('formatRelativeTime', () => {
    it('should format recent time as "刚刚"', () => {
      const now = new Date();
      const result = uxHelpers.formatRelativeTime(now);
      expect(result).toBe('刚刚');
    });

    it('should format minutes ago', () => {
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
      const result = uxHelpers.formatRelativeTime(fiveMinutesAgo);
      expect(result).toBe('5分钟前');
    });

    it('should format hours ago', () => {
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
      const result = uxHelpers.formatRelativeTime(twoHoursAgo);
      expect(result).toBe('2小时前');
    });
  });

  describe('generateId', () => {
    it('should generate unique IDs', () => {
      const id1 = uxHelpers.generateId();
      const id2 = uxHelpers.generateId();
      
      expect(id1).toBeDefined();
      expect(id2).toBeDefined();
      expect(id1).not.toBe(id2);
    });
  });
});

// Test Toast functionality
describe('Toast System', () => {
  it('should have toast methods', async () => {
    const { Toast } = await import('../Toast');
    
    expect(typeof Toast.success).toBe('function');
    expect(typeof Toast.error).toBe('function');
    expect(typeof Toast.info).toBe('function');
    expect(typeof Toast.warning).toBe('function');
    expect(typeof Toast.loading).toBe('function');
    expect(typeof Toast.remove).toBe('function');
    expect(typeof Toast.clear).toBe('function');
  });
});