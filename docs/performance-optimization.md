# Performance Optimization Guide

This document describes the performance optimization strategies implemented in AlphaArena.

## Overview

The performance optimization system includes:

1. **Lighthouse CI Integration** - Automated performance testing in CI/CD pipeline
2. **Resource Preloading** - Critical resource hints for faster page loads
3. **Lazy Loading** - Deferred loading of non-critical resources
4. **Performance Monitoring** - Real-time Core Web Vitals tracking
5. **Performance Budget** - Automated bundle size monitoring

## Lighthouse CI

### Configuration

Lighthouse CI is configured in `lighthouserc.json`:

```json
{
  "ci": {
    "collect": {
      "url": ["/", "/dashboard", "/strategies", "/trades", "/holdings"],
      "numberOfRuns": 3
    },
    "assert": {
      "assertions": {
        "categories:performance": ["error", {"minScore": 0.8}],
        "first-contentful-paint": ["error", {"maxNumericValue": 2000}],
        "largest-contentful-paint": ["error", {"maxNumericValue": 3000}]
      }
    }
  }
}
```

### Running Lighthouse

```bash
# Run full Lighthouse CI
npm run lighthouse

# Collect metrics only
npm run lighthouse:collect

# Run assertions
npm run lighthouse:assert

# Desktop preset
npm run lighthouse:desktop

# Mobile preset
npm run lighthouse:mobile
```

## Resource Preloading

### Usage

```typescript
import { 
  preloadCSS, 
  preloadScript, 
  preloadFont,
  preconnect,
  prefetchPage 
} from '@/utils/resourcePreload';

// Preload critical CSS
preloadCSS('/styles/critical.css');

// Preload critical scripts
preloadScript('/scripts/analytics.js');

// Preload fonts
preloadFont('/fonts/custom-font.woff2');

// Preconnect to API domains
preconnect('https://api.example.com');

// Prefetch pages for faster navigation
prefetchPage('/dashboard');
```

### React Hook

```typescript
import { usePreloadImage, usePrefetchOnHover } from '@/hooks/useResourcePreload';

// Preload image on mount
const { isLoaded, error } = usePreloadImage('/images/hero.png');

// Prefetch page on hover
const { onMouseEnter, onTouchStart } = usePrefetchOnHover('/dashboard');

// Use in component
<Link to="/dashboard" onMouseEnter={onMouseEnter}>Dashboard</Link>
```

## Lazy Loading

### LazyImage Component

```typescript
import { LazyImage } from '@/components/LazyImage';

// Basic usage
<LazyImage 
  src="/images/photo.jpg"
  alt="Photo"
  width={300}
  height={200}
/>

// With placeholder
<LazyImage 
  src="/images/photo.jpg"
  placeholderSrc="/images/photo-thumb.jpg"
  alt="Photo"
  width={300}
  height={200}
/>

// Progressive loading
import { ProgressiveImage } from '@/components/LazyImage';

<ProgressiveImage 
  lowQualitySrc="/images/photo-low.jpg"
  highQualitySrc="/images/photo-high.jpg"
  alt="Photo"
/>
```

### Code Splitting

Pages are automatically code-split using React.lazy with retry logic:

```typescript
// Already implemented in App.tsx
const DashboardPage = lazyWithRetry(() => import('./pages/DashboardPage'));
```

## Performance Monitoring

### usePerformanceMonitoring Hook

The hook automatically tracks Core Web Vitals:

```typescript
import { usePerformanceMonitoring } from '@/hooks/usePerformanceMonitoring';

// In your component
usePerformanceMonitoring({
  autoReport: true,        // Auto-report metrics
  reportInterval: 30000,   // Report every 30 seconds
  batchEnabled: true,      // Batch metrics
  debug: process.env.NODE_ENV === 'development',
});
```

### Metrics Tracked

- **FCP** - First Contentful Paint
- **LCP** - Largest Contentful Paint
- **FID** - First Input Delay
- **CLS** - Cumulative Layout Shift
- **TTFB** - Time to First Byte
- **INP** - Interaction to Next Paint
- **TTI** - Time to Interactive

### Viewing Metrics

Access the Performance Monitoring Dashboard at `/admin/performance` (requires admin access).

## Performance Budget

### Running Budget Check

```bash
npm run perf:budget
```

### Budget Configuration

Budgets are defined in `.lighthouse/performance-budget.json`:

```json
{
  "budgets": [
    { "resourceType": "script", "budget": "400KB" },
    { "resourceType": "stylesheet", "budget": "100KB" },
    { "resourceType": "image", "budget": "500KB" },
    { "resourceType": "total", "budget": "2MB" }
  ],
  "timings": [
    { "metric": "first-contentful-paint", "budget": "1.5s" },
    { "metric": "largest-contentful-paint", "budget": "2.5s" }
  ]
}
```

## Optimization Strategies

### 1. Bundle Size Optimization

- **Code Splitting**: Pages are lazy-loaded
- **Vendor Splitting**: Large libraries are split into separate chunks
- **Tree Shaking**: Unused code is eliminated during build

### 2. Critical Rendering Path

- **Preload Critical Resources**: Fonts, CSS, and key scripts are preloaded
- **Async Scripts**: Non-critical scripts use async loading
- **CSS Optimization**: Critical CSS is inlined

### 3. Image Optimization

- **Lazy Loading**: Images load only when visible
- **Responsive Images**: Multiple sizes for different viewports
- **Format Selection**: WebP when supported

### 4. Caching Strategy

- **Service Worker**: Caches static assets
- **HTTP Caching**: Proper cache headers
- **CDN**: Static assets served from CDN

## Best Practices

### Do's

✅ Use lazy loading for images and components
✅ Preload critical resources
✅ Monitor Core Web Vitals
✅ Check bundle sizes regularly
✅ Use the performance budget

### Don'ts

❌ Don't import entire libraries when only using a few functions
❌ Don't render large lists without virtualization
❌ Don't ignore performance warnings in CI
❌ Don't skip the performance budget check

## Troubleshooting

### High LCP

1. Check if critical resources are preloaded
2. Verify images are optimized
3. Consider using skeleton loading

### High FID

1. Break up long tasks
2. Use web workers for heavy computation
3. Implement code splitting

### High CLS

1. Set explicit dimensions for images
2. Reserve space for dynamic content
3. Avoid inserting content above existing content

## References

- [Web Vitals](https://web.dev/vitals/)
- [Lighthouse CI](https://github.com/GoogleChrome/lighthouse-ci)
- [React Performance Optimization](https://react.dev/learn/render-and-commit)