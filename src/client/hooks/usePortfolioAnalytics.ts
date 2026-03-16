/**
 * Hook for Portfolio Analytics
 * 
 * Provides calculated risk metrics, performance metrics, and position analysis
 * for portfolio visualization and monitoring.
 */

import { useMemo } from 'react';
import type { Trade } from '../utils/api';
import {
  calculateRiskMetrics,
  calculatePerformanceMetrics,
  analyzePositions,
  calculatePnLBreakdown,
  type RiskMetrics,
  type PerformanceMetrics,
  type PositionAnalysis,
  type PnLBreakdown,
  type HistoricalDataPoint,
} from '../utils/portfolioAnalytics';

interface UsePortfolioAnalyticsOptions {
  trades: Trade[];
  portfolioValue: number;
  initialCapital: number;
  positions: Array<{
    symbol: string;
    quantity: number;
    averageCost: number;
    currentPrice?: number;
    marketValue?: number;
    unrealizedPnL?: number;
    priceChange24h?: number;
    priceChangePercent24h?: number;
  }>;
  historicalValues: HistoricalDataPoint[];
  currentUnrealizedPnL: number;
}

interface PortfolioAnalyticsResult {
  riskMetrics: RiskMetrics;
  performanceMetrics: PerformanceMetrics;
  positionAnalysis: PositionAnalysis;
  pnlBreakdown: PnLBreakdown;
  isLoading: boolean;
}

/**
 * Hook for calculating comprehensive portfolio analytics
 */
export function usePortfolioAnalytics(
  options: UsePortfolioAnalyticsOptions
): PortfolioAnalyticsResult {
  const {
    trades,
    portfolioValue,
    initialCapital,
    positions,
    historicalValues,
    currentUnrealizedPnL,
  } = options;

  // Calculate risk metrics from historical data
  const riskMetrics = useMemo(() => {
    if (historicalValues.length < 2) {
      return {
        volatility: 0,
        maxDrawdown: 0,
        maxDrawdownPercent: 0,
        sharpeRatio: 0,
        sortinoRatio: 0,
        valueAtRisk95: 0,
        expectedShortfall: 0,
      };
    }
    return calculateRiskMetrics(historicalValues);
  }, [historicalValues]);

  // Calculate performance metrics from trades
  const performanceMetrics = useMemo(() => {
    return calculatePerformanceMetrics(
      trades,
      portfolioValue,
      initialCapital,
      historicalValues
    );
  }, [trades, portfolioValue, initialCapital, historicalValues]);

  // Analyze positions
  const positionAnalysis = useMemo(() => {
    if (positions.length === 0) {
      return {
        positions: [],
        topGainers: [],
        topLosers: [],
        concentrationRisk: 0,
        largestPositionWeight: 0,
      };
    }
    return analyzePositions(positions, portfolioValue);
  }, [positions, portfolioValue]);

  // Calculate P&L breakdown
  const pnlBreakdown = useMemo(() => {
    return calculatePnLBreakdown(trades, currentUnrealizedPnL, portfolioValue);
  }, [trades, currentUnrealizedPnL, portfolioValue]);

  const isLoading = !trades || !positions;

  return {
    riskMetrics,
    performanceMetrics,
    positionAnalysis,
    pnlBreakdown,
    isLoading,
  };
}

export default usePortfolioAnalytics;
