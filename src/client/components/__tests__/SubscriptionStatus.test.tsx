/**
 * SubscriptionStatus Component Tests
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import SubscriptionStatus from '../SubscriptionStatus';

// Mock useTranslation
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback: string) => fallback,
  }),
}));

// Mock useSubscription hook
jest.mock('../../hooks/useSubscription', () => ({
  useSubscription: () => ({
    subscription: {
      plan: 'pro',
      status: 'active',
      planName: '专业版',
      billing_period: 'monthly',
      current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      cancel_at_period_end: false,
      limits: {
        concurrentStrategies: 10,
        dailyBacktests: -1,
        apiCalls: 10000,
      },
    },
    loading: false,
    daysUntilExpiry: 30,
    refresh: jest.fn(),
  }),
  usePlan: () => ({
    plan: 'pro',
    isFree: false,
    isPro: true,
    isEnterprise: false,
    isAtLeast: jest.fn().mockReturnValue(true),
  }),
}));

const renderWithRouter = (component: React.ReactElement) => {
  return render(
    <MemoryRouter>
      {component}
    </MemoryRouter>
  );
};

describe('SubscriptionStatus', () => {
  it('renders subscription status card', () => {
    renderWithRouter(<SubscriptionStatus />);
    
    expect(screen.getByText('专业版')).toBeInTheDocument();
    expect(screen.getByText('活跃')).toBeInTheDocument();
  });

  it('displays manage subscription button for paid plans', () => {
    renderWithRouter(<SubscriptionStatus />);
    
    expect(screen.getByText('管理订阅')).toBeInTheDocument();
  });

  it('shows billing period info', () => {
    renderWithRouter(<SubscriptionStatus />);
    
    expect(screen.getByText('计费周期')).toBeInTheDocument();
  });

  it('shows next billing date', () => {
    renderWithRouter(<SubscriptionStatus />);
    
    expect(screen.getByText('下次计费')).toBeInTheDocument();
  });

  it('shows days remaining', () => {
    renderWithRouter(<SubscriptionStatus />);
    
    expect(screen.getByText('剩余天数')).toBeInTheDocument();
  });
});

describe('SubscriptionStatus - Free Plan', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.doMock('../../hooks/useSubscription', () => ({
      useSubscription: () => ({
        subscription: null,
        loading: false,
        daysUntilExpiry: null,
        refresh: jest.fn(),
      }),
      usePlan: () => ({
        plan: 'free',
        isFree: true,
        isPro: false,
        isEnterprise: false,
        isAtLeast: jest.fn().mockReturnValue(false),
      }),
    }));
  });

  it('shows upgrade button for free plan', async () => {
    // Re-import after mock
    const SubscriptionStatusFree = require('../SubscriptionStatus').default;
    
    renderWithRouter(<SubscriptionStatusFree />);
    
    await waitFor(() => {
      expect(screen.getByText('免费版')).toBeInTheDocument();
    });
  });
});

describe('SubscriptionStatus - Compact Mode', () => {
  it('renders compact version', () => {
    renderWithRouter(<SubscriptionStatus compact />);
    
    expect(screen.getByText('专业版')).toBeInTheDocument();
  });
});