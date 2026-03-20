import { renderHook, act, waitFor } from '@testing-library/react';
import { ThemeProvider, useTheme, Theme } from '../useTheme';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: jest.fn((key: string) => store[key] || null),
    setItem: jest.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: jest.fn((key: string) => {
      delete store[key];
    }),
    clear: jest.fn(() => {
      store = {};
    }),
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

// Helper to create a complete matchMedia mock
const createMatchMediaMock = (matches: boolean) => (query: string) => ({
  matches,
  media: query,
  onchange: null,
  addListener: jest.fn(),
  removeListener: jest.fn(),
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
  dispatchEvent: jest.fn(),
});

// Mock matchMedia
const matchMediaMock = jest.fn().mockImplementation(createMatchMediaMock(false));

Object.defineProperty(window, 'matchMedia', {
  value: matchMediaMock,
  writable: true,
});

describe('useTheme', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorageMock.clear();
    document.documentElement.classList.remove('light', 'dark');
    document.documentElement.removeAttribute('data-theme');
    // Reset to default mock
    matchMediaMock.mockImplementation(createMatchMediaMock(false));
  });

  const wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <ThemeProvider>{children}</ThemeProvider>
  );

  describe('initial theme detection', () => {
    it('should use localStorage preference if available', () => {
      localStorageMock.getItem.mockReturnValue('dark');
      matchMediaMock.mockImplementation(createMatchMediaMock(false));

      const { result } = renderHook(() => useTheme(), { wrapper });

      expect(result.current.theme).toBe('dark');
      expect(localStorageMock.getItem).toHaveBeenCalledWith('alphaarena-theme');
    });

    it('should use system preference if no localStorage value', () => {
      localStorageMock.getItem.mockReturnValue(null);
      matchMediaMock.mockImplementation(createMatchMediaMock(true));

      const { result } = renderHook(() => useTheme(), { wrapper });

      expect(result.current.theme).toBe('dark');
    });

    it('should default to light if no preference', () => {
      localStorageMock.getItem.mockReturnValue(null);
      matchMediaMock.mockImplementation(createMatchMediaMock(false));

      const { result } = renderHook(() => useTheme(), { wrapper });

      expect(result.current.theme).toBe('light');
    });
  });

  describe('toggleTheme', () => {
    it('should toggle from light to dark', () => {
      localStorageMock.getItem.mockReturnValue(null);
      matchMediaMock.mockImplementation(createMatchMediaMock(false));

      const { result } = renderHook(() => useTheme(), { wrapper });

      expect(result.current.theme).toBe('light');

      act(() => {
        result.current.toggleTheme();
      });

      expect(result.current.theme).toBe('dark');
    });

    it('should toggle from dark to light', () => {
      localStorageMock.getItem.mockReturnValue('dark');

      const { result } = renderHook(() => useTheme(), { wrapper });

      expect(result.current.theme).toBe('dark');

      act(() => {
        result.current.toggleTheme();
      });

      expect(result.current.theme).toBe('light');
    });
  });

  describe('setTheme', () => {
    it('should set theme to dark', () => {
      localStorageMock.getItem.mockReturnValue(null);
      matchMediaMock.mockImplementation(createMatchMediaMock(false));

      const { result } = renderHook(() => useTheme(), { wrapper });

      act(() => {
        result.current.setTheme('dark');
      });

      expect(result.current.theme).toBe('dark');
    });

    it('should set theme to light', () => {
      localStorageMock.getItem.mockReturnValue('dark');

      const { result } = renderHook(() => useTheme(), { wrapper });

      act(() => {
        result.current.setTheme('light');
      });

      expect(result.current.theme).toBe('light');
    });
  });

  describe('localStorage persistence', () => {
    it('should save theme to localStorage when changed', () => {
      localStorageMock.getItem.mockReturnValue(null);
      matchMediaMock.mockImplementation(createMatchMediaMock(false));

      const { result } = renderHook(() => useTheme(), { wrapper });

      act(() => {
        result.current.toggleTheme();
      });

      expect(localStorageMock.setItem).toHaveBeenCalledWith('alphaarena-theme', 'dark');
    });
  });

  describe('DOM updates', () => {
    it('should add theme class to document root', () => {
      localStorageMock.getItem.mockReturnValue(null);
      matchMediaMock.mockImplementation(createMatchMediaMock(false));

      renderHook(() => useTheme(), { wrapper });

      expect(document.documentElement.classList.contains('light')).toBe(true);
      expect(document.documentElement.classList.contains('dark')).toBe(false);
      expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    });

    it('should update theme class when theme changes', () => {
      localStorageMock.getItem.mockReturnValue(null);
      matchMediaMock.mockImplementation(createMatchMediaMock(false));

      const { result } = renderHook(() => useTheme(), { wrapper });

      act(() => {
        result.current.toggleTheme();
      });

      expect(document.documentElement.classList.contains('dark')).toBe(true);
      expect(document.documentElement.classList.contains('light')).toBe(false);
      expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    });
  });

  describe('system preference listener', () => {
    it('should listen for system theme changes', async () => {
      localStorageMock.getItem.mockReturnValue(null);
      
      // Create a mock that tracks addEventListener calls
      const addEventListenerMock = jest.fn();
      const removeEventListenerMock = jest.fn();
      
      matchMediaMock.mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: jest.fn(),
        removeListener: jest.fn(),
        addEventListener: addEventListenerMock,
        removeEventListener: removeEventListenerMock,
        dispatchEvent: jest.fn(),
      }));

      const { unmount } = renderHook(() => useTheme(), { wrapper });

      // Wait for the effect to run after isInitialized becomes true
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
      });

      expect(addEventListenerMock).toHaveBeenCalledWith('change', expect.any(Function));

      unmount();
      expect(removeEventListenerMock).toHaveBeenCalled();
    });
  });
});