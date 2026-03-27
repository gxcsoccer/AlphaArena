/**
 * Tests for Template Service
 */

import { TemplateService } from '../template.service';
import { CreateTemplateInput, PortfolioTemplate } from '../types';

// Mock Supabase client
jest.mock('../../database/client', () => ({
  getSupabaseClient: () => ({
    from: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue({ data: null, error: null }),
    rpc: jest.fn().mockResolvedValue({ error: null }),
  }),
}));

describe('TemplateService', () => {
  let service: TemplateService;

  // Define expected system templates locally for testing
  const EXPECTED_SYSTEM_TEMPLATES = [
    { id: 'template_conservative', riskLevel: 'low' },
    { id: 'template_balanced', riskLevel: 'medium' },
    { id: 'template_aggressive', riskLevel: 'high' },
    { id: 'template_ml_focused', riskLevel: 'medium' },
    { id: 'template_market_neutral', riskLevel: 'low' },
  ];

  beforeEach(() => {
    service = new TemplateService();
  });

  describe('getTemplates', () => {
    it('should return system templates', async () => {
      const templates = await service.getTemplates();

      expect(templates.length).toBeGreaterThan(0);
      expect(templates.some(t => t.createdBy === 'system')).toBe(true);
    });

    it('should filter by category', async () => {
      const templates = await service.getTemplates({ category: 'conservative' });

      expect(templates.every(t => t.category === 'conservative')).toBe(true);
    });

    it('should filter by risk level', async () => {
      const templates = await service.getTemplates({ riskLevel: 'low' });

      expect(templates.every(t => t.riskLevel === 'low')).toBe(true);
    });

    it('should apply limit', async () => {
      const templates = await service.getTemplates({ limit: 2 });

      expect(templates.length).toBeLessThanOrEqual(2);
    });

    it('should sort by rating', async () => {
      const templates = await service.getTemplates();

      for (let i = 0; i < templates.length - 1; i++) {
        expect(templates[i].rating).toBeGreaterThanOrEqual(templates[i + 1].rating);
      }
    });
  });

  describe('getTemplateById', () => {
    it('should return system template by ID', async () => {
      const template = await service.getTemplateById('template_conservative');

      expect(template).not.toBeNull();
      expect(template!.name).toBe('Conservative Portfolio');
    });

    it('should return null for non-existent template', async () => {
      const template = await service.getTemplateById('non-existent');

      expect(template).toBeNull();
    });
  });

  describe('createTemplate', () => {
    it('should create custom template', async () => {
      const input: CreateTemplateInput = {
        name: 'My Custom Template',
        description: 'A custom portfolio template',
        category: 'custom',
        riskLevel: 'medium',
        targetReturn: 15,
        allocations: [
          { strategyType: 'momentum', weight: 0.5 },
          { strategyType: 'mean_reversion', weight: 0.5 },
        ],
      };

      const template = await service.createTemplate('user-1', input);

      expect(template.name).toBe('My Custom Template');
      expect(template.createdBy).toBe('user-1');
      expect(template.isPublic).toBe(false);
      expect(template.allocations).toHaveLength(2);
    });

    it('should set default values', async () => {
      const input: CreateTemplateInput = {
        name: 'Test',
        description: 'Test',
        category: 'balanced',
        riskLevel: 'medium',
        allocations: [{ strategyType: 'test', weight: 1 }],
      };

      const template = await service.createTemplate('user-1', input);

      expect(template.rebalanceConfig).toBeDefined();
      expect(template.riskControlConfig).toBeDefined();
      expect(template.signalAggregationConfig).toBeDefined();
    });
  });

  describe('getRecommendedTemplates', () => {
    it('should return templates matching risk tolerance', async () => {
      const recommendations = await service.getRecommendedTemplates({
        riskTolerance: 'low',
      });

      expect(recommendations.every(t => t.riskLevel === 'low')).toBe(true);
    });

    it('should filter by target return', async () => {
      const recommendations = await service.getRecommendedTemplates({
        targetReturn: 10,
      });

      expect(
        recommendations.every(t => Math.abs(t.targetReturn - 10) <= 10)
      ).toBe(true);
    });

    it('should return top 3 recommendations', async () => {
      const recommendations = await service.getRecommendedTemplates({});

      expect(recommendations.length).toBeLessThanOrEqual(3);
    });
  });

  describe('system templates', () => {
    it('should have valid conservative template', async () => {
      const templates = await service.getTemplates();
      const template = templates.find(t => t.id === 'template_conservative');
      
      expect(template).toBeDefined();
      expect(template!.riskLevel).toBe('low');
      expect(template!.allocations.reduce((sum, a) => sum + a.weight, 0)).toBeCloseTo(1, 1);
    });

    it('should have valid aggressive template', async () => {
      const templates = await service.getTemplates();
      const template = templates.find(t => t.id === 'template_aggressive');
      
      expect(template).toBeDefined();
      expect(template!.riskLevel).toBe('high');
      expect(template!.allocations.reduce((sum, a) => sum + a.weight, 0)).toBeCloseTo(1, 1);
    });

    it('should have valid balanced template', async () => {
      const templates = await service.getTemplates();
      const template = templates.find(t => t.id === 'template_balanced');
      
      expect(template).toBeDefined();
      expect(template!.riskLevel).toBe('medium');
      expect(template!.allocations.reduce((sum, a) => sum + a.weight, 0)).toBeCloseTo(1, 1);
    });

    it('should have all required fields', async () => {
      const templates = await service.getTemplates();
      const systemTemplates = templates.filter(t => t.createdBy === 'system');
      
      for (const template of systemTemplates) {
        expect(template.id).toBeDefined();
        expect(template.name).toBeDefined();
        expect(template.description).toBeDefined();
        expect(template.category).toBeDefined();
        expect(template.riskLevel).toBeDefined();
        expect(template.targetReturn).toBeGreaterThan(0);
        expect(template.allocations.length).toBeGreaterThan(0);
        expect(template.rebalanceConfig).toBeDefined();
        expect(template.riskControlConfig).toBeDefined();
        expect(template.signalAggregationConfig).toBeDefined();
      }
    });
  });
});