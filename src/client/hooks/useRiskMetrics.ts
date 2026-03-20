/**
 * Hook for Risk Metrics
 * 
 * Provides calculated risk metrics, alerts management, and risk tracking
 * for the risk analytics dashboard.
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import type { Trade } from '../utils/api';
import {
  calculateVaR,
  calculateExpectedShortfall,
  calculateMaxDrawdown,
  calculateVolatility,
  calculateSharpeRatio,
  calculateSortinoRatio,
  calculateBeta,
  calculateConcentrationRisk,
  calculateLiquidityRisk,
  checkRiskAlert,
  type RiskMetrics,
  type ExtendedRiskMetrics,
  type RiskAlert,
  type RiskDataPoint,
  type BenchmarkData,
} from '../../utils/risk';

interface UseRiskMetricsOptions {
  trades: Trade[];
  portfolioValue: number;
  initialCapital: number;
  positions: Array<{
    symbol: string;
    quantity: number;
    averageCost: number;
    currentPrice?: number;
    marketValue?: number;
    averageDailyVolume?: number;
  }>;
  historicalValues: RiskDataPoint[];
  benchmarkData?: BenchmarkData[];
  riskFreeRate?: number;
}

interface RiskAlertTrigger {
  alert: RiskAlert;
  currentValue: number;
  triggeredAt: Date;
}

interface UseRiskMetricsResult {
  // Core risk metrics
  riskMetrics: RiskMetrics;
  extendedMetrics: ExtendedRiskMetrics;
  
  // Position risk analysis
  positionRisks: Array<{
    symbol: string;
    weight: number;
    contributionToRisk: number;
    varContribution: number;
  }>;
  
  // Alerts
  alerts: RiskAlert[];
  triggeredAlerts: RiskAlertTrigger[];
  addAlert: (alert: Omit<RiskAlert, 'id' | 'createdAt' | 'updatedAt'>) => void;
  removeAlert: (id: string) => void;
  updateAlert: (id: string, updates: Partial<RiskAlert>) => void;
  
  // Historical tracking
  riskHistory: Array<{
    timestamp: Date;
    metrics: RiskMetrics;
  }>;
  
  // Loading state
  isLoading: boolean;
  
  // Risk score (0-100, higher = more risk)
  overallRiskScore: number;
}

// Default alerts configuration
const DEFAULT_ALERTS: Omit<RiskAlert, 'id' | 'createdAt' | 'updatedAt'>[] = [
  {
    metric: 'var95',
    threshold: 5000,
    operator: 'gt',
    channels: ['ui'],
    enabled: true,
  },
  {
    metric: 'maxDrawdown',
    threshold: 20,
    operator: 'gt',
    channels: ['ui'],
    enabled: true,
  },
  {
    metric: 'sharpeRatio',
    threshold: 0,
    operator: 'lt',
    channels: ['ui'],
    enabled: true,
  },
  {
    metric: 'concentrationRisk',
    threshold: 50,
    operator: 'gt',
    channels: ['ui'],
    enabled: true,
  },
];

// Generate unique ID
function generateId(): string {
  return `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Hook for calculating comprehensive risk metrics
 */
export function useRiskMetrics(
  options: UseRiskMetricsOptions
): UseRiskMetricsResult {
  const {
    trades: _trades,
    portfolioValue,
    initialCapital: _initialCapital,
    positions,
    historicalValues,
    benchmarkData,
    riskFreeRate = 0,
  } = options;

  // State for alerts
  const [alerts, setAlerts] = useState<RiskAlert[]>(() => {
    const stored = localStorage.getItem('riskAlerts');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        return parsed.map((a: RiskAlert) => ({
          ...a,
          createdAt: new Date(a.createdAt),
          updatedAt: new Date(a.updatedAt),
          triggeredAt: a.triggeredAt ? new Date(a.triggeredAt) : undefined,
        }));
      } catch {
        // Initialize with defaults if parsing fails
      }
    }
    return DEFAULT_ALERTS.map(a => ({
      ...a,
      id: generateId(),
      createdAt: new Date(),
      updatedAt: new Date(),
    }));
  });

  // Store alerts in localStorage
  useEffect(() => {
    localStorage.setItem('riskAlerts', JSON.stringify(alerts));
  }, [alerts]);

  // Calculate returns from historical values
  const returns = useMemo(() => {
    if (historicalValues.length < 2) return [];
    
    const result: number[] = [];
    for (let i = 1; i < historicalValues.length; i++) {
      const prev = historicalValues[i - 1].value;
      const curr = historicalValues[i].value;
      if (prev > 0) {
        result.push((curr - prev) / prev);
      }
    }
    return result;
  }, [historicalValues]);

  // Calculate core risk metrics
  const riskMetrics = useMemo<RiskMetrics>(() => {
    if (returns.length < 10) {
      return {
        var95: 0,
        var99: 0,
        maxDrawdown: 0,
        sharpeRatio: 0,
        volatility: 0,
        beta: 0,
        concentrationRisk: 0,
        liquidityRisk: 0,
      };
    }

    const values = historicalValues.map(h => h.value);
    const { maxDrawdown } = calculateMaxDrawdown(values);

    // Calculate position weights
    const positionWeights = positions.map(p => {
      const marketValue = p.marketValue || (p.quantity * (p.currentPrice || p.averageCost));
      return (marketValue / portfolioValue) * 100;
    });

    // Calculate Beta if benchmark available
    let beta = 0;
    if (benchmarkData && benchmarkData.length === historicalValues.length) {
      const benchmarkReturns = benchmarkData.map((d, i) => {
        if (i === 0) return 0;
        return (d.value - benchmarkData[i - 1].value) / benchmarkData[i - 1].value;
      }).slice(1);
      beta = calculateBeta(returns, benchmarkReturns);
    }

    return {
      var95: calculateVaR(returns, 0.95, 'historical', portfolioValue),
      var99: calculateVaR(returns, 0.99, 'historical', portfolioValue),
      maxDrawdown,
      sharpeRatio: calculateSharpeRatio(returns, riskFreeRate),
      volatility: calculateVolatility(returns),
      beta,
      concentrationRisk: calculateConcentrationRisk(positionWeights),
      liquidityRisk: calculateLiquidityRisk(
        positions.map(p => ({
          symbol: p.symbol,
          marketValue: p.marketValue || p.quantity * (p.currentPrice || p.averageCost),
          averageDailyVolume: p.averageDailyVolume,
          currentPrice: p.currentPrice,
        })),
        portfolioValue
      ),
    };
  }, [returns, historicalValues, positions, portfolioValue, benchmarkData, riskFreeRate]);

  // Calculate extended metrics
  const extendedMetrics = useMemo<ExtendedRiskMetrics>(() => {
    const values = historicalValues.map(h => h.value);
    const { maxDrawdownPercent } = calculateMaxDrawdown(values);

    const annualizedReturn = returns.length > 0
      ? returns.reduce((sum, r) => sum + r, 0) / returns.length * 252
      : 0;

    // Calculate benchmark-based metrics
    let informationRatio = 0;
    let trackingError = 0;
    
    if (benchmarkData && benchmarkData.length === historicalValues.length) {
      const benchmarkReturns = benchmarkData.map((d, i) => {
        if (i === 0) return 0;
        return (d.value - benchmarkData[i - 1].value) / benchmarkData[i - 1].value;
      }).slice(1);
      
      // Calculate tracking error and information ratio
      const n = returns.length;
      const activeReturns = returns.map((r, i) => r - (benchmarkReturns[i] || 0));
      const meanActive = activeReturns.reduce((sum, r) => sum + r, 0) / n;
      const variance = activeReturns.reduce((sum, r) => sum + Math.pow(r - meanActive, 2), 0) / n;
      trackingError = Math.sqrt(variance * 252);
      informationRatio = trackingError > 0 ? meanActive * 252 / trackingError : 0;
    }

    return {
      ...riskMetrics,
      sortinoRatio: calculateSortinoRatio(returns, riskFreeRate),
      expectedShortfall95: calculateExpectedShortfall(returns, 0.95, portfolioValue),
      expectedShortfall99: calculateExpectedShortfall(returns, 0.99, portfolioValue),
      calmarRatio: maxDrawdownPercent > 0 ? annualizedReturn / maxDrawdownPercent : 0,
      treynorRatio: riskMetrics.beta > 0 ? annualizedReturn / riskMetrics.beta : 0,
      informationRatio,
      trackingError,
    };
  }, [riskMetrics, returns, historicalValues, benchmarkData, portfolioValue, riskFreeRate]);

  // Calculate position risks
  const positionRisks = useMemo(() => {
    return positions.map(pos => {
      const marketValue = pos.marketValue || (pos.quantity * (pos.currentPrice || pos.averageCost));
      const weight = (marketValue / portfolioValue) * 100;
      
      return {
        symbol: pos.symbol,
        weight,
        contributionToRisk: weight * riskMetrics.volatility / 100,
        varContribution: weight * riskMetrics.var95 / 100,
      };
    });
  }, [positions, portfolioValue, riskMetrics]);

  // Check triggered alerts
  const triggeredAlerts = useMemo<RiskAlertTrigger[]>(() => {
    return alerts
      .filter(alert => alert.enabled)
      .map(alert => {
        const currentValue = riskMetrics[alert.metric];
        const isTriggered = checkRiskAlert(alert, currentValue);
        
        if (isTriggered) {
          return {
            alert,
            currentValue,
            triggeredAt: new Date(),
          };
        }
        return null;
      })
      .filter((t): t is RiskAlertTrigger => t !== null);
  }, [alerts, riskMetrics]);

  // Alert management functions
  const addAlert = useCallback((alert: Omit<RiskAlert, 'id' | 'createdAt' | 'updatedAt'>) => {
    const newAlert: RiskAlert = {
      ...alert,
      id: generateId(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    setAlerts(prev => [...prev, newAlert]);
  }, []);

  const removeAlert = useCallback((id: string) => {
    setAlerts(prev => prev.filter(a => a.id !== id));
  }, []);

  const updateAlert = useCallback((id: string, updates: Partial<RiskAlert>) => {
    setAlerts(prev => prev.map(a => 
      a.id === id 
        ? { ...a, ...updates, updatedAt: new Date() }
        : a
    ));
  }, []);

  // Calculate historical risk tracking (simplified - daily snapshots)
  const riskHistory = useMemo(() => {
    // For now, return current metrics at each historical point
    // In production, this would calculate metrics at each point in time
    if (historicalValues.length < 10) return [];
    
    const result: Array<{ timestamp: Date; metrics: RiskMetrics }> = [];
    
    // Take every 10th data point for history
    for (let i = 10; i < historicalValues.length; i += 10) {
      const sliceValues = historicalValues.slice(0, i);
      const sliceReturns: number[] = [];
      
      for (let j = 1; j < sliceValues.length; j++) {
        const prev = sliceValues[j - 1].value;
        const curr = sliceValues[j].value;
        if (prev > 0) {
          sliceReturns.push((curr - prev) / prev);
        }
      }
      
      if (sliceReturns.length >= 10) {
        const values = sliceValues.map(h => h.value);
        const { maxDrawdown } = calculateMaxDrawdown(values);
        
        result.push({
          timestamp: sliceValues[sliceValues.length - 1].timestamp,
          metrics: {
            var95: calculateVaR(sliceReturns, 0.95, 'historical', portfolioValue),
            var99: calculateVaR(sliceReturns, 0.99, 'historical', portfolioValue),
            maxDrawdown,
            sharpeRatio: calculateSharpeRatio(sliceReturns, riskFreeRate),
            volatility: calculateVolatility(sliceReturns),
            beta: 0, // Would need benchmark history
            concentrationRisk: riskMetrics.concentrationRisk,
            liquidityRisk: riskMetrics.liquidityRisk,
          },
        });
      }
    }
    
    return result;
  }, [historicalValues, portfolioValue, riskFreeRate, riskMetrics.concentrationRisk, riskMetrics.liquidityRisk]);

  // Calculate overall risk score (0-100)
  const overallRiskScore = useMemo(() => {
    if (returns.length < 10) return 0;
    
    let score = 0;
    
    // VaR contribution (0-30 points)
    const varPercent = (riskMetrics.var95 / portfolioValue) * 100;
    score += Math.min(varPercent * 3, 30);
    
    // Max drawdown contribution (0-25 points)
    score += Math.min(riskMetrics.maxDrawdown / portfolioValue * 100 * 0.5, 25);
    
    // Volatility contribution (0-20 points)
    score += Math.min(riskMetrics.volatility / 5, 20);
    
    // Concentration risk (0-15 points)
    score += Math.min(riskMetrics.concentrationRisk / 100 * 15, 15);
    
    // Liquidity risk (0-10 points)
    score += Math.min(riskMetrics.liquidityRisk / 100 * 10, 10);
    
    return Math.min(score, 100);
  }, [riskMetrics, portfolioValue, returns.length]);

  const isLoading = !historicalValues || historicalValues.length < 2;

  return {
    riskMetrics,
    extendedMetrics,
    positionRisks,
    alerts,
    triggeredAlerts,
    addAlert,
    removeAlert,
    updateAlert,
    riskHistory,
    isLoading,
    overallRiskScore,
  };
}

export default useRiskMetrics;
