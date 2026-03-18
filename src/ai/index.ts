/**
 * AI Module Exports
 */

export { StrategyAssistant, strategyAssistant } from './StrategyAssistant.js';
export { 
  createLLMProvider, 
  getDefaultLLMConfig,
  OpenAIProvider,
  AnthropicProvider,
  OllamaProvider,
  type ILLMProvider,
  type LLMConfig,
  type ChatMessage,
  type LLMResponse,
} from './LLMProvider.js';
export type { 
  MarketAnalysis, 
  StrategyOptimization, 
  TradingAdvice, 
  UserContext 
} from './StrategyAssistant.js';
