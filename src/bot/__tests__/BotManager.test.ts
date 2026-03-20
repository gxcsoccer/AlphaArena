/**
 * Tests for Bot Manager
 *
 * Note: These are unit tests that mock external dependencies.
 * Integration tests should be run against a real database.
 */

import { BotManager } from '../BotManager';
import { BotStatus, TradingMode, DEFAULT_RISK_SETTINGS, BotConfig } from '../BotConfig';

// Define mock storage type
interface MockStorage {
  bots: Map<string, BotConfig>;
  states: Map<string, any>;
  logs: any[];
  trades: any[];
  createBot: jest.Mock;
  getBot: jest.Mock;
  getAllBots: jest.Mock;
  getEnabledBots: jest.Mock;
  updateBot: jest.Mock;
  deleteBot: jest.Mock;
  saveState: jest.Mock;
  getState: jest.Mock;
  addLog: jest.Mock;
  getLogs: jest.Mock;
  saveTrade: jest.Mock;
  getTrades: jest.Mock;
  clear: () => void;
}

// Mock the storage
jest.mock('../BotStorage', () => {
  const mockStorage: MockStorage = {
    bots: new Map<string, BotConfig>(),
    states: new Map<string, any>(),
    logs: [],
    trades: [],
    
    createBot: jest.fn((config: BotConfig): Promise<BotConfig> => {
      mockStorage.bots.set(config.id, config);
      return Promise.resolve(config);
    }),
    getBot: jest.fn((id: string): Promise<BotConfig | null> => {
      return Promise.resolve(mockStorage.bots.get(id) || null);
    }),
    getAllBots: jest.fn((): Promise<BotConfig[]> => {
      return Promise.resolve(Array.from(mockStorage.bots.values()));
    }),
    getEnabledBots: jest.fn((): Promise<BotConfig[]> => {
      return Promise.resolve(
        Array.from(mockStorage.bots.values()).filter((b: BotConfig) => b.enabled)
      );
    }),
    updateBot: jest.fn((id: string, updates: Partial<BotConfig>): Promise<BotConfig> => {
      const bot = mockStorage.bots.get(id);
      if (bot) {
        Object.assign(bot, updates);
        return Promise.resolve(bot);
      }
      return Promise.reject(new Error('Bot not found'));
    }),
    deleteBot: jest.fn((id: string): Promise<void> => {
      mockStorage.bots.delete(id);
      return Promise.resolve();
    }),
    saveState: jest.fn((state: any): Promise<void> => {
      mockStorage.states.set(state.botId, state);
      return Promise.resolve();
    }),
    getState: jest.fn((botId: string): Promise<any | null> => {
      return Promise.resolve(mockStorage.states.get(botId) || null);
    }),
    addLog: jest.fn((log: any): Promise<void> => {
      mockStorage.logs.push(log);
      return Promise.resolve();
    }),
    getLogs: jest.fn((): Promise<any[]> => Promise.resolve([])),
    saveTrade: jest.fn((trade: any): Promise<void> => {
      mockStorage.trades.push(trade);
      return Promise.resolve();
    }),
    getTrades: jest.fn((): Promise<any[]> => Promise.resolve([])),
    clear: (): void => {
      mockStorage.bots.clear();
      mockStorage.states.clear();
      mockStorage.logs = [];
      mockStorage.trades = [];
    },
  };
  return { BotStorage: jest.fn(() => mockStorage) };
});

// Mock strategies
jest.mock('../../strategy/SMAStrategy', () => ({
  SMAStrategy: jest.fn().mockImplementation(() => ({
    getConfig: () => ({ id: 'test', name: 'Test' }),
    onInit: jest.fn(),
    onTick: jest.fn(() => null),
    onCleanup: jest.fn(),
    onOrderFilled: jest.fn(),
  })),
}));

jest.mock('../../strategy/RSIStrategy', () => ({
  RSIStrategy: jest.fn().mockImplementation(() => ({
    getConfig: () => ({ id: 'test', name: 'Test' }),
    onInit: jest.fn(),
    onTick: jest.fn(() => null),
    onCleanup: jest.fn(),
    onOrderFilled: jest.fn(),
  })),
}));

jest.mock('../../strategy/MACDStrategy', () => ({
  MACDStrategy: jest.fn().mockImplementation(() => ({
    getConfig: () => ({ id: 'test', name: 'Test' }),
    onInit: jest.fn(),
    onTick: jest.fn(() => null),
    onCleanup: jest.fn(),
    onOrderFilled: jest.fn(),
  })),
}));

jest.mock('../../strategy/BollingerBandsStrategy', () => ({
  BollingerBandsStrategy: jest.fn().mockImplementation(() => ({
    getConfig: () => ({ id: 'test', name: 'Test' }),
    onInit: jest.fn(),
    onTick: jest.fn(() => null),
    onCleanup: jest.fn(),
    onOrderFilled: jest.fn(),
  })),
}));

jest.mock('../../strategy/StochasticStrategy', () => ({
  StochasticStrategy: jest.fn().mockImplementation(() => ({
    getConfig: () => ({ id: 'test', name: 'Test' }),
    onInit: jest.fn(),
    onTick: jest.fn(() => null),
    onCleanup: jest.fn(),
    onOrderFilled: jest.fn(),
  })),
}));

jest.mock('../../strategy/ATRStrategy', () => ({
  ATRStrategy: jest.fn().mockImplementation(() => ({
    getConfig: () => ({ id: 'test', name: 'Test' }),
    onInit: jest.fn(),
    onTick: jest.fn(() => null),
    onCleanup: jest.fn(),
    onOrderFilled: jest.fn(),
  })),
}));

describe('BotManager', () => {
  let manager: BotManager;

  beforeEach(() => {
    manager = new BotManager();
    // Clear the mock storage
    jest.clearAllMocks();
  });

  afterEach(async () => {
    await manager.shutdown();
  });

  describe('createBot', () => {
    it('should create a bot with valid configuration', async () => {
      const request = {
        name: 'Test SMA Bot',
        strategy: 'SMA' as const,
        tradingPair: {
          base: 'BTC',
          quote: 'USDT',
          symbol: 'BTCUSDT',
        },
        interval: '1h' as const,
        initialCapital: 10000,
      };

      const config = await manager.createBot(request);

      expect(config.id).toBeDefined();
      expect(config.name).toBe('Test SMA Bot');
      expect(config.strategy).toBe('SMA');
      expect(config.mode).toBe(TradingMode.PAPER);
      expect(config.enabled).toBe(true);
      expect(config.riskSettings.maxCapitalPerTrade).toBe(DEFAULT_RISK_SETTINGS.maxCapitalPerTrade);
    });

    it('should create a bot with custom risk settings', async () => {
      const request = {
        name: 'Test RSI Bot',
        strategy: 'RSI' as const,
        tradingPair: {
          base: 'ETH',
          quote: 'USDT',
          symbol: 'ETHUSDT',
        },
        interval: '15m' as const,
        initialCapital: 5000,
        riskSettings: {
          stopLossPercent: 0.03,
          takeProfitPercent: 0.1,
        },
      };

      const config = await manager.createBot(request);

      expect(config.riskSettings.stopLossPercent).toBe(0.03);
      expect(config.riskSettings.takeProfitPercent).toBe(0.1);
      // Other settings should use defaults
      expect(config.riskSettings.maxCapitalPerTrade).toBe(DEFAULT_RISK_SETTINGS.maxCapitalPerTrade);
    });

    it('should create a bot with live trading mode', async () => {
      const request = {
        name: 'Live Trading Bot',
        strategy: 'MACD' as const,
        tradingPair: {
          base: 'BTC',
          quote: 'USDT',
          symbol: 'BTCUSDT',
        },
        interval: '4h' as const,
        mode: TradingMode.LIVE,
        initialCapital: 50000,
      };

      const config = await manager.createBot(request);

      expect(config.mode).toBe(TradingMode.LIVE);
    });

    it('should support all strategy types', async () => {
      const strategies = ['SMA', 'RSI', 'MACD', 'Bollinger', 'Stochastic', 'ATR'] as const;
      
      for (const strategy of strategies) {
        const config = await manager.createBot({
          name: `${strategy} Bot`,
          strategy,
          tradingPair: { base: 'BTC', quote: 'USDT', symbol: 'BTCUSDT' },
          interval: '1h',
          initialCapital: 10000,
        });

        expect(config.strategy).toBe(strategy);
      }
    });
  });

  describe('startBot and stopBot', () => {
    it('should start a bot', async () => {
      const config = await manager.createBot({
        name: 'Test Bot',
        strategy: 'SMA',
        tradingPair: { base: 'BTC', quote: 'USDT', symbol: 'BTCUSDT' },
        interval: '1h',
        initialCapital: 10000,
      });

      await manager.startBot(config.id);

      const state = await manager.getBotState(config.id);
      expect(state?.status).toBe(BotStatus.RUNNING);
    });

    it('should stop a running bot', async () => {
      const config = await manager.createBot({
        name: 'Test Bot',
        strategy: 'SMA',
        tradingPair: { base: 'BTC', quote: 'USDT', symbol: 'BTCUSDT' },
        interval: '1h',
        initialCapital: 10000,
      });

      await manager.startBot(config.id);
      await manager.stopBot(config.id);

      const state = await manager.getBotState(config.id);
      expect(state?.status).toBe(BotStatus.STOPPED);
    });

    it('should throw error for non-existent bot', async () => {
      await expect(manager.startBot('non-existent')).rejects.toThrow('Bot not found');
      await expect(manager.stopBot('non-existent')).rejects.toThrow('Bot not found');
    });
  });

  describe('pauseBot and resumeBot', () => {
    it('should pause a running bot', async () => {
      const config = await manager.createBot({
        name: 'Test Bot',
        strategy: 'SMA',
        tradingPair: { base: 'BTC', quote: 'USDT', symbol: 'BTCUSDT' },
        interval: '1h',
        initialCapital: 10000,
      });

      await manager.startBot(config.id);
      await manager.pauseBot(config.id);

      const state = await manager.getBotState(config.id);
      expect(state?.status).toBe(BotStatus.PAUSED);
    });

    it('should resume a paused bot', async () => {
      const config = await manager.createBot({
        name: 'Test Bot',
        strategy: 'SMA',
        tradingPair: { base: 'BTC', quote: 'USDT', symbol: 'BTCUSDT' },
        interval: '1h',
        initialCapital: 10000,
      });

      await manager.startBot(config.id);
      await manager.pauseBot(config.id);
      await manager.resumeBot(config.id);

      const state = await manager.getBotState(config.id);
      expect(state?.status).toBe(BotStatus.RUNNING);
    });
  });

  describe('updateBot', () => {
    it('should update bot name', async () => {
      const config = await manager.createBot({
        name: 'Test Bot',
        strategy: 'SMA',
        tradingPair: { base: 'BTC', quote: 'USDT', symbol: 'BTCUSDT' },
        interval: '1h',
        initialCapital: 10000,
      });

      const updated = await manager.updateBot(config.id, {
        name: 'Updated Bot Name',
      });

      expect(updated.name).toBe('Updated Bot Name');
    });

    it('should update risk settings', async () => {
      const config = await manager.createBot({
        name: 'Test Bot',
        strategy: 'SMA',
        tradingPair: { base: 'BTC', quote: 'USDT', symbol: 'BTCUSDT' },
        interval: '1h',
        initialCapital: 10000,
      });

      const updated = await manager.updateBot(config.id, {
        riskSettings: {
          stopLossPercent: 0.08,
        },
      });

      expect(updated.riskSettings.stopLossPercent).toBe(0.08);
    });
  });

  describe('deleteBot', () => {
    it('should delete a bot', async () => {
      const config = await manager.createBot({
        name: 'Test Bot',
        strategy: 'SMA',
        tradingPair: { base: 'BTC', quote: 'USDT', symbol: 'BTCUSDT' },
        interval: '1h',
        initialCapital: 10000,
      });

      await manager.deleteBot(config.id);

      await expect(manager.getBot(config.id)).resolves.toBeNull();
    });

    it('should throw error when deleting non-existent bot', async () => {
      await expect(manager.deleteBot('non-existent')).rejects.toThrow('Bot not found');
    });
  });

  describe('getRunningBots', () => {
    it('should return list of running bot IDs', async () => {
      const config1 = await manager.createBot({
        name: 'Bot 1',
        strategy: 'SMA',
        tradingPair: { base: 'BTC', quote: 'USDT', symbol: 'BTCUSDT' },
        interval: '1h',
        initialCapital: 10000,
      });

      const config2 = await manager.createBot({
        name: 'Bot 2',
        strategy: 'RSI',
        tradingPair: { base: 'ETH', quote: 'USDT', symbol: 'ETHUSDT' },
        interval: '15m',
        initialCapital: 5000,
      });

      await manager.startBot(config1.id);

      const running = manager.getRunningBots();
      expect(running).toContain(config1.id);
      expect(running).not.toContain(config2.id);
    });
  });

  describe('events', () => {
    it('should emit bot:created event', async () => {
      const eventPromise = new Promise((resolve) => {
        manager.on('bot:created', resolve);
      });

      await manager.createBot({
        name: 'Test Bot',
        strategy: 'SMA',
        tradingPair: { base: 'BTC', quote: 'USDT', symbol: 'BTCUSDT' },
        interval: '1h',
        initialCapital: 10000,
      });

      const event: any = await eventPromise;
      expect(event.type).toBe('bot:created');
      expect(event.data).toBeDefined();
    });

    it('should emit bot:started event', async () => {
      const eventPromise = new Promise((resolve) => {
        manager.on('bot:started', resolve);
      });

      const config = await manager.createBot({
        name: 'Test Bot',
        strategy: 'SMA',
        tradingPair: { base: 'BTC', quote: 'USDT', symbol: 'BTCUSDT' },
        interval: '1h',
        initialCapital: 10000,
      });

      await manager.startBot(config.id);

      const event: any = await eventPromise;
      expect(event.type).toBe('bot:started');
    });

    it('should emit bot:stopped event', async () => {
      const eventPromise = new Promise((resolve) => {
        manager.on('bot:stopped', resolve);
      });

      const config = await manager.createBot({
        name: 'Test Bot',
        strategy: 'SMA',
        tradingPair: { base: 'BTC', quote: 'USDT', symbol: 'BTCUSDT' },
        interval: '1h',
        initialCapital: 10000,
      });

      await manager.startBot(config.id);
      await manager.stopBot(config.id);

      const event: any = await eventPromise;
      expect(event.type).toBe('bot:stopped');
    });
  });
});
