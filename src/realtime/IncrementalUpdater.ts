/**
 * Incremental Updater
 */

import { EventEmitter } from 'events';

export interface DeltaUpdate {
  type: 'add' | 'update' | 'remove';
  key: string;
  value?: any;
  oldValue?: any;
}

export interface Snapshot {
  data: Map<string, any>;
  version: number;
  timestamp: number;
}

export interface IncrementalConfig {
  maxHistorySize: number;
  snapshotInterval: number;
  compressionThreshold: number;
}

interface UpdateHistory {
  version: number;
  delta: DeltaUpdate[];
  timestamp: number;
}

const DEFAULT_CONFIG: IncrementalConfig = {
  maxHistorySize: 100,
  snapshotInterval: 1000,
  compressionThreshold: 0.5,
};

export class IncrementalUpdater extends EventEmitter {
  private config: IncrementalConfig;
  private currentData: Map<string, any> = new Map();
  private version: number = 0;
  private lastSnapshot: Snapshot | null = null;
  private history: UpdateHistory[] = [];
  private updateCount: number = 0;

  constructor(config: Partial<IncrementalConfig> = {}) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  public applySnapshot(snapshot: { data: Record<string, any>; version: number; timestamp: number }): void {
    this.currentData = new Map(Object.entries(snapshot.data));
    this.version = snapshot.version;
    this.lastSnapshot = { data: new Map(this.currentData), version: this.version, timestamp: snapshot.timestamp };
    this.updateCount = 0;
    this.history = [];
    this.emit('snapshot:applied', { version: this.version, size: this.currentData.size });
  }

  public applyDelta(delta: DeltaUpdate[]): void {
    const changes: DeltaUpdate[] = [];
    for (const update of delta) {
      const oldValue = this.currentData.get(update.key);
      switch (update.type) {
        case 'add':
        case 'update':
          this.currentData.set(update.key, update.value);
          changes.push({ ...update, oldValue });
          break;
        case 'remove':
          if (oldValue !== undefined) {
            this.currentData.delete(update.key);
            changes.push({ ...update, oldValue });
          }
          break;
      }
    }
    this.version++;
    this.updateCount++;
    this.history.push({ version: this.version, delta: changes, timestamp: Date.now() });
    if (this.history.length > this.config.maxHistorySize) {
      this.history = this.history.slice(-this.config.maxHistorySize);
    }
    this.emit('delta:applied', { version: this.version, changes: changes.length });
    if (this.updateCount >= this.config.snapshotInterval) {
      this.createSnapshot();
    }
  }

  public set(key: string, value: any): DeltaUpdate {
    const oldValue = this.currentData.get(key);
    const isAdd = !this.currentData.has(key);
    this.currentData.set(key, value);
    this.version++;
    this.updateCount++;
    const delta: DeltaUpdate = { type: isAdd ? 'add' : 'update', key, value, oldValue };
    this.recordHistory([delta]);
    return delta;
  }

  public delete(key: string): DeltaUpdate | null {
    if (!this.currentData.has(key)) return null;
    const oldValue = this.currentData.get(key);
    this.currentData.delete(key);
    this.version++;
    this.updateCount++;
    const delta: DeltaUpdate = { type: 'remove', key, oldValue };
    this.recordHistory([delta]);
    return delta;
  }

  public get(key: string): any | undefined { return this.currentData.get(key); }
  public getAll(): Record<string, any> { return Object.fromEntries(this.currentData); }
  public getVersion(): number { return this.version; }

  public computeDelta(fromVersion: number): DeltaUpdate[] | null {
    if (fromVersion >= this.version) return [];
    const relevantHistory = this.history.filter(h => h.version > fromVersion);
    if (relevantHistory.length === 0) return null;
    const mergedDeltas: Map<string, DeltaUpdate> = new Map();
    for (const historyEntry of relevantHistory) {
      for (const delta of historyEntry.delta) {
        if (delta.type === 'remove') {
          if (mergedDeltas.has(delta.key)) {
            const existing = mergedDeltas.get(delta.key)!;
            if (existing.type === 'add') {
              mergedDeltas.delete(delta.key);
            } else {
              mergedDeltas.set(delta.key, delta);
            }
          } else {
            mergedDeltas.set(delta.key, delta);
          }
        } else {
          mergedDeltas.set(delta.key, delta);
        }
      }
    }
    return Array.from(mergedDeltas.values());
  }

  public getSnapshot(): Snapshot {
    return { data: new Map(this.currentData), version: this.version, timestamp: Date.now() };
  }

  public createSnapshot(): Snapshot {
    this.lastSnapshot = { data: new Map(this.currentData), version: this.version, timestamp: Date.now() };
    this.updateCount = 0;
    this.emit('snapshot:created', { version: this.version, size: this.currentData.size });
    return this.lastSnapshot;
  }

  public getLastSnapshot(): Snapshot | null { return this.lastSnapshot; }

  public static computeDiff(oldData: Map<string, any>, newData: Map<string, any>): DeltaUpdate[] {
    const delta: DeltaUpdate[] = [];
    for (const [key, value] of newData) {
      if (!oldData.has(key)) {
        delta.push({ type: 'add', key, value });
      } else {
        const oldValue = oldData.get(key);
        if (!this.deepEqual(oldValue, value)) {
          delta.push({ type: 'update', key, value, oldValue });
        }
      }
    }
    for (const [key, value] of oldData) {
      if (!newData.has(key)) {
        delta.push({ type: 'remove', key, oldValue: value });
      }
    }
    return delta;
  }

  private recordHistory(delta: DeltaUpdate[]): void {
    this.history.push({ version: this.version, delta, timestamp: Date.now() });
    if (this.history.length > this.config.maxHistorySize) {
      this.history = this.history.slice(-this.config.maxHistorySize);
    }
  }

  private static deepEqual(a: any, b: any): boolean {
    if (a === b) return true;
    if (typeof a !== typeof b) return false;
    if (typeof a !== 'object' || a === null || b === null) return false;
    const keysA = Object.keys(a);
    const keysB = Object.keys(b);
    if (keysA.length !== keysB.length) return false;
    for (const key of keysA) {
      if (!keysB.includes(key) || !this.deepEqual(a[key], b[key])) return false;
    }
    return true;
  }

  public size(): number { return this.currentData.size; }

  public clear(): void {
    this.currentData.clear();
    this.version = 0;
    this.lastSnapshot = null;
    this.history = [];
    this.updateCount = 0;
  }
}

export default IncrementalUpdater;