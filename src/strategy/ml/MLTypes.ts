/**
 * ML Strategy Types
 *
 * Type definitions for Machine Learning strategies
 */

/**
 * Feature vector - standardized input for ML models
 */
export interface FeatureVector {
  /** Feature names */
  names: string[];
  /** Feature values */
  values: number[];
  /** Timestamp when features were computed */
  timestamp: number;
}

/**
 * Feature set - multiple feature vectors
 */
export interface FeatureSet {
  /** All feature vectors */
  features: FeatureVector[];
  /** Feature metadata */
  metadata: {
    /** Total number of features */
    count: number;
    /** Normalization parameters */
    normalization?: NormalizationParams;
    /** Feature selection info */
    selectedFeatures?: string[];
  };
}

/**
 * Normalization parameters for features
 */
export interface NormalizationParams {
  /** Mean values for each feature */
  mean: number[];
  /** Standard deviation for each feature */
  std: number[];
  /** Min values for each feature */
  min?: number[];
  /** Max values for each feature */
  max?: number[];
  /** Method used */
  method: 'zscore' | 'minmax' | 'robust';
}

/**
 * ML Model interface
 */
export interface MLModel {
  /** Model ID */
  id: string;
  /** Model name */
  name: string;
  /** Model type */
  type: MLModelType;
  /** Model version */
  version: string;
  /** Creation timestamp */
  createdAt: number;
  /** Last update timestamp */
  updatedAt: number;
  /** Training metrics */
  metrics?: TrainingMetrics;
  /** Model configuration */
  config: Record<string, any>;
}

/**
 * ML Model types
 */
export type MLModelType = 
  | 'timeseries-lstm'
  | 'timeseries-transformer'
  | 'classification'
  | 'anomaly-detection'
  | 'reinforcement-learning'
  | 'regression';

/**
 * Training metrics
 */
export interface TrainingMetrics {
  /** Training loss history */
  lossHistory: number[];
  /** Validation loss history */
  validationLossHistory?: number[];
  /** Final training loss */
  finalLoss: number;
  /** Final validation loss */
  finalValidationLoss?: number;
  /** Training epochs */
  epochs: number;
  /** Accuracy (for classification) */
  accuracy?: number;
  /** Precision (for classification) */
  precision?: number;
  /** Recall (for classification) */
  recall?: number;
  /** F1 Score (for classification) */
  f1Score?: number;
  /** Mean Absolute Error (for regression) */
  mae?: number;
  /** Root Mean Square Error (for regression) */
  rmse?: number;
  /** Training duration in milliseconds */
  trainingTime: number;
}

/**
 * Model prediction result
 */
export interface PredictionResult {
  /** Predicted value(s) */
  prediction: number | number[] | number[][];
  /** Confidence score (0-1) */
  confidence: number;
  /** Prediction timestamp */
  timestamp: number;
  /** Model used for prediction */
  modelId: string;
  /** Additional metadata */
  metadata?: Record<string, any>;
}

/**
 * Classification prediction result
 */
export interface ClassificationResult extends PredictionResult {
  /** Predicted class */
  class: 'buy' | 'sell' | 'hold';
  /** Class probabilities */
  probabilities: {
    buy: number;
    sell: number;
    hold: number;
  };
}

/**
 * Anomaly detection result
 */
export interface AnomalyResult extends PredictionResult {
  /** Whether an anomaly was detected */
  isAnomaly: boolean;
  /** Anomaly score (0-1, higher = more anomalous) */
  anomalyScore: number;
  /** Anomaly type */
  anomalyType?: 'spike' | 'drop' | 'volatility' | 'pattern-break';
  /** Severity level */
  severity?: 'low' | 'medium' | 'high';
}

/**
 * Time series prediction result
 */
export interface TimeSeriesPredictionResult extends PredictionResult {
  /** Predicted values for future time steps */
  predictions: number[];
  /** Confidence intervals */
  confidenceIntervals?: {
    lower: number[];
    upper: number[];
  };
  /** Prediction horizon (number of steps) */
  horizon: number;
}

/**
 * RL Action for reinforcement learning
 */
export type RLAction = 'buy' | 'sell' | 'hold';

/**
 * RL State representation
 */
export interface RLState {
  /** State vector */
  vector: number[];
  /** State features */
  features: Record<string, number>;
  /** Timestamp */
  timestamp: number;
}

/**
 * RL Experience for training
 */
export interface RLExperience {
  /** State before action */
  state: RLState;
  /** Action taken */
  action: RLAction;
  /** Reward received */
  reward: number;
  /** Next state after action */
  nextState: RLState;
  /** Whether episode ended */
  done: boolean;
}

/**
 * Q-Table for Q-Learning
 */
export interface QTable {
  /** State-action values */
  table: Map<string, Map<RLAction, number>>;
  /** Learning rate */
  alpha: number;
  /** Discount factor */
  gamma: number;
  /** Exploration rate */
  epsilon: number;
  /** Epsilon decay rate */
  epsilonDecay: number;
  /** Minimum epsilon */
  epsilonMin: number;
}

/**
 * Model storage metadata
 */
export interface ModelMetadata {
  /** Model ID */
  id: string;
  /** Model name */
  name: string;
  /** Model type */
  type: MLModelType;
  /** Version string */
  version: string;
  /** Creation timestamp */
  createdAt: number;
  /** Last update timestamp */
  updatedAt: number;
  /** Training data info */
  trainingData?: {
    /** Number of samples */
    samples: number;
    /** Date range */
    dateRange?: {
      start: number;
      end: number;
    };
    /** Features used */
    features: string[];
  };
  /** Performance metrics */
  performance?: TrainingMetrics;
  /** Model file path */
  filePath: string;
  /** Checksum for integrity */
  checksum?: string;
}

/**
 * Feature extractor configuration
 */
export interface FeatureExtractorConfig {
  /** List of features to extract */
  features: FeatureType[];
  /** Lookback window for computing features */
  lookbackPeriod: number;
  /** Normalization method */
  normalization?: 'zscore' | 'minmax' | 'robust' | 'none';
  /** Feature selection method */
  featureSelection?: {
    method: 'variance' | 'correlation' | 'mutual-info' | 'none';
    k?: number; // Number of features to select
  };
}

/**
 * Available feature types
 */
export type FeatureType =
  | 'price'
  | 'volume'
  | 'returns'
  | 'log-returns'
  | 'sma-5'
  | 'sma-10'
  | 'sma-20'
  | 'ema-5'
  | 'ema-10'
  | 'ema-20'
  | 'rsi-14'
  | 'rsi-7'
  | 'macd'
  | 'macd-signal'
  | 'macd-histogram'
  | 'bollinger-upper'
  | 'bollinger-middle'
  | 'bollinger-lower'
  | 'bollinger-width'
  | 'atr-14'
  | 'atr-7'
  | 'volatility-20'
  | 'momentum-5'
  | 'momentum-10'
  | 'roc-5'
  | 'roc-10'
  | 'obv'
  | 'vwap'
  | 'adl'
  | 'adi'
  | 'stoch-k'
  | 'stoch-d'
  | 'williams-r'
  | 'cci'
  | 'mfi'
  | 'adx'
  | 'plus-di'
  | 'minus-di';

/**
 * ML Strategy base configuration
 */
export interface MLStrategyBaseConfig {
  /** Feature extraction configuration */
  features: FeatureExtractorConfig;
  /** Model configuration */
  model: {
    /** Model type */
    type: MLModelType;
    /** Model ID to load (if using saved model) */
    modelId?: string;
    /** Training parameters */
    training?: {
      /** Batch size */
      batchSize?: number;
      /** Number of epochs */
      epochs?: number;
      /** Learning rate */
      learningRate?: number;
      /** Validation split */
      validationSplit?: number;
    };
  };
  /** Prediction configuration */
  prediction: {
    /** Minimum confidence threshold for trading */
    minConfidence: number;
    /** Prediction horizon (for time series) */
    horizon?: number;
    /** Anomaly threshold (for anomaly detection) */
    anomalyThreshold?: number;
  };
  /** Enable online learning */
  onlineLearning?: boolean;
  /** Model update frequency (in ticks) */
  updateFrequency?: number;
}

/**
 * Market data point for ML
 */
export interface MarketDataPoint {
  /** Timestamp */
  timestamp: number;
  /** Open price */
  open: number;
  /** High price */
  high: number;
  /** Low price */
  low: number;
  /** Close price */
  close: number;
  /** Volume */
  volume: number;
}

/**
 * Training data for ML models
 */
export interface TrainingData {
  /** Input features */
  X: number[][];
  /** Target values */
  y: number[] | number[][];
  /** Feature names */
  featureNames: string[];
  /** Timestamps */
  timestamps?: number[];
}
