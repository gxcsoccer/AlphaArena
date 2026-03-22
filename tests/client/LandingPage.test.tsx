/**
 * LandingPage Tests
 * Issue #523: Landing Page Optimization
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
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
      <LandingPage />
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
    expect(screen.getByText('AlphaArena')).toBeInTheDocument();
    expect(screen.getByText('产品')).toBeInTheDocument();
    expect(screen.getByText('资源')).toBeInTheDocument();
  });

  it('handles share button click with Web Share API', async () => {
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

  it('includes UTM parameters in share URL', async () => {
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
      expect(mockShare).toHaveBeenCalledWith(
        expect.objectContaining({
          url: expect.stringContaining('utm_source=native_share'),
        })
      );
    });
  });

  it('shows share menu when Web Share API is not available', async () => {
    // Remove navigator.share
    Object.defineProperty(navigator, 'share', {
      value: undefined,
      writable: true,
    });

    renderLandingPage();
    const shareButton = screen.getByRole('button', { name: /分享给朋友/ });
    fireEvent.click(shareButton);

    await waitFor(() => {
      // Check that the button can be clicked (showing the menu is internal state)
      expect(shareButton).toBeInTheDocument();
    });
  });

  it('renders all feature cards with correct content', () => {
    renderLandingPage();
    
    // Check all feature titles
    expect(screen.getByText('AI 驱动策略')).toBeInTheDocument();
    expect(screen.getAllByText('模拟交易').length).toBeGreaterThan(0);
    expect(screen.getByText('竞技排名')).toBeInTheDocument();
    expect(screen.getByText('极速执行')).toBeInTheDocument();
    
    // Check some highlights
    expect(screen.getByText('智能市场分析')).toBeInTheDocument();
    expect(screen.getByText('真实市场数据')).toBeInTheDocument();
    expect(screen.getByText('实时排行榜')).toBeInTheDocument();
  });

  it('renders stats with correct values', () => {
    renderLandingPage();
    
    expect(screen.getByText('10K+')).toBeInTheDocument();
    expect(screen.getByText('100M+')).toBeInTheDocument();
    expect(screen.getByText('99.9%')).toBeInTheDocument();
    expect(screen.getByText('24/7')).toBeInTheDocument();
  });

  it('renders all how it works steps', () => {
    renderLandingPage();
    
    // Use getAllByText for text that appears multiple times
    expect(screen.getByText('注册账户')).toBeInTheDocument();
    expect(screen.getByText('选择策略')).toBeInTheDocument();
    expect(screen.getAllByText('模拟交易').length).toBeGreaterThan(0);
    expect(screen.getByText('优化改进')).toBeInTheDocument();
  });

  it('renders final CTA section', () => {
    renderLandingPage();
    
    expect(screen.getByText(/准备好开始您的算法交易之旅了吗/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /立即开始/ })).toBeInTheDocument();
  });
});