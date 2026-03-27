/**
 * Tests for NotificationTemplates (SignalNotificationTemplates)
 */

import { SignalNotificationTemplates, getSignalNotificationTemplates } from '../NotificationTemplates.js';
import { SignalNotificationVariables, MarketContext } from '../NotificationTemplates.js';

describe('SignalNotificationTemplates', () => {
  let templates: SignalNotificationTemplates;

  beforeEach(async () => {
    templates = new SignalNotificationTemplates();
    await templates.initialize();
  });

  describe('initialization', () => {
    it('should initialize with default templates', async () => {
      const instance = new SignalNotificationTemplates();
      await instance.initialize();
      
      // Should have templates loaded
      expect(instance.getTemplate('signal.new', 'zh')).toBeDefined();
      expect(instance.getTemplate('signal.new', 'en')).toBeDefined();
      expect(instance.getTemplate('signal.update', 'zh')).toBeDefined();
      expect(instance.getTemplate('signal.close', 'zh')).toBeDefined();
      expect(instance.getTemplate('signal.alert', 'zh')).toBeDefined();
    });

    it('should return singleton instance', () => {
      const instance1 = getSignalNotificationTemplates();
      const instance2 = getSignalNotificationTemplates();
      expect(instance1).toBe(instance2);
    });
  });

  describe('render', () => {
    it('should render a buy signal notification in Chinese', () => {
      const variables: SignalNotificationVariables = {
        strategy_name: 'EMA Cross',
        symbol: 'BTC/USDT',
        side: '买入',  // Chinese for 'buy'
        entry_price: 50000,
        target_price: 55000,
        stop_loss: 48000,
        confidence: 85,
        analysis: 'RSI oversold, MACD bullish crossover',
        market_context: '24h涨跌: +3.5%',
        quick_actions: '快速操作:\n• 查看详情\n• 立即买入',
      };

      const result = templates.render('signal.new', variables, 'zh');

      expect(result.title).toContain('EMA Cross');
      expect(result.title).toContain('买入');
      expect(result.body).toContain('BTC/USDT');
      expect(result.body).toContain('50000');
      expect(result.body).toContain('55000');
      expect(result.body).toContain('48000');
      expect(result.body).toContain('85%');
      expect(result.body).toContain('RSI oversold');
    });

    it('should render a sell signal notification in English', () => {
      const variables: SignalNotificationVariables = {
        strategy_name: 'MACD Strategy',
        symbol: 'ETH/USDT',
        side: 'sell',
        entry_price: 3000,
        target_price: 2800,
        stop_loss: 3100,
        confidence: 75,
      };

      const result = templates.render('signal.new', variables, 'en');

      expect(result.title).toContain('MACD Strategy');
      expect(result.title).toContain('sell');
      expect(result.body).toContain('ETH/USDT');
      expect(result.body).toContain('3000');
    });

    it('should render signal update notification', () => {
      const variables: SignalNotificationVariables = {
        strategy_name: 'EMA Cross',
        symbol: 'BTC/USDT',
        status: 'running',
        current_price: 52000,
        pnl_percent: '+4%',
        market_context: '24h涨跌: +2.1%',
      };

      const result = templates.render('signal.update', variables, 'zh');

      expect(result.title).toContain('信号更新');
      expect(result.body).toContain('BTC/USDT');
      expect(result.body).toContain('running');
      expect(result.body).toContain('52000');
      expect(result.body).toContain('+4%');
    });

    it('should render signal close notification', () => {
      const variables: SignalNotificationVariables = {
        strategy_name: 'EMA Cross',
        symbol: 'BTC/USDT',
        pnl_percent: '+5.2%',
        market_context: '24h涨跌: +1.8%',
      };

      const result = templates.render('signal.close', variables, 'zh');

      expect(result.title).toContain('信号平仓');
      expect(result.body).toContain('BTC/USDT');
      expect(result.body).toContain('+5.2%');
    });

    it('should render price alert notification', () => {
      const variables: SignalNotificationVariables = {
        strategy_name: 'EMA Cross',
        symbol: 'SOL/USDT',
        alert_type: '价格突破',
        message: '突破阻力位 $150',
        current_price: 152.5,
        market_context: '24h涨跌: +8.2%',
      };

      const result = templates.render('signal.alert', variables, 'zh');

      expect(result.title).toContain('价格提醒');
      expect(result.body).toContain('SOL/USDT');
      expect(result.body).toContain('价格突破');
      expect(result.body).toContain('突破阻力位');
      expect(result.body).toContain('152.5');
    });

    it('should handle missing optional fields with N/A', () => {
      const variables: SignalNotificationVariables = {
        symbol: 'DOGE/USDT',
        side: 'buy',
      };

      const result = templates.render('signal.new', variables, 'zh');

      expect(result.body).toContain('DOGE/USDT');
      // Missing fields should be replaced with N/A
      expect(result.body).toContain('N/A');
    });

    it('should fallback to Chinese if language not found', () => {
      const variables: SignalNotificationVariables = {
        strategy_name: 'Test Strategy',
        symbol: 'BTC/USDT',
        side: 'buy',
      };

      // Request a non-existent language, should fallback to zh
      const result = templates.render('signal.new', variables, 'fr');

      expect(result.title).toBeDefined();
      expect(result.body).toBeDefined();
    });
  });

  describe('formatMarketContext', () => {
    it('should format market context in Chinese', () => {
      const context: MarketContext = {
        currentPrice: 50000,
        priceChange24h: 3.5,
        high24h: 51000,
        low24h: 49000,
        volume24h: 2500000000,
        rsi: 65.5,
      };

      const result = templates.formatMarketContext(context, 'zh');

      expect(result).toContain('当前价: 50000');
      expect(result).toContain('24h涨跌: +3.50%');
      expect(result).toContain('49000 - 51000');
      expect(result).toContain('2.50B');
      expect(result).toContain('RSI: 65.5');
    });

    it('should format market context in English', () => {
      const context: MarketContext = {
        currentPrice: 50000,
        priceChange24h: -2.3,
        high24h: 51000,
        low24h: 49000,
        volume24h: 1500000,
        rsi: 35.2,
      };

      const result = templates.formatMarketContext(context, 'en');

      expect(result).toContain('Current: 50000');
      expect(result).toContain('24h Change: -2.30%');
      expect(result).toContain('24h Range: 49000 - 51000');
      expect(result).toContain('1.50M');
      expect(result).toContain('RSI: 35.2');
    });

    it('should handle undefined context', () => {
      const result = templates.formatMarketContext(undefined, 'zh');
      expect(result).toBe('');
    });

    it('should handle partial context', () => {
      const context: MarketContext = {
        currentPrice: 50000,
        priceChange24h: 1.5,
      };

      const result = templates.formatMarketContext(context, 'zh');

      expect(result).toContain('当前价: 50000');
      expect(result).toContain('24h涨跌: +1.50%');
      expect(result).not.toContain('RSI');
    });

    it('should format volume with K suffix', () => {
      const context: MarketContext = {
        volume24h: 15000,
      };

      const result = templates.formatMarketContext(context, 'zh');
      expect(result).toContain('15.00K');
    });

    it('should format volume without suffix for small values', () => {
      const context: MarketContext = {
        volume24h: 500,
      };

      const result = templates.formatMarketContext(context, 'zh');
      expect(result).toContain('500.00');
    });
  });

  describe('formatQuickActions', () => {
    it('should format quick actions in Chinese for buy signal', () => {
      const result = templates.formatQuickActions('signal-123', 'buy', 'zh');

      expect(result).toContain('快速操作');
      expect(result).toContain('signal-123');
      expect(result).toContain('立即买入');
    });

    it('should format quick actions in Chinese for sell signal', () => {
      const result = templates.formatQuickActions('signal-456', 'sell', 'zh');

      expect(result).toContain('快速操作');
      expect(result).toContain('signal-456');
      expect(result).toContain('立即卖出');
    });

    it('should format quick actions in English for buy signal', () => {
      const result = templates.formatQuickActions('signal-789', 'buy', 'en');

      expect(result).toContain('Quick Actions');
      expect(result).toContain('signal-789');
      expect(result).toContain('Buy Now');
    });

    it('should format quick actions in English for sell signal', () => {
      const result = templates.formatQuickActions('signal-abc', 'sell', 'en');

      expect(result).toContain('Quick Actions');
      expect(result).toContain('signal-abc');
      expect(result).toContain('Sell Now');
    });
  });

  describe('getTemplate', () => {
    it('should return template for valid key and language', () => {
      const template = templates.getTemplate('signal.new', 'zh');

      expect(template).toBeDefined();
      expect(template?.templateKey).toBe('signal.new');
      expect(template?.language).toBe('zh');
      expect(template?.titleTemplate).toContain('{strategy_name}');
      expect(template?.bodyTemplate).toContain('{symbol}');
    });

    it('should return undefined for invalid key', () => {
      const template = templates.getTemplate('invalid.key', 'zh');
      expect(template).toBeUndefined();
    });
  });

  describe('template content verification', () => {
    it('should have correct Chinese new signal template', () => {
      const template = templates.getTemplate('signal.new', 'zh');
      
      expect(template?.titleTemplate).toBe('【{strategy_name}】{side}信号');
      expect(template?.bodyTemplate).toContain('入场价: {entry_price}');
      expect(template?.bodyTemplate).toContain('目标价: {target_price}');
      expect(template?.bodyTemplate).toContain('止损价: {stop_loss}');
      expect(template?.bodyTemplate).toContain('置信度: {confidence}%');
    });

    it('should have correct English new signal template', () => {
      const template = templates.getTemplate('signal.new', 'en');
      
      expect(template?.titleTemplate).toBe('[{strategy_name}] {side} Signal');
      expect(template?.bodyTemplate).toContain('Entry: {entry_price}');
      expect(template?.bodyTemplate).toContain('Target: {target_price}');
      expect(template?.bodyTemplate).toContain('Stop Loss: {stop_loss}');
      expect(template?.bodyTemplate).toContain('Confidence: {confidence}%');
    });

    it('should have correct update signal template', () => {
      const template = templates.getTemplate('signal.update', 'zh');
      
      expect(template?.titleTemplate).toContain('信号更新');
      expect(template?.bodyTemplate).toContain('{status}');
      expect(template?.bodyTemplate).toContain('{pnl_percent}');
    });

    it('should have correct close signal template', () => {
      const template = templates.getTemplate('signal.close', 'zh');
      
      expect(template?.titleTemplate).toContain('信号平仓');
      expect(template?.bodyTemplate).toContain('{pnl_percent}');
    });

    it('should have correct alert signal template', () => {
      const template = templates.getTemplate('signal.alert', 'zh');
      
      expect(template?.titleTemplate).toContain('价格提醒');
      expect(template?.bodyTemplate).toContain('{alert_type}');
      expect(template?.bodyTemplate).toContain('{message}');
    });
  });
});