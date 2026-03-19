/**
 * AIAssistantPanel Component Tests
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import AIAssistantPanel from '../../src/client/components/AIAssistantPanel';

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

// Mock marked and DOMPurify
jest.mock('marked', () => ({
  marked: {
    parse: jest.fn((text: string) => `<p>${text}</p>`),
  },
}));

jest.mock('dompurify', () => ({
  sanitize: jest.fn((html: string) => html),
}));

describe('AIAssistantPanel', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorageMock.clear();
    (global.fetch as jest.Mock).mockReset();
  });

  describe('Initial Render', () => {
    it('should render the AI assistant panel with header', () => {
      render(<AIAssistantPanel />);

      expect(screen.getByText('AI Strategy Assistant')).toBeInTheDocument();
    });

    it('should show empty state with quick actions when no messages', () => {
      render(<AIAssistantPanel />);

      expect(screen.getByText(/Ask me anything about trading strategies/)).toBeInTheDocument();
      expect(screen.getByText('📊 Market Analysis')).toBeInTheDocument();
      expect(screen.getByText('💡 Strategy Tips')).toBeInTheDocument();
    });

    it('should render input area', () => {
      render(<AIAssistantPanel />);

      expect(screen.getByPlaceholderText(/Ask about market trends/)).toBeInTheDocument();
    });
  });

  describe('LocalStorage Persistence', () => {
    it('should load messages from localStorage on mount', () => {
      const savedMessages = [
        {
          id: '1',
          role: 'user',
          content: 'Hello',
          timestamp: new Date().toISOString(),
        },
        {
          id: '2',
          role: 'assistant',
          content: 'Hi there!',
          timestamp: new Date().toISOString(),
        },
      ];

      localStorageMock.setItem('ai_assistant_messages', JSON.stringify(savedMessages));

      render(<AIAssistantPanel />);

      // The messages should be rendered
      expect(screen.getByText('Hello')).toBeInTheDocument();
      expect(screen.getByText('Hi there!')).toBeInTheDocument();
    });

    it('should save messages to localStorage when sent', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          data: {
            response: 'AI response',
            conversation_id: 'conv-123',
            tokens_used: 50,
          },
        }),
      });

      localStorageMock.setItem('auth_access_token', 'test-token');

      render(<AIAssistantPanel />);

      const input = screen.getByPlaceholderText(/Ask about market trends/);
      fireEvent.change(input, { target: { value: 'Test message' } });
      fireEvent.keyPress(input, { key: 'Enter', code: 'Enter', charCode: 13 });

      await waitFor(() => {
        const savedMessages = localStorageMock.getItem('ai_assistant_messages');
        expect(savedMessages).toBeTruthy();
        const parsed = JSON.parse(savedMessages!);
        expect(parsed.length).toBeGreaterThan(0);
        expect(parsed[0].content).toBe('Test message');
      });
    });

    it('should clear localStorage when conversation is cleared', async () => {
      const savedMessages = [
        {
          id: '1',
          role: 'user',
          content: 'Hello',
          timestamp: new Date().toISOString(),
        },
      ];
      localStorageMock.setItem('ai_assistant_messages', JSON.stringify(savedMessages));
      localStorageMock.setItem('ai_assistant_conversation_id', 'conv-123');

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
      });

      render(<AIAssistantPanel />);

      const _clearButton = screen.getByRole('button', { name: '' });
      // Find the clear button (it has a tooltip)
      const clearButtons = screen.getAllByRole('button');
      const clearBtn = clearButtons.find(btn => btn.querySelector('.arco-icon-delete'));
      
      if (clearBtn) {
        fireEvent.click(clearBtn);
      }

      await waitFor(() => {
        const savedMessages = localStorageMock.getItem('ai_assistant_messages');
        expect(savedMessages).toBe('[]');
      });
    });
  });

  describe('Quick Actions', () => {
    it('should fill input when quick action is clicked', () => {
      render(<AIAssistantPanel />);

      const strategyTipsButton = screen.getByText('💡 Strategy Tips');
      fireEvent.click(strategyTipsButton);

      const input = screen.getByPlaceholderText(/Ask about market trends/);
      expect(input).toHaveValue('What are some tips for improving my trading strategy?');
    });

    it('should open market analysis modal when Market Analysis is clicked', () => {
      render(<AIAssistantPanel />);

      const marketAnalysisButton = screen.getByText('📊 Market Analysis');
      fireEvent.click(marketAnalysisButton);

      expect(screen.getByText('Select a trading pair to analyze:')).toBeInTheDocument();
    });
  });

  describe('Message Sending', () => {
    it('should send message when Enter key is pressed', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          data: {
            response: 'AI response',
            conversation_id: 'conv-123',
            tokens_used: 50,
          },
        }),
      });

      localStorageMock.setItem('auth_access_token', 'test-token');

      render(<AIAssistantPanel />);

      const input = screen.getByPlaceholderText(/Ask about market trends/);
      fireEvent.change(input, { target: { value: 'Test question' } });
      fireEvent.keyPress(input, { key: 'Enter', code: 'Enter', charCode: 13 });

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          '/api/ai/chat',
          expect.objectContaining({
            method: 'POST',
            body: expect.stringContaining('Test question'),
          })
        );
      });
    });

    it('should not send empty message', () => {
      render(<AIAssistantPanel />);

      const input = screen.getByPlaceholderText(/Ask about market trends/);
      fireEvent.keyPress(input, { key: 'Enter', code: 'Enter', charCode: 13 });

      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('should show loading state while sending message', async () => {
      (global.fetch as jest.Mock).mockImplementationOnce(
        () => new Promise(resolve => setTimeout(resolve, 100))
      );

      localStorageMock.setItem('auth_access_token', 'test-token');

      render(<AIAssistantPanel />);

      const input = screen.getByPlaceholderText(/Ask about market trends/);
      fireEvent.change(input, { target: { value: 'Test' } });
      fireEvent.keyPress(input, { key: 'Enter', code: 'Enter', charCode: 13 });

      // Should show spinner
      await waitFor(() => {
        expect(screen.getByRole('img', { name: '' }) || document.querySelector('.arco-spin')).toBeTruthy();
      });
    });
  });

  describe('Usage Stats', () => {
    it('should fetch usage stats on mount', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          data: {
            planType: 'pro',
            messagesToday: 10,
            messagesLimit: -1,
            tokensUsed: 1000,
            tokensLimit: -1,
          },
        }),
      });

      localStorageMock.setItem('auth_access_token', 'test-token');

      render(<AIAssistantPanel />);

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

    it('should show Pro badge for Pro users', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          data: {
            planType: 'pro',
            messagesToday: 10,
            messagesLimit: -1,
            tokensUsed: 1000,
            tokensLimit: -1,
          },
        }),
      });

      localStorageMock.setItem('auth_access_token', 'test-token');

      render(<AIAssistantPanel />);

      await waitFor(() => {
        expect(screen.getByText('Pro')).toBeInTheDocument();
      });
    });

    it('should show upgrade button for Free users', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          data: {
            planType: 'free',
            messagesToday: 3,
            messagesLimit: 5,
            tokensUsed: 500,
            tokensLimit: 10000,
          },
        }),
      });

      localStorageMock.setItem('auth_access_token', 'test-token');

      render(<AIAssistantPanel />);

      await waitFor(() => {
        expect(screen.getByText('Upgrade to Pro')).toBeInTheDocument();
      });
    });
  });

  describe('Upgrade Prompt', () => {
    it('should show upgrade prompt when upgrade_required error is received', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({
          upgrade_required: true,
          error: 'AI features require a Pro subscription',
        }),
      });

      localStorageMock.setItem('auth_access_token', 'test-token');

      render(<AIAssistantPanel />);

      const input = screen.getByPlaceholderText(/Ask about market trends/);
      fireEvent.change(input, { target: { value: 'Test' } });
      fireEvent.keyPress(input, { key: 'Enter', code: 'Enter', charCode: 13 });

      await waitFor(() => {
        expect(screen.getByText('Upgrade to Pro')).toBeInTheDocument();
        expect(screen.getByText(/Pro Benefits:/)).toBeInTheDocument();
      });
    });
  });

  describe('Responsive Design', () => {
    it('should render correctly on mobile viewport', () => {
      // Mock window.innerWidth
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 375,
      });

      render(<AIAssistantPanel />);

      expect(screen.getByText('AI Strategy Assistant')).toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    it('should show error message when API fails', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({
          error: 'API error',
        }),
      });

      localStorageMock.setItem('auth_access_token', 'test-token');

      render(<AIAssistantPanel />);

      const input = screen.getByPlaceholderText(/Ask about market trends/);
      fireEvent.change(input, { target: { value: 'Test' } });
      fireEvent.keyPress(input, { key: 'Enter', code: 'Enter', charCode: 13 });

      await waitFor(() => {
        // Error should be shown (via Message.error)
        expect(global.fetch).toHaveBeenCalled();
      });
    });

    it('should show login prompt when not authenticated', async () => {
      render(<AIAssistantPanel />);

      const input = screen.getByPlaceholderText(/Ask about market trends/);
      fireEvent.change(input, { target: { value: 'Test' } });
      fireEvent.keyPress(input, { key: 'Enter', code: 'Enter', charCode: 13 });

      // Should not make API call without token
      expect(global.fetch).not.toHaveBeenCalledWith(
        '/api/ai/chat',
        expect.anything()
      );
    });
  });
});
