/**
 * Data Source Module
 *
 * Provides a unified interface for accessing market data from multiple sources.
 * Supports switching between different data providers (Mock, Binance, Alpaca, etc.)
 */

// Core types
export * from './types';

// Interface
export * from './interface';

// Manager
export { DataSourceManager, getDataSourceManager, ProviderFactory } from './DataSourceManager';

// Providers
export { MockDataProvider } from './providers/MockDataProvider';

// Convenience exports for common use cases
import { getDataSourceManager } from './DataSourceManager';
import { MockDataProvider } from './providers/MockDataProvider';
import { DataSourceConfig } from './types';

/**
 * Initialize the default mock data source
 * Convenience function for quick setup
 */
export async function initializeMockDataSource(config?: Partial<DataSourceConfig>): Promise<void> {
  const manager = getDataSourceManager();
  const provider = new MockDataProvider();
  
  const fullConfig: DataSourceConfig = {
    providerId: 'mock',
    ...config,
  };
  
  manager.registerProvider(provider, fullConfig);
  await manager.connect();
}

/**
 * Get the current active provider
 * Convenience function for direct access
 */
export function getActiveProvider() {
  return getDataSourceManager().getActiveProvider();
}