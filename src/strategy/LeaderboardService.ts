/**
 * Leaderboard Service - 排行榜计算服务
 * 
 * Calculates and maintains strategy rankings based on:
 * - ROI (Return on Investment)
 * - Sharpe Ratio
 * - Maximum Drawdown
 * - Win Rate
 * - Total P&L
 * - Total Volume
 */

import { EventEmitter } from 'events';
import { StrategiesDAO } from '../database/strategies.dao';
import { TradesDAO } from '../database/trades.dao';
import { PortfoliosDAO } from '../database/portfolios.dao';

/**
 * Strategy performance metrics - 策略性能指标
 */
export interface StrategyMetrics {
  strategyId: string;
  strategyName: string;
  status: string;
  totalTrades: number;
  totalVolume: number;
  totalPnL: number;
  roi: number;
  winRate: number;
  sharpeRatio: number;
  maxDrawdown: number;
  avgTradeSize: number;
  profitableTrades: number;
  losingTrades: number;
  consecutiveWins: number;
  consecutiveLosses: number;
  bestTrade: number;
  worstTrade: number;
  calculatedAt: Date;
}

/**
 * Strategy ranking entry - 排行榜条目
 */
export interface LeaderboardEntry {
  rank: number;
  strategyId: string;
  strategyName: string;
  status: string;
  metrics: StrategyMetrics;
  rankChange: number; // Positive = moved up, negative = moved down
}

/**
 * Historical snapshot - 历史快照
 */
export interface LeaderboardSnapshot {
  id?: string;
  timestamp: Date;
  entries: LeaderboardEntry[];
  totalStrategies: number;
  totalTrades: number;
  totalVolume: number;
}

/**
 * Sort criterion for leaderboard - 排序标准
 */
export type SortCriterion = 
  | 'roi'
  | 'sharpeRatio'
  | 'maxDrawdown'
  | 'totalPnL'
  | 'winRate'
  | 'totalVolume';

/**
 * Leaderboard Service Class
 */
export class LeaderboardService extends EventEmitter {
  private strategiesDAO: StrategiesDAO;
  private tradesDAO: TradesDAO;
  private portfoliosDAO: PortfoliosDAO;
  private currentRankings: Map<string, LeaderboardEntry> = new Map();
  private previousRankings: Map<string, number> = new Map(); // strategyId -> previous rank
  private isCalculating: boolean = false;
  private lastCalculation?: Date;

  constructor() {
    super();
    this.strategiesDAO = new StrategiesDAO();
    this.tradesDAO = new TradesDAO();
    this.portfoliosDAO = new PortfoliosDAO();
  }

  /**
   * Calculate metrics for a single strategy - 计算单个策略的指标
   */
  async calculateStrategyMetrics(strategyId: string): Promise<StrategyMetrics | null> {
    try {
      const strategy = await this.strategiesDAO.getById(strategyId);
      if (!strategy) return null;

      const trades = await this.tradesDAO.getByStrategy(strategyId, 10000);
      
      if (trades.length === 0) {
        return {
          strategyId: strategy.id,
          strategyName: strategy.name,
          status: strategy.status,
          totalTrades: 0,
          totalVolume: 0,
          totalPnL: 0,
          roi: 0,
          winRate: 0,
          sharpeRatio: 0,
          maxDrawdown: 0,
          avgTradeSize: 0,
          profitableTrades: 0,
          losingTrades: 0,
          consecutiveWins: 0,
          consecutiveLosses: 0,
          bestTrade: 0,
          worstTrade: 0,
          calculatedAt: new Date(),
        };
      }

      // Calculate basic metrics
      const buys = trades.filter(t => t.side === 'buy');
      const sells = trades.filter(t => t.side === 'sell');
      
      const totalCost = buys.reduce((sum, t) => sum + t.total, 0);
      const totalProceeds = sells.reduce((sum, t) => sum + t.total, 0);
      const totalPnL = totalProceeds - totalCost;
      const totalVolume = trades.reduce((sum, t) => sum + t.total, 0);
      const roi = totalCost > 0 ? (totalPnL / totalCost) * 100 : 0;
      const avgTradeSize = trades.length > 0 ? totalVolume / trades.length : 0;

      // Calculate win rate and trade-level P&L
      let profitableTrades = 0;
      let losingTrades = 0;
      let bestTrade = -Infinity;
      let worstTrade = Infinity;
      const tradePnLs: number[] = [];

      // For each sell, find corresponding buy to calculate P&L
      for (const sell of sells) {
        const correspondingBuy = buys.find(b => 
          b.orderId && sell.orderId && 
          b.orderId.slice(0, 8) === sell.orderId.slice(0, 8)
        ) || buys[0];
        
        if (correspondingBuy) {
          const tradePnL = sell.total - correspondingBuy.total;
          tradePnLs.push(tradePnL);
          
          if (tradePnL > 0) profitableTrades++;
          else losingTrades++;
          
          if (tradePnL > bestTrade) bestTrade = tradePnL;
          if (tradePnL < worstTrade) worstTrade = tradePnL;
        }
      }

      const winRate = sells.length > 0 ? (profitableTrades / sells.length) * 100 : 0;

      // Calculate Sharpe Ratio (simplified)
      const sharpeRatio = this.calculateSharpeRatio(tradePnLs);

      // Calculate Maximum Drawdown
      const maxDrawdown = this.calculateMaxDrawdown(tradePnLs);

      // Calculate consecutive wins/losses
      const { consecutiveWins, consecutiveLosses } = this.calculateConsecutive(tradePnLs);

      return {
        strategyId: strategy.id,
        strategyName: strategy.name,
        status: strategy.status,
        totalTrades: trades.length,
        totalVolume,
        totalPnL,
        roi,
        winRate,
        sharpeRatio,
        maxDrawdown,
        avgTradeSize,
        profitableTrades,
        losingTrades,
        consecutiveWins,
        consecutiveLosses,
        bestTrade: bestTrade === -Infinity ? 0 : bestTrade,
        worstTrade: worstTrade === Infinity ? 0 : worstTrade,
        calculatedAt: new Date(),
      };
    } catch (error) {
      console.error(`[Leaderboard] Error calculating metrics for strategy ${strategyId}:`, error);
      return null;
    }
  }

  /**
   * Calculate Sharpe Ratio - 计算夏普比率
   */
  private calculateSharpeRatio(tradePnLs: number[]): number {
    if (tradePnLs.length < 2) return 0;

    const avg = tradePnLs.reduce((sum, pnl) => sum + pnl, 0) / tradePnLs.length;
    const variance = tradePnLs.reduce((sum, pnl) => sum + Math.pow(pnl - avg, 2), 0) / tradePnLs.length;
    const stdDev = Math.sqrt(variance);

    if (stdDev === 0) return 0;

    // Annualized Sharpe Ratio (assuming daily returns)
    return (avg / stdDev) * Math.sqrt(252);
  }

  /**
   * Calculate Maximum Drawdown - 计算最大回撤
   */
  private calculateMaxDrawdown(tradePnLs: number[]): number {
    if (tradePnLs.length === 0) return 0;

    let peak = 0;
    let maxDrawdown = 0;
    let cumulative = 0;

    for (const pnl of tradePnLs) {
      cumulative += pnl;
      if (cumulative > peak) {
        peak = cumulative;
      }
      const drawdown = (peak - cumulative) / (peak || 1);
      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown;
      }
    }

    return maxDrawdown * 100; // Return as percentage
  }

  /**
   * Calculate consecutive wins and losses - 计算连续盈亏
   */
  private calculateConsecutive(tradePnLs: number[]): { consecutiveWins: number; consecutiveLosses: number } {
    let consecutiveWins = 0;
    let consecutiveLosses = 0;
    let currentWins = 0;
    let currentLosses = 0;

    for (const pnl of tradePnLs) {
      if (pnl > 0) {
        currentWins++;
        currentLosses = 0;
        if (currentWins > consecutiveWins) consecutiveWins = currentWins;
      } else {
        currentLosses++;
        currentWins = 0;
        if (currentLosses > consecutiveLosses) consecutiveLosses = currentLosses;
      }
    }

    return { consecutiveWins, consecutiveLosses };
  }

  /**
   * Calculate full leaderboard - 计算完整排行榜
   */
  async calculateLeaderboard(
    sortBy: SortCriterion = 'roi'
  ): Promise<LeaderboardEntry[]> {
    if (this.isCalculating) {
      console.log('[Leaderboard] Calculation already in progress');
      return this.getCurrentLeaderboard();
    }

    this.isCalculating = true;

    try {
      // Store previous rankings for rank change calculation
      this.previousRankings = new Map();
      this.currentRankings.forEach((entry, strategyId) => {
        this.previousRankings.set(strategyId, entry.rank);
      });

      const strategies = await this.strategiesDAO.getAll();
      const entries: LeaderboardEntry[] = [];

      // Calculate metrics for each strategy
      for (const strategy of strategies) {
        const metrics = await this.calculateStrategyMetrics(strategy.id);
        if (metrics) {
          entries.push({
            rank: 0, // Will be set after sorting
            strategyId: strategy.id,
            strategyName: strategy.name,
            status: strategy.status,
            metrics,
            rankChange: 0, // Will be calculated after sorting
          });
        }
      }

      // Sort by criterion
      entries.sort((a, b) => {
        let comparison = 0;
        switch (sortBy) {
          case 'roi':
            comparison = b.metrics.roi - a.metrics.roi;
            break;
          case 'sharpeRatio':
            comparison = b.metrics.sharpeRatio - a.metrics.sharpeRatio;
            break;
          case 'maxDrawdown':
            comparison = a.metrics.maxDrawdown - b.metrics.maxDrawdown; // Lower is better
            break;
          case 'totalPnL':
            comparison = b.metrics.totalPnL - a.metrics.totalPnL;
            break;
          case 'winRate':
            comparison = b.metrics.winRate - a.metrics.winRate;
            break;
          case 'totalVolume':
            comparison = b.metrics.totalVolume - a.metrics.totalVolume;
            break;
        }
        return comparison;
      });

      // Assign ranks and calculate rank changes
      entries.forEach((entry, index) => {
        entry.rank = index + 1;
        const previousRank = this.previousRankings.get(entry.strategyId);
        if (previousRank) {
          entry.rankChange = previousRank - entry.rank; // Positive = moved up
        }
        
        // Update current rankings map
        this.currentRankings.set(entry.strategyId, entry);
      });

      this.lastCalculation = new Date();
      this.emit('leaderboard:updated', entries);

      return entries;
    } catch (error) {
      console.error('[Leaderboard] Error calculating leaderboard:', error);
      throw error;
    } finally {
      this.isCalculating = false;
    }
  }

  /**
   * Get current leaderboard from cache - 获取缓存的排行榜
   */
  getCurrentLeaderboard(): LeaderboardEntry[] {
    return Array.from(this.currentRankings.values()).sort((a, b) => a.rank - b.rank);
  }

  /**
   * Get leaderboard for a specific strategy - 获取特定策略的排名
   */
  getStrategyRank(strategyId: string): LeaderboardEntry | null {
    return this.currentRankings.get(strategyId) || null;
  }

  /**
   * Get last calculation time - 获取上次计算时间
   */
  getLastCalculation(): Date | undefined {
    return this.lastCalculation;
  }

  /**
   * Create a snapshot of current leaderboard - 创建排行榜快照
   */
  async createSnapshot(): Promise<LeaderboardSnapshot> {
    const entries = this.getCurrentLeaderboard();
    const totalTrades = entries.reduce((sum, e) => sum + e.metrics.totalTrades, 0);
    const totalVolume = entries.reduce((sum, e) => sum + e.metrics.totalVolume, 0);

    const snapshot: LeaderboardSnapshot = {
      timestamp: new Date(),
      entries,
      totalStrategies: entries.length,
      totalTrades,
      totalVolume,
    };

    this.emit('leaderboard:snapshot', snapshot);
    return snapshot;
  }

  /**
   * Clear cached rankings - 清除缓存
   */
  clearCache(): void {
    this.currentRankings.clear();
    this.previousRankings.clear();
    this.lastCalculation = undefined;
  }
}

export default LeaderboardService;
