/**
 * i18n Framework Tests (Issue #584, Issue #618)
 * 
 * Tests for internationalization configuration and functionality.
 * Updated for lazy loading support.
 */

import { render, screen, act, waitFor } from '@testing-library/react';
import React from 'react';
import { LocaleProvider, useLocaleContext } from '../../src/client/i18n/LocaleProvider';
import { useTranslation } from '../../src/client/i18n/hooks';
import i18n from '../../src/client/i18n/index';

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

describe('i18n Framework', () => {
  beforeEach(async () => {
    // Reset language to default before each test
    await act(async () => {
      await i18n.changeLanguage('zh-CN');
    });
  });

  describe('LocaleProvider', () => {
    it('should render children after loading', async () => {
      render(
        <LocaleProvider>
          <div>Test Content</div>
        </LocaleProvider>
      );
      
      // Wait for loading to complete
      await waitFor(() => {
        expect(screen.getByText('Test Content')).toBeInTheDocument();
      }, { timeout: 5000 });
    });

    it('should provide default Chinese locale', async () => {
      render(
        <LocaleProvider>
          <TestComponent />
        </LocaleProvider>
      );
      
      await waitFor(() => {
        expect(screen.getByTestId('current-language')).toHaveTextContent('zh-CN');
      }, { timeout: 5000 });
    });

    it('should provide translation function', async () => {
      render(
        <LocaleProvider>
          <TestComponent />
        </LocaleProvider>
      );
      
      await waitFor(() => {
        expect(screen.getByTestId('translation-submit')).toHaveTextContent('提交');
      }, { timeout: 5000 });
    });
  });

  describe('Language Switching', () => {
    it('should switch language to English', async () => {
      render(
        <LocaleProvider>
          <TestComponent />
        </LocaleProvider>
      );
      
      // Initially Chinese
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
      render(
        <LocaleProvider>
          <TestComponent />
        </LocaleProvider>
      );
      
      // Wait for initial render
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

  describe('Supported Languages', () => {
    it('should have exactly 4 supported languages', async () => {
      render(
        <LocaleProvider>
          <TestComponent />
        </LocaleProvider>
      );
      
      await waitFor(() => {
        expect(screen.getByTestId('supported-languages')).toHaveTextContent('4');
      }, { timeout: 5000 });
    });
  });
});

describe('Translation Keys', () => {
  function TranslationTestComponent() {
    const { t } = useTranslation('common');
    
    return (
      <div>
        <span data-testid="key-cancel">{t('button.cancel')}</span>
        <span data-testid="key-confirm">{t('button.confirm')}</span>
        <span data-testid="key-name">{t('label.name')}</span>
        <span data-testid="key-success">{t('message.success')}</span>
        <span data-testid="key-required">{t('validation.required')}</span>
      </div>
    );
  }

  it('should translate Chinese keys correctly', async () => {
    render(
      <LocaleProvider>
        <TranslationTestComponent />
      </LocaleProvider>
    );
    
    await waitFor(() => {
      expect(screen.getByTestId('key-cancel')).toHaveTextContent('取消');
      expect(screen.getByTestId('key-confirm')).toHaveTextContent('确认');
      expect(screen.getByTestId('key-name')).toHaveTextContent('名称');
      expect(screen.getByTestId('key-success')).toHaveTextContent('操作成功');
      expect(screen.getByTestId('key-required')).toHaveTextContent('此字段为必填项');
    }, { timeout: 5000 });
  });
});

describe('Namespaces', () => {
  function NamespaceTestComponent() {
    const { t: common } = useTranslation('common');
    const { t: navigation } = useTranslation('navigation');
    const { t: auth } = useTranslation('auth');
    const { t: trading } = useTranslation('trading');
    
    return (
      <div>
        <span data-testid="ns-common">{common('button.submit')}</span>
        <span data-testid="ns-navigation">{navigation('menu.dashboard')}</span>
        <span data-testid="ns-auth">{auth('login.title')}</span>
        <span data-testid="ns-trading">{trading('order.buy')}</span>
      </div>
    );
  }

  it('should have working namespaces', async () => {
    render(
      <LocaleProvider>
        <NamespaceTestComponent />
      </LocaleProvider>
    );
    
    await waitFor(() => {
      expect(screen.getByTestId('ns-common')).toHaveTextContent('提交');
      expect(screen.getByTestId('ns-navigation')).toHaveTextContent('仪表盘');
      expect(screen.getByTestId('ns-auth')).toHaveTextContent('登录');
      expect(screen.getByTestId('ns-trading')).toHaveTextContent('买入');
    }, { timeout: 5000 });
  });
});

describe('Lazy Loading (Issue #618)', () => {
  it('should preload essential namespaces', async () => {
    render(
      <LocaleProvider>
        <TestComponent />
      </LocaleProvider>
    );
    
    // Wait for provider to be ready
    await waitFor(() => {
      expect(screen.getByTestId('current-language')).toBeInTheDocument();
    }, { timeout: 5000 });
    
    // Common namespace should be loaded
    expect(i18n.hasLoadedNamespace('common')).toBe(true);
    // SEO namespace should be preloaded
    expect(i18n.hasLoadedNamespace('seo')).toBe(true);
  });
  
  it('should have loadNamespaces function available', async () => {
    // Verify the loadNamespaces function exists and works
    await i18n.loadNamespaces('strategy');
    
    // Namespace should be loaded after calling loadNamespaces
    expect(i18n.hasLoadedNamespace('strategy')).toBe(true);
  });
});