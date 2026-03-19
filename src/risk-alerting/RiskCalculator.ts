/**
 * Risk Calculator
 * 
 * Calculates various risk metrics for portfolio monitoring
 */

import {
  PortfolioData,
  PositionData,
  RiskMetrics,
  RiskCalculationResult,
  RiskType,
  RiskSeverity,
} from './types';
import { createLogger } from '../utils/logger';

const log = createLogger('RiskCalculator');

export class RiskCalculator {
  /**
   * Calculate all risk metrics for a portfolio
   */
  calculateRiskMetrics(portfolio: PortfolioData): RiskMetrics {
    return {
      concentration: this.calculateConcentrationRisk(portfolio),
      drawdown: this.calculateDrawdown(portfolio),
      volatility: this.calculateVolatility(portfolio),
      leverage: this.calculateLeverage(portfolio),
      liquidity: this.calculateLiquidity(portfolio),
      overallScore: 0, // Will be calculated below
    };
  }

  /**
   * Calculate concentration risk
   * 
   * Measures how concentrated the portfolio is in a few positions
   */
  calculateConcentrationRisk(portfolio: PortfolioData): {
    maxPositionRatio: number;
    topThreeRatio: number;
    herfindahlIndex: number;
  } {
    const positions = portfolio.positions.filter(p => p.quantity > 0);
    
    if (positions.length === 0) {
      return {
        maxPositionRatio: 0,
        topThreeRatio: 0,
        herfindahlIndex: 0,
      };
    }

    const totalValue = positions.reduce((sum, p) => sum + p.marketValue, 0);
    
    if (totalValue === 0) {
      return {
        maxPositionRatio: 0,
        topThreeRatio: 0,
        herfindahlIndex: 0,
      };
    }

    // Calculate position weights
    const weights = positions.map(p => p.marketValue / totalValue);
    
    // Max position ratio
    const maxPositionRatio = Math.max(...weights);
    
    // Top three ratio
    const sortedWeights = [...weights].sort((a, b) => b - a);
    const topThreeRatio = sortedWeights.slice(0, 3).reduce((sum, w) => sum + w, 0);
    
    // Herfindahl Index (sum of squared weights)
    // 1/N = perfect diversification, 1 = complete concentration
    const herfindahlIndex = weights.reduce((sum, w) => sum + w * w, 0);

    return {
      maxPositionRatio,
      topThreeRatio,
      herfindahlIndex,
    };
  }

  /**
   * Calculate drawdown risk
   * 
   * Measures portfolio drawdown from high water mark
   */
  calculateDrawdown(portfolio: PortfolioData): {
    current: number;
    max: number;
    duration: number;
  } {
    const highWaterMark = portfolio.equityHighWaterMark ?? portfolio.totalValue;
    const currentValue = portfolio.totalValue;
    
    // Current drawdown
    const current = highWaterMark > 0 
      ? Math.max(0, (highWaterMark - currentValue) / highWaterMark) 
      : 0;

    // Max drawdown from equity history (if available)
    let max = current;
    if (portfolio.equityHistory && portfolio.equityHistory.length > 0) {
      const history = portfolio.equityHistory;
      let peak = history[0];
      for (const value of history) {
        if (value > peak) {
          peak = value;
        }
        const dd = peak > 0 ? (peak - value) / peak : 0;
        if (dd > max) {
          max = dd;
        }
      }
    }

    // Drawdown duration (simplified - would need timestamps for accurate calculation)
    const duration = current > 0 ? 1 : 0;

    return {
      current,
      max,
      duration,
    };
  }

  /**
   * Calculate volatility risk
   * 
   * Measures price volatility based on equity history
   */
  calculateVolatility(portfolio: PortfolioData): {
    daily: number;
    weekly: number;
    monthly: number;
  } {
    if (!portfolio.equityHistory || portfolio.equityHistory.length < 2) {
      return {
        daily: 0,
        weekly: 0,
        monthly: 0,
      };
    }

    const history = portfolio.equityHistory;
    
    // Calculate daily returns
    const returns: number[] = [];
    for (let i = 1; i < history.length; i++) {
      if (history[i - 1] > 0) {
        returns.push((history[i] - history[i - 1]) / history[i - 1]);
      }
    }

    if (returns.length === 0) {
      return {
        daily: 0,
        weekly: 0,
        monthly: 0,
      };
    }

    // Standard deviation of returns (annualized)
    const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + (r - mean) ** 2, 0) / returns.length;
    const dailyStd = Math.sqrt(variance);
    
    // Annualize volatility (assuming daily data)
    const annualizationFactor = Math.sqrt(252); // Trading days per year
    const daily = dailyStd * annualizationFactor;
    
    // Weekly volatility (lower due to mean reversion)
    const weekly = daily / Math.sqrt(5);
    
    // Monthly volatility
    const monthly = daily / Math.sqrt(22);

    return {
      daily,
      weekly,
      monthly,
    };
  }

  /**
   * Calculate leverage risk
   * 
   * Measures leverage and margin usage
   */
  calculateLeverage(portfolio: PortfolioData): {
    total: number;
    marginUsed: number;
    marginAvailable: number;
    marginRatio: number;
  } {
    const totalValue = portfolio.totalValue;
    const cash = portfolio.cash;
    const marginUsed = portfolio.marginUsed ?? 0;
    const marginAvailable = portfolio.marginAvailable ?? cash;
    
    // Total leverage (total exposure / equity)
    // For a simple portfolio without borrowing, this is 1.0
    const total = cash > 0 ? totalValue / cash : 1.0;
    
    // Margin ratio (margin used / margin available)
    const marginRatio = marginAvailable > 0 ? marginUsed / marginAvailable : 0;

    return {
      total,
      marginUsed,
      marginAvailable,
      marginRatio,
    };
  }

  /**
   * Calculate liquidity risk
   * 
   * Measures how easily positions can be liquidated
   */
  calculateLiquidity(portfolio: PortfolioData): {
    avgDailyVolume: number;
    liquidityScore: number;
    illiquidPositions: number;
  } {
    const positions = portfolio.positions.filter(p => p.quantity > 0);
    
    if (positions.length === 0) {
      return {
        avgDailyVolume: 0,
        liquidityScore: 100,
        illiquidPositions: 0,
      };
    }

    // Calculate days to liquidate for each position
    const daysToLiquidate: number[] = [];
    let illiquidPositions = 0;
    
    for (const position of positions) {
      if (position.dailyVolume && position.dailyVolume > 0) {
        // Days to liquidate assuming we trade 10% of daily volume
        const days = position.quantity / (position.dailyVolume * 0.1);
        daysToLiquidate.push(days);
        
        // Count illiquid positions (> 5 days to liquidate)
        if (days > 5) {
          illiquidPositions++;
        }
      } else {
        // No volume data - assume illiquid
        daysToLiquidate.push(10);
        illiquidPositions++;
      }
    }

    // Average daily volume (normalized by position value)
    const totalValue = positions.reduce((sum, p) => sum + p.marketValue, 0);
    const avgDailyVolume = positions.reduce((sum, p) => {
      const volume = p.dailyVolume ?? 0;
      return sum + (p.currentPrice * volume);
    }, 0) / positions.length;

    // Liquidity score (0-100, higher is better)
    const avgDays = daysToLiquidate.reduce((sum, d) => sum + d, 0) / daysToLiquidate.length;
    const liquidityScore = Math.max(0, Math.min(100, 100 - avgDays * 10));

    return {
      avgDailyVolume,
      liquidityScore,
      illiquidPositions,
    };
  }

  /**
   * Calculate overall risk score (0-100)
   */
  calculateOverallScore(metrics: RiskMetrics): number {
    let score = 0;
    
    // Concentration risk (0-25 points)
    score += Math.min(25, metrics.concentration.maxPositionRatio * 50);
    score += Math.min(10, metrics.concentration.herfindahlIndex * 10);
    
    // Drawdown risk (0-25 points)
    score += Math.min(25, metrics.drawdown.current * 100);
    
    // Volatility risk (0-20 points)
    // Assuming annualized volatility > 50% is high risk
    if (metrics.volatility.daily > 0.5) {
      score += Math.min(20, (metrics.volatility.daily - 0.5) * 40);
    }
    
    // Leverage risk (0-20 points)
    if (metrics.leverage.total > 2) {
      score += Math.min(20, (metrics.leverage.total - 2) * 10);
    }
    score += Math.min(10, metrics.leverage.marginRatio * 10);
    
    // Liquidity risk (0-10 points)
    score += (100 - metrics.liquidity.liquidityScore) / 10;
    score += Math.min(5, metrics.liquidity.illiquidPositions * 2);

    return Math.min(100, Math.round(score));
  }

  /**
   * Check if a specific risk type exceeds threshold
   */
  checkRiskThreshold(
    metrics: RiskMetrics,
    riskType: RiskType,
    threshold: number
  ): RiskCalculationResult {
    let value: number;
    let message: string;
    let details: Record<string, unknown>;

    switch (riskType) {
      case 'concentration':
        value = metrics.concentration.maxPositionRatio;
        message = `持仓集中度过高: ${(value * 100).toFixed(1)}%`;
        details = {
          maxPositionRatio: metrics.concentration.maxPositionRatio,
          topThreeRatio: metrics.concentration.topThreeRatio,
          herfindahlIndex: metrics.concentration.herfindahlIndex,
        };
        break;

      case 'drawdown':
        value = metrics.drawdown.current;
        message = `账户回撤过大: ${(value * 100).toFixed(1)}%`;
        details = {
          currentDrawdown: metrics.drawdown.current,
          maxDrawdown: metrics.drawdown.max,
          duration: metrics.drawdown.duration,
        };
        break;

      case 'volatility':
        value = metrics.volatility.daily;
        message = `市场波动剧烈: 年化波动率 ${(value * 100).toFixed(1)}%`;
        details = {
          dailyVolatility: metrics.volatility.daily,
          weeklyVolatility: metrics.volatility.weekly,
          monthlyVolatility: metrics.volatility.monthly,
        };
        break;

      case 'leverage':
        value = metrics.leverage.total;
        message = `杠杆率超限: ${value.toFixed(2)}x`;
        details = {
          totalLeverage: metrics.leverage.total,
          marginUsed: metrics.leverage.marginUsed,
          marginAvailable: metrics.leverage.marginAvailable,
          marginRatio: metrics.leverage.marginRatio,
        };
        break;

      case 'liquidity':
        value = 100 - metrics.liquidity.liquidityScore;
        message = `流动性不足: 评分 ${metrics.liquidity.liquidityScore.toFixed(0)}`;
        details = {
          liquidityScore: metrics.liquidity.liquidityScore,
          illiquidPositions: metrics.liquidity.illiquidPositions,
          avgDailyVolume: metrics.liquidity.avgDailyVolume,
        };
        break;

      default:
        throw new Error(`Unknown risk type: ${riskType}`);
    }

    const exceeded = value > threshold;
    const severity = this.determineSeverity(value, threshold);

    return {
      riskType,
      value,
      threshold,
      exceeded,
      severity,
      message,
      details,
    };
  }

  /**
   * Determine severity based on how much the value exceeds threshold
   */
  private determineSeverity(value: number, threshold: number): RiskSeverity {
    if (value <= threshold) {
      return 'low';
    }

    const ratio = value / threshold;

    if (ratio >= 2) {
      return 'critical';
    } else if (ratio >= 1.5) {
      return 'high';
    } else {
      return 'medium';
    }
  }

  /**
   * Calculate position concentration for specific symbols
   */
  getPositionConcentration(portfolio: PortfolioData, symbol: string): number {
    const position = portfolio.positions.find(p => p.symbol === symbol);
    if (!position || position.quantity === 0) {
      return 0;
    }

    const totalValue = portfolio.positions
      .filter(p => p.quantity > 0)
      .reduce((sum, p) => sum + p.marketValue, 0);

    return totalValue > 0 ? position.marketValue / totalValue : 0;
  }

  /**
   * Get top concentrated positions
   */
  getTopConcentratedPositions(
    portfolio: PortfolioData,
    limit: number = 5
  ): Array<{ symbol: string; concentration: number; marketValue: number }> {
    const positions = portfolio.positions.filter(p => p.quantity > 0);
    const totalValue = positions.reduce((sum, p) => sum + p.marketValue, 0);

    if (totalValue === 0) {
      return [];
    }

    return positions
      .map(p => ({
        symbol: p.symbol,
        concentration: p.marketValue / totalValue,
        marketValue: p.marketValue,
      }))
      .sort((a, b) => b.concentration - a.concentration)
      .slice(0, limit);
  }
}

export const riskCalculator = new RiskCalculator();
export default RiskCalculator;