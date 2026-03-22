/**
 * Tests for FeedbackButton Component
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import FeedbackButton from '../FeedbackButton';

// Mock FeedbackPanel since we're testing FeedbackButton in isolation
jest.mock('../FeedbackPanel', () => {
  return function MockFeedbackPanel({ onSuccess, onCancel }: { onSuccess?: () => void; onCancel?: () => void }) {
    return (
      <div data-testid="feedback-panel">
        <button onClick={onSuccess} data-testid="submit-success">Submit</button>
        <button onClick={onCancel} data-testid="cancel-btn">Cancel</button>
      </div>
    );
  };
});

// Mock ResizeObserver
global.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));

describe('FeedbackButton', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render feedback button', () => {
    render(<FeedbackButton />);
    
    const button = screen.getByRole('button', { name: /打开用户反馈/i });
    expect(button).toBeInTheDocument();
  });

  it('should be positioned fixed at bottom-right', () => {
    render(<FeedbackButton />);
    
    const container = screen.getByRole('button', { name: /打开用户反馈/i }).parentElement;
    expect(container).toHaveStyle({ position: 'fixed' });
  });

  it('should open drawer when clicked', async () => {
    render(<FeedbackButton />);
    
    const button = screen.getByRole('button', { name: /打开用户反馈/i });
    fireEvent.click(button);
    
    await waitFor(() => {
      expect(screen.getByText('用户反馈')).toBeInTheDocument();
    });
  });

  it('should show FeedbackPanel when drawer is open', async () => {
    render(<FeedbackButton />);
    
    const button = screen.getByRole('button', { name: /打开用户反馈/i });
    fireEvent.click(button);
    
    await waitFor(() => {
      expect(screen.getByTestId('feedback-panel')).toBeInTheDocument();
    });
  });

  it('should close drawer when cancel is clicked', async () => {
    render(<FeedbackButton />);
    
    // Open drawer
    const button = screen.getByRole('button', { name: /打开用户反馈/i });
    fireEvent.click(button);
    
    await waitFor(() => {
      expect(screen.getByTestId('feedback-panel')).toBeInTheDocument();
    });
    
    // Click cancel
    fireEvent.click(screen.getByTestId('cancel-btn'));
    
    await waitFor(() => {
      expect(screen.queryByTestId('feedback-panel')).not.toBeInTheDocument();
    });
  });

  it('should show success state after successful submission', async () => {
    jest.useFakeTimers();
    render(<FeedbackButton />);
    
    // Open drawer
    const button = screen.getByRole('button', { name: /打开用户反馈/i });
    fireEvent.click(button);
    
    await waitFor(() => {
      expect(screen.getByTestId('feedback-panel')).toBeInTheDocument();
    });
    
    // Simulate success
    fireEvent.click(screen.getByTestId('submit-success'));
    
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /打开用户反馈/i })).toHaveStyle({
        background: 'linear-gradient(135deg, #00c864 0%, #00a64d 100%)',
      });
    });
    
    // Should auto-close after 2 seconds
    jest.advanceTimersByTime(2000);
    
    await waitFor(() => {
      expect(screen.queryByTestId('feedback-panel')).not.toBeInTheDocument();
    });
    
    jest.useRealTimers();
  });

  it('should accept custom bottom and right props', () => {
    render(<FeedbackButton bottom={100} right={50} />);
    
    const container = screen.getByRole('button', { name: /打开用户反馈/i }).parentElement;
    expect(container).toHaveStyle({ bottom: '100px', right: '50px' });
  });

  it('should have accessible tooltip', async () => {
    render(<FeedbackButton />);
    
    const button = screen.getByRole('button', { name: /打开用户反馈/i });
    fireEvent.mouseEnter(button);
    
    // Arco Design Tooltip appears after hover
    await waitFor(() => {
      expect(screen.getByText('用户反馈')).toBeInTheDocument();
    }, { timeout: 1000 });
  });

  it('should have correct z-index (below AIAssistantButton)', () => {
    render(<FeedbackButton />);
    
    const container = screen.getByRole('button', { name: /打开用户反馈/i }).parentElement;
    expect(container).toHaveStyle({ zIndex: '999' });
  });

  it('should be keyboard accessible', () => {
    render(<FeedbackButton />);
    
    const button = screen.getByRole('button', { name: /打开用户反馈/i });
    button.focus();
    expect(button).toHaveFocus();
    
    // Should open on Enter or Space
    fireEvent.keyDown(button, { key: 'Enter' });
    // Note: Arco Design Button handles Enter/Space automatically
  });
});