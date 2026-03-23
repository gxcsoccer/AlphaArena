/**
 * Tests for Experiment DAO
 *
 * Note: These tests focus on type safety and basic functionality
 * Integration tests would be needed for database operations
 */

import { ExperimentStatus, EventType } from '../../src/database/experiment.dao';

describe('Experiment Types and Enums', () => {
  describe('ExperimentStatus', () => {
    test('should have correct status enum values', () => {
      expect(ExperimentStatus.DRAFT).toBe('draft');
      expect(ExperimentStatus.RUNNING).toBe('running');
      expect(ExperimentStatus.PAUSED).toBe('paused');
      expect(ExperimentStatus.COMPLETED).toBe('completed');
      expect(ExperimentStatus.ARCHIVED).toBe('archived');
    });

    test('should have all required status values', () => {
      const statuses = Object.values(ExperimentStatus);
      expect(statuses).toContain('draft');
      expect(statuses).toContain('running');
      expect(statuses).toContain('paused');
      expect(statuses).toContain('completed');
      expect(statuses).toContain('archived');
      expect(statuses.length).toBe(5);
    });
  });

  describe('EventType', () => {
    test('should have correct event type enum values', () => {
      expect(EventType.IMPRESSION).toBe('impression');
      expect(EventType.CLICK).toBe('click');
      expect(EventType.CONVERSION).toBe('conversion');
      expect(EventType.CUSTOM).toBe('custom');
    });

    test('should have all required event type values', () => {
      const eventTypes = Object.values(EventType);
      expect(eventTypes).toContain('impression');
      expect(eventTypes).toContain('click');
      expect(eventTypes).toContain('conversion');
      expect(eventTypes).toContain('custom');
      expect(eventTypes.length).toBe(4);
    });
  });
});

describe('Experiment DAO Module', () => {
  test('should export experimentDAO instance', async () => {
    // Dynamic import to avoid mock issues
    const { experimentDAO: dao } = await import('../../src/database/experiment.dao');
    expect(dao).toBeDefined();
    expect(typeof dao.createExperiment).toBe('function');
    expect(typeof dao.getExperimentById).toBe('function');
    expect(typeof dao.getExperiments).toBe('function');
    expect(typeof dao.updateExperiment).toBe('function');
    expect(typeof dao.deleteExperiment).toBe('function');
    expect(typeof dao.createVariant).toBe('function');
    expect(typeof dao.getVariantsByExperimentId).toBe('function');
    expect(typeof dao.updateVariant).toBe('function');
    expect(typeof dao.deleteVariant).toBe('function');
    expect(typeof dao.assignVariant).toBe('function');
    expect(typeof dao.trackEvent).toBe('function');
    expect(typeof dao.getExperimentResults).toBe('function');
    expect(typeof dao.calculateStatistics).toBe('function');
    expect(typeof dao.getStatistics).toBe('function');
  });

  test('should export all required types', async () => {
    const module = await import('../../src/database/experiment.dao');
    
    // Check that all type exports exist (they're compile-time only, but we can check the module structure)
    expect(module).toBeDefined();
  });
});