# AlphaArena Bot API SDK

JavaScript/TypeScript SDK for the AlphaArena Trading Bot External API.

## Installation

```bash
npm install alphaarena-bot-sdk
# or
yarn add alphaarena-bot-sdk
```

## Quick Start

```typescript
import { BotClient } from 'alphaarena-bot-sdk';

// Initialize the client
const client = new BotClient({
  baseUrl: 'https://alphaarena-production.up.railway.app/api',
  apiKey: 'aa_live_your_api_key_here',
});

// List all bots
const bots = await client.listBots();
console.log(bots.data);

// Create a new bot
const newBot = await client.createBot({
  name: 'My SMA Bot',
  strategy: 'SMA',
  tradingPair: {
    base: 'BTC',
    quote: 'USDT',
    symbol: 'BTCUSDT',
  },
  interval: '1h',
  mode: 'paper',
  initialCapital: 10000,
  strategyParams: {
    shortPeriod: 10,
    longPeriod: 20,
  },
});

if (newBot.success) {
  console.log('Bot created:', newBot.data.id);
  
  // Start the bot
  await client.startBot(newBot.data.id);
}
```

## Authentication

All API requests require an API key. You can manage your API keys through the API Key Management endpoints (requires JWT authentication).

```typescript
// Your API key should be passed in the constructor
const client = new BotClient({
  baseUrl: 'https://alphaarena-production.up.railway.app/api',
  apiKey: 'aa_live_xxxxxxxxxxxx',
});
```

## Bot Management

### List All Bots

```typescript
const result = await client.listBots();

if (result.success) {
  result.data.forEach(bot => {
    console.log(`${bot.name} (${bot.id}): ${bot.strategy}`);
  });
}
```

### Create a Bot

```typescript
const result = await client.createBot({
  name: 'RSI Strategy Bot',
  description: 'RSI-based trading bot for BTC',
  strategy: 'RSI',
  tradingPair: {
    base: 'BTC',
    quote: 'USDT',
    symbol: 'BTCUSDT',
  },
  interval: '15m',
  mode: 'paper',
  initialCapital: 5000,
  strategyParams: {
    rsiPeriod: 14,
    rsiOverbought: 70,
    rsiOversold: 30,
  },
  riskSettings: {
    stopLossPercent: 0.05,
    takeProfitPercent: 0.10,
    maxDailyLoss: 0.10,
  },
});
```

### Get Bot Details

```typescript
const result = await client.getBot('bot-123');

if (result.success) {
  const { config, state } = result.data;
  console.log('Status:', state.status);
  console.log('P&L:', state.totalPnL);
  console.log('Portfolio Value:', state.portfolioValue);
}
```

### Update Bot Configuration

```typescript
const result = await client.updateBot('bot-123', {
  name: 'Updated Bot Name',
  riskSettings: {
    stopLossPercent: 0.03,
  },
});
```

### Delete a Bot

```typescript
const result = await client.deleteBot('bot-123');
```

## Bot Control

### Start a Bot

```typescript
const result = await client.startBot('bot-123');
```

### Stop a Bot

```typescript
const result = await client.stopBot('bot-123');
```

### Pause/Resume a Bot

```typescript
// Pause a running bot
await client.pauseBot('bot-123');

// Resume a paused bot
await client.resumeBot('bot-123');
```

### Get Bot State

```typescript
const result = await client.getBotState('bot-123');

if (result.success) {
  const state = result.data;
  console.log('Status:', state.status);
  console.log('Trade Count:', state.tradeCount);
  console.log('Win Rate:', state.winCount / state.tradeCount);
}
```

### List Running Bots

```typescript
const result = await client.listRunningBots();

if (result.success) {
  console.log('Running bots:', result.data);
}
```

## Rate Limiting

The SDK tracks rate limits automatically. Check the current rate limit info:

```typescript
const rateLimit = client.getRateLimitInfo();
if (rateLimit) {
  console.log(`Remaining requests: ${rateLimit.remainingMinute}/min, ${rateLimit.remainingDay}/day`);
}
```

Rate limits by permission level:
- **read**: 60 requests/minute, 10,000 requests/day
- **trade**: 120 requests/minute, 20,000 requests/day
- **admin**: 300 requests/minute, 50,000 requests/day

## Error Handling

```typescript
const result = await client.startBot('bot-123');

if (!result.success) {
  console.error('Error:', result.error);
  console.error('Code:', result.code);
  
  // Common error codes:
  // - BOT_NOT_FOUND
  // - RATE_LIMIT_EXCEEDED
  // - INVALID_API_KEY
  // - INSUFFICIENT_PERMISSION
}
```

## TypeScript Support

The SDK is written in TypeScript and provides full type definitions:

```typescript
import {
  BotClient,
  BotConfig,
  BotState,
  CreateBotRequest,
  UpdateBotRequest,
  StrategyType,
  TradingMode,
  TimeInterval,
} from 'alphaarena-bot-sdk';
```

## Supported Strategies

| Strategy | Description | Key Parameters |
|----------|-------------|----------------|
| SMA | Simple Moving Average crossover | `shortPeriod`, `longPeriod` |
| RSI | Relative Strength Index | `rsiPeriod`, `rsiOverbought`, `rsiOversold` |
| MACD | Moving Average Convergence Divergence | `macdFastPeriod`, `macdSlowPeriod`, `macdSignalPeriod` |
| Bollinger | Bollinger Bands | `bollingerPeriod`, `bollingerStdDev` |
| Stochastic | Stochastic Oscillator | `stochasticK`, `stochasticD`, `stochasticOverbought`, `stochasticOversold` |
| ATR | Average True Range | `atrPeriod`, `atrMultiplier` |

## License

MIT
