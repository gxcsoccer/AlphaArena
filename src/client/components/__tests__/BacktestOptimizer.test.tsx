/**
 * Tests for BacktestOptimizer Component
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BacktestOptimizer } from '../BacktestOptimizer';
import { SubscriptionProvider } from '../../hooks/useSubscription';

// Mock useSubscription
jest.mock('../../hooks/useSubscription', () => ({
  useSubscription: () => ({
    isPro: true,
    plan: 'pro',
    subscription: { plan: 'pro' },
    loading: false,
  }),
  useFeatureLimit: () => ({
    allowed: true,
    current: 5,
    limit: 50,
    increment: jest.fn().mockResolvedValue(6),
    refresh: jest.fn(),
  }),
}));

// Mock API
jest.mock('../../utils/api', () => ({
  api: {
    get: jest.fn().mockResolvedValue({ data: [] }),
    post: jest.fn().mockResolvedValue({ data: {} }),
  },
}));

const mockProps = {
  symbol: 'BTC/USDT',
  dateRange: [Date.now() - 90 * 24 * 60 * 60 * 1000, Date.now()] as [number, number],
  initialCapital: 10000,
};

describe('BacktestOptimizer', () => {
  it('renders correctly with VIP badge', () => {
    render(<BacktestOptimizer {...mockProps} />);
    
    expect(screen.getByText('参数优化')).toBeInTheDocument();
    expect(screen.getByText(/VIP/)).toBeInTheDocument();
  });

  it('displays strategy selection dropdown', () => {
    render(<BacktestOptimizer {...mockProps} />);
    
    expect(screen.getByText('策略')).toBeInTheDocument();
  });

  it('displays optimization method selection', () => {
    render(<BacktestOptimizer {...mockProps} />);
    
    expect(screen.getByText('优化方法')).toBeInTheDocument();
  });

  it('displays parameter range configuration', () => {
    render(<BacktestOptimizer {...mockProps} />);
    
    expect(screen.getByText('参数范围')).toBeInTheDocument();
  });

  it('shows start optimization button', () => {
    render(<BacktestOptimizer {...mockProps} />);
    
    expect(screen.getByText('开始优化')).toBeInTheDocument();
  });

  it('displays usage limit for non-pro users', () => {
    // Override mock for this test
    jest.spyOn(require('../../hooks/useSubscription'), 'useSubscription').mockReturnValue({
      isPro: false,
      plan: 'free',
      subscription: { plan: 'free' },
      loading: false,
    });

    render(<BacktestOptimizer {...mockProps} />);
    
    expect(screen.getByText(/今日优化次数/)).toBeInTheDocument();
  });

  it('disables start button when limit reached', () => {
    jest.spyOn(require('../../hooks/useSubscription'), 'useFeatureLimit').mockReturnValue({
      allowed: false,
      current: 50,
      limit: 50,
      increment: jest.fn(),
      refresh: jest.fn(),
    });

    render(<BacktestOptimizer {...mockProps} />);
    
    // Should show limit warning
    expect(screen.getByText(/已达限制/)).toBeInTheDocument();
  });

  it('shows progress during optimization', async () => {
    const user = userEvent.setup();
    render(<BacktestOptimizer {...mockProps} />);
    
    const startButton = screen.getByText('开始优化');
    await user.click(startButton);
    
    await waitFor(() => {
      expect(screen.getByText('优化进度')).toBeInTheDocument();
    });
  });

  it('displays results after optimization completes', async () => {
    const user = userEvent.setup();
    render(<BacktestOptimizer {...mockProps} />);
    
    const startButton = screen.getByText('开始优化');
    await user.click(startButton);
    
    await waitFor(() => {
      expect(screen.getByText(/优化结果/)).toBeInTheDocument();
    }, { timeout: 5000 });
  });

  it('can apply optimal parameters', async () => {
    const onOptimalParamsFound = jest.fn();
    const user = userEvent.setup();
    render(<BacktestOptimizer {...mockProps} onOptimalParamsFound={onOptimalParamsFound} />);
    
    const startButton = screen.getByText('开始优化');
    await user.click(startButton);
    
    await waitFor(() => {
      expect(screen.getByText('应用')).toBeInTheDocument();
    }, { timeout: 5000 });

    const applyButton = screen.getAllByText('应用')[0];
    await user.click(applyButton);
    
    expect(onOptimalParamsFound).toHaveBeenCalled();
  });

  it('can export results', async () => {
    const user = userEvent.setup();
    render(<BacktestOptimizer {...mockProps} />);
    
    // Run optimization first
    const startButton = screen.getByText('开始优化');
    await user.click(startButton);
    
    await waitFor(() => {
      expect(screen.getByText('导出结果')).toBeInTheDocument();
    }, { timeout: 5000 });
  });

  it('displays parameter range inputs correctly', () => {
    render(<BacktestOptimizer {...mockProps} />);
    
    // Check for min/max/step inputs
    expect(screen.getByText('最小')).toBeInTheDocument();
    expect(screen.getByText('最大')).toBeInTheDocument();
    expect(screen.getByText('步长')).toBeInTheDocument();
  });

  it('shows VIP feature info section', () => {
    render(<BacktestOptimizer {...mockProps} />);
    
    expect(screen.getByText(/VIP 参数优化功能/)).toBeInTheDocument();
    expect(screen.getByText(/网格搜索/)).toBeInTheDocument();
    expect(screen.getByText(/遗传算法/)).toBeInTheDocument();
  });
});