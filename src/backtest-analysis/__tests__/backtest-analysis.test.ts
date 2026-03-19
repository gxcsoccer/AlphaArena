/**
 * Tests for Backtest Analysis Module
 *
 * @module backtest-analysis/__tests__/backtest-analysis.test
 */

import { BacktestEngine } from '../../backtest/BacktestEngine';
import { BacktestConfig } from '../../backtest/types';
import {
  BacktestAnalyzer,
  StrategyComparator,
  ReportGenerator,
} from '../index';
import {
  DeepAnalysisReport,
  StrategyComparisonOptions,
  ReportExportOptions,
} from '../types';

// Mock pdfmake before any imports that use it
jest.mock('pdfmake', () => {
  return jest.fn().mockImplementation(() => ({
    createPdfKitDocument: jest.fn().mockReturnValue({
      on: jest.fn((event: string, callback: any) => {
        if (event === 'end') {
          setTimeout(() => callback(), 10);
        }
      }),
      end: jest.fn(),
    }),
  }));
});

// Also mock createPdf export
jest.mock('pdfmake', () => {
  const mockCreatePdf = jest.fn().mockReturnValue({
    getBuffer: jest.fn((callback: (buffer: Buffer) => void) => {
      callback(Buffer.from('mock-pdf-content'));
    }),
  });
  
  return {
    __esModule: true,
    default: mockCreatePdf,
    createPdf: mockCreatePdf,
  };
});

describe('BacktestAnalyzer', () => {
  let backtestResult: any;
  let analyzer: BacktestAnalyzer;

  beforeAll(() => {
    // Create a simple backtest config
    const config: BacktestConfig = {
      capital: 10000,
      symbol: 'BTC/USDT',
      startTime: Date.now() - 30 * 24 * 60 * 60 * 1000, // 30 days ago
      endTime: Date.now(),
      strategy: 'sma',
      strategyParams: {
        shortPeriod: 5,
        longPeriod: 20,
        tradeQuantity: 1,
      },
      tickInterval: 60000, // 1 minute
    };

    // Run backtest
    const engine = new BacktestEngine(config);
    backtestResult = engine.run();
    analyzer = new BacktestAnalyzer(backtestResult);
  });

  describe('generateReport', () => {
    let report: DeepAnalysisReport;

    beforeAll(() => {
      report = analyzer.generateReport();
    });

    it('should generate a complete deep analysis report', () => {
      expect(report).toBeDefined();
      expect(report.generatedAt).toBeGreaterThan(0);
      expect(report.config).toBeDefined();
      expect(report.basicStats).toBeDefined();
      expect(report.riskMetrics).toBeDefined();
      expect(report.equityCurve).toBeDefined();
      expect(report.drawdownAnalysis).toBeDefined();
      expect(report.performanceScorecard).toBeDefined();
    });

    it('should have correct config information', () => {
      expect(report.config.symbol).toBe('BTC/USDT');
      expect(report.config.strategy).toBe('sma');
      expect(report.config.initialCapital).toBe(10000);
    });

    it('should calculate basic stats correctly', () => {
      expect(report.basicStats.initialCapital).toBe(10000);
      expect(report.basicStats.finalCapital).toBeGreaterThanOrEqual(0);
      expect(typeof report.basicStats.totalReturn).toBe('number');
      expect(typeof report.basicStats.winRate).toBe('number');
    });

    it('should calculate risk metrics', () => {
      expect(typeof report.riskMetrics.sharpeRatio).toBe('number');
      expect(typeof report.riskMetrics.sortinoRatio).toBe('number');
      expect(typeof report.riskMetrics.calmarRatio).toBe('number');
      expect(typeof report.riskMetrics.volatility).toBe('number');
      expect(typeof report.riskMetrics.maxConsecutiveLosses).toBe('number');
    });

    it('should generate equity curve with correct structure', () => {
      expect(Array.isArray(report.equityCurve)).toBe(true);
      if (report.equityCurve.length > 0) {
        const point = report.equityCurve[0];
        expect(point.timestamp).toBeDefined();
        expect(point.value).toBeDefined();
        expect(point.drawdown).toBeDefined();
        expect(point.cumulativeReturn).toBeDefined();
      }
    });

    it('should analyze drawdowns', () => {
      expect(report.drawdownAnalysis.maxDrawdown).toBeGreaterThanOrEqual(0);
      expect(report.drawdownAnalysis.recoveryFactor).toBeGreaterThanOrEqual(0);
      expect(Array.isArray(report.drawdownAnalysis.drawdownPeriods)).toBe(true);
    });

    it('should calculate performance scorecard', () => {
      expect(report.performanceScorecard.overallScore).toBeGreaterThanOrEqual(0);
      expect(report.performanceScorecard.overallScore).toBeLessThanOrEqual(100);
      expect(report.performanceScorecard.profitabilityScore).toBeGreaterThanOrEqual(0);
      expect(report.performanceScorecard.riskScore).toBeGreaterThanOrEqual(0);
      expect(Array.isArray(report.performanceScorecard.breakdown)).toBe(true);
    });

    it('should generate recommendations', () => {
      expect(Array.isArray(report.recommendations)).toBe(true);
      expect(report.recommendations.length).toBeGreaterThan(0);
      report.recommendations.forEach(rec => {
        expect(typeof rec).toBe('string');
        expect(rec.length).toBeGreaterThan(0);
      });
    });

    it('should analyze monthly performance', () => {
      expect(Array.isArray(report.monthlyPerformance)).toBe(true);
    });

    it('should analyze trade distribution', () => {
      expect(report.tradeDistribution).toBeDefined();
      expect(Array.isArray(report.tradeDistribution.byHour)).toBe(true);
      expect(report.tradeDistribution.byHour.length).toBe(24);
      expect(Array.isArray(report.tradeDistribution.byDayOfWeek)).toBe(true);
      expect(report.tradeDistribution.byDayOfWeek.length).toBe(7);
    });
  });

  describe('trade analysis', () => {
    it('should analyze individual trades', () => {
      const report = analyzer.generateReport();
      expect(Array.isArray(report.tradeAnalysis)).toBe(true);
    });
  });

  describe('position analysis', () => {
    it('should analyze positions by symbol', () => {
      const report = analyzer.generateReport();
      expect(Array.isArray(report.positionAnalysis)).toBe(true);
    });
  });
});

describe('StrategyComparator', () => {
  let comparator: StrategyComparator;
  let comparisonOptions: StrategyComparisonOptions;

  beforeAll(() => {
    comparator = new StrategyComparator();
    comparisonOptions = {
      strategies: [
        { name: 'SMA-5-20', type: 'sma', params: { shortPeriod: 5, longPeriod: 20, tradeQuantity: 1 } },
        { name: 'SMA-10-30', type: 'sma', params: { shortPeriod: 10, longPeriod: 30, tradeQuantity: 1 } },
      ],
      backtestConfig: {
        capital: 10000,
        symbol: 'BTC/USDT',
        startTime: Date.now() - 7 * 24 * 60 * 60 * 1000, // 7 days ago
        endTime: Date.now(),
        tickInterval: 60000,
      },
    };
  });

  describe('compare', () => {
    let comparison: any;

    beforeAll(async () => {
      comparison = await comparator.compare(comparisonOptions);
    });

    it('should compare multiple strategies', () => {
      expect(comparison).toBeDefined();
      expect(comparison.generatedAt).toBeGreaterThan(0);
      expect(comparison.results).toBeDefined();
      expect(comparison.results.length).toBe(2);
    });

    it('should have results for each strategy', () => {
      comparison.results.forEach((result: any) => {
        expect(result.strategyName).toBeDefined();
        expect(result.stats).toBeDefined();
        expect(result.riskMetrics).toBeDefined();
        expect(result.tradeSummary).toBeDefined();
        expect(result.drawdownAnalysis).toBeDefined();
        expect(result.returnAnalysis).toBeDefined();
      });
    });

    it('should generate rankings', () => {
      expect(Array.isArray(comparison.rankings)).toBe(true);
      expect(comparison.rankings.length).toBeGreaterThan(0);
      
      comparison.rankings.forEach((ranking: any) => {
        expect(ranking.metric).toBeDefined();
        expect(Array.isArray(ranking.rankings)).toBe(true);
        ranking.rankings.forEach((r: any) => {
          expect(r.strategyName).toBeDefined();
          expect(typeof r.value).toBe('number');
          expect(typeof r.rank).toBe('number');
        });
      });
    });

    it('should generate summary with best strategies', () => {
      expect(comparison.summary).toBeDefined();
      expect(comparison.summary.bestOverall).toBeDefined();
      expect(comparison.summary.bestReturn).toBeDefined();
      expect(comparison.summary.lowestRisk).toBeDefined();
      expect(comparison.summary.highestSharpe).toBeDefined();
    });

    it('should generate comparison charts data', () => {
      expect(comparison.comparisonCharts).toBeDefined();
      expect(Array.isArray(comparison.comparisonCharts.equityCurves)).toBe(true);
      expect(Array.isArray(comparison.comparisonCharts.drawdownComparison)).toBe(true);
    });
  });

  describe('generateComparisonTable', () => {
    it('should generate comparison table', async () => {
      const comparison = await comparator.compare(comparisonOptions);
      const table = comparator.generateComparisonTable(comparison.results);

      expect(table.headers).toBeDefined();
      expect(table.rows).toBeDefined();
      expect(table.headers.length).toBeGreaterThan(0);
      expect(table.rows.length).toBe(comparison.results.length);
    });
  });
});

describe('ReportGenerator', () => {
  let report: DeepAnalysisReport;
  let generator: ReportGenerator;

  beforeAll(() => {
    // Create a simple backtest and analysis
    const config: BacktestConfig = {
      capital: 10000,
      symbol: 'BTC/USDT',
      startTime: Date.now() - 7 * 24 * 60 * 60 * 1000,
      endTime: Date.now(),
      strategy: 'sma',
      tickInterval: 60000,
    };

    const engine = new BacktestEngine(config);
    const backtestResult = engine.run();
    const analyzer = new BacktestAnalyzer(backtestResult);
    report = analyzer.generateReport();
    generator = new ReportGenerator();
  });

  describe('generate JSON report', () => {
    it('should generate JSON format report', async () => {
      const options: ReportExportOptions = {
        format: 'json',
        includeEquityCurve: true,
        includeTradeList: true,
      };

      const result = await generator.generate(report, options);

      expect(result.content).toBeDefined();
      expect(result.contentType).toBe('application/json');
      expect(result.filename).toContain('.json');

      // Verify JSON is valid
      const parsed = JSON.parse(result.content as string);
      expect(parsed.generatedAt).toBe(report.generatedAt);
    });
  });

  describe('generate PDF report', () => {
    it('should generate PDF format report', async () => {
      const options: ReportExportOptions = {
        format: 'pdf',
        includeEquityCurve: true,
        includeMonthlyBreakdown: true,
        includeRecommendations: true,
      };

      const result = await generator.generate(report, options);

      expect(result.content).toBeDefined();
      expect(result.contentType).toBe('application/pdf');
      expect(result.filename).toContain('.pdf');
      expect(result.content).toBeInstanceOf(Buffer);
    });
  });

  describe('generate Excel report', () => {
    it('should generate CSV format report', async () => {
      const options: ReportExportOptions = {
        format: 'excel',
        includeEquityCurve: true,
        includeMonthlyBreakdown: true,
      };

      const result = await generator.generate(report, options);

      expect(result.content).toBeDefined();
      expect(result.contentType).toBe('text/csv');
      expect(result.filename).toContain('.csv');
    });
  });

  describe('report with custom title', () => {
    it('should include custom title in filename', async () => {
      const options: ReportExportOptions = {
        format: 'json',
        title: 'Custom Backtest Report',
      };

      const result = await generator.generate(report, options);
      expect(result.filename).toContain('Custom_Backtest_Report');
    });
  });

  describe('enhanced export features', () => {
    it('should include strategy name in filename', async () => {
      const options: ReportExportOptions = {
        format: 'json',
        strategyName: 'SMA_Crossover',
      };

      const result = await generator.generate(report, options);
      expect(result.filename).toContain('SMA_Crossover');
      expect(result.filename).toMatch(/SMA_Crossover_\d{4}-\d{2}-\d{2}\.json/);
    });

    it('should apply time range filter to equity curve', async () => {
      const midPoint = report.config.startTime + (report.config.endTime - report.config.startTime) / 2;
      const options: ReportExportOptions = {
        format: 'json',
        startTime: midPoint,
        endTime: report.config.endTime,
      };

      const result = await generator.generate(report, options);
      const parsed = JSON.parse(result.content as string);

      // All equity curve points should be after the startTime
      for (const point of parsed.equityCurve) {
        expect(point.timestamp).toBeGreaterThanOrEqual(midPoint);
      }
    });

    it('should apply time range filter to trade analysis', async () => {
      const midPoint = report.config.startTime + (report.config.endTime - report.config.startTime) / 2;
      const options: ReportExportOptions = {
        format: 'json',
        startTime: midPoint,
        endTime: report.config.endTime,
      };

      const result = await generator.generate(report, options);
      const parsed = JSON.parse(result.content as string);

      // All trade entries should be after the startTime
      for (const trade of parsed.tradeAnalysis) {
        expect(trade.entryTime).toBeGreaterThanOrEqual(midPoint);
      }
    });

    it('should generate CSV with complete trading details', async () => {
      const options: ReportExportOptions = {
        format: 'excel',
        includeTradeList: true,
      };

      const result = await generator.generate(report, options);
      const content = result.content.toString();

      // Check for summary section
      expect(content).toContain('# 汇总统计 Summary Statistics');
      expect(content).toContain('总回报率');

      // If there are trades, check for trade list header
      if (report.tradeAnalysis.length > 0) {
        expect(content).toContain('# 交易明细 Trade Details');
      }
    });

    it('should generate CSV with risk metrics section', async () => {
      const options: ReportExportOptions = {
        format: 'excel',
        includeRiskMetrics: true,
      };

      const result = await generator.generate(report, options);
      const content = result.content.toString();

      expect(content).toContain('# 风险指标 Risk Metrics');
      expect(content).toContain('夏普比率');
      expect(content).toContain('索提诺比率');
    });

    it('should generate CSV with drawdown analysis section', async () => {
      const options: ReportExportOptions = {
        format: 'excel',
        includeDrawdownAnalysis: true,
      };

      const result = await generator.generate(report, options);
      const content = result.content.toString();

      expect(content).toContain('# 回撤分析 Drawdown Analysis');
      expect(content).toContain('最大回撤');
    });
  });

  describe('generateWithShare', () => {
    it('should generate export with share link', async () => {
      const options: ReportExportOptions = {
        format: 'json',
        strategyName: 'TestStrategy',
      };

      const result = await generator.generateWithShare(report, options, {
        generateLink: true,
        linkExpirationHours: 24,
      });

      expect(result.content).toBeDefined();
      expect(result.filename).toContain('TestStrategy');
      expect(result.size).toBeGreaterThan(0);
      expect(result.share).toBeDefined();
      expect(result.share?.link).toContain('/share/');
      expect(result.share?.expiresAt).toBeGreaterThan(Date.now());
    });
  });
});

describe('Integration Tests', () => {
  it('should run complete analysis workflow', async () => {
    // Setup
    const config: BacktestConfig = {
      capital: 10000,
      symbol: 'BTC/USDT',
      startTime: Date.now() - 7 * 24 * 60 * 60 * 1000,
      endTime: Date.now(),
      strategy: 'sma',
      tickInterval: 60000,
    };

    // Run backtest
    const engine = new BacktestEngine(config);
    const backtestResult = engine.run();
    expect(backtestResult).toBeDefined();

    // Analyze
    const analyzer = new BacktestAnalyzer(backtestResult);
    const report = analyzer.generateReport();
    expect(report).toBeDefined();

    // Export
    const generator = new ReportGenerator();
    const exportResult = await generator.generate(report, { format: 'json' });
    expect(exportResult.content).toBeDefined();

    // Verify
    const parsed = JSON.parse(exportResult.content as string);
    expect(parsed.config.symbol).toBe('BTC/USDT');
  });

  it('should run strategy comparison workflow', async () => {
    const comparator = new StrategyComparator();
    
    const options: StrategyComparisonOptions = {
      strategies: [
        { name: 'SMA-Fast', type: 'sma', params: { shortPeriod: 5, longPeriod: 15 } },
        { name: 'SMA-Slow', type: 'sma', params: { shortPeriod: 15, longPeriod: 30 } },
      ],
      backtestConfig: {
        capital: 10000,
        symbol: 'BTC/USDT',
        startTime: Date.now() - 7 * 24 * 60 * 60 * 1000,
        endTime: Date.now(),
        tickInterval: 60000,
      },
    };

    const comparison = await comparator.compare(options);
    expect(comparison.results.length).toBe(2);
    expect(comparison.summary.bestOverall).toBeDefined();

    // Export comparison
    const generator = new ReportGenerator();
    const exportResult = await generator.generateComparisonReport(comparison, { format: 'json' });
    expect(exportResult.content).toBeDefined();
  });
});