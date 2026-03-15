/**
 * Tests for useErrorReporter hook
 */

import { renderHook, act } from '@testing-library/react';
import { useErrorReporter } from '../useErrorReporter';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: jest.fn((key: string) => store[key] || null),
    setItem: jest.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: jest.fn((key: string) => {
      delete store[key];
    }),
    clear: jest.fn(() => {
      store = {};
    }),
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

// Mock fetch
global.fetch = jest.fn();

describe('useErrorReporter', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (global.fetch as jest.Mock).mockClear();
    localStorageMock.clear();
  });

  it('should initialize with empty errors', () => {
    const { result } = renderHook(() => useErrorReporter());

    expect(result.current.errors).toEqual([]);
    expect(result.current.hasErrors).toBe(false);
  });

  it('should capture error events', () => {
    const { result } = renderHook(() => useErrorReporter({ debug: false }));

    // Simulate an error event
    act(() => {
      const errorEvent = new ErrorEvent('error', {
        message: 'Test error',
        filename: 'test.js',
        lineno: 10,
        colno: 5,
        error: new Error('Test error'),
      });
      window.dispatchEvent(errorEvent);
    });

    expect(result.current.errors.length).toBe(1);
    expect(result.current.hasErrors).toBe(true);
    expect(result.current.errors[0].message).toBe('Test error');
    expect(result.current.errors[0].type).toBe('error');
    expect(result.current.errors[0].source).toBe('test.js');
    expect(result.current.errors[0].lineno).toBe(10);
  });

  it('should capture unhandled promise rejections', () => {
    const { result } = renderHook(() => useErrorReporter({ debug: false }));

    // Simulate an unhandled rejection
    act(() => {
      const rejectionEvent = new Event('unhandledrejection') as PromiseRejectionEvent;
      Object.defineProperty(rejectionEvent, 'reason', {
        value: new Error('Promise rejected'),
        writable: false,
      });
      window.dispatchEvent(rejectionEvent);
    });

    expect(result.current.errors.length).toBe(1);
    expect(result.current.hasErrors).toBe(true);
    expect(result.current.errors[0].message).toBe('Promise rejected');
    expect(result.current.errors[0].type).toBe('unhandledrejection');
  });

  it('should send errors to backend', () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    });

    const { result } = renderHook(() => useErrorReporter({ 
      endpoint: '/api/log-error',
      debug: false,
    }));

    act(() => {
      const errorEvent = new ErrorEvent('error', {
        message: 'Backend test error',
        error: new Error('Backend test error'),
      });
      window.dispatchEvent(errorEvent);
    });

    // Wait for fetch to be called
    setTimeout(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/log-error',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
        })
      );
    }, 100);
  });

  it('should save errors to localStorage when enabled', () => {
    const { result } = renderHook(() => useErrorReporter({ 
      enableLocalStorage: true,
      debug: false,
    }));

    act(() => {
      const errorEvent = new ErrorEvent('error', {
        message: 'LocalStorage test',
        error: new Error('LocalStorage test'),
      });
      window.dispatchEvent(errorEvent);
    });

    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      'alphaarena_captured_errors',
      expect.any(String)
    );
  });

  it('should clear errors', () => {
    const { result } = renderHook(() => useErrorReporter());

    act(() => {
      const errorEvent = new ErrorEvent('error', {
        message: 'To be cleared',
        error: new Error('To be cleared'),
      });
      window.dispatchEvent(errorEvent);
    });

    expect(result.current.errors.length).toBe(1);

    act(() => {
      result.current.clearErrors();
    });

    expect(result.current.errors.length).toBe(0);
    expect(result.current.hasErrors).toBe(false);
    expect(localStorageMock.removeItem).toHaveBeenCalledWith(
      'alphaarena_captured_errors'
    );
  });

  it('should include user agent and URL in captured errors', () => {
    const { result } = renderHook(() => useErrorReporter({ debug: false }));

    act(() => {
      const errorEvent = new ErrorEvent('error', {
        message: 'Context test',
        error: new Error('Context test'),
      });
      window.dispatchEvent(errorEvent);
    });

    const error = result.current.errors[0];
    expect(error.url).toBe(window.location.href);
    expect(error.userAgent).toBe(navigator.userAgent);
  });
});
