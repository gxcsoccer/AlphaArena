/**
 * Backtest-Live Integration Module
 *
 * Provides seamless integration between backtesting and live trading
 *
 * @module backtest-live
 */

// Types
export * from './types';

// Services
export { ConfigSync, configSync } from './ConfigSync';
export { PerformanceMonitor, performanceMonitor } from './PerformanceMonitor';
export { OptimizationFeedback, optimizationFeedback } from './OptimizationFeedback';
export { BacktestLiveIntegration, backtestLiveIntegration } from './BacktestLiveIntegration';