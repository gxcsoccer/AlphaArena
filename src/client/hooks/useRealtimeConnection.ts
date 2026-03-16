import { useEffect, useRef } from 'react';
import { useConnection } from '../store/connectionStore';
import { getRealtimeClient } from '../utils/realtime';

export function useRealtimeConnection() {
  const { setStatus, updateQuality, setRealtimeConnected } = useConnection();
  const clientRef = useRef<any>(null);
  const isMountedRef = useRef<boolean>(false);

  useEffect(() => {
    isMountedRef.current = true;
    const client = getRealtimeClient();
    clientRef.current = client;

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
  }, [setStatus, updateQuality, setRealtimeConnected]);
}
