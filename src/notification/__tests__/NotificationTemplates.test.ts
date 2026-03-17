/**
 * Tests for NotificationTemplates
 */

import {
  generateSignalTemplate,
  generateRiskTemplate,
  generatePerformanceTemplate,
  generateSystemTemplate,
} from '../NotificationTemplates.js';

describe('NotificationTemplates', () => {
  describe('generateSignalTemplate', () => {
    it('should generate a buy signal notification', () => {
      const data = {
        symbol: 'BTC/USDT',
        side: 'buy' as const,
        price: 50000,
        strategy: 'EMA Cross',
        confidence: 0.85,
      };

      const template = generateSignalTemplate(data);

      expect(template.title).toContain('BTC/USDT');
      expect(template.title).toContain('BUY');
      expect(template.message).toContain('EMA Cross');
      expect(template.message).toContain('$50,000.00');
      expect(template.message).toContain('85%');
      expect(template.priority).toBe('HIGH');
      expect(template.actionUrl).toBe('/trading/BTC/USDT');
    });

    it('should generate a sell signal notification', () => {
      const data = {
        symbol: 'ETH/USDT',
        side: 'sell' as const,
        price: 3000,
      };

      const template = generateSignalTemplate(data);

      expect(template.title).toContain('ETH/USDT');
      expect(template.title).toContain('SELL');
      expect(template.priority).toBe('MEDIUM');
    });

    it('should handle missing optional fields', () => {
      const data = {
        symbol: 'SOL/USDT',
        side: 'buy' as const,
      };

      const template = generateSignalTemplate(data);

      expect(template.title).toContain('SOL/USDT');
      expect(template.message).toBeDefined();
    });
  });

  describe('generateRiskTemplate', () => {
    it('should generate position limit risk notification', () => {
      const data = {
        risk_type: 'position_limit' as const,
        symbol: 'BTC/USDT',
        current_value: 10000,
        threshold_value: 8000,
      };

      const template = generateRiskTemplate(data);

      expect(template.title).toContain('Position Limit');
      expect(template.message).toContain('10,000.00');
      expect(template.message).toContain('8,000.00');
      expect(template.priority).toBe('HIGH');
    });

    it('should generate loss threshold risk notification with urgent priority', () => {
      const data = {
        risk_type: 'loss_threshold' as const,
        current_value: 15,
        threshold_value: 10,
      };

      const template = generateRiskTemplate(data);

      expect(template.title).toContain('Loss Threshold');
      expect(template.priority).toBe('URGENT');
    });

    it('should generate margin call notification with urgent priority', () => {
      const data = {
        risk_type: 'margin_call' as const,
        current_value: 25,
        threshold_value: 50,
      };

      const template = generateRiskTemplate(data);

      expect(template.title).toContain('Margin Call');
      expect(template.priority).toBe('URGENT');
      expect(template.message).toContain('critically low');
    });
  });

  describe('generatePerformanceTemplate', () => {
    it('should generate daily performance report', () => {
      const data = {
        period: 'daily' as const,
        total_pnl: 1500,
        total_pnl_percent: 5.5,
        win_rate: 0.65,
        trade_count: 10,
        best_trade: { symbol: 'BTC/USDT', pnl: 800 },
        worst_trade: { symbol: 'ETH/USDT', pnl: -200 },
      };

      const template = generatePerformanceTemplate(data);

      expect(template.title).toContain('Daily');
      expect(template.message).toContain('+$1,500.00');
      expect(template.message).toContain('+5.50%');
      expect(template.message).toContain('65.0%');
      expect(template.message).toContain('10 trades');
      expect(template.priority).toBe('LOW');
    });

    it('should handle negative PnL', () => {
      const data = {
        period: 'weekly' as const,
        total_pnl: -500,
        total_pnl_percent: -2.3,
        win_rate: 0.4,
        trade_count: 20,
      };

      const template = generatePerformanceTemplate(data);

      expect(template.message).toContain('-$500.00');
      expect(template.message).toContain('-2.30%');
    });
  });

  describe('generateSystemTemplate', () => {
    it('should generate maintenance notification', () => {
      const data = {
        event_type: 'maintenance' as const,
        scheduled_time: '2024-01-15T02:00:00Z',
        duration_minutes: 60,
      };

      const template = generateSystemTemplate(data);

      expect(template.title).toContain('Maintenance');
      expect(template.priority).toBe('MEDIUM');
      expect(template.message).toContain('60 minutes');
    });

    it('should generate system alert with high priority', () => {
      const data = {
        event_type: 'alert' as const,
        details: 'Critical system issue detected',
      };

      const template = generateSystemTemplate(data);

      expect(template.title).toContain('Alert');
      expect(template.priority).toBe('HIGH');
      expect(template.message).toContain('Critical system issue');
    });

    it('should generate info notification with low priority', () => {
      const data = {
        event_type: 'info' as const,
        details: 'System update completed',
      };

      const template = generateSystemTemplate(data);

      expect(template.title).toContain('Notice');
      expect(template.priority).toBe('LOW');
    });
  });
});
