/**
 * PricingPage Tests
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import PricingPage from '../PricingPage';

// Mock fetch
global.fetch = jest.fn();

// Mock useTranslation
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback: string) => fallback,
  }),
}));

// Mock useSEO
jest.mock('../../hooks/useSEO', () => ({
  useSEO: jest.fn(),
  PAGE_SEO_CONFIGS: {
    subscription: {
      title: 'Subscription',
      description: 'Subscription page',
    },
  },
}));

const renderWithRouter = (component: React.ReactElement) => {
  return render(
    <MemoryRouter>
      {component}
    </MemoryRouter>
  );
};

describe('PricingPage', () => {
  beforeEach(() => {
    (global.fetch as jest.Mock).mockClear();
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ plans: [] }),
    });
  });

  it('renders pricing plans', async () => {
    renderWithRouter(<PricingPage />);
    
    await waitFor(() => {
      expect(screen.getByText('免费版')).toBeInTheDocument();
      expect(screen.getByText('专业版')).toBeInTheDocument();
      expect(screen.getByText('企业版')).toBeInTheDocument();
    });
  });

  it('displays billing period toggle', async () => {
    renderWithRouter(<PricingPage />);
    
    await waitFor(() => {
      expect(screen.getByText('按月付费')).toBeInTheDocument();
      expect(screen.getByText('按年付费')).toBeInTheDocument();
    });
  });

  it('switches between monthly and yearly billing', async () => {
    renderWithRouter(<PricingPage />);
    
    await waitFor(() => {
      const yearlyButton = screen.getByText('按年付费');
      fireEvent.click(yearlyButton);
    });
    
    // Price should change when switching to yearly
    expect(screen.getByText(/¥990/)).toBeInTheDocument();
  });

  it('shows feature comparison table', async () => {
    renderWithRouter(<PricingPage />);
    
    await waitFor(() => {
      expect(screen.getByText('功能对比')).toBeInTheDocument();
    });
  });

  it('shows FAQ section', async () => {
    renderWithRouter(<PricingPage />);
    
    await waitFor(() => {
      expect(screen.getByText('常见问题')).toBeInTheDocument();
    });
  });

  it('shows popular tag on Pro plan', async () => {
    renderWithRouter(<PricingPage />);
    
    await waitFor(() => {
      expect(screen.getByText('最受欢迎')).toBeInTheDocument();
    });
  });
});