/**
 * LandingPage Tests
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { LocaleProvider } from '../../src/client/i18n/LocaleProvider';
import { SettingsProvider } from '../../src/client/store/settingsStore';
import LandingPage from '../../src/client/pages/LandingPage';

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

describe('LandingPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders hero section with title', () => {
    renderLandingPage();
    // Check that the hero section title exists - use getAllByText since it may appear multiple times
    const titles = screen.getAllByText(/专业级算法交易/i);
    expect(titles.length).toBeGreaterThan(0);
  });

  it('renders features section', () => {
    renderLandingPage();
    // Check for AI feature title
    expect(screen.getByRole('heading', { name: 'AI 驱动策略' })).toBeInTheDocument();
    // Check for other features in the features section
    expect(screen.getByRole('heading', { name: '竞技排名' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '极速执行' })).toBeInTheDocument();
  });

  it('renders CTA buttons', () => {
    renderLandingPage();
    expect(screen.getByRole('button', { name: /免费注册/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /分享给朋友/ })).toBeInTheDocument();
  });

  it('navigates to register on CTA click', () => {
    renderLandingPage();
    const registerButton = screen.getByRole('button', { name: /免费注册/ });
    fireEvent.click(registerButton);
    expect(mockNavigate).toHaveBeenCalledWith('/register');
  });

  it('renders testimonials section', () => {
    renderLandingPage();
    expect(screen.getByRole('heading', { name: '用户评价' })).toBeInTheDocument();
    expect(screen.getByText('张明')).toBeInTheDocument();
    expect(screen.getByText('李华')).toBeInTheDocument();
    expect(screen.getByText('王芳')).toBeInTheDocument();
  });

  it('renders stats section', () => {
    renderLandingPage();
    expect(screen.getByText('活跃用户')).toBeInTheDocument();
    expect(screen.getByText('模拟交易量')).toBeInTheDocument();
  });

  it('renders how it works section', () => {
    renderLandingPage();
    expect(screen.getByRole('heading', { name: '开始使用' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '注册账户' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '选择策略' })).toBeInTheDocument();
  });

  it('renders footer with links', () => {
    renderLandingPage();
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
    const shareButton = screen.getByRole('button', { name: /分享给朋友/ });
    fireEvent.click(shareButton);

    await waitFor(() => {
      expect(mockShare).toHaveBeenCalled();
    });
  });
});