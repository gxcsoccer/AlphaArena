/**
 * WebSocket Connection Pool
 */

import { EventEmitter } from 'events';
import WebSocket from 'ws';

export interface ConnectionPoolConfig {
  poolSize: number;
  maxPoolSize: number;
  minPoolSize: number;
  connectionTimeout: number;
  idleTimeout: number;
  reconnectAttempts: number;
  reconnectBaseDelay: number;
  reconnectMaxDelay: number;
  healthCheckInterval: number;
}

export interface PooledConnection {
  id: string;
  ws: WebSocket | null;
  status: 'idle' | 'connecting' | 'connected' | 'error' | 'closed';
  createdAt: number;
  lastUsedAt: number;
  messageCount: number;
  errorCount: number;
}

export interface ConnectionPoolStats {
  totalConnections: number;
  activeConnections: number;
  idleConnections: number;
  connectingCount: number;
  errorCount: number;
  messagesProcessed: number;
  avgLatency: number;
}

const DEFAULT_CONFIG: ConnectionPoolConfig = {
  poolSize: 5,
  maxPoolSize: 20,
  minPoolSize: 2,
  connectionTimeout: 10000,
  idleTimeout: 60000,
  reconnectAttempts: 5,
  reconnectBaseDelay: 1000,
  reconnectMaxDelay: 30000,
  healthCheckInterval: 30000,
};

export class WebSocketConnectionPool extends EventEmitter {
  private config: ConnectionPoolConfig;
  private connections: Map<string, PooledConnection> = new Map();
  private url: string;
  private messageQueue: Array<{ data: any; callback?: () => void }> = [];
  private isShuttingDown: boolean = false;
  private healthCheckTimer?: NodeJS.Timeout;
  private totalMessagesProcessed: number = 0;
  private latencies: number[] = [];

  constructor(url: string, config: Partial<ConnectionPoolConfig> = {}) {
    super();
    this.url = url;
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.startHealthCheck();
  }

  public async initialize(): Promise<void> {
    const initialConnections = Math.max(
      this.config.minPoolSize,
      Math.min(this.config.poolSize, this.config.maxPoolSize)
    );
    const promises: Promise<void>[] = [];
    for (let i = 0; i < initialConnections; i++) {
      promises.push(this.createConnection());
    }
    await Promise.allSettled(promises);
    this.emit('initialized', { connections: this.connections.size });
  }

  private async createConnection(): Promise<void> {
    if (this.isShuttingDown) return;
    if (this.connections.size >= this.config.maxPoolSize) return;

    const id = 'conn_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    const connection: PooledConnection = {
      id,
      ws: null,
      status: 'connecting',
      createdAt: Date.now(),
      lastUsedAt: Date.now(),
      messageCount: 0,
      errorCount: 0,
    };

    this.connections.set(id, connection);

    try {
      const ws = await this.connectWithTimeout();
      connection.ws = ws;
      connection.status = 'connected';
      ws.on('message', (data) => this.handleMessage(connection, data));
      ws.on('error', (error) => this.handleError(connection, error));
      ws.on('close', () => this.handleClose(connection));
      this.emit('connection:created', { id, totalConnections: this.connections.size });
    } catch (error: any) {
      connection.status = 'error';
      connection.errorCount++;
      this.emit('connection:error', { id, error: error.message });
      this.scheduleReconnection(id);
    }
  }

  private connectWithTimeout(): Promise<WebSocket> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(this.url);
      const timeout = setTimeout(() => {
        ws.terminate();
        reject(new Error('Connection timeout'));
      }, this.config.connectionTimeout);

      ws.on('open', () => {
        clearTimeout(timeout);
        resolve(ws);
      });
      ws.on('error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });
  }

  private scheduleReconnection(connectionId: string): void {
    const connection = this.connections.get(connectionId);
    if (!connection || this.isShuttingDown) return;

    if (connection.errorCount >= this.config.reconnectAttempts) {
      this.connections.delete(connectionId);
      this.emit('connection:evicted', { id: connectionId, reason: 'max_reconnect_attempts' });
      if (this.connections.size < this.config.minPoolSize) {
        this.createConnection();
      }
      return;
    }

    const delay = Math.min(
      this.config.reconnectBaseDelay * Math.pow(2, connection.errorCount),
      this.config.reconnectMaxDelay
    );

    setTimeout(() => {
      const conn = this.connections.get(connectionId);
      if (conn) {
        conn.status = 'connecting';
        this.createConnection().then(() => this.connections.delete(connectionId));
      }
    }, delay);
  }

  public getConnection(): PooledConnection | null {
    const availableConnections = Array.from(this.connections.values())
      .filter(c => c.status === 'connected' && c.ws && c.ws.readyState === WebSocket.OPEN);
    if (availableConnections.length === 0) return null;
    availableConnections.sort((a, b) => a.messageCount - b.messageCount);
    return availableConnections[0];
  }

  public send(data: any): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.isShuttingDown) {
        reject(new Error('Pool is shutting down'));
        return;
      }

      const connection = this.getConnection();
      if (!connection || !connection.ws) {
        this.messageQueue.push({ data, callback: () => resolve() });
        this.emit('message:queued', { queueSize: this.messageQueue.length });
        return;
      }

      const startTime = Date.now();
      try {
        const message = typeof data === 'string' ? data : JSON.stringify(data);
        connection.ws.send(message, (error) => {
          if (error) {
            connection.errorCount++;
            reject(error);
          } else {
            const latency = Date.now() - startTime;
            this.latencies.push(latency);
            if (this.latencies.length > 1000) {
              this.latencies = this.latencies.slice(-1000);
            }
            connection.messageCount++;
            connection.lastUsedAt = Date.now();
            this.totalMessagesProcessed++;
            resolve();
          }
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  private handleMessage(connection: PooledConnection, data: WebSocket.Data): void {
    connection.lastUsedAt = Date.now();
    connection.messageCount++;
    this.totalMessagesProcessed++;
    try {
      const message = JSON.parse(data.toString());
      this.emit('message', { connectionId: connection.id, data: message });
    } catch {
      this.emit('message', { connectionId: connection.id, data: data.toString() });
    }
  }

  private handleError(connection: PooledConnection, error: Error): void {
    connection.errorCount++;
    connection.status = 'error';
    this.emit('connection:error', { id: connection.id, error: error.message });
  }

  private handleClose(connection: PooledConnection): void {
    connection.status = 'closed';
    this.emit('connection:closed', { id: connection.id });
    if (!this.isShuttingDown) {
      this.scheduleReconnection(connection.id);
    }
  }

  private startHealthCheck(): void {
    this.healthCheckTimer = setInterval(() => this.performHealthCheck(), this.config.healthCheckInterval);
  }

  private performHealthCheck(): void {
    const now = Date.now();
    this.connections.forEach((connection, id) => {
      if (
        connection.status === 'connected' &&
        now - connection.lastUsedAt > this.config.idleTimeout &&
        this.connections.size > this.config.minPoolSize
      ) {
        if (connection.ws) connection.ws.close();
        this.connections.delete(id);
        this.emit('connection:evicted', { id, reason: 'idle_timeout' });
      }
      if (connection.status === 'connecting' && now - connection.createdAt > this.config.connectionTimeout * 2) {
        this.connections.delete(id);
        this.emit('connection:evicted', { id, reason: 'stale' });
      }
    });
    while (this.connections.size < this.config.minPoolSize && !this.isShuttingDown) {
      this.createConnection();
    }
    this.emit('health:check', this.getStats());
  }

  public getStats(): ConnectionPoolStats {
    const connections = Array.from(this.connections.values());
    return {
      totalConnections: this.connections.size,
      activeConnections: connections.filter(c => c.status === 'connected').length,
      idleConnections: connections.filter(c => c.status === 'idle').length,
      connectingCount: connections.filter(c => c.status === 'connecting').length,
      errorCount: connections.reduce((sum, c) => sum + c.errorCount, 0),
      messagesProcessed: this.totalMessagesProcessed,
      avgLatency: this.latencies.length > 0 ? this.latencies.reduce((a, b) => a + b, 0) / this.latencies.length : 0,
    };
  }

  public getQueueSize(): number {
    return this.messageQueue.length;
  }

  public async shutdown(): Promise<void> {
    this.isShuttingDown = true;
    if (this.healthCheckTimer) clearInterval(this.healthCheckTimer);
    const closePromises: Promise<void>[] = [];
    this.connections.forEach((connection) => {
      if (connection.ws) {
        closePromises.push(new Promise((resolve) => {
          connection.ws!.on('close', resolve);
          connection.ws!.close();
        }));
      }
    });
    await Promise.allSettled(closePromises);
    this.connections.clear();
    this.emit('shutdown', { messagesQueued: this.messageQueue.length });
  }
}

export default WebSocketConnectionPool;