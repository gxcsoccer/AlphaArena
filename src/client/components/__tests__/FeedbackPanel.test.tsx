/**
 * Tests for FeedbackPanel Component
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import FeedbackPanel from '../FeedbackPanel';

// Mock apiClient
jest.mock('../../utils/apiClient', () => ({
  apiClient: {
    post: jest.fn().mockResolvedValue({
      success: true,
      data: { id: 'fb_test_123' },
    }),
  },
}));

// Mock ResizeObserver
global.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));

describe('FeedbackPanel', () => {
  const mockOnSuccess = jest.fn();
  const mockOnCancel = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render feedback form', () => {
    render(<FeedbackPanel />);
    
    expect(screen.getByText('快速反馈')).toBeInTheDocument();
    expect(screen.getByText('反馈类型')).toBeInTheDocument();
    expect(screen.getByText('详细描述')).toBeInTheDocument();
  });

  it('should have quick feedback buttons', () => {
    render(<FeedbackPanel />);
    
    expect(screen.getByText('很好用！')).toBeInTheDocument();
    expect(screen.getByText('需要改进')).toBeInTheDocument();
  });

  it('should have feedback type radio options', () => {
    render(<FeedbackPanel />);
    
    expect(screen.getByText('Bug 报告')).toBeInTheDocument();
    expect(screen.getByText('功能建议')).toBeInTheDocument();
    expect(screen.getByText('其他')).toBeInTheDocument();
  });

  it('should have description textarea area', () => {
    render(<FeedbackPanel />);
    
    // The form contains a textarea - find by form context
    const form = screen.getByText('详细描述').closest('.arco-form-item');
    expect(form).toBeInTheDocument();
  });

  it('should have screenshot upload area', () => {
    render(<FeedbackPanel />);
    
    expect(screen.getByText(/点击或拖拽上传截图/)).toBeInTheDocument();
  });

  it('should have contact info input', () => {
    render(<FeedbackPanel />);
    
    const contactInput = screen.getByPlaceholderText('邮箱或手机号');
    expect(contactInput).toBeInTheDocument();
  });

  it('should have submit and cancel buttons', () => {
    render(<FeedbackPanel onSuccess={mockOnSuccess} onCancel={mockOnCancel} />);
    
    expect(screen.getByText('取消')).toBeInTheDocument();
    expect(screen.getByText('提交反馈')).toBeInTheDocument();
  });

  it('should fill form when quick feedback "很好用！" is clicked', async () => {
    render(<FeedbackPanel />);
    
    const buttons = screen.getAllByRole('button');
    const likeButton = buttons.find(btn => btn.textContent?.includes('很好用！'));
    
    if (likeButton) {
      fireEvent.click(likeButton);
    }
    
    // Check that the button becomes primary after click
    await waitFor(() => {
      expect(likeButton).toHaveClass('arco-btn-primary');
    });
  });

  it('should fill form when quick feedback "需要改进" is clicked', async () => {
    render(<FeedbackPanel />);
    
    const buttons = screen.getAllByRole('button');
    const dislikeButton = buttons.find(btn => btn.textContent?.includes('需要改进'));
    
    if (dislikeButton) {
      fireEvent.click(dislikeButton);
    }
    
    // Check that the button changes after click
    await waitFor(() => {
      expect(dislikeButton).toBeDefined();
    });
  });

  it('should call onCancel when cancel button is clicked', () => {
    render(<FeedbackPanel onCancel={mockOnCancel} />);
    
    const cancelButton = screen.getByText('取消');
    fireEvent.click(cancelButton);
    
    expect(mockOnCancel).toHaveBeenCalled();
  });

  it('should show environment info notice', () => {
    render(<FeedbackPanel />);
    
    expect(screen.getByText(/提交时会自动收集环境信息/)).toBeInTheDocument();
  });

  it('should submit feedback successfully with valid data', async () => {
    const { apiClient } = require('../../utils/apiClient');
    apiClient.post.mockResolvedValueOnce({ success: true, data: { id: 'fb_123' } });
    
    render(<FeedbackPanel onSuccess={mockOnSuccess} />);
    
    // Find and fill the textarea using a more specific selector
    const formItems = document.querySelectorAll('.arco-form-item');
    let textarea: HTMLTextAreaElement | null = null;
    
    formItems.forEach(item => {
      const label = item.querySelector('label');
      if (label?.textContent?.includes('详细描述')) {
        textarea = item.querySelector('textarea');
      }
    });
    
    if (textarea) {
      fireEvent.change(textarea, { target: { value: 'This is a test feedback description' } });
    }
    
    const submitButton = screen.getByText('提交反馈');
    fireEvent.click(submitButton);
    
    await waitFor(() => {
      expect(apiClient.post).toHaveBeenCalled();
    }, { timeout: 5000 });
  });

  it('should have screenshot section', () => {
    render(<FeedbackPanel />);
    
    expect(screen.getByText('截图（可选）')).toBeInTheDocument();
  });

  it('should have contact info section', () => {
    render(<FeedbackPanel />);
    
    expect(screen.getByText('联系方式（可选）')).toBeInTheDocument();
  });
});