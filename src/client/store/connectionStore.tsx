/**
 * Connection State Store
 * 
 * Manages WebSocket/Supabase Realtime connection state globally
 * using React Context for app-wide access
 */

import React, { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'reconnecting';

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
  lastConnectedAt: number | null;
  lastDisconnectedAt: number | null;
}

export interface ConnectionContextType extends ConnectionState {
  setStatus: (status: ConnectionStatus) => void;
  updateQuality: (quality: Partial<ConnectionQuality>) => void;
  setOnline: (isOnline: boolean) => void;
  recordReconnect: () => void;
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

  const setStatus = useCallback((status: ConnectionStatus) => {
    setState(prev => ({
      ...prev,
      status,
      lastConnectedAt: status === 'connected' ? Date.now() : prev.lastConnectedAt,
      lastDisconnectedAt: status === 'disconnected' ? Date.now() : prev.lastDisconnectedAt,
    }));
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
    recordReconnect,
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
