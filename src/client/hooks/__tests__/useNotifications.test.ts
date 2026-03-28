/**
 * Tests for useNotifications Hook
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useNotifications } from '../useNotifications';
import { getFrontendSupabaseClient } from '../../utils/supabaseClient';

// Mock supabase
vi.mock('../../utils/supabaseClient', () => ({
  getFrontendSupabaseClient: vi.fn(),
}));

// Mock fetch
global.fetch = vi.fn();

const mockSupabase = {
  auth: {
    getSession: vi.fn(),
  },
  channel: vi.fn(() => ({
    on: vi.fn().mockReturnThis(),
    subscribe: vi.fn().mockReturnThis(),
  })),
  removeChannel: vi.fn(),
};

// Setup mock
vi.mocked(getFrontendSupabaseClient).mockReturnValue(mockSupabase as any);

describe('useNotifications Hook', () => {
  const mockUserId = 'user-123';
  const mockToken = 'valid-token';

  beforeEach(() => {
    vi.clearAllMocks();
    (global.fetch as any).mockReset();
  });

  describe('initialization', () => {
    it('should fetch notifications on mount', async () => {
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: { access_token: mockToken } },
      });

      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ success: true, data: [] }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ success: true, count: 0 }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ success: true, data: null }),
        });

      const { result } = renderHook(() => useNotifications());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(global.fetch).toHaveBeenCalledTimes(3);
    });
  });

  describe('markAsRead', () => {
    it('should mark notification as read and update state', async () => {
      const mockNotifications = [
        { id: 'notif-1', title: 'Test', is_read: false },
      ];

      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: { access_token: mockToken } },
      });

      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ success: true, data: mockNotifications }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ success: true, count: 1 }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ success: true, data: null }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ success: true, data: { id: 'notif-1', is_read: true } }),
        });

      const { result } = renderHook(() => useNotifications());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await act(async () => {
        await result.current.markAsRead('notif-1');
      });

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/notif-1/read'),
        expect.objectContaining({ method: 'PUT' })
      );
    });
  });

  describe('markAllAsRead', () => {
    it('should mark all notifications as read', async () => {
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: { access_token: mockToken } },
      });

      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ success: true, data: [] }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ success: true, count: 5 }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ success: true, data: null }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ success: true, marked_count: 5 }),
        });

      const { result } = renderHook(() => useNotifications());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await act(async () => {
        await result.current.markAllAsRead();
      });

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/read-all'),
        expect.objectContaining({ method: 'PUT' })
      );
    });
  });

  describe('deleteNotification', () => {
    it('should delete notification and update state', async () => {
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: { access_token: mockToken } },
      });

      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ success: true, data: [{ id: 'notif-1' }] }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ success: true, count: 1 }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ success: true, data: null }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ success: true }),
        });

      const { result } = renderHook(() => useNotifications());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await act(async () => {
        await result.current.deleteNotification('notif-1');
      });

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/notif-1'),
        expect.objectContaining({ method: 'DELETE' })
      );
    });
  });

  describe('updatePreferences', () => {
    it('should update notification preferences', async () => {
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: { access_token: mockToken } },
      });

      const mockPreferences = {
        id: 'pref-1',
        user_id: mockUserId,
        in_app_enabled: true,
        email_enabled: true,
      };

      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ success: true, data: [] }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ success: true, count: 0 }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ success: true, data: mockPreferences }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ success: true, data: { ...mockPreferences, email_enabled: true } }),
        });

      const { result } = renderHook(() => useNotifications());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await act(async () => {
        await result.current.updatePreferences({ email_enabled: true });
      });

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/preferences'),
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify({ email_enabled: true }),
        })
      );
    });
  });

  describe('requestBrowserPermission', () => {
    it('should return true if permission already granted', async () => {
      // Mock Notification API
      Object.defineProperty(window, 'Notification', {
        value: { permission: 'granted' },
        writable: true,
      });

      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: { access_token: mockToken } },
      });

      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ success: true, data: [] }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ success: true, count: 0 }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ success: true, data: null }),
        });

      const { result } = renderHook(() => useNotifications());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      let permission;
      await act(async () => {
        permission = await result.current.requestBrowserPermission();
      });

      expect(permission).toBe(true);
    });

    it('should return false if notifications not supported', async () => {
      Object.defineProperty(window, 'Notification', {
        value: undefined,
        writable: true,
      });

      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: { access_token: mockToken } },
      });

      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ success: true, data: [] }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ success: true, count: 0 }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ success: true, data: null }),
        });

      const { result } = renderHook(() => useNotifications());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      let permission;
      await act(async () => {
        permission = await result.current.requestBrowserPermission();
      });

      expect(permission).toBe(false);
    });
  });
});
