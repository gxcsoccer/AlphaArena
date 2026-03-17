/**
 * Sentiment Utilities Tests
 */

import {
  DEFAULT_SENTIMENT_CONFIG,
  getFearGreedLevel,
  getSentimentSignal,
  getSentimentColor,
  getSentimentDisplayText,
  getSignalDisplayText,
} from '../sentiment';

describe('Sentiment Types and Helpers', () => {
  describe('getFearGreedLevel', () => {
    it('should return extreme_fear for values below 20', () => {
      expect(getFearGreedLevel(0)).toBe('extreme_fear');
      expect(getFearGreedLevel(10)).toBe('extreme_fear');
      expect(getFearGreedLevel(19)).toBe('extreme_fear');
    });

    it('should return fear for values between 20 and 39', () => {
      expect(getFearGreedLevel(20)).toBe('fear');
      expect(getFearGreedLevel(30)).toBe('fear');
      expect(getFearGreedLevel(39)).toBe('fear');
    });

    it('should return neutral for values between 40 and 59', () => {
      expect(getFearGreedLevel(40)).toBe('neutral');
      expect(getFearGreedLevel(50)).toBe('neutral');
      expect(getFearGreedLevel(59)).toBe('neutral');
    });

    it('should return greed for values between 60 and 79', () => {
      expect(getFearGreedLevel(60)).toBe('greed');
      expect(getFearGreedLevel(70)).toBe('greed');
      expect(getFearGreedLevel(79)).toBe('greed');
    });

    it('should return extreme_greed for values 80 and above', () => {
      expect(getFearGreedLevel(80)).toBe('extreme_greed');
      expect(getFearGreedLevel(90)).toBe('extreme_greed');
      expect(getFearGreedLevel(100)).toBe('extreme_greed');
    });
  });

  describe('getSentimentSignal', () => {
    it('should return correct signal for each level', () => {
      expect(getSentimentSignal('extreme_fear')).toBe('extreme_fear_buy');
      expect(getSentimentSignal('fear')).toBe('fear_caution');
      expect(getSentimentSignal('neutral')).toBe('neutral_hold');
      expect(getSentimentSignal('greed')).toBe('greed_watch');
      expect(getSentimentSignal('extreme_greed')).toBe('extreme_greed_sell');
    });
  });

  describe('getSentimentColor', () => {
    it('should return red for extreme fear', () => {
      expect(getSentimentColor(10)).toBe('rgb(245, 63, 63)');
    });

    it('should return orange for fear', () => {
      expect(getSentimentColor(25)).toBe('rgb(255, 125, 0)');
    });

    it('should return yellow for neutral', () => {
      expect(getSentimentColor(50)).toBe('rgb(255, 200, 0)');
    });

    it('should return light green for greed', () => {
      expect(getSentimentColor(70)).toBe('rgb(125, 200, 0)');
    });

    it('should return green for extreme greed', () => {
      expect(getSentimentColor(90)).toBe('rgb(0, 180, 42)');
    });
  });

  describe('getSentimentDisplayText', () => {
    it('should return Chinese text for each level', () => {
      expect(getSentimentDisplayText('extreme_fear')).toBe('极度恐惧');
      expect(getSentimentDisplayText('fear')).toBe('恐惧');
      expect(getSentimentDisplayText('neutral')).toBe('中性');
      expect(getSentimentDisplayText('greed')).toBe('贪婪');
      expect(getSentimentDisplayText('extreme_greed')).toBe('极度贪婪');
    });
  });

  describe('getSignalDisplayText', () => {
    it('should return Chinese text for each signal', () => {
      expect(getSignalDisplayText('extreme_fear_buy')).toBe('极度恐惧 - 潜在买入机会');
      expect(getSignalDisplayText('fear_caution')).toBe('恐惧 - 谨慎操作');
      expect(getSignalDisplayText('neutral_hold')).toBe('中性 - 持仓观望');
      expect(getSignalDisplayText('greed_watch')).toBe('贪婪 - 关注反转');
      expect(getSignalDisplayText('extreme_greed_sell')).toBe('极度贪婪 - 潜在卖出机会');
    });
  });

  describe('DEFAULT_SENTIMENT_CONFIG', () => {
    it('should have valid weight values that sum to 1', () => {
      const sum = DEFAULT_SENTIMENT_CONFIG.technicalWeight +
        DEFAULT_SENTIMENT_CONFIG.capitalFlowWeight +
        DEFAULT_SENTIMENT_CONFIG.volatilityWeight +
        DEFAULT_SENTIMENT_CONFIG.momentumWeight;
      
      expect(sum).toBeCloseTo(1, 5);
    });

    it('should have thresholds in ascending order', () => {
      expect(DEFAULT_SENTIMENT_CONFIG.extremeFearThreshold).toBeLessThan(DEFAULT_SENTIMENT_CONFIG.fearThreshold);
      expect(DEFAULT_SENTIMENT_CONFIG.fearThreshold).toBeLessThan(DEFAULT_SENTIMENT_CONFIG.greedThreshold);
      expect(DEFAULT_SENTIMENT_CONFIG.greedThreshold).toBeLessThan(DEFAULT_SENTIMENT_CONFIG.extremeGreedThreshold);
    });
  });
});
