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
  ShareOptions,
  ShareResult,
  EnhancedExportResult,
} from './types';
import { PerformanceScorecard } from './types';

/**
 * ReportGenerator
 * Generates formatted reports in various formats
 */
export class ReportGenerator {
  /**
   * Generate report in specified format with enhanced features
   */
  async generate(report: DeepAnalysisReport, options: ReportExportOptions): Promise<{
    content: string | Buffer;
    contentType: string;
    filename: string;
  }> {
    // Apply time range filter if specified
    const filteredReport = this.applyTimeRangeFilter(report, options);

    switch (options.format) {
      case 'pdf':
        return this.generatePDF(filteredReport, options);
      case 'excel':
        return this.generateExcel(filteredReport, options);
      case 'json':
      default:
        return this.generateJSON(filteredReport, options);
    }
  }

  /**
   * Generate enhanced export with share functionality
   */
  async generateWithShare(
    report: DeepAnalysisReport,
    options: ReportExportOptions,
    shareOptions?: ShareOptions
  ): Promise<EnhancedExportResult> {
    const result = await this.generate(report, options);

    let share: ShareResult | undefined;
    if (shareOptions?.generateLink) {
      share = await this.generateShareLink(result, shareOptions);
    }

    return {
      content: result.content,
      contentType: result.contentType,
      filename: result.filename,
      size: typeof result.content === 'string'
        ? Buffer.byteLength(result.content, 'utf-8')
        : result.content.length,
      share,
    };
  }

  /**
   * Generate shareable link for report
   */
  private async generateShareLink(
    result: { content: string | Buffer; contentType: string; filename: string },
    options: ShareOptions
  ): Promise<ShareResult> {
    const expirationHours = options.linkExpirationHours || 24;
    const expiresAt = Date.now() + expirationHours * 60 * 60 * 1000;

    // Generate a unique share ID (in production, this would be stored in a database)
    const shareId = this.generateShareId();

    // In a real implementation, this would:
    // 1. Store the report content in cloud storage (S3, GCS, etc.)
    // 2. Create a database record with the share ID and expiration
    // 3. Return the shareable URL

    // For now, we'll generate a mock share link
    // Get base URL from environment - no hardcoded fallbacks
    const baseUrl = process.env.BASE_URL || process.env.FRONTEND_URL || '';
    if (!baseUrl) {
      console.warn('[ReportGenerator] BASE_URL not configured, using relative URLs');
    }
    const link = `${baseUrl}/share/${shareId}`;

    return {
      link,
      expiresAt,
    };
  }

  /**
   * Generate a unique share ID
   */
  private generateShareId(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < 16; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  /**
   * Apply time range filter to report data
   */
  private applyTimeRangeFilter(
    report: DeepAnalysisReport,
    options: ReportExportOptions
  ): DeepAnalysisReport {
    // If no time range filter, return original report
    if (!options.startTime && !options.endTime) {
      return report;
    }

    const startTime = options.startTime || 0;
    const endTime = options.endTime || Date.now();

    // Filter equity curve
    const filteredEquityCurve = report.equityCurve.filter(
      point => point.timestamp >= startTime && point.timestamp <= endTime
    );

    // Filter trade analysis
    const filteredTradeAnalysis = report.tradeAnalysis.filter(
      trade => trade.entryTime >= startTime && trade.entryTime <= endTime
    );

    // Filter monthly performance
    const filteredMonthlyPerformance = report.monthlyPerformance.filter(month => {
      const monthStart = new Date(month.year, month.month - 1).getTime();
      const monthEnd = new Date(month.year, month.month).getTime() - 1;
      return monthStart >= startTime && monthEnd <= endTime;
    });

    return {
      ...report,
      equityCurve: filteredEquityCurve,
      tradeAnalysis: filteredTradeAnalysis,
      monthlyPerformance: filteredMonthlyPerformance,
    };
  }

  /**
   * Generate filename with strategy name and date
   */
  private generateFilename(
    options: ReportExportOptions,
    extension: string,
    prefix: string = 'backtest_report'
  ): string {
    const timestamp = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const _timeStr = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);

    // Build filename parts
    const parts: string[] = [];

    if (options.strategyName) {
      parts.push(options.strategyName.replace(/[^a-zA-Z0-9_-]/g, '_'));
    } else {
      parts.push(prefix);
    }

    parts.push(timestamp);

    if (options.title) {
      parts.push(options.title.replace(/\s+/g, '_').substring(0, 50));
    }

    return `${parts.join('_')}.${extension}`;
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
    const filename = this.generateFilename(options, 'json');

    // Build the export object based on options
    const exportData: any = {
      generatedAt: report.generatedAt,
      config: report.config,
      basicStats: report.basicStats,
    };

    // Add optional sections based on options
    if (options.includeRiskMetrics !== false) {
      exportData.riskMetrics = report.riskMetrics;
    }

    if (options.includeEquityCurve !== false) {
      exportData.equityCurve = report.equityCurve;
    }

    if (options.includeTradeList !== false) {
      exportData.tradeAnalysis = report.tradeAnalysis;
    }

    if (options.includeDrawdownAnalysis !== false) {
      exportData.drawdownAnalysis = report.drawdownAnalysis;
    }

    if (options.includePositionAnalysis !== false) {
      exportData.positionAnalysis = report.positionAnalysis;
    }

    if (options.includeMonthlyBreakdown !== false) {
      exportData.monthlyPerformance = report.monthlyPerformance;
    }

    if (options.includeDistribution !== false) {
      exportData.tradeDistribution = report.tradeDistribution;
    }

    exportData.performanceScorecard = report.performanceScorecard;

    if (options.includeRecommendations !== false) {
      exportData.recommendations = report.recommendations;
    }

    return {
      content: JSON.stringify(exportData, null, 2),
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
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { createPdf } = require('pdfmake');

    const strategyName = options.strategyName || report.config.strategy;
    const content: any[] = [
      // Header with logo placeholder and title
      {
        columns: [
          {
            width: '*',
            stack: [
              {
                text: options.title || '深度回测分析报告',
                style: 'header',
              },
              {
                text: `策略: ${strategyName} | 交易对: ${report.config.symbol}`,
                style: 'subtitle',
                margin: [0, 5, 0, 0],
              },
            ],
          },
          {
            width: 'auto',
            stack: [
              {
                text: 'AlphaArena',
                style: 'brand',
                alignment: 'right',
              },
              {
                text: `生成时间: ${new Date(report.generatedAt).toLocaleString('zh-CN')}`,
                style: 'subheader',
                alignment: 'right',
                margin: [0, 5, 0, 0],
              },
            ],
          },
        ],
        margin: [0, 0, 0, 20] as [number, number, number, number],
      },
      // Separator line
      {
        canvas: [
          {
            type: 'line',
            x1: 0,
            y1: 0,
            x2: 515,
            y2: 0,
            lineWidth: 1,
            lineColor: '#E0E0E0',
          },
        ],
        margin: [0, 0, 0, 20] as [number, number, number, number],
      },
    ];

    // Configuration section
    content.push(
      this.generateConfigSection(report),
      this.generateBasicStatsSection(report)
    );

    // Risk metrics section (optional)
    if (options.includeRiskMetrics !== false) {
      content.push(this.generateRiskMetricsSection(report));
    }

    // Scorecard section
    content.push(this.generateScorecardSection(report.performanceScorecard));

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

    if (options.includeTradeList !== false && report.tradeAnalysis.length > 0) {
      content.push(this.generateTradeListSection(report.tradeAnalysis));
    }

    if (options.includeRecommendations !== false && report.recommendations.length > 0) {
      content.push(this.generateRecommendationsSection(report.recommendations));
    }

    // Footer
    content.push({
      canvas: [
        {
          type: 'line',
          x1: 0,
          y1: 0,
          x2: 515,
          y2: 0,
          lineWidth: 1,
          lineColor: '#E0E0E0',
        },
      ],
      margin: [0, 20, 0, 10] as [number, number, number, number],
    });

    content.push({
      text: '本报告由 AlphaArena 自动生成 | 仅供参考，不构成投资建议',
      style: 'footer',
      alignment: 'center',
    });

    const docDefinition = {
      pageSize: 'A4' as const,
      pageMargins: [40, 60, 40, 60],
      content,
      styles: {
        header: { fontSize: 22, bold: true, color: '#1a1a1a' },
        subtitle: { fontSize: 11, color: '#666666' },
        brand: { fontSize: 14, bold: true, color: '#1890ff' },
        subheader: { fontSize: 9, color: '#999999' },
        sectionHeader: {
          fontSize: 14,
          bold: true,
          color: '#1a1a1a',
          margin: [0, 15, 0, 8] as [number, number, number, number],
        },
        tableHeader: { bold: true, fontSize: 9, fillColor: '#F5F5F5', color: '#333333' },
        footer: { fontSize: 8, color: '#999999' },
      },
      defaultStyle: { font: 'Helvetica' as const, fontSize: 10 },
    };

    return new Promise((resolve, reject) => {
      try {
        const pdfDoc = createPdf(docDefinition);
        pdfDoc.getBuffer((buffer: Buffer) => {
          const filename = this.generateFilename(options, 'pdf');
          resolve({ content: buffer, contentType: 'application/pdf', filename });
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Generate Excel report (CSV format with proper structure)
   */
  private async generateExcel(
    report: DeepAnalysisReport,
    options: ReportExportOptions
  ): Promise<{ content: Buffer; contentType: string; filename: string }> {
    const filename = this.generateFilename(options, 'csv');

    // Generate comprehensive CSV with multiple sections
    const sections: string[] = [];

    // Header with report info
    sections.push(this.generateCSVHeader(report, options));

    // Summary statistics section
    sections.push('\n# 汇总统计 Summary Statistics');
    sections.push(this.generateSummaryCSV(report));

    // Risk metrics section
    if (options.includeRiskMetrics !== false) {
      sections.push('\n# 风险指标 Risk Metrics');
      sections.push(this.generateRiskMetricsCSV(report));
    }

    // Equity curve section
    if (options.includeEquityCurve !== false && report.equityCurve.length > 0) {
      sections.push('\n# 资金曲线 Equity Curve');
      sections.push(this.generateEquityCurveCSV(report.equityCurve));
    }

    // Monthly performance section
    if (options.includeMonthlyBreakdown !== false && report.monthlyPerformance.length > 0) {
      sections.push('\n# 月度表现 Monthly Performance');
      sections.push(this.generateMonthlyCSV(report.monthlyPerformance));
    }

    // Trade list section (complete trading details)
    if (options.includeTradeList !== false && report.tradeAnalysis.length > 0) {
      sections.push('\n# 交易明细 Trade Details');
      sections.push(this.generateTradeListCSV(report.tradeAnalysis));
    }

    // Drawdown analysis section
    if (options.includeDrawdownAnalysis !== false) {
      sections.push('\n# 回撤分析 Drawdown Analysis');
      sections.push(this.generateDrawdownCSV(report.drawdownAnalysis));
    }

    const content = sections.join('\n');

    return {
      content: Buffer.from(content, 'utf-8'),
      contentType: 'text/csv',
      filename,
    };
  }

  /**
   * Generate CSV header with report metadata
   */
  private generateCSVHeader(report: DeepAnalysisReport, options: ReportExportOptions): string {
    const lines: string[] = [
      `# 回测分析报告 Backtest Analysis Report`,
      `# 生成时间 Generated: ${new Date(report.generatedAt).toLocaleString('zh-CN')}`,
      `# 策略 Strategy: ${options.strategyName || report.config.strategy}`,
      `# 交易对 Symbol: ${report.config.symbol}`,
      `# 初始资金 Initial Capital: $${report.config.initialCapital.toFixed(2)}`,
      `# 时间范围 Period: ${new Date(report.config.startTime).toLocaleDateString('zh-CN')} - ${new Date(report.config.endTime).toLocaleDateString('zh-CN')}`,
    ];
    return lines.join('\n');
  }

  /**
   * Generate risk metrics CSV
   */
  private generateRiskMetricsCSV(report: DeepAnalysisReport): string {
    const risk = report.riskMetrics;
    const lines: string[] = [
      '指标,数值,说明',
      `夏普比率,${risk.sharpeRatio.toFixed(4)},风险调整后收益`,
      `索提诺比率,${risk.sortinoRatio.toFixed(4)},下行风险调整后收益`,
      `卡尔马比率,${risk.calmarRatio.toFixed(4)},年化收益与最大回撤比`,
      `年化波动率,${(risk.volatility * 100).toFixed(2)}%,收益率标准差`,
      `下行偏差,${(risk.downsideDeviation * 100).toFixed(2)}%,负收益波动率`,
      `VaR (95%),${(risk.var95 * 100).toFixed(2)}%,95%置信度最大损失`,
      `CVaR (95%),${(risk.cvar95 * 100).toFixed(2)}%,极端损失平均值`,
      `最大连续亏损,${risk.maxConsecutiveLosses},连续亏损次数`,
      `最大连续盈利,${risk.maxConsecutiveWins},连续盈利次数`,
    ];
    return lines.join('\n');
  }

  /**
   * Generate drawdown analysis CSV
   */
  private generateDrawdownCSV(drawdown: any): string {
    const lines: string[] = [
      '指标,数值',
      `最大回撤,${drawdown.maxDrawdown.toFixed(2)}%`,
      `最大回撤持续时间,${(drawdown.maxDrawdownDuration / 1000 / 60 / 60).toFixed(2)}小时`,
      `平均回撤,${drawdown.avgDrawdown.toFixed(2)}%`,
      `恢复因子,${drawdown.recoveryFactor.toFixed(2)}`,
      `水下时间占比,${(drawdown.timeUnderwater * 100).toFixed(2)}%`,
    ];

    if (drawdown.drawdownPeriods && drawdown.drawdownPeriods.length > 0) {
      lines.push('\n回撤周期详情:');
      lines.push('开始时间,谷底时间,结束时间,回撤%,持续时间(小时)');
      for (const period of drawdown.drawdownPeriods.slice(0, 10)) {
        lines.push(
          `${new Date(period.startTimestamp).toLocaleString('zh-CN')},` +
          `${new Date(period.troughTimestamp).toLocaleString('zh-CN')},` +
          `${period.endTimestamp ? new Date(period.endTimestamp).toLocaleString('zh-CN') : '未恢复'},` +
          `${period.drawdownPercent.toFixed(2)}%,` +
          `${(period.duration / 1000 / 60 / 60).toFixed(2)}`
        );
      }
    }

    return lines.join('\n');
  }

  /**
   * Generate trade list section for PDF
   */
  private generateTradeListSection(trades: TradeAnalysis[]): any {
    // Show first 10 and last 10 trades if too many
    const displayTrades = trades.length <= 20 ? trades : [...trades.slice(0, 10), ...trades.slice(-10)];

    const tableBody: any[][] = [
      [
        { text: 'ID', style: 'tableHeader' },
        { text: '入场时间', style: 'tableHeader' },
        { text: '出场时间', style: 'tableHeader' },
        { text: '方向', style: 'tableHeader' },
        { text: '入场价', style: 'tableHeader' },
        { text: '出场价', style: 'tableHeader' },
        { text: '数量', style: 'tableHeader' },
        { text: '盈亏', style: 'tableHeader' },
        { text: '盈亏%', style: 'tableHeader' },
      ],
    ];

    for (const trade of displayTrades) {
      tableBody.push([
        trade.id.substring(0, 6),
        new Date(trade.entryTime).toLocaleDateString('zh-CN'),
        new Date(trade.exitTime).toLocaleDateString('zh-CN'),
        trade.side === 'long' ? '多' : '空',
        trade.entryPrice.toFixed(4),
        trade.exitPrice.toFixed(4),
        trade.quantity.toFixed(4),
        {
          text: `$${trade.pnl.toFixed(2)}`,
          color: trade.pnl >= 0 ? 'green' : 'red',
        },
        {
          text: `${trade.pnlPercent.toFixed(2)}%`,
          color: trade.pnlPercent >= 0 ? 'green' : 'red',
        },
      ]);
    }

    return {
      stack: [
        { text: '交易明细', style: 'sectionHeader' },
        {
          text: `共 ${trades.length} 笔交易`,
          style: 'subheader',
          margin: [0, 0, 0, 5] as [number, number, number, number],
        },
        {
          table: {
            headerRows: 1,
            widths: ['auto', 'auto', 'auto', 'auto', 'auto', 'auto', 'auto', 'auto', 'auto'],
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
   * Generate summary CSV with complete metrics
   */
  private generateSummaryCSV(report: DeepAnalysisReport): string {
    const lines: string[] = [
      '指标,数值,说明',
      `总回报率,${report.basicStats.totalReturn.toFixed(2)}%,策略总收益`,
      `年化回报率,${report.basicStats.annualizedReturn.toFixed(2)}%,年化收益`,
      `最大回撤,${report.basicStats.maxDrawdown.toFixed(2)}%,最大资金回撤`,
      `夏普比率,${report.basicStats.sharpeRatio.toFixed(4)},风险调整后收益`,
      `索提诺比率,${report.riskMetrics.sortinoRatio.toFixed(4)},下行风险调整后收益`,
      `卡尔马比率,${report.riskMetrics.calmarRatio.toFixed(4)},收益回撤比`,
      `总交易数,${report.basicStats.totalTrades},交易次数`,
      `盈利交易,${report.basicStats.winningTrades},盈利次数`,
      `亏损交易,${report.basicStats.losingTrades},亏损次数`,
      `胜率,${report.basicStats.winRate.toFixed(2)}%,盈利交易占比`,
      `平均盈利,${report.basicStats.avgWin.toFixed(2)},单笔平均盈利`,
      `平均亏损,${report.basicStats.avgLoss.toFixed(2)},单笔平均亏损`,
      `盈亏比,${report.basicStats.profitFactor.toFixed(4)},总盈亏比`,
      `恢复因子,${report.drawdownAnalysis.recoveryFactor.toFixed(2)},收益/最大回撤`,
      `综合评分,${report.performanceScorecard.overallScore.toFixed(1)},综合表现评分`,
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
   * Generate trade list CSV with complete trading details
   */
  private generateTradeListCSV(trades: TradeAnalysis[]): string {
    const lines: string[] = [
      'ID,入场时间,出场时间,方向,入场价,出场价,数量,盈亏,盈亏%,持续时间(小时),是否盈利,MFE,MAE,风险回报比,出场原因',
      ...trades.map(t =>
        `${t.id},` +
        `${new Date(t.entryTime).toISOString()},` +
        `${new Date(t.exitTime).toISOString()},` +
        `${t.side},` +
        `${t.entryPrice.toFixed(4)},` +
        `${t.exitPrice.toFixed(4)},` +
        `${t.quantity.toFixed(4)},` +
        `${t.pnl.toFixed(4)},` +
        `${t.pnlPercent.toFixed(4)},` +
        `${(t.duration / 1000 / 60 / 60).toFixed(2)},` +
        `${t.isWinner},` +
        `${t.mfe.toFixed(4)},` +
        `${t.mae.toFixed(4)},` +
        `${t.riskRewardRatio.toFixed(4)},` +
        `${t.exitReason || 'signal'}`
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
    // eslint-disable-next-line @typescript-eslint/no-require-imports
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
          const filename = this.generateFilename(options, 'pdf', 'strategy_comparison');
          resolve({
            content: buffer,
            contentType: 'application/pdf',
            filename,
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

    const filename = this.generateFilename(options, 'csv', 'strategy_comparison');
    return {
      content: Buffer.from(lines.join('\n'), 'utf-8'),
      contentType: 'text/csv',
      filename,
    };
  }

  /**
   * Generate comparison JSON
   */
  private generateComparisonJSON(
    comparison: ComparisonReport,
    options: ReportExportOptions
  ): { content: string; contentType: string; filename: string } {
    const filename = this.generateFilename(options, 'json', 'strategy_comparison');
    return {
      content: JSON.stringify(comparison, null, 2),
      contentType: 'application/json',
      filename,
    };
  }
}