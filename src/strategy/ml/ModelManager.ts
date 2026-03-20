/**
 * Model Manager
 *
 * Manages ML model lifecycle: save, load, version, and monitor
 */

import * as fs from 'fs';
import * as path from 'path';
import { EventEmitter } from 'events';
import {
  MLModelType,
  ModelMetadata,
  TrainingMetrics,
  TrainingData,
} from './MLTypes';

/**
 * Model Manager configuration
 */
export interface ModelManagerConfig {
  /** Base directory for model storage */
  storageDir: string;
  /** Maximum number of versions to keep per model */
  maxVersions: number;
  /** Enable auto-cleanup of old versions */
  autoCleanup: boolean;
  /** Model file extension */
  fileExtension: string;
}

/**
 * Model version info
 */
export interface ModelVersion {
  /** Version string */
  version: string;
  /** Creation timestamp */
  createdAt: number;
  /** Model metrics */
  metrics?: TrainingMetrics;
  /** File path */
  filePath: string;
  /** File size in bytes */
  size: number;
  /** Checksum */
  checksum: string;
}

/**
 * Model Manager - 模型管理器
 *
 * Provides comprehensive model lifecycle management including:
 * - Model storage (save/load)
 * - Version control
 * - Performance tracking
 * - Cleanup of old versions
 */
export class ModelManager extends EventEmitter {
  private config: ModelManagerConfig;
  private models: Map<string, ModelMetadata> = new Map();
  private versions: Map<string, ModelVersion[]> = new Map();
  private loadedModels: Map<string, any> = new Map();

  constructor(config?: Partial<ModelManagerConfig>) {
    super();
    
    this.config = {
      storageDir: config?.storageDir || './models',
      maxVersions: config?.maxVersions || 10,
      autoCleanup: config?.autoCleanup ?? true,
      fileExtension: config?.fileExtension || '.model.json',
    };

    // Ensure storage directory exists
    this.ensureStorageDir();
    
    // Load existing models metadata
    this.loadModelsIndex();
  }

  /**
   * Save a model
   */
  async saveModel(
    model: any,
    name: string,
    type: MLModelType,
    metrics?: TrainingMetrics,
    trainingData?: Partial<TrainingData>
  ): Promise<string> {
    const modelId = this.generateModelId(name);
    const version = this.generateVersion();
    const timestamp = Date.now();

    // Create model metadata
    const metadata: ModelMetadata = {
      id: modelId,
      name,
      type,
      version,
      createdAt: timestamp,
      updatedAt: timestamp,
      trainingData: trainingData ? {
        samples: trainingData.X?.length || 0,
        features: trainingData.featureNames || [],
      } : undefined,
      performance: metrics,
      filePath: this.getModelPath(modelId, version),
      checksum: '',
    };

    // Serialize model
    const modelData = this.serializeModel(model);
    metadata.checksum = this.calculateChecksum(modelData);

    // Save model file
    await this.saveModelFile(metadata.filePath, modelData);

    // Update index
    this.models.set(modelId, metadata);
    
    // Add version
    const versionInfo: ModelVersion = {
      version,
      createdAt: timestamp,
      metrics,
      filePath: metadata.filePath,
      size: Buffer.byteLength(modelData, 'utf-8'),
      checksum: metadata.checksum,
    };
    
    if (!this.versions.has(modelId)) {
      this.versions.set(modelId, []);
    }
    this.versions.get(modelId)!.push(versionInfo);

    // Cleanup old versions if enabled
    if (this.config.autoCleanup) {
      await this.cleanupOldVersions(modelId);
    }

    // Save index
    await this.saveModelsIndex();

    this.emit('model:saved', { modelId, version, metrics });
    
    return modelId;
  }

  /**
   * Load a model
   */
  async loadModel(modelId: string, version?: string): Promise<any> {
    // Check if already loaded
    const cacheKey = version ? `${modelId}:${version}` : modelId;
    if (this.loadedModels.has(cacheKey)) {
      return this.loadedModels.get(cacheKey);
    }

    // Get metadata
    const metadata = this.models.get(modelId);
    if (!metadata) {
      throw new Error(`Model not found: ${modelId}`);
    }

    // Determine which version to load
    const targetVersion = version || metadata.version;
    const versionInfo = this.versions.get(modelId)?.find(v => v.version === targetVersion);
    
    if (!versionInfo) {
      throw new Error(`Version not found: ${modelId}@${targetVersion}`);
    }

    // Load model file
    const modelData = await this.loadModelFile(versionInfo.filePath);
    
    // Verify checksum
    const checksum = this.calculateChecksum(modelData);
    if (checksum !== versionInfo.checksum) {
      throw new Error(`Model checksum mismatch: ${modelId}@${targetVersion}`);
    }

    // Deserialize model
    const model = this.deserializeModel(modelData, metadata.type);

    // Cache loaded model
    this.loadedModels.set(cacheKey, model);

    this.emit('model:loaded', { modelId, version: targetVersion });
    
    return model;
  }

  /**
   * Get model metadata
   */
  getModelMetadata(modelId: string): ModelMetadata | undefined {
    return this.models.get(modelId);
  }

  /**
   * Get all models
   */
  getAllModels(): ModelMetadata[] {
    return Array.from(this.models.values());
  }

  /**
   * Get models by type
   */
  getModelsByType(type: MLModelType): ModelMetadata[] {
    return this.getAllModels().filter(m => m.type === type);
  }

  /**
   * Get model versions
   */
  getModelVersions(modelId: string): ModelVersion[] {
    return this.versions.get(modelId) || [];
  }

  /**
   * Delete a model version
   */
  async deleteVersion(modelId: string, version: string): Promise<boolean> {
    const versions = this.versions.get(modelId);
    if (!versions) return false;

    const index = versions.findIndex(v => v.version === version);
    if (index === -1) return false;

    const versionInfo = versions[index];
    
    // Delete file
    try {
      await fs.promises.unlink(versionInfo.filePath);
    } catch (_error) {
      // File might not exist
    }

    // Remove from list
    versions.splice(index, 1);

    // Update current version if needed
    const metadata = this.models.get(modelId);
    if (metadata && metadata.version === version && versions.length > 0) {
      metadata.version = versions[versions.length - 1].version;
      metadata.updatedAt = Date.now();
    }

    await this.saveModelsIndex();
    
    this.emit('version:deleted', { modelId, version });
    
    return true;
  }

  /**
   * Delete a model entirely
   */
  async deleteModel(modelId: string): Promise<boolean> {
    const metadata = this.models.get(modelId);
    if (!metadata) return false;

    // Delete all versions
    const versions = this.versions.get(modelId) || [];
    for (const version of versions) {
      try {
        await fs.promises.unlink(version.filePath);
      } catch (_error) {
        // Ignore errors
      }
    }

    // Remove from memory
    this.models.delete(modelId);
    this.versions.delete(modelId);
    this.loadedModels.delete(modelId);

    await this.saveModelsIndex();
    
    this.emit('model:deleted', { modelId });
    
    return true;
  }

  /**
   * Update model metrics
   */
  async updateMetrics(modelId: string, metrics: TrainingMetrics): Promise<void> {
    const metadata = this.models.get(modelId);
    if (!metadata) {
      throw new Error(`Model not found: ${modelId}`);
    }

    metadata.performance = metrics;
    metadata.updatedAt = Date.now();

    // Update version metrics
    const versions = this.versions.get(modelId);
    if (versions && versions.length > 0) {
      versions[versions.length - 1].metrics = metrics;
    }

    await this.saveModelsIndex();
    
    this.emit('metrics:updated', { modelId, metrics });
  }

  /**
   * Compare model versions
   */
  compareVersions(modelId: string): ModelComparison | null {
    const versions = this.versions.get(modelId);
    if (!versions || versions.length < 2) return null;

    const current = versions[versions.length - 1];
    const previous = versions[versions.length - 2];

    return {
      modelId,
      currentVersion: current.version,
      previousVersion: previous.version,
      metricsDiff: this.diffMetrics(current.metrics, previous.metrics),
    };
  }

  /**
   * Get model statistics
   */
  getStats(): ModelManagerStats {
    let totalSize = 0;
    const typeCounts: Record<MLModelType, number> = {
      'timeseries-lstm': 0,
      'timeseries-transformer': 0,
      'classification': 0,
      'anomaly-detection': 0,
      'reinforcement-learning': 0,
      'regression': 0,
    };

    for (const [modelId, metadata] of this.models) {
      const versions = this.versions.get(modelId) || [];
      for (const version of versions) {
        totalSize += version.size;
      }
      typeCounts[metadata.type]++;
    }

    return {
      totalModels: this.models.size,
      totalVersions: Array.from(this.versions.values()).reduce((sum, v) => sum + v.length, 0),
      totalSizeBytes: totalSize,
      loadedModels: this.loadedModels.size,
      modelsByType: typeCounts,
    };
  }

  // ==================== Private Methods ====================

  private ensureStorageDir(): void {
    if (!fs.existsSync(this.config.storageDir)) {
      fs.mkdirSync(this.config.storageDir, { recursive: true });
    }
  }

  private loadModelsIndex(): void {
    const indexPath = path.join(this.config.storageDir, 'index.json');
    
    if (!fs.existsSync(indexPath)) {
      return;
    }

    try {
      const data = fs.readFileSync(indexPath, 'utf-8');
      const index = JSON.parse(data);
      
      if (index.models) {
        for (const [id, metadata] of Object.entries(index.models)) {
          this.models.set(id, metadata as ModelMetadata);
        }
      }
      
      if (index.versions) {
        for (const [id, versions] of Object.entries(index.versions)) {
          this.versions.set(id, versions as ModelVersion[]);
        }
      }
    } catch (error) {
      console.error('Failed to load models index:', error);
    }
  }

  private async saveModelsIndex(): Promise<void> {
    const indexPath = path.join(this.config.storageDir, 'index.json');
    
    const index = {
      models: Object.fromEntries(this.models),
      versions: Object.fromEntries(this.versions),
      updatedAt: Date.now(),
    };

    await fs.promises.writeFile(indexPath, JSON.stringify(index, null, 2));
  }

  private generateModelId(name: string): string {
    const sanitized = name.toLowerCase().replace(/[^a-z0-9]/g, '-');
    return `${sanitized}-${Date.now()}`;
  }

  private generateVersion(): string {
    const date = new Date();
    return `${date.getFullYear()}.${date.getMonth() + 1}.${date.getDate()}-${date.getHours()}${date.getMinutes().toString().padStart(2, '0')}`;
  }

  private getModelPath(modelId: string, version: string): string {
    const modelDir = path.join(this.config.storageDir, modelId);
    if (!fs.existsSync(modelDir)) {
      fs.mkdirSync(modelDir, { recursive: true });
    }
    return path.join(modelDir, `${version}${this.config.fileExtension}`);
  }

  private serializeModel(model: any): string {
    // Simple JSON serialization
    // In production, would use model-specific serialization
    return JSON.stringify({
      data: model,
      serializedAt: Date.now(),
    });
  }

  private deserializeModel(data: string, _type: MLModelType): any {
    const parsed = JSON.parse(data);
    return parsed.data;
  }

  private async saveModelFile(filePath: string, data: string): Promise<void> {
    await fs.promises.writeFile(filePath, data, 'utf-8');
  }

  private async loadModelFile(filePath: string): Promise<string> {
    return fs.promises.readFile(filePath, 'utf-8');
  }

  private calculateChecksum(data: string): string {
    // Simple hash for checksum
    // In production, would use crypto.createHash('sha256')
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16);
  }

  private async cleanupOldVersions(modelId: string): Promise<void> {
    const versions = this.versions.get(modelId);
    if (!versions || versions.length <= this.config.maxVersions) {
      return;
    }

    // Keep the most recent versions
    const toDelete = versions.slice(0, versions.length - this.config.maxVersions);
    
    for (const version of toDelete) {
      try {
        await fs.promises.unlink(version.filePath);
      } catch (_error) {
        // Ignore errors
      }
    }

    this.versions.set(modelId, versions.slice(-this.config.maxVersions));
    
    this.emit('cleanup', { modelId, deletedCount: toDelete.length });
  }

  private diffMetrics(
    current?: TrainingMetrics,
    previous?: TrainingMetrics
  ): Record<string, number> | null {
    if (!current || !previous) return null;

    const diff: Record<string, number> = {};

    if (current.finalLoss !== undefined && previous.finalLoss !== undefined) {
      diff.lossChange = current.finalLoss - previous.finalLoss;
    }

    if (current.accuracy !== undefined && previous.accuracy !== undefined) {
      diff.accuracyChange = current.accuracy - previous.accuracy;
    }

    if (current.rmse !== undefined && previous.rmse !== undefined) {
      diff.rmseChange = current.rmse - previous.rmse;
    }

    return diff;
  }
}

/**
 * Model comparison result
 */
export interface ModelComparison {
  modelId: string;
  currentVersion: string;
  previousVersion: string;
  metricsDiff: Record<string, number> | null;
}

/**
 * Model manager statistics
 */
export interface ModelManagerStats {
  totalModels: number;
  totalVersions: number;
  totalSizeBytes: number;
  loadedModels: number;
  modelsByType: Record<MLModelType, number>;
}
