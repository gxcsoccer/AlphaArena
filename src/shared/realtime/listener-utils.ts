/**
 * Supabase Realtime Utilities
 * 
 * This module provides type-safe wrappers for Supabase Realtime operations
 * that require careful handling of internal APIs.
 */

import type { RealtimeChannel } from '@supabase/supabase-js';

/**
 * Listener filter type for broadcast events
 */
export interface BroadcastFilter {
  event: string;
}

/**
 * Listener filter type for presence events
 */
export interface PresenceFilter {
  event: 'sync' | 'join' | 'leave';
}

/**
 * Listener filter type for any realtime event
 */
export type RealtimeFilter = BroadcastFilter | PresenceFilter | Record<string, string>;

/**
 * Type definition for the internal _off method
 * 
 * Note: This uses Supabase's internal API. While this method has been stable
 * for years and is the only way to remove individual listeners, it may change
 * in future versions. We monitor Supabase releases and will update accordingly.
 * 
 * @see https://github.com/supabase/realtime-js/blob/master/src/RealtimeChannel.ts
 */
interface RealtimeChannelInternal {
  _off(type: string, filter: RealtimeFilter): RealtimeChannel;
}

/**
 * Removes a specific listener from a RealtimeChannel.
 * 
 * This function provides a type-safe wrapper around Supabase's internal \`_off\`
 * method. Using this wrapper instead of direct \`(channel as any)._off()\` calls
 * provides several benefits:
 * 
 * 1. **Type Safety**: Proper TypeScript types for filter objects
 * 2. **Centralized API**: Single place to update if Supabase changes their API
 * 3. **Documentation**: Clear documentation of the risk and rationale
 * 4. **Testing**: Easier to mock and test
 * 
 * @param channel - The RealtimeChannel to remove the listener from
 * @param type - The event type ('broadcast', 'presence', or 'postgres_changes')
 * @param filter - The filter object that was used when subscribing
 * 
 * @example
 * // Remove a broadcast listener
 * removeChannelListener(channel, 'broadcast', { event: 'orderbook-update' });
 * 
 * @example
 * // Remove a presence listener
 * removeChannelListener(channel, 'presence', { event: 'sync' });
 * 
 * @internal This uses Supabase's internal API. See file-level documentation.
 */
export function removeChannelListener(
  channel: RealtimeChannel,
  type: 'broadcast' | 'presence' | 'postgres_changes',
  filter: RealtimeFilter
): void {
  // Access the internal _off method
  // This is safe because:
  // 1. We're using the same filter object structure that was used with \`on()\`
  // 2. The _off method has been stable since realtime-js v1
  // 3. This is the only way to remove individual listeners without unsubscribing
  //    the entire channel
  const internalChannel = channel as unknown as RealtimeChannelInternal;
  internalChannel._off(type, filter);
}

/**
 * Creates an unsubscribe function for a broadcast listener.
 * 
 * This is a convenience function that captures the channel, type, and filter
 * in a closure, returning a simple unsubscribe function.
 * 
 * @param channel - The RealtimeChannel the listener is attached to
 * @param filter - The filter object used when subscribing
 * @returns A function that removes the listener when called
 * 
 * @example
 * const unsubscribe = createBroadcastUnsubscribe(channel, { event: 'trade' });
 * // Later, when you want to unsubscribe:
 * unsubscribe();
 */
export function createBroadcastUnsubscribe(
  channel: RealtimeChannel,
  filter: BroadcastFilter
): () => void {
  return () => {
    removeChannelListener(channel, 'broadcast', filter);
  };
}

/**
 * Creates an unsubscribe function for presence listeners.
 * 
 * This handles the common pattern of subscribing to multiple presence events
 * (sync, join, leave) and needing to unsubscribe from all of them.
 * 
 * @param channel - The RealtimeChannel the listeners are attached to
 * @param events - The presence events to unsubscribe from (default: all)
 * @returns A function that removes all specified presence listeners when called
 * 
 * @example
 * const unsubscribe = createPresenceUnsubscribe(channel);
 * // Unsubscribes from sync, join, and leave events
 * unsubscribe();
 * 
 * @example
 * const unsubscribe = createPresenceUnsubscribe(channel, ['sync', 'join']);
 * // Only unsubscribes from sync and join events
 * unsubscribe();
 */
export function createPresenceUnsubscribe(
  channel: RealtimeChannel,
  events: Array<'sync' | 'join' | 'leave'> = ['sync', 'join', 'leave']
): () => void {
  return () => {
    events.forEach(event => {
      removeChannelListener(channel, 'presence', { event });
    });
  };
}

/**
 * Creates an unsubscribe function that handles both broadcast and presence listeners.
 * 
 * This is useful for components that subscribe to both broadcast and presence events
 * and need a single unsubscribe function.
 * 
 * @param channel - The RealtimeChannel the listeners are attached to
 * @param config - Configuration specifying which listeners to unsubscribe
 * @returns A function that removes all specified listeners when called
 * 
 * @example
 * const unsubscribe = createCompositeUnsubscribe(channel, {
 *   broadcasts: [{ event: 'trade' }, { event: 'orderbook' }],
 *   presence: true // Unsubscribe from all presence events
 * });
 * unsubscribe();
 */
export function createCompositeUnsubscribe(
  channel: RealtimeChannel,
  config: {
    broadcasts?: BroadcastFilter[];
    presence?: boolean | Array<'sync' | 'join' | 'leave'>;
  }
): () => void {
  return () => {
    // Unsubscribe from broadcast listeners
    if (config.broadcasts) {
      config.broadcasts.forEach(filter => {
        removeChannelListener(channel, 'broadcast', filter);
      });
    }
    
    // Unsubscribe from presence listeners
    if (config.presence) {
      const events = config.presence === true 
        ? ['sync', 'join', 'leave'] as const
        : config.presence;
      events.forEach(event => {
        removeChannelListener(channel, 'presence', { event });
      });
    }
  };
}
