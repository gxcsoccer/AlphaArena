/**
 * Tests for Interaction Enhancement Components
 * Issue #571: 交互体验优化
 */

import React from 'react';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { BrowserRouter } from 'react-router-dom';

// Import components to test
import CountUp, {
  AnimatedPercentage,
  AnimatedPrice,
  AnimatedVolume,
} from '../CountUp';
import PageTransition, {
  FadeTransition,
  SlideTransition,
  ScaleTransition,
} from '../PageTransition';
import LoadingIndicator, {
  PageLoading,
  SectionLoading,
  InlineLoading,
  ButtonLoading,
  SkeletonLoading,
} from '../LoadingIndicator';
import FeedbackMessage, {
  SuccessMessage,
  ErrorMessage,
  WarningMessage,
  InfoMessage,
  FormValidationError,
  SuccessCheckmark,
  ErrorCross,
} from '../FeedbackMessage';
import ProgressBar, {
  IndeterminateProgress,
  StepProgress,
  AnimatedNumber,
} from '../ProgressBar';
import EnhancedButton, {
  IconButton,
  AsyncButton,
} from '../EnhancedButton';

// Helper to wrap components that need Router
const renderWithRouter = (ui: React.ReactElement) => {
  return render(<BrowserRouter>{ui}</BrowserRouter>);
};

// Mock requestAnimationFrame for animations
const mockRaf = (callback: FrameRequestCallback) => {
  return window.setTimeout(() => callback(performance.now()), 16);
};
const cancelRaf = window.clearTimeout;

beforeEach(() => {
  window.requestAnimationFrame = mockRaf;
  window.cancelAnimationFrame = cancelRaf;
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

// ============================================
// CountUp Component Tests
// ============================================
describe('CountUp Component', () => {
  it('renders with value', () => {
    render(<CountUp value={100} />);
    // The component shows the value (with animation)
    const element = screen.getByText(/100/);
    expect(element).toBeInTheDocument();
  });

  it('renders with prefix and suffix', () => {
    render(<CountUp value={50} prefix="$" suffix=" USD" />);
    expect(screen.getByText(/\$50 USD/)).toBeInTheDocument();
  });

  it('formats number with thousand separator', () => {
    render(<CountUp value={1234567} decimals={0} />);
    expect(screen.getByText(/1,234,567/)).toBeInTheDocument();
  });

  it('formats with decimals', () => {
    render(<CountUp value={123.456} decimals={2} />);
    expect(screen.getByText(/123.46/)).toBeInTheDocument();
  });

  it('uses Chinese unit for large numbers', () => {
    render(<CountUp value={100000000} useChineseUnit />);
    expect(screen.getByText(/亿/)).toBeInTheDocument();
  });

  it('uses Chinese unit for wan', () => {
    render(<CountUp value={10000} useChineseUnit />);
    expect(screen.getByText(/万/)).toBeInTheDocument();
  });
});

describe('AnimatedPercentage', () => {
  it('renders percentage with sign', () => {
    render(<AnimatedPercentage value={10.5} />);
    expect(screen.getByText(/\+10.50%/)).toBeInTheDocument();
  });

  it('renders negative percentage', () => {
    render(<AnimatedPercentage value={-5.25} />);
    expect(screen.getByText(/-5.25%/)).toBeInTheDocument();
  });
});

describe('AnimatedPrice', () => {
  it('renders price with currency', () => {
    render(<AnimatedPrice value={99.99} />);
    expect(screen.getByText(/\$99.99/)).toBeInTheDocument();
  });
});

describe('AnimatedVolume', () => {
  it('renders volume with Chinese unit', () => {
    render(<AnimatedVolume value={100000} />);
    // Volume might be formatted with decimal
    expect(screen.getByText(/10\.00万/)).toBeInTheDocument();
  });
});

// ============================================
// LoadingIndicator Component Tests
// ============================================
describe('LoadingIndicator Component', () => {
  it('renders spinner type by default', () => {
    render(<LoadingIndicator />);
    const spinner = document.querySelector('.arco-spin');
    expect(spinner).toBeInTheDocument();
  });

  it('renders dots type', () => {
    render(<LoadingIndicator type="dots" />);
    const dots = document.querySelector('.dots-loading');
    expect(dots).toBeInTheDocument();
  });

  it('renders bar type', () => {
    render(<LoadingIndicator type="bar" />);
    const bars = document.querySelector('.bar-loading');
    expect(bars).toBeInTheDocument();
  });

  it('renders pulse type', () => {
    render(<LoadingIndicator type="pulse" />);
    const container = document.querySelector('[style*="pulse-loading-animation"]');
    expect(container).toBeInTheDocument();
  });

  it('renders loading text', () => {
    render(<LoadingIndicator text="Loading data..." />);
    expect(screen.getByText('Loading data...')).toBeInTheDocument();
  });

  it('renders fullscreen mode', () => {
    render(<LoadingIndicator fullscreen />);
    const fullscreenContainer = document.querySelector('[style*="position: fixed"]');
    expect(fullscreenContainer).toBeInTheDocument();
  });

  it('has correct accessibility attributes', () => {
    render(<LoadingIndicator text="Loading..." />);
    const loader = screen.getByRole('status', { name: 'Loading...' });
    expect(loader).toBeInTheDocument();
  });
});

describe('PageLoading', () => {
  it('renders with default text', () => {
    render(<PageLoading />);
    expect(screen.getByText('加载中...')).toBeInTheDocument();
  });

  it('renders with custom text', () => {
    render(<PageLoading text="Please wait..." />);
    expect(screen.getByText('Please wait...')).toBeInTheDocument();
  });
});

describe('SkeletonLoading', () => {
  it('renders text skeleton', () => {
    render(<SkeletonLoading type="text" rows={3} />);
    const skeletons = document.querySelectorAll('.skeleton-base');
    expect(skeletons.length).toBe(3);
  });

  it('renders card skeleton', () => {
    render(<SkeletonLoading type="card" />);
    const card = document.querySelector('[style*="border-radius"]');
    expect(card).toBeInTheDocument();
  });

  it('renders list skeleton', () => {
    render(<SkeletonLoading type="list" rows={5} />);
    const skeletons = document.querySelectorAll('.skeleton-base');
    expect(skeletons.length).toBeGreaterThan(5);
  });

  it('renders table skeleton', () => {
    render(<SkeletonLoading type="table" rows={3} columns={4} />);
    const skeletons = document.querySelectorAll('.skeleton-base');
    expect(skeletons.length).toBeGreaterThan(12);
  });

  it('renders chart skeleton', () => {
    render(<SkeletonLoading type="chart" height={200} />);
    const chart = document.querySelector('[style*="height: 200px"]');
    expect(chart).toBeInTheDocument();
  });
});

// ============================================
// FeedbackMessage Component Tests
// ============================================
describe('FeedbackMessage Component', () => {
  it('renders success message', () => {
    render(<FeedbackMessage type="success" message="操作成功" />);
    expect(screen.getByText('操作成功')).toBeInTheDocument();
  });

  it('renders error message', () => {
    render(<FeedbackMessage type="error" message="操作失败" />);
    expect(screen.getByText('操作失败')).toBeInTheDocument();
  });

  it('renders warning message', () => {
    render(<FeedbackMessage type="warning" message="请注意" />);
    expect(screen.getByText('请注意')).toBeInTheDocument();
  });

  it('renders info message', () => {
    render(<FeedbackMessage type="info" message="提示信息" />);
    expect(screen.getByText('提示信息')).toBeInTheDocument();
  });

  it('renders with description', () => {
    render(
      <FeedbackMessage
        type="success"
        message="成功"
        description="您的操作已成功完成"
      />
    );
    expect(screen.getByText('成功')).toBeInTheDocument();
    expect(screen.getByText('您的操作已成功完成')).toBeInTheDocument();
  });

  it('renders with action button', () => {
    const onClick = jest.fn();
    render(
      <FeedbackMessage
        type="error"
        message="错误"
        action={{ text: '重试', onClick }}
      />
    );
    const button = screen.getByText('重试');
    expect(button).toBeInTheDocument();
    fireEvent.click(button);
    expect(onClick).toHaveBeenCalled();
  });

  it('can be closed', async () => {
    const onClose = jest.fn();
    render(
      <FeedbackMessage
        type="info"
        message="可关闭消息"
        closable
        onClose={onClose}
      />
    );
    const closeButton = screen.getByLabelText('关闭');
    await act(async () => {
      fireEvent.click(closeButton);
    });
    // Wait for animation to complete
    await waitFor(() => {
      expect(onClose).toHaveBeenCalled();
    });
  });

  it('auto closes after duration', () => {
    jest.useFakeTimers();
    const onClose = jest.fn();
    render(
      <FeedbackMessage
        type="success"
        message="自动关闭"
        duration={1000}
        onClose={onClose}
      />
    );
    
    act(() => {
      jest.advanceTimersByTime(1200);
    });
    
    expect(onClose).toHaveBeenCalled();
    jest.useRealTimers();
  });
});

describe('SuccessCheckmark', () => {
  it('renders checkmark SVG', () => {
    render(<SuccessCheckmark />);
    const svg = document.querySelector('svg');
    expect(svg).toBeInTheDocument();
  });
});

describe('ErrorCross', () => {
  it('renders cross SVG', () => {
    render(<ErrorCross />);
    const svg = document.querySelector('svg');
    expect(svg).toBeInTheDocument();
  });
});

describe('FormValidationError', () => {
  it('renders validation error', () => {
    render(<FormValidationError message="必填字段" field="用户名" />);
    expect(screen.getByText(/用户名: 必填字段/)).toBeInTheDocument();
  });
});

// ============================================
// ProgressBar Component Tests
// ============================================
describe('ProgressBar Component', () => {
  it('renders line progress bar', () => {
    render(<ProgressBar percent={50} />);
    const track = document.querySelector('.progress-bar__track');
    expect(track).toBeInTheDocument();
  });

  it('renders with text', () => {
    render(<ProgressBar percent={75} showText />);
    // Progress starts at 0 and animates to 75
    const textElement = screen.getByText(/%/);
    expect(textElement).toBeInTheDocument();
  });

  it('renders with status colors', () => {
    const { container, rerender } = render(<ProgressBar percent={50} status="success" />);
    expect(container.querySelector('.progress-bar')).toBeInTheDocument();
    
    rerender(<ProgressBar percent={50} status="error" />);
    expect(container.querySelector('.progress-bar')).toBeInTheDocument();
  });

  it('renders striped progress', () => {
    render(<ProgressBar percent={50} striped />);
    const fill = document.querySelector('.progress-bar__fill--striped');
    expect(fill).toBeInTheDocument();
  });

  it('renders circle progress', () => {
    render(<ProgressBar type="circle" percent={50} />);
    const svg = document.querySelector('svg');
    expect(svg).toBeInTheDocument();
  });

  it('renders dashboard progress', () => {
    render(<ProgressBar type="dashboard" percent={50} />);
    const svg = document.querySelector('svg');
    expect(svg).toBeInTheDocument();
  });
});

describe('IndeterminateProgress', () => {
  it('renders indeterminate bar', () => {
    render(<IndeterminateProgress />);
    const bar = document.querySelector('.progress-indeterminate');
    expect(bar).toBeInTheDocument();
  });
});

describe('StepProgress', () => {
  it('renders step indicators', () => {
    render(<StepProgress steps={5} current={2} />);
    const container = document.querySelector('.step-progress');
    expect(container).toBeInTheDocument();
  });
});

// ============================================
// EnhancedButton Component Tests
// ============================================
describe('EnhancedButton Component', () => {
  it('renders button with children', () => {
    render(<EnhancedButton>Click me</EnhancedButton>);
    expect(screen.getByText('Click me')).toBeInTheDocument();
  });

  it('handles click events', () => {
    const onClick = jest.fn();
    render(<EnhancedButton onClick={onClick}>Click</EnhancedButton>);
    fireEvent.click(screen.getByText('Click'));
    expect(onClick).toHaveBeenCalled();
  });

  it('shows loading state', () => {
    render(<EnhancedButton loading loadingText="Processing...">Submit</EnhancedButton>);
    expect(screen.getByText('Processing...')).toBeInTheDocument();
  });

  it('shows success state', () => {
    render(<EnhancedButton success successText="Done!">Submit</EnhancedButton>);
    expect(screen.getByText('Done!')).toBeInTheDocument();
  });

  it('disables when loading', () => {
    render(<EnhancedButton loading>Click</EnhancedButton>);
    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
  });

  it('disables when disabled prop is true', () => {
    render(<EnhancedButton disabled>Click</EnhancedButton>);
    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
  });

  it('applies variant styles', () => {
    const { container, rerender } = render(<EnhancedButton variant="solid">Click</EnhancedButton>);
    expect(container.querySelector('button')).toBeInTheDocument();
    
    rerender(<EnhancedButton variant="outline">Click</EnhancedButton>);
    expect(container.querySelector('button')).toBeInTheDocument();
    
    rerender(<EnhancedButton variant="gradient">Click</EnhancedButton>);
    expect(container.querySelector('button')).toBeInTheDocument();
  });
});

describe('IconButton', () => {
  it('renders icon button', () => {
    render(
      <IconButton icon={<span>🔍</span>} aria-label="Search" />
    );
    expect(screen.getByLabelText('Search')).toBeInTheDocument();
  });
});

describe('AsyncButton', () => {
  it('handles async operation', async () => {
    const onClick = jest.fn().mockResolvedValue(undefined);
    render(<AsyncButton onClick={onClick}>Submit</AsyncButton>);
    
    await act(async () => {
      fireEvent.click(screen.getByText('Submit'));
    });
    expect(onClick).toHaveBeenCalled();
  });

  it('shows loading state during async operation', async () => {
    const onClick = jest.fn().mockImplementation(() => new Promise<void>(resolve => setTimeout(resolve, 100)));
    
    render(<AsyncButton onClick={onClick} loadingText="Saving...">Save</AsyncButton>);
    
    await act(async () => {
      fireEvent.click(screen.getByText('Save'));
    });
    
    // After click, should show loading text
    await waitFor(() => {
      expect(screen.getByText('Saving...')).toBeInTheDocument();
    });
  });
});

// ============================================
// PageTransition Component Tests
// ============================================
describe('PageTransition Component', () => {
  it('renders children', () => {
    renderWithRouter(
      <PageTransition>
        <div>Page Content</div>
      </PageTransition>
    );
    expect(screen.getByText('Page Content')).toBeInTheDocument();
  });

  it('applies fade transition type', () => {
    const { container } = renderWithRouter(
      <PageTransition type="fade">
        <div>Content</div>
      </PageTransition>
    );
    expect(container.querySelector('.page-transition-container')).toBeInTheDocument();
  });

  it('applies slide transition type', () => {
    const { container } = renderWithRouter(
      <PageTransition type="slide">
        <div>Content</div>
      </PageTransition>
    );
    expect(container.querySelector('.page-transition-container')).toBeInTheDocument();
  });
});

describe('FadeTransition', () => {
  it('shows content when visible', () => {
    render(
      <FadeTransition visible={true}>
        <div>Faded Content</div>
      </FadeTransition>
    );
    expect(screen.getByText('Faded Content')).toBeInTheDocument();
  });

  it('hides content when not visible', () => {
    render(
      <FadeTransition visible={false}>
        <div>Faded Content</div>
      </FadeTransition>
    );
    const content = screen.getByText('Faded Content');
    expect(content.parentElement).toHaveStyle({ opacity: 0 });
  });
});

describe('SlideTransition', () => {
  it('shows content when visible', () => {
    render(
      <SlideTransition visible={true}>
        <div>Sliding Content</div>
      </SlideTransition>
    );
    expect(screen.getByText('Sliding Content')).toBeInTheDocument();
  });
});

describe('ScaleTransition', () => {
  it('shows content when visible', () => {
    render(
      <ScaleTransition visible={true}>
        <div>Scaling Content</div>
      </ScaleTransition>
    );
    expect(screen.getByText('Scaling Content')).toBeInTheDocument();
  });
});

// ============================================
// Accessibility Tests
// ============================================
describe('Accessibility', () => {
  it('loading indicators have proper ARIA attributes', () => {
    render(<LoadingIndicator text="Loading..." />);
    const loader = screen.getByRole('status');
    expect(loader).toHaveAttribute('aria-label', 'Loading...');
  });

  it('error messages have alert role', () => {
    render(<FeedbackMessage type="error" message="Error occurred" />);
    const alert = screen.getByRole('alert');
    expect(alert).toBeInTheDocument();
  });

  it('icon buttons have aria-label', () => {
    render(<IconButton icon={<span>X</span>} aria-label="Close" />);
    const button = screen.getByLabelText('Close');
    expect(button).toBeInTheDocument();
  });

  it('buttons are focusable', () => {
    render(<EnhancedButton>Focusable</EnhancedButton>);
    const button = screen.getByRole('button');
    button.focus();
    expect(button).toHaveFocus();
  });
});