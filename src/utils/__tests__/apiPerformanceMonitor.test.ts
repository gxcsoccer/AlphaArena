/**
 * API Performance Monitor Tests
 */

import { APIPerformanceMonitor, performanceMonitorMiddleware } from '../apiPerformanceMonitor';
import { Request, Response } from 'express';

describe('APIPerformanceMonitor', () => {
  let monitor: APIPerformanceMonitor;

  beforeEach(() => {
    monitor = APIPerformanceMonitor.getInstance({
      sampleSize: 100,
      slowThresholdMs: 1000,
    });
    monitor.reset();
  });

  describe('recordMetric', () => {
    it('should record request metrics', () => {
      monitor.recordMetric({
        timestamp: Date.now(),
        method: 'GET',
        path: '/api/test',
        statusCode: 200,
        duration: 50,
      });

      const stats = monitor.getStats();
      expect(stats.totalRequests).toBe(1);
      expect(stats.successfulRequests).toBe(1);
      expect(stats.failedRequests).toBe(0);
    });

    it('should track failed requests', () => {
      // Add error listener to prevent unhandled error
      monitor.on('error', () => {});
      
      monitor.recordMetric({
        timestamp: Date.now(),
        method: 'GET',
        path: '/api/error',
        statusCode: 500,
        duration: 100,
      });

      const stats = monitor.getStats();
      expect(stats.totalRequests).toBe(1);
      expect(stats.failedRequests).toBe(1);
    });

    it('should track cache hits', () => {
      monitor.recordMetric({
        timestamp: Date.now(),
        method: 'GET',
        path: '/api/cached',
        statusCode: 200,
        duration: 5,
        cacheHit: true,
      });

      monitor.recordMetric({
        timestamp: Date.now(),
        method: 'GET',
        path: '/api/not-cached',
        statusCode: 200,
        duration: 50,
        cacheHit: false,
      });

      const stats = monitor.getStats();
      expect(stats.cacheHitRate).toBe(0.5);
    });

    it('should skip excluded paths', () => {
      monitor.recordMetric({
        timestamp: Date.now(),
        method: 'GET',
        path: '/health',
        statusCode: 200,
        duration: 10,
      });

      const stats = monitor.getStats();
      expect(stats.totalRequests).toBe(0);
    });

    it('should detect slow requests', () => {
      const slowHandler = jest.fn();
      monitor.on('slow-request', slowHandler);

      monitor.recordMetric({
        timestamp: Date.now(),
        method: 'GET',
        path: '/api/slow',
        statusCode: 200,
        duration: 1500, // > 1000ms threshold
      });

      expect(slowHandler).toHaveBeenCalled();
    });
  });

  describe('getStats', () => {
    it('should calculate percentiles correctly', () => {
      // Add 10 requests with durations 10-100ms
      for (let i = 1; i <= 10; i++) {
        monitor.recordMetric({
          timestamp: Date.now(),
          method: 'GET',
          path: '/api/test',
          statusCode: 200,
          duration: i * 10,
        });
      }

      const stats = monitor.getStats();
      
      expect(stats.totalRequests).toBe(10);
      expect(stats.averageResponseTime).toBe(55); // Average of 10-100
      expect(stats.p50ResponseTime).toBeGreaterThanOrEqual(50);
      expect(stats.p95ResponseTime).toBeGreaterThanOrEqual(90);
      expect(stats.p99ResponseTime).toBeGreaterThanOrEqual(95);
    });

    it('should calculate error rate', () => {
      // Add error listener to prevent unhandled errors
      monitor.on('error', () => {});
      
      for (let i = 0; i < 10; i++) {
        monitor.recordMetric({
          timestamp: Date.now(),
          method: 'GET',
          path: '/api/test',
          statusCode: i < 3 ? 500 : 200,
          duration: 50,
        });
      }

      const stats = monitor.getStats();
      expect(stats.errorRate).toBeCloseTo(0.3, 1);
    });
  });

  describe('getSlowestEndpoints', () => {
    it('should return slowest endpoints', () => {
      // Add requests with different durations
      for (let i = 1; i <= 5; i++) {
        monitor.recordMetric({
          timestamp: Date.now(),
          method: 'GET',
          path: `/api/endpoint${i}`,
          statusCode: 200,
          duration: i * 100,
        });
      }

      const slowest = monitor.getSlowestEndpoints(3);

      expect(slowest.length).toBe(3);
      expect(slowest[0].endpoint).toBe('GET /api/endpoint5');
      expect(slowest[0].avgTime).toBe(500);
    });
  });

  describe('getMostAccessedEndpoints', () => {
    it('should return most accessed endpoints', () => {
      // Add multiple requests to same endpoints
      for (let i = 0; i < 5; i++) {
        monitor.recordMetric({
          timestamp: Date.now(),
          method: 'GET',
          path: '/api/popular',
          statusCode: 200,
          duration: 50,
        });
      }
      
      for (let i = 0; i < 2; i++) {
        monitor.recordMetric({
          timestamp: Date.now(),
          method: 'GET',
          path: '/api/less-popular',
          statusCode: 200,
          duration: 50,
        });
      }

      const mostAccessed = monitor.getMostAccessedEndpoints(2);

      expect(mostAccessed.length).toBe(2);
      expect(mostAccessed[0].endpoint).toBe('GET /api/popular');
      expect(mostAccessed[0].count).toBe(5);
    });
  });

  describe('reset', () => {
    it('should clear all statistics', () => {
      monitor.recordMetric({
        timestamp: Date.now(),
        method: 'GET',
        path: '/api/test',
        statusCode: 200,
        duration: 50,
      });

      monitor.reset();

      const stats = monitor.getStats();
      expect(stats.totalRequests).toBe(0);
      expect(stats.successfulRequests).toBe(0);
    });
  });
});

describe('performanceMonitorMiddleware', () => {
  it('should create middleware function', () => {
    const middleware = performanceMonitorMiddleware();
    expect(typeof middleware).toBe('function');
  });
});