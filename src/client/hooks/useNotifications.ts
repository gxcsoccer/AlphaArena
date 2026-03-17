/**
 * useNotifications Hook
 * React hook for managing notifications
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../database/client.js';

export type NotificationType = 'SIGNAL' | 'RISK' | 'PERFORMANCE' | 'SYSTEM';
export type NotificationPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

export interface Notification {
  id: string;
  user_id: string;
  type: NotificationType;
  priority: NotificationPriority;
  title: string;
  message: string;
  data: Record<string, unknown>;
  entity_type?: string;
  entity_id?: string;
  is_read: boolean;
  read_at?: string;
  action_url?: string;
  expires_at?: string;
  created_at: string;
  updated_at: string;
}

export interface NotificationPreferences {
  id: string;
  user_id: string;
  in_app_enabled: boolean;
  email_enabled: boolean;
  push_enabled: boolean;
  signal_notifications: boolean;
  risk_notifications: boolean;
  performance_notifications: boolean;
  system_notifications: boolean;
  priority_threshold: NotificationPriority;
  quiet_hours_enabled: boolean;
  quiet_hours_start?: string;
  quiet_hours_end?: string;
  quiet_hours_timezone?: string;
  digest_enabled: boolean;
  digest_frequency?: 'hourly' | 'daily' | 'weekly';
  created_at: string;
  updated_at: string;
}

interface UseNotificationsOptions {
  limit?: number;
  autoRefresh?: boolean;
  refreshInterval?: number;
}

interface UseNotificationsReturn {
  notifications: Notification[];
  unreadCount: number;
  preferences: NotificationPreferences | null;
  loading: boolean;
  error: string | null;
  fetchNotifications: () => Promise<void>;
  fetchUnreadCount: () => Promise<void>;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  deleteNotification: (id: string) => Promise<void>;
  updatePreferences: (updates: Partial<NotificationPreferences>) => Promise<void>;
  requestBrowserPermission: () => Promise<boolean>;
  showBrowserNotification: (notification: Notification) => void;
}

const API_BASE = '/api/notifications';

/**
 * Hook for managing notifications
 */
export function useNotifications(options: UseNotificationsOptions = {}): UseNotificationsReturn {
  const { limit = 20, autoRefresh = true, refreshInterval = 30000 } = options;
  
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [preferences, setPreferences] = useState<NotificationPreferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const getAccessToken = useCallback(async (): Promise<string | null> => {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token ?? null;
  }, []);

  const fetchNotifications = useCallback(async () => {
    try {
      const token = await getAccessToken();
      if (!token) return;

      const response = await fetch(`${API_BASE}?limit=${limit}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch notifications');
      }

      const result = await response.json();
      if (result.success) {
        setNotifications(result.data);
      }
    } catch (err) {
      console.error('Error fetching notifications:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch notifications');
    }
  }, [limit, getAccessToken]);

  const fetchUnreadCount = useCallback(async () => {
    try {
      const token = await getAccessToken();
      if (!token) return;

      const response = await fetch(`${API_BASE}/unread-count`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch unread count');
      }

      const result = await response.json();
      if (result.success) {
        setUnreadCount(result.count);
      }
    } catch (err) {
      console.error('Error fetching unread count:', err);
    }
  }, [getAccessToken]);

  const fetchPreferences = useCallback(async () => {
    try {
      const token = await getAccessToken();
      if (!token) return;

      const response = await fetch(`${API_BASE}/preferences`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch preferences');
      }

      const result = await response.json();
      if (result.success) {
        setPreferences(result.data);
      }
    } catch (err) {
      console.error('Error fetching preferences:', err);
    }
  }, [getAccessToken]);

  const markAsRead = useCallback(async (id: string) => {
    try {
      const token = await getAccessToken();
      if (!token) return;

      const response = await fetch(`${API_BASE}/${id}/read`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to mark as read');
      }

      // Update local state
      setNotifications(prev =>
        prev.map(n => n.id === id ? { ...n, is_read: true, read_at: new Date().toISOString() } : n)
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (err) {
      console.error('Error marking as read:', err);
      setError(err instanceof Error ? err.message : 'Failed to mark as read');
    }
  }, [getAccessToken]);

  const markAllAsRead = useCallback(async () => {
    try {
      const token = await getAccessToken();
      if (!token) return;

      const response = await fetch(`${API_BASE}/read-all`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to mark all as read');
      }

      // Update local state
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error('Error marking all as read:', err);
      setError(err instanceof Error ? err.message : 'Failed to mark all as read');
    }
  }, [getAccessToken]);

  const deleteNotification = useCallback(async (id: string) => {
    try {
      const token = await getAccessToken();
      if (!token) return;

      const response = await fetch(`${API_BASE}/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to delete notification');
      }

      // Update local state
      setNotifications(prev => prev.filter(n => n.id !== id));
      setUnreadCount(prev => {
        const notification = notifications.find(n => n.id === id);
        return notification && !notification.is_read ? Math.max(0, prev - 1) : prev;
      });
    } catch (err) {
      console.error('Error deleting notification:', err);
      setError(err instanceof Error ? err.message : 'Failed to delete notification');
    }
  }, [getAccessToken, notifications]);

  const updatePreferences = useCallback(async (updates: Partial<NotificationPreferences>) => {
    try {
      const token = await getAccessToken();
      if (!token) return;

      const response = await fetch(`${API_BASE}/preferences`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
        throw new Error('Failed to update preferences');
      }

      const result = await response.json();
      if (result.success) {
        setPreferences(result.data);
      }
    } catch (err) {
      console.error('Error updating preferences:', err);
      setError(err instanceof Error ? err.message : 'Failed to update preferences');
    }
  }, [getAccessToken]);

  const requestBrowserPermission = useCallback(async (): Promise<boolean> => {
    if (!('Notification' in window)) {
      console.warn('Browser notifications not supported');
      return false;
    }

    if (Notification.permission === 'granted') {
      return true;
    }

    if (Notification.permission !== 'denied') {
      const permission = await Notification.requestPermission();
      return permission === 'granted';
    }

    return false;
  }, []);

  const showBrowserNotification = useCallback((notification: Notification) => {
    if (!preferences?.push_enabled) return;
    if (Notification.permission !== 'granted') return;

    const browserNotif = new Notification(notification.title, {
      body: notification.message,
      icon: '/favicon.ico',
      tag: notification.id,
      data: { url: notification.action_url },
    });

    browserNotif.onclick = () => {
      window.focus();
      if (notification.action_url) {
        window.location.href = notification.action_url;
      }
      browserNotif.close();
    };
  }, [preferences?.push_enabled]);

  // Initial fetch
  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await Promise.all([
        fetchNotifications(),
        fetchUnreadCount(),
        fetchPreferences(),
      ]);
      setLoading(false);
    };

    init();
  }, [fetchNotifications, fetchUnreadCount, fetchPreferences]);

  // Auto refresh
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      fetchNotifications();
      fetchUnreadCount();
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [autoRefresh, refreshInterval, fetchNotifications, fetchUnreadCount]);

  // Subscribe to realtime notifications
  useEffect(() => {
    const channel = supabase
      .channel('notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
        },
        (payload) => {
          const newNotification = payload.new as Notification;
          setNotifications(prev => [newNotification, ...prev]);
          setUnreadCount(prev => prev + 1);
          
          // Show browser notification if enabled
          if (preferences?.push_enabled) {
            showBrowserNotification(newNotification);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [preferences?.push_enabled, showBrowserNotification]);

  return {
    notifications,
    unreadCount,
    preferences,
    loading,
    error,
    fetchNotifications,
    fetchUnreadCount,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    updatePreferences,
    requestBrowserPermission,
    showBrowserNotification,
  };
}

export default useNotifications;
