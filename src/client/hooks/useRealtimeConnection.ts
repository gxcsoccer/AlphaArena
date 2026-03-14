import { useEffect, useRef } from 'react';
import { useConnection } from '../store/connectionStore';
import { getRealtimeClient } from '../utils/realtime';

export function useRealtimeConnection() {
  const { setStatus, updateQuality } = useConnection();
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
  }, [setStatus, updateQuality]);
}
