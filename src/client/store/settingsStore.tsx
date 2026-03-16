/**
 * User Settings Store
 * 
 * Manages user preferences globally with localStorage persistence
 * for theme, language, and other customizable settings.
 * 
 * Issue #197: Sprint 10: 用户偏好设置功能
 */

import React, { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';

// User settings interface
export interface UserSettings {
  theme: 'light' | 'dark';
  language: 'zh' | 'en';
  // Future settings can be added here
  // fontSize: 'small' | 'medium' | 'large';
  // notifications: boolean;
}

// Default settings
const defaultSettings: UserSettings = {
  theme: 'dark',
  language: 'zh',
};

// Storage key for localStorage
const SETTINGS_STORAGE_KEY = 'alphaarena-settings';

/**
 * Load settings from localStorage
 */
const loadSettings = (): UserSettings | null => {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const stored = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      // Merge with defaults to ensure all fields exist
      return {
        ...defaultSettings,
        ...parsed,
      };
    }
  } catch (error) {
    console.warn('Failed to load settings from localStorage:', error);
  }

  return null;
};

/**
 * Save settings to localStorage
 */
const saveSettings = (settings: UserSettings): void => {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  } catch (error) {
    console.warn('Failed to save settings to localStorage:', error);
  }
};

/**
 * Get initial theme considering system preference
 */
const getInitialTheme = (storedSettings: UserSettings | null): 'light' | 'dark' => {
  // If user has explicitly set a theme in localStorage, use it
  if (storedSettings?.theme) {
    return storedSettings.theme;
  }

  // Check system preference
  if (typeof window !== 'undefined' && window.matchMedia) {
    if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'dark';
    }
  }

  // Default to dark theme
  return defaultSettings.theme;
};

/**
 * Get initial language
 */
const getInitialLanguage = (storedSettings: UserSettings | null): 'zh' | 'en' => {
  if (storedSettings?.language) {
    return storedSettings.language;
  }
  return defaultSettings.language;
};

// Context type
interface SettingsContextType {
  settings: UserSettings;
  updateSettings: (updates: Partial<UserSettings>) => void;
  setTheme: (theme: 'light' | 'dark') => void;
  setLanguage: (language: 'zh' | 'en') => void;
  toggleTheme: () => void;
  resetSettings: () => void;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

interface SettingsProviderProps {
  children: ReactNode;
}

export const SettingsProvider: React.FC<SettingsProviderProps> = ({ children }) => {
  const [settings, setSettings] = useState<UserSettings>(() => {
    const stored = loadSettings();
    return {
      theme: getInitialTheme(stored),
      language: getInitialLanguage(stored),
    };
  });

  // Apply theme to document when it changes
  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove('light', 'dark');
    root.classList.add(settings.theme);
    root.setAttribute('data-theme', settings.theme);
  }, [settings.theme]);

  // Apply language to document
  useEffect(() => {
    document.documentElement.setAttribute('lang', settings.language);
  }, [settings.language]);

  // Update settings and persist to localStorage
  const updateSettings = useCallback((updates: Partial<UserSettings>) => {
    setSettings((prev) => {
      const newSettings = { ...prev, ...updates };
      saveSettings(newSettings);
      return newSettings;
    });
  }, []);

  const setTheme = useCallback((theme: 'light' | 'dark') => {
    updateSettings({ theme });
  }, [updateSettings]);

  const setLanguage = useCallback((language: 'zh' | 'en') => {
    updateSettings({ language });
  }, [updateSettings]);

  const toggleTheme = useCallback(() => {
    setSettings((prev) => {
      const newTheme = prev.theme === 'light' ? 'dark' : 'light';
      const newSettings = { ...prev, theme: newTheme };
      saveSettings(newSettings);
      return newSettings;
    });
  }, []);

  const resetSettings = useCallback(() => {
    setSettings(defaultSettings);
    saveSettings(defaultSettings);
  }, []);

  // Listen for system theme changes
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    
    const handleChange = (event: MediaQueryListEvent) => {
      // Only auto-switch if user hasn't explicitly set a preference
      const stored = loadSettings();
      if (!stored) {
        setTheme(event.matches ? 'dark' : 'light');
      }
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [setTheme]);

  const value: SettingsContextType = {
    settings,
    updateSettings,
    setTheme,
    setLanguage,
    toggleTheme,
    resetSettings,
  };

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  );
};

/**
 * Hook to access user settings
 */
export const useSettings = (): SettingsContextType => {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
};

export default SettingsContext;
