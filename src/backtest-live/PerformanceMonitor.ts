/**
 * Performance Monitor Service
 *
 * Real-time performance monitoring and comparison between backtest and live trading
 *
 * @module backtest-live/PerformanceMonitor
 */

import {
  IntegratedStrategyConfig,
  PerformanceComparison,
  LivePerformanceMetrics,
  PerformanceDeviation,
  DeviationDetail,
  AlertStatus,
  AlertMessage,
} from './types';
import { BacktestStats } from '../backtest/types';
import { backtestLiveDAO } from '../database/backtest-live.dao';
import { createLogger } from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';

const log = createLogger('PerformanceMonitor');

/**
 * PerformanceMonitor - Real-time performance monitoring service
 */
export class PerformanceMonitor {
  private comparisonIntervals: Map<string, NodeJS.Timeout> = new Map();

  /**
   * Start monitoring an integration
   */
  startMonitoring(integration: IntegratedStrategyConfig): void {
    if (this.comparisonIntervals.has(integration.id)) {
      log.warn(`Integration ${integration.id} is already being monitored`);
      return;
    }

    if (!integration.monitoring.enableComparison) {
      log.info(`Comparison monitoring is disabled for integration ${integration.id}`);
      return;
    }

    const interval = setInterval(async () => {
      try {
        await this.runComparison(integration);
      } catch (error: any) {
        log.error(`Comparison failed for ${integration.id}:`, error);
      }
    }, integration.monitoring.comparisonInterval);

    this.comparisonIntervals.set(integration.id, interval);
    log.info(`Started monitoring integration ${integration.id}`);
  }

  /**
   * Stop monitoring an integration
   */
  stopMonitoring(integrationId: string): void {
    const interval = this.comparisonIntervals.get(integrationId);
    if (interval) {
      clearInterval(interval);
      this.comparisonIntervals.delete(integrationId);
      log.info(`Stopped monitoring integration ${integrationId}`);
    }
  }

  /**
   * Run performance comparison
   */
  async runComparison(integration: IntegratedStrategyConfig): Promise<PerformanceComparison> {
    const timestamp = Date.now();
    
    // Get backtest metrics
    const backtestMetrics = await this.getBacktestMetrics(integration);
    if (!backtestMetrics) {
      throw new Error('No backtest results available for comparison');
    }

    // Get live metrics
    const liveMetrics = await this.getLiveMetrics(integration);

    // Calculate deviation
    const deviation = this.calculateDeviation(backtestMetrics, liveMetrics, integration.monitoring.deviationThreshold);

    // Determine alert status
    const alertStatus = this.determineAlertStatus(deviation, integration.monitoring.deviationThreshold);

    // Create comparison
    const comparison: PerformanceComparison = {
      integrationId: integration.id,
      timestamp,
      periodStart: integration.createdAt,
      periodEnd: timestamp,
      backtestMetrics,
      liveMetrics,
      deviation,
      alertStatus,
    };

    // Save comparison
    await backtestLiveDAO.savePerformanceComparison(comparison);

    // Send alerts if needed
    if (alertStatus.hasAlerts) {
      await this.sendAlerts(integration, alertStatus);
    }

    return comparison;
  }

  /**
   * Get backtest metrics from stored results
   */
  private async getBacktestMetrics(integration: IntegratedStrategyConfig): Promise<BacktestStats | null> {
    if (!integration.backtestResultId) {
      return null;
    }

    const result = await backtestLiveDAO.getBacktestResult(integration.backtestResultId);
    return result?.stats ?? null;
  }

  /**
   * Get live trading metrics
   * This would integrate with the actual trading system
   */
  private async getLiveMetrics(integration: IntegratedStrategyConfig): Promise<LivePerformanceMetrics> {
    // TODO: Integrate with actual live trading system
    // For now, return placeholder metrics
    
    // In a real implementation, this would:
    // 1. Query the portfolio service for current positions and equity
    // 2. Query the trade service for completed trades
    // 3. Calculate real-time metrics

    return {
      totalReturn: 0,
      annualizedReturn: 0,
      sharpeRatio: 0,
      maxDrawdown: 0,
      totalTrades: 0,
      winningTrades: 0,
      losingTrades: 0,
      winRate: 0,
      avgWin: 0,
      avgLoss: 0,
      profitFactor: 0,
      currentEquity: integration.backtestConfig.capital,
      cashBalance: integration.backtestConfig.capital,
      unrealizedPnL: 0,
      openPositions: 0,
    };
  }

  /**
   * Calculate performance deviation
   */
  private calculateDeviation(
    backtest: BacktestStats,
    live: LivePerformanceMetrics,
    threshold: number
  ): PerformanceDeviation {
    const significantDeviations: DeviationDetail[] = [];

    // Calculate individual deviations
    const returnDeviation = this.calculateDeviationPercent(
      backtest.totalReturn,
      live.totalReturn
    );
    const sharpeDeviation = this.calculateDeviationPercent(
      backtest.sharpeRatio,
      live.sharpeRatio
    );
    const drawdownDeviation = this.calculateDeviationPercent(
      backtest.maxDrawdown,
      live.maxDrawdown
    );
    const winRateDeviation = this.calculateDeviationPercent(
      backtest.winRate,
      live.winRate
    );
    const tradeCountDeviation = this.calculateDeviationPercent(
      backtest.totalTrades,
      live.totalTrades
    );

    // Check for significant deviations
    if (Math.abs(returnDeviation) > threshold) {
      significantDeviations.push({
        metric: 'totalReturn',
        expected: backtest.totalReturn,
        actual: live.totalReturn,
        deviation: returnDeviation,
        severity: this.getSeverity(Math.abs(returnDeviation), threshold),
        possibleCauses: this.getReturnDeviationCauses(returnDeviation),
      });
    }

    if (Math.abs(sharpeDeviation) > threshold) {
      significantDeviations.push({
        metric: 'sharpeRatio',
        expected: backtest.sharpeRatio,
        actual: live.sharpeRatio,
        deviation: sharpeDeviation,
        severity: this.getSeverity(Math.abs(sharpeDeviation), threshold),
        possibleCauses: [
          'Different market volatility conditions',
          'Slippage in live trading',
          'Execution delays affecting trade timing',
        ],
      });
    }

    if (Math.abs(drawdownDeviation) > threshold) {
      significantDeviations.push({
        metric: 'maxDrawdown',
        expected: backtest.maxDrawdown,
        actual: live.maxDrawdown,
        deviation: drawdownDeviation,
        severity: this.getSeverity(Math.abs(drawdownDeviation), threshold),
        possibleCauses: [
          'Different market conditions',
          'Risk management differences',
          'Liquidity issues',
        ],
      });
    }

    // Calculate overall score (weighted average of absolute deviations)
    const weights = {
      return: 0.3,
      sharpe: 0.2,
      drawdown: 0.2,
      winRate: 0.15,
      tradeCount: 0.15,
    };

    const overallScore = 
      weights.return * Math.abs(returnDeviation) +
      weights.sharpe * Math.abs(sharpeDeviation) +
      weights.drawdown * Math.abs(drawdownDeviation) +
      weights.winRate * Math.abs(winRateDeviation) +
      weights.tradeCount * Math.abs(tradeCountDeviation);

    return {
      returnDeviation,
      sharpeDeviation,
      drawdownDeviation,
      winRateDeviation,
      tradeCountDeviation,
      overallScore,
      significantDeviations,
    };
  }

  /**
   * Calculate percentage deviation
   */
  private calculateDeviationPercent(expected: number, actual: number): number {
    if (expected === 0) {
      return actual === 0 ? 0 : (actual > 0 ? 100 : -100);
    }
    return ((actual - expected) / Math.abs(expected)) * 100;
  }

  /**
   * Get severity level based on deviation percentage
   */
  private getSeverity(deviationPercent: number, threshold: number): 'low' | 'medium' | 'high' | 'critical' {
    if (deviationPercent > threshold * 3) return 'critical';
    if (deviationPercent > threshold * 2) return 'high';
    if (deviationPercent > threshold * 1.5) return 'medium';
    return 'low';
  }

  /**
   * Get possible causes for return deviation
   */
  private getReturnDeviationCauses(deviation: number): string[] {
    if (deviation > 0) {
      return [
        'Live trading outperforming backtest',
        'Favorable market conditions',
        'Better execution prices',
        'Reduced trading fees',
      ];
    } else {
      return [
        'Market conditions different from backtest period',
        'Slippage reducing profitability',
        'Execution delays',
        'Trading fees impact',
        'Liquidity constraints',
      ];
    }
  }

  /**
   * Determine alert status based on deviation
   */
  private determineAlertStatus(deviation: PerformanceDeviation, _threshold: number): AlertStatus {
    const messages: AlertMessage[] = [];
    let level: 'info' | 'warning' | 'error' | 'critical' = 'info';

    for (const detail of deviation.significantDeviations) {
      if (detail.severity === 'critical') {
        level = 'critical';
      } else if (detail.severity === 'high' && level !== 'critical') {
        level = 'error';
      } else if (detail.severity === 'medium' && level !== 'critical' && level !== 'error') {
        level = 'warning';
      }

      messages.push({
        id: uuidv4(),
        level: detail.severity === 'critical' ? 'critical' :
               detail.severity === 'high' ? 'error' :
               detail.severity === 'medium' ? 'warning' : 'info',
        title: `${detail.metric} deviation detected`,
        message: `Expected: ${detail.expected.toFixed(2)}, Actual: ${detail.actual.toFixed(2)}, Deviation: ${detail.deviation.toFixed(2)}%`,
        timestamp: Date.now(),
        suggestedActions: detail.possibleCauses,
      });
    }

    return {
      hasAlerts: messages.length > 0,
      level,
      messages,
      lastAlertTime: messages.length > 0 ? Date.now() : undefined,
    };
  }

  /**
   * Send alerts to configured channels
   */
  private async sendAlerts(
    integration: IntegratedStrategyConfig,
    alertStatus: AlertStatus
  ): Promise<void> {
    if (!integration.monitoring.notificationChannels?.length) {
      log.info(`No notification channels configured for ${integration.id}`);
      return;
    }

    for (const channel of integration.monitoring.notificationChannels) {
      if (!channel.enabled) continue;

      try {
        switch (channel.type) {
          case 'webhook':
            await this.sendWebhookAlert(channel.endpoint, alertStatus);
            break;
          case 'email':
            // TODO: Implement email alerts
            log.info(`Email alert would be sent to ${channel.endpoint}`);
            break;
          case 'push':
            // TODO: Implement push notifications
            log.info(`Push notification would be sent`);
            break;
          case 'sms':
            // TODO: Implement SMS alerts
            log.info(`SMS alert would be sent to ${channel.endpoint}`);
            break;
        }
      } catch (error: any) {
        log.error(`Failed to send alert to ${channel.type}:`, error);
      }
    }
  }

  /**
   * Send webhook alert
   */
  private async sendWebhookAlert(endpoint: string, alertStatus: AlertStatus): Promise<void> {
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          level: alertStatus.level,
          messages: alertStatus.messages,
          timestamp: Date.now(),
        }),
      });

      if (!response.ok) {
        throw new Error(`Webhook returned ${response.status}`);
      }

      log.info(`Webhook alert sent successfully to ${endpoint}`);
    } catch (error: any) {
      log.error(`Failed to send webhook alert:`, error);
      throw error;
    }
  }

  /**
   * Get performance summary for integration
   */
  async getPerformanceSummary(integrationId: string): Promise<{
    latestComparison: PerformanceComparison | null;
    historicalTrend: {
      timestamp: number;
      overallScore: number;
    }[];
    averageDeviation: number;
  }> {
    // Get latest comparison
    const latestRecord = await backtestLiveDAO.getLatestComparison(integrationId);
    const latestComparison = latestRecord?.comparison ?? null;

    // Get historical comparisons
    const historicalRecords = await backtestLiveDAO.getHistoricalComparisons(integrationId, 100);
    const historicalTrend = historicalRecords.map(record => ({
      timestamp: record.timestamp,
      overallScore: record.comparison.deviation.overallScore,
    }));

    // Calculate average deviation
    const averageDeviation = historicalRecords.length > 0
      ? historicalRecords.reduce((sum, r) => sum + r.comparison.deviation.overallScore, 0) / historicalRecords.length
      : 0;

    return {
      latestComparison,
      historicalTrend,
      averageDeviation,
    };
  }

  /**
   * Stop all monitoring
   */
  stopAllMonitoring(): void {
    for (const [_id, interval] of this.comparisonIntervals) {
      clearInterval(interval);
    }
    this.comparisonIntervals.clear();
    log.info('Stopped all monitoring');
  }
}

// Singleton instance
export const performanceMonitor = new PerformanceMonitor();