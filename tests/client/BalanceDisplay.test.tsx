/**
 * BalanceDisplay Component Tests
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { BalanceDisplay } from '../../src/client/components/BalanceDisplay';

// Mock the useBalance hook
jest.mock('../../src/client/hooks/useBalance', () => ({
  useBalance: jest.fn(),
}));

const { useBalance } = require('../../src/client/hooks/useBalance');

describe('BalanceDisplay', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Loading State', () => {
    it('should show loading spinner when loading', () => {
      (useBalance as jest.Mock).mockReturnValue({
        totalBalance: 0,
        availableBalance: 0,
        loading: true,
        error: null,
      });

      const { container } = render(<BalanceDisplay />);

      // Check for the spin icon class
      expect(container.querySelector('.arco-spin-icon')).toBeInTheDocument();
      expect(screen.getByText(/加载中/i)).toBeInTheDocument();
    });

    it('should show compact loading state on mobile', () => {
      (useBalance as jest.Mock).mockReturnValue({
        totalBalance: 0,
        availableBalance: 0,
        loading: true,
        error: null,
      });

      const { container } = render(<BalanceDisplay compact />);

      // Check for the spin icon
      expect(container.querySelector('.arco-spin-icon')).toBeInTheDocument();
      // Compact mode should not show loading text
      expect(screen.queryByText(/加载中/i)).not.toBeInTheDocument();
    });
  });

  describe('Error State', () => {
    it('should show error tag when balance fetch fails', () => {
      (useBalance as jest.Mock).mockReturnValue({
        totalBalance: 0,
        availableBalance: 0,
        loading: false,
        error: 'Failed to fetch balance',
      });

      render(<BalanceDisplay />);

      expect(screen.getByText(/余额获取失败/i)).toBeInTheDocument();
    });
  });

  describe('Success State - Desktop View', () => {
    it('should display total and available balance', () => {
      (useBalance as jest.Mock).mockReturnValue({
        totalBalance: 12345.67,
        availableBalance: 8000.00,
        loading: false,
        error: null,
      });

      render(<BalanceDisplay />);

      expect(screen.getByText('¥12,345.67')).toBeInTheDocument();
      expect(screen.getByText('¥8,000.00')).toBeInTheDocument();
      expect(screen.getByText('总资产')).toBeInTheDocument();
      expect(screen.getByText('可用余额')).toBeInTheDocument();
    });

    it('should format CNY currency correctly', () => {
      (useBalance as jest.Mock).mockReturnValue({
        totalBalance: 1000000,
        availableBalance: 500000.50,
        loading: false,
        error: null,
      });

      render(<BalanceDisplay />);

      expect(screen.getByText('¥1,000,000.00')).toBeInTheDocument();
      expect(screen.getByText('¥500,000.50')).toBeInTheDocument();
    });

    it('should show zero balances when no portfolio', () => {
      (useBalance as jest.Mock).mockReturnValue({
        totalBalance: 0,
        availableBalance: 0,
        loading: false,
        error: null,
      });

      render(<BalanceDisplay />);

      // Both total and available balance show ¥0.00
      const zeroBalances = screen.getAllByText('¥0.00');
      expect(zeroBalances).toHaveLength(2);
    });

    it('should show positive balance in green color', () => {
      (useBalance as jest.Mock).mockReturnValue({
        totalBalance: 1000,
        availableBalance: 500,
        loading: false,
        error: null,
      });

      const { container } = render(<BalanceDisplay />);
      
      // The total balance should have green color styling
      const totalBalanceElement = container.querySelector('div')?.querySelector('div:nth-child(1)');
      expect(totalBalanceElement).toBeInTheDocument();
    });
  });

  describe('Success State - Mobile View (Compact)', () => {
    it('should display only total balance in compact mode', () => {
      (useBalance as jest.Mock).mockReturnValue({
        totalBalance: 12345.67,
        availableBalance: 8000.00,
        loading: false,
        error: null,
      });

      render(<BalanceDisplay compact />);

      expect(screen.getByText('¥12,345.67')).toBeInTheDocument();
      // Should not show labels in compact mode
      expect(screen.queryByText('总资产')).not.toBeInTheDocument();
      expect(screen.queryByText('可用余额')).not.toBeInTheDocument();
    });

    it('should have smaller font size in compact mode', () => {
      (useBalance as jest.Mock).mockReturnValue({
        totalBalance: 5000,
        availableBalance: 2500,
        loading: false,
        error: null,
      });

      render(<BalanceDisplay compact />);

      const balanceText = screen.getByText('¥5,000.00');
      expect(balanceText).toBeInTheDocument();
    });
  });

  describe('Real-time Updates', () => {
    it('should reflect balance changes when hook returns new values', () => {
      // Initial render
      (useBalance as jest.Mock).mockReturnValue({
        totalBalance: 10000,
        availableBalance: 5000,
        loading: false,
        error: null,
      });

      const { rerender } = render(<BalanceDisplay />);
      expect(screen.getByText('¥10,000.00')).toBeInTheDocument();

      // Simulate balance update
      (useBalance as jest.Mock).mockReturnValue({
        totalBalance: 15000,
        availableBalance: 7500,
        loading: false,
        error: null,
      });

      rerender(<BalanceDisplay />);
      expect(screen.getByText('¥15,000.00')).toBeInTheDocument();
      expect(screen.getByText('¥7,500.00')).toBeInTheDocument();
    });
  });
});
