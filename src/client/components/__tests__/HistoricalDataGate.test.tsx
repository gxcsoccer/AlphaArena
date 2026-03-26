/**
 * Tests for HistoricalDataGate Component
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HistoricalDataGate, useHistoricalDataLimit, DateRangeSelector } from '../HistoricalDataGate';

// Mock useSubscription
const mockUsePlan = jest.fn();
const mockUseSubscription = jest.fn();

jest.mock('../../hooks/useSubscription', () => ({
  usePlan: () => mockUsePlan(),
  useSubscription: () => mockUseSubscription(),
}));

describe('useHistoricalDataLimit', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 7 days for free plan', () => {
    mockUsePlan.mockReturnValue({ plan: 'free', isFree: true, isPro: false, isEnterprise: false });
    
    const { result } = renderHook(() => useHistoricalDataLimit());
    
    expect(result.current.maxDays).toBe(7);
    expect(result.current.isLimited).toBe(true);
    expect(result.current.planName).toBe('Free');
  });

  it('returns 30 days for pro plan', () => {
    mockUsePlan.mockReturnValue({ plan: 'pro', isFree: false, isPro: true, isEnterprise: false });
    
    const { result } = renderHook(() => useHistoricalDataLimit());
    
    expect(result.current.maxDays).toBe(30);
    expect(result.current.isLimited).toBe(true);
    expect(result.current.planName).toBe('Pro');
  });

  it('returns unlimited for enterprise plan', () => {
    mockUsePlan.mockReturnValue({ plan: 'enterprise', isFree: false, isPro: false, isEnterprise: true });
    
    const { result } = renderHook(() => useHistoricalDataLimit());
    
    expect(result.current.maxDays).toBe(-1);
    expect(result.current.isLimited).toBe(false);
    expect(result.current.planName).toBe('Enterprise');
  });

  it('canAccessDays works correctly', () => {
    mockUsePlan.mockReturnValue({ plan: 'free', isFree: true, isPro: false, isEnterprise: false });
    
    const { result } = renderHook(() => useHistoricalDataLimit());
    
    expect(result.current.canAccessDays(5)).toBe(true);
    expect(result.current.canAccessDays(7)).toBe(true);
    expect(result.current.canAccessDays(10)).toBe(false);
  });

  it('limitDateRange clamps dates correctly', () => {
    mockUsePlan.mockReturnValue({ plan: 'pro', isFree: false, isPro: true, isEnterprise: false });
    
    const { result } = renderHook(() => useHistoricalDataLimit());
    
    const now = new Date();
    const start = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000); // 60 days ago
    const end = now;
    
    const limited = result.current.limitDateRange(start, end);
    
    // Start should be clamped to 30 days ago
    const expectedStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    expect(limited.start.toDateString()).toBe(expectedStart.toDateString());
    expect(limited.end).toBe(end);
  });
});

describe('HistoricalDataGate', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUsePlan.mockReturnValue({ plan: 'pro', isFree: false, isPro: true, isEnterprise: false });
    mockUseSubscription.mockReturnValue({
      plan: 'pro',
      isPro: true,
      subscription: { plan: 'pro' },
      loading: false,
    });
  });

  it('renders children correctly', () => {
    render(
      <HistoricalDataGate>
        <div data-testid="child">Child Content</div>
      </HistoricalDataGate>
    );
    
    expect(screen.getByTestId('child')).toBeInTheDocument();
  });

  it('displays current plan info', () => {
    render(<HistoricalDataGate />);
    
    expect(screen.getByText(/当前套餐/)).toBeInTheDocument();
    expect(screen.getByText('Pro')).toBeInTheDocument();
    expect(screen.getByText(/历史数据范围/)).toBeInTheDocument();
  });

  it('shows upgrade button for limited plans', () => {
    mockUsePlan.mockReturnValue({ plan: 'free', isFree: true, isPro: false, isEnterprise: false });
    
    render(<HistoricalDataGate />);
    
    expect(screen.getByText('升级获取更多数据')).toBeInTheDocument();
  });

  it('does not show upgrade button for enterprise', () => {
    mockUsePlan.mockReturnValue({ plan: 'enterprise', isFree: false, isPro: false, isEnterprise: true });
    
    render(<HistoricalDataGate />);
    
    expect(screen.queryByText('升级获取更多数据')).not.toBeInTheDocument();
  });

  it('shows warning when requested days exceed limit', () => {
    mockUsePlan.mockReturnValue({ plan: 'free', isFree: true, isPro: false, isEnterprise: false });
    
    render(<HistoricalDataGate requestedDays={30} />);
    
    expect(screen.getByText('数据范围限制')).toBeInTheDocument();
    expect(screen.getByText(/您当前的 Free 套餐仅支持 7 天历史数据/)).toBeInTheDocument();
  });

  it('calls onRequestUpgrade when upgrade button clicked', async () => {
    const onRequestUpgrade = jest.fn();
    mockUsePlan.mockReturnValue({ plan: 'free', isFree: true, isPro: false, isEnterprise: false });
    
    const user = userEvent.setup();
    render(<HistoricalDataGate onRequestUpgrade={onRequestUpgrade} />);
    
    const upgradeButton = screen.getByText('升级获取更多数据');
    await user.click(upgradeButton);
    
    expect(onRequestUpgrade).toHaveBeenCalled();
  });

  it('calls onDateRangeLimited when days exceed limit', () => {
    const onDateRangeLimited = jest.fn();
    mockUsePlan.mockReturnValue({ plan: 'free', isFree: true, isPro: false, isEnterprise: false });
    
    render(<HistoricalDataGate requestedDays={30} onDateRangeLimited={onDateRangeLimited} />);
    
    expect(onDateRangeLimited).toHaveBeenCalledWith(7);
  });

  it('displays correct limit for pro plan', () => {
    render(<HistoricalDataGate />);
    
    expect(screen.getByText('30 天')).toBeInTheDocument();
  });
});

describe('DateRangeSelector', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUsePlan.mockReturnValue({ plan: 'pro', isFree: false, isPro: true, isEnterprise: false });
  });

  it('renders date picker correctly', () => {
    render(<DateRangeSelector />);
    
    // DatePicker should be rendered
    expect(screen.getByRole('application') || document.querySelector('.arco-picker')).toBeTruthy();
  });

  it('shows limit tag for limited plans', () => {
    render(<DateRangeSelector />);
    
    expect(screen.getByText(/限制 30 天/)).toBeInTheDocument();
  });

  it('shows unlimited tag for enterprise', () => {
    mockUsePlan.mockReturnValue({ plan: 'enterprise', isFree: false, isPro: false, isEnterprise: true });
    
    render(<DateRangeSelector />);
    
    expect(screen.getByText('无限制')).toBeInTheDocument();
  });

  it('can be disabled', () => {
    render(<DateRangeSelector disabled />);
    
    const picker = document.querySelector('.arco-picker-disabled');
    expect(picker).toBeTruthy();
  });

  it('calls onChange when date selected', async () => {
    const onChange = jest.fn();
    render(<DateRangeSelector onChange={onChange} />);
    
    // Date selection testing would require more complex setup
    // This is a placeholder for integration testing
  });
});

// Helper function to test hooks
function renderHook<T>(callback: () => T): { result: { current: T } } {
  let result: T;
  
  function TestComponent() {
    result = callback();
    return null;
  }
  
  render(<TestComponent />);
  
  return { result: { current: result! } };
}