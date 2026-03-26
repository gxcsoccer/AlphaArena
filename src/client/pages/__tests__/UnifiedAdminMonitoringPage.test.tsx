/**
 * Tests for UnifiedAdminMonitoringPage
 * Issue #660: 监控仪表盘可视化完善 - Admin 后台集成
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';

// Mock fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

// Mock localStorage
const mockLocalStorage = {
  getItem: jest.fn(() => 'mock-token'),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
  length: 0,
  key: jest.fn(),
};
Object.defineProperty(window, 'localStorage', { value: mockLocalStorage });

// Mock window.innerWidth
Object.defineProperty(window, 'innerWidth', {
  writable: true,
  configurable: true,
  value: 1024,
});

// Mock window.matchMedia only if not already defined
if (!window.matchMedia) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: jest.fn().mockImplementation(query => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: jest.fn(),
      removeListener: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    })),
  });
}

// Import the component after mocking
import UnifiedAdminMonitoringPage from '../UnifiedAdminMonitoringPage';

// Helper to render with router
const renderWithRouter = (component: React.ReactNode) => {
  return render(
    <BrowserRouter>
      {component}
    </BrowserRouter>
  );
};

describe('UnifiedAdminMonitoringPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch.mockReset();
  });

  it('renders the page header', async () => {
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('/api/apm/summary')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            success: true,
            data: { totalErrors: 0, criticalErrors: 0, avgApiLatency: 100, p95Latency: 200, errorRate: 0 },
          }),
        });
      }
      if (url.includes('/api/payment-monitoring/summary')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            success: true,
            data: { successRate: 98, totalPayments: 100, totalRevenue: 10000, activeAlerts: 0 },
          }),
        });
      }
      if (url.includes('/api/business-metrics/summary')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            success: true,
            data: { dau: 500, mau: 5000, stickiness: 10, mrr: 50000, mrrGrowth: 5, conversionRate: 2 },
          }),
        });
      }
      return Promise.resolve({ ok: false });
    });

    renderWithRouter(<UnifiedAdminMonitoringPage />);

    await waitFor(() => {
      expect(screen.getByText('统一监控仪表盘')).toBeInTheDocument();
    });
  });

  it('displays system health indicator', async () => {
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('/api/apm/summary')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            success: true,
            data: { totalErrors: 0, criticalErrors: 0, avgApiLatency: 100, p95Latency: 200, errorRate: 0 },
          }),
        });
      }
      if (url.includes('/api/payment-monitoring/summary')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            success: true,
            data: { successRate: 98, totalPayments: 100, totalRevenue: 10000, activeAlerts: 0 },
          }),
        });
      }
      if (url.includes('/api/business-metrics/summary')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            success: true,
            data: { dau: 500, mau: 5000, stickiness: 10, mrr: 50000, mrrGrowth: 5, conversionRate: 2 },
          }),
        });
      }
      return Promise.resolve({ ok: false });
    });

    renderWithRouter(<UnifiedAdminMonitoringPage />);

    await waitFor(() => {
      expect(screen.getByText('系统健康')).toBeInTheDocument();
    });
  });

  it('displays key metrics (DAU, MRR, etc.)', async () => {
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('/api/apm/summary')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            success: true,
            data: { totalErrors: 5, criticalErrors: 1, avgApiLatency: 150, p95Latency: 300, errorRate: 0.1 },
          }),
        });
      }
      if (url.includes('/api/payment-monitoring/summary')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            success: true,
            data: { successRate: 92, totalPayments: 200, totalRevenue: 20000, activeAlerts: 2 },
          }),
        });
      }
      if (url.includes('/api/business-metrics/summary')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            success: true,
            data: { dau: 800, mau: 8000, stickiness: 10, mrr: 80000, mrrGrowth: 8, conversionRate: 3 },
          }),
        });
      }
      return Promise.resolve({ ok: false });
    });

    renderWithRouter(<UnifiedAdminMonitoringPage />);

    await waitFor(() => {
      expect(screen.getByText('DAU')).toBeInTheDocument();
      expect(screen.getByText('MRR')).toBeInTheDocument();
      expect(screen.getByText('支付成功率')).toBeInTheDocument();
      expect(screen.getByText('API 平均延迟')).toBeInTheDocument();
    });
  });

  it('displays quick navigation cards', async () => {
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('/api/apm/summary')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            success: true,
            data: { totalErrors: 0, criticalErrors: 0, avgApiLatency: 100, p95Latency: 200, errorRate: 0 },
          }),
        });
      }
      if (url.includes('/api/payment-monitoring/summary')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            success: true,
            data: { successRate: 98, totalPayments: 100, totalRevenue: 10000, activeAlerts: 0 },
          }),
        });
      }
      if (url.includes('/api/business-metrics/summary')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            success: true,
            data: { dau: 500, mau: 5000, stickiness: 10, mrr: 50000, mrrGrowth: 5, conversionRate: 2 },
          }),
        });
      }
      return Promise.resolve({ ok: false });
    });

    renderWithRouter(<UnifiedAdminMonitoringPage />);

    await waitFor(() => {
      expect(screen.getByText('APM 监控')).toBeInTheDocument();
      expect(screen.getByText('支付监控')).toBeInTheDocument();
      expect(screen.getByText('业务指标')).toBeInTheDocument();
      expect(screen.getByText('收入分析')).toBeInTheDocument();
    });
  });

  it('shows critical alerts banner when there are critical alerts', async () => {
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('/api/apm/summary')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            success: true,
            data: { totalErrors: 10, criticalErrors: 3, avgApiLatency: 600, p95Latency: 1200, errorRate: 1 },
          }),
        });
      }
      if (url.includes('/api/payment-monitoring/summary')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            success: true,
            data: { successRate: 85, totalPayments: 100, totalRevenue: 10000, activeAlerts: 5 },
          }),
        });
      }
      if (url.includes('/api/business-metrics/summary')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            success: true,
            data: { dau: 500, mau: 5000, stickiness: 10, mrr: 50000, mrrGrowth: -5, conversionRate: 2 },
          }),
        });
      }
      return Promise.resolve({ ok: false });
    });

    renderWithRouter(<UnifiedAdminMonitoringPage />);

    await waitFor(() => {
      expect(screen.getByText(/个严重告警需要立即处理/)).toBeInTheDocument();
    });
  });

  it('displays tabs for different views', async () => {
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('/api/apm/summary')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            success: true,
            data: { totalErrors: 0, criticalErrors: 0, avgApiLatency: 100, p95Latency: 200, errorRate: 0 },
          }),
        });
      }
      if (url.includes('/api/payment-monitoring/summary')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            success: true,
            data: { successRate: 98, totalPayments: 100, totalRevenue: 10000, activeAlerts: 0 },
          }),
        });
      }
      if (url.includes('/api/business-metrics/summary')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            success: true,
            data: { dau: 500, mau: 5000, stickiness: 10, mrr: 50000, mrrGrowth: 5, conversionRate: 2 },
          }),
        });
      }
      return Promise.resolve({ ok: false });
    });

    renderWithRouter(<UnifiedAdminMonitoringPage />);

    // Wait for the page to load and tabs to appear
    await waitFor(() => {
      expect(screen.getByText('监控面板导航')).toBeInTheDocument();
    }, { timeout: 3000 });

    // Check for tabs
    await waitFor(() => {
      const tabs = screen.getAllByRole('tab');
      expect(tabs.length).toBeGreaterThan(0);
    }, { timeout: 3000 });
  });
});