/**
 * Backtest Analysis Routes
 *
 * @module api/backtestAnalysisRoutes
 * @description API endpoints for deep backtest analysis and reporting
 */

import { Router, Request, Response } from 'express';
import { BacktestEngine } from '../backtest/BacktestEngine';
import { BacktestConfig } from '../backtest/types';
import {
  BacktestAnalyzer,
  StrategyComparator,
  ReportGenerator,
  StrategyComparisonOptions,
  ReportExportOptions,
} from '../backtest-analysis';
import { createLogger } from '../utils/logger';

const log = createLogger('BacktestAnalysisRoutes');

const router = Router();

/**
 * POST /api/backtest-analysis/analyze
 * Run deep analysis on backtest results
 */
router.post('/analyze', async (req: Request, res: Response) => {
  try {
    const config: BacktestConfig = req.body.config;

    log.info('Running deep backtest analysis with config:', config);

    // Validate config
    if (!config) {
      return res.status(400).json({ error: 'Backtest configuration is required' });
    }

    if (!config.capital || config.capital < 100) {
      return res.status(400).json({ error: 'Initial capital must be at least 100' });
    }

    if (!config.symbol) {
      return res.status(400).json({ error: 'Symbol is required' });
    }

    if (!config.strategy) {
      return res.status(400).json({ error: 'Strategy is required' });
    }

    // Run backtest
    const engine = new BacktestEngine(config);
    const backtestResult = engine.run();

    // Generate deep analysis
    const analyzer = new BacktestAnalyzer(backtestResult);
    const report = analyzer.generateReport();

    log.info('Deep analysis completed for strategy:', config.strategy);

    res.json({
      success: true,
      report,
    });
  } catch (error: any) {
    log.error('Deep analysis failed:', error);
    res.status(500).json({
      error: error.message || 'Deep analysis failed',
    });
  }
});

/**
 * POST /api/backtest-analysis/compare
 * Compare multiple strategies
 */
router.post('/compare', async (req: Request, res: Response) => {
  try {
    const options: StrategyComparisonOptions = req.body;

    log.info('Running strategy comparison:', {
      strategies: options.strategies?.length,
      symbol: options.backtestConfig?.symbol,
    });

    // Validate
    if (!options.strategies || !Array.isArray(options.strategies) || options.strategies.length < 2) {
      return res.status(400).json({ error: 'At least 2 strategies are required for comparison' });
    }

    if (!options.backtestConfig) {
      return res.status(400).json({ error: 'Backtest configuration is required' });
    }

    // Run comparison
    const comparator = new StrategyComparator();
    const comparison = await comparator.compare(options);

    log.info('Strategy comparison completed');

    res.json({
      success: true,
      comparison,
    });
  } catch (error: any) {
    log.error('Strategy comparison failed:', error);
    res.status(500).json({
      error: error.message || 'Strategy comparison failed',
    });
  }
});

/**
 * POST /api/backtest-analysis/export
 * Export analysis report in specified format
 */
router.post('/export', async (req: Request, res: Response) => {
  try {
    const { config, exportOptions } = req.body as {
      config: BacktestConfig;
      exportOptions: ReportExportOptions;
    };

    log.info('Exporting backtest report:', { format: exportOptions?.format });

    if (!config) {
      return res.status(400).json({ error: 'Backtest configuration is required' });
    }

    if (!exportOptions || !exportOptions.format) {
      return res.status(400).json({ error: 'Export format is required' });
    }

    // Run backtest
    const engine = new BacktestEngine(config);
    const backtestResult = engine.run();

    // Generate analysis
    const analyzer = new BacktestAnalyzer(backtestResult);
    const report = analyzer.generateReport();

    // Generate export
    const generator = new ReportGenerator();
    const exportResult = await generator.generate(report, exportOptions);

    log.info('Report exported:', { filename: exportResult.filename });

    // Set response headers
    res.setHeader('Content-Type', exportResult.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${exportResult.filename}"`);

    if (Buffer.isBuffer(exportResult.content)) {
      res.send(exportResult.content);
    } else {
      res.send(exportResult.content);
    }
  } catch (error: any) {
    log.error('Report export failed:', error);
    res.status(500).json({
      error: error.message || 'Report export failed',
    });
  }
});

/**
 * POST /api/backtest-analysis/export-comparison
 * Export strategy comparison report
 */
router.post('/export-comparison', async (req: Request, res: Response) => {
  try {
    const { comparisonOptions, exportOptions } = req.body as {
      comparisonOptions: StrategyComparisonOptions;
      exportOptions: ReportExportOptions;
    };

    log.info('Exporting comparison report:', { format: exportOptions?.format });

    if (!comparisonOptions) {
      return res.status(400).json({ error: 'Comparison options are required' });
    }

    if (!exportOptions || !exportOptions.format) {
      return res.status(400).json({ error: 'Export format is required' });
    }

    // Run comparison
    const comparator = new StrategyComparator();
    const comparison = await comparator.compare(comparisonOptions);

    // Generate export
    const generator = new ReportGenerator();
    const exportResult = await generator.generateComparisonReport(comparison, exportOptions);

    log.info('Comparison report exported:', { filename: exportResult.filename });

    // Set response headers
    res.setHeader('Content-Type', exportResult.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${exportResult.filename}"`);

    if (Buffer.isBuffer(exportResult.content)) {
      res.send(exportResult.content);
    } else {
      res.send(exportResult.content);
    }
  } catch (error: any) {
    log.error('Comparison export failed:', error);
    res.status(500).json({
      error: error.message || 'Comparison export failed',
    });
  }
});

/**
 * GET /api/backtest-analysis/metrics
 * Get list of available analysis metrics
 */
router.get('/metrics', (req: Request, res: Response) => {
  res.json({
    metrics: [
      {
        category: 'basic',
        metrics: [
          { id: 'totalReturn', name: '总回报率', description: '策略的总收益率百分比' },
          { id: 'annualizedReturn', name: '年化回报率', description: '年化收益率' },
          { id: 'maxDrawdown', name: '最大回撤', description: '最大资金回撤百分比' },
          { id: 'sharpeRatio', name: '夏普比率', description: '风险调整后收益' },
          { id: 'winRate', name: '胜率', description: '盈利交易占比' },
          { id: 'profitFactor', name: '盈亏比', description: '总盈利与总亏损比' },
        ],
      },
      {
        category: 'risk',
        metrics: [
          { id: 'sortinoRatio', name: '索提诺比率', description: '下行风险调整后收益' },
          { id: 'calmarRatio', name: '卡尔马比率', description: '年化收益与最大回撤比' },
          { id: 'volatility', name: '波动率', description: '年化收益率标准差' },
          { id: 'var95', name: 'VaR 95%', description: '95%置信度下的最大损失' },
          { id: 'cvar95', name: 'CVaR 95%', description: '极端损失的平均值' },
        ],
      },
      {
        category: 'drawdown',
        metrics: [
          { id: 'maxDrawdownDuration', name: '最大回撤持续时间', description: '从高点恢复所需的最长时间' },
          { id: 'recoveryFactor', name: '恢复因子', description: '总收益与最大回撤比' },
          { id: 'timeUnderwater', name: '水下时间占比', description: '资金低于历史高点的比例' },
        ],
      },
      {
        category: 'trade',
        metrics: [
          { id: 'avgWin', name: '平均盈利', description: '单笔盈利交易的平均利润' },
          { id: 'avgLoss', name: '平均亏损', description: '单笔亏损交易的平均损失' },
          { id: 'expectancy', name: '期望值', description: '每笔交易的预期收益' },
          { id: 'maxConsecutiveLosses', name: '最大连续亏损', description: '连续亏损交易的最大次数' },
        ],
      },
    ],
  });
});

/**
 * GET /api/backtest-analysis/export-formats
 * Get list of available export formats
 */
router.get('/export-formats', (req: Request, res: Response) => {
  res.json({
    formats: [
      { id: 'pdf', name: 'PDF', description: '便携式文档格式，适合打印和分享' },
      { id: 'excel', name: 'Excel/CSV', description: '电子表格格式，适合数据分析' },
      { id: 'json', name: 'JSON', description: 'JSON 格式，适合程序化处理' },
    ],
  });
});

/**
 * POST /api/backtest-analysis/export-with-share
 * Export analysis report with shareable link
 */
router.post('/export-with-share', async (req: Request, res: Response) => {
  try {
    const { config, exportOptions, shareOptions } = req.body as {
      config: BacktestConfig;
      exportOptions: ReportExportOptions;
      shareOptions?: { generateLink?: boolean; linkExpirationHours?: number };
    };

    log.info('Exporting backtest report with share:', { format: exportOptions?.format });

    if (!config) {
      return res.status(400).json({ error: 'Backtest configuration is required' });
    }

    if (!exportOptions || !exportOptions.format) {
      return res.status(400).json({ error: 'Export format is required' });
    }

    // Run backtest
    const engine = new BacktestEngine(config);
    const backtestResult = engine.run();

    // Generate analysis
    const analyzer = new BacktestAnalyzer(backtestResult);
    const report = analyzer.generateReport();

    // Generate export with share
    const generator = new ReportGenerator();
    const exportResult = await generator.generateWithShare(report, exportOptions, shareOptions);

    log.info('Report exported with share:', {
      filename: exportResult.filename,
      shareLink: exportResult.share?.link,
    });

    // Return export result with share info
    res.json({
      success: true,
      filename: exportResult.filename,
      size: exportResult.size,
      contentType: exportResult.contentType,
      share: exportResult.share,
      // Include the content as base64 for download
      content: exportResult.content.toString('base64'),
    });
  } catch (error: any) {
    log.error('Report export with share failed:', error);
    res.status(500).json({
      error: error.message || 'Report export failed',
    });
  }
});

export default router;