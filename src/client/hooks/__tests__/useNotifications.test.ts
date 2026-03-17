/**
 * Tests for useNotifications Hook
 */

import { renderHook, waitFor } from '@testing-library/react';
import { useNotifications } from '../useNotifications';
import * as dbClient from '../../database/client';

// Mock supabase
jest.mock('../../database/client', () => ({
  supabase: {
    auth: {
      getSession: jest.fn(),
    },
    channel: jest.fn(() => ({
      on: jest.fn().mockReturnThis(),
      subscribe: jest.fn().mockReturnThis(),
    })),
    removeChannel: jest.fn(),
  },
}));

// Mock fetch
global.fetch = jest.fn();

const mockSupabase = dbClient.supabase;

describe('useNotifications Hook', () => {
  const mockToken = 'valid-token';

  beforeEach(() => {
    jest.clearAllMocks();
    (global.fetch as jest.Mock).mockReset();
  });

  describe('initialization', () => {
    it('should fetch notifications on mount', async () => {
      (mockSupabase.auth.getSession as jest.Mock).mockResolvedValue({
        data: { session: { access_token: mockToken } },
      });

      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ success: true, data: [] }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ success: true, count: 0 }),
        });

      const { result } = renderHook(() => useNotifications());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });
    });
  });
});
