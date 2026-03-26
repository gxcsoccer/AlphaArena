/**
 * PricingPage Tests
 * Issue #638: VIP 订阅管理 UI
 */

import React from 'react';
import { render, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import PricingPage from '../PricingPage';

// Mock fetch
const mockFetch = jest.fn();
global.fetch = mockFetch as any;

const renderWithProviders = (component: React.ReactElement) => {
  return render(
    <BrowserRouter>
      {component}
    </BrowserRouter>
  );
};

describe('PricingPage', () => {
  beforeEach(() => {
    mockFetch.mockClear();
    localStorage.clear();
  });

  it('renders loading state initially', () => {
    mockFetch.mockImplementation(() => new Promise(() => {})); // Never resolves
    renderWithProviders(<PricingPage />);
    // Check for spinner/loading indicator
    const spinner = document.querySelector('.arco-spin');
    expect(spinner).toBeInTheDocument();
  });

  it('renders page container', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ plans: [] }),
    });

    renderWithProviders(<PricingPage />);

    await waitFor(() => {
      // Check that the page container is rendered
      const container = document.querySelector('[style*="min-height"]');
      expect(container).toBeTruthy();
    });
  });

  it('renders plan cards', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ plans: [] }),
    });

    renderWithProviders(<PricingPage />);

    // Wait for loading to complete
    await waitFor(() => {
      const spinner = document.querySelector('.arco-spin-loading');
      expect(spinner).toBeFalsy();
    });

    // Check that cards are rendered
    await waitFor(() => {
      const cards = document.querySelectorAll('.arco-card');
      expect(cards.length).toBeGreaterThanOrEqual(3);
    });
  });
});