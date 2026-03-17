import { getSupabaseClient } from './client';

/**
 * Attribution type
 */
export type AttributionType = 'return' | 'risk' | 'benchmark';

/**
 * Time period for attribution
 */
export type AttributionPeriod = 'daily' | 'weekly' | 'monthly' | 'all';

/**
 * Strategy attribution result
 */
export interface StrategyAttribution {
  strategyId: string;
  strategyName: string;
  contribution: number;
  contributionPercent: number;
  trades: number;
  winRate: number;
  avgReturn: number;
  riskContribution: number;
  maxDrawdown: number;
  sharpeRatio: number;
  sortinoRatio: number;
  calmarRatio: number;
}

/**
 * Symbol attribution result
 */
export interface SymbolAttribution {
  symbol: string;
  contribution: number;
  contributionPercent: number;
  trades: number;
  winRate: number;
  avgReturn: number;
  riskContribution: number;
  maxDrawdown: number;
  volatility: number;
  holdingTime: number;
}

/**
 * Time-based attribution result
 */
export interface TimeAttribution {
  period: string;
  contribution: number;
  contributionPercent: number;
  trades: number;
  winRate: number;
  volatility: number;
  benchmarkReturn: number;
}

/**
 * Risk attribution result
 */
export interface RiskAttribution {
  totalRisk: number;
  maxDrawdown: number;
  maxDrawdownPeriod: {
    startDate: Date;
    endDate: Date;
    peakValue: number;
    troughValue: number;
  };
  drawdownContributions: Array<{
    strategyId: string;
    strategyName: string;
    contribution: number;
  }>;
  volatilityContributions: Array<{
    strategyId: string;
    strategyName: string;
    contribution: number;
  }>;
}

/**
 * Benchmark comparison result
 */
export interface BenchmarkComparison {
  benchmarkType: 'btc_hodl' | 'eth_hodl' | 'equal_weight' | 'custom';
  benchmarkReturn: number;
  strategyReturn: number;
  excessReturn: number;
  beta: number;
  trackingError: number;
  informationRatio: number;
  upCapture: number;
  downCapture: number;
}

/**
 * Strategy efficiency metrics
 */
export interface StrategyEfficiency {
  strategyId: string;
  strategyName: string;
  sharpeRatio: number;
  sortinoRatio: number;
  calmarRatio: number;
  treynorRatio: number;
  informationRatio: number;
  omegaRatio: number;
  maxDrawdown: number;
  recoveryFactor: number;
  profitFactor: number;
  payoffRatio: number;
}

/**
 * Attribution chart data
 */
export interface AttributionChartData {
  waterfallData: Array<{
    name: string;
    value: number;
    type: 'positive' | 'negative';
  }>;
  pieData: Array<{
    name: string;
    value: number;
    percent: number;
  }>;
  heatmapData: Array<{
    strategy: string;
    period: string;
    value: number;
  }>;
}

/**
 * Complete attribution report
 */
export interface AttributionReport {
  userId: string;
  generatedAt: Date;
  period: AttributionPeriod;
  totalReturn: number;
  totalRisk: number;
  strategyAttribution: StrategyAttribution[];
  symbolAttribution: SymbolAttribution[];
  timeAttribution: TimeAttribution[];
  riskAttribution: RiskAttribution;
  benchmarkComparison: BenchmarkComparison[];
  efficiencyMetrics: StrategyEfficiency[];
  chartData: AttributionChartData;
}

/**
 * Attribution filters
 */
export interface AttributionFilters {
  userId: string;
  startDate?: Date;
  endDate?: Date;
  strategyIds?: string[];
  symbols?: string[];
  period?: AttributionPeriod;
  benchmarkType?: 'btc_hodl' | 'eth_hodl' | 'equal_weight' | 'custom';
  customBenchmarkPrices?: Map<string, number[]>;
}

/**
 * Attribution DAO
 */
export class AttributionDAO {
  async calculateAttribution(filters: AttributionFilters): Promise<AttributionReport> {
    const supabase = getSupabaseClient();
    const { data: trades, error } = await supabase
      .from('trades')
      .select('*')
      .eq('user_id', filters.userId)
      .order('executed_at', { ascending: true });

    if (error) throw error;

    const priceHistory = await this.fetchPriceHistory(filters);
    const strategyAttribution = this.calculateStrategyAttribution(trades || [], filters);
    const symbolAttribution = this.calculateSymbolAttribution(trades || [], filters);
    const timeAttribution = this.calculateTimeAttribution(trades || [], filters, priceHistory);
    const riskAttribution = this.calculateRiskAttribution(trades || [], filters, priceHistory);
    const benchmarkComparison = this.calculateBenchmarkComparison(trades || [], filters, priceHistory);
    const efficiencyMetrics = this.calculateEfficiencyMetrics(trades || [], filters);
    const chartData = this.generateChartData(strategyAttribution, symbolAttribution, timeAttribution);

    const totalReturn = strategyAttribution.reduce((sum, s) => sum + s.contribution, 0);
    const totalRisk = riskAttribution.totalRisk;

    return {
      userId: filters.userId,
      generatedAt: new Date(),
      period: filters.period || 'all',
      totalReturn,
      totalRisk,
      strategyAttribution,
      symbolAttribution,
      timeAttribution,
      riskAttribution,
      benchmarkComparison,
      efficiencyMetrics,
      chartData,
    };
  }

  private calculateStrategyAttribution(trades: any[], filters: AttributionFilters): StrategyAttribution[] {
    const strategyMap = new Map<string, { trades: any[]; pnl: number }>();
    for (const trade of trades) {
      const strategyId = trade.strategy_id || 'default';
      if (!strategyMap.has(strategyId)) strategyMap.set(strategyId, { trades: [], pnl: 0 });
      const entry = strategyMap.get(strategyId)!;
      entry.trades.push(trade);
      entry.pnl += trade.side === 'sell' ? parseFloat(trade.total || '0') : -parseFloat(trade.total || '0');
    }
    const totalPnL = Array.from(strategyMap.values()).reduce((sum, s) => sum + s.pnl, 0);
    const results: StrategyAttribution[] = [];
    for (const [strategyId, data] of strategyMap) {
      const returns = this.calculateReturnsFromTrades(data.trades);
      results.push({
        strategyId,
        strategyName: data.trades[0]?.strategy_name || 'Default',
        contribution: data.pnl,
        contributionPercent: totalPnL !== 0 ? (data.pnl / Math.abs(totalPnL)) * 100 : 0,
        trades: data.trades.length,
        winRate: this.calculateWinRate(data.trades),
        avgReturn: data.trades.length > 0 ? data.pnl / data.trades.length : 0,
        riskContribution: this.calculateVolatility(returns),
        maxDrawdown: this.calculateMaxDrawdown(data.trades),
        sharpeRatio: this.calculateSharpeRatio(returns),
        sortinoRatio: this.calculateSortinoRatio(returns),
        calmarRatio: 0,
      });
    }
    return results.sort((a, b) => b.contribution - a.contribution);
  }

  private calculateSymbolAttribution(trades: any[], filters: AttributionFilters): SymbolAttribution[] {
    const symbolMap = new Map<string, { trades: any[]; pnl: number; holdingTimes: number[] }>();
    for (const trade of trades) {
      const symbol = trade.symbol;
      if (!symbolMap.has(symbol)) symbolMap.set(symbol, { trades: [], pnl: 0, holdingTimes: [] });
      const entry = symbolMap.get(symbol)!;
      entry.trades.push(trade);
      entry.pnl += trade.side === 'sell' ? parseFloat(trade.total || '0') : -parseFloat(trade.total || '0');
    }
    const totalPnL = Array.from(symbolMap.values()).reduce((sum, s) => sum + s.pnl, 0);
    const results: SymbolAttribution[] = [];
    for (const [symbol, data] of symbolMap) {
      const returns = this.calculateReturnsFromTrades(data.trades);
      results.push({
        symbol,
        contribution: data.pnl,
        contributionPercent: totalPnL !== 0 ? (data.pnl / Math.abs(totalPnL)) * 100 : 0,
        trades: data.trades.length,
        winRate: this.calculateWinRate(data.trades),
        avgReturn: data.trades.length > 0 ? data.pnl / data.trades.length : 0,
        riskContribution: this.calculateVolatility(returns),
        maxDrawdown: this.calculateMaxDrawdown(data.trades),
        volatility: this.calculateVolatility(returns),
        holdingTime: data.holdingTimes.length > 0 ? data.holdingTimes.reduce((a, b) => a + b, 0) / data.holdingTimes.length : 0,
      });
    }
    return results.sort((a, b) => b.contribution - a.contribution);
  }

  private calculateTimeAttribution(trades: any[], filters: AttributionFilters, priceHistory: Map<string, number[]>): TimeAttribution[] {
    const periodMap = new Map<string, { trades: any[]; pnl: number }>();
    const period = filters.period || 'daily';
    for (const trade of trades) {
      const date = new Date(trade.executed_at);
      let key: string;
      switch (period) {
        case 'weekly':
          const weekStart = new Date(date);
          weekStart.setDate(date.getDate() - date.getDay());
          key = weekStart.toISOString().split('T')[0];
          break;
        case 'monthly':
          key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
          break;
        default:
          key = date.toISOString().split('T')[0];
      }
      if (!periodMap.has(key)) periodMap.set(key, { trades: [], pnl: 0 });
      const entry = periodMap.get(key)!;
      entry.trades.push(trade);
      entry.pnl += trade.side === 'sell' ? parseFloat(trade.total || '0') : -parseFloat(trade.total || '0');
    }
    const totalPnL = Array.from(periodMap.values()).reduce((sum, p) => sum + p.pnl, 0);
    const results: TimeAttribution[] = [];
    for (const [periodStr, data] of periodMap) {
      const returns = this.calculateReturnsFromTrades(data.trades);
      results.push({
        period: periodStr,
        contribution: data.pnl,
        contributionPercent: totalPnL !== 0 ? (data.pnl / Math.abs(totalPnL)) * 100 : 0,
        trades: data.trades.length,
        winRate: this.calculateWinRate(data.trades),
        volatility: this.calculateVolatility(returns),
        benchmarkReturn: 0,
      });
    }
    return results.sort((a, b) => a.period.localeCompare(b.period));
  }

  private calculateRiskAttribution(trades: any[], filters: AttributionFilters, priceHistory: Map<string, number[]>): RiskAttribution {
    const returns = this.calculateReturnsFromTrades(trades);
    return {
      totalRisk: this.calculateVolatility(returns),
      maxDrawdown: this.calculateMaxDrawdown(trades),
      maxDrawdownPeriod: { startDate: new Date(), endDate: new Date(), peakValue: 0, troughValue: 0 },
      drawdownContributions: [],
      volatilityContributions: [],
    };
  }

  private calculateBenchmarkComparison(trades: any[], filters: AttributionFilters, priceHistory: Map<string, number[]>): BenchmarkComparison[] {
    let totalPnL = 0, totalCost = 0;
    for (const trade of trades) {
      if (trade.side === 'sell') totalPnL += parseFloat(trade.total || '0');
      else totalCost += parseFloat(trade.total || '0');
    }
    const strategyReturn = totalCost > 0 ? (totalPnL - totalCost) / totalCost : 0;
    const results: BenchmarkComparison[] = [];
    const btcPrices = priceHistory.get('BTCUSDT') || [];
    if (btcPrices.length >= 2) {
      const btcReturn = (btcPrices[btcPrices.length - 1] - btcPrices[0]) / btcPrices[0];
      results.push({ benchmarkType: 'btc_hodl', benchmarkReturn: btcReturn, strategyReturn, excessReturn: strategyReturn - btcReturn, beta: 1, trackingError: 0, informationRatio: 0, upCapture: 0, downCapture: 0 });
    }
    const ethPrices = priceHistory.get('ETHUSDT') || [];
    if (ethPrices.length >= 2) {
      const ethReturn = (ethPrices[ethPrices.length - 1] - ethPrices[0]) / ethPrices[0];
      results.push({ benchmarkType: 'eth_hodl', benchmarkReturn: ethReturn, strategyReturn, excessReturn: strategyReturn - ethReturn, beta: 1, trackingError: 0, informationRatio: 0, upCapture: 0, downCapture: 0 });
    }
    const benchmarkReturn = (btcPrices.length >= 2 && ethPrices.length >= 2) ? ((btcPrices[btcPrices.length - 1] - btcPrices[0]) / btcPrices[0] + (ethPrices[ethPrices.length - 1] - ethPrices[0]) / ethPrices[0]) / 2 : 0;
    results.push({ benchmarkType: 'equal_weight', benchmarkReturn, strategyReturn, excessReturn: strategyReturn - benchmarkReturn, beta: 1, trackingError: 0, informationRatio: 0, upCapture: 0, downCapture: 0 });
    return results;
  }

  private calculateEfficiencyMetrics(trades: any[], filters: AttributionFilters): StrategyEfficiency[] {
    const strategyMap = new Map<string, any[]>();
    for (const trade of trades) {
      const strategyId = trade.strategy_id || 'default';
      if (!strategyMap.has(strategyId)) strategyMap.set(strategyId, []);
      strategyMap.get(strategyId)!.push(trade);
    }
    const results: StrategyEfficiency[] = [];
    for (const [strategyId, strategyTrades] of strategyMap) {
      const returns = this.calculateReturnsFromTrades(strategyTrades);
      const maxDrawdown = this.calculateMaxDrawdown(strategyTrades);
      results.push({
        strategyId,
        strategyName: strategyTrades[0]?.strategy_name || 'Default',
        sharpeRatio: this.calculateSharpeRatio(returns),
        sortinoRatio: this.calculateSortinoRatio(returns),
        calmarRatio: 0,
        treynorRatio: 0,
        informationRatio: 0,
        omegaRatio: 0,
        maxDrawdown,
        recoveryFactor: maxDrawdown > 0 ? Math.abs(this.calculateTotalReturn(strategyTrades)) / maxDrawdown : 0,
        profitFactor: 0,
        payoffRatio: 0,
      });
    }
    return results;
  }

  private generateChartData(strategyAttribution: StrategyAttribution[], symbolAttribution: SymbolAttribution[], timeAttribution: TimeAttribution[]): AttributionChartData {
    const waterfallData = strategyAttribution.map(s => ({ name: s.strategyName, value: s.contribution, type: s.contribution >= 0 ? 'positive' as const : 'negative' as const }));
    waterfallData.push({ name: '总计', value: strategyAttribution.reduce((sum, s) => sum + s.contribution, 0), type: 'positive' as const });
    const totalContribution = symbolAttribution.reduce((sum, s) => sum + Math.abs(s.contribution), 0);
    const pieData = symbolAttribution.map(s => ({ name: s.symbol, value: s.contribution, percent: totalContribution > 0 ? (Math.abs(s.contribution) / totalContribution) * 100 : 0 }));
    return { waterfallData, pieData, heatmapData: [] };
  }

  private async fetchPriceHistory(filters: AttributionFilters): Promise<Map<string, number[]>> {
    const supabase = getSupabaseClient();
    const priceHistory = new Map<string, number[]>();
    const { data: btcPrices } = await supabase.from('price_history').select('close').eq('symbol', 'BTCUSDT').order('timestamp', { ascending: true }).limit(365);
    if (btcPrices) priceHistory.set('BTCUSDT', btcPrices.map(p => parseFloat(p.close)));
    const { data: ethPrices } = await supabase.from('price_history').select('close').eq('symbol', 'ETHUSDT').order('timestamp', { ascending: true }).limit(365);
    if (ethPrices) priceHistory.set('ETHUSDT', ethPrices.map(p => parseFloat(p.close)));
    return priceHistory;
  }

  private calculateReturnsFromTrades(trades: any[]): number[] {
    const returns: number[] = [];
    let runningPnL = 0, runningCost = 0;
    for (const trade of [...trades].sort((a, b) => new Date(a.executed_at).getTime() - new Date(b.executed_at).getTime())) {
      const prevCost = runningCost;
      if (trade.side === 'sell') runningPnL += parseFloat(trade.total || '0');
      else { runningCost += parseFloat(trade.total || '0'); runningPnL -= parseFloat(trade.total || '0'); }
      if (prevCost > 0) returns.push((runningPnL - (runningPnL - parseFloat(trade.total || '0'))) / prevCost);
    }
    return returns;
  }

  private calculateVolatility(returns: number[]): number {
    if (returns.length < 2) return 0;
    const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length;
    return Math.sqrt(variance * 252);
  }

  private calculateMaxDrawdown(trades: any[]): number {
    let peak = 0, maxDrawdown = 0, runningPnL = 0;
    for (const trade of [...trades].sort((a, b) => new Date(a.executed_at).getTime() - new Date(b.executed_at).getTime())) {
      runningPnL += trade.side === 'sell' ? parseFloat(trade.total || '0') : -parseFloat(trade.total || '0');
      if (runningPnL > peak) peak = runningPnL;
      const drawdown = peak - runningPnL;
      if (drawdown > maxDrawdown) maxDrawdown = drawdown;
    }
    return maxDrawdown;
  }

  private calculateSharpeRatio(returns: number[]): number {
    if (returns.length < 2) return 0;
    const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const volatility = this.calculateVolatility(returns);
    return volatility === 0 ? 0 : (mean * 252) / volatility;
  }

  private calculateSortinoRatio(returns: number[]): number {
    if (returns.length < 2) return 0;
    const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const negativeReturns = returns.filter(r => r < 0);
    if (negativeReturns.length === 0) return Infinity;
    const downsideVariance = negativeReturns.reduce((sum, r) => sum + Math.pow(r, 2), 0) / returns.length;
    const downsideDeviation = Math.sqrt(downsideVariance * 252);
    return downsideDeviation === 0 ? 0 : (mean * 252) / downsideDeviation;
  }

  private calculateTotalReturn(trades: any[]): number {
    return trades.reduce((sum, t) => sum + (t.side === 'sell' ? parseFloat(t.total || '0') : -parseFloat(t.total || '0')), 0);
  }

  private calculateWinRate(trades: any[]): number {
    const sells = trades.filter(t => t.side === 'sell');
    const buys = trades.filter(t => t.side === 'buy');
    let wins = 0, total = 0;
    for (const sell of sells) {
      const symbolBuys = buys.filter(b => b.symbol === sell.symbol);
      if (symbolBuys.length > 0) {
        const avgBuyPrice = symbolBuys.reduce((s, b) => s + parseFloat(b.price || '0'), 0) / symbolBuys.length;
        if (parseFloat(sell.price || '0') > avgBuyPrice) wins++;
        total++;
      }
    }
    return total > 0 ? (wins / total) * 100 : 0;
  }

  async exportToPDF(report: AttributionReport): Promise<string> {
    console.log('Export to PDF requested for report:', report.userId);
    return '/api/attribution/export/' + report.userId + '/' + Date.now() + '.pdf';
  }
}
