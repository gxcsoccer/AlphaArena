/**
 * Analytics Export Service
 *
 * Export analytics data in various formats (CSV, PDF, JSON)
 * Provides comprehensive data export for reporting and analysis
 *
 * @module analytics/AnalyticsExportService
 */

import { getSupabaseAdminClient } from '../database/client';
import { dashboardService } from './DashboardService';
import { metricsService } from './MetricsService';
import { reportGenerator } from './ReportGenerator';
import { errorLogService } from './ErrorLogService';
import { userTrackingDAO } from '../database/user-tracking.dao';
import { createLogger } from '../utils/logger';

const log = createLogger('AnalyticsExportService');

/**
 * Export options
 */
export interface ExportOptions {
  format: 'csv' | 'pdf' | 'json';
  startDate?: Date;
  endDate?: Date;
  includeRawData?: boolean;
}

/**
 * Export result
 */
export interface ExportResult {
  content: Buffer | string;
  contentType: string;
  filename: string;
  size: number;
}

/**
 * Analytics Export Service
 */
class AnalyticsExportService {
  /**
   * Export dashboard data
   */
  async exportDashboard(options: ExportOptions): Promise<ExportResult> {
    const endDate = options.endDate || new Date();
    const startDate = options.startDate || new Date(endDate.getTime() - 7 * 24 * 60 * 60 * 1000);
    const days = Math.ceil((endDate.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000));

    const dashboard = await dashboardService.getFullDashboard(days);

    switch (options.format) {
      case 'json':
        return this.exportAsJson(dashboard, 'dashboard', startDate, endDate);
      case 'csv':
        return this.exportDashboardAsCsv(dashboard, startDate, endDate);
      case 'pdf':
        return this.exportDashboardAsPdf(dashboard, startDate, endDate);
      default:
        throw new Error(`Unsupported format: ${options.format}`);
    }
  }

  /**
   * Export metrics data
   */
  async exportMetrics(options: ExportOptions): Promise<ExportResult> {
    const endDate = options.endDate || new Date();
    const startDate = options.startDate || new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000);

    const keyMetrics = await metricsService.getKeyMetrics({
      startDate,
      endDate,
    });

    // Get metric history
    const metricHistory = await Promise.all([
      metricsService.getMetricHistory('weekly_active_trading_users', 30),
      metricsService.getMetricHistory('dau', 30),
      metricsService.getMetricHistory('registration_rate', 30),
    ]);

    const data = {
      keyMetrics,
      history: {
        northStar: metricHistory[0],
        dau: metricHistory[1],
        registrationRate: metricHistory[2],
      },
      exportedAt: new Date(),
      period: { start: startDate, end: endDate },
    };

    switch (options.format) {
      case 'json':
        return this.exportAsJson(data, 'metrics', startDate, endDate);
      case 'csv':
        return this.exportMetricsAsCsv(data, startDate, endDate);
      case 'pdf':
        return this.exportMetricsAsPdf(data, startDate, endDate);
      default:
        throw new Error(`Unsupported format: ${options.format}`);
    }
  }

  /**
   * Export report
   */
  async exportReport(
    type: 'daily' | 'weekly',
    options: ExportOptions
  ): Promise<ExportResult> {
    const report = type === 'daily'
      ? await reportGenerator.generateDailyReport(options.startDate)
      : await reportGenerator.generateWeeklyReport(options.endDate);

    switch (options.format) {
      case 'json':
        return this.exportAsJson(report, `report-${type}`, 
          type === 'daily' ? new Date((report as any).date) : new Date((report as any).period.start),
          type === 'daily' ? new Date((report as any).date) : new Date((report as any).period.end)
        );
      case 'csv':
        return this.exportReportAsCsv(report, type);
      case 'pdf':
        return this.exportReportAsPdf(report, type);
      default:
        throw new Error(`Unsupported format: ${options.format}`);
    }
  }

  /**
   * Export error logs
   */
  async exportErrorLogs(options: ExportOptions): Promise<ExportResult> {
    const endDate = options.endDate || new Date();
    const startDate = options.startDate || new Date(endDate.getTime() - 7 * 24 * 60 * 60 * 1000);
    const days = Math.ceil((endDate.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000));

    const summary = await errorLogService.getErrorSummary(days);
    const trends = await errorLogService.getErrorTrends(days);

    const data = {
      summary,
      trends,
      exportedAt: new Date(),
      period: { start: startDate, end: endDate },
    };

    switch (options.format) {
      case 'json':
        return this.exportAsJson(data, 'error-logs', startDate, endDate);
      case 'csv':
        return this.exportErrorLogsAsCsv(data, startDate, endDate);
      case 'pdf':
        return this.exportErrorLogsAsPdf(data, startDate, endDate);
      default:
        throw new Error(`Unsupported format: ${options.format}`);
    }
  }

  /**
   * Export user tracking events
   */
  async exportUserTracking(options: ExportOptions & { userId?: string }): Promise<ExportResult> {
    const endDate = options.endDate || new Date();
    const startDate = options.startDate || new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000);

    const events = await userTrackingDAO.getEvents({
      startDate,
      endDate,
      userId: options.userId,
      limit: options.includeRawData ? 10000 : 1000,
    });

    const summary = await userTrackingDAO.getDailySummary(startDate, endDate);
    const engagement = await userTrackingDAO.getUserEngagementMetrics(
      Math.ceil((endDate.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000))
    );

    const data = {
      events: options.includeRawData ? events : undefined,
      summary,
      engagement,
      exportedAt: new Date(),
      period: { start: startDate, end: endDate },
    };

    switch (options.format) {
      case 'json':
        return this.exportAsJson(data, 'user-tracking', startDate, endDate);
      case 'csv':
        return this.exportUserTrackingAsCsv(data, startDate, endDate);
      case 'pdf':
        return this.exportUserTrackingAsPdf(data, startDate, endDate);
      default:
        throw new Error(`Unsupported format: ${options.format}`);
    }
  }

  /**
   * Export funnel analysis
   */
  async exportFunnels(options: ExportOptions): Promise<ExportResult> {
    const endDate = options.endDate || new Date();
    const startDate = options.startDate || new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000);
    const days = Math.ceil((endDate.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000));

    const funnels = await dashboardService.getFunnels(days);

    const data = {
      funnels,
      exportedAt: new Date(),
      period: { start: startDate, end: endDate },
    };

    switch (options.format) {
      case 'json':
        return this.exportAsJson(data, 'funnels', startDate, endDate);
      case 'csv':
        return this.exportFunnelsAsCsv(data, startDate, endDate);
      case 'pdf':
        return this.exportFunnelsAsPdf(data, startDate, endDate);
      default:
        throw new Error(`Unsupported format: ${options.format}`);
    }
  }

  /**
   * Export comprehensive analytics bundle
   */
  async exportFullAnalytics(options: ExportOptions): Promise<ExportResult> {
    const endDate = options.endDate || new Date();
    const startDate = options.startDate || new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000);
    const days = Math.ceil((endDate.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000));

    log.info('Starting full analytics export', { startDate, endDate, days });

    const [
      dashboard,
      keyMetrics,
      funnels,
      errorSummary,
      dailySummary,
      engagement,
    ] = await Promise.all([
      dashboardService.getFullDashboard(Math.min(days, 7)),
      metricsService.getKeyMetrics({ startDate, endDate }),
      dashboardService.getFunnels(days),
      errorLogService.getErrorSummary(days),
      userTrackingDAO.getDailySummary(startDate, endDate),
      userTrackingDAO.getUserEngagementMetrics(days),
    ]);

    const data = {
      dashboard,
      keyMetrics,
      funnels,
      errors: errorSummary,
      dailySummary,
      engagement,
      exportedAt: new Date(),
      period: { start: startDate, end: endDate },
    };

    switch (options.format) {
      case 'json':
        return this.exportAsJson(data, 'full-analytics', startDate, endDate);
      case 'csv':
        // For full analytics, use a ZIP file with multiple CSVs
        return this.exportFullAnalyticsAsCsvBundle(data, startDate, endDate);
      case 'pdf':
        return this.exportFullAnalyticsAsPdf(data, startDate, endDate);
      default:
        throw new Error(`Unsupported format: ${options.format}`);
    }
  }

  // ============== Format-specific implementations ==============

  private exportAsJson(
    data: any,
    name: string,
    startDate: Date,
    endDate: Date
  ): ExportResult {
    const content = JSON.stringify(data, null, 2);
    const dateRange = `${startDate.toISOString().split('T')[0]}_${endDate.toISOString().split('T')[0]}`;

    return {
      content,
      contentType: 'application/json',
      filename: `analytics_${name}_${dateRange}.json`,
      size: Buffer.byteLength(content, 'utf-8'),
    };
  }

  private exportDashboardAsCsv(
    dashboard: any,
    startDate: Date,
    endDate: Date
  ): ExportResult {
    const dateRange = `${startDate.toISOString().split('T')[0]}_${endDate.toISOString().split('T')[0]}`;
    const rows: string[] = [];

    // Overview section
    rows.push('# Dashboard Overview');
    rows.push('');
    rows.push('## North Star Metric');
    rows.push('Metric,Value,Previous Value,Change %,Trend');
    const ns = dashboard.overview.northStar;
    rows.push(`Weekly Active Trading Users,${ns.value},${ns.previousValue},${ns.changePercent.toFixed(2)},${ns.trend}`);
    rows.push('');

    // Secondary metrics
    rows.push('## Secondary Metrics');
    rows.push('Metric,Value');
    rows.push(`DAU,${dashboard.overview.metrics.engagement.dau}`);
    rows.push(`WAU,${dashboard.overview.metrics.engagement.wau}`);
    rows.push(`MAU,${dashboard.overview.metrics.engagement.mau}`);
    rows.push(`Stickiness,${dashboard.overview.metrics.engagement.stickiness.toFixed(2)}%`);
    rows.push(`Registration Rate,${dashboard.overview.metrics.registrationRate.value.toFixed(2)}%`);
    rows.push(`Avg Trades Per User,${dashboard.overview.metrics.tradingFrequency.avgTradesPerUser.toFixed(2)}`);
    rows.push('');

    // Funnel data
    rows.push('## Funnel Analysis');
    for (const [name, funnel] of Object.entries(dashboard.funnels)) {
      rows.push(`### ${name}`);
      rows.push('Step,Count,Conversion Rate,Drop-off Rate');
      for (const step of (funnel as any).steps) {
        rows.push(`${step.name},${step.count},${step.conversionRate.toFixed(2)}%,${step.dropOffRate.toFixed(2)}%`);
      }
      rows.push('');
    }

    // Feature usage
    rows.push('## Top Features');
    rows.push('Feature,Category,Usage Count,Unique Users');
    for (const f of dashboard.featureUsage) {
      rows.push(`${f.feature},${f.category},${f.usageCount},${f.uniqueUsers}`);
    }
    rows.push('');

    // Real-time stats
    rows.push('## Real-time Stats');
    rows.push('Metric,Value');
    rows.push(`Active Users,${dashboard.realtime.activeUsers}`);
    rows.push(`Page Views (Last Hour),${dashboard.realtime.pageViewsLastHour}`);
    rows.push(`Events (Last Hour),${dashboard.realtime.eventsLastHour}`);
    rows.push('');

    const content = rows.join('\n');

    return {
      content,
      contentType: 'text/csv',
      filename: `dashboard_${dateRange}.csv`,
      size: Buffer.byteLength(content, 'utf-8'),
    };
  }

  private exportDashboardAsPdf(
    dashboard: any,
    startDate: Date,
    endDate: Date
  ): ExportResult {
    // For PDF, we'll return a JSON structure that can be rendered
    // In production, this would use a PDF library
    const dateRange = `${startDate.toISOString().split('T')[0]}_${endDate.toISOString().split('T')[0]}`;

    const pdfContent = {
      title: 'Analytics Dashboard Report',
      period: { start: startDate, end: endDate },
      generatedAt: new Date(),
      data: dashboard,
    };

    // Return as JSON for now - would be converted to actual PDF in production
    const content = JSON.stringify(pdfContent, null, 2);

    return {
      content,
      contentType: 'application/json', // Would be 'application/pdf'
      filename: `dashboard_${dateRange}.json`,
      size: Buffer.byteLength(content, 'utf-8'),
    };
  }

  private exportMetricsAsCsv(
    data: any,
    startDate: Date,
    endDate: Date
  ): ExportResult {
    const dateRange = `${startDate.toISOString().split('T')[0]}_${endDate.toISOString().split('T')[0]}`;
    const rows: string[] = [];

    rows.push('# Metrics Report');
    rows.push('');
    rows.push('## Key Metrics');
    rows.push('Metric,Value,Change %,Trend');
    
    const ns = data.keyMetrics.northStar;
    rows.push(`Weekly Active Trading Users,${ns.value},${ns.changePercent.toFixed(2)},${ns.trend}`);
    
    const m = data.keyMetrics.secondary;
    rows.push(`DAU,${m.engagement.dau},-,`);
    rows.push(`WAU,${m.engagement.wau},-,`);
    rows.push(`MAU,${m.engagement.mau},-,`);
    rows.push(`Stickiness,${m.engagement.stickiness.toFixed(2)}%,-,`);
    rows.push(`Registration Rate,${m.registrationRate.value.toFixed(2)}%,${m.registrationRate.changePercent.toFixed(2)},`);
    rows.push('');

    // History data
    rows.push('## Historical Data');
    rows.push('Date,North Star,DAU,Registration Rate');
    
    const history = data.history;
    const maxLen = Math.max(
      history.northStar.length,
      history.dau.length,
      history.registrationRate.length
    );

    for (let i = 0; i < maxLen; i++) {
      const ns = history.northStar[i];
      const dau = history.dau[i];
      const reg = history.registrationRate[i];
      rows.push([
        ns?.date || dau?.date || reg?.date || '',
        ns?.value || '',
        dau?.value || '',
        reg?.value || '',
      ].join(','));
    }

    const content = rows.join('\n');

    return {
      content,
      contentType: 'text/csv',
      filename: `metrics_${dateRange}.csv`,
      size: Buffer.byteLength(content, 'utf-8'),
    };
  }

  private exportMetricsAsPdf(
    data: any,
    startDate: Date,
    endDate: Date
  ): ExportResult {
    const dateRange = `${startDate.toISOString().split('T')[0]}_${endDate.toISOString().split('T')[0]}`;

    const pdfContent = {
      title: 'Metrics Report',
      period: { start: startDate, end: endDate },
      generatedAt: new Date(),
      data,
    };

    const content = JSON.stringify(pdfContent, null, 2);

    return {
      content,
      contentType: 'application/json',
      filename: `metrics_${dateRange}.json`,
      size: Buffer.byteLength(content, 'utf-8'),
    };
  }

  private exportReportAsCsv(
    report: any,
    type: 'daily' | 'weekly'
  ): ExportResult {
    const rows: string[] = [];
    const dateStr = type === 'daily' ? report.date : report.period.end;

    rows.push(`# ${type === 'daily' ? 'Daily' : 'Weekly'} Report`);
    rows.push(`Date: ${dateStr}`);
    rows.push('');

    if (type === 'daily') {
      rows.push('## Metrics');
      rows.push('Metric,Value,Change %');
      rows.push(`DAU,${report.metrics.dau},${report.comparison.dauChange.toFixed(2)}%`);
      rows.push(`New Signups,${report.metrics.newSignups},${report.comparison.signupsChange.toFixed(2)}%`);
      rows.push(`Trades,${report.metrics.trades},${report.comparison.tradesChange.toFixed(2)}%`);
      rows.push(`Avg Session Duration,${report.metrics.avgSessionDuration.toFixed(0)}s,-`);
      rows.push('');

      rows.push('## Top Pages');
      rows.push('URL,Views');
      for (const p of report.topPages) {
        rows.push(`${p.url},${p.views}`);
      }
      rows.push('');

      rows.push('## Top Events');
      rows.push('Type,Count');
      for (const e of report.topEvents) {
        rows.push(`${e.type},${e.count}`);
      }
    } else {
      rows.push('## Summary');
      rows.push(`North Star: ${report.summary.northStar.name}`);
      rows.push(`Value: ${report.summary.northStar.value}`);
      rows.push(`Change: ${report.summary.northStar.changePercent.toFixed(2)}%`);
      rows.push('');

      rows.push('## Highlights');
      for (const h of report.summary.highlights) {
        rows.push(`- ${h}`);
      }
      rows.push('');

      rows.push('## Concerns');
      for (const c of report.summary.concerns) {
        rows.push(`- ${c}`);
      }
      rows.push('');

      rows.push('## Metrics');
      rows.push('Metric,Value');
      rows.push(`WAU,${report.metrics.wau}`);
      rows.push(`New Signups,${report.metrics.newSignups}`);
      rows.push(`Trades,${report.metrics.trades}`);
      rows.push(`7-Day Retention,${report.metrics.retention.day7.toFixed(2)}%`);
      rows.push(`Conversion Rate,${report.metrics.conversionRate.toFixed(2)}%`);
    }

    rows.push('');
    rows.push('## Alerts');
    rows.push('Type,Category,Title,Message');
    for (const a of report.alerts) {
      rows.push(`${a.type},${a.category},${a.title},"${a.message}"`);
    }

    const content = rows.join('\n');

    return {
      content,
      contentType: 'text/csv',
      filename: `report_${type}_${dateStr}.csv`,
      size: Buffer.byteLength(content, 'utf-8'),
    };
  }

  private exportReportAsPdf(
    report: any,
    type: 'daily' | 'weekly'
  ): ExportResult {
    const dateStr = type === 'daily' ? report.date : report.period.end;

    const pdfContent = {
      title: `${type === 'daily' ? 'Daily' : 'Weekly'} Report`,
      date: dateStr,
      generatedAt: report.generatedAt,
      data: report,
    };

    const content = JSON.stringify(pdfContent, null, 2);

    return {
      content,
      contentType: 'application/json',
      filename: `report_${type}_${dateStr}.json`,
      size: Buffer.byteLength(content, 'utf-8'),
    };
  }

  private exportErrorLogsAsCsv(
    data: any,
    startDate: Date,
    endDate: Date
  ): ExportResult {
    const dateRange = `${startDate.toISOString().split('T')[0]}_${endDate.toISOString().split('T')[0]}`;
    const rows: string[] = [];

    rows.push('# Error Logs Summary');
    rows.push('');
    rows.push('## Overview');
    rows.push(`Total Errors,${data.summary.totalErrors}`);
    rows.push(`Unique Errors,${data.summary.uniqueErrors}`);
    rows.push(`Error Rate (per 1k requests),${data.summary.errorRate.toFixed(2)}`);
    rows.push(`Trend,${data.summary.trend}`);
    rows.push('');

    rows.push('## Errors by Code');
    rows.push('Error Code,Count,Percentage');
    for (const e of data.summary.byErrorCode) {
      rows.push(`${e.code},${e.count},${e.percentage.toFixed(2)}%`);
    }
    rows.push('');

    rows.push('## Errors by Path');
    rows.push('Path,Count');
    for (const p of data.summary.byPath) {
      rows.push(`${p.path},${p.count}`);
    }
    rows.push('');

    rows.push('## Error Trends');
    rows.push('Date,Count');
    for (const t of data.trends) {
      rows.push(`${t.date},${t.count}`);
    }
    rows.push('');

    rows.push('## Recent Errors');
    rows.push('Timestamp,Error Code,Message,Path,Status Code,User ID');
    for (const e of data.summary.recentErrors) {
      rows.push(`${e.timestamp.toISOString()},${e.errorCode},"${e.message}",${e.path || ''},${e.statusCode},${e.userId || ''}`);
    }

    const content = rows.join('\n');

    return {
      content,
      contentType: 'text/csv',
      filename: `error-logs_${dateRange}.csv`,
      size: Buffer.byteLength(content, 'utf-8'),
    };
  }

  private exportErrorLogsAsPdf(
    data: any,
    startDate: Date,
    endDate: Date
  ): ExportResult {
    const dateRange = `${startDate.toISOString().split('T')[0]}_${endDate.toISOString().split('T')[0]}`;

    const pdfContent = {
      title: 'Error Logs Report',
      period: { start: startDate, end: endDate },
      generatedAt: new Date(),
      data,
    };

    const content = JSON.stringify(pdfContent, null, 2);

    return {
      content,
      contentType: 'application/json',
      filename: `error-logs_${dateRange}.json`,
      size: Buffer.byteLength(content, 'utf-8'),
    };
  }

  private exportUserTrackingAsCsv(
    data: any,
    startDate: Date,
    endDate: Date
  ): ExportResult {
    const dateRange = `${startDate.toISOString().split('T')[0]}_${endDate.toISOString().split('T')[0]}`;
    const rows: string[] = [];

    rows.push('# User Tracking Analytics');
    rows.push('');

    // Engagement metrics
    rows.push('## Engagement Metrics');
    rows.push('Metric,Value');
    rows.push(`DAU,${data.engagement.dau}`);
    rows.push(`WAU,${data.engagement.wau}`);
    rows.push(`MAU,${data.engagement.mau}`);
    rows.push(`Stickiness,${data.engagement.stickiness.toFixed(2)}%`);
    rows.push(`Avg Session Duration,${data.engagement.avgSessionDuration.toFixed(0)}s`);
    rows.push(`1-Day Retention,${data.engagement.retention.day1.toFixed(2)}%`);
    rows.push(`7-Day Retention,${data.engagement.retention.day7.toFixed(2)}%`);
    rows.push(`30-Day Retention,${data.engagement.retention.day30.toFixed(2)}%`);
    rows.push('');

    // Daily summary
    rows.push('## Daily Summary');
    rows.push('Date,Page Views,Unique Visitors,Sessions,Bounce Rate');
    for (const d of data.summary) {
      rows.push(`${d.date.toISOString().split('T')[0]},${d.pageViews},${d.uniqueVisitors},${d.uniqueSessions},${d.bounceRate.toFixed(2)}%`);
    }

    // Raw events if included
    if (data.events) {
      rows.push('');
      rows.push('## Raw Events');
      rows.push('Timestamp,Event Type,Event Name,User ID,Page URL');
      for (const e of data.events) {
        rows.push(`${e.occurredAt.toISOString()},${e.eventType},${e.eventName},${e.userId || ''},${e.pageUrl || ''}`);
      }
    }

    const content = rows.join('\n');

    return {
      content,
      contentType: 'text/csv',
      filename: `user-tracking_${dateRange}.csv`,
      size: Buffer.byteLength(content, 'utf-8'),
    };
  }

  private exportUserTrackingAsPdf(
    data: any,
    startDate: Date,
    endDate: Date
  ): ExportResult {
    const dateRange = `${startDate.toISOString().split('T')[0]}_${endDate.toISOString().split('T')[0]}`;

    const pdfContent = {
      title: 'User Tracking Analytics',
      period: { start: startDate, end: endDate },
      generatedAt: new Date(),
      data,
    };

    const content = JSON.stringify(pdfContent, null, 2);

    return {
      content,
      contentType: 'application/json',
      filename: `user-tracking_${dateRange}.json`,
      size: Buffer.byteLength(content, 'utf-8'),
    };
  }

  private exportFunnelsAsCsv(
    data: any,
    startDate: Date,
    endDate: Date
  ): ExportResult {
    const dateRange = `${startDate.toISOString().split('T')[0]}_${endDate.toISOString().split('T')[0]}`;
    const rows: string[] = [];

    rows.push('# Funnel Analysis');
    rows.push('');

    for (const [name, funnel] of Object.entries(data.funnels)) {
      const f = funnel as any;
      rows.push(`## ${name}`);
      rows.push(`Total Users: ${f.totalUsers}`);
      rows.push(`Completed Users: ${f.completedUsers}`);
      rows.push(`Overall Conversion: ${f.overallConversionRate.toFixed(2)}%`);
      rows.push('');
      rows.push('Step,Order,Count,Conversion Rate,Drop-off Rate');
      for (const step of f.steps) {
        rows.push(`${step.name},${step.order},${step.count},${step.conversionRate.toFixed(2)}%,${step.dropOffRate.toFixed(2)}%`);
      }
      rows.push('');
    }

    const content = rows.join('\n');

    return {
      content,
      contentType: 'text/csv',
      filename: `funnels_${dateRange}.csv`,
      size: Buffer.byteLength(content, 'utf-8'),
    };
  }

  private exportFunnelsAsPdf(
    data: any,
    startDate: Date,
    endDate: Date
  ): ExportResult {
    const dateRange = `${startDate.toISOString().split('T')[0]}_${endDate.toISOString().split('T')[0]}`;

    const pdfContent = {
      title: 'Funnel Analysis',
      period: { start: startDate, end: endDate },
      generatedAt: new Date(),
      data,
    };

    const content = JSON.stringify(pdfContent, null, 2);

    return {
      content,
      contentType: 'application/json',
      filename: `funnels_${dateRange}.json`,
      size: Buffer.byteLength(content, 'utf-8'),
    };
  }

  private exportFullAnalyticsAsCsvBundle(
    data: any,
    startDate: Date,
    endDate: Date
  ): ExportResult {
    // For full analytics, we return a structured JSON that can be used
    // to generate multiple CSVs or a ZIP archive
    const dateRange = `${startDate.toISOString().split('T')[0]}_${endDate.toISOString().split('T')[0]}`;

    const content = JSON.stringify({
      type: 'csv-bundle',
      files: [
        { name: 'dashboard.csv', data: data.dashboard },
        { name: 'metrics.csv', data: data.keyMetrics },
        { name: 'funnels.csv', data: data.funnels },
        { name: 'errors.csv', data: data.errors },
        { name: 'daily-summary.csv', data: data.dailySummary },
        { name: 'engagement.csv', data: data.engagement },
      ],
      metadata: {
        period: { start: startDate, end: endDate },
        exportedAt: new Date(),
      },
    }, null, 2);

    return {
      content,
      contentType: 'application/json',
      filename: `full-analytics_${dateRange}.json`,
      size: Buffer.byteLength(content, 'utf-8'),
    };
  }

  private exportFullAnalyticsAsPdf(
    data: any,
    startDate: Date,
    endDate: Date
  ): ExportResult {
    const dateRange = `${startDate.toISOString().split('T')[0]}_${endDate.toISOString().split('T')[0]}`;

    const pdfContent = {
      title: 'Complete Analytics Report',
      period: { start: startDate, end: endDate },
      generatedAt: new Date(),
      data,
    };

    const content = JSON.stringify(pdfContent, null, 2);

    return {
      content,
      contentType: 'application/json',
      filename: `full-analytics_${dateRange}.json`,
      size: Buffer.byteLength(content, 'utf-8'),
    };
  }
}

// Singleton instance
export { AnalyticsExportService };
export const analyticsExportService = new AnalyticsExportService();
export default analyticsExportService;