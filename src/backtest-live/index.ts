/**
 * Backtest-Live Integration Module
 *
 * Provides seamless integration between backtesting and live trading
 *
 * @module backtest-live
 */

// Types
export * from './types';
export * from './ComparisonTypes';

// Services
export { ConfigSync, configSync } from './ConfigSync';
export { PerformanceMonitor, performanceMonitor } from './PerformanceMonitor';
export { OptimizationFeedback, optimizationFeedback } from './OptimizationFeedback';
export { BacktestLiveIntegration, backtestLiveIntegration } from './BacktestLiveIntegration';
export { BacktestLiveComparisonService, backtestLiveComparisonService } from './BacktestLiveComparisonService';