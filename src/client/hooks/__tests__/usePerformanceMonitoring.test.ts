/**
 * Performance Monitoring Hook Tests
 * 
 * Tests for helper functions and logic used in performance monitoring
 */

describe('Performance Monitoring Utilities', () => {
  // Test the detection logic directly without React hooks

  describe('Device Type Detection', () => {
    const detectDeviceType = (width: number): 'mobile' | 'tablet' | 'desktop' => {
      if (width < 768) return 'mobile';
      if (width < 1024) return 'tablet';
      return 'desktop';
    };

    it('should detect mobile for width < 768', () => {
      expect(detectDeviceType(320)).toBe('mobile');
      expect(detectDeviceType(480)).toBe('mobile');
      expect(detectDeviceType(767)).toBe('mobile');
    });

    it('should detect tablet for width 768-1023', () => {
      expect(detectDeviceType(768)).toBe('tablet');
      expect(detectDeviceType(800)).toBe('tablet');
      expect(detectDeviceType(1023)).toBe('tablet');
    });

    it('should detect desktop for width >= 1024', () => {
      expect(detectDeviceType(1024)).toBe('desktop');
      expect(detectDeviceType(1440)).toBe('desktop');
      expect(detectDeviceType(1920)).toBe('desktop');
    });
  });

  describe('Session ID Generation', () => {
    const generateSessionId = (): string => {
      return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    };

    it('should generate unique session IDs', () => {
      const id1 = generateSessionId();
      const id2 = generateSessionId();
      
      expect(id1).toMatch(/^session_/);
      expect(id2).toMatch(/^session_/);
      expect(id1).not.toBe(id2);
    });

    it('should have correct format', () => {
      const id = generateSessionId();
      
      expect(id).toMatch(/^session_\d+_[a-z0-9]{9}$/);
    });
  });

  describe('User Agent Parsing', () => {
    const parseUserAgent = (ua: string): { os: string; browser: string } => {
      let os = 'unknown';
      let browser = 'unknown';

      // Detect OS - check Android/iOS before Linux/Mac since they contain those strings
      if (ua.includes('Android')) os = 'Android';
      else if (ua.includes('iPhone') || ua.includes('iPad') || ua.includes('iOS')) os = 'iOS';
      else if (ua.includes('Win')) os = 'Windows';
      else if (ua.includes('Mac')) os = 'MacOS';
      else if (ua.includes('Linux')) os = 'Linux';

      // Detect browser
      if (ua.includes('Firefox')) browser = 'Firefox';
      else if (ua.includes('Edg')) browser = 'Edge';
      else if (ua.includes('Chrome')) browser = 'Chrome';
      else if (ua.includes('Safari')) browser = 'Safari';

      return { os, browser };
    };

    it('should detect Windows OS', () => {
      const ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';
      const { os } = parseUserAgent(ua);
      expect(os).toBe('Windows');
    });

    it('should detect MacOS', () => {
      const ua = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36';
      const { os } = parseUserAgent(ua);
      expect(os).toBe('MacOS');
    });

    it('should detect Android', () => {
      const ua = 'Mozilla/5.0 (Linux; Android 11; Pixel 4) AppleWebKit/537.36';
      const { os } = parseUserAgent(ua);
      expect(os).toBe('Android');
    });

    it('should detect iOS', () => {
      const ua = 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15';
      const { os } = parseUserAgent(ua);
      expect(os).toBe('iOS');
    });

    it('should detect Chrome browser', () => {
      const ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/91.0.4472.124 Safari/537.36';
      const { browser } = parseUserAgent(ua);
      expect(browser).toBe('Chrome');
    });

    it('should detect Firefox browser', () => {
      const ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:89.0) Gecko/20100101 Firefox/89.0';
      const { browser } = parseUserAgent(ua);
      expect(browser).toBe('Firefox');
    });

    it('should detect Edge browser', () => {
      const ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Edg/91.0.864.59';
      const { browser } = parseUserAgent(ua);
      expect(browser).toBe('Edge');
    });

    it('should detect Safari browser', () => {
      const ua = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Safari/605.1.15';
      const { browser } = parseUserAgent(ua);
      expect(browser).toBe('Safari');
    });
  });

  describe('Performance Rating Classification', () => {
    const classifyLcp = (lcp: number): 'good' | 'needsImprovement' | 'poor' => {
      if (lcp <= 2500) return 'good';
      if (lcp <= 4000) return 'needsImprovement';
      return 'poor';
    };

    const classifyFcp = (fcp: number): 'good' | 'needsImprovement' | 'poor' => {
      if (fcp <= 1800) return 'good';
      if (fcp <= 3000) return 'needsImprovement';
      return 'poor';
    };

    const classifyFid = (fid: number): 'good' | 'needsImprovement' | 'poor' => {
      if (fid <= 100) return 'good';
      if (fid <= 300) return 'needsImprovement';
      return 'poor';
    };

    const classifyCls = (cls: number): 'good' | 'needsImprovement' | 'poor' => {
      if (cls <= 0.1) return 'good';
      if (cls <= 0.25) return 'needsImprovement';
      return 'poor';
    };

    it('should correctly classify LCP values', () => {
      expect(classifyLcp(1000)).toBe('good');
      expect(classifyLcp(2500)).toBe('good');
      expect(classifyLcp(2501)).toBe('needsImprovement');
      expect(classifyLcp(4000)).toBe('needsImprovement');
      expect(classifyLcp(4001)).toBe('poor');
    });

    it('should correctly classify FCP values', () => {
      expect(classifyFcp(1000)).toBe('good');
      expect(classifyFcp(1800)).toBe('good');
      expect(classifyFcp(1801)).toBe('needsImprovement');
      expect(classifyFcp(3000)).toBe('needsImprovement');
      expect(classifyFcp(3001)).toBe('poor');
    });

    it('should correctly classify FID values', () => {
      expect(classifyFid(50)).toBe('good');
      expect(classifyFid(100)).toBe('good');
      expect(classifyFid(101)).toBe('needsImprovement');
      expect(classifyFid(300)).toBe('needsImprovement');
      expect(classifyFid(301)).toBe('poor');
    });

    it('should correctly classify CLS values', () => {
      expect(classifyCls(0.05)).toBe('good');
      expect(classifyCls(0.1)).toBe('good');
      expect(classifyCls(0.11)).toBe('needsImprovement');
      expect(classifyCls(0.25)).toBe('needsImprovement');
      expect(classifyCls(0.26)).toBe('poor');
    });
  });

  describe('Percentile Calculation', () => {
    const calculatePercentile = (values: number[], percentile: number): number => {
      if (values.length === 0) return 0;
      const sorted = [...values].sort((a, b) => a - b);
      const index = Math.ceil((percentile / 100) * sorted.length) - 1;
      return sorted[Math.max(0, index)];
    };

    it('should calculate p50 (median)', () => {
      const values = [1, 2, 3, 4, 5];
      expect(calculatePercentile(values, 50)).toBe(3);
    });

    it('should calculate p75', () => {
      const values = [1, 2, 3, 4, 5, 6, 7, 8];
      expect(calculatePercentile(values, 75)).toBe(6);
    });

    it('should calculate p95', () => {
      const values = Array.from({ length: 100 }, (_, i) => i + 1);
      expect(calculatePercentile(values, 95)).toBe(95);
    });

    it('should handle empty array', () => {
      expect(calculatePercentile([], 50)).toBe(0);
    });

    it('should handle single value', () => {
      expect(calculatePercentile([42], 50)).toBe(42);
    });
  });

  describe('Metric Aggregation', () => {
    const aggregateMetrics = (metrics: Array<{ lcp?: number; fcp?: number }>) => {
      const lcpValues = metrics.map(m => m.lcp).filter((v): v is number => v != null);
      const fcpValues = metrics.map(m => m.fcp).filter((v): v is number => v != null);

      return {
        count: metrics.length,
        avgLcp: lcpValues.length > 0 ? lcpValues.reduce((a, b) => a + b, 0) / lcpValues.length : 0,
        avgFcp: fcpValues.length > 0 ? fcpValues.reduce((a, b) => a + b, 0) / fcpValues.length : 0,
      };
    };

    it('should calculate averages correctly', () => {
      const metrics = [
        { lcp: 2000, fcp: 1500 },
        { lcp: 3000, fcp: 1800 },
        { lcp: 2500, fcp: 1600 },
      ];

      const result = aggregateMetrics(metrics);

      expect(result.count).toBe(3);
      expect(result.avgLcp).toBe(2500);
      expect(result.avgFcp).toBeCloseTo(1633.33, 1);
    });

    it('should handle missing values', () => {
      const metrics = [
        { lcp: 2000 },
        { fcp: 1800 },
        { lcp: 3000, fcp: 2000 },
      ];

      const result = aggregateMetrics(metrics);

      expect(result.count).toBe(3);
      expect(result.avgLcp).toBe(2500);
      expect(result.avgFcp).toBe(1900);
    });

    it('should handle empty array', () => {
      const result = aggregateMetrics([]);

      expect(result.count).toBe(0);
      expect(result.avgLcp).toBe(0);
      expect(result.avgFcp).toBe(0);
    });
  });
});