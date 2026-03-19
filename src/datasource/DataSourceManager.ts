/**
 * Data Source Manager
 *
 * Singleton manager for handling multiple data providers.
 * Supports dynamic switching between providers, configuration management,
 * and unified access to market data.
 */

import { EventEmitter } from 'events';
import {
  Quote,
  Bar,
  Trade,
  OrderBook,
  Ticker,
  BarInterval,
  DataSourceStatus,
  DataSourceConfig,
  DataSourceCapabilities,
  DataSourceError,
  DataSourceErrorType,
  QuoteCallback,
  BarCallback,
  TradeCallback,
  OrderBookCallback,
  TickerCallback,
  MarketInfo,
} from './types';
import { IStockDataProvider, BaseStockDataProvider } from './interface';

/**
 * Provider factory function type
 */
export type ProviderFactory = () => IStockDataProvider;

/**
 * Data source manager events
 */
export interface DataSourceManagerEvents {
  'provider-registered': { providerId: string };
  'provider-unregistered': { providerId: string };
  'provider-switched': { from: string | null; to: string };
  'provider-connected': { providerId: string };
  'provider-disconnected': { providerId: string };
  'provider-error': { providerId: string; error: Error };
  'status-change': { status: DataSourceStatus };
}

/**
 * Data Source Manager - Singleton
 *
 * Manages multiple data providers and provides a unified interface
 * for accessing market data from different sources.
 */
export class DataSourceManager extends EventEmitter {
  private static _instance: DataSourceManager | null = null;

  /** Registered providers */
  private _providers: Map<string, IStockDataProvider> = new Map();

  /** Provider factories for lazy initialization */
  private _factories: Map<string, ProviderFactory> = new Map();

  /** Currently active provider */
  private _activeProvider: IStockDataProvider | null = null;

  /** Active provider ID */
  private _activeProviderId: string | null = null;

  /** Provider configurations */
  private _configs: Map<string, DataSourceConfig> = new Map();

  private constructor() {
    super();
  }

  /**
   * Get the singleton instance
   */
  static getInstance(): DataSourceManager {
    if (!DataSourceManager._instance) {
      DataSourceManager._instance = new DataSourceManager();
    }
    return DataSourceManager._instance;
  }

  /**
   * Reset the singleton (useful for testing)
   */
  static resetInstance(): void {
    if (DataSourceManager._instance) {
      DataSourceManager._instance.disconnectAll();
      DataSourceManager._instance = null;
    }
  }

  // ========== Provider Registration ==========

  /**
   * Register a data provider
   * @param provider The provider instance
   * @param config Optional default configuration
   */
  registerProvider(provider: IStockDataProvider, config?: DataSourceConfig): void {
    if (this._providers.has(provider.providerId)) {
      console.warn(`[DataSourceManager] Provider "${provider.providerId}" already registered. Replacing.`);
    }

    this._providers.set(provider.providerId, provider);

    if (config) {
      this._configs.set(provider.providerId, config);
    }

    // Set up event forwarding
    this.forwardProviderEvents(provider);

    this.emit('provider-registered', { providerId: provider.providerId });

    // If this is the first provider, auto-activate it (without auto-connect)
    if (this._providers.size === 1 && !this._activeProvider) {
      // Synchronously set the active provider without connecting
      this._activeProvider = provider;
      this._activeProviderId = provider.providerId;
      this.emit('provider-switched', { from: null, to: provider.providerId });
    }
  }

  /**
   * Register a provider factory for lazy initialization
   * @param providerId Provider identifier
   * @param factory Factory function that creates the provider
   * @param config Configuration to use when initializing
   */
  registerProviderFactory(
    providerId: string,
    factory: ProviderFactory,
    config?: DataSourceConfig
  ): void {
    this._factories.set(providerId, factory);

    if (config) {
      this._configs.set(providerId, config);
    }

    this.emit('provider-registered', { providerId });
  }

  /**
   * Unregister a provider
   * @param providerId Provider identifier
   */
  async unregisterProvider(providerId: string): Promise<void> {
    const provider = this._providers.get(providerId);

    if (provider) {
      await provider.disconnect();
      this._providers.delete(providerId);
    }

    this._factories.delete(providerId);
    this._configs.delete(providerId);

    // If this was the active provider, clear it
    if (this._activeProviderId === providerId) {
      this._activeProvider = null;
      this._activeProviderId = null;
    }

    this.emit('provider-unregistered', { providerId });
  }

  // ========== Provider Access ==========

  /**
   * Get all registered provider IDs
   */
  getProviderIds(): string[] {
    const providerIds = new Set<string>();
    Array.from(this._providers.keys()).forEach(id => providerIds.add(id));
    Array.from(this._factories.keys()).forEach(id => providerIds.add(id));
    return Array.from(providerIds);
  }

  /**
   * Get a specific provider by ID
   * @param providerId Provider identifier
   * @param autoInitialize Whether to initialize lazy providers
   */
  async getProvider(providerId: string, autoInitialize: boolean = true): Promise<IStockDataProvider | null> {
    // Check active providers first
    const provider = this._providers.get(providerId);
    if (provider) {
      return provider;
    }

    // Try to initialize from factory
    if (autoInitialize) {
      const factory = this._factories.get(providerId);
      if (factory) {
        const newProvider = factory();
        const config = this._configs.get(providerId);
        this.registerProvider(newProvider, config);
        return newProvider;
      }
    }

    return null;
  }

  /**
   * Get the currently active provider
   */
  getActiveProvider(): IStockDataProvider | null {
    return this._activeProvider;
  }

  /**
   * Get the active provider ID
   */
  getActiveProviderId(): string | null {
    return this._activeProviderId;
  }

  // ========== Provider Switching ==========

  /**
   * Set the active provider
   * @param providerId Provider identifier
   * @param autoConnect Whether to automatically connect if not connected
   */
  async setActiveProvider(providerId: string, autoConnect: boolean = true): Promise<void> {
    const provider = await this.getProvider(providerId);
    if (!provider) {
      throw new DataSourceError(
        DataSourceErrorType.UNKNOWN,
        `Provider "${providerId}" not found`,
        providerId
      );
    }

    const previousProviderId = this._activeProviderId;

    // Disconnect previous provider if it's different
    if (this._activeProvider && previousProviderId !== providerId) {
      try {
        await this._activeProvider.disconnect();
      } catch (err) {
        console.error(`[DataSourceManager] Error disconnecting ${previousProviderId}:`, err);
      }
    }

    this._activeProvider = provider;
    this._activeProviderId = providerId;

    // Connect the new provider if needed
    if (autoConnect && provider.status === DataSourceStatus.DISCONNECTED) {
      const config = this._configs.get(providerId);
      if (config) {
        await provider.connect(config);
      }
    }

    this.emit('provider-switched', { from: previousProviderId, to: providerId });
  }

  // ========== Configuration ==========

  /**
   * Set configuration for a provider
   * @param providerId Provider identifier
   * @param config Configuration
   */
  setConfig(providerId: string, config: DataSourceConfig): void {
    this._configs.set(providerId, config);
  }

  /**
   * Get configuration for a provider
   * @param providerId Provider identifier
   */
  getConfig(providerId: string): DataSourceConfig | undefined {
    return this._configs.get(providerId);
  }

  // ========== Connection Management ==========

  /**
   * Connect the active provider
   */
  async connect(): Promise<void> {
    if (!this._activeProvider) {
      throw new DataSourceError(
        DataSourceErrorType.CONNECTION_ERROR,
        'No active provider set',
        this._activeProviderId ?? undefined
      );
    }

    const config = this._configs.get(this._activeProviderId!);
    if (!config) {
      throw new DataSourceError(
        DataSourceErrorType.AUTHENTICATION_ERROR,
        'No configuration set for active provider',
        this._activeProviderId ?? undefined
      );
    }

    await this._activeProvider.connect(config);
    this.emit('provider-connected', { providerId: this._activeProviderId! });
  }

  /**
   * Disconnect all providers
   */
  async disconnectAll(): Promise<void> {
    const disconnectPromises = Array.from(this._providers.values()).map(
      provider => provider.disconnect().catch(err => {
        console.error(`[DataSourceManager] Error disconnecting ${provider.providerId}:`, err);
      })
    );
    await Promise.all(disconnectPromises);
    this._activeProvider = null;
    this._activeProviderId = null;
  }

  // ========== Proxy Methods to Active Provider ==========

  private getProviderOrThrow(): IStockDataProvider {
    if (!this._activeProvider) {
      throw new DataSourceError(
        DataSourceErrorType.CONNECTION_ERROR,
        'No active provider. Call setActiveProvider() first.',
        this._activeProviderId ?? undefined
      );
    }
    return this._activeProvider;
  }

  get status(): DataSourceStatus {
    return this._activeProvider?.status ?? DataSourceStatus.DISCONNECTED;
  }

  getCapabilities(): DataSourceCapabilities {
    return this.getProviderOrThrow().getCapabilities();
  }

  async getQuote(symbol: string): Promise<Quote> {
    return this.getProviderOrThrow().getQuote(symbol);
  }

  async getQuotes(symbols: string[]): Promise<Quote[]> {
    return this.getProviderOrThrow().getQuotes(symbols);
  }

  async getBars(symbol: string, interval: BarInterval, limit?: number): Promise<Bar[]> {
    return this.getProviderOrThrow().getBars(symbol, interval, limit);
  }

  async getBarsByRange(
    symbol: string,
    interval: BarInterval,
    startTime: number,
    endTime: number
  ): Promise<Bar[]> {
    return this.getProviderOrThrow().getBarsByRange(symbol, interval, startTime, endTime);
  }

  async getOrderBook(symbol: string, depth?: number): Promise<OrderBook> {
    return this.getProviderOrThrow().getOrderBook(symbol, depth);
  }

  async getRecentTrades(symbol: string, limit?: number): Promise<Trade[]> {
    return this.getProviderOrThrow().getRecentTrades(symbol, limit);
  }

  async getMarketInfo(symbol: string): Promise<MarketInfo> {
    return this.getProviderOrThrow().getMarketInfo(symbol);
  }

  async getAvailableMarkets(): Promise<MarketInfo[]> {
    return this.getProviderOrThrow().getAvailableMarkets();
  }

  subscribeToQuotes(symbol: string, callback: QuoteCallback): () => void {
    return this.getProviderOrThrow().subscribeToQuotes(symbol, callback);
  }

  subscribeToBars(symbol: string, interval: BarInterval, callback: BarCallback): () => void {
    return this.getProviderOrThrow().subscribeToBars(symbol, interval, callback);
  }

  subscribeToTrades(symbol: string, callback: TradeCallback): () => void {
    return this.getProviderOrThrow().subscribeToTrades(symbol, callback);
  }

  subscribeToOrderBook(symbol: string, callback: OrderBookCallback): () => void {
    return this.getProviderOrThrow().subscribeToOrderBook(symbol, callback);
  }

  subscribeToTicker(symbol: string, callback: TickerCallback): () => void {
    return this.getProviderOrThrow().subscribeToTicker(symbol, callback);
  }

  subscribeToMultiQuotes(symbols: string[], onQuote: QuoteCallback): () => void {
    return this.getProviderOrThrow().subscribeToMultiQuotes(symbols, onQuote);
  }

  unsubscribeAll(symbol: string): void {
    this.getProviderOrThrow().unsubscribeAll(symbol);
  }

  unsubscribeFromAll(): void {
    this.getProviderOrThrow().unsubscribeFromAll();
  }

  // ========== Event Handling ==========

  private forwardProviderEvents(provider: IStockDataProvider): void {
    // Check if provider is an EventEmitter
    if ('on' in provider && typeof provider.on === 'function') {
      // Forward status changes
      (provider as any).on('statusChange', (data: any) => {
        this.emit('status-change', data);
      });

      // Forward errors
      (provider as any).on('error', (error: Error) => {
        this.emit('provider-error', { providerId: provider.providerId, error });
      });
    }
  }
}

// Export singleton getter
export const getDataSourceManager = (): DataSourceManager => DataSourceManager.getInstance();