/**
 * Optimized Data Fetching Hooks
 * Provides hooks with caching, pagination, and lazy loading support
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { dataCache } from '../utils/cache';
import { useDebounce } from '../utils/performance';

interface UseOptimizedQueryOptions<T> {
  /** Cache key */
  cacheKey: string;
  /** Cache TTL in milliseconds */
  cacheTTL?: number;
  /** Enable caching */
  enableCache?: boolean;
  /** Auto fetch on mount */
  autoFetch?: boolean;
  /** Debounce delay for search/filter changes */
  debounceDelay?: number;
  /** Dependencies that trigger refetch */
  deps?: any[];
  /** Transform data before storing */
  transform?: (data: T) => T;
  /** On success callback */
  onSuccess?: (data: T) => void;
  /** On error callback */
  onError?: (error: Error) => void;
}

interface QueryResult<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  isCached: boolean;
}

/**
 * Optimized query hook with caching
 */
export function useOptimizedQuery<T>(
  fetcher: () => Promise<T>,
  options: UseOptimizedQueryOptions<T>
): QueryResult<T> {
  const {
    cacheKey,
    cacheTTL = 30000,
    enableCache = true,
    autoFetch = true,
    deps = [],
    transform,
    onSuccess,
    onError,
  } = options;

  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isCached, setIsCached] = useState(false);
  const isMountedRef = useRef(true);

  const fetchData = useCallback(async () => {
    if (enableCache) {
      const cached = dataCache.get<T>(cacheKey);
      if (cached !== null) {
        const result = transform ? transform(cached) : cached;
        setData(result);
        setIsCached(true);
        setLoading(false);
        return;
      }
    }

    setLoading(true);
    setError(null);
    setIsCached(false);

    try {
      const result = await fetcher();
      const transformed = transform ? transform(result) : result;

      if (isMountedRef.current) {
        setData(transformed);
        setLoading(false);

        if (enableCache) {
          dataCache.set(cacheKey, transformed, cacheTTL);
        }

        onSuccess?.(transformed);
      }
    } catch (err: any) {
      if (isMountedRef.current) {
        setError(err.message);
        setLoading(false);
        onError?.(err);
      }
    }
  }, [cacheKey, cacheTTL, enableCache, fetcher, transform, onSuccess, onError]);

  useEffect(() => {
    isMountedRef.current = true;

    if (autoFetch) {
      fetchData();
    }

    return () => {
      isMountedRef.current = false;
    };
  }, [...deps, autoFetch, fetchData]);

  return {
    data,
    loading,
    error,
    refetch: fetchData,
    isCached,
  };
}

interface UsePaginatedDataOptions<T> {
  /** Items per page */
  pageSize?: number;
  /** Fetch function */
  fetcher: (page: number, pageSize: number) => Promise<{ data: T[]; total: number }>;
  /** Enable caching */
  enableCache?: boolean;
  /** Cache key prefix */
  cacheKeyPrefix?: string;
}

interface PaginatedResult<T> {
  data: T[];
  loading: boolean;
  error: string | null;
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasMore: boolean;
  nextPage: () => void;
  prevPage: () => void;
  goToPage: (page: number) => void;
  refresh: () => void;
}

/**
 * Paginated data hook with infinite scroll support
 */
export function usePaginatedData<T>(
  options: UsePaginatedDataOptions<T>
): PaginatedResult<T> {
  const { pageSize = 20, fetcher, enableCache = true, cacheKeyPrefix } = options;

  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const isMountedRef = useRef(true);

  const totalPages = Math.ceil(total / pageSize);
  const hasMore = page < totalPages;

  const fetchData = useCallback(
    async (pageNum: number) => {
      setLoading(true);
      setError(null);

      try {
        const cacheKey = cacheKeyPrefix
          ? `${cacheKeyPrefix}:page:${pageNum}:${pageSize}`
          : undefined;

        if (enableCache && cacheKey) {
          const cached = dataCache.get<{ data: T[]; total: number }>(cacheKey);
          if (cached) {
            setData(cached.data);
            setTotal(cached.total);
            setLoading(false);
            return;
          }
        }

        const result = await fetcher(pageNum, pageSize);

        if (isMountedRef.current) {
          setData(result.data);
          setTotal(result.total);
          setLoading(false);

          if (enableCache && cacheKey) {
            dataCache.set(cacheKey, result, 60000); // 1 minute cache for paginated data
          }
        }
      } catch (err: any) {
        if (isMountedRef.current) {
          setError(err.message);
          setLoading(false);
        }
      }
    },
    [fetcher, pageSize, enableCache, cacheKeyPrefix]
  );

  useEffect(() => {
    isMountedRef.current = true;
    fetchData(page);

    return () => {
      isMountedRef.current = false;
    };
  }, [page, fetchData]);

  const nextPage = useCallback(() => {
    if (hasMore) {
      setPage((p) => p + 1);
    }
  }, [hasMore]);

  const prevPage = useCallback(() => {
    if (page > 1) {
      setPage((p) => p - 1);
    }
  }, [page]);

  const goToPage = useCallback(
    (pageNum: number) => {
      if (pageNum >= 1 && pageNum <= totalPages) {
        setPage(pageNum);
      }
    },
    [totalPages]
  );

  const refresh = useCallback(() => {
    fetchData(page);
  }, [fetchData, page]);

  return {
    data,
    loading,
    error,
    page,
    pageSize,
    total,
    totalPages,
    hasMore,
    nextPage,
    prevPage,
    goToPage,
    refresh,
  };
}

interface UseInfiniteScrollOptions<T> {
  /** Batch size */
  batchSize?: number;
  /** Fetch function */
  fetcher: (offset: number, limit: number) => Promise<T[]>;
  /** Has more check */
  hasMoreCheck?: (currentData: T[], newBatch: T[]) => boolean;
}

interface InfiniteScrollResult<T> {
  data: T[];
  loading: boolean;
  error: string | null;
  hasMore: boolean;
  loadMore: () => Promise<void>;
  reset: () => void;
}

/**
 * Infinite scroll hook for lazy loading
 */
export function useInfiniteScroll<T>(
  options: UseInfiniteScrollOptions<T>
): InfiniteScrollResult<T> {
  const { batchSize = 20, fetcher, hasMoreCheck } = options;

  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const offsetRef = useRef(0);
  const isMountedRef = useRef(true);

  const loadMore = useCallback(async () => {
    if (loading || !hasMore) return;

    setLoading(true);
    setError(null);

    try {
      const batch = await fetcher(offsetRef.current, batchSize);

      if (isMountedRef.current) {
        setData((prev) => [...prev, ...batch]);

        const hasMoreData = hasMoreCheck
          ? hasMoreCheck(data, batch)
          : batch.length === batchSize;

        setHasMore(hasMoreData);
        offsetRef.current += batchSize;
        setLoading(false);
      }
    } catch (err: any) {
      if (isMountedRef.current) {
        setError(err.message);
        setLoading(false);
      }
    }
  }, [fetcher, batchSize, loading, hasMore, hasMoreCheck, data]);

  const reset = useCallback(() => {
    setData([]);
    offsetRef.current = 0;
    setHasMore(true);
    setError(null);
    setLoading(false);
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  return {
    data,
    loading,
    error,
    hasMore,
    loadMore,
    reset,
  };
}

interface UseSearchOptions<T, F> {
  /** Search function */
  searcher: (query: string, filters?: F) => Promise<T[]>;
  /** Debounce delay */
  debounceDelay?: number;
  /** Min query length */
  minQueryLength?: number;
  /** Initial data */
  initialData?: T[];
}

interface SearchResult<T, F> {
  data: T[];
  loading: boolean;
  error: string | null;
  query: string;
  setQuery: (q: string) => void;
  filters: F | undefined;
  setFilters: (f: F) => void;
  search: (q: string, f?: F) => Promise<void>;
}

/**
 * Optimized search hook with debouncing
 */
export function useSearch<T, F = undefined>(
  options: UseSearchOptions<T, F>
): SearchResult<T, F> {
  const { searcher, debounceDelay = 300, minQueryLength = 2, initialData = [] } = options;

  const [data, setData] = useState<T[]>(initialData);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState<F | undefined>(undefined);
  const isMountedRef = useRef(true);

  const debouncedQuery = useDebounce(query, debounceDelay);

  const search = useCallback(
    async (q: string, f?: F) => {
      if (q.length < minQueryLength) {
        setData(initialData);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const results = await searcher(q, f);
        if (isMountedRef.current) {
          setData(results);
          setLoading(false);
        }
      } catch (err: any) {
        if (isMountedRef.current) {
          setError(err.message);
          setLoading(false);
        }
      }
    },
    [searcher, minQueryLength, initialData]
  );

  useEffect(() => {
    isMountedRef.current = true;

    if (debouncedQuery.length >= minQueryLength) {
      search(debouncedQuery, filters);
    }

    return () => {
      isMountedRef.current = false;
    };
  }, [debouncedQuery, filters, search, minQueryLength]);

  const handleSetQuery = useCallback((q: string) => {
    setQuery(q);
  }, []);

  const handleSetFilters = useCallback((f: F) => {
    setFilters(f);
  }, []);

  return {
    data,
    loading,
    error,
    query,
    setQuery: handleSetQuery,
    filters,
    setFilters: handleSetFilters,
    search,
  };
}

/**
 * Prefetch data hook
 * Used to prefetch data for better navigation performance
 */
export function usePrefetch() {
  return useCallback(
    async <T>(key: string, fetcher: () => Promise<T>, ttl: number = 30000) => {
      try {
        const data = await fetcher();
        dataCache.set(key, data, ttl);
      } catch (error) {
        console.error(`Prefetch failed for ${key}:`, error);
      }
    },
    []
  );
}