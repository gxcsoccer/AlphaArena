/**
 * Insight Report Routes
 *
 * API endpoints for user behavior insight reports.
 * All endpoints require authentication.
 * Admin-only endpoints are marked with requireAdmin.
 *
 * @module api/insightRoutes
 */

import { Router, Request, Response } from 'express';
import {
  insightReportService,
  InsightReport,
  InsightReportOptions,
  ReportSchedule,
} from '../analytics/InsightReportService';
import { createLogger } from '../utils/logger';
import { authMiddleware, requireAdmin } from './authMiddleware';

const log = createLogger('InsightRoutes');
const router = Router();

// All insight routes require authentication
router.use(authMiddleware);

/**
 * POST /api/insight/generate
 * Generate a new insight report (admin only)
 */
router.post('/generate', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { reportType, includeSegments, includePatterns, includeTrends, includeSuggestions, includeAnomalies, includeJourneys, includeFeatures } = req.body;

    const options: InsightReportOptions = {
      reportType: reportType || 'weekly',
      includeSegments: includeSegments !== false,
      includePatterns: includePatterns !== false,
      includeTrends: includeTrends !== false,
      includeSuggestions: includeSuggestions !== false,
      includeAnomalies: includeAnomalies !== false,
      includeJourneys: includeJourneys !== false,
      includeFeatures: includeFeatures !== false,
    };

    const report = await insightReportService.generateInsightReport(options);

    res.json({
      success: true,
      report,
    });
  } catch (error: any) {
    log.error('Failed to generate insight report:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/insight/reports
 * Get historical insight reports
 */
router.get('/reports', async (req: Request, res: Response) => {
  try {
    const { reportType, limit } = req.query;

    const reports = await insightReportService.getInsightReports(
      reportType as 'daily' | 'weekly' | 'monthly' | undefined,
      limit ? parseInt(limit as string, 10) : 30
    );

    res.json({
      success: true,
      reports,
      count: reports.length,
    });
  } catch (error: any) {
    log.error('Failed to get insight reports:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/insight/reports/latest
 * Get the latest insight report of a specific type
 */
router.get('/reports/latest', async (req: Request, res: Response) => {
  try {
    const { reportType } = req.query;

    const reports = await insightReportService.getInsightReports(
      reportType as 'daily' | 'weekly' | 'monthly' | undefined,
      1
    );

    if (reports.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'No reports found',
      });
    }

    res.json({
      success: true,
      report: reports[0],
    });
  } catch (error: any) {
    log.error('Failed to get latest insight report:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/insight/reports/:id
 * Get a specific insight report by ID
 */
router.get('/reports/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const reports = await insightReportService.getInsightReports(undefined, 100);
    const report = reports.find((r) => r.id === id);

    if (!report) {
      return res.status(404).json({
        success: false,
        error: 'Report not found',
      });
    }

    res.json({
      success: true,
      report,
    });
  } catch (error: any) {
    log.error('Failed to get insight report:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/insight/schedule/daily
 * Trigger daily insight report generation (admin only)
 */
router.post('/schedule/daily', requireAdmin, async (req: Request, res: Response) => {
  try {
    await insightReportService.scheduleReportGeneration('daily');

    res.json({
      success: true,
      message: 'Daily insight report generated successfully',
    });
  } catch (error: any) {
    log.error('Failed to generate daily insight report:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/insight/schedule/weekly
 * Trigger weekly insight report generation (admin only)
 */
router.post('/schedule/weekly', requireAdmin, async (req: Request, res: Response) => {
  try {
    await insightReportService.scheduleReportGeneration('weekly');

    res.json({
      success: true,
      message: 'Weekly insight report generated successfully',
    });
  } catch (error: any) {
    log.error('Failed to generate weekly insight report:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/insight/schedule/monthly
 * Trigger monthly insight report generation (admin only)
 */
router.post('/schedule/monthly', requireAdmin, async (req: Request, res: Response) => {
  try {
    await insightReportService.scheduleReportGeneration('monthly');

    res.json({
      success: true,
      message: 'Monthly insight report generated successfully',
    });
  } catch (error: any) {
    log.error('Failed to generate monthly insight report:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/insight/summary
 * Get quick summary of current insights (for dashboard widget)
 */
router.get('/summary', async (req: Request, res: Response) => {
  try {
    // Get the latest weekly report for summary
    const reports = await insightReportService.getInsightReports('weekly', 1);

    if (reports.length === 0) {
      return res.json({
        success: true,
        summary: {
          overview: '暂无洞察报告数据',
          keyFindings: [],
          criticalAlerts: [],
          topRecommendations: [],
        },
      });
    }

    const report = reports[0];

    res.json({
      success: true,
      summary: report.summary,
      metrics: {
        patterns: report.behaviorPatterns.length,
        suggestions: report.optimizationSuggestions.length,
        anomalies: report.anomalies.length,
        segments: report.userSegments.length,
      },
      generatedAt: report.generatedAt,
    });
  } catch (error: any) {
    log.error('Failed to get insight summary:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/insight/segments
 * Get user segments from latest report
 */
router.get('/segments', async (req: Request, res: Response) => {
  try {
    const reports = await insightReportService.getInsightReports('weekly', 1);

    if (reports.length === 0) {
      return res.json({
        success: true,
        segments: [],
      });
    }

    res.json({
      success: true,
      segments: reports[0].userSegments,
    });
  } catch (error: any) {
    log.error('Failed to get user segments:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/insight/patterns
 * Get behavior patterns from latest report
 */
router.get('/patterns', async (req: Request, res: Response) => {
  try {
    const reports = await insightReportService.getInsightReports('weekly', 1);

    if (reports.length === 0) {
      return res.json({
        success: true,
        patterns: [],
      });
    }

    res.json({
      success: true,
      patterns: reports[0].behaviorPatterns,
    });
  } catch (error: any) {
    log.error('Failed to get behavior patterns:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/insight/suggestions
 * Get optimization suggestions from latest report
 */
router.get('/suggestions', async (req: Request, res: Response) => {
  try {
    const reports = await insightReportService.getInsightReports('weekly', 1);

    if (reports.length === 0) {
      return res.json({
        success: true,
        suggestions: [],
      });
    }

    res.json({
      success: true,
      suggestions: reports[0].optimizationSuggestions,
    });
  } catch (error: any) {
    log.error('Failed to get optimization suggestions:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/insight/anomalies
 * Get anomalies from latest report
 */
router.get('/anomalies', async (req: Request, res: Response) => {
  try {
    const reports = await insightReportService.getInsightReports('weekly', 1);

    if (reports.length === 0) {
      return res.json({
        success: true,
        anomalies: [],
      });
    }

    res.json({
      success: true,
      anomalies: reports[0].anomalies,
    });
  } catch (error: any) {
    log.error('Failed to get anomalies:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/insight/trends
 * Get metrics trends from latest report
 */
router.get('/trends', async (req: Request, res: Response) => {
  try {
    const reports = await insightReportService.getInsightReports('weekly', 1);

    if (reports.length === 0) {
      return res.json({
        success: true,
        trends: [],
      });
    }

    res.json({
      success: true,
      trends: reports[0].metricsTrends,
    });
  } catch (error: any) {
    log.error('Failed to get metrics trends:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/insight/journeys
 * Get user journey insights from latest report
 */
router.get('/journeys', async (req: Request, res: Response) => {
  try {
    const reports = await insightReportService.getInsightReports('weekly', 1);

    if (reports.length === 0) {
      return res.json({
        success: true,
        journeys: [],
      });
    }

    res.json({
      success: true,
      journeys: reports[0].journeyInsights,
    });
  } catch (error: any) {
    log.error('Failed to get journey insights:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/insight/features
 * Get feature insights from latest report
 */
router.get('/features', async (req: Request, res: Response) => {
  try {
    const reports = await insightReportService.getInsightReports('weekly', 1);

    if (reports.length === 0) {
      return res.json({
        success: true,
        features: [],
      });
    }

    res.json({
      success: true,
      features: reports[0].featureInsights,
    });
  } catch (error: any) {
    log.error('Failed to get feature insights:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;