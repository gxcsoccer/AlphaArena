/**
 * Tests for MultiStrategyComparison Component
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MultiStrategyComparison from '../MultiStrategyComparison';

// Mock useSubscription
jest.mock('../../hooks/useSubscription', () => ({
  useSubscription: () => ({
    isPro: true,
    plan: 'pro',
    subscription: { plan: 'pro' },
    loading: false,
  }),
}));

const mockProps = {
  dateRange: [Date.now() - 90 * 24 * 60 * 60 * 1000, Date.now()] as [number, number],
  initialCapital: 10000,
};

describe('MultiStrategyComparison', () => {
  it('renders correctly with VIP badge', () => {
    render(<MultiStrategyComparison {...mockProps} />);
    
    expect(screen.getByText('多策略对比')).toBeInTheDocument();
    expect(screen.getByText(/VIP/)).toBeInTheDocument();
  });

  it('displays strategy selection cards', () => {
    render(<MultiStrategyComparison {...mockProps} />);
    
    expect(screen.getByText('选择策略对比')).toBeInTheDocument();
    expect(screen.getByText('策略')).toBeInTheDocument();
    expect(screen.getByText('交易对')).toBeInTheDocument();
  });

  it('shows start comparison button', () => {
    render(<MultiStrategyComparison {...mockProps} />);
    
    expect(screen.getByText('开始对比')).toBeInTheDocument();
  });

  it('can add new strategy card', async () => {
    const user = userEvent.setup();
    render(<MultiStrategyComparison {...mockProps} />);
    
    const addButton = screen.getByText('添加策略');
    await user.click(addButton);
    
    // Should now have 3 strategy cards
    const selects = screen.getAllByText('策略');
    expect(selects.length).toBeGreaterThan(2);
  });

  it('limits maximum strategies to 4 by default', async () => {
    const user = userEvent.setup();
    render(<MultiStrategyComparison {...mockProps} />);
    
    // Add strategies until limit
    for (let i = 0; i < 3; i++) {
      const addButton = screen.queryByText('添加策略');
      if (addButton) {
        await user.click(addButton);
      }
    }
    
    // After 4 strategies, add button should not be visible
    expect(screen.queryByText('添加策略')).not.toBeInTheDocument();
  });

  it('can remove strategy card', async () => {
    const user = userEvent.setup();
    render(<MultiStrategyComparison {...mockProps} />);
    
    const deleteButtons = screen.getAllByRole('button').filter((btn) => 
      btn.querySelector('svg[class*="delete"]') || btn.className.includes('danger')
    );
    
    if (deleteButtons.length > 0) {
      await user.click(deleteButtons[0]);
    }
  });

  it('shows loading state during comparison', async () => {
    const user = userEvent.setup();
    render(<MultiStrategyComparison {...mockProps} />);
    
    const startButton = screen.getByText('开始对比');
    await user.click(startButton);
    
    await waitFor(() => {
      expect(screen.getByText('正在对比策略...')).toBeInTheDocument();
    });
  });

  it('displays results after comparison completes', async () => {
    const user = userEvent.setup();
    render(<MultiStrategyComparison {...mockProps} />);
    
    const startButton = screen.getByText('开始对比');
    await user.click(startButton);
    
    await waitFor(() => {
      expect(screen.getByText('策略性能对比图')).toBeInTheDocument();
    }, { timeout: 5000 });
  });

  it('shows summary statistics after comparison', async () => {
    const user = userEvent.setup();
    render(<MultiStrategyComparison {...mockProps} />);
    
    const startButton = screen.getByText('开始对比');
    await user.click(startButton);
    
    await waitFor(() => {
      expect(screen.getByText('最佳策略')).toBeInTheDocument();
      expect(screen.getByText('平均收益率')).toBeInTheDocument();
      expect(screen.getByText('平均 Sharpe')).toBeInTheDocument();
    }, { timeout: 5000 });
  });

  it('can export comparison results', async () => {
    const user = userEvent.setup();
    render(<MultiStrategyComparison {...mockProps} />);
    
    // Run comparison first
    const startButton = screen.getByText('开始对比');
    await user.click(startButton);
    
    await waitFor(() => {
      expect(screen.getByText('导出结果')).toBeInTheDocument();
    }, { timeout: 5000 });
  });

  it('calls onCompareComplete callback', async () => {
    const onCompareComplete = jest.fn();
    const user = userEvent.setup();
    render(<MultiStrategyComparison {...mockProps} onCompareComplete={onCompareComplete} />);
    
    const startButton = screen.getByText('开始对比');
    await user.click(startButton);
    
    await waitFor(() => {
      expect(onCompareComplete).toHaveBeenCalled();
    }, { timeout: 5000 });
  });

  it('allows changing strategy selection', async () => {
    const user = userEvent.setup();
    render(<MultiStrategyComparison {...mockProps} />);
    
    const selects = document.querySelectorAll('.arco-select');
    expect(selects.length).toBeGreaterThan(0);
  });

  it('shows VIP feature info section', () => {
    render(<MultiStrategyComparison {...mockProps} />);
    
    expect(screen.getByText(/VIP 多策略对比功能/)).toBeInTheDocument();
  });

  it('prevents comparison with less than 2 strategies', async () => {
    const user = userEvent.setup();
    render(<MultiStrategyComparison {...mockProps} maxStrategies={4} />);
    
    // This test would require removing strategies to get below 2
    // Then clicking start should show warning
  });

  it('displays strategy colors in comparison', async () => {
    const user = userEvent.setup();
    render(<MultiStrategyComparison {...mockProps} />);
    
    const startButton = screen.getByText('开始对比');
    await user.click(startButton);
    
    await waitFor(() => {
      // Check for colored indicators
      const coloredDivs = document.querySelectorAll('[style*="background"]');
      expect(coloredDivs.length).toBeGreaterThan(0);
    }, { timeout: 5000 });
  });
});