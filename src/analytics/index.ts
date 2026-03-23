/**
 * Analytics Module
 *
 * Strategy performance analytics and reporting
 * User behavior tracking and analytics
 * Metrics collection and dashboard
 * Report generation
 *
 * @module analytics
 */

// Strategy performance analytics
export * from './types';
export { PerformanceAnalyticsService, performanceAnalyticsService } from './PerformanceAnalytics';

// User tracking analytics
export * from './userTracking.types';
export { UserTrackingService, userTrackingService } from './UserTrackingService';

// Metrics collection
export { MetricsService, metricsService } from './MetricsService';
export type {
  NorthStarMetric,
  SecondaryMetrics,
  MetricCalculationOptions,
  MetricSnapshot,
} from './MetricsService';

// Dashboard
export { DashboardService, dashboardService } from './DashboardService';
export type {
  DashboardOverview,
  DashboardFunnel,
  DashboardFunnelStep,
  FeatureUsagePoint,
  ActivityHeatmap,
  HeatmapCell,
  MetricTrend,
  TrendPoint,
  RealTimeStats,
} from './DashboardService';

// Report generation
export { ReportGenerator, reportGenerator } from './ReportGenerator';
export type {
  DailyReport,
  WeeklyReport,
  ReportAlert,
  AnomalyDetection,
} from './ReportGenerator';

// Error log service
export { ErrorLogService, errorLogService } from './ErrorLogService';
export type {
  ErrorLogEntry,
  ErrorSummary,
  ErrorTrend,
} from './ErrorLogService';

// Analytics export service
export { AnalyticsExportService, analyticsExportService } from './AnalyticsExportService';
export type {
  ExportOptions,
  ExportResult,
} from './AnalyticsExportService';

// Insight report service
export { InsightReportService, insightReportService } from './InsightReportService';
export type {
  InsightReport,
  InsightReportOptions,
  UserSegment,
  BehaviorPattern,
  MetricsTrend,
  OptimizationSuggestion,
  AnomalyInsight,
  JourneyInsight,
  FeatureInsight,
  ReportSchedule,
} from './InsightReportService';

// Onboarding service
export * from './onboarding.types';
export { onboardingService } from './OnboardingService';