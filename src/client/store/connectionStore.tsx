/**
 * Connection State Store
 * 
 * Manages WebSocket/Supabase Realtime connection state globally
 * using React Context for app-wide access
 * 
 * Updated for Issue #178: WebSocket 连接断开
 * - Added "degraded" status when Realtime fails but REST API works
 * - Added REST API health check
 */

import React, { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import { api } from '../utils/api';

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'degraded';

export interface ConnectionQuality {
  latency: number; // ms
  lastPingAt: number;
  isStale: boolean;
  reconnectAttempts: number;
  lastReconnectAt: number | null;
}

export interface ConnectionState {
  status: ConnectionStatus;
  quality: ConnectionQuality;
  isOnline: boolean;
  isRealtimeConnected: boolean;
  isRestApiAvailable: boolean;
  lastConnectedAt: number | null;
  lastDisconnectedAt: number | null;
}

export interface ConnectionContextType extends ConnectionState {
  setStatus: (status: ConnectionStatus) => void;
  updateQuality: (quality: Partial<ConnectionQuality>) => void;
  setOnline: (isOnline: boolean) => void;
  setRealtimeConnected: (connected: boolean) => void;
  setRestApiAvailable: (available: boolean) => void;
  recordReconnect: () => void;
  checkRestApiHealth: () => Promise<boolean>;
  reset: () => void;
}

const defaultQuality: ConnectionQuality = {
  latency: 0,
  lastPingAt: 0,
  isStale: false,
  reconnectAttempts: 0,
  lastReconnectAt: null,
};

const defaultState: ConnectionState = {
  status: 'disconnected',
  quality: defaultQuality,
  isOnline: typeof navigator !== 'undefined' ? navigator.onLine : false,
  isRealtimeConnected: false,
  isRestApiAvailable: false,
  lastConnectedAt: null,
  lastDisconnectedAt: null,
};

const ConnectionContext = createContext<ConnectionContextType | undefined>(undefined);

export function ConnectionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ConnectionState>(defaultState);

  // Monitor browser online/offline status
  useEffect(() => {
    const handleOnline = () => {
      setState(prev => ({ ...prev, isOnline: true }));
    };
    const handleOffline = () => {
      setState(prev => ({ ...prev, isOnline: false }));
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Periodically check REST API health
  useEffect(() => {
    const checkHealth = async () => {
      try {
        await api.getMarketTickers();
        setState(prev => {
          // If Realtime is not connected but REST API works, set to degraded
          if (!prev.isRealtimeConnected && prev.status !== 'connected') {
            return { ...prev, isRestApiAvailable: true, status: 'degraded' };
          }
          return { ...prev, isRestApiAvailable: true };
        });
      } catch (error) {
        setState(prev => ({ ...prev, isRestApiAvailable: false }));
      }
    };

    // Check immediately
    checkHealth();

    // Check every 30 seconds
    const interval = setInterval(checkHealth, 30000);

    return () => clearInterval(interval);
  }, []);

  const setStatus = useCallback((status: ConnectionStatus) => {
    setState(prev => {
      // If setting to disconnected but REST API is available, use degraded instead
      if (status === 'disconnected' && prev.isRestApiAvailable) {
        return {
          ...prev,
          status: 'degraded',
          lastDisconnectedAt: Date.now(),
        };
      }
      return {
        ...prev,
        status,
        lastConnectedAt: status === 'connected' ? Date.now() : prev.lastConnectedAt,
        lastDisconnectedAt: status === 'disconnected' ? Date.now() : prev.lastDisconnectedAt,
      };
    });
  }, []);

  const updateQuality = useCallback((quality: Partial<ConnectionQuality>) => {
    setState(prev => ({
      ...prev,
      quality: { ...prev.quality, ...quality },
    }));
  }, []);

  const setOnline = useCallback((isOnline: boolean) => {
    setState(prev => ({ ...prev, isOnline }));
  }, []);

  const setRealtimeConnected = useCallback((connected: boolean) => {
    setState(prev => {
      if (connected) {
        return { ...prev, isRealtimeConnected: true, status: 'connected' };
      } else {
        // If Realtime disconnects but REST API is available, use degraded
        const newStatus = prev.isRestApiAvailable ? 'degraded' : 'disconnected';
        return { ...prev, isRealtimeConnected: false, status: newStatus };
      }
    });
  }, []);

  const setRestApiAvailable = useCallback((available: boolean) => {
    setState(prev => {
      if (available && !prev.isRealtimeConnected && prev.status !== 'connected') {
        return { ...prev, isRestApiAvailable: true, status: 'degraded' };
      }
      return { ...prev, isRestApiAvailable: available };
    });
  }, []);

  const recordReconnect = useCallback(() => {
    setState(prev => ({
      ...prev,
      quality: {
        ...prev.quality,
        reconnectAttempts: prev.quality.reconnectAttempts + 1,
        lastReconnectAt: Date.now(),
      },
    }));
  }, []);

  const checkRestApiHealth = useCallback(async (): Promise<boolean> => {
    try {
      await api.getMarketTickers();
      setRestApiAvailable(true);
      return true;
    } catch (error) {
      setRestApiAvailable(false);
      return false;
    }
  }, [setRestApiAvailable]);

  const reset = useCallback(() => {
    setState({
      ...defaultState,
      isOnline: typeof navigator !== 'undefined' ? navigator.onLine : false,
    });
  }, []);

  const value: ConnectionContextType = {
    ...state,
    setStatus,
    updateQuality,
    setOnline,
    setRealtimeConnected,
    setRestApiAvailable,
    recordReconnect,
    checkRestApiHealth,
    reset,
  };

  return (
    <ConnectionContext.Provider value={value}>
      {children}
    </ConnectionContext.Provider>
  );
}

export function useConnection(): ConnectionContextType {
  const context = useContext(ConnectionContext);
  if (context === undefined) {
    throw new Error('useConnection must be used within a ConnectionProvider');
  }
  return context;
}

export default ConnectionContext;
