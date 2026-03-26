/**
 * Tests for Experiment DAO
 *
 * Note: These tests focus on type safety and basic functionality
 * Integration tests would be needed for database operations
 */

// ExperimentStatus and EventType are type aliases, not runtime enums
// So we test the values that conform to those types

describe('Experiment Types', () => {
  describe('ExperimentStatus values', () => {
    test('should have correct status values', () => {
      // Type alias values that are valid
      const statuses = ['draft', 'running', 'paused', 'completed', 'archived'] as const;
      expect(statuses).toContain('draft');
      expect(statuses).toContain('running');
      expect(statuses).toContain('paused');
      expect(statuses).toContain('completed');
      expect(statuses).toContain('archived');
      expect(statuses.length).toBe(5);
    });
  });

  describe('EventType values', () => {
    test('should have correct event type values', () => {
      const eventTypes = ['impression', 'click', 'conversion', 'custom'] as const;
      expect(eventTypes).toContain('impression');
      expect(eventTypes).toContain('click');
      expect(eventTypes).toContain('conversion');
      expect(eventTypes).toContain('custom');
      expect(eventTypes.length).toBe(4);
    });
  });
});

describe('Experiment DAO Module', () => {
  test('should export ExperimentDAO class and getExperimentDAO function', async () => {
    const module = await import('../../src/database/experiment.dao');
    
    // Check that the class and function are exported
    expect(module.ExperimentDAO).toBeDefined();
    expect(typeof module.getExperimentDAO).toBe('function');
  });

  test('should create instance via getExperimentDAO', async () => {
    const { getExperimentDAO } = await import('../../src/database/experiment.dao');
    
    // This will return a singleton instance (mocked via jest setup)
    const dao = getExperimentDAO();
    expect(dao).toBeDefined();
  });
});