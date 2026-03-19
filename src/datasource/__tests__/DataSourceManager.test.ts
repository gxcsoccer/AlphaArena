/**
 * Tests for DataSourceManager
 */

import { DataSourceManager, getDataSourceManager } from '../DataSourceManager';
import { MockDataProvider } from '../providers/MockDataProvider';
import { DataSourceStatus } from '../types';

describe('DataSourceManager', () => {
  let manager: DataSourceManager;

  beforeEach(() => {
    // Reset singleton for each test
    DataSourceManager.resetInstance();
    manager = DataSourceManager.getInstance();
  });

  afterEach(async () => {
    await manager.disconnectAll();
    DataSourceManager.resetInstance();
  });

  describe('Singleton', () => {
    it('should return the same instance', () => {
      const instance1 = DataSourceManager.getInstance();
      const instance2 = DataSourceManager.getInstance();
      expect(instance1).toBe(instance2);
    });

    it('should return the same instance via getDataSourceManager', () => {
      const instance = getDataSourceManager();
      expect(instance).toBe(manager);
    });
  });

  describe('Provider Registration', () => {
    it('should register a provider', () => {
      const provider = new MockDataProvider();
      manager.registerProvider(provider);

      const providerIds = manager.getProviderIds();
      expect(providerIds).toContain('mock');
    });

    it('should register provider with config', () => {
      const provider = new MockDataProvider();
      const config = { providerId: 'mock', testnet: true };
      manager.registerProvider(provider, config);

      expect(manager.getConfig('mock')).toEqual(config);
    });

    it('should register provider factory', () => {
      manager.registerProviderFactory('mock', () => new MockDataProvider());

      const providerIds = manager.getProviderIds();
      expect(providerIds).toContain('mock');
    });

    it('should emit provider-registered event', () => {
      const listener = jest.fn();
      manager.on('provider-registered', listener);

      const provider = new MockDataProvider();
      manager.registerProvider(provider);

      expect(listener).toHaveBeenCalledWith({ providerId: 'mock' });
    });
  });

  describe('Provider Unregistration', () => {
    it('should unregister a provider', async () => {
      const provider = new MockDataProvider();
      manager.registerProvider(provider);
      await manager.unregisterProvider('mock');

      const providerIds = manager.getProviderIds();
      expect(providerIds).not.toContain('mock');
    });

    it('should emit provider-unregistered event', async () => {
      const provider = new MockDataProvider();
      manager.registerProvider(provider);

      const listener = jest.fn();
      manager.on('provider-unregistered', listener);

      await manager.unregisterProvider('mock');

      expect(listener).toHaveBeenCalledWith({ providerId: 'mock' });
    });

    it('should clear active provider when unregistering it', async () => {
      const provider = new MockDataProvider();
      manager.registerProvider(provider);
      await manager.setActiveProvider('mock');

      await manager.unregisterProvider('mock');

      expect(manager.getActiveProvider()).toBeNull();
      expect(manager.getActiveProviderId()).toBeNull();
    });
  });

  describe('Active Provider', () => {
    it('should set active provider', async () => {
      const provider = new MockDataProvider();
      manager.registerProvider(provider, { providerId: 'mock' });

      await manager.setActiveProvider('mock', false);

      expect(manager.getActiveProvider()).toBe(provider);
      expect(manager.getActiveProviderId()).toBe('mock');
    });

    it('should auto-activate first registered provider', () => {
      const provider = new MockDataProvider();
      manager.registerProvider(provider);

      expect(manager.getActiveProviderId()).toBe('mock');
    });

    it('should emit provider-switched event', async () => {
      // Reset to ensure clean state
      DataSourceManager.resetInstance();
      manager = DataSourceManager.getInstance();
      
      const provider = new MockDataProvider();
      manager.registerProvider(provider, { providerId: 'mock' });

      const listener = jest.fn();
      manager.on('provider-switched', listener);

      // Since registerProvider already set it as active, we need to set it again
      // which will emit the event with from: 'mock'
      await manager.setActiveProvider('mock', false);

      expect(listener).toHaveBeenCalled();
    });

    it('should throw error when setting non-existent provider', async () => {
      await expect(manager.setActiveProvider('nonexistent')).rejects.toThrow();
    });
  });

  describe('Connection', () => {
    it('should connect to active provider', async () => {
      const provider = new MockDataProvider();
      manager.registerProvider(provider, { providerId: 'mock' });
      await manager.setActiveProvider('mock', false);

      await manager.connect();

      expect(manager.status).toBe(DataSourceStatus.CONNECTED);
    });

    it('should throw error when connecting without active provider', async () => {
      await expect(manager.connect()).rejects.toThrow('No active provider');
    });

    it('should throw error when connecting without config', async () => {
      const provider = new MockDataProvider();
      manager.registerProvider(provider);
      (manager as any)._activeProvider = provider;
      (manager as any)._activeProviderId = 'mock';

      await expect(manager.connect()).rejects.toThrow('No configuration');
    });
  });

  describe('Provider Methods', () => {
    beforeEach(async () => {
      // Reset for clean state
      DataSourceManager.resetInstance();
      manager = DataSourceManager.getInstance();
      
      const provider = new MockDataProvider();
      manager.registerProvider(provider, { providerId: 'mock' });
      await manager.connect();
    });

    afterEach(async () => {
      await manager.disconnectAll();
    });

    it('should get quote', async () => {
      const quote = await manager.getQuote('BTC/USDT');
      expect(quote.symbol).toBe('BTC/USDT');
      expect(quote.lastPrice).toBeGreaterThan(0);
    });

    it('should get quotes', async () => {
      const quotes = await manager.getQuotes(['BTC/USDT', 'ETH/USDT']);
      expect(quotes).toHaveLength(2);
    });

    it('should get bars', async () => {
      const bars = await manager.getBars('BTC/USDT', '1m', 10);
      expect(bars.length).toBeLessThanOrEqual(10);
    });

    it('should get order book', async () => {
      const orderBook = await manager.getOrderBook('BTC/USDT', 5);
      expect(orderBook.bids.length).toBe(5);
      expect(orderBook.asks.length).toBe(5);
    });

    it('should get market info', async () => {
      const marketInfo = await manager.getMarketInfo('BTC/USDT');
      expect(marketInfo.symbol).toBe('BTC/USDT');
      expect(marketInfo.baseCurrency).toBe('BTC');
    });

    it('should get available markets', async () => {
      const markets = await manager.getAvailableMarkets();
      expect(markets.length).toBeGreaterThan(0);
    });

    it('should throw error when no active provider', async () => {
      await manager.disconnectAll();

      expect(() => manager.getCapabilities()).toThrow('No active provider');
    });
  });

  describe('Subscriptions', () => {
    beforeEach(async () => {
      // Reset for clean state
      DataSourceManager.resetInstance();
      manager = DataSourceManager.getInstance();
      
      const provider = new MockDataProvider();
      manager.registerProvider(provider, { providerId: 'mock' });
      await manager.connect();
    });

    afterEach(async () => {
      await manager.disconnectAll();
    });

    it('should subscribe to quotes', () => {
      const callback = jest.fn();
      const unsubscribe = manager.subscribeToQuotes('BTC/USDT', callback);

      expect(typeof unsubscribe).toBe('function');
      unsubscribe();
    });

    it('should subscribe to order book', () => {
      const callback = jest.fn();
      const unsubscribe = manager.subscribeToOrderBook('BTC/USDT', callback);

      expect(typeof unsubscribe).toBe('function');
      unsubscribe();
    });

    it('should unsubscribe from all', () => {
      manager.subscribeToQuotes('BTC/USDT', () => {});
      manager.subscribeToOrderBook('BTC/USDT', () => {});

      expect(() => manager.unsubscribeAll('BTC/USDT')).not.toThrow();
    });
  });
});