/**
 * Export Routes
 *
 * @module api/exportRoutes
 * @description API routes for data export and reporting
 */

import { Router, Request, Response } from 'express';
import { exportService } from '../export';
import { BacktestEngine } from '../backtest/BacktestEngine';
import { createLogger } from '../utils/logger';

const log = createLogger('ExportRoutes');
const router = Router();

/**
 * GET /api/export/trades
 * Export trade history
 * Query params:
 *   - format: 'csv' | 'pdf' (default: 'csv')
 *   - strategyId: Filter by strategy ID
 *   - symbol: Filter by trading pair
 *   - side: Filter by 'buy' | 'sell'
 *   - startDate: Start date (ISO string)
 *   - endDate: End date (ISO string)
 */
router.get('/trades', async (req: Request, res: Response) => {
  try {
    const format = (req.query.format as 'csv' | 'pdf') || 'csv';
    const strategyId = req.query.strategyId as string | undefined;
    const symbol = req.query.symbol as string | undefined;
    const side = req.query.side as 'buy' | 'sell' | undefined;
    const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
    const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;

    log.info('Exporting trades', { format, strategyId, symbol, side, startDate, endDate });

    const result = await exportService.exportTrades({
      format,
      strategyId,
      symbol,
      side,
      startDate,
      endDate,
    });

    // Set response headers
    res.setHeader('Content-Type', result.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
    res.setHeader('Content-Length', result.size);

    // Send content
    if (Buffer.isBuffer(result.content)) {
      res.send(result.content);
    } else {
      res.send(result.content);
    }
  } catch (error) {
    log.error('Failed to export trades', { error });
    res.status(500).json({
      error: 'Failed to export trades',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/export/performance
 * Export performance report
 * Query params:
 *   - format: 'csv' | 'pdf' (default: 'pdf')
 *   - strategyId: Filter by strategy ID
 *   - startDate: Start date (ISO string)
 *   - endDate: End date (ISO string)
 */
router.get('/performance', async (req: Request, res: Response) => {
  try {
    const format = (req.query.format as 'csv' | 'pdf') || 'pdf';
    const strategyId = req.query.strategyId as string | undefined;
    const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
    const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;

    log.info('Exporting performance report', { format, strategyId, startDate, endDate });

    const result = await exportService.exportPerformance({
      format,
      strategyId,
      startDate,
      endDate,
    });

    // Set response headers
    res.setHeader('Content-Type', result.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
    res.setHeader('Content-Length', result.size);

    // Send content
    if (Buffer.isBuffer(result.content)) {
      res.send(result.content);
    } else {
      res.send(result.content);
    }
  } catch (error) {
    log.error('Failed to export performance report', { error });
    res.status(500).json({
      error: 'Failed to export performance report',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/export/backtest/:id
 * Export backtest results
 * Params:
 *   - id: Backtest ID (placeholder for future implementation)
 * Query params:
 *   - format: 'csv' | 'pdf' (default: 'pdf')
 *   - includeTrades: Include trade list (default: true)
 */
router.get('/backtest/:id', async (req: Request, res: Response) => {
  try {
    const backtestId = req.params.id;
    const format = (req.query.format as 'csv' | 'pdf') || 'pdf';
    const includeTrades = req.query.includeTrades !== 'false';

    log.info('Exporting backtest results', { backtestId, format, includeTrades });

    // For now, return an error as backtest storage is not implemented
    // In a full implementation, we would load the backtest result from storage
    res.status(501).json({
      error: 'Not implemented',
      message: 'Backtest result storage and retrieval is not yet implemented',
    });
  } catch (error) {
    log.error('Failed to export backtest results', { error });
    res.status(500).json({
      error: 'Failed to export backtest results',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/export/backtest
 * Export backtest results from request body
 * Body: Backtest result object
 * Query params:
 *   - format: 'csv' | 'pdf' (default: 'pdf')
 *   - includeTrades: Include trade list (default: true)
 */
router.post('/backtest', async (req: Request, res: Response) => {
  try {
    const format = (req.query.format as 'csv' | 'pdf') || 'pdf';
    const includeTrades = req.query.includeTrades !== 'false';
    const backtestResult = req.body;

    log.info('Exporting backtest results from body', { format, includeTrades });

    const result = await exportService.exportBacktest(
      {
        format,
        backtestId: 'direct',
        includeTrades,
      },
      backtestResult
    );

    // Set response headers
    res.setHeader('Content-Type', result.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
    res.setHeader('Content-Length', result.size);

    // Send content
    if (Buffer.isBuffer(result.content)) {
      res.send(result.content);
    } else {
      res.send(result.content);
    }
  } catch (error) {
    log.error('Failed to export backtest results', { error });
    res.status(500).json({
      error: 'Failed to export backtest results',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/export/portfolio
 * Export portfolio snapshot
 * Query params:
 *   - format: 'csv' | 'pdf' (default: 'csv')
 *   - includePositions: Include position details (default: true)
 */
router.get('/portfolio', async (req: Request, res: Response) => {
  try {
    const format = (req.query.format as 'csv' | 'pdf') || 'csv';
    const includePositions = req.query.includePositions !== 'false';

    log.info('Exporting portfolio snapshot', { format, includePositions });

    const result = await exportService.exportPortfolio({
      format,
      includePositions,
    });

    // Set response headers
    res.setHeader('Content-Type', result.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
    res.setHeader('Content-Length', result.size);

    // Send content
    if (Buffer.isBuffer(result.content)) {
      res.send(result.content);
    } else {
      res.send(result.content);
    }
  } catch (error) {
    log.error('Failed to export portfolio', { error });
    res.status(500).json({
      error: 'Failed to export portfolio',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
