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

  it('should have screenshot section', () => {
    render(<FeedbackPanel />);
    
    expect(screen.getByText('截图（可选）')).toBeInTheDocument();
  });

  it('should have contact info section', () => {
    render(<FeedbackPanel />);
    
    expect(screen.getByText('联系方式（可选）')).toBeInTheDocument();
  });
});