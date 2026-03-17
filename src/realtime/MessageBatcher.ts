/**
 * Message Batcher
 */

import { EventEmitter } from "events";
import { createGzip, createDeflate, Gzip, Deflate } from "zlib";

export interface BatcherConfig {
  maxBatchSize: number;
  maxBatchDelay: number;
  maxBatchBytes: number;
  enableCompression: boolean;
  compressionType: "gzip" | "deflate";
  compressionLevel: number;
}

export interface Batch {
  id: string;
  messages: any[];
  createdAt: number;
  flushedAt?: number;
  compressedSize?: number;
  uncompressedSize: number;
}

export interface BatcherStats {
  totalBatches: number;
  totalMessages: number;
  totalBytes: number;
  avgBatchSize: number;
  avgFlushDelay: number;
  compressionRatio: number;
  queuedMessages: number;
}

const DEFAULT_CONFIG: BatcherConfig = {
  maxBatchSize: 100,
  maxBatchDelay: 50,
  maxBatchBytes: 64 * 1024,
  enableCompression: true,
  compressionType: "gzip",
  compressionLevel: 6,
};

export class MessageBatcher extends EventEmitter {
  private config: BatcherConfig;
  private currentBatch: Batch;
  private flushTimer?: NodeJS.Timeout;
  private stats = {
    totalBatches: 0,
    totalMessages: 0,
    totalBytes: 0,
    compressionBytesSaved: 0,
    flushDelays: [] as number[],
  };

  constructor(config: Partial<BatcherConfig> = {}) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.currentBatch = this.createNewBatch();
  }

  public add(message: any): void {
    const messageSize = this.estimateMessageSize(message);
    if (
      this.currentBatch.messages.length >= this.config.maxBatchSize ||
      this.currentBatch.uncompressedSize + messageSize > this.config.maxBatchBytes
    ) {
      this.flush();
    }
    if (this.currentBatch.messages.length === 0) {
      this.startFlushTimer();
    }
    this.currentBatch.messages.push(message);
    this.currentBatch.uncompressedSize += messageSize;
    this.stats.totalMessages++;
  }

  public async flush(): Promise<Batch | null> {
    if (this.currentBatch.messages.length === 0) return null;
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = undefined;
    }
    const batch = this.currentBatch;
    batch.flushedAt = Date.now();
    this.stats.flushDelays.push(batch.flushedAt - batch.createdAt);
    if (this.stats.flushDelays.length > 100) {
      this.stats.flushDelays = this.stats.flushDelays.slice(-100);
    }
    if (this.config.enableCompression) {
      try {
        const compressed = await this.compressBatch(batch.messages);
        batch.compressedSize = compressed.length;
        this.stats.compressionBytesSaved += batch.uncompressedSize - batch.compressedSize;
      } catch (error) {
        this.emit("compression:error", { batchId: batch.id, error });
      }
    }
    this.stats.totalBatches++;
    this.stats.totalBytes += batch.compressedSize || batch.uncompressedSize;
    this.currentBatch = this.createNewBatch();
    this.emit("batch:flushed", batch);
    return batch;
  }

  public getQueueSize(): number {
    return this.currentBatch.messages.length;
  }

  public getStats(): BatcherStats {
    return {
      totalBatches: this.stats.totalBatches,
      totalMessages: this.stats.totalMessages,
      totalBytes: this.stats.totalBytes,
      avgBatchSize: this.stats.totalBatches > 0 ? this.stats.totalMessages / this.stats.totalBatches : 0,
      avgFlushDelay: this.stats.flushDelays.length > 0 ? this.stats.flushDelays.reduce((a, b) => a + b, 0) / this.stats.flushDelays.length : 0,
      compressionRatio: this.stats.totalBytes > 0 ? (this.stats.totalBytes + this.stats.compressionBytesSaved) / this.stats.totalBytes : 1,
      queuedMessages: this.currentBatch.messages.length,
    };
  }

  public clear(): void {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = undefined;
    }
    this.currentBatch = this.createNewBatch();
  }

  private createNewBatch(): Batch {
    return {
      id: `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      messages: [],
      createdAt: Date.now(),
      uncompressedSize: 0,
    };
  }

  private startFlushTimer(): void {
    if (this.flushTimer) return;
    this.flushTimer = setTimeout(() => {
      this.flush().catch((error) => this.emit("flush:error", error));
    }, this.config.maxBatchDelay);
  }

  private estimateMessageSize(message: any): number {
    try {
      return Buffer.byteLength(JSON.stringify(message), "utf8");
    } catch {
      return 1024;
    }
  }

  private async compressBatch(messages: any[]): Promise<Buffer> {
    const data = JSON.stringify(messages);
    return new Promise((resolve, reject) => {
      const compressor: Gzip | Deflate =
        this.config.compressionType === "gzip"
          ? createGzip({ level: this.config.compressionLevel })
          : createDeflate({ level: this.config.compressionLevel });
      const chunks: Buffer[] = [];
      compressor.on("data", (chunk) => chunks.push(chunk));
      compressor.on("end", () => resolve(Buffer.concat(chunks)));
      compressor.on("error", reject);
      compressor.end(data, "utf8");
    });
  }
}

export default MessageBatcher;
