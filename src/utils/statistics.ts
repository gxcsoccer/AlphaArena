/**
 * Statistical Analysis Utilities for A/B Testing
 *
 * Provides functions for:
 * - Chi-square test for independence
 * - Two-proportion z-test
 * - Confidence interval calculation
 * - Sample size estimation
 */

/**
 * Calculate the chi-square statistic for a 2x2 contingency table
 *
 * @param controlSuccess - Number of successes in control group
 * @param controlTotal - Total observations in control group
 * @param variantSuccess - Number of successes in variant group
 * @param variantTotal - Total observations in variant group
 * @returns Chi-square statistic
 */
export function chiSquareTest(
  controlSuccess: number,
  controlTotal: number,
  variantSuccess: number,
  variantTotal: number
): { chiSquare: number; pValue: number; isSignificant: boolean } {
  // Calculate observed values
  const a = controlSuccess; // Control success
  const b = controlTotal - controlSuccess; // Control failure
  const c = variantSuccess; // Variant success
  const d = variantTotal - variantSuccess; // Variant failure

  const total = a + b + c + d;

  if (total === 0) {
    return { chiSquare: 0, pValue: 1, isSignificant: false };
  }

  // Calculate expected values
  const row1Total = a + b;
  const row2Total = c + d;
  const col1Total = a + c;
  const col2Total = b + d;

  const expectedA = (row1Total * col1Total) / total;
  const expectedB = (row1Total * col2Total) / total;
  const expectedC = (row2Total * col1Total) / total;
  const expectedD = (row2Total * col2Total) / total;

  // Calculate chi-square
  let chiSquare = 0;

  if (expectedA > 0) chiSquare += Math.pow(a - expectedA, 2) / expectedA;
  if (expectedB > 0) chiSquare += Math.pow(b - expectedB, 2) / expectedB;
  if (expectedC > 0) chiSquare += Math.pow(c - expectedC, 2) / expectedC;
  if (expectedD > 0) chiSquare += Math.pow(d - expectedD, 2) / expectedD;

  // Calculate p-value using chi-square distribution with 1 degree of freedom
  const pValue = chiSquarePValue(chiSquare, 1);
  const isSignificant = pValue < 0.05;

  return { chiSquare, pValue, isSignificant };
}

/**
 * Calculate p-value from chi-square statistic using approximation
 * Uses the Wilson-Hilferty transformation for better accuracy
 */
function chiSquarePValue(chiSquare: number, degreesOfFreedom: number): number {
  if (chiSquare <= 0) return 1;

  // For 1 degree of freedom, use simple approximation
  if (degreesOfFreedom === 1) {
    // Use error function approximation
    const z = Math.sqrt(chiSquare);
    return 2 * (1 - normalCDF(z));
  }

  // For larger degrees of freedom, use Wilson-Hilferty approximation
  const z =
    (Math.pow(chiSquare / degreesOfFreedom, 1 / 3) -
      1 + 2 / (9 * degreesOfFreedom)) /
    Math.sqrt(2 / (9 * degreesOfFreedom));

  return 1 - normalCDF(z);
}

/**
 * Standard normal cumulative distribution function
 * Uses Abramowitz and Stegun approximation
 */
function normalCDF(x: number): number {
  // Constants for approximation
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;

  const sign = x < 0 ? -1 : 1;
  x = Math.abs(x) / Math.sqrt(2);

  const t = 1.0 / (1.0 + p * x);
  const y = 1.0 - ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);

  return 0.5 * (1.0 + sign * y);
}

/**
 * Calculate two-proportion z-test
 *
 * @param p1 - Proportion in group 1
 * @param n1 - Sample size in group 1
 * @param p2 - Proportion in group 2
 * @param n2 - Sample size in group 2
 * @returns Z-statistic, p-value, and significance
 */
export function twoProportionZTest(
  p1: number,
  n1: number,
  p2: number,
  n2: number
): { zStatistic: number; pValue: number; isSignificant: boolean } {
  if (n1 === 0 || n2 === 0) {
    return { zStatistic: 0, pValue: 1, isSignificant: false };
  }

  // Pooled proportion
  const x1 = p1 * n1;
  const x2 = p2 * n2;
  const pPool = (x1 + x2) / (n1 + n2);

  if (pPool === 0 || pPool === 1) {
    return { zStatistic: 0, pValue: 1, isSignificant: false };
  }

  // Standard error
  const se = Math.sqrt(pPool * (1 - pPool) * (1 / n1 + 1 / n2));

  if (se === 0) {
    return { zStatistic: 0, pValue: 1, isSignificant: false };
  }

  // Z-statistic
  const z = (p1 - p2) / se;

  // Two-tailed p-value
  const pValue = 2 * (1 - normalCDF(Math.abs(z)));

  return {
    zStatistic: z,
    pValue,
    isSignificant: pValue < 0.05,
  };
}

/**
 * Calculate confidence interval for a proportion
 *
 * @param success - Number of successes
 * @param total - Total observations
 * @param confidenceLevel - Confidence level (default: 0.95 for 95% CI)
 * @returns Lower and upper bounds of confidence interval
 */
export function confidenceInterval(
  success: number,
  total: number,
  confidenceLevel: number = 0.95
): { lower: number; upper: number } {
  if (total === 0) {
    return { lower: 0, upper: 0 };
  }

  const p = success / total;

  // Z-score for confidence level
  const zScore = getZScore(confidenceLevel);

  // Standard error
  const se = Math.sqrt((p * (1 - p)) / total);

  // Margin of error
  const me = zScore * se;

  return {
    lower: Math.max(0, p - me),
    upper: Math.min(1, p + me),
  };
}

/**
 * Get z-score for a given confidence level
 */
function getZScore(confidenceLevel: number): number {
  // Common z-scores
  const zScores: Record<number, number> = {
    0.8: 1.282,
    0.85: 1.44,
    0.9: 1.645,
    0.95: 1.96,
    0.99: 2.576,
    0.999: 3.291,
  };

  // Find closest match
  const levels = Object.keys(zScores).map(Number);
  const closest = levels.reduce((prev, curr) =>
    Math.abs(curr - confidenceLevel) < Math.abs(prev - confidenceLevel) ? curr : prev
  );

  return zScores[closest] || 1.96;
}

/**
 * Calculate confidence interval for the difference between two proportions
 *
 * @param p1 - Proportion in group 1
 * @param n1 - Sample size in group 1
 * @param p2 - Proportion in group 2
 * @param n2 - Sample size in group 2
 * @param confidenceLevel - Confidence level (default: 0.95)
 */
export function confidenceIntervalDifference(
  p1: number,
  n1: number,
  p2: number,
  n2: number,
  confidenceLevel: number = 0.95
): { lower: number; upper: number } {
  if (n1 === 0 || n2 === 0) {
    return { lower: 0, upper: 0 };
  }

  const diff = p1 - p2;

  // Standard error for difference
  const se = Math.sqrt((p1 * (1 - p1)) / n1 + (p2 * (1 - p2)) / n2);

  const zScore = getZScore(confidenceLevel);
  const me = zScore * se;

  return {
    lower: diff - me,
    upper: diff + me,
  };
}

/**
 * Calculate minimum sample size needed for a given effect size
 *
 * @param baselineConversion - Expected conversion rate for control
 * @param minimumDetectableEffect - Minimum relative improvement to detect (e.g., 0.1 for 10%)
 * @param significanceLevel - Alpha level (default: 0.05)
 * @param power - Statistical power (default: 0.8)
 * @returns Sample size needed per group
 */
export function calculateSampleSize(
  baselineConversion: number,
  minimumDetectableEffect: number,
  significanceLevel: number = 0.05,
  power: number = 0.8
): number {
  // Z-scores
  const alpha = significanceLevel;
  const zAlpha = getZScore(1 - alpha / 2); // Two-tailed
  const zBeta = getZScore(power); // One-tailed for power

  // Expected conversion for variant
  const p2 = baselineConversion * (1 + minimumDetectableEffect);
  const p1 = baselineConversion;

  // Average conversion rate
  const pAvg = (p1 + p2) / 2;

  // Sample size formula
  const numerator = Math.pow(zAlpha + zBeta, 2) * 2 * pAvg * (1 - pAvg);
  const denominator = Math.pow(p1 - p2, 2);

  const sampleSize = Math.ceil(numerator / denominator);

  return sampleSize;
}

/**
 * Calculate relative improvement
 */
export function calculateImprovement(controlRate: number, variantRate: number): number {
  if (controlRate === 0) {
    return variantRate > 0 ? Infinity : 0;
  }
  return ((variantRate - controlRate) / controlRate) * 100;
}

/**
 * Determine if an experiment has enough data for conclusions
 */
export function hasEnoughData(
  controlVisitors: number,
  controlConversions: number,
  variantVisitors: number,
  variantConversions: number,
  minimumSamplePerVariant: number = 100
): {
  hasEnough: boolean;
  reason: string;
  recommendedSampleSize: number | null;
} {
  if (controlVisitors < minimumSamplePerVariant || variantVisitors < minimumSamplePerVariant) {
    return {
      hasEnough: false,
      reason: `Insufficient sample size. Need at least ${minimumSamplePerVariant} visitors per variant.`,
      recommendedSampleSize: minimumSamplePerVariant,
    };
  }

  // Calculate sample size needed for 80% power to detect 10% improvement
  const controlRate = controlConversions / controlVisitors;
  const recommendedSample = calculateSampleSize(controlRate, 0.1);

  const currentMin = Math.min(controlVisitors, variantVisitors);

  if (currentMin < recommendedSample) {
    return {
      hasEnough: false,
      reason: `Need approximately ${recommendedSample} visitors per variant for 80% power to detect 10% improvement.`,
      recommendedSampleSize: recommendedSample,
    };
  }

  return {
    hasEnough: true,
    reason: 'Sufficient data collected for analysis.',
    recommendedSampleSize: null,
  };
}

/**
 * Generate experiment recommendation based on results
 */
export function generateRecommendation(
  controlRate: number,
  variantRate: number,
  pValue: number,
  improvement: number,
  confidenceLower: number,
  confidenceUpper: number
): string {
  if (pValue < 0.05) {
    if (improvement > 0) {
      return `Winner: Variant shows ${improvement.toFixed(1)}% improvement over control (p=${pValue.toFixed(
        4
      )}). Recommend implementing variant.`;
    } else {
      return `Loser: Variant shows ${Math.abs(improvement).toFixed(
        1
      )}% decrease compared to control (p=${pValue.toFixed(4)}). Recommend keeping control.`;
    }
  }

  if (pValue < 0.1) {
    return `Trending: Results show ${improvement > 0 ? 'positive' : 'negative'} trend but not statistically significant yet (p=${pValue.toFixed(
      4
    )}). Continue collecting data.`;
  }

  return `Inconclusive: No significant difference detected (p=${pValue.toFixed(4)}). Need more data or larger effect size.`;
}

export default {
  chiSquareTest,
  twoProportionZTest,
  confidenceInterval,
  confidenceIntervalDifference,
  calculateSampleSize,
  calculateImprovement,
  hasEnoughData,
  generateRecommendation,
};