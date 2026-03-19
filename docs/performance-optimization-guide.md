# Performance Optimization Guide

This guide explains how to use the performance optimization utilities implemented for Issue #388.

## Overview

The performance optimization includes:

1. **Data Caching** - Reduces API calls with in-memory and localStorage caching
2. **Lazy Loading** - Components load only when they come into view
3. **Data Sampling** - Charts render smoothly with large datasets
4. **Skeleton Loading** - Better perceived performance with placeholder UI
5. **Debounce/Throttle** - Controls rate of updates and API calls

## Quick Start

### 1. Using Data Cache

```typescript
import { dataCache, fetchWithCache } from './utils/cache';

// Simple caching
dataCache.set('user-profile', userData, 60000); // Cache for 1 minute
const cached = dataCache.get('user-profile');

// Fetch with cache (recommended)
const data = await fetchWithCache(
  'strategies-list',
  () => api.getStrategies(),
  30000 // TTL: 30 seconds
);
```

### 2. Using Optimized Hooks

```typescript
import { useOptimizedQuery, usePaginatedData, useInfiniteScroll } from './hooks/useOptimizedData';

// Optimized query with caching
const { data, loading, error, isCached } = useOptimizedQuery(
  () => api.getStrategies(),
  {
    cacheKey: 'strategies',
    cacheTTL: 30000,
    enableCache: true,
  }
);

// Paginated data
const {
  data: strategies,
  page,
  hasMore,
  nextPage,
  prevPage,
} = usePaginatedData({
  pageSize: 20,
  fetcher: (page, pageSize) => api.getStrategiesPaginated(page, pageSize),
  enableCache: true,
});

// Infinite scroll
const { data: trades, loadMore, hasMore } = useInfiniteScroll({
  batchSize: 50,
  fetcher: (offset, limit) => api.getTrades({ offset, limit }),
});
```

### 3. Using Skeleton Loading

```typescript
import { Skeleton, SkeletonCard, SkeletonTable, SkeletonChart } from './components/Skeleton';

// Basic skeleton
<Skeleton width="100%" height={20} />

// Card skeleton
<SkeletonCard showHeader contentLines={4} />

// Table skeleton
<SkeletonTable rows={10} columns={5} />

// Chart skeleton
<SkeletonChart height={300} />

// With loading state
<SkeletonWrapper loading={loading} skeleton={<SkeletonCard />}>
  <ActualContent data={data} />
</SkeletonWrapper>
```

### 4. Using Lazy Loading

```typescript
import { LazyLoadWrapper, withLazyLoad } from './components/LazyLoadWrapper';

// Wrap component
<LazyLoadWrapper minHeight={200} rootMargin="100px">
  <HeavyChart data={chartData} />
</LazyLoadWrapper>

// HOC approach
const LazyChart = withLazyLoad(HeavyChart, { minHeight: 300 });
<LazyChart data={chartData} />
```

### 5. Using Optimized Charts

```typescript
import { OptimizedAreaChart, OptimizedEquityCurveChart } from './components/OptimizedChart';

// Optimized area chart
<OptimizedAreaChart
  data={priceData}
  dataKey="price"
  xAxisKey="date"
  height={300}
  enableSampling={true} // Automatically samples large datasets
  maxPoints={500} // Max points to render
/>

// Equity curve with auto-sampling
<OptimizedEquityCurveChart
  data={equityData}
  height={300}
  maxPoints={500}
/>
```

### 6. Using Debounce and Throttle

```typescript
import { useDebounce, useDebouncedCallback, useThrottle } from './utils/performance';

// Debounce search input
const [searchTerm, setSearchTerm] = useState('');
const debouncedSearch = useDebounce(searchTerm, 300);

useEffect(() => {
  if (debouncedSearch) {
    performSearch(debouncedSearch);
  }
}, [debouncedSearch]);

// Debounced callback
const debouncedSave = useDebouncedCallback((data) => {
  saveToServer(data);
}, 500);

// Throttle updates
const throttledValue = useThrottle(realtimeValue, 1000);
```

## Migration Examples

### Before: Regular fetch in component

```typescript
function StrategiesPage() {
  const [strategies, setStrategies] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getStrategies()
      .then(data => {
        setStrategies(data);
        setLoading(false);
      });
  }, []);

  if (loading) return <Spin />;

  return <StrategyList data={strategies} />;
}
```

### After: Optimized with cache and skeleton

```typescript
import { useOptimizedQuery } from './hooks/useOptimizedData';
import { SkeletonTable } from './components/Skeleton';

function StrategiesPage() {
  const { data: strategies, loading, isCached } = useOptimizedQuery(
    () => api.getStrategies(),
    {
      cacheKey: 'strategies',
      cacheTTL: 30000,
    }
  );

  if (loading && !isCached) return <SkeletonTable rows={10} columns={5} />;

  return <StrategyList data={strategies || []} />;
}
```

### Before: Heavy chart with large data

```typescript
function EquityChart({ data }) {
  return (
    <ResponsiveContainer height={300}>
      <AreaChart data={data}>
        {/* Chart config */}
      </AreaChart>
    </ResponsiveContainer>
  );
}
```

### After: Optimized chart with sampling

```typescript
import { OptimizedEquityCurveChart } from './components/OptimizedChart';

function EquityChart({ data }) {
  return (
    <OptimizedEquityCurveChart
      data={data}
      height={300}
      maxPoints={500}
      enableSampling={true}
    />
  );
}
```

## Performance Metrics

The `usePerformanceMonitor` hook helps track performance:

```typescript
import { usePerformanceMetrics, usePerformanceTracking } from './hooks/usePerformanceMonitor';

function MyComponent() {
  // Track component render performance
  usePerformanceTracking('MyComponent');

  // Get overall metrics
  const { metrics, recordApiCall } = usePerformanceMetrics();

  useEffect(() => {
    fetchData().then(() => {
      recordApiCall();
    });
  }, []);

  return (
    <div>
      {/* Your component */}
      {process.env.NODE_ENV === 'development' && (
        <div className="perf-debug">
          <p>API Calls: {metrics.apiCalls}</p>
          <p>Memory: {(metrics.memoryUsage * 100).toFixed(1)}%</p>
          <p>FCP: {metrics.firstContentfulPaint?.toFixed(0)}ms</p>
        </div>
      )}
    </div>
  );
}
```

## Cache Statistics

Check cache performance:

```typescript
import { dataCache } from './utils/cache';

const stats = dataCache.getStats();
console.log('Cache hit rate:', stats.hitRate);
console.log('Cache hits:', stats.hits);
console.log('Cache misses:', stats.misses);
console.log('Cache size:', stats.size);
```

## Best Practices

1. **Cache Strategy**
   - Use short TTL (30s-60s) for frequently changing data
   - Use longer TTL (5-10min) for relatively stable data
   - Clear cache when user logs out or data is mutated

2. **Lazy Loading**
   - Use for components below the fold
   - Set appropriate `minHeight` to prevent layout shift
   - Use `rootMargin` to preload components just before they become visible

3. **Charts**
   - Enable sampling for datasets > 500 points
   - Use `isAnimationActive={false}` for large datasets
   - Consider virtualization for interactive charts

4. **Debounce/Throttle**
   - Debounce user input (search, filters)
   - Throttle real-time updates (prices, metrics)
   - Use appropriate delay (300ms for input, 1000ms for updates)

## Performance Targets (Issue #388)

- ✅ First Contentful Paint < 2s
- ✅ Smooth scrolling with large datasets
- ✅ User interactions respond < 100ms
- ✅ Cache hit rate > 80%

## Testing

Run performance tests:

```bash
npm test -- --testPathPattern="performance|cache"
```

## Debugging

Enable debug logging:

```typescript
localStorage.setItem('DEBUG_CACHE', 'true');
localStorage.setItem('DEBUG_PERFORMANCE', 'true');
```