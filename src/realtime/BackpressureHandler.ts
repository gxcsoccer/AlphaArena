/**
 * Backpressure Handler
 */

import { EventEmitter } from 'events';

export type OverflowStrategy = 'drop-oldest' | 'drop-newest' | 'block' | 'fail';

export interface BackpressureConfig {
  maxBufferSize: number;
  maxMemoryBytes: number;
  highWaterMark: number;
  lowWaterMark: number;
  overflowStrategy: OverflowStrategy;
  sampleInterval: number;
  cooldownPeriod: number;
}

export interface BackpressureState {
  status: 'normal' | 'warning' | 'critical' | 'blocked';
  bufferUsage: number;
  memoryUsage: number;
  messagesDropped: number;
  messagesProcessed: number;
  avgProcessingTime: number;
  throughput: number;
}

export interface BackpressureStats {
  totalMessages: number;
  processedMessages: number;
  droppedMessages: number;
  blockedMessages: number;
  avgQueueTime: number;
  peakBufferSize: number;
  backpressureEvents: number;
  currentThroughput: number;
}

interface QueuedMessage {
  data: any;
  timestamp: number;
  priority: number;
}

const DEFAULT_CONFIG: BackpressureConfig = {
  maxBufferSize: 10000,
  maxMemoryBytes: 50 * 1024 * 1024,
  highWaterMark: 0.8,
  lowWaterMark: 0.5,
  overflowStrategy: 'drop-oldest',
  sampleInterval: 100,
  cooldownPeriod: 1000,
};

export class BackpressureHandler extends EventEmitter {
  private config: BackpressureConfig;
  private buffer: QueuedMessage[] = [];
  private currentMemoryUsage: number = 0;
  private state: BackpressureState;
  private stats = {
    totalMessages: 0,
    processedMessages: 0,
    droppedMessages: 0,
    blockedMessages: 0,
    queueTimes: [] as number[],
    peakBufferSize: 0,
    backpressureEvents: 0,
    recentThroughput: [] as number[],
  };
  private lastBackpressureTime: number = 0;
  private sampleTimer?: NodeJS.Timeout;
  private lastSampleTime: number = Date.now();
  private lastSampleCount: number = 0;

  constructor(config: Partial<BackpressureConfig> = {}) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.state = this.getInitialState();
    this.startSampling();
  }

  public push(data: any, priority: number = 0): boolean {
    this.stats.totalMessages++;
    if (this.shouldApplyBackpressure()) {
      this.applyBackpressure();
    }
    if (this.buffer.length >= this.config.maxBufferSize) {
      return this.handleOverflow(data, priority);
    }
    const messageSize = this.estimateSize(data);
    if (this.currentMemoryUsage + messageSize > this.config.maxMemoryBytes) {
      if (this.config.overflowStrategy === 'block') {
        this.stats.blockedMessages++;
        return false;
      }
      this.handleOverflow(data, priority);
      return true;
    }
    const message: QueuedMessage = { data, timestamp: Date.now(), priority };
    const insertIndex = this.buffer.findIndex(m => m.priority < priority);
    if (insertIndex === -1) {
      this.buffer.push(message);
    } else {
      this.buffer.splice(insertIndex, 0, message);
    }
    this.currentMemoryUsage += messageSize;
    this.stats.peakBufferSize = Math.max(this.stats.peakBufferSize, this.buffer.length);
    this.updateState();
    return true;
  }

  public pop(): any | null {
    if (this.buffer.length === 0) return null;
    const message = this.buffer.shift()!;
    const queueTime = Date.now() - message.timestamp;
    this.stats.queueTimes.push(queueTime);
    if (this.stats.queueTimes.length > 1000) {
      this.stats.queueTimes = this.stats.queueTimes.slice(-1000);
    }
    this.currentMemoryUsage -= this.estimateSize(message.data);
    this.stats.processedMessages++;
    this.updateState();
    if (this.state.status !== 'normal' && this.getBufferUsage() < this.config.lowWaterMark) {
      this.state.status = 'normal';
      this.emit('backpressure:relieved', this.state);
    }
    return message.data;
  }

  public peek(): any | null {
    return this.buffer.length > 0 ? this.buffer[0].data : null;
  }

  public size(): number {
    return this.buffer.length;
  }

  public isEmpty(): boolean {
    return this.buffer.length === 0;
  }

  public getState(): BackpressureState {
    return { ...this.state };
  }

  public getStats(): BackpressureStats {
    const avgQueueTime = this.stats.queueTimes.length > 0
      ? this.stats.queueTimes.reduce((a, b) => a + b, 0) / this.stats.queueTimes.length
      : 0;
    const currentThroughput = this.stats.recentThroughput.length > 0
      ? this.stats.recentThroughput.reduce((a, b) => a + b, 0) / this.stats.recentThroughput.length
      : 0;
    return {
      totalMessages: this.stats.totalMessages,
      processedMessages: this.stats.processedMessages,
      droppedMessages: this.stats.droppedMessages,
      blockedMessages: this.stats.blockedMessages,
      avgQueueTime,
      peakBufferSize: this.stats.peakBufferSize,
      backpressureEvents: this.stats.backpressureEvents,
      currentThroughput,
    };
  }

  public clear(): void {
    this.buffer = [];
    this.currentMemoryUsage = 0;
    this.updateState();
  }

  private shouldApplyBackpressure(): boolean {
    return this.getBufferUsage() >= this.config.highWaterMark || this.getMemoryUsage() >= this.config.highWaterMark;
  }

  private applyBackpressure(): void {
    const now = Date.now();
    if (now - this.lastBackpressureTime < this.config.cooldownPeriod) return;
    this.lastBackpressureTime = now;
    this.stats.backpressureEvents++;
    const bufferUsage = this.getBufferUsage();
    const memoryUsage = this.getMemoryUsage();
    if (bufferUsage >= 0.95 || memoryUsage >= 0.95) {
      this.state.status = 'critical';
      this.emit('backpressure:critical', this.state);
    } else if (this.state.status !== 'critical') {
      this.state.status = 'warning';
      this.emit('backpressure:warning', this.state);
    }
  }

  private handleOverflow(data: any, priority: number): boolean {
    switch (this.config.overflowStrategy) {
      case 'drop-oldest':
        if (this.buffer.length > 0) {
          const dropped = this.buffer.pop()!;
          this.currentMemoryUsage -= this.estimateSize(dropped.data);
          this.stats.droppedMessages++;
          this.emit('message:dropped', { data: dropped.data, reason: 'overflow' });
        }
        this.buffer.unshift({ data, timestamp: Date.now(), priority });
        return true;
      case 'drop-newest':
        this.stats.droppedMessages++;
        this.emit('message:dropped', { data, reason: 'overflow' });
        return false;
      case 'block':
        this.stats.blockedMessages++;
        return false;
      case 'fail':
        throw new Error('Buffer overflow');
      default:
        return false;
    }
  }

  private getBufferUsage(): number {
    return this.buffer.length / this.config.maxBufferSize;
  }

  private getMemoryUsage(): number {
    return this.currentMemoryUsage / this.config.maxMemoryBytes;
  }

  private updateState(): void {
    this.state.bufferUsage = this.getBufferUsage();
    this.state.memoryUsage = this.getMemoryUsage();
    this.state.messagesDropped = this.stats.droppedMessages;
    this.state.messagesProcessed = this.stats.processedMessages;
    if (this.stats.queueTimes.length > 0) {
      this.state.avgProcessingTime = this.stats.queueTimes.reduce((a, b) => a + b, 0) / this.stats.queueTimes.length;
    }
  }

  private startSampling(): void {
    this.sampleTimer = setInterval(() => {
      const now = Date.now();
      const elapsed = (now - this.lastSampleTime) / 1000;
      const messagesProcessed = this.stats.processedMessages - this.lastSampleCount;
      const throughput = elapsed > 0 ? messagesProcessed / elapsed : 0;
      this.stats.recentThroughput.push(throughput);
      if (this.stats.recentThroughput.length > 60) {
        this.stats.recentThroughput = this.stats.recentThroughput.slice(-60);
      }
      this.lastSampleTime = now;
      this.lastSampleCount = this.stats.processedMessages;
      this.state.throughput = throughput;
    }, this.config.sampleInterval);
  }

  private estimateSize(data: any): number {
    try {
      return Buffer.byteLength(JSON.stringify(data), 'utf8');
    } catch {
      return 1024;
    }
  }

  private getInitialState(): BackpressureState {
    return {
      status: 'normal',
      bufferUsage: 0,
      memoryUsage: 0,
      messagesDropped: 0,
      messagesProcessed: 0,
      avgProcessingTime: 0,
      throughput: 0,
    };
  }

  public destroy(): void {
    if (this.sampleTimer) clearInterval(this.sampleTimer);
  }
}

export default BackpressureHandler;