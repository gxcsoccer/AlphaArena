/**
 * Risk Analytics Utilities
 * 
 * Provides comprehensive risk calculation functions for portfolio risk management.
 * Implements industry-standard risk metrics including VaR, CVaR, Beta, and more.
 */


/**
 * Risk metrics interface as specified in the issue
 */
export interface RiskMetrics {
  var95: number;      // 95% Value at Risk
  var99: number;      // 99% Value at Risk
  maxDrawdown: number;
  sharpeRatio: number;
  volatility: number;
  beta: number;
  concentrationRisk: number;
  liquidityRisk: number;
}

/**
 * Extended risk metrics with additional details
 */
export interface ExtendedRiskMetrics extends RiskMetrics {
  sortinoRatio: number;
  expectedShortfall95: number;
  expectedShortfall99: number;
  calmarRatio: number;
  treynorRatio: number;
  informationRatio: number;
  trackingError: number;
}

/**
 * Risk alert configuration
 */
export interface RiskAlert {
  id: string;
  metric: keyof RiskMetrics;
  threshold: number;
  operator: 'gt' | 'lt' | 'gte' | 'lte';
  channels: ('ui' | 'email' | 'webhook')[];
  enabled: boolean;
  triggeredAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Position risk analysis
 */
export interface PositionRisk {
  symbol: string;
  weight: number;
  contributionToRisk: number;
  varContribution: number;
  betaToPortfolio: number;
  liquidityScore: number;
  concentrationRisk: number;
}

/**
 * Correlation matrix entry
 */
export interface CorrelationEntry {
  symbol1: string;
  symbol2: string;
  correlation: number;
}

/**
 * Historical data point for risk calculations
 */
export interface RiskDataPoint {
  timestamp: Date;
  value: number;
  return?: number;
}

/**
 * Benchmark data for Beta calculation
 */
export interface BenchmarkData {
  timestamp: Date;
  value: number;
  return?: number;
}

/**
 * VaR calculation method
 */
export type VaRMethod = 'historical' | 'parametric' | 'monte_carlo';

/**
 * Calculate Value at Risk (VaR)
 * 
 * @param returns Array of historical returns
 * @param confidence Confidence level (0-1)
 * @param method Calculation method
 * @param portfolioValue Current portfolio value for absolute VaR
 */
export function calculateVaR(
  returns: number[],
  confidence: number = 0.95,
  method: VaRMethod = 'historical',
  portfolioValue?: number
): number {
  if (returns.length < 10) return 0;

  switch (method) {
    case 'historical':
      return calculateHistoricalVaR(returns, confidence, portfolioValue);
    case 'parametric':
      return calculateParametricVaR(returns, confidence, portfolioValue);
    case 'monte_carlo':
      return calculateMonteCarloVaR(returns, confidence, portfolioValue);
    default:
      return calculateHistoricalVaR(returns, confidence, portfolioValue);
  }
}

/**
 * Historical simulation VaR
 * Uses actual historical returns distribution
 */
function calculateHistoricalVaR(
  returns: number[],
  confidence: number,
  portfolioValue?: number
): number {
  const sortedReturns = [...returns].sort((a, b) => a - b);
  const index = Math.floor((1 - confidence) * sortedReturns.length);
  const varReturn = sortedReturns[index] || 0;
  
  // Return absolute value (loss as positive number)
  const varPercent = Math.abs(varReturn);
  
  return portfolioValue ? varPercent * portfolioValue : varPercent;
}

/**
 * Parametric VaR (Variance-Covariance approach)
 * Assumes normal distribution of returns
 */
function calculateParametricVaR(
  returns: number[],
  confidence: number,
  portfolioValue?: number
): number {
  if (returns.length < 2) return 0;

  const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length;
  const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length;
  const stdDev = Math.sqrt(variance);

  // Z-score for confidence level
  const zScores: Record<number, number> = {
    0.90: 1.282,
    0.95: 1.645,
    0.99: 2.326,
  };
  const zScore = zScores[confidence] || 1.645;

  // VaR = mean - z * stdDev (for loss)
  const varPercent = Math.abs(mean - zScore * stdDev);
  
  return portfolioValue ? varPercent * portfolioValue : varPercent;
}

/**
 * Monte Carlo VaR
 * Simulates returns using geometric Brownian motion
 */
function calculateMonteCarloVaR(
  returns: number[],
  confidence: number,
  portfolioValue?: number,
  simulations: number = 10000
): number {
  if (returns.length < 2) return 0;

  const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length;
  const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length;
  const stdDev = Math.sqrt(variance);

  // Generate simulated returns using Box-Muller transform
  const simulatedReturns: number[] = [];
  for (let i = 0; i < simulations; i++) {
    const u1 = Math.random();
    const u2 = Math.random();
    const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    const simReturn = mean + stdDev * z;
    simulatedReturns.push(simReturn);
  }

  // Sort and find VaR
  simulatedReturns.sort((a, b) => a - b);
  const index = Math.floor((1 - confidence) * simulatedReturns.length);
  const varReturn = simulatedReturns[index] || 0;
  
  const varPercent = Math.abs(varReturn);
  
  return portfolioValue ? varPercent * portfolioValue : varPercent;
}

/**
 * Calculate Expected Shortfall (Conditional VaR)
 * Average of losses beyond VaR threshold
 */
export function calculateExpectedShortfall(
  returns: number[],
  confidence: number = 0.95,
  portfolioValue?: number
): number {
  if (returns.length < 10) return 0;

  const sortedReturns = [...returns].sort((a, b) => a - b);
  const index = Math.floor((1 - confidence) * sortedReturns.length);
  const tailReturns = sortedReturns.slice(0, index + 1);
  
  if (tailReturns.length === 0) return 0;
  
  const esPercent = Math.abs(tailReturns.reduce((sum, r) => sum + r, 0) / tailReturns.length);
  
  return portfolioValue ? esPercent * portfolioValue : esPercent;
}

/**
 * Calculate Maximum Drawdown
 * Largest peak-to-trough decline in portfolio value
 */
export function calculateMaxDrawdown(values: number[]): {
  maxDrawdown: number;
  maxDrawdownPercent: number;
  peakIndex: number;
  troughIndex: number;
  duration: number;
} {
  if (values.length < 2) {
    return {
      maxDrawdown: 0,
      maxDrawdownPercent: 0,
      peakIndex: 0,
      troughIndex: 0,
      duration: 0,
    };
  }

  let peak = values[0];
  let peakIndex = 0;
  let maxDrawdown = 0;
  let maxDrawdownPercent = 0;
  let troughIndex = 0;
  let drawdownStart = 0;

  for (let i = 1; i < values.length; i++) {
    if (values[i] > peak) {
      peak = values[i];
      peakIndex = i;
    }
    
    const drawdown = peak - values[i];
    const drawdownPercent = peak > 0 ? (drawdown / peak) * 100 : 0;
    
    if (drawdown > maxDrawdown) {
      maxDrawdown = drawdown;
      maxDrawdownPercent = drawdownPercent;
      troughIndex = i;
      drawdownStart = peakIndex;
    }
  }

  return {
    maxDrawdown,
    maxDrawdownPercent,
    peakIndex: drawdownStart,
    troughIndex,
    duration: troughIndex - drawdownStart,
  };
}

/**
 * Calculate Volatility (Annualized Standard Deviation)
 */
export function calculateVolatility(
  returns: number[],
  periodsPerYear: number = 252
): number {
  if (returns.length < 2) return 0;

  const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length;
  const squaredDiffs = returns.map(r => Math.pow(r - mean, 2));
  const variance = squaredDiffs.reduce((sum, d) => sum + d, 0) / returns.length;
  
  return Math.sqrt(variance * periodsPerYear);
}

/**
 * Calculate Sharpe Ratio
 * Risk-adjusted return metric
 */
export function calculateSharpeRatio(
  returns: number[],
  riskFreeRate: number = 0,
  periodsPerYear: number = 252
): number {
  if (returns.length < 2) return 0;

  const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
  const volatility = calculateVolatility(returns, periodsPerYear);
  
  if (volatility === 0) return 0;

  const annualizedReturn = avgReturn * periodsPerYear;
  
  return (annualizedReturn - riskFreeRate) / volatility;
}

/**
 * Calculate Sortino Ratio
 * Uses downside deviation instead of total volatility
 */
export function calculateSortinoRatio(
  returns: number[],
  riskFreeRate: number = 0,
  periodsPerYear: number = 252
): number {
  if (returns.length < 2) return 0;

  const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
  
  // Calculate downside deviation
  const negativeReturns = returns.filter(r => r < 0);
  if (negativeReturns.length === 0) return Infinity;

  const squaredDownside = returns.map(r => r < 0 ? Math.pow(r, 2) : 0);
  const downsideVariance = squaredDownside.reduce((sum, d) => sum + d, 0) / returns.length;
  const downsideDeviation = Math.sqrt(downsideVariance * periodsPerYear);

  if (downsideDeviation === 0) return 0;

  const annualizedReturn = avgReturn * periodsPerYear;
  return (annualizedReturn - riskFreeRate) / downsideDeviation;
}

/**
 * Calculate Beta
 * Portfolio sensitivity to market movements
 */
export function calculateBeta(
  portfolioReturns: number[],
  benchmarkReturns: number[]
): number {
  if (portfolioReturns.length !== benchmarkReturns.length || portfolioReturns.length < 2) {
    return 0;
  }

  const n = portfolioReturns.length;
  const portfolioMean = portfolioReturns.reduce((sum, r) => sum + r, 0) / n;
  const benchmarkMean = benchmarkReturns.reduce((sum, r) => sum + r, 0) / n;

  let covariance = 0;
  let benchmarkVariance = 0;

  for (let i = 0; i < n; i++) {
    const portfolioDiff = portfolioReturns[i] - portfolioMean;
    const benchmarkDiff = benchmarkReturns[i] - benchmarkMean;
    covariance += portfolioDiff * benchmarkDiff;
    benchmarkVariance += Math.pow(benchmarkDiff, 2);
  }

  covariance /= n;
  benchmarkVariance /= n;

  return benchmarkVariance > 0 ? covariance / benchmarkVariance : 0;
}

/**
 * Calculate Concentration Risk
 * Uses Herfindahl-Hirschman Index (HHI)
 * 
 * HHI ranges from 0 (perfectly diversified) to 1 (single asset)
 */
export function calculateConcentrationRisk(
  positionWeights: number[]
): number {
  if (positionWeights.length === 0) return 0;
  
  // HHI = sum of squared weights
  // Normalize by 10000 to get 0-100 scale
  const hhi = positionWeights.reduce((sum, w) => sum + Math.pow(w, 2), 0);
  
  return hhi / 100; // Return as percentage (0-100)
}

/**
 * Calculate Liquidity Risk Score
 * Based on position size vs average daily volume
 */
export function calculateLiquidityRisk(
  positions: Array<{
    symbol: string;
    marketValue: number;
    averageDailyVolume?: number;
    currentPrice?: number;
  }>,
  totalPortfolioValue: number
): number {
  if (positions.length === 0) return 0;

  // If no volume data, estimate based on position size
  // Larger positions = higher liquidity risk
  let totalLiquidityRisk = 0;

  for (const pos of positions) {
    const weight = pos.marketValue / totalPortfolioValue;
    
    if (pos.averageDailyVolume && pos.currentPrice) {
      // Days to liquidate = position value / daily volume value
      const dailyVolumeValue = pos.averageDailyVolume * pos.currentPrice;
      const daysToLiquidate = pos.marketValue / dailyVolumeValue;
      
      // Higher days = higher risk
      const positionLiquidityRisk = Math.min(daysToLiquidate * weight * 10, 100);
      totalLiquidityRisk += positionLiquidityRisk;
    } else {
      // Estimate based on position weight
      // Assume larger positions take longer to liquidate
      totalLiquidityRisk += weight * 50; // Base risk score
    }
  }

  return Math.min(totalLiquidityRisk, 100);
}

/**
 * Calculate Calmar Ratio
 * Return relative to maximum drawdown
 */
export function calculateCalmarRatio(
  annualizedReturn: number,
  maxDrawdownPercent: number
): number {
  if (maxDrawdownPercent === 0) return 0;
  return annualizedReturn / maxDrawdownPercent;
}

/**
 * Calculate Treynor Ratio
 * Return relative to systematic risk (beta)
 */
export function calculateTreynorRatio(
  portfolioReturn: number,
  riskFreeRate: number,
  beta: number
): number {
  if (beta === 0) return 0;
  return (portfolioReturn - riskFreeRate) / beta;
}

/**
 * Calculate Information Ratio
 * Active return relative to tracking error
 */
export function calculateInformationRatio(
  portfolioReturns: number[],
  benchmarkReturns: number[]
): number {
  if (portfolioReturns.length !== benchmarkReturns.length || portfolioReturns.length < 2) {
    return 0;
  }

  const n = portfolioReturns.length;
  
  // Calculate active returns
  const activeReturns = portfolioReturns.map((r, i) => r - benchmarkReturns[i]);
  
  // Average active return
  const avgActiveReturn = activeReturns.reduce((sum, r) => sum + r, 0) / n;
  
  // Tracking error (std dev of active returns)
  const trackingError = calculateTrackingError(portfolioReturns, benchmarkReturns);
  
  if (trackingError === 0) return 0;
  
  return avgActiveReturn * 252 / trackingError; // Annualize
}

/**
 * Calculate Tracking Error
 * Standard deviation of active returns
 */
export function calculateTrackingError(
  portfolioReturns: number[],
  benchmarkReturns: number[]
): number {
  if (portfolioReturns.length !== benchmarkReturns.length || portfolioReturns.length < 2) {
    return 0;
  }

  const n = portfolioReturns.length;
  const activeReturns = portfolioReturns.map((r, i) => r - benchmarkReturns[i]);
  const meanActive = activeReturns.reduce((sum, r) => sum + r, 0) / n;
  
  const variance = activeReturns.reduce((sum, r) => sum + Math.pow(r - meanActive, 2), 0) / n;
  
  return Math.sqrt(variance * 252); // Annualize
}

/**
 * Calculate Position Risk Contributions
 * Marginal contribution to portfolio risk
 */
export function calculatePositionRiskContributions(
  positions: Array<{
    symbol: string;
    weight: number;
    volatility: number;
  }>,
  correlationMatrix: Map<string, Map<string, number>>
): PositionRisk[] {
  return positions.map(pos => {
    // Simplified calculation assuming equal correlation
    // In practice, use full covariance matrix
    const avgCorrelation = 0.5; // Default assumption
    
    const marginalRisk = pos.volatility * pos.weight * 
      (avgCorrelation * (1 - pos.weight) + pos.weight);
    
    return {
      symbol: pos.symbol,
      weight: pos.weight,
      contributionToRisk: marginalRisk * 100,
      varContribution: marginalRisk * pos.weight * 100,
      betaToPortfolio: marginalRisk / (pos.volatility || 1),
      liquidityScore: 100 - pos.weight * 50,
      concentrationRisk: pos.weight * 100,
    };
  });
}

/**
 * Calculate Correlation Matrix
 */
export function calculateCorrelationMatrix(
  priceHistory: Map<string, number[]>
): CorrelationEntry[] {
  const symbols = Array.from(priceHistory.keys());
  const entries: CorrelationEntry[] = [];

  for (let i = 0; i < symbols.length; i++) {
    for (let j = i; j < symbols.length; j++) {
      const series1 = priceHistory.get(symbols[i]) || [];
      const series2 = priceHistory.get(symbols[j]) || [];
      
      entries.push({
        symbol1: symbols[i],
        symbol2: symbols[j],
        correlation: i === j ? 1 : calculateCorrelation(series1, series2),
      });
    }
  }

  return entries;
}

/**
 * Calculate correlation between two series
 */
function calculateCorrelation(series1: number[], series2: number[]): number {
  if (series1.length !== series2.length || series1.length < 2) return 0;

  const n = series1.length;
  const mean1 = series1.reduce((sum, v) => sum + v, 0) / n;
  const mean2 = series2.reduce((sum, v) => sum + v, 0) / n;

  let numerator = 0;
  let denom1 = 0;
  let denom2 = 0;

  for (let i = 0; i < n; i++) {
    const diff1 = series1[i] - mean1;
    const diff2 = series2[i] - mean2;
    numerator += diff1 * diff2;
    denom1 += diff1 * diff1;
    denom2 += diff2 * diff2;
  }

  const denominator = Math.sqrt(denom1 * denom2);
  return denominator > 0 ? numerator / denominator : 0;
}

/**
 * Calculate complete risk metrics from historical data
 */
export function calculateCompleteRiskMetrics(
  historicalValues: RiskDataPoint[],
  benchmarkData?: BenchmarkData[],
  positions?: Array<{
    symbol: string;
    marketValue: number;
    weight: number;
    averageDailyVolume?: number;
    currentPrice?: number;
  }>,
  portfolioValue?: number
): ExtendedRiskMetrics {
  if (historicalValues.length < 2) {
    return {
      var95: 0,
      var99: 0,
      maxDrawdown: 0,
      sharpeRatio: 0,
      volatility: 0,
      beta: 0,
      concentrationRisk: 0,
      liquidityRisk: 0,
      sortinoRatio: 0,
      expectedShortfall95: 0,
      expectedShortfall99: 0,
      calmarRatio: 0,
      treynorRatio: 0,
      informationRatio: 0,
      trackingError: 0,
    };
  }

  // Calculate returns
  const returns: number[] = [];
  for (let i = 1; i < historicalValues.length; i++) {
    const prev = historicalValues[i - 1].value;
    const curr = historicalValues[i].value;
    if (prev > 0) {
      returns.push((curr - prev) / prev);
    }
  }

  const values = historicalValues.map(h => h.value);
  const { maxDrawdown, maxDrawdownPercent } = calculateMaxDrawdown(values);

  // Calculate VaR
  const var95 = calculateVaR(returns, 0.95, 'historical', portfolioValue);
  const var99 = calculateVaR(returns, 0.99, 'historical', portfolioValue);

  // Calculate Expected Shortfall
  const expectedShortfall95 = calculateExpectedShortfall(returns, 0.95, portfolioValue);
  const expectedShortfall99 = calculateExpectedShortfall(returns, 0.99, portfolioValue);

  // Calculate Beta if benchmark data available
  let beta = 0;
  let informationRatio = 0;
  let trackingError = 0;
  
  if (benchmarkData && benchmarkData.length === historicalValues.length) {
    const benchmarkReturns = benchmarkData.map((d, i) => {
      if (i === 0) return 0;
      return (d.value - benchmarkData[i - 1].value) / benchmarkData[i - 1].value;
    }).slice(1);
    
    beta = calculateBeta(returns, benchmarkReturns);
    trackingError = calculateTrackingError(returns, benchmarkReturns);
    informationRatio = calculateInformationRatio(returns, benchmarkReturns);
  }

  // Calculate concentration and liquidity risk
  let concentrationRisk = 0;
  let liquidityRisk = 0;
  
  if (positions && portfolioValue) {
    const weights = positions.map(p => p.weight);
    concentrationRisk = calculateConcentrationRisk(weights);
    liquidityRisk = calculateLiquidityRisk(positions, portfolioValue);
  }

  // Calculate ratios
  const annualizedReturn = returns.length > 0 
    ? returns.reduce((sum, r) => sum + r, 0) / returns.length * 252 
    : 0;
  
  const calmarRatio = calculateCalmarRatio(annualizedReturn, maxDrawdownPercent);
  const treynorRatio = calculateTreynorRatio(annualizedReturn, 0, beta);

  return {
    var95,
    var99,
    maxDrawdown,
    sharpeRatio: calculateSharpeRatio(returns),
    volatility: calculateVolatility(returns),
    beta,
    concentrationRisk,
    liquidityRisk,
    sortinoRatio: calculateSortinoRatio(returns),
    expectedShortfall95,
    expectedShortfall99,
    calmarRatio,
    treynorRatio,
    informationRatio,
    trackingError,
  };
}

/**
 * Check if risk alert should trigger
 */
export function checkRiskAlert(
  alert: RiskAlert,
  currentValue: number
): boolean {
  switch (alert.operator) {
    case 'gt':
      return currentValue > alert.threshold;
    case 'lt':
      return currentValue < alert.threshold;
    case 'gte':
      return currentValue >= alert.threshold;
    case 'lte':
      return currentValue <= alert.threshold;
    default:
      return false;
  }
}

/**
 * Format risk metric for display
 */
export function formatRiskMetric(
  metric: keyof RiskMetrics,
  value: number
): string {
  const formatters: Record<keyof RiskMetrics, (v: number) => string> = {
    var95: (v) => `$${v.toFixed(2)}`,
    var99: (v) => `$${v.toFixed(2)}`,
    maxDrawdown: (v) => `${v.toFixed(2)}%`,
    sharpeRatio: (v) => v.toFixed(2),
    volatility: (v) => `${v.toFixed(2)}%`,
    beta: (v) => v.toFixed(2),
    concentrationRisk: (v) => `${v.toFixed(2)}%`,
    liquidityRisk: (v) => `${v.toFixed(2)}`,
  };

  return formatters[metric](value);
}

export default {
  calculateVaR,
  calculateExpectedShortfall,
  calculateMaxDrawdown,
  calculateVolatility,
  calculateSharpeRatio,
  calculateSortinoRatio,
  calculateBeta,
  calculateConcentrationRisk,
  calculateLiquidityRisk,
  calculateCompleteRiskMetrics,
  checkRiskAlert,
  formatRiskMetric,
};
