/**
 * Tests for Bot API Routes
 */

import request from 'supertest';
import express from 'express';
import { createBotRouter } from '../botRoutes';
import { BotManager, BotConfig, BotState } from '../../bot';
import { BotStatus, TradingMode, DEFAULT_RISK_SETTINGS } from '../../bot/BotConfig';

// Mock BotManager
jest.mock('../../bot/BotManager');

describe('Bot Routes', () => {
  let app: express.Application;
  let mockBotManager: jest.Mocked<BotManager>;

  // Helper to create a valid BotConfig
  const createMockBotConfig = (overrides: Partial<BotConfig> = {}): BotConfig => ({
    id: 'bot-123',
    name: 'Test Bot',
    strategy: 'SMA',
    strategyParams: { shortPeriod: 10, longPeriod: 20 },
    tradingPair: { base: 'BTC', quote: 'USDT', symbol: 'BTCUSDT' },
    interval: '1h',
    mode: TradingMode.PAPER,
    riskSettings: DEFAULT_RISK_SETTINGS,
    initialCapital: 10000,
    createdAt: new Date(),
    updatedAt: new Date(),
    enabled: true,
    ...overrides,
  });

  // Helper to create a valid BotState
  const createMockBotState = (overrides: Partial<BotState> = {}): BotState => ({
    botId: 'bot-123',
    status: BotStatus.RUNNING,
    portfolioValue: 10500,
    initialCapital: 10000,
    realizedPnL: 500,
    unrealizedPnL: 0,
    totalPnL: 500,
    tradeCount: 10,
    winCount: 6,
    lossCount: 4,
    positionQuantity: 0,
    positionAveragePrice: 0,
    totalRuntimeMs: 3600000,
    dailyPnL: 100,
    ...overrides,
  });

  beforeEach(() => {
    // Create mock bot manager
    mockBotManager = {
      getAllBots: jest.fn(),
      createBot: jest.fn(),
      getBot: jest.fn(),
      getBotState: jest.fn(),
      updateBot: jest.fn(),
      deleteBot: jest.fn(),
      startBot: jest.fn(),
      stopBot: jest.fn(),
      pauseBot: jest.fn(),
      resumeBot: jest.fn(),
      getRunningBots: jest.fn(),
      startAllBots: jest.fn(),
      stopAllBots: jest.fn(),
      initialize: jest.fn(),
      shutdown: jest.fn(),
      processTick: jest.fn(),
      processTickAll: jest.fn(),
      on: jest.fn(),
      emit: jest.fn(),
    } as any;

    // Setup express app with bot router
    app = express();
    app.use(express.json());
    app.use('/api/bot', createBotRouter(mockBotManager));
  });

  describe('GET /api/bot', () => {
    it('should return all bots', async () => {
      const mockBots = [
        createMockBotConfig({ id: 'bot-1', name: 'Bot 1' }),
        createMockBotConfig({ id: 'bot-2', name: 'Bot 2' }),
      ];
      mockBotManager.getAllBots.mockResolvedValue(mockBots);

      const response = await request(app).get('/api/bot');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(2);
      expect(response.body.count).toBe(2);
    });

    it('should handle errors', async () => {
      mockBotManager.getAllBots.mockRejectedValue(new Error('Database error'));

      const response = await request(app).get('/api/bot');

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Database error');
    });
  });

  describe('POST /api/bot', () => {
    it('should create a new bot', async () => {
      const botConfig = createMockBotConfig();
      mockBotManager.createBot.mockResolvedValue(botConfig);

      const response = await request(app)
        .post('/api/bot')
        .send({
          name: 'Test Bot',
          strategy: 'SMA',
          tradingPair: { base: 'BTC', quote: 'USDT', symbol: 'BTCUSDT' },
          interval: '1h',
          mode: 'paper',
          initialCapital: 10000,
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe('Test Bot');
    });

    it('should reject missing name', async () => {
      const response = await request(app)
        .post('/api/bot')
        .send({
          strategy: 'SMA',
          tradingPair: { base: 'BTC', quote: 'USDT', symbol: 'BTCUSDT' },
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('name');
    });

    it('should reject missing strategy', async () => {
      const response = await request(app)
        .post('/api/bot')
        .send({
          name: 'Test Bot',
          tradingPair: { base: 'BTC', quote: 'USDT', symbol: 'BTCUSDT' },
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Strategy');
    });

    it('should reject missing trading pair', async () => {
      const response = await request(app)
        .post('/api/bot')
        .send({
          name: 'Test Bot',
          strategy: 'SMA',
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Trading pair');
    });

    it('should reject invalid initial capital', async () => {
      const response = await request(app)
        .post('/api/bot')
        .send({
          name: 'Test Bot',
          strategy: 'SMA',
          tradingPair: { base: 'BTC', quote: 'USDT', symbol: 'BTCUSDT' },
          initialCapital: -100,
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Initial capital');
    });
  });

  describe('GET /api/bot/:id', () => {
    it('should return bot details', async () => {
      const mockBot = createMockBotConfig();
      const mockState = createMockBotState();
      mockBotManager.getBot.mockResolvedValue(mockBot);
      mockBotManager.getBotState.mockResolvedValue(mockState);

      const response = await request(app).get('/api/bot/bot-123');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.config.id).toBe('bot-123');
      expect(response.body.data.state.botId).toBe('bot-123');
    });

    it('should return 404 for non-existent bot', async () => {
      mockBotManager.getBot.mockResolvedValue(null);

      const response = await request(app).get('/api/bot/non-existent');

      expect(response.status).toBe(404);
      expect(response.body.code).toBe('BOT_NOT_FOUND');
    });
  });

  describe('PUT /api/bot/:id', () => {
    it('should update bot configuration', async () => {
      const updatedBot = createMockBotConfig({ name: 'Updated Bot' });
      mockBotManager.updateBot.mockResolvedValue(updatedBot);

      const response = await request(app)
        .put('/api/bot/bot-123')
        .send({ name: 'Updated Bot' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe('Updated Bot');
    });

    it('should return 404 for non-existent bot', async () => {
      mockBotManager.updateBot.mockRejectedValue(new Error('Bot not found: non-existent'));

      const response = await request(app)
        .put('/api/bot/non-existent')
        .send({ name: 'Updated' });

      expect(response.status).toBe(404);
    });
  });

  describe('DELETE /api/bot/:id', () => {
    it('should delete a bot', async () => {
      mockBotManager.deleteBot.mockResolvedValue(undefined);

      const response = await request(app).delete('/api/bot/bot-123');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should return 404 for non-existent bot', async () => {
      mockBotManager.deleteBot.mockRejectedValue(new Error('Bot not found: non-existent'));

      const response = await request(app).delete('/api/bot/non-existent');

      expect(response.status).toBe(404);
    });
  });

  describe('POST /api/bot/:id/start', () => {
    it('should start a bot', async () => {
      mockBotManager.startBot.mockResolvedValue(undefined);

      const response = await request(app).post('/api/bot/bot-123/start');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('started');
    });
  });

  describe('POST /api/bot/:id/stop', () => {
    it('should stop a bot', async () => {
      mockBotManager.stopBot.mockResolvedValue(undefined);

      const response = await request(app).post('/api/bot/bot-123/stop');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('stopped');
    });
  });

  describe('POST /api/bot/:id/pause', () => {
    it('should pause a bot', async () => {
      mockBotManager.pauseBot.mockResolvedValue(undefined);

      const response = await request(app).post('/api/bot/bot-123/pause');

      expect(response.status).toBe(200);
      expect(response.body.message).toContain('paused');
    });
  });

  describe('POST /api/bot/:id/resume', () => {
    it('should resume a bot', async () => {
      mockBotManager.resumeBot.mockResolvedValue(undefined);

      const response = await request(app).post('/api/bot/bot-123/resume');

      expect(response.status).toBe(200);
      expect(response.body.message).toContain('resumed');
    });
  });

  describe('GET /api/bot/running/list', () => {
    it('should return running bots', async () => {
      mockBotManager.getRunningBots.mockReturnValue(['bot-1', 'bot-2']);

      const response = await request(app).get('/api/bot/running/list');

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(2);
    });
  });

  describe('POST /api/bot/start-all', () => {
    it('should start all bots', async () => {
      mockBotManager.startAllBots.mockResolvedValue(undefined);

      const response = await request(app).post('/api/bot/start-all');

      expect(response.status).toBe(200);
      expect(response.body.message).toContain('All bots started');
    });
  });

  describe('POST /api/bot/stop-all', () => {
    it('should stop all bots', async () => {
      mockBotManager.stopAllBots.mockResolvedValue(undefined);

      const response = await request(app).post('/api/bot/stop-all');

      expect(response.status).toBe(200);
      expect(response.body.message).toContain('All bots stopped');
    });
  });
});
