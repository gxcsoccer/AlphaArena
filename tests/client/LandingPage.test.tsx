/**
 * LandingPage Tests
 * Updated for lazy loading support (Issue #618)
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { LocaleProvider } from '../../src/client/i18n/LocaleProvider';
import { SettingsProvider } from '../../src/client/store/settingsStore';
import LandingPage from '../../src/client/pages/LandingPage';
import i18n from '../../src/client/i18n/index';

// Mock useAuth hook
jest.mock('../../src/client/hooks/useAuth', () => ({
  useAuth: () => ({
    isAuthenticated: false,
    isLoading: false,
  }),
}));

// Mock useNavigate
const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}));

const renderLandingPage = () => {
  return render(
    <BrowserRouter>
      <SettingsProvider>
        <LocaleProvider>
          <LandingPage />
        </LocaleProvider>
      </SettingsProvider>
    </BrowserRouter>
  );
};

// Helper to wait for loading to complete
const waitForLoading = async () => {
  await waitFor(() => {
    // Wait for the hero section to appear
    expect(screen.getAllByText(/专业级算法交易/i).length).toBeGreaterThan(0);
  }, { timeout: 5000 });
};

describe('LandingPage', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    // Reset language to default
    await i18n.changeLanguage('zh-CN');
  });

  it('renders hero section with title', async () => {
    renderLandingPage();
    await waitForLoading();
    // Check that the hero section title exists - use getAllByText since it may appear multiple times
    const titles = screen.getAllByText(/专业级算法交易/i);
    expect(titles.length).toBeGreaterThan(0);
  });

  it('renders features section', async () => {
    renderLandingPage();
    await waitForLoading();
    // Check for AI feature title
    expect(screen.getByRole('heading', { name: 'AI 驱动策略' })).toBeInTheDocument();
    // Check for other features in the features section
    expect(screen.getByRole('heading', { name: '竞技排名' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '极速执行' })).toBeInTheDocument();
  });

  it('renders CTA buttons', async () => {
    renderLandingPage();
    await waitForLoading();
    expect(screen.getByRole('button', { name: /免费注册/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /分享给朋友/ })).toBeInTheDocument();
  });

  it('navigates to register on CTA click', async () => {
    renderLandingPage();
    await waitForLoading();
    const registerButton = screen.getByRole('button', { name: /免费注册/ });
    fireEvent.click(registerButton);
    expect(mockNavigate).toHaveBeenCalledWith('/register');
  });

  it('renders testimonials section', async () => {
    renderLandingPage();
    await waitForLoading();
    expect(screen.getByRole('heading', { name: '用户评价' })).toBeInTheDocument();
    expect(screen.getByText('张明')).toBeInTheDocument();
    expect(screen.getByText('李华')).toBeInTheDocument();
    expect(screen.getByText('王芳')).toBeInTheDocument();
  });

  it('renders stats section', async () => {
    renderLandingPage();
    await waitForLoading();
    expect(screen.getByText('活跃用户')).toBeInTheDocument();
    expect(screen.getByText('模拟交易量')).toBeInTheDocument();
  });

  it('renders how it works section', async () => {
    renderLandingPage();
    await waitForLoading();
    expect(screen.getByRole('heading', { name: '开始使用' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '注册账户' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '选择策略' })).toBeInTheDocument();
  });

  it('renders footer with links', async () => {
    renderLandingPage();
    await waitForLoading();
    // Use getAllByText since AlphaArena appears multiple times (header + footer)
    expect(screen.getAllByText('AlphaArena').length).toBeGreaterThan(0);
    expect(screen.getByText('产品')).toBeInTheDocument();
    expect(screen.getByText('资源')).toBeInTheDocument();
  });

  it('handles share button click', async () => {
    // Mock navigator.share
    const mockShare = jest.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'share', {
      value: mockShare,
      writable: true,
    });

    renderLandingPage();
    await waitForLoading();
    const shareButton = screen.getByRole('button', { name: /分享给朋友/ });
    fireEvent.click(shareButton);

    await waitFor(() => {
      expect(mockShare).toHaveBeenCalled();
    });
  });
});