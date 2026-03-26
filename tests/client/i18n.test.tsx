/**
 * i18n Framework Tests (Issue #584)
 * 
 * Tests for internationalization configuration and functionality.
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
    it('should render children without errors', () => {
      render(
        <LocaleProvider>
          <div>Test Content</div>
        </LocaleProvider>
      );
      
      expect(screen.getByText('Test Content')).toBeInTheDocument();
    });

    it('should provide default Chinese locale', async () => {
      render(
        <LocaleProvider>
          <TestComponent />
        </LocaleProvider>
      );
      
      await waitFor(() => {
        expect(screen.getByTestId('current-language')).toHaveTextContent('zh-CN');
      });
    });

    it('should provide translation function', async () => {
      render(
        <LocaleProvider>
          <TestComponent />
        </LocaleProvider>
      );
      
      await waitFor(() => {
        expect(screen.getByTestId('translation-submit')).toHaveTextContent('提交');
      });
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
      });
      
      // Switch to English
      await act(async () => {
        screen.getByTestId('switch-en').click();
      });
      
      await waitFor(() => {
        expect(screen.getByTestId('current-language')).toHaveTextContent('en-US');
        expect(screen.getByTestId('translation-submit')).toHaveTextContent('Submit');
      });
    });

    it('should switch language back to Chinese', async () => {
      render(
        <LocaleProvider>
          <TestComponent />
        </LocaleProvider>
      );
      
      // Switch to English first
      await act(async () => {
        screen.getByTestId('switch-en').click();
      });
      
      await waitFor(() => {
        expect(screen.getByTestId('current-language')).toHaveTextContent('en-US');
      });
      
      // Switch back to Chinese
      await act(async () => {
        screen.getByTestId('switch-zh').click();
      });
      
      await waitFor(() => {
        expect(screen.getByTestId('current-language')).toHaveTextContent('zh-CN');
      });
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
      });
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
    });
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
    });
  });
});