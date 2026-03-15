/**
 * useErrorReporter - Global Error Reporting Hook
 * 
 * Captures JavaScript errors and unhandled promise rejections
 * and sends them to the backend for logging.
 */

import { useEffect, useCallback, useState } from 'react';

export interface CapturedError {
  id: string;
  message: string;
  source?: string;
  lineno?: number;
  colno?: number;
  stack?: string;
  type: 'error' | 'unhandledrejection';
  timestamp: number;
  url: string;
  userAgent: string;
}

export interface UseErrorReporterOptions {
  /** Enable localStorage fallback if backend is unavailable */
  enableLocalStorage?: boolean;
  /** Max errors to store in localStorage (default: 50) */
  maxLocalStorageErrors?: number;
  /** Backend endpoint for error logging (default: /api/log-error) */
  endpoint?: string;
  /** Enable debug mode to log errors to console */
  debug?: boolean;
}

const DEFAULT_OPTIONS: Required<UseErrorReporterOptions> = {
  enableLocalStorage: true,
  maxLocalStorageErrors: 50,
  endpoint: '/api/log-error',
  debug: false,
};

const STORAGE_KEY = 'alphaarena_captured_errors';

/**
 * Generate a unique ID for each error
 */
function generateErrorId(): string {
  return `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Get errors from localStorage
 */
function getStoredErrors(): CapturedError[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

/**
 * Save errors to localStorage with size limit
 */
function saveToLocalStorage(errors: CapturedError[], maxErrors: number): void {
  try {
    const limited = errors.slice(-maxErrors);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(limited));
  } catch (error) {
    console.warn('[ErrorReporter] Failed to save errors to localStorage:', error);
  }
}

/**
 * Send error to backend logging endpoint
 */
async function sendErrorToBackend(error: CapturedError, endpoint: string): Promise<void> {
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ error }),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const result = await response.json();
    return result;
  } catch (error) {
    console.warn('[ErrorReporter] Failed to send error to backend:', error);
    throw error;
  }
}

/**
 * Extract stack trace from error event
 */
function extractStack(error: ErrorEvent | PromiseRejectionEvent): string | undefined {
  if ('error' in error && error.error instanceof Error) {
    return error.error.stack;
  }
  
  if ('reason' in error) {
    if (error.reason instanceof Error) {
      return error.reason.stack;
    }
    return String(error.reason);
  }
  
  return undefined;
}

/**
 * useErrorReporter Hook
 * 
 * Sets up global error listeners and captures errors for debugging.
 * Should be called once at the app root level.
 */
export function useErrorReporter(options: UseErrorReporterOptions = {}): {
  errors: CapturedError[];
  clearErrors: () => void;
  hasErrors: boolean;
} {
  const config = { ...DEFAULT_OPTIONS, ...options };
  const [errors, setErrors] = useState<CapturedError[]>([]);

  // Load errors from localStorage on mount
  useEffect(() => {
    if (config.enableLocalStorage) {
      const stored = getStoredErrors();
      setErrors(stored);
    }
  }, [config.enableLocalStorage]);

  const handleError = useCallback((event: ErrorEvent) => {
    const capturedError: CapturedError = {
      id: generateErrorId(),
      message: event.message,
      source: event.filename,
      lineno: event.lineno,
      colno: event.colno,
      stack: extractStack(event),
      type: 'error',
      timestamp: Date.now(),
      url: window.location.href,
      userAgent: navigator.userAgent,
    };

    if (config.debug) {
      console.error('[ErrorReporter] Captured error:', capturedError);
    }

    // Update state
    setErrors(prev => {
      const updated = [...prev, capturedError];
      
      // Save to localStorage
      if (config.enableLocalStorage) {
        saveToLocalStorage(updated, config.maxLocalStorageErrors);
      }
      
      return updated;
    });

    // Send to backend
    sendErrorToBackend(capturedError, config.endpoint).catch(() => {
      // If backend fails and localStorage is enabled, it's already saved
      if (!config.enableLocalStorage && config.debug) {
        console.warn('[ErrorReporter] Backend logging failed and localStorage is disabled');
      }
    });

    // Don't prevent default error handling
  }, [config]);

  const handleUnhandledRejection = useCallback((event: PromiseRejectionEvent) => {
    const capturedError: CapturedError = {
      id: generateErrorId(),
      message: event.reason?.message || String(event.reason),
      stack: extractStack(event),
      type: 'unhandledrejection',
      timestamp: Date.now(),
      url: window.location.href,
      userAgent: navigator.userAgent,
    };

    if (config.debug) {
      console.warn('[ErrorReporter] Captured unhandled rejection:', capturedError);
    }

    // Update state
    setErrors(prev => {
      const updated = [...prev, capturedError];
      
      // Save to localStorage
      if (config.enableLocalStorage) {
        saveToLocalStorage(updated, config.maxLocalStorageErrors);
      }
      
      return updated;
    });

    // Send to backend
    sendErrorToBackend(capturedError, config.endpoint).catch(() => {
      if (!config.enableLocalStorage && config.debug) {
        console.warn('[ErrorReporter] Backend logging failed and localStorage is disabled');
      }
    });
  }, [config]);

  // Set up error listeners
  useEffect(() => {
    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, [handleError, handleUnhandledRejection]);

  const clearErrors = useCallback(() => {
    setErrors([]);
    if (config.enableLocalStorage) {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, [config.enableLocalStorage]);

  return {
    errors,
    clearErrors,
    hasErrors: errors.length > 0,
  };
}

export default useErrorReporter;
