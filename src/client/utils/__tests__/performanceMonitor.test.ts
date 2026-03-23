/**
 * Tests for Performance Monitor SDK
 */

import { PerformanceMonitor, getPerformanceMonitor, PerformanceAlert } from '../performanceMonitor';

// Mock fetch
global.fetch = jest.fn(() =>
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve({ success: true }),
  } as Response)
);

// Mock sessionStorage
const mockSessionStorage: { [key: string]: string } = {};
jest.spyOn(Storage.prototype, 'getItem').mockImplementation((key) => mockSessionStorage[key] || null);
jest.spyOn(Storage.prototype, 'setItem').mockImplementation((key, value) => {
  mockSessionStorage[key] = value;
});

// Mock PerformanceObserver
const mockObserve = jest.fn();
const mockDisconnect = jest.fn();
class MockPerformanceObserver {
  private callback: PerformanceObserverCallback;
  
  constructor(callback: PerformanceObserverCallback) {
    this.callback = callback;
  }
  
  observe = mockObserve;
  disconnect = mockDisconnect;
}

(global as any).PerformanceObserver = MockPerformanceObserver;

// Mock performance API
Object.defineProperty(global, 'performance', {
  value: {
    getEntriesByType: jest.fn(() => []),
    memory: {
      usedJSHeapSize: 10000000,
      totalJSHeapSize: 50000000,
    },
  },
  writable: true,
  configurable: true,
});

// Mock navigator
Object.defineProperty(global, 'navigator', {
  value: {
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
    connection: {
      type: 'wifi',
      effectiveType: '4g',
    },
  },
  writable: true,
  configurable: true,
});

// Mock window - check if already defined
if (!(global as any).window) {
  Object.defineProperty(global, 'window', {
    value: {
      screen: { width: 1920, height: 1080 },
      location: { pathname: '/test' },
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      innerWidth: 1920,
    },
    writable: true,
    configurable: true,
  });
}

// Mock document - check if already defined
if (!(global as any).document) {
  Object.defineProperty(global, 'document', {
    value: {
      readyState: 'complete',
      visibilityState: 'visible',
      addEventListener: jest.fn(),
    },
    writable: true,
    configurable: true,
  });
}

// Mock history - check if already defined
if (!(global as any).history) {
  Object.defineProperty(global, 'history', {
    value: {
      pushState: jest.fn(),
      replaceState: jest.fn(),
    },
    writable: true,
    configurable: true,
  });
}

describe('PerformanceMonitor', () => {
  let monitor: PerformanceMonitor;

  beforeEach(() => {
    jest.clearAllMocks();
    // Create new instance for each test
    monitor = new PerformanceMonitor({ debug: true, sampleRate: 1 });
  });

  afterEach(() => {
    if (monitor) {
      monitor.destroy();
    }
  });

  describe('constructor', () => {
    it('should create a monitor instance', () => {
      expect(monitor).toBeInstanceOf(PerformanceMonitor);
    });

    it('should use default config when not provided', () => {
      const defaultMonitor = new PerformanceMonitor();
      expect(defaultMonitor).toBeInstanceOf(PerformanceMonitor);
      defaultMonitor.destroy();
    });

    it('should respect sample rate', () => {
      // With sample rate 0, the monitor should not initialize
      const unsampledMonitor = new PerformanceMonitor({ sampleRate: 0 });
      expect(unsampledMonitor).toBeInstanceOf(PerformanceMonitor);
      unsampledMonitor.destroy();
    });
  });

  describe('recordMetric', () => {
    it('should record a metric value', () => {
      monitor.recordMetric('lcp', 2500);
      const metrics = monitor.getCurrentMetrics();
      expect(metrics.coreWebVitals.lcp).toBe(2500);
    });

    it('should check thresholds and emit alerts', () => {
      const alertCallback = jest.fn();
      monitor.onAlert(alertCallback);
      
      // Record a poor LCP value
      monitor.recordMetric('lcp', 5000);
      
      expect(alertCallback).toHaveBeenCalled();
      const alert = alertCallback.mock.calls[0][0] as PerformanceAlert;
      expect(alert.type).toBe('lcp');
      expect(alert.severity).toBe('critical');
    });

    it('should not emit alert for good values', () => {
      const alertCallback = jest.fn();
      monitor.onAlert(alertCallback);
      
      // Record a good LCP value
      monitor.recordMetric('lcp', 1500);
      
      // No alert should be emitted for good performance
      expect(alertCallback).not.toHaveBeenCalled();
    });
  });

  describe('recordApiLatency', () => {
    it('should record API latency', () => {
      monitor.recordApiLatency(100);
      monitor.recordApiLatency(200);
      
      const metrics = monitor.getCurrentMetrics();
      expect(metrics.apiLatencies).toHaveLength(2);
      expect(metrics.customMetrics.apiLatency).toBe(150); // Average of 100 and 200
    });

    it('should emit alert for high latency', () => {
      const alertCallback = jest.fn();
      monitor.onAlert(alertCallback);
      
      // Record high latency
      monitor.recordApiLatency(1500);
      
      expect(alertCallback).toHaveBeenCalled();
    });
  });

  describe('onAlert', () => {
    it('should register alert callback', () => {
      const callback = jest.fn();
      const unsubscribe = monitor.onAlert(callback);
      
      monitor.recordMetric('fcp', 5000);
      
      expect(callback).toHaveBeenCalled();
      
      // Test unsubscribe
      unsubscribe();
      callback.mockClear();
      
      monitor.recordMetric('fcp', 5000);
      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('getCurrentMetrics', () => {
    it('should return current metrics', () => {
      monitor.recordMetric('lcp', 2500);
      monitor.recordMetric('fcp', 1500);
      
      const metrics = monitor.getCurrentMetrics();
      
      expect(metrics.coreWebVitals.lcp).toBe(2500);
      expect(metrics.coreWebVitals.fcp).toBe(1500);
    });
  });

  describe('flush', () => {
    it('should flush metrics to server', async () => {
      monitor.recordMetric('lcp', 2500);
      monitor.recordMetric('fcp', 1500);
      
      await monitor.flush();
      
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/performance/metrics',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
        })
      );
    });

    it('should handle flush errors gracefully', async () => {
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));
      
      monitor.recordMetric('lcp', 2500);
      
      // Should not throw
      await expect(monitor.flush()).resolves.not.toThrow();
    });
  });

  describe('destroy', () => {
    it('should cleanup resources', () => {
      monitor.recordMetric('lcp', 2500);
      
      monitor.destroy();
      
      // Should flush remaining metrics
      expect(global.fetch).toHaveBeenCalled();
    });
  });
});

describe('getPerformanceMonitor', () => {
  it('should return singleton instance', () => {
    const instance1 = getPerformanceMonitor();
    const instance2 = getPerformanceMonitor();
    
    expect(instance1).toBe(instance2);
  });
});