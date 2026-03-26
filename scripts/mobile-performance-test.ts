/**
 * Mobile Performance Test Script
 * 
 * Issue #631: Run Lighthouse tests for mobile performance metrics
 * Usage: npm run test:performance:mobile
 */

import lighthouse from 'lighthouse';
import * as chromeLauncher from 'chrome-launcher';
import * as fs from 'fs';
import * as path from 'path';

interface PerformanceMetrics {
  // Core Web Vitals
  firstContentfulPaint: number;
  largestContentfulPaint: number;
  cumulativeLayoutShift: number;
  firstInputDelay: number;
  totalBlockingTime: number;
  speedIndex: number;
  
  // Performance Score
  performanceScore: number;
  
  // Resource Metrics
  totalBytes: number;
  javascriptBytes: number;
  cssBytes: number;
  imageBytes: number;
  
  // Bundle Sizes
  mainBundleSize: number;
  vendorBundleSize: number;
  totalBundleSize: number;
}

interface TestResult {
  url: string;
  timestamp: string;
  metrics: PerformanceMetrics;
  passed: boolean;
  failures: string[];
}

const ACCEPTANCE_CRITERIA = {
  firstContentfulPaint: 3000, // < 3s (target: < 1.8s)
  largestContentfulPaint: 4000, // < 4s (target: < 2.5s)
  cumulativeLayoutShift: 0.25, // < 0.25 (target: < 0.1)
  totalBlockingTime: 300, // < 300ms (target: < 200ms)
  speedIndex: 5000, // < 5s (target: < 3.4s)
  performanceScore: 0.7, // > 70 (target: > 90)
  totalBundleSize: 500 * 1024, // < 500KB gzipped
};

const PAGES_TO_TEST = [
  { url: 'http://localhost:3000', name: 'Landing Page' },
  { url: 'http://localhost:3000/dashboard', name: 'Dashboard', requiresAuth: true },
  { url: 'http://localhost:3000/strategies', name: 'Strategies', requiresAuth: true },
  { url: 'http://localhost:3000/holdings', name: 'Holdings', requiresAuth: true },
];

async function runLighthouse(
  url: string,
  chrome: chromeLauncher.LaunchedChrome
): Promise<lighthouse.Result> {
  const options = {
    logLevel: 'info' as const,
    output: 'json' as const,
    onlyCategories: ['performance'],
    port: chrome.port,
    formFactor: 'mobile' as const,
    screenEmulation: {
      mobile: true,
      width: 375,
      height: 667,
      deviceScaleFactor: 2,
      disabled: false,
    },
    throttling: {
      rttMs: 150,
      throughputKbps: 1638,
      cpuSlowdownMultiplier: 4,
      requestLatencyMs: 562.5,
      downloadThroughputKbps: 1474.5,
      uploadThroughputKbps: 675,
    },
  };

  const runnerResult = await lighthouse(url, options);
  
  if (!runnerResult) {
    throw new Error(`Lighthouse failed to run for ${url}`);
  }

  return runnerResult.lhr;
}

function extractMetrics(lhr: lighthouse.Result): PerformanceMetrics {
  const audits = lhr.audits;
  
  // Core Web Vitals
  const fcp = audits['first-contentful-paint'];
  const lcp = audits['largest-contentful-paint'];
  const cls = audits['cumulative-layout-shift'];
  const tbt = audits['total-blocking-time'];
  const si = audits['speed-index'];
  
  // Resource metrics
  const resourceSummary = audits['resource-summary'];
  const bootupTime = audits['bootup-time'];
  
  // Get bundle sizes from network requests
  let totalBytes = 0;
  let javascriptBytes = 0;
  let cssBytes = 0;
  let imageBytes = 0;
  
  if (lhr.audits['network-requests']) {
    const requests = lhr.audits['network-requests'].details?.items || [];
    requests.forEach((req: any) => {
      const size = req.resourceSize || 0;
      totalBytes += size;
      
      if (req.resourceType === 'Script') {
        javascriptBytes += size;
      } else if (req.resourceType === 'Stylesheet') {
        cssBytes += size;
      } else if (req.resourceType === 'Image') {
        imageBytes += size;
      }
    });
  }

  return {
    firstContentfulPaint: fcp?.numericValue || 0,
    largestContentfulPaint: lcp?.numericValue || 0,
    cumulativeLayoutShift: cls?.numericValue || 0,
    firstInputDelay: 0, // FID requires real user interaction
    totalBlockingTime: tbt?.numericValue || 0,
    speedIndex: si?.numericValue || 0,
    performanceScore: lhr.categories.performance?.score || 0,
    totalBytes,
    javascriptBytes,
    cssBytes,
    imageBytes,
    mainBundleSize: javascriptBytes * 0.4, // Estimate
    vendorBundleSize: javascriptBytes * 0.5, // Estimate
    totalBundleSize: javascriptBytes,
  };
}

function checkAcceptanceCriteria(metrics: PerformanceMetrics): { passed: boolean; failures: string[] } {
  const failures: string[] = [];

  if (metrics.firstContentfulPaint > ACCEPTANCE_CRITERIA.firstContentfulPaint) {
    failures.push(`FCP ${metrics.firstContentfulPaint}ms > ${ACCEPTANCE_CRITERIA.firstContentfulPaint}ms`);
  }

  if (metrics.largestContentfulPaint > ACCEPTANCE_CRITERIA.largestContentfulPaint) {
    failures.push(`LCP ${metrics.largestContentfulPaint}ms > ${ACCEPTANCE_CRITERIA.largestContentfulPaint}ms`);
  }

  if (metrics.cumulativeLayoutShift > ACCEPTANCE_CRITERIA.cumulativeLayoutShift) {
    failures.push(`CLS ${metrics.cumulativeLayoutShift} > ${ACCEPTANCE_CRITERIA.cumulativeLayoutShift}`);
  }

  if (metrics.totalBlockingTime > ACCEPTANCE_CRITERIA.totalBlockingTime) {
    failures.push(`TBT ${metrics.totalBlockingTime}ms > ${ACCEPTANCE_CRITERIA.totalBlockingTime}ms`);
  }

  if (metrics.speedIndex > ACCEPTANCE_CRITERIA.speedIndex) {
    failures.push(`Speed Index ${metrics.speedIndex}ms > ${ACCEPTANCE_CRITERIA.speedIndex}ms`);
  }

  if (metrics.performanceScore < ACCEPTANCE_CRITERIA.performanceScore) {
    failures.push(`Performance Score ${(metrics.performanceScore * 100).toFixed(0)} < ${(ACCEPTANCE_CRITERIA.performanceScore * 100).toFixed(0)}`);
  }

  return {
    passed: failures.length === 0,
    failures,
  };
}

function formatReport(results: TestResult[]): string {
  let report = '# Mobile Performance Report\n\n';
  report += `Generated: ${new Date().toISOString()}\n\n`;
  
  // Summary
  const passed = results.filter(r => r.passed).length;
  report += `## Summary\n\n`;
  report += `- **Passed**: ${passed}/${results.length} pages\n`;
  report += `- **Failed**: ${results.length - passed}/${results.length} pages\n\n`;

  // Detailed results
  report += `## Detailed Results\n\n`;
  
  results.forEach(result => {
    const icon = result.passed ? '✅' : '❌';
    report += `### ${icon} ${result.url}\n\n`;
    report += `**Performance Score**: ${(result.metrics.performanceScore * 100).toFixed(0)}\n\n`;
    
    report += `| Metric | Value | Target | Status |\n`;
    report += `|--------|-------|--------|--------|\n`;
    report += `| FCP | ${result.metrics.firstContentfulPaint.toFixed(0)}ms | <${ACCEPTANCE_CRITERIA.firstContentfulPaint}ms | ${result.metrics.firstContentfulPaint <= ACCEPTANCE_CRITERIA.firstContentfulPaint ? '✅' : '❌'} |\n`;
    report += `| LCP | ${result.metrics.largestContentfulPaint.toFixed(0)}ms | <${ACCEPTANCE_CRITERIA.largestContentfulPaint}ms | ${result.metrics.largestContentfulPaint <= ACCEPTANCE_CRITERIA.largestContentfulPaint ? '✅' : '❌'} |\n`;
    report += `| CLS | ${result.metrics.cumulativeLayoutShift.toFixed(3)} | <${ACCEPTANCE_CRITERIA.cumulativeLayoutShift} | ${result.metrics.cumulativeLayoutShift <= ACCEPTANCE_CRITERIA.cumulativeLayoutShift ? '✅' : '❌'} |\n`;
    report += `| TBT | ${result.metrics.totalBlockingTime.toFixed(0)}ms | <${ACCEPTANCE_CRITERIA.totalBlockingTime}ms | ${result.metrics.totalBlockingTime <= ACCEPTANCE_CRITERIA.totalBlockingTime ? '✅' : '❌'} |\n`;
    report += `| Speed Index | ${result.metrics.speedIndex.toFixed(0)}ms | <${ACCEPTANCE_CRITERIA.speedIndex}ms | ${result.metrics.speedIndex <= ACCEPTANCE_CRITERIA.speedIndex ? '✅' : '❌'} |\n`;
    report += `| Bundle Size | ${(result.metrics.totalBundleSize / 1024).toFixed(0)}KB | <${ACCEPTANCE_CRITERIA.totalBundleSize / 1024}KB | ${result.metrics.totalBundleSize <= ACCEPTANCE_CRITERIA.totalBundleSize ? '✅' : '❌'} |\n`;
    
    report += `\n`;

    if (result.failures.length > 0) {
      report += `**Failures**:\n`;
      result.failures.forEach(failure => {
        report += `- ${failure}\n`;
      });
      report += `\n`;
    }
  });

  return report;
}

async function main() {
  console.log('🚀 Starting mobile performance tests...\n');

  let chrome: chromeLauncher.LaunchedChrome | undefined;
  const results: TestResult[] = [];

  try {
    // Launch Chrome
    chrome = await chromeLauncher.launch({
      chromeFlags: ['--headless', '--no-sandbox', '--disable-gpu'],
    });

    // Test each page
    for (const page of PAGES_TO_TEST) {
      console.log(`📊 Testing ${page.name} (${page.url})...`);

      try {
        const lhr = await runLighthouse(page.url, chrome);
        const metrics = extractMetrics(lhr);
        const { passed, failures } = checkAcceptanceCriteria(metrics);

        results.push({
          url: page.url,
          timestamp: new Date().toISOString(),
          metrics,
          passed,
          failures,
        });

        const status = passed ? '✅ PASSED' : '❌ FAILED';
        console.log(`   ${status} - Score: ${(metrics.performanceScore * 100).toFixed(0)}\n`);
      } catch (error) {
        console.error(`   ❌ ERROR: ${error}\n`);
        results.push({
          url: page.url,
          timestamp: new Date().toISOString(),
          metrics: {} as PerformanceMetrics,
          passed: false,
          failures: [`Test failed: ${error}`],
        });
      }
    }

    // Generate report
    const report = formatReport(results);
    const reportPath = path.join(__dirname, '../../reports/mobile-performance-report.md');
    
    // Ensure reports directory exists
    const reportsDir = path.dirname(reportPath);
    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir, { recursive: true });
    }
    
    fs.writeFileSync(reportPath, report);
    console.log(`\n📄 Report saved to: ${reportPath}`);

    // Exit with error code if any test failed
    const allPassed = results.every(r => r.passed);
    process.exit(allPassed ? 0 : 1);

  } catch (error) {
    console.error('❌ Test runner failed:', error);
    process.exit(1);
  } finally {
    if (chrome) {
      await chrome.kill();
    }
  }
}

main();