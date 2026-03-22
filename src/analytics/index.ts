/**
 * Analytics Module
 *
 * Strategy performance analytics and reporting
 * User behavior tracking and analytics
 *
 * @module analytics
 */

// Strategy performance analytics
export * from './types';
export { PerformanceAnalyticsService, performanceAnalyticsService } from './PerformanceAnalytics';

// User tracking analytics
export * from './userTracking.types';
export { UserTrackingService, userTrackingService } from './UserTrackingService';