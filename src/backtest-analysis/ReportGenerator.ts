/**
 * Report Generator
 *
 * @module backtest-analysis/ReportGenerator
 * @description Generate detailed reports from backtest analysis
 */

import {
  DeepAnalysisReport,
  ComparisonReport,
  ReportExportOptions,
  EquityCurvePoint,
  TradeAnalysis,
  MonthlyPerformance,
} from './types';
import { PerformanceScorecard } from './types';
import * as fs from 'fs';
import * as path from 'path';

/**
 * ReportGenerator
 * Generates formatted reports in various formats
 */
export class ReportGenerator {
  /**
   * Generate report in specified format
   */
  async generate(report: DeepAnalysisReport, options: ReportExportOptions): Promise<{
    content: string | Buffer;
    contentType: string;
    filename: string;
  }> {
    switch (options.format) {
      case 'pdf':
        return this.generatePDF(report, options);
      case 'excel':
        return this.generateExcel(report, options);
      case 'json':
      default:
        return this.generateJSON(report, options);
    }
  }

  /**
   * Generate comparison report
   */
  async generateComparisonReport(
    comparison: ComparisonReport,
    options: ReportExportOptions
  ): Promise<{
    content: string | Buffer;
    contentType: string;
    filename: string;
  }> {
    switch (options.format) {
      case 'pdf':
        return this.generateComparisonPDF(comparison, options);
      case 'excel':
        return this.generateComparisonExcel(comparison, options);
      case 'json':
      default:
        return this.generateComparisonJSON(comparison, options);
    }
  }

  /**
   * Generate JSON report
   */
  private generateJSON(
    report: DeepAnalysisReport,
    options: ReportExportOptions
  ): { content: string; contentType: string; filename: string } {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = options.title 
      ? `${options.title.replace(/\s+/g, '_')}_${timestamp}.json`
      : `backtest_report_${timestamp}.json`;

    return {
      content: JSON.stringify(report, null, 2),
      contentType: 'application/json',
      filename,
    };
  }

  /**
   * Generate PDF report
   */
  private async generatePDF(
    report: DeepAnalysisReport,
    options: ReportExportOptions
  ): Promise<{ content: Buffer; contentType: string; filename: string }> {
    // Use pdfmake 0.3.x API
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { createPdf } = require('pdfmake');

    const content: any[] = [
      // Title
      {
        text: options.title || '深度回测分析报告',
        style: 'header',
        alignment: 'center',
        margin: [0, 0, 0, 20] as [number, number, number, number],
      },
      // Generation info
      {
        text: `生成时间: ${new Date(report.generatedAt).toLocaleString('zh-CN')}`,
        style: 'subheader',
        alignment: 'right',
        margin: [0, 0, 0, 20] as [number, number, number, number],
      },
    ];

    // Configuration section
    content.push(
      this.generateConfigSection(report),
      this.generateBasicStatsSection(report),
      this.generateRiskMetricsSection(report),
      this.generateScorecardSection(report.performanceScorecard)
    );

    // Optional sections
    if (options.includeEquityCurve !== false && report.equityCurve.length > 0) {
      content.push(this.generateEquityCurveSection(report.equityCurve));
    }

    if (options.includeMonthlyBreakdown !== false && report.monthlyPerformance.length > 0) {
      content.push(this.generateMonthlySection(report.monthlyPerformance));
    }

    if (options.includeDistribution !== false) {
      content.push(this.generateDistributionSection(report));
    }

    if (options.includeRecommendations !== false && report.recommendations.length > 0) {
      content.push(this.generateRecommendationsSection(report.recommendations));
    }

    const docDefinition = {
      pageSize: 'A4' as const,
      pageMargins: [40, 60, 40, 60],
      content,
      styles: {
        header: { fontSize: 20, bold: true },
        subheader: { fontSize: 10, color: '#666666' },
        sectionHeader: { fontSize: 14, bold: true, margin: [0, 15, 0, 5] as [number, number, number, number] },
        tableHeader: { bold: true, fontSize: 9, fillColor: '#EEEEEE' },
      },
      defaultStyle: { font: 'Helvetica' as const },
    };

    return new Promise((resolve, reject) => {
      try {
        const pdfDoc = createPdf(docDefinition);
        pdfDoc.getBuffer((buffer: Buffer) => {
          const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
          const filename = options.title 
            ? `${options.title.replace(/\s+/g, '_')}_${timestamp}.pdf`
            : `backtest_report_${timestamp}.pdf`;

          resolve({ content: buffer, contentType: 'application/pdf', filename });
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Generate Excel report
   */
  private async generateExcel(
    report: DeepAnalysisReport,
    options: ReportExportOptions
  ): Promise<{ content: Buffer; contentType: string; filename: string }> {
    // Simplified Excel generation using CSV format for now
    // A full implementation would use a library like exceljs
    const sheets: string[] = [];

    // Summary sheet
    sheets.push(this.generateSummaryCSV(report));

    // Equity curve sheet
    if (options.includeEquityCurve !== false) {
      sheets.push(this.generateEquityCurveCSV(report.equityCurve));
    }

    // Monthly performance sheet
    if (options.includeMonthlyBreakdown !== false) {
      sheets.push(this.generateMonthlyCSV(report.monthlyPerformance));
    }

    // Trade list sheet
    if (options.includeTradeList !== false && report.tradeAnalysis.length > 0) {
      sheets.push(this.generateTradeListCSV(report.tradeAnalysis));
    }

    const content = sheets.join('\n\n--- Sheet ---\n\n');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = options.title 
      ? `${options.title.replace(/\s+/g, '_')}_${timestamp}.csv`
      : `backtest_report_${timestamp}.csv`;

    return {
      content: Buffer.from(content, 'utf-8'),
      contentType: 'text/csv',
      filename,
    };
  }

  /**
   * Generate configuration section for PDF
   */
  private generateConfigSection(report: DeepAnalysisReport): any {
    return {
      stack: [
        { text: '回测配置', style: 'sectionHeader' },
        {
          table: {
            headerRows: 0,
            widths: ['40%', '60%'],
            body: [
              ['交易对', report.config.symbol],
              ['策略', report.config.strategy],
              ['初始资金', `$${report.config.initialCapital.toFixed(2)}`],
              ['开始时间', new Date(report.config.startTime).toLocaleDateString('zh-CN')],
              ['结束时间', new Date(report.config.endTime).toLocaleDateString('zh-CN')],
              ['回测时长', `${(report.config.duration / 1000).toFixed(2)}秒`],
            ],
          },
          layout: 'noBorders',
        },
      ],
      margin: [0, 0, 0, 20] as [number, number, number, number],
    };
  }

  /**
   * Generate basic stats section for PDF
   */
  private generateBasicStatsSection(report: DeepAnalysisReport): any {
    const stats = report.basicStats;
    return {
      stack: [
        { text: '基础统计', style: 'sectionHeader' },
        {
          table: {
            headerRows: 0,
            widths: ['50%', '50%'],
            body: [
              ['总回报率', `${stats.totalReturn.toFixed(2)}%`],
              ['年化回报率', `${stats.annualizedReturn.toFixed(2)}%`],
              ['最大回撤', `${stats.maxDrawdown.toFixed(2)}%`],
              ['夏普比率', stats.sharpeRatio.toFixed(4)],
              ['总交易数', stats.totalTrades.toString()],
              ['盈利交易', stats.winningTrades.toString()],
              ['亏损交易', stats.losingTrades.toString()],
              ['胜率', `${stats.winRate.toFixed(2)}%`],
              ['平均盈利', `$${stats.avgWin.toFixed(2)}`],
              ['平均亏损', `$${stats.avgLoss.toFixed(2)}`],
              ['盈亏比', stats.profitFactor.toFixed(4)],
            ],
          },
          layout: 'noBorders',
        },
      ],
      margin: [0, 0, 0, 20] as [number, number, number, number],
    };
  }

  /**
   * Generate risk metrics section for PDF
   */
  private generateRiskMetricsSection(report: DeepAnalysisReport): any {
    const risk = report.riskMetrics;
    return {
      stack: [
        { text: '风险指标', style: 'sectionHeader' },
        {
          table: {
            headerRows: 0,
            widths: ['50%', '50%'],
            body: [
              ['夏普比率', risk.sharpeRatio.toFixed(4)],
              ['索提诺比率', risk.sortinoRatio.toFixed(4)],
              ['卡尔马比率', risk.calmarRatio.toFixed(4)],
              ['年化波动率', `${(risk.volatility * 100).toFixed(2)}%`],
              ['下行偏差', `${(risk.downsideDeviation * 100).toFixed(2)}%`],
              ['VaR (95%)', `${(risk.var95 * 100).toFixed(2)}%`],
              ['CVaR (95%)', `${(risk.cvar95 * 100).toFixed(2)}%`],
              ['最大连续亏损', risk.maxConsecutiveLosses.toString()],
              ['最大连续盈利', risk.maxConsecutiveWins.toString()],
            ],
          },
          layout: 'noBorders',
        },
      ],
      margin: [0, 0, 0, 20] as [number, number, number, number],
    };
  }

  /**
   * Generate scorecard section for PDF
   */
  private generateScorecardSection(scorecard: PerformanceScorecard): any {
    return {
      stack: [
        { text: '综合评分', style: 'sectionHeader' },
        {
          table: {
            headerRows: 0,
            widths: ['40%', '30%', '30%'],
            body: [
              ['评分维度', '分数', '权重'],
              ['综合评分', { text: scorecard.overallScore.toFixed(1), bold: true }, '-'],
              ...scorecard.breakdown.map(b => [
                b.category,
                b.score.toFixed(1),
                `${(b.weight * 100).toFixed(0)}%`,
              ]),
            ],
          },
          layout: {
            hLineWidth: () => 1,
            vLineWidth: () => 1,
            hLineColor: () => '#CCCCCC',
            vLineColor: () => '#CCCCCC',
          },
        },
      ],
      margin: [0, 0, 0, 20] as [number, number, number, number],
    };
  }

  /**
   * Generate equity curve section for PDF
   */
  private generateEquityCurveSection(equityCurve: EquityCurvePoint[]): any {
    // Sample data for display (show first 20 and last 20)
    const samplePoints = equityCurve.length <= 40 
      ? equityCurve 
      : [
          ...equityCurve.slice(0, 20),
          ...equityCurve.slice(-20),
        ];

    const tableBody: any[][] = [
      [
        { text: '时间', style: 'tableHeader' },
        { text: '资产价值', style: 'tableHeader' },
        { text: '回撤%', style: 'tableHeader' },
        { text: '累计回报%', style: 'tableHeader' },
      ],
    ];

    for (const point of samplePoints) {
      tableBody.push([
        new Date(point.timestamp).toLocaleDateString('zh-CN'),
        `$${point.value.toFixed(2)}`,
        `${point.drawdownPercent.toFixed(2)}%`,
        `${point.cumulativeReturn.toFixed(2)}%`,
      ]);
    }

    return {
      stack: [
        { text: '资金曲线', style: 'sectionHeader' },
        {
          text: `数据点总数: ${equityCurve.length}`,
          style: 'subheader',
          margin: [0, 0, 0, 5] as [number, number, number, number],
        },
        {
          table: {
            headerRows: 1,
            widths: ['*', 'auto', 'auto', 'auto'],
            body: tableBody,
          },
          layout: {
            hLineWidth: () => 1,
            vLineWidth: () => 1,
            hLineColor: () => '#CCCCCC',
            vLineColor: () => '#CCCCCC',
          },
        },
      ],
      margin: [0, 0, 0, 20] as [number, number, number, number],
    };
  }

  /**
   * Generate monthly section for PDF
   */
  private generateMonthlySection(monthly: MonthlyPerformance[]): any {
    const tableBody: any[][] = [
      [
        { text: '月份', style: 'tableHeader' },
        { text: '回报率%', style: 'tableHeader' },
        { text: '交易数', style: 'tableHeader' },
        { text: '胜率%', style: 'tableHeader' },
        { text: '最大回撤%', style: 'tableHeader' },
      ],
    ];

    for (const m of monthly) {
      tableBody.push([
        `${m.year}/${m.month.toString().padStart(2, '0')}`,
        {
          text: m.returnPercent.toFixed(2),
          color: m.returnPercent >= 0 ? 'green' : 'red',
        },
        m.trades.toString(),
        `${m.winRate.toFixed(1)}%`,
        `${m.maxDrawdown.toFixed(2)}%`,
      ]);
    }

    return {
      stack: [
        { text: '月度表现', style: 'sectionHeader' },
        {
          table: {
            headerRows: 1,
            widths: ['auto', 'auto', 'auto', 'auto', 'auto'],
            body: tableBody,
          },
          layout: {
            hLineWidth: () => 1,
            vLineWidth: () => 1,
            hLineColor: () => '#CCCCCC',
            vLineColor: () => '#CCCCCC',
          },
        },
      ],
      margin: [0, 0, 0, 20] as [number, number, number, number],
    };
  }

  /**
   * Generate distribution section for PDF
   */
  private generateDistributionSection(report: DeepAnalysisReport): any {
    const dist = report.tradeDistribution;
    
    return {
      stack: [
        { text: '交易分布', style: 'sectionHeader' },
        {
          columns: [
            {
              width: '*',
              stack: [
                { text: '按交易量分布', bold: true },
                ...dist.bySize.map(s => ({
                  text: `${s.label}: ${s.count}笔`,
                  fontSize: 9,
                })),
              ],
            },
            {
              width: '*',
              stack: [
                { text: '按持续时间分布', bold: true },
                ...dist.byDuration.map(d => ({
                  text: `${d.label}: ${d.count}笔`,
                  fontSize: 9,
                })),
              ],
            },
          ],
        },
      ],
      margin: [0, 0, 0, 20] as [number, number, number, number],
    };
  }

  /**
   * Generate recommendations section for PDF
   */
  private generateRecommendationsSection(recommendations: string[]): any {
    return {
      stack: [
        { text: '策略建议', style: 'sectionHeader' },
        {
          ul: recommendations.map(r => ({
            text: r,
            fontSize: 10,
          })),
        },
      ],
      margin: [0, 0, 0, 20] as [number, number, number, number],
    };
  }

  /**
   * Generate summary CSV
   */
  private generateSummaryCSV(report: DeepAnalysisReport): string {
    const lines: string[] = [
      '指标,数值',
      `总回报率,${report.basicStats.totalReturn.toFixed(2)}%`,
      `年化回报率,${report.basicStats.annualizedReturn.toFixed(2)}%`,
      `最大回撤,${report.basicStats.maxDrawdown.toFixed(2)}%`,
      `夏普比率,${report.basicStats.sharpeRatio.toFixed(4)}`,
      `总交易数,${report.basicStats.totalTrades}`,
      `胜率,${report.basicStats.winRate.toFixed(2)}%`,
      `盈亏比,${report.basicStats.profitFactor.toFixed(4)}`,
      `综合评分,${report.performanceScorecard.overallScore.toFixed(1)}`,
    ];
    return lines.join('\n');
  }

  /**
   * Generate equity curve CSV
   */
  private generateEquityCurveCSV(equityCurve: EquityCurvePoint[]): string {
    const lines: string[] = [
      '时间,资产价值,现金,持仓价值,回撤,回撤%,累计回报%',
      ...equityCurve.map(p => 
        `${new Date(p.timestamp).toISOString()},${p.value.toFixed(2)},${p.cash.toFixed(2)},${p.positionValue.toFixed(2)},${p.drawdown.toFixed(2)},${p.drawdownPercent.toFixed(4)},${p.cumulativeReturn.toFixed(4)}`
      ),
    ];
    return lines.join('\n');
  }

  /**
   * Generate monthly performance CSV
   */
  private generateMonthlyCSV(monthly: MonthlyPerformance[]): string {
    const lines: string[] = [
      '年,月,回报率%,交易数,胜率%,最大回撤%,总盈亏',
      ...monthly.map(m => 
        `${m.year},${m.month},${m.returnPercent.toFixed(4)},${m.trades},${m.winRate.toFixed(2)},${m.maxDrawdown.toFixed(2)},${m.totalPnL.toFixed(2)}`
      ),
    ];
    return lines.join('\n');
  }

  /**
   * Generate trade list CSV
   */
  private generateTradeListCSV(trades: TradeAnalysis[]): string {
    const lines: string[] = [
      'ID,入场时间,出场时间,方向,入场价,出场价,数量,盈亏,盈亏%,持续时间(ms),是否盈利',
      ...trades.map(t => 
        `${t.id},${new Date(t.entryTime).toISOString()},${new Date(t.exitTime).toISOString()},${t.side},${t.entryPrice.toFixed(4)},${t.exitPrice.toFixed(4)},${t.quantity.toFixed(4)},${t.pnl.toFixed(4)},${t.pnlPercent.toFixed(4)},${t.duration},${t.isWinner}`
      ),
    ];
    return lines.join('\n');
  }

  /**
   * Generate comparison PDF
   */
  private async generateComparisonPDF(
    comparison: ComparisonReport,
    options: ReportExportOptions
  ): Promise<{ content: Buffer; contentType: string; filename: string }> {
    // Use pdfmake 0.3.x API
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { createPdf } = require('pdfmake');

    const content: any[] = [
      {
        text: options.title || '策略对比报告',
        style: 'header',
        alignment: 'center',
        margin: [0, 0, 0, 20] as [number, number, number, number],
      },
      {
        text: `生成时间: ${new Date(comparison.generatedAt).toLocaleString('zh-CN')}`,
        style: 'subheader',
        alignment: 'right',
        margin: [0, 0, 0, 20] as [number, number, number, number],
      },
      // Summary
      {
        text: '对比摘要',
        style: 'sectionHeader',
      },
      {
        table: {
          headerRows: 0,
          widths: ['50%', '50%'],
          body: [
            ['最佳综合表现', comparison.summary.bestOverall],
            ['最高回报', comparison.summary.bestReturn],
            ['最低风险', comparison.summary.lowestRisk],
            ['最高夏普比率', comparison.summary.highestSharpe],
            ['最稳定', comparison.summary.mostConsistent],
          ],
        },
        layout: 'noBorders',
        margin: [0, 0, 0, 20] as [number, number, number, number],
      },
      // Rankings table
      this.generateRankingsTable(comparison.rankings),
      // Detailed comparison
      this.generateDetailedComparisonTable(comparison.results),
    ];

    const docDefinition = {
      pageSize: 'A4' as const,
      pageOrientation: 'landscape' as const,
      pageMargins: [40, 60, 40, 60],
      content,
      styles: {
        header: { fontSize: 20, bold: true },
        subheader: { fontSize: 10, color: '#666666' },
        sectionHeader: { fontSize: 14, bold: true, margin: [0, 15, 0, 5] as [number, number, number, number] },
        tableHeader: { bold: true, fontSize: 9, fillColor: '#EEEEEE' },
      },
      defaultStyle: { font: 'Helvetica' as const },
    };

    return new Promise((resolve, reject) => {
      try {
        const pdfDoc = createPdf(docDefinition);
        pdfDoc.getBuffer((buffer: Buffer) => {
          const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
          resolve({
            content: buffer,
            contentType: 'application/pdf',
            filename: `strategy_comparison_${timestamp}.pdf`,
          });
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Generate rankings table
   */
  private generateRankingsTable(rankings: any[]): any {
    // Find overall ranking
    const overall = rankings.find(r => r.metric === '综合评分');
    
    if (!overall) return {};

    return {
      stack: [
        { text: '综合排名', style: 'sectionHeader' },
        {
          table: {
            headerRows: 1,
            widths: ['auto', '*', 'auto'],
            body: [
              [
                { text: '排名', style: 'tableHeader' },
                { text: '策略', style: 'tableHeader' },
                { text: '分数', style: 'tableHeader' },
              ],
              ...overall.rankings.map((r: any) => [
                r.rank.toString(),
                r.strategyName,
                r.value.toFixed(2),
              ]),
            ],
          },
          layout: {
            hLineWidth: () => 1,
            vLineWidth: () => 1,
            hLineColor: () => '#CCCCCC',
            vLineColor: () => '#CCCCCC',
          },
        },
      ],
      margin: [0, 0, 0, 20] as [number, number, number, number],
    };
  }

  /**
   * Generate detailed comparison table
   */
  private generateDetailedComparisonTable(results: any[]): any {
    const headerRow = [
      { text: '指标', style: 'tableHeader' },
      ...results.map(r => ({ text: r.strategyName, style: 'tableHeader' })),
    ];

    const metrics = [
      { label: '总回报率%', key: 'stats.totalReturn', format: (v: number) => v.toFixed(2) },
      { label: '年化回报%', key: 'stats.annualizedReturn', format: (v: number) => v.toFixed(2) },
      { label: '夏普比率', key: 'riskMetrics.sharpeRatio', format: (v: number) => v.toFixed(4) },
      { label: '最大回撤%', key: 'stats.maxDrawdown', format: (v: number) => v.toFixed(2) },
      { label: '总交易数', key: 'stats.totalTrades', format: (v: number) => v.toString() },
      { label: '胜率%', key: 'stats.winRate', format: (v: number) => v.toFixed(1) },
      { label: '盈亏比', key: 'stats.profitFactor', format: (v: number) => v.toFixed(2) },
      { label: '恢复因子', key: 'drawdownAnalysis.recoveryFactor', format: (v: number) => v.toFixed(2) },
    ];

    const body = [
      headerRow,
      ...metrics.map(m => [
        m.label,
        ...results.map(r => {
          const value = this.getNestedValue(r, m.key);
          return m.format(value);
        }),
      ]),
    ];

    return {
      stack: [
        { text: '详细对比', style: 'sectionHeader' },
        {
          table: {
            headerRows: 1,
            widths: ['auto', ...results.map(() => '*')],
            body,
          },
          layout: {
            hLineWidth: () => 1,
            vLineWidth: () => 1,
            hLineColor: () => '#CCCCCC',
            vLineColor: () => '#CCCCCC',
          },
        },
      ],
    };
  }

  /**
   * Get nested value from object
   */
  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((o, k) => (o && o[k] !== undefined) ? o[k] : 0, obj);
  }

  /**
   * Generate comparison Excel
   */
  private async generateComparisonExcel(
    comparison: ComparisonReport,
    options: ReportExportOptions
  ): Promise<{ content: Buffer; contentType: string; filename: string }> {
    // Generate CSV format
    const lines: string[] = ['策略对比报告'];
    lines.push('');
    lines.push('摘要');
    lines.push(`最佳综合表现,${comparison.summary.bestOverall}`);
    lines.push(`最高回报,${comparison.summary.bestReturn}`);
    lines.push(`最低风险,${comparison.summary.lowestRisk}`);
    lines.push('');
    lines.push('详细对比');
    
    // Header
    const headers = ['指标', ...comparison.results.map(r => r.strategyName)];
    lines.push(headers.join(','));
    
    // Metrics
    const metrics = [
      { label: '总回报率%', key: 'stats.totalReturn' },
      { label: '年化回报%', key: 'stats.annualizedReturn' },
      { label: '夏普比率', key: 'riskMetrics.sharpeRatio' },
      { label: '最大回撤%', key: 'stats.maxDrawdown' },
      { label: '总交易数', key: 'stats.totalTrades' },
      { label: '胜率%', key: 'stats.winRate' },
      { label: '盈亏比', key: 'stats.profitFactor' },
    ];

    for (const m of metrics) {
      const values = comparison.results.map(r => {
        const v = this.getNestedValue(r, m.key);
        return typeof v === 'number' ? v.toFixed(2) : v;
      });
      lines.push(`${m.label},${values.join(',')}`);
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    return {
      content: Buffer.from(lines.join('\n'), 'utf-8'),
      contentType: 'text/csv',
      filename: `strategy_comparison_${timestamp}.csv`,
    };
  }

  /**
   * Generate comparison JSON
   */
  private generateComparisonJSON(
    comparison: ComparisonReport,
    options: ReportExportOptions
  ): { content: string; contentType: string; filename: string } {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    return {
      content: JSON.stringify(comparison, null, 2),
      contentType: 'application/json',
      filename: `strategy_comparison_${timestamp}.json`,
    };
  }
}