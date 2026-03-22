/**
 * SocialShare Component Tests
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import SocialShare from '../../src/client/components/SocialShare';

// Mock clipboard API
const mockWriteText = jest.fn().mockResolvedValue(undefined);
Object.defineProperty(navigator, 'clipboard', {
  value: { writeText: mockWriteText },
  writable: true,
});

// Mock window.open
const mockOpen = jest.fn();
window.open = mockOpen;

describe('SocialShare', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders share button', () => {
    render(<SocialShare />);
    expect(screen.getByText('分享')).toBeInTheDocument();
  });

  it('renders in compact mode', () => {
    const { container } = render(<SocialShare compact />);
    expect(container.querySelector('button')).toBeInTheDocument();
  });

  it('generates share URL with custom source', () => {
    render(<SocialShare source="custom-source" campaign="custom-campaign" />);
    const shareButton = screen.getByText('分享');
    expect(shareButton).toBeInTheDocument();
  });

  it('handles native share on supported browsers', async () => {
    const mockShare = jest.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'share', {
      value: mockShare,
      writable: true,
    });

    const onShare = jest.fn();
    render(<SocialShare onShare={onShare} />);
    
    const shareButton = screen.getByText('分享');
    fireEvent.click(shareButton);
    
    await waitFor(() => {
      expect(mockShare).toHaveBeenCalled();
    });
  });

  it('calls onShare callback when share succeeds', async () => {
    const mockShare = jest.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'share', {
      value: mockShare,
      writable: true,
    });

    const onShare = jest.fn();
    render(<SocialShare onShare={onShare} />);
    
    const shareButton = screen.getByText('分享');
    fireEvent.click(shareButton);
    
    await waitFor(() => {
      expect(onShare).toHaveBeenCalledWith('native');
    });
  });
});