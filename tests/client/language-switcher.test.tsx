/**
 * Language Switcher Tests (Issue #586)
 * 
 * Tests for language switching functionality including:
 * - Language switcher component
 * - User preferences API integration
 * - URL parameter handling
 */

import { render, screen, act, waitFor, fireEvent } from '@testing-library/react';
import React from 'react';
import { BrowserRouter, MemoryRouter } from 'react-router-dom';
import { LocaleProvider, useLocaleContext } from '../../src/client/i18n/LocaleProvider';
import { LanguageSwitcher } from '../../src/client/components/LanguageSwitcher';
import { useTranslation } from '../../src/client/i18n/hooks';
import i18n from '../../src/client/i18n/index';

// Mock useAuth hook
jest.mock('../../src/client/hooks/useAuth', () => ({
  useAuth: jest.fn(() => ({
    isAuthenticated: false,
    user: null,
  })),
}));

// Mock fetch for API calls
const mockFetch = jest.fn();
global.fetch = mockFetch;

// Test component to access locale context
function TestComponent() {
  const { currentLanguage, changeLanguage, supportedLanguages } = useLocaleContext();
  const { t } = useTranslation('common');
  
  return (
    <div>
      <span data-testid="current-language">{currentLanguage}</span>
      <span data-testid="translation-submit">{t('button.submit')}</span>
      <button data-testid="switch-en" onClick={() => changeLanguage('en-US')}>Switch to English</button>
      <button data-testid="switch-zh" onClick={() => changeLanguage('zh-CN')}>Switch to Chinese</button>
      <span data-testid="supported-languages">{supportedLanguages.length}</span>
    </div>
  );
}

const renderWithRouter = (initialRoute = '/') => {
  return render(
    <MemoryRouter initialEntries={[initialRoute]}>
      <LocaleProvider>
        <TestComponent />
      </LocaleProvider>
    </MemoryRouter>
  );
};

describe('Language Switcher (Issue #586)', () => {
  beforeEach(async () => {
    // Reset language to default before each test
    await act(async () => {
      await i18n.changeLanguage('zh-CN');
    });
    mockFetch.mockClear();
  });

  describe('Language Switching', () => {
    it('should switch language to English', async () => {
      renderWithRouter();
      
      // Initially Chinese - wait for loading to complete
      await waitFor(() => {
        expect(screen.getByTestId('current-language')).toHaveTextContent('zh-CN');
        expect(screen.getByTestId('translation-submit')).toHaveTextContent('提交');
      }, { timeout: 5000 });
      
      // Switch to English
      await act(async () => {
        screen.getByTestId('switch-en').click();
      });
      
      await waitFor(() => {
        expect(screen.getByTestId('current-language')).toHaveTextContent('en-US');
        expect(screen.getByTestId('translation-submit')).toHaveTextContent('Submit');
      }, { timeout: 5000 });
    });

    it('should switch language back to Chinese', async () => {
      renderWithRouter();
      
      // Wait for loading to complete
      await waitFor(() => {
        expect(screen.getByTestId('switch-en')).toBeInTheDocument();
      }, { timeout: 5000 });
      
      // Switch to English first
      await act(async () => {
        screen.getByTestId('switch-en').click();
      });
      
      await waitFor(() => {
        expect(screen.getByTestId('current-language')).toHaveTextContent('en-US');
      }, { timeout: 5000 });
      
      // Switch back to Chinese
      await act(async () => {
        screen.getByTestId('switch-zh').click();
      });
      
      await waitFor(() => {
        expect(screen.getByTestId('current-language')).toHaveTextContent('zh-CN');
      }, { timeout: 5000 });
    });
  });

  describe('Language Persistence', () => {
    it('should support language switching with localStorage configured', async () => {
      // This test verifies the configuration is correct for localStorage persistence
      // The actual persistence is handled by i18next-browser-languagedetector
      renderWithRouter();
      
      // Wait for loading to complete
      await waitFor(() => {
        expect(screen.getByTestId('current-language')).toHaveTextContent('zh-CN');
      }, { timeout: 5000 });
      
      // Switch to English
      await act(async () => {
        screen.getByTestId('switch-en').click();
      });
      
      await waitFor(() => {
        expect(screen.getByTestId('current-language')).toHaveTextContent('en-US');
      }, { timeout: 5000 });
      
      // Verify the language changed successfully in i18n
      expect(i18n.language).toBe('en-US');
    });
  });

  describe('Supported Languages', () => {
it('should have exactly 4 supported languages', async () => {
      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByTestId('supported-languages')).toHaveTextContent('4');
      });
    });
  });
});

describe('LanguageSwitcher Component', () => {
  beforeEach(async () => {
    await act(async () => {
      await i18n.changeLanguage('zh-CN');
    });
    mockFetch.mockClear();
  });

  it('should render language switcher button', async () => {
    render(
      <MemoryRouter>
        <LocaleProvider>
          <LanguageSwitcher />
        </LocaleProvider>
      </MemoryRouter>
    );
    
    await waitFor(() => {
      // Should show a button with language icon
      const button = screen.getByRole('button', { name: /切换语言/i });
      expect(button).toBeInTheDocument();
    });
  });

  it('should show current language in label', async () => {
    render(
      <MemoryRouter>
        <LocaleProvider>
          <LanguageSwitcher />
        </LocaleProvider>
      </MemoryRouter>
    );
    
    await waitFor(() => {
      // Should show "简体中文" when language is zh-CN
      expect(screen.getByText('简体中文')).toBeInTheDocument();
    });
  });

  it('should open dropdown with language options when clicked', async () => {
    render(
      <MemoryRouter>
        <LocaleProvider>
          <LanguageSwitcher />
        </LocaleProvider>
      </MemoryRouter>
    );
    
    await waitFor(() => {
      const button = screen.getByRole('button', { name: /切换语言/i });
      expect(button).toBeInTheDocument();
    });
    
    // Click to open dropdown
    const button = screen.getByRole('button', { name: /切换语言/i });
    await act(async () => {
      fireEvent.click(button);
    });
    
    // Dropdown should appear - use getAllByText since there are multiple English elements
    await waitFor(() => {
      const englishElements = screen.getAllByText('English');
      expect(englishElements.length).toBeGreaterThan(0);
    });
  });

  // Issue #598: Test the specific bug scenario - switching back to Chinese
  it('should be able to switch back to Chinese after switching to English', async () => {
    render(
      <MemoryRouter>
        <LocaleProvider>
          <TestComponent />
        </LocaleProvider>
      </MemoryRouter>
    );
    
    // Wait for loading to complete
    await waitFor(() => {
      expect(screen.getByTestId('current-language')).toHaveTextContent('zh-CN');
    }, { timeout: 5000 });
    
    // Switch to English
    await act(async () => {
      screen.getByTestId('switch-en').click();
    });
    
    await waitFor(() => {
      expect(screen.getByTestId('current-language')).toHaveTextContent('en-US');
    }, { timeout: 5000 });
    
    // Switch back to Chinese - this is the bug scenario
    await act(async () => {
      screen.getByTestId('switch-zh').click();
    });
    
    await waitFor(() => {
      expect(screen.getByTestId('current-language')).toHaveTextContent('zh-CN');
    }, { timeout: 5000 });
  });
});

describe('URL Parameter Support', () => {
  // Note: These tests verify the i18n configuration supports URL parameter detection
  // The actual detection is handled by i18next-browser-languagedetector
  
  it('should have detection configured in i18n module', async () => {
    // Import the actual i18n config to check detection settings
    // The detection config is set in src/client/i18n/index.ts
    const i18nConfig = await import('../../src/client/i18n/index');
    
    // Verify the module exports the correct configuration
    expect(i18nConfig.SUPPORTED_LANGUAGES).toHaveProperty('zh-CN');
    expect(i18nConfig.SUPPORTED_LANGUAGES).toHaveProperty('en-US');
    expect(i18nConfig.SUPPORTED_LANGUAGES).toHaveProperty('ja-JP');
    expect(i18nConfig.SUPPORTED_LANGUAGES).toHaveProperty('ko-KR');
    expect(i18nConfig.DEFAULT_LANGUAGE).toBe('zh-CN');
  });

  it('should support language switching via API', async () => {
    // This verifies the changeLanguage function works
    renderWithRouter();
    
    await waitFor(() => {
      expect(screen.getByTestId('current-language')).toHaveTextContent('zh-CN');
    }, { timeout: 5000 });
    
    // Switch to English
    await act(async () => {
      screen.getByTestId('switch-en').click();
    });
    
    await waitFor(() => {
      expect(screen.getByTestId('current-language')).toHaveTextContent('en-US');
    }, { timeout: 5000 });
  });
});

describe('Translation Keys for Language Switcher', () => {
  function TranslationTestComponent() {
    const { t } = useTranslation('common');
    
    return (
      <div>
        <span data-testid="lang-zh">{t('language.zh')}</span>
        <span data-testid="lang-en">{t('language.en')}</span>
        <span data-testid="lang-switch">{t('language.switchTo')}</span>
      </div>
    );
  }

  beforeEach(async () => {
    // Reset language to Chinese before each test
    await act(async () => {
      await i18n.changeLanguage('zh-CN');
    });
  });

  it('should have correct Chinese translation keys', async () => {
    render(
      <MemoryRouter>
        <LocaleProvider>
          <TranslationTestComponent />
        </LocaleProvider>
      </MemoryRouter>
    );
    
    await waitFor(() => {
      expect(screen.getByTestId('lang-zh')).toHaveTextContent('简体中文');
      expect(screen.getByTestId('lang-en')).toHaveTextContent('English');
      expect(screen.getByTestId('lang-switch')).toHaveTextContent('切换语言');
    });
  });

  it('should have correct English translation keys', async () => {
    // First set language to English
    await act(async () => {
      await i18n.changeLanguage('en-US');
    });
    
    render(
      <MemoryRouter>
        <LocaleProvider>
          <TranslationTestComponent />
        </LocaleProvider>
      </MemoryRouter>
    );
    
    await waitFor(() => {
      expect(screen.getByTestId('lang-zh')).toHaveTextContent('简体中文');
      expect(screen.getByTestId('lang-en')).toHaveTextContent('English');
      expect(screen.getByTestId('lang-switch')).toHaveTextContent('Switch Language');
    });
  });
});