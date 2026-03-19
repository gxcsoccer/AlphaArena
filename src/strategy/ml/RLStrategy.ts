/**
 * Reinforcement Learning Strategy
 *
 * Uses Q-Learning for trading decisions
 */

import { StrategyContext, OrderSignal, MarketData } from '../types';
import { 
  FeatureVector, 
  PredictionResult, 
  RLAction, 
  RLState, 
  RLExperience,
  QTable,
} from './MLTypes';
import { MLStrategy, MLStrategyConfig } from './MLStrategy';

/**
 * RL Strategy configuration
 */
export interface RLStrategyConfig extends MLStrategyConfig {
  params?: MLStrategyConfig['params'] & {
    /** RL-specific parameters */
    rl?: {
      /** Learning rate (alpha) */
      alpha?: number;
      /** Discount factor (gamma) */
      gamma?: number;
      /** Initial exploration rate (epsilon) */
      epsilon?: number;
      /** Epsilon decay rate */
      epsilonDecay?: number;
      /** Minimum epsilon */
      epsilonMin?: number;
      /** State discretization bins */
      stateBins?: number;
      /** Reward function type */
      rewardFunction?: 'returns' | 'sharpe' | 'sortino' | 'custom';
      /** Enable experience replay */
      experienceReplay?: boolean;
      /** Replay buffer size */
      replayBufferSize?: number;
    };
  };
}

/**
 * Reward history entry
 */
interface RewardEntry {
  timestamp: number;
  action: RLAction;
  reward: number;
  portfolioValue: number;
}

/**
 * Reinforcement Learning Strategy - 强化学习策略
 *
 * Implements Q-Learning for trading:
 * - State discretization
 * - Action-value function (Q-table)
 * - Epsilon-greedy exploration
 * - Experience replay (optional)
 */
export class RLStrategy extends MLStrategy {
  private qTable: QTable;
  private stateBins: number;
  private rewardFunction: string;
  private experienceReplay: boolean;
  private replayBuffer: RLExperience[] = [];
  private replayBufferSize: number;
  
  // State tracking
  private lastState: RLState | null = null;
  private lastAction: RLAction | null = null;
  private lastPortfolioValue: number = 0;
  
  // History
  private rewardHistory: RewardEntry[] = [];
  private actionHistory: { action: RLAction; timestamp: number }[] = [];
  
  // Discretization ranges
  private featureRanges: Map<string, { min: number; max: number }> = new Map();

  constructor(config: RLStrategyConfig) {
    super(config);
    
    const rlConfig = config.params?.rl || {};
    
    this.qTable = {
      table: new Map(),
      alpha: rlConfig.alpha ?? 0.1,
      gamma: rlConfig.gamma ?? 0.95,
      epsilon: rlConfig.epsilon ?? 0.3,
      epsilonDecay: rlConfig.epsilonDecay ?? 0.995,
      epsilonMin: rlConfig.epsilonMin ?? 0.01,
    };
    
    this.stateBins = rlConfig.stateBins ?? 10;
    this.rewardFunction = rlConfig.rewardFunction ?? 'returns';
    this.experienceReplay = rlConfig.experienceReplay ?? true;
    this.replayBufferSize = rlConfig.replayBufferSize ?? 1000;
  }

  /**
   * Initialize feature ranges for discretization
   */
  protected initFeatureExtractor(): void {
    // Initialize feature ranges for common features
    this.featureRanges.set('rsi-14', { min: 0, max: 100 });
    this.featureRanges.set('returns', { min: -0.1, max: 0.1 });
    this.featureRanges.set('macd', { min: -100, max: 100 });
    this.featureRanges.set('volatility-20', { min: 0, max: 1 });
  }

  /**
   * Make a prediction (select action)
   */
  protected predict(features: FeatureVector): PredictionResult | null {
    // Create state from features
    const state = this.createState(features);
    
    // Epsilon-greedy action selection
    const action = this.selectAction(state);
    
    // Store for learning
    this.lastState = state;
    this.lastAction = action;
    
    // Get Q-value for selected action
    const stateKey = this.stateToKey(state);
    const qValue = this.getQValue(stateKey, action);
    
    // Store action
    this.actionHistory.push({ action, timestamp: Date.now() });
    if (this.actionHistory.length > 100) {
      this.actionHistory.shift();
    }

    // Return as prediction
    const actionIndex = { buy: 0, sell: 1, hold: 2 }[action];
    
    return {
      prediction: actionIndex,
      confidence: Math.min(1, Math.abs(qValue) / 10 + 0.3), // Normalize Q-value to confidence
      timestamp: Date.now(),
      modelId: 'q-learning',
      metadata: {
        action,
        qValue,
        epsilon: this.qTable.epsilon,
        stateKey,
      },
    };
  }

  /**
   * Create state from features
   */
  private createState(features: FeatureVector): RLState {
    // Select most relevant features for state
    const relevantFeatures = ['rsi-14', 'returns', 'macd', 'volatility-20'];
    const stateFeatures: Record<string, number> = {};
    const vector: number[] = [];

    for (const name of relevantFeatures) {
      const idx = features.names.indexOf(name);
      const value = idx >= 0 ? features.values[idx] : 0;
      
      // Discretize value
      const discretized = this.discretizeFeature(name, value);
      stateFeatures[name] = discretized;
      vector.push(discretized);
    }

    return {
      vector,
      features: stateFeatures,
      timestamp: Date.now(),
    };
  }

  /**
   * Discretize a feature value
   */
  private discretizeFeature(name: string, value: number): number {
    const range = this.featureRanges.get(name) || { min: -100, max: 100 };
    const { min, max } = range;
    
    // Clamp value
    const clamped = Math.max(min, Math.min(max, value));
    
    // Discretize into bins
    const binSize = (max - min) / this.stateBins;
    const bin = Math.floor((clamped - min) / binSize);
    
    return Math.min(bin, this.stateBins - 1);
  }

  /**
   * Select action using epsilon-greedy policy
   */
  private selectAction(state: RLState): RLAction {
    const stateKey = this.stateToKey(state);
    
    // Exploration: random action
    if (Math.random() < this.qTable.epsilon) {
      const actions: RLAction[] = ['buy', 'sell', 'hold'];
      return actions[Math.floor(Math.random() * actions.length)];
    }
    
    // Exploitation: best action
    return this.getBestAction(stateKey);
  }

  /**
   * Get best action for a state
   */
  private getBestAction(stateKey: string): RLAction {
    const qValues = this.qTable.table.get(stateKey);
    
    if (!qValues) {
      return 'hold'; // Default action
    }
    
    let bestAction: RLAction = 'hold';
    let bestValue = qValues.get('hold') || 0;
    
    for (const action of ['buy', 'sell'] as RLAction[]) {
      const value = qValues.get(action) || 0;
      if (value > bestValue) {
        bestValue = value;
        bestAction = action;
      }
    }
    
    return bestAction;
  }

  /**
   * Get Q-value for state-action pair
   */
  private getQValue(stateKey: string, action: RLAction): number {
    const qValues = this.qTable.table.get(stateKey);
    return qValues?.get(action) || 0;
  }

  /**
   * Set Q-value for state-action pair
   */
  private setQValue(stateKey: string, action: RLAction, value: number): void {
    if (!this.qTable.table.has(stateKey)) {
      this.qTable.table.set(stateKey, new Map([
        ['buy', 0],
        ['sell', 0],
        ['hold', 0],
      ]));
    }
    this.qTable.table.get(stateKey)!.set(action, value);
  }

  /**
   * Convert state to string key
   */
  private stateToKey(state: RLState): string {
    return state.vector.join(',');
  }

  /**
   * Apply filters to generate order signal
   */
  protected applyFilters(
    prediction: PredictionResult,
    marketData: MarketData,
    context: StrategyContext
  ): OrderSignal | null {
    const action = prediction.metadata?.action as RLAction;
    
    if (!action || action === 'hold') {
      return null;
    }

    // Check confidence
    if (!this.checkConfidence(prediction.confidence)) {
      return null;
    }

    // Get current price
    const orderBook = marketData.orderBook;
    const price = action === 'buy'
      ? (orderBook.getBestAsk?.() || orderBook.getBestBid?.() || 0)
      : (orderBook.getBestBid?.() || orderBook.getBestAsk?.() || 0);

    if (!price) return null;

    // Check position constraints
    const symbol = this.config.id;
    const currentPosition = context.getPosition(symbol);
    
    if (action === 'sell' && currentPosition <= 0) {
      // Update Q-value for invalid action
      this.penalizeInvalidAction();
      return null;
    }

    // Calculate quantity
    const quantity = this.config.params?.trading?.quantity ?? 10;

    // Validate cash for buy orders
    if (action === 'buy') {
      const requiredCash = price * quantity;
      if (requiredCash > context.getCash()) {
        return null;
      }
    }

    // Store portfolio value for reward calculation
    this.lastPortfolioValue = context.getCash() + 
      (currentPosition * (orderBook.getBestBid?.() || price));

    return this.createSignal(action, price, quantity, {
      confidence: prediction.confidence,
      reason: `RL Action: ${action} (Q=${prediction.metadata?.qValue?.toFixed(2)})`,
      bid: orderBook.getBestBid?.() ?? undefined,
      ask: orderBook.getBestAsk?.() ?? undefined,
    });
  }

  /**
   * Update model with experience
   */
  protected updateModel(features: FeatureVector, marketData: MarketData): void {
    if (!this.lastState || !this.lastAction) return;

    // Calculate reward
    const orderBook = marketData.orderBook;
    const currentPrice = orderBook.getBestBid?.() || orderBook.getBestAsk?.() || 0;
    
    // Get current portfolio value (simplified)
    const currentPortfolioValue = currentPrice; // Would need full context
    
    const reward = this.calculateReward(
      this.lastAction,
      this.lastPortfolioValue,
      currentPortfolioValue
    );

    // Create next state
    const nextState = this.createState(features);

    // Create experience
    const experience: RLExperience = {
      state: this.lastState,
      action: this.lastAction,
      reward,
      nextState,
      done: false,
    };

    // Add to replay buffer
    if (this.experienceReplay) {
      this.replayBuffer.push(experience);
      if (this.replayBuffer.length > this.replayBufferSize) {
        this.replayBuffer.shift();
      }
    }

    // Learn from experience
    this.learn(experience);

    // Experience replay
    if (this.experienceReplay && this.replayBuffer.length > 32) {
      this.replayLearn(32);
    }

    // Decay epsilon
    this.qTable.epsilon = Math.max(
      this.qTable.epsilonMin,
      this.qTable.epsilon * this.qTable.epsilonDecay
    );

    // Store reward
    this.rewardHistory.push({
      timestamp: Date.now(),
      action: this.lastAction,
      reward,
      portfolioValue: currentPortfolioValue,
    });
    if (this.rewardHistory.length > 1000) {
      this.rewardHistory.shift();
    }
  }

  /**
   * Learn from a single experience
   */
  private learn(experience: RLExperience): void {
    const { state, action, reward, nextState } = experience;
    
    const stateKey = this.stateToKey(state);
    const nextStateKey = this.stateToKey(nextState);
    
    // Current Q-value
    const currentQ = this.getQValue(stateKey, action);
    
    // Max Q-value for next state
    const nextBestAction = this.getBestAction(nextStateKey);
    const maxNextQ = this.getQValue(nextStateKey, nextBestAction);
    
    // Q-learning update
    const newQ = currentQ + this.qTable.alpha * (
      reward + this.qTable.gamma * maxNextQ - currentQ
    );
    
    this.setQValue(stateKey, action, newQ);
  }

  /**
   * Learn from random batch of experiences
   */
  private replayLearn(batchSize: number): void {
    const indices = new Set<number>();
    while (indices.size < Math.min(batchSize, this.replayBuffer.length)) {
      indices.add(Math.floor(Math.random() * this.replayBuffer.length));
    }
    
    for (const idx of indices) {
      this.learn(this.replayBuffer[idx]);
    }
  }

  /**
   * Calculate reward
   */
  private calculateReward(
    action: RLAction,
    prevPortfolioValue: number,
    currentPortfolioValue: number
  ): number {
    // Portfolio return
    const returns = prevPortfolioValue > 0 
      ? (currentPortfolioValue - prevPortfolioValue) / prevPortfolioValue
      : 0;

    switch (this.rewardFunction) {
      case 'returns':
        return returns;
      
      case 'sharpe':
        // Simplified Sharpe ratio (would need more history)
        return returns / (Math.abs(returns) + 0.01);
      
      case 'sortino':
        // Only penalize downside
        return returns > 0 ? returns : returns * 2;
      
      default:
        return returns;
    }
  }

  /**
   * Penalize invalid action
   */
  private penalizeInvalidAction(): void {
    if (!this.lastState) return;
    
    const stateKey = this.stateToKey(this.lastState);
    const currentQ = this.getQValue(stateKey, this.lastAction || 'hold');
    this.setQValue(stateKey, this.lastAction || 'hold', currentQ - 1);
  }

  /**
   * Get Q-table size
   */
  getQTableSize(): number {
    return this.qTable.table.size;
  }

  /**
   * Get current epsilon
   */
  getEpsilon(): number {
    return this.qTable.epsilon;
  }

  /**
   * Get action history
   */
  getActionHistory(): { action: RLAction; timestamp: number }[] {
    return [...this.actionHistory];
  }

  /**
   * Get reward history
   */
  getRewardHistory(): RewardEntry[] {
    return [...this.rewardHistory];
  }

  /**
   * Get RL statistics
   */
  getStatistics(): {
    qTableSize: number;
    epsilon: number;
    totalActions: { buy: number; sell: number; hold: number };
    avgReward: number;
    recentRewards: number[];
  } {
    const actionCounts = { buy: 0, sell: 0, hold: 0 };
    for (const entry of this.actionHistory) {
      actionCounts[entry.action]++;
    }

    const recentRewards = this.rewardHistory
      .slice(-20)
      .map(r => r.reward);

    return {
      qTableSize: this.qTable.table.size,
      epsilon: this.qTable.epsilon,
      totalActions: actionCounts,
      avgReward: recentRewards.length > 0 
        ? recentRewards.reduce((a, b) => a + b, 0) / recentRewards.length 
        : 0,
      recentRewards,
    };
  }

  /**
   * Export Q-table
   */
  exportQTable(): Record<string, Record<string, number>> {
    const exported: Record<string, Record<string, number>> = {};
    
    for (const [stateKey, actions] of this.qTable.table) {
      exported[stateKey] = {};
      for (const [action, value] of actions) {
        exported[stateKey][action] = value;
      }
    }
    
    return exported;
  }

  /**
   * Import Q-table
   */
  importQTable(data: Record<string, Record<string, number>>): void {
    this.qTable.table.clear();
    
    for (const [stateKey, actions] of Object.entries(data)) {
      const actionMap = new Map<RLAction, number>();
      for (const [action, value] of Object.entries(actions)) {
        actionMap.set(action as RLAction, value);
      }
      this.qTable.table.set(stateKey, actionMap);
    }
  }
}
