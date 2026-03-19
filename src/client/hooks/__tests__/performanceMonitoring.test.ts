/**
 * Performance Monitoring Utility Tests
 * 
 * Tests for helper functions used in performance monitoring
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
      expect(detectDeviceType(1280)).toBe('desktop');
      expect(detectDeviceType(1920)).toBe('desktop');
    });
  });

  describe('User Agent Parsing', () => {
    const parseUserAgent = (ua: string): { os: string; browser: string } => {
      let os = 'unknown';
      let browser = 'unknown';

      // Detect OS - order matters, check mobile OS first
      if (ua.includes('Android')) os = 'Android';
      else if (ua.includes('iPhone') || ua.includes('iPad')) os = 'iOS';
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

    it('should detect Chrome on MacOS', () => {
      const ua = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
      const result = parseUserAgent(ua);
      expect(result.os).toBe('MacOS');
      expect(result.browser).toBe('Chrome');
    });

    it('should detect Firefox on Windows', () => {
      const ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0';
      const result = parseUserAgent(ua);
      expect(result.os).toBe('Windows');
      expect(result.browser).toBe('Firefox');
    });

    it('should detect Edge', () => {
      const ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0';
      const result = parseUserAgent(ua);
      expect(result.browser).toBe('Edge');
    });

    it('should detect Android', () => {
      const ua = 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36';
      const result = parseUserAgent(ua);
      expect(result.os).toBe('Android');
      expect(result.browser).toBe('Chrome');
    });

    it('should detect iOS Safari', () => {
      const ua = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1';
      const result = parseUserAgent(ua);
      expect(result.os).toBe('iOS');
      expect(result.browser).toBe('Safari');
    });
  });

  describe('Session ID Generation', () => {
    const generateSessionId = (): string => {
      return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    };

    it('should generate unique session IDs', () => {
      const ids = new Set();
      for (let i = 0; i < 100; i++) {
        ids.add(generateSessionId());
      }
      expect(ids.size).toBe(100);
    });

    it('should match expected format', () => {
      const id = generateSessionId();
      expect(id).toMatch(/^session_\d+_[a-z0-9]{9}$/);
    });
  });

  describe('Performance Rating', () => {
    const getLcpRating = (lcp: number): 'good' | 'needsImprovement' | 'poor' => {
      if (lcp <= 2500) return 'good';
      if (lcp <= 4000) return 'needsImprovement';
      return 'poor';
    };

    const getFcpRating = (fcp: number): 'good' | 'needsImprovement' | 'poor' => {
      if (fcp <= 1800) return 'good';
      if (fcp <= 3000) return 'needsImprovement';
      return 'poor';
    };

    const getFidRating = (fid: number): 'good' | 'needsImprovement' | 'poor' => {
      if (fid <= 100) return 'good';
      if (fid <= 300) return 'needsImprovement';
      return 'poor';
    };

    const getClsRating = (cls: number): 'good' | 'needsImprovement' | 'poor' => {
      if (cls <= 0.1) return 'good';
      if (cls <= 0.25) return 'needsImprovement';
      return 'poor';
    };

    it('should correctly rate LCP values', () => {
      expect(getLcpRating(1000)).toBe('good');
      expect(getLcpRating(2500)).toBe('good');
      expect(getLcpRating(3000)).toBe('needsImprovement');
      expect(getLcpRating(4000)).toBe('needsImprovement');
      expect(getLcpRating(5000)).toBe('poor');
    });

    it('should correctly rate FCP values', () => {
      expect(getFcpRating(1000)).toBe('good');
      expect(getFcpRating(1800)).toBe('good');
      expect(getFcpRating(2500)).toBe('needsImprovement');
      expect(getFcpRating(3500)).toBe('poor');
    });

    it('should correctly rate FID values', () => {
      expect(getFidRating(50)).toBe('good');
      expect(getFidRating(100)).toBe('good');
      expect(getFidRating(200)).toBe('needsImprovement');
      expect(getFidRating(400)).toBe('poor');
    });

    it('should correctly rate CLS values', () => {
      expect(getClsRating(0.05)).toBe('good');
      expect(getClsRating(0.1)).toBe('good');
      expect(getClsRating(0.15)).toBe('needsImprovement');
      expect(getClsRating(0.3)).toBe('poor');
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
});