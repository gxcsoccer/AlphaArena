/**
 * Tests for A/B Testing Statistics Utilities
 */

import {
  chiSquareTest,
  twoProportionZTest,
  confidenceInterval,
  confidenceIntervalDifference,
  calculateSampleSize,
  calculateImprovement,
  hasEnoughData,
  generateRecommendation,
} from '../../src/utils/statistics';

describe('Chi-Square Test', () => {
  test('should calculate chi-square for significant difference', () => {
    // Control: 100 conversions out of 1000 (10%)
    // Variant: 150 conversions out of 1000 (15%)
    const result = chiSquareTest(100, 1000, 150, 1000);

    expect(result.chiSquare).toBeGreaterThan(0);
    expect(result.pValue).toBeLessThan(0.05);
    expect(result.isSignificant).toBe(true);
  });

  test('should return non-significant for similar rates', () => {
    // Control: 100 conversions out of 1000 (10%)
    // Variant: 105 conversions out of 1000 (10.5%)
    const result = chiSquareTest(100, 1000, 105, 1000);

    expect(result.pValue).toBeGreaterThan(0.05);
    expect(result.isSignificant).toBe(false);
  });

  test('should handle zero observations', () => {
    const result = chiSquareTest(0, 0, 0, 0);

    expect(result.chiSquare).toBe(0);
    expect(result.pValue).toBe(1);
    expect(result.isSignificant).toBe(false);
  });

  test('should handle edge case with all successes', () => {
    const result = chiSquareTest(100, 100, 100, 100);

    expect(result.chiSquare).toBe(0);
    expect(result.pValue).toBe(1);
  });
});

describe('Two-Proportion Z-Test', () => {
  test('should detect significant difference', () => {
    const result = twoProportionZTest(0.1, 1000, 0.15, 1000);

    expect(Math.abs(result.zStatistic)).toBeGreaterThan(1.96);
    expect(result.pValue).toBeLessThan(0.05);
    expect(result.isSignificant).toBe(true);
  });

  test('should not detect significant difference for similar proportions', () => {
    const result = twoProportionZTest(0.1, 1000, 0.105, 1000);

    expect(Math.abs(result.zStatistic)).toBeLessThan(1.96);
    expect(result.pValue).toBeGreaterThan(0.05);
    expect(result.isSignificant).toBe(false);
  });

  test('should handle zero sample size', () => {
    const result = twoProportionZTest(0.1, 0, 0.15, 1000);

    expect(result.zStatistic).toBe(0);
    expect(result.pValue).toBe(1);
  });
});

describe('Confidence Interval', () => {
  test('should calculate confidence interval for proportion', () => {
    // 100 successes out of 1000 (10%)
    const result = confidenceInterval(100, 1000);

    expect(result.lower).toBeLessThan(0.1);
    expect(result.upper).toBeGreaterThan(0.1);
    expect(result.lower).toBeGreaterThanOrEqual(0);
    expect(result.upper).toBeLessThanOrEqual(1);
  });

  test('should handle zero observations', () => {
    const result = confidenceInterval(0, 0);

    expect(result.lower).toBe(0);
    expect(result.upper).toBe(0);
  });

  test('should handle all successes', () => {
    const result = confidenceInterval(100, 100);

    expect(result.lower).toBeGreaterThanOrEqual(0);
    expect(result.upper).toBe(1);
  });

  test('should calculate different confidence levels', () => {
    const ci95 = confidenceInterval(100, 1000, 0.95);
    const ci99 = confidenceInterval(100, 1000, 0.99);

    // 99% CI should be wider than 95% CI
    expect(ci99.upper - ci99.lower).toBeGreaterThan(ci95.upper - ci95.lower);
  });
});

describe('Confidence Interval for Difference', () => {
  test('should calculate CI for difference between proportions', () => {
    const result = confidenceIntervalDifference(0.15, 1000, 0.1, 1000);

    // Variant is 5% higher, so difference should be around 0.05
    expect(result.lower).toBeLessThan(0.05);
    expect(result.upper).toBeGreaterThan(0.05);
  });

  test('should handle zero sample size', () => {
    const result = confidenceIntervalDifference(0.1, 0, 0.15, 1000);

    expect(result.lower).toBe(0);
    expect(result.upper).toBe(0);
  });
});

describe('Sample Size Calculation', () => {
  test('should calculate required sample size', () => {
    // For 10% baseline, detecting 20% improvement
    const sampleSize = calculateSampleSize(0.1, 0.2);

    expect(sampleSize).toBeGreaterThan(0);
    expect(sampleSize).toBeLessThan(50000); // Reasonable bound
  });

  test('should require larger sample for smaller effect', () => {
    const smallEffect = calculateSampleSize(0.1, 0.1);
    const largeEffect = calculateSampleSize(0.1, 0.3);

    expect(smallEffect).toBeGreaterThan(largeEffect);
  });

  test('should require larger sample for lower baseline', () => {
    const lowBaseline = calculateSampleSize(0.02, 0.2);
    const highBaseline = calculateSampleSize(0.5, 0.2);

    expect(lowBaseline).toBeGreaterThan(highBaseline);
  });
});

describe('Improvement Calculation', () => {
  test('should calculate positive improvement', () => {
    const improvement = calculateImprovement(0.1, 0.15);

    expect(improvement).toBeCloseTo(50, 1); // ~50% improvement
  });

  test('should calculate negative improvement', () => {
    const improvement = calculateImprovement(0.15, 0.1);

    expect(improvement).toBeCloseTo(-33.33, 1); // ~33% decrease
  });

  test('should handle zero control rate', () => {
    const improvement = calculateImprovement(0, 0.1);

    expect(improvement).toBe(Infinity);
  });

  test('should handle same rates', () => {
    const improvement = calculateImprovement(0.1, 0.1);

    expect(improvement).toBe(0);
  });
});

describe('Has Enough Data', () => {
  test('should return false for insufficient sample', () => {
    const result = hasEnoughData(50, 5, 50, 6);

    expect(result.hasEnough).toBe(false);
    expect(result.reason).toContain('Insufficient sample size');
  });

  test('should return true for sufficient sample', () => {
    // For a very large sample, it should definitely pass
    // The function uses control rate to calculate required sample
    const result = hasEnoughData(30000, 3000, 30000, 3300);

    expect(result.hasEnough).toBe(true);
  });

  test('should recommend sample size for small samples', () => {
    const result = hasEnoughData(100, 10, 100, 12);

    expect(result.recommendedSampleSize).toBeGreaterThan(0);
  });
});

describe('Generate Recommendation', () => {
  test('should recommend winner for significant positive result', () => {
    const recommendation = generateRecommendation(0.1, 0.15, 0.01, 50, 0.02, 0.08);

    expect(recommendation).toContain('Winner');
    expect(recommendation).toContain('50.0% improvement');
  });

  test('should recommend loser for significant negative result', () => {
    const recommendation = generateRecommendation(0.15, 0.1, 0.01, -33.33, -0.08, -0.02);

    expect(recommendation).toContain('Loser');
    expect(recommendation).toContain('decrease');
  });

  test('should indicate trending for marginal significance', () => {
    const recommendation = generateRecommendation(0.1, 0.12, 0.08, 20, 0.005, 0.035);

    expect(recommendation).toContain('Trending');
  });

  test('should indicate inconclusive for non-significant result', () => {
    const recommendation = generateRecommendation(0.1, 0.105, 0.5, 5, -0.01, 0.02);

    expect(recommendation).toContain('Inconclusive');
  });
});