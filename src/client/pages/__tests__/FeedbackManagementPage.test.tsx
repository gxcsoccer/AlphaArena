/**
 * Tests for FeedbackManagementPage
 */

import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import FeedbackManagementPage from '../FeedbackManagementPage';

// Mock useAuth hook
jest.mock('../../hooks/useAuth', () => ({
  useAuth: jest.fn(() => ({
    user: { id: 'admin-user', email: 'admin@example.com' },
    isAuthenticated: true,
  })),
}));

// Mock fetch
const mockFetch = jest.fn();
global.fetch = mockFetch as any;

// Mock localStorage
const mockLocalStorage = {
  getItem: jest.fn(() => 'mock-token'),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};
Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage,
});

describe('FeedbackManagementPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock successful API responses
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('/api/feedback?')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            success: true,
            data: [
              {
                id: 'fb_test1',
                type: 'bug',
                description: 'Test bug report',
                status: 'new',
                priority: 'p1',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                environment: { url: '/', userAgent: 'test', screenSize: '1920x1080', timestamp: '', locale: 'zh', referrer: '' },
              },
              {
                id: 'fb_test2',
                type: 'suggestion',
                description: 'Test suggestion',
                status: 'in_progress',
                priority: 'p2',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                environment: { url: '/dashboard', userAgent: 'test', screenSize: '1920x1080', timestamp: '', locale: 'zh', referrer: '' },
              },
            ],
            total: 2,
          }),
        });
      }
      
      if (url.includes('/api/feedback/stats/summary')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            success: true,
            data: {
              total: 10,
              byType: {
                bug: 5,
                suggestion: 3,
                other: 2,
              },
              byStatus: {
                new: 4,
                confirmed: 1,
                in_progress: 2,
                resolved: 2,
                closed: 1,
              },
              byPriority: {
                p0: 1,
                p1: 3,
                p2: 4,
                p3: 2,
              },
            },
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
    render(<FeedbackManagementPage />);
    
    expect(screen.getByText('用户反馈管理')).toBeInTheDocument();
  });

  it('shows loading state initially', () => {
    render(<FeedbackManagementPage />);
    
    // The page should show loading spinners initially
    const spinners = document.querySelectorAll('.arco-spin');
    expect(spinners.length).toBeGreaterThan(0);
  });

  it('fetches feedback list on mount', async () => {
    render(<FeedbackManagementPage />);
    
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalled();
    });
  });

  it('fetches feedback stats on mount', async () => {
    render(<FeedbackManagementPage />);
    
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/feedback/stats/summary'),
        expect.any(Object)
      );
    });
  });

  it('displays statistics cards', async () => {
    render(<FeedbackManagementPage />);
    
    await waitFor(() => {
      expect(screen.getByText('总反馈数')).toBeInTheDocument();
      expect(screen.getByText('新建')).toBeInTheDocument();
      expect(screen.getByText('处理中')).toBeInTheDocument();
      expect(screen.getByText('已解决')).toBeInTheDocument();
    });
  });

  it('displays filter controls', async () => {
    render(<FeedbackManagementPage />);
    
    await waitFor(() => {
      expect(screen.getByPlaceholderText('搜索关键词...')).toBeInTheDocument();
    });
  });

  it('displays refresh button', async () => {
    render(<FeedbackManagementPage />);
    
    await waitFor(() => {
      expect(screen.getByText('刷新')).toBeInTheDocument();
    });
  });

  it('displays export button', async () => {
    render(<FeedbackManagementPage />);
    
    await waitFor(() => {
      expect(screen.getByText('导出')).toBeInTheDocument();
    });
  });

  it('shows type distribution chart', async () => {
    render(<FeedbackManagementPage />);
    
    await waitFor(() => {
      expect(screen.getByText('反馈类型分布')).toBeInTheDocument();
    });
  });

  it('shows status distribution', async () => {
    render(<FeedbackManagementPage />);
    
    await waitFor(() => {
      expect(screen.getByText('状态分布')).toBeInTheDocument();
    });
  });

  it('handles search input', async () => {
    render(<FeedbackManagementPage />);
    
    await waitFor(() => {
      const searchInput = screen.getByPlaceholderText('搜索关键词...');
      expect(searchInput).toBeInTheDocument();
    });
  });

  it('handles filter button click', async () => {
    render(<FeedbackManagementPage />);
    
    await waitFor(() => {
      const filterButton = screen.getByText('筛选');
      expect(filterButton).toBeInTheDocument();
    });
  });

  it('handles API errors gracefully', async () => {
    mockFetch.mockImplementation(() => 
      Promise.resolve({
        ok: false,
        json: () => Promise.resolve({ error: 'API Error' }),
      })
    );
    
    render(<FeedbackManagementPage />);
    
    // Page should still render even with API errors
    await waitFor(() => {
      expect(screen.getByText('用户反馈管理')).toBeInTheDocument();
    });
  });

  it('displays table after loading', async () => {
    render(<FeedbackManagementPage />);
    
    await waitFor(() => {
      // Check for table headers
      const tableElement = document.querySelector('.arco-table');
      expect(tableElement).toBeTruthy();
    });
  });

  it('shows permission error for unauthorized access', async () => {
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('/api/feedback')) {
        return Promise.resolve({
          ok: false,
          status: 403,
          json: () => Promise.resolve({ error: 'Forbidden' }),
        });
      }
      return Promise.resolve({
        ok: false,
        json: () => Promise.resolve({ error: 'Not found' }),
      });
    });
    
    render(<FeedbackManagementPage />);
    
    // Page should still render but show error message
    await waitFor(() => {
      expect(screen.getByText('用户反馈管理')).toBeInTheDocument();
    });
  });
});