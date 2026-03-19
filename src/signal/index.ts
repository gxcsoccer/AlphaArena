/**
 * Signal Module
 * Trading signal subscription service
 */

export { TradingSignalService, getTradingSignalService } from './TradingSignalService';
export type { PublishSignalInput, SignalFeedOptions, SignalPublisherInfo } from './TradingSignalService';

export { SignalSubscriptionService, getSignalSubscriptionService } from './SignalSubscriptionService';
export type { SubscribeInput, ExecuteSignalInput, SubscriptionStats } from './SignalSubscriptionService';

export { SignalRealtimeService, getSignalRealtimeService } from './SignalRealtimeService';
export type { SignalEventType, SignalRealtimeEvent, SignalAlertEvent } from './SignalRealtimeService';
