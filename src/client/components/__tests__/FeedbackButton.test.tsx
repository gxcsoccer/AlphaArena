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
    
    // Find button by role
    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBeGreaterThan(0);
  });

  it('should open drawer when clicked', async () => {
    render(<FeedbackButton />);
    
    const buttons = screen.getAllByRole('button');
    fireEvent.click(buttons[0]);
    
    await waitFor(() => {
      expect(screen.getByText('用户反馈')).toBeInTheDocument();
    });
  });

  it('should show FeedbackPanel when drawer is open', async () => {
    render(<FeedbackButton />);
    
    const buttons = screen.getAllByRole('button');
    fireEvent.click(buttons[0]);
    
    await waitFor(() => {
      expect(screen.getByTestId('feedback-panel')).toBeInTheDocument();
    });
  });

  it('should close drawer when cancel is clicked', async () => {
    render(<FeedbackButton />);
    
    // Open drawer
    const buttons = screen.getAllByRole('button');
    fireEvent.click(buttons[0]);
    
    await waitFor(() => {
      expect(screen.getByTestId('feedback-panel')).toBeInTheDocument();
    });
    
    // Click cancel
    fireEvent.click(screen.getByTestId('cancel-btn'));
    
    await waitFor(() => {
      expect(screen.queryByTestId('feedback-panel')).not.toBeInTheDocument();
    });
  });

  it('should accept custom bottom and right props', () => {
    render(<FeedbackButton bottom={100} right={50} />);
    
    // Button should still render
    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBeGreaterThan(0);
  });
});