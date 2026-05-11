/**
 * Language Switcher Context Test (Issue #768)
 * 
 * P0 Bug: Language switch button not found on homepage
 * Root cause: LocaleProvider was not wrapping the app, causing
 * LanguageSwitcher component to fail when calling useLocaleContext()
 * 
 * This test verifies that LanguageSwitcher can render when LocaleProvider
 * is properly provided in the component tree.
 */

import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { BrowserRouter, MemoryRouter } from 'react-router-dom';
import { LocaleProvider } from '../../src/client/i18n/LocaleProvider';
import { LanguageSwitcher } from '../../src/client/components/LanguageSwitcher';
import i18n from '../../src/client/i18n/index';
import { act } from 'react-dom/test-utils';

// Mock useAuth hook
jest.mock('../../src/client/hooks/useAuth', () => ({
  useAuth: jest.fn(() => ({
    isAuthenticated: false,
    user: null,
  })),
}));

describe('LanguageSwitcher Context (Issue #768)', () => {
  beforeEach(async () => {
    // Reset language to default before each test
    await act(async () => {
      await i18n.changeLanguage('zh-CN');
    });
  });

  it('should fail to render without LocaleProvider (reproducing the bug)', async () => {
    // This test reproduces the P0 bug - LanguageSwitcher crashes without LocaleProvider
    // We expect it to throw an error
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    
    expect(() => {
      render(
        <MemoryRouter>
          <LanguageSwitcher />
        </MemoryRouter>
      );
    }).toThrow('useLocaleContext must be used within a LocaleProvider');
    
    consoleError.mockRestore();
  });

  it('should render successfully with LocaleProvider', async () => {
    // This test verifies the fix - LanguageSwitcher works when LocaleProvider wraps it
    render(
      <MemoryRouter>
        <LocaleProvider>
          <LanguageSwitcher />
        </LocaleProvider>
      </MemoryRouter>
    );
    
    // Wait for i18n to initialize
    await waitFor(() => {
      // Should show a button with language icon
      const button = screen.getByRole('button', { name: /切换语言/i });
      expect(button).toBeInTheDocument();
    }, { timeout: 10000 });
  });

  it('should render with data-testid for automated testing', async () => {
    // Smoke tests use data-testid to find elements
    render(
      <MemoryRouter>
        <LocaleProvider>
          <LanguageSwitcher />
        </LocaleProvider>
      </MemoryRouter>
    );
    
    await waitFor(() => {
      // The button should have data-testid="language-selector"
      const button = screen.getByTestId('language-selector');
      expect(button).toBeInTheDocument();
    }, { timeout: 10000 });
  });

  it('should render on landing page when LocaleProvider is present', async () => {
    // Simulate landing page context - compact mode
    render(
      <MemoryRouter>
        <LocaleProvider>
          <LanguageSwitcher compact={true} />
        </LocaleProvider>
      </MemoryRouter>
    );
    
    await waitFor(() => {
      const button = screen.getByTestId('language-selector');
      expect(button).toBeInTheDocument();
    }, { timeout: 10000 });
  });
});