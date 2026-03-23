import { useEffect, useRef } from 'react';
import { useConnection } from '../store/connectionStore';
import { getRealtimeClient } from '../utils/realtime';

/**
 * Hook to manage realtime connection
 * Issue #579: Only initializes connection when shouldConnect is true
 * 
 * @param shouldConnect - Whether to initialize the realtime connection (default: true for backward compatibility)
 *                         Set to false on public pages like Landing Page to avoid unnecessary connections
 */
export function useRealtimeConnection(shouldConnect: boolean = true) {
  const { setStatus, updateQuality, setRealtimeConnected } = useConnection();
  const clientRef = useRef<any>(null);
  const isMountedRef = useRef<boolean>(false);
  const wasConnectedRef = useRef<boolean>(false);

  useEffect(() => {
    // Don't initialize connection if shouldConnect is false
    if (!shouldConnect) {
      // If we were previously connected, disconnect now
      if (wasConnectedRef.current && clientRef.current) {
        const client = clientRef.current;
        client.unsubscribeAll().catch((err: Error) => {
          console.warn('[useRealtimeConnection] Error during disconnect:', err);
        });
        setRealtimeConnected(false);
        setStatus('disconnected');
        wasConnectedRef.current = false;
      }
      return;
    }

    isMountedRef.current = true;
    const client = getRealtimeClient();
    clientRef.current = client;
    wasConnectedRef.current = true;

    // Subscribe to connection state changes
    const unsubscribe = client.onConnectionChange((status: string) => {
      if (!isMountedRef.current) return;
      setStatus(status);
      
      // Update Realtime connection state based on status
      if (status === 'connected') {
        setRealtimeConnected(true);
      } else if (status === 'disconnected' || status === 'reconnecting') {
        setRealtimeConnected(false);
      }
    });

    // Subscribe to quality changes
    const unsubscribeQuality = client.onQualityChange((quality: number) => {
      if (!isMountedRef.current) return;
      updateQuality(quality);
    });

    return () => {
      isMountedRef.current = false;
      unsubscribe();
      unsubscribeQuality();
    };
  }, [shouldConnect, setStatus, updateQuality, setRealtimeConnected]);
}
