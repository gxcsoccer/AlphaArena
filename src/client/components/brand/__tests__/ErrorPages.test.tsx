/**
 * Tests for ErrorPages Components
 * 
 * Issue #572: Brand Visual Elements
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import {
  NotFoundPage,
  ServerErrorPage,
  NetworkErrorPage,
  PermissionDeniedPage,
  ErrorFallback,
} from '../ErrorPages';

// Mock useNavigate
const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}));

// Wrapper component for router
const RouterWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <BrowserRouter>{children}</BrowserRouter>
);

describe('NotFoundPage (404)', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
  });

  it('renders 404 page with correct title', () => {
    render(
      <RouterWrapper>
        <NotFoundPage />
      </RouterWrapper>
    );
    expect(screen.getByText('页面未找到')).toBeInTheDocument();
  });

  it('renders description text', () => {
    render(
      <RouterWrapper>
        <NotFoundPage />
      </RouterWrapper>
    );
    expect(screen.getByText(/抱歉，您访问的页面不存在/)).toBeInTheDocument();
  });

  it('renders navigation buttons', () => {
    render(
      <RouterWrapper>
        <NotFoundPage />
      </RouterWrapper>
    );
    expect(screen.getByText('返回首页')).toBeInTheDocument();
    expect(screen.getByText('返回上一页')).toBeInTheDocument();
  });

  it('navigates to home when clicking primary button', () => {
    render(
      <RouterWrapper>
        <NotFoundPage />
      </RouterWrapper>
    );
    fireEvent.click(screen.getByText('返回首页'));
    expect(mockNavigate).toHaveBeenCalledWith('/');
  });

  it('navigates back when clicking secondary button', () => {
    render(
      <RouterWrapper>
        <NotFoundPage />
      </RouterWrapper>
    );
    fireEvent.click(screen.getByText('返回上一页'));
    expect(mockNavigate).toHaveBeenCalledWith(-1);
  });

  it('renders illustration', () => {
    const { container } = render(
      <RouterWrapper>
        <NotFoundPage />
      </RouterWrapper>
    );
    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
  });
});

describe('ServerErrorPage (500)', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
  });

  it('renders 500 page with correct title', () => {
    render(
      <RouterWrapper>
        <ServerErrorPage />
      </RouterWrapper>
    );
    expect(screen.getByText('服务器错误')).toBeInTheDocument();
  });

  it('renders description text', () => {
    render(
      <RouterWrapper>
        <ServerErrorPage />
      </RouterWrapper>
    );
    expect(screen.getByText(/服务器遇到了问题/)).toBeInTheDocument();
  });

  it('renders refresh and home buttons', () => {
    render(
      <RouterWrapper>
        <ServerErrorPage />
      </RouterWrapper>
    );
    expect(screen.getByText('刷新页面')).toBeInTheDocument();
    expect(screen.getByText('返回首页')).toBeInTheDocument();
  });

  it('renders illustration', () => {
    const { container } = render(
      <RouterWrapper>
        <ServerErrorPage />
      </RouterWrapper>
    );
    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
  });
});

describe('NetworkErrorPage', () => {
  it('renders network error page with correct title', () => {
    render(
      <RouterWrapper>
        <NetworkErrorPage />
      </RouterWrapper>
    );
    expect(screen.getByText('网络连接失败')).toBeInTheDocument();
  });

  it('renders description text', () => {
    render(
      <RouterWrapper>
        <NetworkErrorPage />
      </RouterWrapper>
    );
    expect(screen.getByText(/无法连接到服务器/)).toBeInTheDocument();
  });

  it('renders retry and status buttons', () => {
    render(
      <RouterWrapper>
        <NetworkErrorPage />
      </RouterWrapper>
    );
    expect(screen.getByText('重试')).toBeInTheDocument();
    expect(screen.getByText('查看服务状态')).toBeInTheDocument();
  });

  it('renders illustration', () => {
    const { container } = render(
      <RouterWrapper>
        <NetworkErrorPage />
      </RouterWrapper>
    );
    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
  });
});

describe('PermissionDeniedPage (403)', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
  });

  it('renders 403 page with correct title', () => {
    render(
      <RouterWrapper>
        <PermissionDeniedPage />
      </RouterWrapper>
    );
    expect(screen.getByText('访问被拒绝')).toBeInTheDocument();
  });

  it('renders description text', () => {
    render(
      <RouterWrapper>
        <PermissionDeniedPage />
      </RouterWrapper>
    );
    expect(screen.getByText(/您没有权限访问此页面/)).toBeInTheDocument();
  });

  it('renders navigation buttons', () => {
    render(
      <RouterWrapper>
        <PermissionDeniedPage />
      </RouterWrapper>
    );
    expect(screen.getByText('返回首页')).toBeInTheDocument();
    expect(screen.getByText('切换账号')).toBeInTheDocument();
  });

  it('renders illustration', () => {
    const { container } = render(
      <RouterWrapper>
        <PermissionDeniedPage />
      </RouterWrapper>
    );
    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
  });
});

describe('ErrorFallback', () => {
  it('renders error fallback with default message', () => {
    render(<ErrorFallback />);
    expect(screen.getByText('出错了')).toBeInTheDocument();
  });

  it('renders error message in development', () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';
    
    render(<ErrorFallback error={new Error('Test error')} />);
    expect(screen.getByText('Test error')).toBeInTheDocument();
    
    process.env.NODE_ENV = originalEnv;
  });

  it('renders retry button', () => {
    render(<ErrorFallback />);
    expect(screen.getByText('重试')).toBeInTheDocument();
  });

  it('renders home button', () => {
    render(<ErrorFallback />);
    expect(screen.getByText('返回首页')).toBeInTheDocument();
  });

  it('calls resetErrorBoundary when retry is clicked', () => {
    const mockReset = jest.fn();
    render(<ErrorFallback resetErrorBoundary={mockReset} />);
    fireEvent.click(screen.getByText('重试'));
    expect(mockReset).toHaveBeenCalled();
  });

  it('renders illustration', () => {
    const { container } = render(<ErrorFallback />);
    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
  });
});