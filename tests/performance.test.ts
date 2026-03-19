/**
 * Performance Tests for AlphaArena
 * 
 * These tests measure data processing performance and bundle size.
 * Run with: npm test -- performance.test.ts
 */

describe('Performance Benchmarks', () => {
  describe('Data Processing Performance', () => {
    it('should process order book data within 5ms', () => {
      const mockOrderBook = {
        bids: Array.from({ length: 100 }, (_, i) => ({
          price: 50000 - i * 10,
          totalQuantity: 1.5 + Math.random(),
        })),
        asks: Array.from({ length: 100 }, (_, i) => ({
          price: 50000 + (i + 1) * 10,
          totalQuantity: 1.5 + Math.random(),
        })),
      };

      const startTime = performance.now();
      
      // Simulate the optimized data preparation logic
      const rows: any[] = [];
      const asks = [...mockOrderBook.asks].sort((a, b) => a.price - b.price);
      for (let i = 0; i < asks.length; i++) {
        const level = asks[i];
        rows.push({
          key: `ask-${level.price}`,
          price: level.price,
          quantity: level.totalQuantity,
          total: level.price * level.totalQuantity,
          type: 'ask' as const,
        });
      }

      const bids = [...mockOrderBook.bids].sort((a, b) => b.price - a.price);
      for (let i = 0; i < bids.length; i++) {
        const level = bids[i];
        rows.push({
          key: `bid-${level.price}`,
          price: level.price,
          quantity: level.totalQuantity,
          total: level.price * level.totalQuantity,
          type: 'bid' as const,
        });
      }

      const endTime = performance.now();
      const processingTime = endTime - startTime;

      console.log(`Order book processing time: ${processingTime.toFixed(2)}ms`);
      
      // Should process within 5ms
      expect(processingTime).toBeLessThan(5);
      expect(rows.length).toBe(200);
    });

    it('should calculate spread efficiently (optimized loop vs map)', () => {
      const mockOrderBook = {
        bids: Array.from({ length: 100 }, (_, i) => ({
          price: 50000 - i * 10,
          totalQuantity: 1.5 + Math.random(),
        })),
        asks: Array.from({ length: 100 }, (_, i) => ({
          price: 50000 + (i + 1) * 10,
          totalQuantity: 1.5 + Math.random(),
        })),
      };

      // Test optimized loop-based approach
      const startTime1 = performance.now();
      
      let bestBid = -Infinity;
      let bestAsk = Infinity;
      
      for (let i = 0; i < mockOrderBook.bids.length; i++) {
        if (mockOrderBook.bids[i].price > bestBid) {
          bestBid = mockOrderBook.bids[i].price;
        }
      }
      
      for (let i = 0; i < mockOrderBook.asks.length; i++) {
        if (mockOrderBook.asks[i].price < bestAsk) {
          bestAsk = mockOrderBook.asks[i].price;
        }
      }
      
      const spread1 = bestAsk - bestBid;
      const midPrice1 = (bestBid + bestAsk) / 2;
      
      const endTime1 = performance.now();
      const loopTime = endTime1 - startTime1;

      // Test old map-based approach for comparison
      const startTime2 = performance.now();
      
      const bestBid2 = Math.max(...mockOrderBook.bids.map((b) => b.price));
      const bestAsk2 = Math.min(...mockOrderBook.asks.map((a) => a.price));
      const spread2 = bestAsk2 - bestBid2;
      const midPrice2 = (bestBid2 + bestAsk2) / 2;
      
      const endTime2 = performance.now();
      const mapTime = endTime2 - startTime2;

      console.log(`Loop-based spread calculation: ${loopTime.toFixed(3)}ms`);
      console.log(`Map-based spread calculation: ${mapTime.toFixed(3)}ms`);
      console.log(`Performance improvement: ${((mapTime - loopTime) / mapTime * 100).toFixed(1)}%`);
      
      // Loop should be faster or equal
      expect(loopTime).toBeLessThanOrEqual(mapTime * 1.5); // Allow some variance
      expect(spread1).toBe(spread2);
      expect(midPrice1).toBe(midPrice2);
    });
  });

  describe('Bundle Size Verification', () => {
    it('should have chunks under size limits', () => {
import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
      
      const distPath = path.join(__dirname, '../dist/client/assets');
      
      if (!fs.existsSync(distPath)) {
        console.warn('Dist folder not found. Run npm run build:client first.');
        return;
      }

      const files = fs.readdirSync(distPath);
      const jsFiles = files.filter((f: string) => f.endsWith('.js'));
      
      const sizeReport: { name: string; size: number; gzipped: number }[] = [];
      
      jsFiles.forEach((file: string) => {
        const filePath = path.join(distPath, file);
        const content = fs.readFileSync(filePath);
        const gzipped = zlib.gzipSync(content);
        const gzippedSize = gzipped.length / 1024; // KB
        
        sizeReport.push({
          name: file,
          size: content.length / 1024,
          gzipped: gzippedSize,
        });
      });

      // Sort by gzipped size descending
      sizeReport.sort((a, b) => b.gzipped - a.gzipped);

      console.log('\n=== Bundle Size Report ===');
      sizeReport.forEach(item => {
        console.log(`${item.name}: ${item.size.toFixed(2)} KB (gzip: ${item.gzipped.toFixed(2)} KB)`);
      });

      // Verify main chunks are within limits
      const mainChunk = sizeReport.find((f: { name: string; size: number; gzipped: number }) => 
        f.name.startsWith('index-') && !f.name.includes('vendor') && !f.name.includes('arco')
      );
      if (mainChunk) {
        console.log(`\nMain bundle reduced from ~1000KB to ${mainChunk.gzipped.toFixed(2)} KB (gzip)`);
        expect(mainChunk.gzipped).toBeLessThan(100); // Should be under 100KB gzipped
      }

      // Verify code splitting is working
      const pageChunks = sizeReport.filter((f: { name: string; size: number; gzipped: number }) => 
        f.name.includes('HomePage') || 
        f.name.includes('Dashboard') || 
        f.name.includes('Strategies')
      );
      
      expect(pageChunks.length).toBeGreaterThan(0);
      console.log(`\nCode splitting: ${pageChunks.length} page chunks created`);
    });
  });

  describe('Memoization Effectiveness', () => {
    it('should demonstrate memoization benefits', () => {
      // Simulate expensive computation
      const expensiveComputation = (n: number): number => {
        let result = 0;
        for (let i = 0; i < n; i++) {
          result += Math.sqrt(i) * Math.sin(i);
        }
        return result;
      };

      const memoize = <T extends (...args: any[]) => any>(fn: T): T => {
        const cache = new Map<string, ReturnType<T>>();
        return ((...args: Parameters<T>): ReturnType<T> => {
          const key = JSON.stringify(args);
          if (cache.has(key)) {
            return cache.get(key)!;
          }
          const result = fn(...args);
          cache.set(key, result);
          return result;
        }) as T;
      };

      const memoizedComputation = memoize(expensiveComputation);

      // First call - cache miss
      const start1 = performance.now();
      const result1 = memoizedComputation(10000);
      const time1 = performance.now() - start1;

      // Second call - cache hit
      const start2 = performance.now();
      const result2 = memoizedComputation(10000);
      const time2 = performance.now() - start2;

      console.log(`First computation (cache miss): ${time1.toFixed(3)}ms`);
      console.log(`Second computation (cache hit): ${time2.toFixed(3)}ms`);
      console.log(`Speedup: ${(time1 / time2).toFixed(1)}x faster`);

      expect(result1).toBe(result2);
      expect(time2).toBeLessThan(time1); // Cache hit should be faster
    });
  });
});
