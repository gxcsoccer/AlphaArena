/**
 * Multi-Timeframe Analysis Module
 * 
 * Provides tools for analyzing multiple timeframes in trading strategies
 */

// Types
export * from './types';

// Services
export { MultiTimeframeDataService, getMultiTimeframeDataService } from './MultiTimeframeDataService';

// Strategy base class
export { MultiTimeframeStrategy } from './MultiTimeframeStrategy';
export type { MultiTimeframeStrategyContext } from './MultiTimeframeStrategy';

// Strategy implementations
export { MultiTimeframeSMAStrategy } from './strategies/MultiTimeframeSMAStrategy';
export type { MultiTimeframeSMAConfig } from './strategies/MultiTimeframeSMAStrategy';

// Routes
export { default as multiTimeframeRoutes } from './routes';
