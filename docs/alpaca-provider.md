# Alpaca Data Provider

This provider implements the `IStockDataProvider` interface for Alpaca Market Data API, enabling real-time and historical stock market data integration with AlphaArena.

## Features

- **Real-time Data**: WebSocket-based streaming for quotes, trades, and bars
- **Historical Data**: REST API for fetching historical bar data
- **Auto Reconnection**: Automatic reconnection with exponential backoff on connection loss
- **Demo Mode**: Works without API credentials using mock data for development
- **Rate Limiting**: Built-in rate limiting to respect API limits
- **Multi-symbol Support**: Subscribe to multiple symbols simultaneously
- **Type Safety**: Full TypeScript support with comprehensive type definitions

## Installation

The provider uses the `ws` package for WebSocket connections:

```bash
npm install ws @types/ws
```

## Usage

### Basic Setup

```typescript
import { AlpacaDataProvider, DataSourceManager } from './datasource';

// Create provider instance
const alpacaProvider = new AlpacaDataProvider();

// Register with the DataSourceManager
const manager = DataSourceManager.getInstance();
manager.registerProvider(alpacaProvider, {
  providerId: 'alpaca',
  apiKey: 'your-api-key',
  apiSecret: 'your-api-secret',
  testnet: true, // Use paper trading
});

// Set as active provider
await manager.setActiveProvider('alpaca');
```

### Demo Mode (No API Key Required)

```typescript
// Without credentials, the provider runs in demo mode
await manager.setActiveProvider('alpaca');

// All data methods will return realistic mock data
const quote = await manager.getQuote('AAPL');
const bars = await manager.getBars('GOOGL', '1h', 100);
```

### Getting Real-time Quotes

```typescript
// Subscribe to real-time quote updates
const unsubscribe = manager.subscribeToQuotes('AAPL', (quote) => {
  console.log(`${quote.symbol}: ${quote.lastPrice}`);
});

// Later, unsubscribe
unsubscribe();
```

### Getting Historical Bars

```typescript
// Get last 100 1-hour bars
const bars = await manager.getBars('AAPL', '1h', 100);

// Get bars by time range
const startTime = Date.now() - 7 * 24 * 60 * 60 * 1000; // 7 days ago
const endTime = Date.now();
const bars = await manager.getBarsByRange('AAPL', '1h', startTime, endTime);
```

### Multi-symbol Subscriptions

```typescript
// Subscribe to multiple symbols at once
const symbols = ['AAPL', 'GOOGL', 'MSFT', 'TSLA'];
const unsubscribe = manager.subscribeToMultiQuotes(symbols, (quote) => {
  console.log(`${quote.symbol}: ${quote.lastPrice}`);
});
```

## Configuration Options

```typescript
interface DataSourceConfig {
  providerId: 'alpaca';
  apiKey?: string;          // Alpaca API Key
  apiSecret?: string;       // Alpaca API Secret
  testnet?: boolean;        // Use paper trading (default: true)
  endpoint?: string;        // Custom REST API endpoint
  wsEndpoint?: string;      // Custom WebSocket endpoint
  timeout?: number;         // Request timeout in ms
  rateLimit?: boolean;      // Enable rate limiting (default: true)
}
```

## Supported Data Types

### Quotes
- Real-time bid/ask prices
- Last trade price
- 24h high/low/volume

### Bars (OHLCV)
- Intervals: 1m, 3m, 5m, 15m, 30m, 1h, 2h, 4h, 6h, 12h, 1d, 3d, 1w, 1M
- Up to 10,000 bars per request

### Trades
- Individual trade executions
- Price, quantity, timestamp
- Trade side (buy/sell)

### Order Book
- Limited support (best bid/ask only for IEX data)
- Full order book not available on free tier

## API Endpoints

The provider uses Alpaca's Market Data API v2:

- **REST API**: `https://data.alpaca.markets`
- **WebSocket**: `wss://stream.data.alpaca.markets/v2/iex`

For paper trading:
- **Trading API**: `https://paper-api.alpaca.markets`

## Rate Limits

Alpaca's free tier has the following limits:
- 200 requests per minute
- WebSocket connections: 1 per account
- Symbols per WebSocket subscription: 30 recommended

The provider automatically:
- Enforces minimum 50ms between REST requests
- Reconnects with exponential backoff on disconnection
- Resubscribes to all active subscriptions after reconnection

## Error Handling

```typescript
import { DataSourceError, DataSourceErrorType } from './datasource';

try {
  const quote = await manager.getQuote('INVALID');
} catch (error) {
  if (error instanceof DataSourceError) {
    switch (error.type) {
      case DataSourceErrorType.CONNECTION_ERROR:
        console.error('Connection failed:', error.message);
        break;
      case DataSourceErrorType.RATE_LIMIT_ERROR:
        console.error('Rate limited:', error.message);
        break;
      case DataSourceErrorType.INVALID_SYMBOL:
        console.error('Invalid symbol:', error.message);
        break;
    }
  }
}
```

## Demo Credentials Detection

The provider automatically detects and bypasses validation for demo/test credentials:

Patterns recognized as demo credentials:
- `demo`, `test`, `mock`, `fake`, `example`
- `your-key`, `xxxxx`
- Any credentials matching these patterns (case-insensitive)

## Testing

Run the test suite:

```bash
npm test -- AlpacaDataProvider.test.ts
```

The tests run in demo mode without requiring real API credentials.

## Limitations

1. **Order Book**: Full order book not available on IEX (free tier)
   - Only best bid/ask provided
   - Use premium data feeds for full order book

2. **WebSocket**: Single connection per account recommended
   - Max 30 symbols per subscription
   - Reuse connection for multiple subscriptions

3. **Historical Data**: Limited to 10,000 bars per request
   - Use pagination for larger datasets

## Getting API Credentials

1. Sign up at [Alpaca Markets](https://alpaca.markets/)
2. Create a paper trading account (free)
3. Generate API keys from the dashboard
4. Use paper trading keys for development/testing

## Environment Variables

```bash
# Optional: Set credentials via environment
export ALPACA_API_KEY="your-api-key"
export ALPACA_API_SECRET="your-api-secret"
```

## License

MIT