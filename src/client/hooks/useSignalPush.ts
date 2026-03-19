/**
 * useSignalPush Hook
 * Real-time trading signal push notifications with browser notifications
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { getRealtimeClient, ConnectionStatus } from '../utils/realtime';

export interface TradingSignal {
  id: string;
  symbol: string;
  side: 'buy' | 'sell';
  signalType: string;
  title?: string;
  description?: string;
  entryPrice?: number;
  targetPrice?: number;
  stopLossPrice?: number;
  riskLevel: 'low' | 'medium' | 'high' | 'very_high';
  confidenceScore?: number;
  status: string;
  publisherId: string;
  publisherName?: string;
  createdAt: Date;
}

export interface SignalAlert {
  id: string;
  type: 'target_hit' | 'stop_loss_hit' | 'expiring_soon' | 'price_alert';
  signalId: string;
  symbol: string;
  message: string;
  currentPrice?: number;
  targetPrice?: number;
  timestamp: Date;
}

export interface SignalPushConfig {
  pushEnabled: boolean;
  signalTypes: string[];
  frequency: 'realtime' | 'batch_1m' | 'batch_5m' | 'batch_15m';
  browserNotify: boolean;
  inAppNotify: boolean;
  soundEnabled: boolean;
  minConfidenceScore: number;
  riskLevels: string[];
  symbols: string[];
  quietHoursEnabled: boolean;
  quietHoursStart: string;
  quietHoursEnd: string;
}

interface UseSignalPushOptions {
  userId?: string;
  autoConnect?: boolean;
  onSignal?: (signal: TradingSignal) => void;
  onAlert?: (alert: SignalAlert) => void;
}

interface UseSignalPushReturn {
  // Connection state
  isConnected: boolean;
  connectionStatus: ConnectionStatus;
  
  // Recent signals
  recentSignals: TradingSignal[];
  unreadCount: number;
  
  // Alerts
  alerts: SignalAlert[];
  
  // Actions
  markAsRead: (signalId: string) => void;
  markAllAsRead: () => void;
  clearAlerts: () => void;
  
  // Configuration
  config: SignalPushConfig | null;
  updateConfig: (updates: Partial<SignalPushConfig>) => Promise<void>;
  
  // Manual refresh
  refresh: () => Promise<void>;
}

const SIGNAL_SOUND_URL = 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2teleVMdAMTq2teleUoeAMXr3e7eqkcXAcTu4O/gqkoYAcXv4fDhq0sWAsTw4vHirE0VAsXx5PPjrVAXAsjy5fPkrVIZAsnz5vTlrVQbAsr05vXmrVgeAss15vbnrFohAss25vbnrFskAsw35/borV0mAs056Pbprl8oAs466PfqrmIqAs866vfrrmQsAtE76/jrr2cuAtI87fnssWkxAtM+7vnttGw0AtNA7/nttW42AtRB8PnutXA5AtRC8fnvu3M8AtRE8vnvu3Q9AtRF8vnvu3U+AtRG8vnvu3Y/AtRH8vnvu3dBAtRI8vnvu3JCAtRJ8vnvu3NDAtRK8vnvu3REAtRL8vnvu3VFAtRM8vnvu3ZGAtRN8vnvu3dHAtRO8vnvu3hIAtRP8vnvu3lJAtRQ8vnvu3pKAtRR8vnvu3tLAtRS8vnvu3xMAtRT8vnvu31NAtRU8vnvu35OAtRV8vnvu39PAtRW8vnvvABRAtRX8vnvvQFTAtRY8vnvvgFWAtRZ8vnvvwFYAtRa8vnvwAFbAtRb8vnvwQFdAtRc8vnvwgFfAtRd8vnvwwFhAtRe8vnvwxFjAtRf8vnvxBlmAtRg8vnvxRpoAtRh8vnvxhtsAtRi8vnvxxtuAtRj8vnvyBtwAtRk8vnvyRtzAtRl8vnvyxt2AtRm8vnvzB14AtRn8vnvzR57AtRo8vnvzxt+AtRp8vnv0B2AAtRq8vnv0R2DAtRr8vnv0h2FAtRs8vnv0x2HAtRt8vnv1B2JAtRu8vnv1R2LAtRv8vnv1h2NAtRw8vnv1x2PAtRx8vnv2B2RAtRy8vnv2R2TAtRz8vnv2h2VAtR08vnv2x2XAtR18vnv3B2ZAtR28vnv3R2bAtR38vnv3h2dAtR48vnv3x2fAtR58vnv4B2hAtR68vnv4R2jAtR78vnv4h2lAtR88vnv4x2nAtR98vnv5B2pAtR+8vnv5R2rAtR/8vnv5h2tAtSA8vnv5x2vAtSB8vnv6B2xAtSC8vnv6R2zAtSD8vnv6h21AtSE8vnv6x23AtSF8vnv7B25AtSG8vnv7R27AtSH8vnv7h29AtSI8vnv7x2/AtSJ8vnv8B3BAtSK8vnv8R3DAtSL8vnv8h3FAtSM8vnv8x3HAtSN8vnv9B3JAtSO8vnv9R3LAtSP8vnv9h3NAtSQ8vnv9x3PAtSR8vnv+B3RAtSS8vnv+R3TAtST8vnv+h3VAtSU8vnv+x3XAtSV8vnv/B3ZAtSW8vnv/R3bAtSX8vnv/h3dAtSY8vnv/x3fAtSZ8vnAAB3hAtSa8vnAAB3jAtSb8vnABR3lAtSc8vnABh3nAtSd8vnABx3pAtSe8vnACB3rAtSf8vnACR3tAtSg8vnACh3vAtSh8vnACx3xAtSi8vnADB3zAtSj8vnADR31AtSk8vnADh33AtSl8vnADx35AtSm8vM=';

export function useSignalPush(options: UseSignalPushOptions = {}): UseSignalPushReturn {
  const { userId, autoConnect = true, onSignal, onAlert } = options;
  
  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected');
  const [recentSignals, setRecentSignals] = useState<TradingSignal[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [alerts, setAlerts] = useState<SignalAlert[]>([]);
  const [config, setConfig] = useState<SignalPushConfig | null>(null);
  
  const readSignalsRef = useRef<Set<string>>(new Set());
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Initialize audio
  useEffect(() => {
    audioRef.current = new Audio(SIGNAL_SOUND_URL);
    audioRef.current.volume = 0.5;
    audioRef.current.preload = 'auto';
    
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  // Play notification sound
  const playSound = useCallback(() => {
    if (audioRef.current && config?.soundEnabled !== false) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(err => {
        console.warn('[SignalPush] Failed to play sound:', err);
      });
    }
  }, [config?.soundEnabled]);

  // Show browser notification
  const showBrowserNotification = useCallback((signal: TradingSignal) => {
    if (!config?.browserNotify || !('Notification' in window)) return;
    
    if (Notification.permission === 'granted') {
      const icon = signal.side === 'buy' ? '📈' : '📉';
      const title = `${icon} ${signal.symbol} ${signal.side.toUpperCase()} 信号`;
      const body = signal.title || 
        `${signal.side === 'buy' ? '买入' : '卖出'} ${signal.symbol}` +
        `${signal.entryPrice ? ` @ $${signal.entryPrice.toLocaleString()}` : ''}`;
      
      new Notification(title, {
        body,
        icon: '/favicon.ico',
        tag: `signal-${signal.id}`,
        requireInteraction: false,
      });
    }
  }, [config?.browserNotify]);

  // Handle new signal
  const handleNewSignal = useCallback((signalData: any) => {
    const signal: TradingSignal = {
      ...signalData,
      createdAt: new Date(signalData.timestamp || Date.now()),
    };
    
    // Add to recent signals
    setRecentSignals(prev => {
      const updated = [signal, ...prev].slice(0, 50);
      return updated;
    });
    
    // Increment unread count
    if (!readSignalsRef.current.has(signal.id)) {
      setUnreadCount(prev => prev + 1);
    }
    
    // Play sound and show notification
    playSound();
    showBrowserNotification(signal);
    
    // Call custom handler
    onSignal?.(signal);
  }, [playSound, showBrowserNotification, onSignal]);

  // Handle signal alert
  const handleSignalAlert = useCallback((alertData: any) => {
    const alert: SignalAlert = {
      id: `alert-${alertData.signalId}-${Date.now()}`,
      type: alertData.alertType,
      signalId: alertData.signalId,
      symbol: alertData.symbol,
      message: alertData.message,
      currentPrice: alertData.currentPrice,
      targetPrice: alertData.targetPrice,
      timestamp: new Date(alertData.timestamp),
    };
    
    setAlerts(prev => [alert, ...prev].slice(0, 20));
    
    // Play sound for alerts
    playSound();
    
    // Call custom handler
    onAlert?.(alert);
  }, [playSound, onAlert]);

  // Subscribe to signal channels
  useEffect(() => {
    if (!autoConnect || !userId) return;

    const realtimeClient = getRealtimeClient();
    
    // Subscribe to user's signal channel
    const topic = `signals:${userId}`;
    
    const unsubscribeConnection = realtimeClient.onConnectionChange((status) => {
      setConnectionStatus(status);
      setIsConnected(status === 'connected');
    });

    // Subscribe to new signals
    const unsubscribeNew = realtimeClient.on(topic, 'signal:new', handleNewSignal);
    
    // Subscribe to signal updates
    const unsubscribeUpdate = realtimeClient.on(topic, 'signal:update', (data) => {
      console.log('[SignalPush] Signal update:', data);
    });
    
    // Subscribe to signal close
    const unsubscribeClose = realtimeClient.on(topic, 'signal:close', (data) => {
      console.log('[SignalPush] Signal closed:', data);
    });
    
    // Subscribe to alerts
    const unsubscribeAlert = realtimeClient.on(topic, 'signal:alert', handleSignalAlert);

    // Subscribe to global signal feed
    const unsubscribeGlobal = realtimeClient.on('signals:global', 'signal:new', (data) => {
      // Global signals are for public feed, not pushed directly
      console.log('[SignalPush] Global signal:', data);
    });

    // Connect
    realtimeClient.subscribe(topic).catch(err => {
      console.error('[SignalPush] Failed to subscribe:', err);
    });

    // Request notification permission
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().catch(err => {
        console.warn('[SignalPush] Failed to request notification permission:', err);
      });
    }

    return () => {
      unsubscribeConnection();
      unsubscribeNew();
      unsubscribeUpdate();
      unsubscribeClose();
      unsubscribeAlert();
      unsubscribeGlobal();
      realtimeClient.unsubscribe(topic).catch(() => {});
    };
  }, [userId, autoConnect, handleNewSignal, handleSignalAlert]);

  // Fetch config from API
  const refresh = useCallback(async () => {
    try {
      const response = await fetch('/api/signals/push-config', {
        credentials: 'include',
      });
      
      if (response.ok) {
        const data = await response.json();
        setConfig(data.data);
      }
    } catch (error) {
      console.error('[SignalPush] Failed to fetch config:', error);
    }
  }, []);

  // Fetch config on mount
  useEffect(() => {
    refresh();
  }, [refresh]);

  // Mark signal as read
  const markAsRead = useCallback((signalId: string) => {
    readSignalsRef.current.add(signalId);
    setUnreadCount(prev => Math.max(0, prev - 1));
  }, []);

  // Mark all as read
  const markAllAsRead = useCallback(() => {
    recentSignals.forEach(s => readSignalsRef.current.add(s.id));
    setUnreadCount(0);
  }, [recentSignals]);

  // Clear alerts
  const clearAlerts = useCallback(() => {
    setAlerts([]);
  }, []);

  // Update config
  const updateConfig = useCallback(async (updates: Partial<SignalPushConfig>) => {
    try {
      const response = await fetch('/api/signals/push-config', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(updates),
      });
      
      if (response.ok) {
        const data = await response.json();
        setConfig(data.data);
      }
    } catch (error) {
      console.error('[SignalPush] Failed to update config:', error);
      throw error;
    }
  }, []);

  return {
    isConnected,
    connectionStatus,
    recentSignals,
    unreadCount,
    alerts,
    markAsRead,
    markAllAsRead,
    clearAlerts,
    config,
    updateConfig,
    refresh,
  };
}

export default useSignalPush;