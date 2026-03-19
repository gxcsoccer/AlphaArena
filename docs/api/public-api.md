# AlphaArena Public API Documentation

## Overview

AlphaArena Public API provides programmatic access to the AlphaArena algorithmic trading platform. Third-party developers and advanced users can use this API to:

- Manage trading strategies
- Execute backtests
- Query account information and positions
- Submit and manage orders
- Access leaderboard data

## Base URL

```
Production: https://alphaarena-production.up.railway.app
Development: http://localhost:3001
```

## Authentication

All API requests require authentication via API Key. Include your API key in the `X-API-Key` header:

```http
X-API-Key: aa_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

### Getting an API Key

1. Log in to your AlphaArena account
2. Navigate to Settings > API Keys
3. Click "Create New API Key"
4. Choose a name and permission level
5. Save the generated key securely (it's only shown once!)

### API Key Formats

- Production keys: `aa_live_xxxxxxxxx`
- Test keys: `aa_test_xxxxxxxxx`

### Permission Levels

| Level | Description | Rate Limit |
|-------|-------------|------------|
| `read` | Read-only access to data | 60/min, 10,000/day |
| `trade` | Read + order execution | 120/min, 20,000/day |
| `admin` | Full access (admin only) | 300/min, 50,000/day |

## Rate Limiting

Rate limits are enforced per API key. Check the response headers:

```http
X-RateLimit-Limit-Minute: 60
X-RateLimit-Remaining-Minute: 58
X-RateLimit-Limit-Day: 10000
X-RateLimit-Remaining-Day: 9942
X-RateLimit-Reset-Minute: 2024-01-15T10:01:00Z
X-RateLimit-Reset-Day: 2024-01-16T00:00:00Z
```

When rate limited, you'll receive a `429 Too Many Requests` response:

```json
{
  "success": false,
  "error": "Rate limit exceeded",
  "code": "RATE_LIMIT_EXCEEDED",
  "retryAfter": "2024-01-15T10:01:00Z"
}
```

## Error Handling

All errors follow a consistent format:

```json
{
  "success": false,
  "error": "Human-readable error message",
  "code": "ERROR_CODE"
}
```

### Common Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `MISSING_API_KEY` | 401 | No X-API-Key header provided |
| `INVALID_API_KEY` | 401 | API key is invalid or revoked |
| `API_KEY_EXPIRED` | 401 | API key has expired |
| `API_KEY_INACTIVE` | 401 | API key is disabled |
| `IP_NOT_WHITELISTED` | 403 | Request IP not in whitelist |
| `ENDPOINT_NOT_ALLOWED` | 403 | Endpoint not allowed for this key |
| `INSUFFICIENT_PERMISSION` | 403 | Requires higher permission level |
| `RATE_LIMIT_EXCEEDED` | 429 | Too many requests |

---

# API Endpoints

## Public API Info

### `GET /public/v1`

Get API information and version.

**Permission:** `read`

**Response:**
```json
{
  "success": true,
  "data": {
    "version": "1.0.0",
    "endpoints": {
      "strategies": "/public/v1/strategies",
      "backtest": "/public/v1/backtest",
      "account": "/public/v1/account",
      "market": "/public/v1/market",
      "leaderboard": "/public/v1/leaderboard"
    },
    "authentication": "API Key (X-API-Key header)",
    "documentation": "/docs/api",
    "rateLimits": {
      "remaining": 58,
      "resetAt": "2024-01-15T10:01:00Z"
    }
  }
}
```

---

## Strategies

### `GET /public/v1/strategies`

List all trading strategies.

**Permission:** `read`

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `status` | string | - | Filter by status: `active`, `paused`, `stopped` |
| `limit` | integer | 50 | Max results to return |
| `offset` | integer | 0 | Offset for pagination |

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "strategy-001",
      "name": "BTC SMA Strategy",
      "description": "Simple moving average crossover",
      "symbol": "BTC/USDT",
      "status": "active",
      "config": {
        "shortPeriod": 10,
        "longPeriod": 20
      },
      "createdAt": "2024-01-01T00:00:00Z",
      "updatedAt": "2024-01-15T10:00:00Z"
    }
  ],
  "pagination": {
    "total": 1,
    "limit": 50,
    "offset": 0
  }
}
```

### `GET /public/v1/strategies/:id`

Get a specific strategy.

**Permission:** `read`

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "strategy-001",
    "name": "BTC SMA Strategy",
    "symbol": "BTC/USDT",
    "status": "active",
    "config": {},
    "createdAt": "2024-01-01T00:00:00Z",
    "updatedAt": "2024-01-15T10:00:00Z"
  }
}
```

### `POST /public/v1/strategies`

Create a new strategy.

**Permission:** `trade`

**Request Body:**
```json
{
  "name": "My Strategy",
  "symbol": "BTC/USDT",
  "description": "Strategy description",
  "config": {
    "param1": "value1"
  }
}
```

**Response:** Returns the created strategy.

### `PUT /public/v1/strategies/:id/status`

Update strategy status.

**Permission:** `trade`

**Request Body:**
```json
{
  "status": "paused"
}
```

**Response:** Returns the updated strategy.

---

## Backtest

### `GET /public/v1/backtest/strategies`

List available backtest strategies.

**Permission:** `read`

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "sma",
      "name": "SMA 均线交叉",
      "description": "简单移动平均线交叉策略"
    },
    {
      "id": "rsi",
      "name": "RSI 相对强弱指标",
      "description": "基于RSI超买超卖信号"
    }
  ]
}
```

### `GET /public/v1/backtest/symbols`

List available trading symbols.

**Permission:** `read`

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "BTC/USDT",
      "name": "Bitcoin",
      "category": "crypto"
    },
    {
      "id": "ETH/USDT",
      "name": "Ethereum",
      "category": "crypto"
    }
  ]
}
```

### `POST /public/v1/backtest/run`

Run a backtest.

**Permission:** `read`

**Request Body:**
```json
{
  "symbol": "BTC/USDT",
  "strategy": "sma",
  "capital": 10000,
  "startTime": "2024-01-01T00:00:00Z",
  "endTime": "2024-12-31T23:59:59Z",
  "params": {
    "shortPeriod": 10,
    "longPeriod": 20
  }
}
```

**Response:**
```json
{
  "success": true,
  "result": {
    "stats": {
      "totalReturn": 45.67,
      "winRate": 62.5,
      "profitFactor": 1.85,
      "maxDrawdown": -12.34,
      "sharpeRatio": 1.45,
      "totalTrades": 48,
      "winningTrades": 30,
      "losingTrades": 18
    },
    "trades": [
      {
        "timestamp": "2024-01-02T10:30:00Z",
        "side": "buy",
        "price": 42000.00,
        "quantity": 0.5,
        "pnl": null
      }
    ],
    "equity": [
      {
        "timestamp": "2024-01-01T00:00:00Z",
        "value": 10000.00
      }
    ]
  }
}
```

---

## Account

### `GET /public/v1/account`

Get account information.

**Permission:** `read`

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "account-001",
    "user_id": "user-001",
    "balance": 85432.50,
    "initial_capital": 100000.00,
    "frozen_balance": 5000.00,
    "total_realized_pnl": 15432.50,
    "total_trades": 156,
    "winning_trades": 98,
    "losing_trades": 58,
    "account_currency": "USDT",
    "is_active": true,
    "created_at": "2024-01-01T00:00:00Z",
    "updated_at": "2024-01-15T10:00:00Z"
  }
}
```

### `GET /public/v1/account/positions`

List account positions.

**Permission:** `read`

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "pos-001",
      "account_id": "account-001",
      "symbol": "BTC",
      "quantity": 1.5,
      "available_quantity": 1.5,
      "frozen_quantity": 0,
      "average_cost": 42000.00,
      "total_cost": 63000.00,
      "current_price": 43500.00,
      "market_value": 65250.00,
      "unrealized_pnl": 2250.00,
      "unrealized_pnl_pct": 3.57
    }
  ]
}
```

### `GET /public/v1/account/orders`

List orders.

**Permission:** `read`

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `status` | string | - | Filter by status |
| `symbol` | string | - | Filter by symbol |
| `limit` | integer | 50 | Max results |

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "order-001",
      "account_id": "account-001",
      "symbol": "BTC/USDT",
      "side": "buy",
      "order_type": "limit",
      "quantity": 0.5,
      "filled_quantity": 0,
      "remaining_quantity": 0.5,
      "price": 42000.00,
      "stop_price": null,
      "average_fill_price": null,
      "status": "open",
      "time_in_force": "GTC",
      "created_at": "2024-01-15T10:00:00Z",
      "updated_at": "2024-01-15T10:00:00Z"
    }
  ]
}
```

### `POST /public/v1/account/orders`

Create an order.

**Permission:** `trade`

**Request Body:**
```json
{
  "symbol": "BTC/USDT",
  "side": "buy",
  "order_type": "limit",
  "quantity": 0.5,
  "price": 42000.00,
  "time_in_force": "GTC"
}
```

**Response:** Returns the created order.

### `POST /public/v1/account/orders/:orderId/cancel`

Cancel an order.

**Permission:** `trade`

**Response:** Returns the cancelled order.

### `GET /public/v1/account/trades`

List trade history.

**Permission:** `read`

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `symbol` | string | - | Filter by symbol |
| `side` | string | - | Filter by side: `buy`, `sell` |
| `limit` | integer | 50 | Max results |

---

## Leaderboard

### `GET /public/v1/leaderboard`

Get strategy leaderboard.

**Permission:** `read`

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `sortBy` | string | `roi` | Sort by: `roi`, `winRate`, `profitFactor`, `sharpeRatio` |
| `limit` | integer | 100 | Max results |

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "rank": 1,
      "strategyId": "strategy-001",
      "strategyName": "BTC SMA Strategy",
      "totalReturn": 125.67,
      "winRate": 68.5,
      "profitFactor": 2.15,
      "sharpeRatio": 1.85,
      "maxDrawdown": -8.45,
      "tradeCount": 156
    }
  ],
  "timestamp": 1705312800000
}
```

---

# SDK Examples

## TypeScript/JavaScript

```typescript
import { AlphaArenaClient } from './alphaarena-sdk';

const client = new AlphaArenaClient({
  apiKey: 'aa_live_xxxxx',
  baseUrl: 'https://alphaarena-production.up.railway.app'
});

// Get account info
const account = await client.account.getInfo();

// Run a backtest
const result = await client.backtest.run({
  symbol: 'BTC/USDT',
  strategy: 'sma',
  capital: 10000,
  startTime: '2024-01-01T00:00:00Z',
  endTime: '2024-12-31T23:59:59Z'
});

// Create an order
const order = await client.account.createOrder({
  symbol: 'BTC/USDT',
  side: 'buy',
  order_type: 'limit',
  quantity: 0.5,
  price: 42000.00
});
```

## Python

```python
from alphaarena_sdk import AlphaArenaClient

client = AlphaArenaClient(
    api_key='aa_live_xxxxx',
    base_url='https://alphaarena-production.up.railway.app'
)

# Get account info
account = client.account.get_info()

# Run a backtest
result = client.backtest.run(
    symbol='BTC/USDT',
    strategy='sma',
    capital=10000,
    start_time='2024-01-01T00:00:00Z',
    end_time='2024-12-31T23:59:59Z'
)

# Create an order
order = client.account.create_order(
    symbol='BTC/USDT',
    side='buy',
    order_type='limit',
    quantity=0.5,
    price=42000.00
)
```

## cURL

```bash
# Get API info
curl -H "X-API-Key: aa_live_xxxxx" \
  https://alphaarena-production.up.railway.app/public/v1

# Run a backtest
curl -X POST \
  -H "X-API-Key: aa_live_xxxxx" \
  -H "Content-Type: application/json" \
  -d '{"symbol":"BTC/USDT","strategy":"sma","capital":10000,"startTime":"2024-01-01T00:00:00Z","endTime":"2024-12-31T23:59:59Z"}' \
  https://alphaarena-production.up.railway.app/public/v1/backtest/run

# Create an order
curl -X POST \
  -H "X-API-Key: aa_live_xxxxx" \
  -H "Content-Type: application/json" \
  -d '{"symbol":"BTC/USDT","side":"buy","order_type":"limit","quantity":0.5,"price":42000}' \
  https://alphaarena-production.up.railway.app/public/v1/account/orders
```

---

# Best Practices

## Security

1. **Keep your API key secret** - Never commit it to version control
2. **Use IP whitelisting** - Restrict your key to specific IP addresses
3. **Use minimum required permissions** - Choose `read` if you don't need trading
4. **Set expiration dates** - For temporary access, set keys to expire
5. **Rotate keys regularly** - Revoke old keys and create new ones periodically

## Error Handling

```typescript
import { AlphaArenaClient, RateLimitError, AuthenticationError } from './alphaarena-sdk';

try {
  const result = await client.backtest.run(config);
} catch (error) {
  if (error instanceof RateLimitError) {
    console.log(`Rate limited. Retry after: ${error.retryAfter}`);
    // Wait and retry
  } else if (error instanceof AuthenticationError) {
    console.log('Invalid API key');
    // Re-authenticate
  } else {
    console.error('API error:', error.message);
  }
}
```

## Rate Limiting

Implement exponential backoff when rate limited:

```python
import time
from alphaarena_sdk import AlphaArenaClient, AlphaArenaError

def with_retry(client, func, *args, max_retries=3, **kwargs):
    for attempt in range(max_retries):
        try:
            return func(*args, **kwargs)
        except AlphaArenaError as e:
            if e.status_code == 429 and attempt < max_retries - 1:
                wait_time = 2 ** attempt
                time.sleep(wait_time)
                continue
            raise
```

---

# Changelog

## v1.0.0 (2024-01-15)

- Initial release
- Strategy management endpoints
- Backtest execution
- Account and order management
- Leaderboard access
- TypeScript/JavaScript and Python SDKs