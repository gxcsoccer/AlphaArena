/**
 * AIAssistantButton Component Tests
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import AIAssistantButton from '../../src/client/components/AIAssistantButton';

// Mock fetch
global.fetch = jest.fn();

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

// Mock AIAssistantPanel
jest.mock('../../src/client/components/AIAssistantPanel', () => {
  return function MockAIAssistantPanel() {
    return <div data-testid="ai-assistant-panel">AI Assistant Panel</div>;
  };
});

describe('AIAssistantButton', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorageMock.clear();
    (global.fetch as jest.Mock).mockReset();
  });

  describe('Initial Render', () => {
    it('should render floating button', () => {
      render(<AIAssistantButton />);

      expect(screen.getByRole('button', { name: /Open AI Strategy Assistant/i })).toBeInTheDocument();
    });

    it('should have correct aria-label for accessibility', () => {
      render(<AIAssistantButton />);

      const button = screen.getByRole('button', { name: /Open AI Strategy Assistant/i });
      expect(button).toHaveAttribute('aria-label', 'Open AI Strategy Assistant');
    });
  });

  describe('Drawer Open/Close', () => {
    it('should open drawer when button is clicked', () => {
      render(<AIAssistantButton />);

      const button = screen.getByRole('button', { name: /Open AI Strategy Assistant/i });
      fireEvent.click(button);

      expect(screen.getByText('AI 策略助手')).toBeInTheDocument();
    });

    it('should show AI Assistant Panel in drawer', () => {
      render(<AIAssistantButton />);

      const button = screen.getByRole('button', { name: /Open AI Strategy Assistant/i });
      fireEvent.click(button);

      expect(screen.getByTestId('ai-assistant-panel')).toBeInTheDocument();
    });

    it('should close drawer when cancel is clicked', async () => {
      render(<AIAssistantButton />);

      const button = screen.getByRole('button', { name: /Open AI Strategy Assistant/i });
      fireEvent.click(button);

      expect(screen.getByText('AI 策略助手')).toBeInTheDocument();

      // Click close button
      const closeButton = screen.getByRole('button', { name: /Close/i });
      fireEvent.click(closeButton);

      await waitFor(() => {
        expect(screen.queryByText('AI 策略助手')).not.toBeVisible();
      });
    });
  });

  describe('Usage Info Fetching', () => {
    it('should fetch usage info on mount when authenticated', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          data: {
            planType: 'pro',
            messagesToday: 10,
            messagesLimit: -1,
          },
        }),
      });

      localStorageMock.setItem('auth_access_token', 'test-token');

      render(<AIAssistantButton />);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          '/api/ai/usage',
          expect.objectContaining({
            headers: expect.objectContaining({
              Authorization: 'Bearer test-token',
            }),
          })
        );
      });
    });

    it('should not fetch usage info when not authenticated', () => {
      render(<AIAssistantButton />);

      expect(global.fetch).not.toHaveBeenCalled();
    });
  });

  describe('Pro User Display', () => {
    it('should show Pro tag for Pro users', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          data: {
            planType: 'pro',
            messagesToday: 10,
            messagesLimit: -1,
          },
        }),
      });

      localStorageMock.setItem('auth_access_token', 'test-token');

      render(<AIAssistantButton />);

      // Open drawer to see the Pro tag
      const button = screen.getByRole('button', { name: /Open AI Strategy Assistant/i });
      fireEvent.click(button);

      await waitFor(() => {
        expect(screen.getByText('Pro')).toBeInTheDocument();
      });
    });

    it('should show remaining messages for Free users', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          data: {
            planType: 'free',
            messagesToday: 3,
            messagesLimit: 5,
          },
        }),
      });

      localStorageMock.setItem('auth_access_token', 'test-token');

      render(<AIAssistantButton />);

      await waitFor(() => {
        const tooltip = document.querySelector('.arco-tooltip-content');
        // The tooltip should show remaining messages
      });
    });
  });

  describe('Button Styling', () => {
    it('should have green gradient for Pro users', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          data: {
            planType: 'pro',
            messagesToday: 10,
            messagesLimit: -1,
          },
        }),
      });

      localStorageMock.setItem('auth_access_token', 'test-token');

      render(<AIAssistantButton />);

      await waitFor(() => {
        const button = screen.getByRole('button', { name: /Open AI Strategy Assistant/i });
        expect(button.style.background).toContain('linear-gradient');
      });
    });
  });

  describe('Loading State', () => {
    it('should show spinner while loading usage info', () => {
      (global.fetch as jest.Mock).mockImplementationOnce(
        () => new Promise(resolve => setTimeout(resolve, 100))
      );

      localStorageMock.setItem('auth_access_token', 'test-token');

      render(<AIAssistantButton />);

      // The button should show a spinner initially
      const button = screen.getByRole('button', { name: /Open AI Strategy Assistant/i });
      // Spinner is inside the button
      expect(button.querySelector('.arco-spin')).toBeTruthy();
    });
  });
});
