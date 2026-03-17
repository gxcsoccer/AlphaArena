# ML Strategy Templates

Machine Learning strategy templates for AlphaArena trading platform.

## Overview

This module provides reusable ML strategy templates that lower the barrier for creating custom ML-based trading strategies.

## Strategy Templates

### 1. Time Series Prediction Strategy

Predicts future prices using neural network models (LSTM/Transformer).

```typescript
import { TimeSeriesPredictionStrategy, TimeSeriesStrategyConfig } from './strategy/ml';

const config: TimeSeriesStrategyConfig = {
  id: 'ts-prediction',
  name: 'Time Series Prediction',
  params: {
    ml: {
      features: {
        features: ['price', 'returns', 'sma-20', 'rsi-14'],
        lookbackPeriod: 50,
        normalization: 'zscore',
      },
      model: {
        type: 'timeseries-lstm',
      },
      prediction: {
        minConfidence: 0.6,
        horizon: 5,
      },
    },
    prediction: {
      horizon: 5,
      useConfidenceIntervals: true,
      minPriceChangePercent: 0.5,
    },
  },
};

const strategy = new TimeSeriesPredictionStrategy(config);
```

### 2. Classification Strategy

Classifies market conditions as buy/sell/hold signals.

```typescript
import { ClassificationStrategy, ClassificationStrategyConfig } from './strategy/ml';

const config: ClassificationStrategyConfig = {
  id: 'classification',
  name: 'Classification Strategy',
  params: {
    ml: {
      features: {
        features: ['rsi-14', 'macd', 'returns', 'volatility-20'],
        lookbackPeriod: 30,
      },
      model: {
        type: 'classification',
      },
      prediction: {
        minConfidence: 0.6,
      },
    },
    classification: {
      minProbability: 0.6,
      enableVoting: true,
      votingWindow: 5,
    },
  },
};

const strategy = new ClassificationStrategy(config);
```

### 3. Anomaly Detection Strategy

Detects price anomalies and generates trading signals.

```typescript
import { AnomalyDetectionStrategy, AnomalyDetectionStrategyConfig } from './strategy/ml';

const config: AnomalyDetectionStrategyConfig = {
  id: 'anomaly',
  name: 'Anomaly Detection',
  params: {
    ml: {
      features: {
        features: ['price', 'volume', 'volatility-20', 'atr-14'],
        lookbackPeriod: 50,
      },
      model: {
        type: 'anomaly-detection',
      },
      prediction: {
        minConfidence: 0.7,
        anomalyThreshold: 0.8,
      },
    },
    anomaly: {
      threshold: 0.7,
      detectTypes: ['spike', 'drop', 'volatility'],
      action: 'trade',
      minSeverity: 'medium',
    },
  },
};

const strategy = new AnomalyDetectionStrategy(config);
```

### 4. Reinforcement Learning Strategy

Uses Q-Learning for trading decisions.

```typescript
import { RLStrategy, RLStrategyConfig } from './strategy/ml';

const config: RLStrategyConfig = {
  id: 'rl-strategy',
  name: 'RL Strategy',
  params: {
    ml: {
      features: {
        features: ['rsi-14', 'returns', 'macd'],
        lookbackPeriod: 20,
      },
      model: {
        type: 'reinforcement-learning',
      },
      prediction: {
        minConfidence: 0.5,
      },
      onlineLearning: true,
      updateFrequency: 100,
    },
    rl: {
      alpha: 0.1,        // Learning rate
      gamma: 0.95,       // Discount factor
      epsilon: 0.3,      // Exploration rate
      epsilonDecay: 0.995,
      epsilonMin: 0.01,
      experienceReplay: true,
    },
  },
};

const strategy = new RLStrategy(config);
```

## Feature Engineering

### Available Features

| Feature | Description |
|---------|-------------|
| `price` | Current price |
| `volume` | Current volume |
| `returns` | Price returns |
| `log-returns` | Logarithmic returns |
| `sma-5`, `sma-10`, `sma-20` | Simple Moving Averages |
| `ema-5`, `ema-10`, `ema-20` | Exponential Moving Averages |
| `rsi-7`, `rsi-14` | Relative Strength Index |
| `macd`, `macd-signal`, `macd-histogram` | MACD indicators |
| `bollinger-upper`, `bollinger-middle`, `bollinger-lower`, `bollinger-width` | Bollinger Bands |
| `atr-7`, `atr-14` | Average True Range |
| `volatility-20` | 20-period volatility |
| `momentum-5`, `momentum-10` | Momentum indicators |
| `roc-5`, `roc-10` | Rate of Change |
| `obv` | On-Balance Volume |
| `vwap` | Volume Weighted Average Price |
| `stoch-k`, `stoch-d` | Stochastic Oscillator |
| `williams-r` | Williams %R |
| `cci` | Commodity Channel Index |
| `mfi` | Money Flow Index |
| `adx`, `plus-di`, `minus-di` | Directional Movement |

### Normalization Methods

- `zscore` - Z-score normalization (default)
- `minmax` - Min-Max normalization
- `robust` - Robust normalization using MAD
- `none` - No normalization

## Model Management

### Save a Model

```typescript
const modelId = await strategy.saveModel({
  lossHistory: [0.5, 0.3, 0.1],
  finalLoss: 0.1,
  epochs: 100,
  trainingTime: 5000,
});
```

### Load a Model

```typescript
await strategy.loadModel('model-id');
```

### Model Versioning

```typescript
const manager = strategy.getModelManager();
const versions = manager.getModelVersions('model-id');
const stats = manager.getStats();
```

## Best Practices

1. **Feature Selection**: Start with a small set of features and add more based on model performance.

2. **Normalization**: Always normalize features for neural network models.

3. **Confidence Thresholds**: Set appropriate confidence thresholds to filter out low-quality signals.

4. **Backtesting**: Always backtest strategies before deploying to production.

5. **Model Monitoring**: Monitor model performance and retrain when performance degrades.

6. **Risk Management**: Use position sizing and stop-losses to manage risk.

## Architecture

```
src/strategy/ml/
├── MLTypes.ts              # Type definitions
├── FeatureExtractor.ts     # Feature engineering
├── ModelManager.ts         # Model lifecycle management
├── MLStrategy.ts           # Base class for ML strategies
├── TimeSeriesPredictionStrategy.ts  # LSTM/Transformer prediction
├── ClassificationStrategy.ts        # Buy/Sell/Hold classification
├── AnomalyDetectionStrategy.ts      # Anomaly detection
├── RLStrategy.ts                    # Reinforcement learning
└── index.ts                # Module exports
```

## Future Enhancements

- [ ] TensorFlow.js integration for browser-based inference
- [ ] ONNX.js support for model portability
- [ ] AutoML for automatic feature selection
- [ ] Ensemble strategies
- [ ] Real-time model training pipeline
