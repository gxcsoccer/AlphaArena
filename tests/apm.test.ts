/**
 * Tests for APM (Application Performance Monitoring) Service
 */

import { describe, it, expect, vi, beforeEach, jest } from '@jest/globals';

// Mock web-vitals
jest.mock('web-vitals', () => ({
  onCLS: (cb: (metric: { value: number; name: string }) => void) => cb({ value: 0.05, name: 'CLS' }),
  onLCP: (cb: (metric: { value: number; name: string }) => void) => cb({ value: 1500, name: 'LCP' }),
  onFCP: (cb: (metric: { value: number; name: string }) => void) => cb({ value: 800, name: 'FCP' }),
  onTTFB: (cb: (metric: { value: number; name: string }) => void) => cb({ value: 200, name: 'TTFB' }),
  onINP: (cb: (metric: { value: number; name: string }) => void) => cb({ value: 100, name: 'INP' }),
}));

// Mock fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

// Mock performance.now
global.performance.now = jest.fn(() => Date.now());

// Mock navigator.sendBeacon
Object.defineProperty(navigator, 'sendBeacon', {
  value: jest.fn(() => true),
  writable: true,
});

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

describe('APM Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset window.innerWidth for device detection
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      value: 1024,
    });
  });

  describe('Error Tracking', () => {
    it('should track JavaScript errors', async () => {
      const { apm } = await import('../src/client/utils/apm');
      
      apm.init({ enableErrorTracking: true, enablePerformanceMonitoring: false, enableApiLatency: false });
      
      const error = new Error('Test error');
      apm.trackError(error);
      
      const errors = apm.getErrors();
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].message).toBe('Test error');
      expect(errors[0].type).toBe('javascript');
    });

    it('should track React errors with component stack', async () => {
      const { apm } = await import('../src/client/utils/apm');
      
      apm.init({ enableErrorTracking: true, enablePerformanceMonitoring: false, enableApiLatency: false });
      
      const error = new Error('React render error');
      const componentStack = '    at Component\n    at App';
      apm.trackReactError(error, componentStack);
      
      const errors = apm.getErrors();
      const reactError = errors.find(e => e.type === 'react');
      expect(reactError).toBeDefined();
      expect(reactError?.context.componentStack).toBe(componentStack);
    });

    it('should assign severity levels', async () => {
      const { apm } = await import('../src/client/utils/apm');
      
      apm.init({ enableErrorTracking: true, enablePerformanceMonitoring: false, enableApiLatency: false });
      
      apm.trackError(new Error('Low error'), { severity: 'low' });
      apm.trackError(new Error('High error'), { severity: 'high' });
      
      const errors = apm.getErrors();
      expect(errors.find(e => e.severity === 'low')).toBeDefined();
      expect(errors.find(e => e.severity === 'high')).toBeDefined();
    });
  });

  describe('API Latency Tracking', () => {
    it('should track API call latency', async () => {
      const { apm } = await import('../src/client/utils/apm');
      
      apm.init({ enableErrorTracking: false, enablePerformanceMonitoring: false, enableApiLatency: true });
      
      apm.trackApiCall('/api/test', 'GET', 150, 200, true);
      apm.trackApiCall('/api/test2', 'POST', 300, 201, true);
      
      const latencies = apm.getApiLatencies();
      // Filter to only the ones we just added
      const recentLatencies = latencies.filter(l => l.endpoint === '/api/test' || l.endpoint === '/api/test2');
      expect(recentLatencies.length).toBe(2);
    });

    it('should track slow API calls as breadcrumbs', async () => {
      const { apm } = await import('../src/client/utils/apm');
      
      apm.init({ enableErrorTracking: false, enablePerformanceMonitoring: false, enableApiLatency: true });
      
      apm.trackApiCall('/api/slow-endpoint-test', 'GET', 3000, 200, true);
      
      const breadcrumbs = apm.getBreadcrumbs();
      const slowBreadcrumb = breadcrumbs.find(b => b.type === 'api' && b.message.includes('Slow API'));
      expect(slowBreadcrumb).toBeDefined();
    });
  });

  describe('Breadcrumbs', () => {
    it('should add breadcrumbs', async () => {
      const { apm } = await import('../src/client/utils/apm');
      
      apm.init({ enableErrorTracking: true, enablePerformanceMonitoring: false, enableApiLatency: false });
      
      apm.addBreadcrumb('user', 'Clicked button test');
      apm.addBreadcrumb('navigation', 'Navigated to /dashboard test');
      
      const breadcrumbs = apm.getBreadcrumbs();
      expect(breadcrumbs.find(b => b.message.includes('Clicked button test'))).toBeDefined();
      expect(breadcrumbs.find(b => b.message.includes('Navigated to /dashboard test'))).toBeDefined();
    });
  });

  describe('Performance Metrics', () => {
    it('should detect device type', async () => {
      const { apm } = await import('../src/client/utils/apm');
      
      // Desktop
      Object.defineProperty(window, 'innerWidth', { value: 1200, writable: true });
      apm.init({ enableErrorTracking: false, enablePerformanceMonitoring: true, enableApiLatency: false });
      
      const metrics = apm.getMetrics();
      expect(metrics.deviceType).toBe('desktop');
    });

    it('should detect mobile device type', async () => {
      const { apm } = await import('../src/client/utils/apm');
      
      // Mobile
      Object.defineProperty(window, 'innerWidth', { value: 500, writable: true });
      
      // Re-import to get fresh instance (simulating new page load)
      jest.resetModules();
      const { apm: apmFresh } = await import('../src/client/utils/apm');
      
      apmFresh.init({ enableErrorTracking: false, enablePerformanceMonitoring: true, enableApiLatency: false });
      
      const metrics = apmFresh.getMetrics();
      expect(metrics.deviceType).toBe('mobile');
    });
  });

  describe('Error Context', () => {
    it('should include context in error reports', async () => {
      const { apm } = await import('../src/client/utils/apm');
      
      apm.init({ enableErrorTracking: true, enablePerformanceMonitoring: false, enableApiLatency: false });
      
      apm.trackError(new Error('Context test error'), {
        type: 'javascript',
        context: { foo: 'bar' },
      });
      
      const errors = apm.getErrors();
      const contextError = errors.find(e => e.message === 'Context test error');
      expect(contextError).toBeDefined();
      expect(contextError?.context.metadata).toEqual({ foo: 'bar' });
    });
  });
});