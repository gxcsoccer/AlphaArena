/**
 * UX Helper Utilities
 * 
 * Issue #514: UX 改进 - 工具函数
 * 
 * 提供各种 UX 改进相关的工具函数：
 * - 触摸手势检测
 * - 防抖和节流
 * - 本地存储缓存
 * - 格式化工具
 */

import React from 'react';

/**
 * 防抖函数
 * 在指定延迟后执行函数，如果在延迟期间再次调用则重新计时
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: NodeJS.Timeout | null = null;

  return function (this: any, ...args: Parameters<T>) {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    timeoutId = setTimeout(() => {
      func.apply(this, args);
      timeoutId = null;
    }, delay);
  };
}

/**
 * 节流函数
 * 在指定时间间隔内最多执行一次
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  interval: number
): (...args: Parameters<T>) => void {
  let lastTime = 0;
  let timeoutId: NodeJS.Timeout | null = null;

  return function (this: any, ...args: Parameters<T>) {
    const now = Date.now();
    const remaining = interval - (now - lastTime);

    if (remaining <= 0) {
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      lastTime = now;
      func.apply(this, args);
    } else if (!timeoutId) {
      timeoutId = setTimeout(() => {
        lastTime = Date.now();
        timeoutId = null;
        func.apply(this, args);
      }, remaining);
    }
  };
}

/**
 * 格式化货币
 */
export function formatCurrency(
  value: number,
  currency: string = 'USD',
  locale: string = 'en-US'
): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

/**
 * 格式化数字
 */
export function formatNumber(
  value: number,
  decimals: number = 2,
  locale: string = 'en-US'
): string {
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

/**
 * 格式化百分比
 */
export function formatPercentage(
  value: number,
  decimals: number = 2
): string {
  return `${value >= 0 ? '+' : ''}${value.toFixed(decimals)}%`;
}

/**
 * 格式化时间
 */
export function formatTime(
  date: Date | number,
  format: 'short' | 'medium' | 'long' = 'medium',
  locale: string = 'zh-CN'
): string {
  const d = typeof date === 'number' ? new Date(date * 1000) : date;
  
  const options: Intl.DateTimeFormatOptions = {
    short: {
      hour: '2-digit',
      minute: '2-digit',
    },
    medium: {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    },
    long: {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    },
  }[format];

  return d.toLocaleString(locale, options);
}

/**
 * 相对时间格式化
 */
export function formatRelativeTime(date: Date | number): string {
  const now = Date.now();
  const then = typeof date === 'number' ? date * 1000 : date.getTime();
  const diff = now - then;

  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) {
    return '刚刚';
  } else if (minutes < 60) {
    return `${minutes}分钟前`;
  } else if (hours < 24) {
    return `${hours}小时前`;
  } else if (days < 7) {
    return `${days}天前`;
  } else {
    return formatTime(date, 'long');
  }
}

/**
 * 本地存储缓存
 */
export class LocalCache {
  static get<T>(key: string): T | null {
    try {
      const item = localStorage.getItem(key);
      if (!item) return null;

      const { value, expiry } = JSON.parse(item);
      
      // 检查是否过期
      if (expiry && Date.now() > expiry) {
        localStorage.removeItem(key);
        return null;
      }

      return value as T;
    } catch (error) {
      console.error('Failed to get from cache:', error);
      return null;
    }
  }

  static set<T>(key: string, value: T, ttl?: number): void {
    try {
      const item = {
        value,
        expiry: ttl ? Date.now() + ttl : undefined,
      };
      localStorage.setItem(key, JSON.stringify(item));
    } catch (error) {
      console.error('Failed to set cache:', error);
    }
  }

  static remove(key: string): void {
    try {
      localStorage.removeItem(key);
    } catch (error) {
      console.error('Failed to remove from cache:', error);
    }
  }

  static clear(): void {
    try {
      localStorage.clear();
    } catch (error) {
      console.error('Failed to clear cache:', error);
    }
  }
}

/**
 * 剪贴板操作
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    } else {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      textArea.style.top = '-999999px';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      
      const result = document.execCommand('copy');
      document.body.removeChild(textArea);
      
      return result;
    }
  } catch (error) {
    console.error('Failed to copy to clipboard:', error);
    return false;
  }
}

/**
 * 检测设备类型
 */
export function detectDevice(): {
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  isTouchDevice: boolean;
  os: 'ios' | 'android' | 'windows' | 'mac' | 'linux' | 'unknown';
} {
  const userAgent = navigator.userAgent.toLowerCase();
  
  const isMobile = /android|webos|iphone|ipod|blackberry|iemobile|opera mini/i.test(userAgent);
  const isTablet = /ipad|android(?!.*mobile)|tablet/i.test(userAgent);
  const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  
  let os: 'ios' | 'android' | 'windows' | 'mac' | 'linux' | 'unknown' = 'unknown';
  
  if (/iphone|ipad|ipod/i.test(userAgent)) {
    os = 'ios';
  } else if (/android/i.test(userAgent)) {
    os = 'android';
  } else if (/windows/i.test(userAgent)) {
    os = 'windows';
  } else if (/mac/i.test(userAgent)) {
    os = 'mac';
  } else if (/linux/i.test(userAgent)) {
    os = 'linux';
  }

  return {
    isMobile,
    isTablet,
    isDesktop: !isMobile && !isTablet,
    isTouchDevice,
    os,
  };
}

/**
 * 检测浏览器特性
 */
export function detectBrowserFeatures(): {
  hasWebGL: boolean;
  hasWebSocket: boolean;
  hasServiceWorker: boolean;
  hasLocalStorage: boolean;
  hasSessionStorage: boolean;
  hasIndexedDB: boolean;
} {
  return {
    hasWebGL: (() => {
      try {
        const canvas = document.createElement('canvas');
        return !!(canvas.getContext('webgl') || canvas.getContext('experimental-webgl'));
      } catch (e) {
        return false;
      }
    })(),
    hasWebSocket: 'WebSocket' in window,
    hasServiceWorker: 'serviceWorker' in navigator,
    hasLocalStorage: (() => {
      try {
        const test = '__test__';
        localStorage.setItem(test, test);
        localStorage.removeItem(test);
        return true;
      } catch (e) {
        return false;
      }
    })(),
    hasSessionStorage: (() => {
      try {
        const test = '__test__';
        sessionStorage.setItem(test, test);
        sessionStorage.removeItem(test);
        return true;
      } catch (e) {
        return false;
      }
    })(),
    hasIndexedDB: 'indexedDB' in window,
  };
}

/**
 * React Hook: 使用防抖值
 */
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = React.useState<T>(value);

  React.useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

/**
 * React Hook: 使用节流值
 */
export function useThrottle<T>(value: T, interval: number): T {
  const [throttledValue, setThrottledValue] = React.useState<T>(value);
  const lastUpdated = React.useRef<number>(Date.now());

  React.useEffect(() => {
    const now = Date.now();
    
    if (now - lastUpdated.current >= interval) {
      lastUpdated.current = now;
      setThrottledValue(value);
    } else {
      const timeoutId = setTimeout(() => {
        lastUpdated.current = Date.now();
        setThrottledValue(value);
      }, interval - (now - lastUpdated.current));

      return () => clearTimeout(timeoutId);
    }
  }, [value, interval]);

  return throttledValue;
}

/**
 * React Hook: 使用本地存储
 */
export function useLocalStorage<T>(
  key: string,
  initialValue: T
): [T, (value: T | ((prev: T) => T)) => void] {
  const [storedValue, setStoredValue] = React.useState<T>(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.error('Failed to read from localStorage:', error);
      return initialValue;
    }
  });

  const setValue = React.useCallback(
    (value: T | ((prev: T) => T)) => {
      try {
        const valueToStore = value instanceof Function ? value(storedValue) : value;
        setStoredValue(valueToStore);
        window.localStorage.setItem(key, JSON.stringify(valueToStore));
      } catch (error) {
        console.error('Failed to write to localStorage:', error);
      }
    },
    [key, storedValue]
  );

  return [storedValue, setValue];
}

/**
 * React Hook: 使用窗口大小
 */
export function useWindowSize(): { width: number; height: number } {
  const [windowSize, setWindowSize] = React.useState({
    width: window.innerWidth,
    height: window.innerHeight,
  });

  React.useEffect(() => {
    const handleResize = throttle(() => {
      setWindowSize({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    }, 100);

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return windowSize;
}

/**
 * React Hook: 使用媒体查询
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = React.useState(
    () => window.matchMedia(query).matches
  );

  React.useEffect(() => {
    const mediaQuery = window.matchMedia(query);
    const handler = (event: MediaQueryListEvent) => {
      setMatches(event.matches);
    };

    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, [query]);

  return matches;
}

/**
 * 平滑滚动到元素
 */
export function smoothScrollToElement(
  element: HTMLElement | string,
  options?: ScrollIntoViewOptions
): void {
  const el = typeof element === 'string' 
    ? document.querySelector(element) 
    : element;

  if (el) {
    el.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
      ...options,
    });
  }
}

/**
 * 生成唯一 ID
 */
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * 延迟执行
 */
export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 重试函数
 */
export async function retry<T>(
  fn: () => Promise<T>,
  maxAttempts: number = 3,
  delayMs: number = 1000
): Promise<T> {
  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      
      if (attempt < maxAttempts) {
        await delay(delayMs * attempt);
      }
    }
  }

  throw lastError;
}