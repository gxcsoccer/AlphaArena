/**
 * SubscriptionStatus Component Tests
 * Issue #638: VIP 订阅管理 UI
 */

import React from 'react';
import { render, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import SubscriptionStatus from '../SubscriptionStatus';

// Mock useSubscription hook
jest.mock('../../hooks/useSubscription', () => ({
  useSubscription: jest.fn(),
  usePlan: jest.fn(),
}));

import { useSubscription, usePlan } from '../../hooks/useSubscription';

const mockUseSubscription = useSubscription as jest.MockedFunction<typeof useSubscription>;
const mockUsePlan = usePlan as jest.MockedFunction<typeof usePlan>;

const renderWithProviders = (component: React.ReactElement) => {
  return render(
    <BrowserRouter>
      {component}
    </BrowserRouter>
  );
};

describe('SubscriptionStatus', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders loading state', () => {
    mockUseSubscription.mockReturnValue({
      subscription: null,
      loading: true,
      error: null,
      plan: 'free',
      features: null,
      limits: null,
      isActive: false,
      isTrial: false,
      daysUntilExpiry: null,
      refresh: jest.fn(),
      checkFeatureAccess: jest.fn(),
      checkMultipleFeatures: jest.fn(),
      checkFeatureLimit: jest.fn(),
      incrementFeatureUsage: jest.fn(),
    } as any);

    mockUsePlan.mockReturnValue({
      plan: 'free',
      isFree: true,
      isPro: false,
      isEnterprise: false,
      isAtLeast: jest.fn(),
    });

    renderWithProviders(<SubscriptionStatus />);
    // Check for spinner
    const spinner = document.querySelector('.arco-spin');
    expect(spinner).toBeInTheDocument();
  });

  it('renders card when loaded', async () => {
    mockUseSubscription.mockReturnValue({
      subscription: null,
      loading: false,
      error: null,
      plan: 'free',
      features: null,
      limits: null,
      isActive: false,
      isTrial: false,
      daysUntilExpiry: null,
      refresh: jest.fn(),
      checkFeatureAccess: jest.fn(),
      checkMultipleFeatures: jest.fn(),
      checkFeatureLimit: jest.fn(),
      incrementFeatureUsage: jest.fn(),
    } as any);

    mockUsePlan.mockReturnValue({
      plan: 'free',
      isFree: true,
      isPro: false,
      isEnterprise: false,
      isAtLeast: jest.fn(),
    });

    renderWithProviders(<SubscriptionStatus />);

    await waitFor(() => {
      const card = document.querySelector('.arco-card');
      expect(card).toBeInTheDocument();
    });
  });

  it('renders compact version', async () => {
    mockUseSubscription.mockReturnValue({
      subscription: null,
      loading: false,
      error: null,
      plan: 'free',
      features: null,
      limits: null,
      isActive: false,
      isTrial: false,
      daysUntilExpiry: null,
      refresh: jest.fn(),
      checkFeatureAccess: jest.fn(),
      checkMultipleFeatures: jest.fn(),
      checkFeatureLimit: jest.fn(),
      incrementFeatureUsage: jest.fn(),
    } as any);

    mockUsePlan.mockReturnValue({
      plan: 'free',
      isFree: true,
      isPro: false,
      isEnterprise: false,
      isAtLeast: jest.fn(),
    });

    const { container } = renderWithProviders(<SubscriptionStatus compact />);

    await waitFor(() => {
      // Compact version should not have a card, but should have content
      expect(container.firstChild).toBeTruthy();
    });
  });
});