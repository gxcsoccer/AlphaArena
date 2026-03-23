/**
 * Tests for User Behavior Analytics Dashboard Page
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import UserBehaviorAnalyticsPage from '../UserBehaviorAnalyticsPage';

// Mock useAuth hook
jest.mock('../../hooks/useAuth', () => ({
  useAuth: jest.fn(() => ({
    user: { id: 'test-user', email: 'test@example.com' },
    isAuthenticated: true,
  })),
}));

// Mock fetch
const mockFetch = jest.fn();
global.fetch = mockFetch as any;

describe('UserBehaviorAnalyticsPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock successful API responses
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('/api/user-analytics/dashboard')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            success: true,
            data: {
              overview: {
                northStar: { name: 'DAU', value: 100, trend: 5, unit: '' },
                metrics: {},
              },
              funnels: {
                signupToTrade: {
                  name: '注册到交易',
                  steps: [
                    { name: '注册', order: 0, count: 100, conversionRate: 100, dropOffRate: 0 },
                    { name: '首次登录', order: 1, count: 80, conversionRate: 80, dropOffRate: 20 },
                    { name: '首次交易', order: 2, count: 50, conversionRate: 62.5, dropOffRate: 37.5 },
                  ],
                  totalUsers: 100,
                  completedUsers: 50,
                  overallConversionRate: 50,
                },
                strategyExecution: {
                  name: '策略执行',
                  steps: [],
                  totalUsers: 0,
                  completedUsers: 0,
                  overallConversionRate: 0,
                },
                subscriptionConversion: {
                  name: '订阅转化',
                  steps: [],
                  totalUsers: 0,
                  completedUsers: 0,
                  overallConversionRate: 0,
                },
              },
              featureUsage: [
                { feature: '策略创建', category: 'strategy', usageCount: 500, uniqueUsers: 50 },
                { feature: '回测运行', category: 'backtest', usageCount: 300, uniqueUsers: 30 },
              ],
              heatmap: {
                type: 'hourly',
                data: Array.from({ length: 168 }, (_, i) => ({
                  hour: i % 24,
                  day: Math.floor(i / 24),
                  value: Math.floor(Math.random() * 100),
                  normalizedValue: Math.floor(Math.random() * 100),
                })),
                maxValue: 100,
                minValue: 0,
              },
              realTime: {
                activeUsers: 10,
                pageViewsLastHour: 500,
                eventsLastHour: 1000,
                topPages: [
                  { url: '/dashboard', views: 100 },
                  { url: '/strategies', views: 80 },
                ],
                topEvents: [
                  { type: 'page_view', count: 500 },
                  { type: 'button_click', count: 200 },
                ],
                timestamp: new Date().toISOString(),
              },
            },
          }),
        });
      }
      
      if (url.includes('/api/user-analytics/engagement')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            success: true,
            data: {
              dau: 100,
              wau: 500,
              mau: 1500,
              stickiness: 6.7,
              retention: { day1: 40, day7: 25, day30: 10 },
              avgSessionDuration: 300,
              avgSessionsPerUser: 2.5,
            },
          }),
        });
      }
      
      if (url.includes('/api/user-analytics/page-views')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            success: true,
            data: [
              { url: '/dashboard', views: 1000, uniqueVisitors: 500 },
              { url: '/strategies', views: 800, uniqueVisitors: 400 },
            ],
          }),
        });
      }
      
      return Promise.resolve({
        ok: false,
        json: () => Promise.resolve({ error: 'Not found' }),
      });
    });
  });

  it('renders the page title', async () => {
    render(<UserBehaviorAnalyticsPage />);
    
    expect(screen.getByText('用户行为分析仪表板')).toBeInTheDocument();
  });

  it('shows loading state initially', () => {
    render(<UserBehaviorAnalyticsPage />);
    
    // The page should show loading spinners initially
    const spinners = document.querySelectorAll('.arco-spin');
    expect(spinners.length).toBeGreaterThan(0);
  });

  it('fetches dashboard data on mount', async () => {
    render(<UserBehaviorAnalyticsPage />);
    
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/user-analytics/dashboard?days=7');
    });
  });

  it('fetches engagement metrics on mount', async () => {
    render(<UserBehaviorAnalyticsPage />);
    
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/user-analytics/engagement?days=7');
    });
  });

  it('fetches page views on mount', async () => {
    render(<UserBehaviorAnalyticsPage />);
    
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/user-analytics/page-views?days=7&limit=20');
    });
  });

  it('displays key metrics after loading', async () => {
    render(<UserBehaviorAnalyticsPage />);
    
    await waitFor(() => {
      expect(screen.getByText('日活跃用户 (DAU)')).toBeInTheDocument();
      expect(screen.getByText('月活跃用户 (MAU)')).toBeInTheDocument();
      expect(screen.getByText('粘性系数 (DAU/MAU)')).toBeInTheDocument();
      expect(screen.getByText('平均会话时长')).toBeInTheDocument();
    });
  });

  it('displays tabs for different views', async () => {
    render(<UserBehaviorAnalyticsPage />);
    
    await waitFor(() => {
      expect(screen.getByText('概览')).toBeInTheDocument();
      expect(screen.getByText('漏斗分析')).toBeInTheDocument();
      expect(screen.getByText('活跃度热力图')).toBeInTheDocument();
      expect(screen.getByText('页面分析')).toBeInTheDocument();
    });
  });

  it('shows refresh button', async () => {
    render(<UserBehaviorAnalyticsPage />);
    
    await waitFor(() => {
      expect(screen.getByText('刷新')).toBeInTheDocument();
    });
  });

  it('shows export button', async () => {
    render(<UserBehaviorAnalyticsPage />);
    
    await waitFor(() => {
      expect(screen.getByText('导出报告')).toBeInTheDocument();
    });
  });

  it('allows changing time range', async () => {
    render(<UserBehaviorAnalyticsPage />);
    
    await waitFor(() => {
      expect(screen.getByText('最近7天')).toBeInTheDocument();
    });
    
    // Verify time range selector is present
    const selectElement = document.querySelector('.arco-select');
    expect(selectElement).toBeTruthy();
  });

  it('handles API errors gracefully', async () => {
    mockFetch.mockImplementation(() => 
      Promise.resolve({
        ok: false,
        json: () => Promise.resolve({ error: 'API Error' }),
      })
    );
    
    render(<UserBehaviorAnalyticsPage />);
    
    // Page should still render even with API errors
    await waitFor(() => {
      expect(screen.getByText('用户行为分析仪表板')).toBeInTheDocument();
    });
  });
});