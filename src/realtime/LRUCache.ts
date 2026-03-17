/**
 * LRU Cache
 */

export interface CacheConfig {
  maxSize: number;
  maxMemoryBytes: number;
  defaultTTL: number;
  cleanupInterval: number;
  enableStats: boolean;
}

export interface CacheEntry<T> {
  key: string;
  value: T;
  size: number;
  createdAt: number;
  expiresAt: number;
  lastAccessedAt: number;
  hitCount: number;
}

export interface CacheStats {
  size: number;
  memoryUsage: number;
  hits: number;
  misses: number;
  hitRate: number;
  evictions: number;
  expirations: number;
  avgEntrySize: number;
}

interface CacheNode<T> {
  key: string;
  entry: CacheEntry<T>;
  prev: CacheNode<T> | null;
  next: CacheNode<T> | null;
}

const DEFAULT_CONFIG: CacheConfig = {
  maxSize: 10000,
  maxMemoryBytes: 100 * 1024 * 1024,
  defaultTTL: 60000,
  cleanupInterval: 10000,
  enableStats: true,
};

export class LRUCache<T = any> {
  private config: CacheConfig;
  private cache: Map<string, CacheNode<T>> = new Map();
  private head: CacheNode<T> | null = null;
  private tail: CacheNode<T> | null = null;
  private currentMemoryUsage: number = 0;
  private stats = { hits: 0, misses: 0, evictions: 0, expirations: 0 };
  private cleanupTimer?: NodeJS.Timeout;

  constructor(config: Partial<CacheConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.startCleanup();
  }

  public get(key: string): T | undefined {
    const node = this.cache.get(key);
    if (!node) {
      if (this.config.enableStats) this.stats.misses++;
      return undefined;
    }
    if (Date.now() > node.entry.expiresAt) {
      this.delete(key);
      if (this.config.enableStats) { this.stats.misses++; this.stats.expirations++; }
      return undefined;
    }
    this.moveToFront(node);
    node.entry.lastAccessedAt = Date.now();
    node.entry.hitCount++;
    if (this.config.enableStats) this.stats.hits++;
    return node.entry.value;
  }

  public set(key: string, value: T, ttl?: number): void {
    const size = this.estimateSize(value);
    const now = Date.now();
    const expiresAt = now + (ttl ?? this.config.defaultTTL);
    while ((this.cache.size >= this.config.maxSize || this.currentMemoryUsage + size > this.config.maxMemoryBytes) && this.cache.size > 0) {
      this.evictLRU();
    }
    const existingNode = this.cache.get(key);
    if (existingNode) {
      this.currentMemoryUsage -= existingNode.entry.size;
      existingNode.entry = { key, value, size, createdAt: now, expiresAt, lastAccessedAt: now, hitCount: existingNode.entry.hitCount };
      this.currentMemoryUsage += size;
      this.moveToFront(existingNode);
      return;
    }
    const entry: CacheEntry<T> = { key, value, size, createdAt: now, expiresAt, lastAccessedAt: now, hitCount: 0 };
    const node: CacheNode<T> = { key, entry, prev: null, next: this.head };
    if (this.head) this.head.prev = node;
    this.head = node;
    if (!this.tail) this.tail = node;
    this.cache.set(key, node);
    this.currentMemoryUsage += size;
  }

  public has(key: string): boolean {
    const node = this.cache.get(key);
    if (!node) return false;
    if (Date.now() > node.entry.expiresAt) { this.delete(key); return false; }
    return true;
  }

  public delete(key: string): boolean {
    const node = this.cache.get(key);
    if (!node) return false;
    this.currentMemoryUsage -= node.entry.size;
    if (node.prev) node.prev.next = node.next; else this.head = node.next;
    if (node.next) node.next.prev = node.prev; else this.tail = node.prev;
    this.cache.delete(key);
    return true;
  }

  public clear(): void {
    this.cache.clear();
    this.head = null;
    this.tail = null;
    this.currentMemoryUsage = 0;
  }

  public size(): number { return this.cache.size; }
  public memoryUsage(): number { return this.currentMemoryUsage; }

  public getStats(): CacheStats {
    const total = this.stats.hits + this.stats.misses;
    return {
      size: this.cache.size,
      memoryUsage: this.currentMemoryUsage,
      hits: this.stats.hits,
      misses: this.stats.misses,
      hitRate: total > 0 ? this.stats.hits / total : 0,
      evictions: this.stats.evictions,
      expirations: this.stats.expirations,
      avgEntrySize: this.cache.size > 0 ? this.currentMemoryUsage / this.cache.size : 0,
    };
  }

  public keys(): string[] { return Array.from(this.cache.keys()); }

  private moveToFront(node: CacheNode<T>): void {
    if (node === this.head) return;
    if (node.prev) node.prev.next = node.next;
    if (node.next) node.next.prev = node.prev;
    if (node === this.tail) this.tail = node.prev;
    node.prev = null;
    node.next = this.head;
    if (this.head) this.head.prev = node;
    this.head = node;
  }

  private evictLRU(): void {
    if (!this.tail) return;
    const key = this.tail.key;
    this.delete(key);
    this.stats.evictions++;
  }

  private estimateSize(value: T): number {
    try { return Buffer.byteLength(JSON.stringify(value), 'utf8'); } catch { return 1024; }
  }

  private startCleanup(): void {
    this.cleanupTimer = setInterval(() => this.cleanup(), this.config.cleanupInterval);
  }

  private cleanup(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];
    this.cache.forEach((node, key) => { if (now > node.entry.expiresAt) keysToDelete.push(key); });
    keysToDelete.forEach(key => { this.delete(key); this.stats.expirations++; });
  }

  public destroy(): void {
    if (this.cleanupTimer) clearInterval(this.cleanupTimer);
    this.clear();
  }
}

export default LRUCache;