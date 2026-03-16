import { renderHook, act } from '@testing-library/react';
import { SettingsProvider, useSettings, UserSettings } from '../settingsStore';

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

// Mock matchMedia helper
const createMatchMediaMock = (matches: boolean = false) => {
  const listeners: Array<() => void> = [];
  return jest.fn().mockImplementation(query => ({
    matches,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn((event: string, listener: () => void) => {
      listeners.push(listener);
    }),
    removeEventListener: jest.fn((event: string, listener: () => void) => {
      const index = listeners.indexOf(listener);
      if (index > -1) listeners.splice(index, 1);
    }),
    dispatchEvent: jest.fn(),
  }));
};

describe('settingsStore', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorageMock.clear();
    document.documentElement.classList.remove('light', 'dark');
    document.documentElement.removeAttribute('data-theme');
    document.documentElement.removeAttribute('lang');
    
    // Set up matchMedia mock (default: not dark mode)
    window.matchMedia = createMatchMediaMock(false);
  });

  const wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <SettingsProvider>{children}</SettingsProvider>
  );

  describe('initial settings', () => {
    it('should use default settings (dark theme, zh language) when no localStorage', () => {
      localStorageMock.getItem.mockReturnValue(null);

      const { result } = renderHook(() => useSettings(), { wrapper });

      // Default theme is 'dark' (see defaultSettings)
      expect(result.current.settings.theme).toBe('dark');
      expect(result.current.settings.language).toBe('zh');
    });

    it('should load settings from localStorage', () => {
      const storedSettings: UserSettings = { theme: 'light', language: 'en' };
      localStorageMock.getItem.mockReturnValue(JSON.stringify(storedSettings));

      const { result } = renderHook(() => useSettings(), { wrapper });

      expect(result.current.settings.theme).toBe('light');
      expect(result.current.settings.language).toBe('en');
    });

    it('should use system preference for theme if no stored preference', () => {
      localStorageMock.getItem.mockReturnValue(null);
      window.matchMedia = createMatchMediaMock(true); // Dark mode

      const { result } = renderHook(() => useSettings(), { wrapper });

      expect(result.current.settings.theme).toBe('dark');
    });
    
    it('should use stored theme over system preference', () => {
      const storedSettings: UserSettings = { theme: 'light', language: 'zh' };
      localStorageMock.getItem.mockReturnValue(JSON.stringify(storedSettings));
      window.matchMedia = createMatchMediaMock(true); // System prefers dark

      const { result } = renderHook(() => useSettings(), { wrapper });

      // Stored preference (light) should win over system preference (dark)
      expect(result.current.settings.theme).toBe('light');
    });
  });

  describe('theme management', () => {
    it('should toggle theme', () => {
      localStorageMock.getItem.mockReturnValue(null);

      const { result } = renderHook(() => useSettings(), { wrapper });

      // Default is dark
      expect(result.current.settings.theme).toBe('dark');

      act(() => {
        result.current.toggleTheme();
      });

      expect(result.current.settings.theme).toBe('light');

      act(() => {
        result.current.toggleTheme();
      });

      expect(result.current.settings.theme).toBe('dark');
    });

    it('should set theme directly', () => {
      localStorageMock.getItem.mockReturnValue(null);

      const { result } = renderHook(() => useSettings(), { wrapper });

      act(() => {
        result.current.setTheme('light');
      });

      expect(result.current.settings.theme).toBe('light');
    });
  });

  describe('language management', () => {
    it('should set language', () => {
      localStorageMock.getItem.mockReturnValue(null);

      const { result } = renderHook(() => useSettings(), { wrapper });

      expect(result.current.settings.language).toBe('zh');

      act(() => {
        result.current.setLanguage('en');
      });

      expect(result.current.settings.language).toBe('en');
    });
  });

  describe('updateSettings', () => {
    it('should update multiple settings at once', () => {
      localStorageMock.getItem.mockReturnValue(null);

      const { result } = renderHook(() => useSettings(), { wrapper });

      act(() => {
        result.current.updateSettings({ theme: 'light', language: 'en' });
      });

      expect(result.current.settings.theme).toBe('light');
      expect(result.current.settings.language).toBe('en');
    });

    it('should preserve existing settings when updating', () => {
      const storedSettings: UserSettings = { theme: 'light', language: 'zh' };
      localStorageMock.getItem.mockReturnValue(JSON.stringify(storedSettings));

      const { result } = renderHook(() => useSettings(), { wrapper });

      act(() => {
        result.current.updateSettings({ language: 'en' });
      });

      expect(result.current.settings.theme).toBe('light');
      expect(result.current.settings.language).toBe('en');
    });
  });

  describe('resetSettings', () => {
    it('should reset to default settings', () => {
      const storedSettings: UserSettings = { theme: 'light', language: 'en' };
      localStorageMock.getItem.mockReturnValue(JSON.stringify(storedSettings));

      const { result } = renderHook(() => useSettings(), { wrapper });

      expect(result.current.settings.theme).toBe('light');
      expect(result.current.settings.language).toBe('en');

      act(() => {
        result.current.resetSettings();
      });

      // Defaults are dark theme and zh language
      expect(result.current.settings.theme).toBe('dark');
      expect(result.current.settings.language).toBe('zh');
    });
  });

  describe('localStorage persistence', () => {
    it('should save settings to localStorage on change', () => {
      localStorageMock.getItem.mockReturnValue(null);

      const { result } = renderHook(() => useSettings(), { wrapper });

      act(() => {
        result.current.setTheme('light');
      });

      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'alphaarena-settings',
        expect.stringContaining('"theme":"light"')
      );
    });
  });

  describe('DOM updates', () => {
    it('should apply theme class to document root', () => {
      localStorageMock.getItem.mockReturnValue(null);

      renderHook(() => useSettings(), { wrapper });

      // Default is dark
      expect(document.documentElement.classList.contains('dark')).toBe(true);
      expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    });

    it('should apply language to document root', () => {
      localStorageMock.getItem.mockReturnValue(null);

      const { result } = renderHook(() => useSettings(), { wrapper });

      act(() => {
        result.current.setLanguage('en');
      });

      expect(document.documentElement.getAttribute('lang')).toBe('en');
    });

    it('should update theme class when theme changes', () => {
      localStorageMock.getItem.mockReturnValue(null);

      const { result } = renderHook(() => useSettings(), { wrapper });

      act(() => {
        result.current.setTheme('light');
      });

      expect(document.documentElement.classList.contains('light')).toBe(true);
      expect(document.documentElement.classList.contains('dark')).toBe(false);
      expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    });
  });

  describe('error handling', () => {
    it('should handle malformed localStorage data', () => {
      localStorageMock.getItem.mockReturnValue('invalid json');

      const { result } = renderHook(() => useSettings(), { wrapper });

      // Should fall back to defaults
      expect(result.current.settings.theme).toBeDefined();
      expect(result.current.settings.language).toBeDefined();
    });
  });
});
