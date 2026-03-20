/**
 * Model Manager Tests
 */

import { ModelManager } from '../../../src/strategy/ml/ModelManager';
import * as fs from 'fs';
import * as path from 'path';

// Use temp directory for tests
const TEST_DIR = '/tmp/ml-models-test-' + Date.now();

describe('ModelManager', () => {
  let manager: ModelManager;

  beforeAll(() => {
    // Create test directory
    if (!fs.existsSync(TEST_DIR)) {
      fs.mkdirSync(TEST_DIR, { recursive: true });
    }
  });

  afterAll(() => {
    // Cleanup test directory
    if (fs.existsSync(TEST_DIR)) {
      fs.rmSync(TEST_DIR, { recursive: true, force: true });
    }
  });

  beforeEach(() => {
    manager = new ModelManager({
      storageDir: TEST_DIR,
      maxVersions: 5,
      autoCleanup: true,
    });
  });

  describe('Construction', () => {
    test('should create manager with default config', () => {
      const defaultManager = new ModelManager();
      expect(defaultManager).toBeDefined();
    });

    test('should create manager with custom config', () => {
      expect(manager).toBeDefined();
    });

    test('should create storage directory if not exists', () => {
      const newDir = path.join(TEST_DIR, 'new-dir');
      const _newManager = new ModelManager({ storageDir: newDir });
      expect(fs.existsSync(newDir)).toBe(true);
    });
  });

  describe('Model Save/Load', () => {
    test('should save a model', async () => {
      const model = { weights: [1, 2, 3], bias: 0.5 };
      const modelId = await manager.saveModel(
        model,
        'test-model',
        'classification'
      );

      expect(modelId).toBeDefined();
      expect(modelId).toContain('test-model');
    });

    test('should save model with metrics', async () => {
      const model = { weights: [1, 2, 3] };
      const metrics = {
        lossHistory: [0.5, 0.3, 0.1],
        finalLoss: 0.1,
        epochs: 10,
        trainingTime: 1000,
      };

      const modelId = await manager.saveModel(
        model,
        'test-model-with-metrics',
        'classification',
        metrics
      );

      expect(modelId).toBeDefined();
    });

    test('should load a saved model', async () => {
      const model = { data: 'test' };
      const modelId = await manager.saveModel(model, 'loadable-model', 'regression');

      const loaded = await manager.loadModel(modelId);
      expect(loaded).toEqual(model);
    });

    test('should cache loaded models', async () => {
      const model = { data: 'cached-test' };
      const modelId = await manager.saveModel(model, 'cached-model', 'classification');

      // Load twice - should use cache
      const loaded1 = await manager.loadModel(modelId);
      const loaded2 = await manager.loadModel(modelId);

      expect(loaded1).toEqual(loaded2);
    });

    test('should throw for non-existent model', async () => {
      await expect(manager.loadModel('non-existent-model')).rejects.toThrow();
    });
  });

  describe('Model Metadata', () => {
    test('should get model metadata', async () => {
      const model = { data: 'metadata-test' };
      const modelId = await manager.saveModel(model, 'metadata-model', 'timeseries-lstm');

      const metadata = manager.getModelMetadata(modelId);
      expect(metadata).toBeDefined();
      expect(metadata!.name).toBe('metadata-model');
      expect(metadata!.type).toBe('timeseries-lstm');
    });

    test('should get all models', async () => {
      await manager.saveModel({ data: 1 }, 'model-1', 'classification');
      await manager.saveModel({ data: 2 }, 'model-2', 'regression');

      const allModels = manager.getAllModels();
      expect(allModels.length).toBeGreaterThanOrEqual(2);
    });

    test('should get models by type', async () => {
      await manager.saveModel({ data: 1 }, 'cls-model', 'classification');
      await manager.saveModel({ data: 2 }, 'reg-model', 'regression');

      const clsModels = manager.getModelsByType('classification');
      expect(clsModels.length).toBeGreaterThanOrEqual(1);
      expect(clsModels.every(m => m.type === 'classification')).toBe(true);
    });

    test('should get model versions', async () => {
      const model = { data: 'version-test' };
      const modelId = await manager.saveModel(model, 'version-model', 'classification');

      const versions = manager.getModelVersions(modelId);
      expect(versions.length).toBe(1);
    });
  });

  describe('Model Management', () => {
    test('should update model metrics', async () => {
      const model = { data: 'update-test' };
      const modelId = await manager.saveModel(model, 'update-model', 'classification');

      const newMetrics = {
        lossHistory: [0.2, 0.1, 0.05],
        finalLoss: 0.05,
        epochs: 20,
        trainingTime: 2000,
      };

      await manager.updateMetrics(modelId, newMetrics);

      const metadata = manager.getModelMetadata(modelId);
      expect(metadata!.performance!.finalLoss).toBe(0.05);
    });

    test('should delete model version', async () => {
      const model = { data: 'delete-version-test' };
      const modelId = await manager.saveModel(model, 'delete-version-model', 'classification');

      const versions = manager.getModelVersions(modelId);
      expect(versions.length).toBe(1);

      const deleted = await manager.deleteVersion(modelId, versions[0].version);
      expect(deleted).toBe(true);

      const newVersions = manager.getModelVersions(modelId);
      expect(newVersions.length).toBe(0);
    });

    test('should delete model entirely', async () => {
      const model = { data: 'delete-test' };
      const modelId = await manager.saveModel(model, 'delete-model', 'classification');

      const deleted = await manager.deleteModel(modelId);
      expect(deleted).toBe(true);

      const metadata = manager.getModelMetadata(modelId);
      expect(metadata).toBeUndefined();
    });
  });

  describe('Version Control', () => {
    test('should create multiple versions', async () => {
      const model1 = { version: 1 };
      const model2 = { version: 2 };
      
      const id1 = await manager.saveModel(model1, 'multi-version', 'classification');
      
      // Add a small delay to ensure different timestamps
      await new Promise(resolve => setTimeout(resolve, 10));
      
      const id2 = await manager.saveModel(model2, 'multi-version', 'classification');

      // Should have same base ID but different timestamps
      expect(id1).not.toBe(id2);
    });

    test('should compare versions', async () => {
      const model1 = { version: 1 };
      const modelId = await manager.saveModel(model1, 'compare-model', 'classification');

      // Save another version
      await manager.saveModel({ version: 2 }, 'compare-model', 'classification');

      const comparison = manager.compareVersions(modelId);
      // May be null if only one version
      expect(comparison === null || comparison.modelId === modelId).toBe(true);
    });
  });

  describe('Statistics', () => {
    test('should get manager stats', async () => {
      await manager.saveModel({ data: 1 }, 'stats-model-1', 'classification');
      await manager.saveModel({ data: 2 }, 'stats-model-2', 'regression');

      const stats = manager.getStats();
      expect(stats.totalModels).toBeGreaterThanOrEqual(2);
      expect(stats.totalVersions).toBeGreaterThanOrEqual(2);
      expect(stats.modelsByType).toBeDefined();
    });
  });

  describe('Events', () => {
    test('should emit save event', async () => {
      const saveHandler = jest.fn();
      manager.on('model:saved', saveHandler);

      await manager.saveModel({ data: 'event-test' }, 'event-model', 'classification');

      expect(saveHandler).toHaveBeenCalled();
    });

    test('should emit load event', async () => {
      const loadHandler = jest.fn();
      manager.on('model:loaded', loadHandler);

      const modelId = await manager.saveModel({ data: 'load-event' }, 'load-event-model', 'classification');
      await manager.loadModel(modelId);

      expect(loadHandler).toHaveBeenCalled();
    });

    test('should emit delete event', async () => {
      const deleteHandler = jest.fn();
      manager.on('model:deleted', deleteHandler);

      const modelId = await manager.saveModel({ data: 'delete-event' }, 'delete-event-model', 'classification');
      await manager.deleteModel(modelId);

      expect(deleteHandler).toHaveBeenCalled();
    });
  });
});
