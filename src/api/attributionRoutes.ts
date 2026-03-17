import { Router, Request, Response } from 'express';
import { AttributionDAO, AttributionFilters, AttributionPeriod } from '../database/attribution.dao';
import { authMiddleware } from './authMiddleware';
import { createLogger } from '../utils/logger';

const log = createLogger('AttributionRoutes');

export function createAttributionRouter(): Router {
  const router = Router();
  const attributionDAO = new AttributionDAO();
  router.use(authMiddleware);

  router.get('/', async (req: Request, res: Response) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });
      const period = (req.query.period as AttributionPeriod) || 'all';
      const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
      const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;
      const strategyIds = req.query.strategyIds ? (req.query.strategyIds as string).split(',') : undefined;
      const symbols = req.query.symbols ? (req.query.symbols as string).split(',') : undefined;
      const benchmarkType = req.query.benchmarkType as 'btc_hodl' | 'eth_hodl' | 'equal_weight' | 'custom' | undefined;
      const filters: AttributionFilters = { userId, period, startDate, endDate, strategyIds, symbols, benchmarkType };
      log.info('Calculating attribution for user:', userId);
      const report = await attributionDAO.calculateAttribution(filters);
      res.json({ success: true, data: report });
    } catch (error) {
      log.error('Error calculating attribution:', error);
      res.status(500).json({ error: 'Failed to calculate attribution', message: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  router.get('/strategies', async (req: Request, res: Response) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });
      const period = (req.query.period as AttributionPeriod) || 'all';
      const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
      const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;
      const filters: AttributionFilters = { userId, period, startDate, endDate };
      const report = await attributionDAO.calculateAttribution(filters);
      res.json({ success: true, data: report.strategyAttribution });
    } catch (error) {
      log.error('Error getting strategy attribution:', error);
      res.status(500).json({ error: 'Failed to get strategy attribution', message: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  router.get('/symbols', async (req: Request, res: Response) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });
      const period = (req.query.period as AttributionPeriod) || 'all';
      const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
      const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;
      const filters: AttributionFilters = { userId, period, startDate, endDate };
      const report = await attributionDAO.calculateAttribution(filters);
      res.json({ success: true, data: report.symbolAttribution });
    } catch (error) {
      log.error('Error getting symbol attribution:', error);
      res.status(500).json({ error: 'Failed to get symbol attribution', message: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  router.get('/time', async (req: Request, res: Response) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });
      const period = (req.query.period as AttributionPeriod) || 'daily';
      const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
      const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;
      const filters: AttributionFilters = { userId, period, startDate, endDate };
      const report = await attributionDAO.calculateAttribution(filters);
      res.json({ success: true, data: report.timeAttribution });
    } catch (error) {
      log.error('Error getting time attribution:', error);
      res.status(500).json({ error: 'Failed to get time attribution', message: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  router.get('/risk', async (req: Request, res: Response) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });
      const period = (req.query.period as AttributionPeriod) || 'all';
      const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
      const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;
      const filters: AttributionFilters = { userId, period, startDate, endDate };
      const report = await attributionDAO.calculateAttribution(filters);
      res.json({ success: true, data: report.riskAttribution });
    } catch (error) {
      log.error('Error getting risk attribution:', error);
      res.status(500).json({ error: 'Failed to get risk attribution', message: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  router.get('/benchmark', async (req: Request, res: Response) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });
      const period = (req.query.period as AttributionPeriod) || 'all';
      const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
      const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;
      const benchmarkType = req.query.benchmarkType as 'btc_hodl' | 'eth_hodl' | 'equal_weight' | 'custom' | undefined;
      const filters: AttributionFilters = { userId, period, startDate, endDate, benchmarkType };
      const report = await attributionDAO.calculateAttribution(filters);
      res.json({ success: true, data: report.benchmarkComparison });
    } catch (error) {
      log.error('Error getting benchmark comparison:', error);
      res.status(500).json({ error: 'Failed to get benchmark comparison', message: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  router.get('/efficiency', async (req: Request, res: Response) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });
      const period = (req.query.period as AttributionPeriod) || 'all';
      const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
      const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;
      const filters: AttributionFilters = { userId, period, startDate, endDate };
      const report = await attributionDAO.calculateAttribution(filters);
      res.json({ success: true, data: report.efficiencyMetrics });
    } catch (error) {
      log.error('Error getting efficiency metrics:', error);
      res.status(500).json({ error: 'Failed to get efficiency metrics', message: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  router.get('/charts', async (req: Request, res: Response) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });
      const period = (req.query.period as AttributionPeriod) || 'all';
      const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
      const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;
      const filters: AttributionFilters = { userId, period, startDate, endDate };
      const report = await attributionDAO.calculateAttribution(filters);
      res.json({ success: true, data: report.chartData });
    } catch (error) {
      log.error('Error getting chart data:', error);
      res.status(500).json({ error: 'Failed to get chart data', message: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  router.post('/export', async (req: Request, res: Response) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });
      const period = (req.query.period as AttributionPeriod) || 'all';
      const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
      const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;
      const filters: AttributionFilters = { userId, period, startDate, endDate };
      const report = await attributionDAO.calculateAttribution(filters);
      const downloadUrl = await attributionDAO.exportToPDF(report);
      res.json({ success: true, data: { downloadUrl, generatedAt: report.generatedAt } });
    } catch (error) {
      log.error('Error exporting report:', error);
      res.status(500).json({ error: 'Failed to export report', message: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  return router;
}
