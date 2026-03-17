import { createTemplateRouter } from '../templateRoutes';
import { StrategyTemplatesDAO, StrategyTemplate } from '../../database/strategyTemplates.dao';
import express from 'express';
import request from 'supertest';

// Mock the DAO
jest.mock('../../database/strategyTemplates.dao');
jest.mock('../../database/strategies.dao');
jest.mock('../../utils/logger', () => ({
  createLogger: () => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  }),
}));

describe('Template Routes', () => {
  let app: express.Application;
  let mockTemplatesDAO: jest.Mocked<StrategyTemplatesDAO>;

  beforeEach(() => {
    // Reset all mocks
    jest.resetAllMocks();
    
    // Create mock DAO instance before router is created
    mockTemplatesDAO = {
      getTemplates: jest.fn(),
      getById: jest.fn(),
      getFeatured: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      rateTemplate: jest.fn(),
      getUserRating: jest.fn(),
      recordUsage: jest.fn(),
    } as unknown as jest.Mocked<StrategyTemplatesDAO>;
    
    // Mock the DAO constructor to return our mock instance
    (StrategyTemplatesDAO as jest.Mock).mockImplementation(() => mockTemplatesDAO);
    
    // Now create the app and router (DAO will be created with our mock)
    app = express();
    app.use(express.json());
    app.use('/api/templates', createTemplateRouter());
  });

  describe('GET /api/templates', () => {
    it('should return a list of templates', async () => {
      const mockTemplates: StrategyTemplate[] = [
        {
          id: 'template-1',
          name: 'RSI Strategy',
          description: 'RSI-based trading strategy',
          authorUserId: 'system',
          authorName: 'System',
          strategyType: 'rsi',
          category: 'mean_reversion',
          symbol: 'BTC-USDT',
          config: { rsi_period: 14 },
          riskParams: {},
          tags: ['rsi', 'mean-reversion'],
          isPublic: true,
          isFeatured: true,
          isBuiltin: true,
          performanceMetrics: {},
          backtestPeriod: '1_year',
          useCount: 100,
          ratingAvg: 4.5,
          ratingCount: 20,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      mockTemplatesDAO.getTemplates.mockResolvedValue({
        templates: mockTemplates,
        total: 1,
      });

      const response = await request(app)
        .get('/api/templates')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.total).toBe(1);
    });

    it('should apply filters correctly', async () => {
      mockTemplatesDAO.getTemplates.mockResolvedValue({
        templates: [],
        total: 0,
      });

      await request(app)
        .get('/api/templates')
        .query({ strategyType: 'rsi', category: 'mean_reversion', limit: 10, offset: 0 })
        .expect(200);

      expect(mockTemplatesDAO.getTemplates).toHaveBeenCalledWith(
        expect.objectContaining({
          strategyType: 'rsi',
          category: 'mean_reversion',
          limit: 10,
          offset: 0,
        })
      );
    });
  });

  describe('GET /api/templates/featured', () => {
    it('should return featured templates', async () => {
      const mockTemplates = [
        {
          id: 'template-1',
          name: 'Featured Template',
          description: 'Featured template',
          authorUserId: 'system',
          authorName: 'System',
          strategyType: 'rsi',
          category: 'mean_reversion',
          symbol: 'BTC-USDT',
          config: {},
          riskParams: {},
          tags: [],
          isPublic: true,
          isFeatured: true,
          isBuiltin: true,
          performanceMetrics: {},
          backtestPeriod: null,
          useCount: 50,
          ratingAvg: 4.0,
          ratingCount: 10,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      mockTemplatesDAO.getFeatured.mockResolvedValue(mockTemplates as any);

      const response = await request(app)
        .get('/api/templates/featured')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(1);
    });
  });

  describe('GET /api/templates/:id', () => {
    it('should return a template by ID', async () => {
      const mockTemplate = {
        id: 'template-1',
        name: 'RSI Strategy',
        description: 'RSI-based trading strategy',
        authorUserId: 'system',
        authorName: 'System',
        strategyType: 'rsi',
        category: 'mean_reversion',
        symbol: 'BTC-USDT',
        config: { rsi_period: 14 },
        riskParams: {},
        tags: ['rsi', 'mean-reversion'],
        isPublic: true,
        isFeatured: true,
        isBuiltin: true,
        performanceMetrics: {},
        backtestPeriod: '1_year',
        useCount: 100,
        ratingAvg: 4.5,
        ratingCount: 20,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockTemplatesDAO.getById.mockResolvedValue(mockTemplate);
      mockTemplatesDAO.getUserRating.mockResolvedValue(null);

      const response = await request(app)
        .get('/api/templates/template-1')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe('template-1');
    });

    it('should return 404 if template not found', async () => {
      mockTemplatesDAO.getById.mockResolvedValue(null);

      const response = await request(app)
        .get('/api/templates/non-existent')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Template not found');
    });
  });

  describe('POST /api/templates', () => {
    it('should create a new template', async () => {
      const mockTemplate = {
        id: 'template-new',
        name: 'New Strategy',
        description: 'A new MACD strategy',
        authorUserId: 'user-1',
        authorName: 'Test User',
        strategyType: 'macd',
        config: { fast_period: 12, slow_period: 26 },
        category: 'momentum',
        symbol: 'BTC-USDT',
        riskParams: {},
        tags: [],
        isPublic: true,
        isFeatured: false,
        isBuiltin: false,
        performanceMetrics: {},
        backtestPeriod: null,
        useCount: 0,
        ratingAvg: 0,
        ratingCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockTemplatesDAO.create.mockResolvedValue(mockTemplate);

      const response = await request(app)
        .post('/api/templates')
        .send({
          name: 'New Strategy',
          strategyType: 'macd',
          config: { fast_period: 12, slow_period: 26 },
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe('New Strategy');
    });

    it('should return 400 if required fields are missing', async () => {
      const response = await request(app)
        .post('/api/templates')
        .send({ name: 'Test' })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('required');
    });
  });

  describe('POST /api/templates/:id/rate', () => {
    it('should rate a template', async () => {
      const mockTemplate = {
        id: 'template-1',
        name: 'RSI Strategy',
        description: 'RSI-based trading strategy',
        authorUserId: 'system',
        authorName: 'System',
        strategyType: 'rsi',
        category: 'mean_reversion',
        symbol: 'BTC-USDT',
        config: {},
        riskParams: {},
        tags: [],
        isPublic: true,
        isFeatured: true,
        isBuiltin: true,
        performanceMetrics: {},
        backtestPeriod: null,
        useCount: 100,
        ratingAvg: 4.5,
        ratingCount: 20,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockRating = {
        id: 'rating-1',
        templateId: 'template-1',
        userId: 'user-1',
        rating: 5,
        comment: 'Great strategy!',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockTemplatesDAO.getById.mockResolvedValue(mockTemplate);
      mockTemplatesDAO.rateTemplate.mockResolvedValue(mockRating);

      const response = await request(app)
        .post('/api/templates/template-1/rate')
        .send({
          userId: 'user-1',
          rating: 5,
          comment: 'Great strategy!',
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.rating).toBe(5);
    });

    it('should reject invalid rating values', async () => {
      const response = await request(app)
        .post('/api/templates/template-1/rate')
        .send({
          userId: 'user-1',
          rating: 6, // Invalid rating (must be 1-5)
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('must be between 1 and 5');
    });
  });
});
