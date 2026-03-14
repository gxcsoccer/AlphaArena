import { useEffect, useRef } from 'react';
import { useConnection } from '../store/connectionStore';
import { getRealtimeClient } from '../utils/realtime';

export function useRealtimeConnection() {
  const { setStatus, updateQuality } = useConnection();
  const clientRef = useRef<any>(null);

  useEffect(() => {
    const client = getRealtimeClient();
    clientRef.current = client;

    // Subscribe to connection state changes
    const unsubscribe = client.onConnectionChange((status: string) => {
      setStatus(status);
    });

    // Subscribe to quality changes
    const unsubscribeQuality = client.onQualityChange((quality: number) => {
      updateQuality(quality);
    });

    return () => {
      unsubscribe();
      unsubscribeQuality();
    };
  }, [setStatus, updateQuality]);
}
