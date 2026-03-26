/**
 * BillingHistoryPage Tests
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import BillingHistoryPage from '../BillingHistoryPage';

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
}));

// Mock useAuth
jest.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({
    isAuthenticated: true,
  }),
}));

// Mock useNavigate
const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}));

const renderWithRouter = (component: React.ReactElement) => {
  return render(
    <MemoryRouter>
      {component}
    </MemoryRouter>
  );
};

describe('BillingHistoryPage', () => {
  beforeEach(() => {
    (global.fetch as jest.Mock).mockClear();
    (global.fetch as jest.Mock).mockImplementation((url: string) => {
      if (url.includes('/history')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ history: [] }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({}),
      });
    });
  });

  it('renders billing history page', async () => {
    renderWithRouter(<BillingHistoryPage />);
    
    await waitFor(() => {
      expect(screen.getByText('账单与支付')).toBeInTheDocument();
    });
  });

  it('displays payment methods section', async () => {
    renderWithRouter(<BillingHistoryPage />);
    
    await waitFor(() => {
      expect(screen.getByText('支付方式')).toBeInTheDocument();
    });
  });

  it('displays billing history section', async () => {
    renderWithRouter(<BillingHistoryPage />);
    
    await waitFor(() => {
      expect(screen.getByText('账单历史')).toBeInTheDocument();
    });
  });

  it('shows empty state when no payment methods', async () => {
    renderWithRouter(<BillingHistoryPage />);
    
    await waitFor(() => {
      expect(screen.getByText('暂无支付方式')).toBeInTheDocument();
    });
  });

  it('shows empty state when no billing history', async () => {
    renderWithRouter(<BillingHistoryPage />);
    
    await waitFor(() => {
      expect(screen.getByText('暂无账单记录')).toBeInTheDocument();
    });
  });

  it('displays help section', async () => {
    renderWithRouter(<BillingHistoryPage />);
    
    await waitFor(() => {
      expect(screen.getByText('需要帮助？')).toBeInTheDocument();
    });
  });
});