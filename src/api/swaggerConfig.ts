import swaggerJsdoc from 'swagger-jsdoc';

/**
 * Swagger/OpenAPI Configuration
 * 
 * This configuration uses swagger-jsdoc to automatically generate
 * OpenAPI 3.0 specification from JSDoc comments in the codebase.
 * 
 * To add API documentation:
 * 1. Add JSDoc comments with @openapi tags to your route handlers
 * 2. The specification will be auto-generated from these comments
 * 
 * Example:
 * ```typescript
 * /**
 *  * @openapi
 *  * /api/your-endpoint:
 *  *   get:
 *  *     summary: Your endpoint description
 *  *     tags:
 *  *       - YourTag
 *  *     responses:
 *  *       200:
 *  *         description: Success
 *  *\/
 * ```
 */

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'AlphaArena Trading Platform API',
      description: `
Comprehensive API for the AlphaArena algorithmic trading platform.

## Authentication
Most API endpoints require authentication. Use one of the following methods:
- **API Key**: Include \`X-API-Key\` header with your API key
- **JWT Token**: Include \`Authorization: Bearer <token>\` header

## Rate Limits
Rate limits are based on API key permissions:
- **read**: 60 requests/minute, 10,000 requests/day
- **trade**: 120 requests/minute, 20,000 requests/day
- **admin**: 300 requests/minute, 50,000 requests/day

Rate limit headers are included in every response:
- \`X-RateLimit-Limit-Minute\`: Maximum requests per minute
- \`X-RateLimit-Remaining-Minute\`: Remaining requests this minute
- \`X-RateLimit-Limit-Day\`: Maximum requests per day
- \`X-RateLimit-Remaining-Day\`: Remaining requests today

## Error Handling
All errors follow a consistent format:
\`\`\`json
{
  "success": false,
  "error": "Error message",
  "code": "ERROR_CODE"
}
\`\`\`
      `,
      version: '1.0.0',
      contact: {
        name: 'AlphaArena Support',
        email: 'support@alphaarena.io',
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT',
      },
    },
    servers: [
      {
        url: '/api',
        description: 'Current server (relative path)',
      },
      {
        url: 'https://alphaarena-production.up.railway.app/api',
        description: 'Production server',
      },
      {
        url: 'http://localhost:3001/api',
        description: 'Development server',
      },
    ],
    tags: [
      { name: 'Health', description: 'System health and status endpoints' },
      { name: 'Authentication', description: 'User authentication and authorization' },
      { name: 'Public API', description: 'Public API for third-party developers (API Key authentication)' },
      { name: 'Strategies', description: 'Trading strategy management' },
      { name: 'Trades', description: 'Trade history and execution' },
      { name: 'Orders', description: 'Order management' },
      { name: 'Conditional Orders', description: 'Stop-loss, take-profit, and OCO orders' },
      { name: 'Portfolios', description: 'Portfolio management' },
      { name: 'Market Data', description: 'Market ticker and price data' },
      { name: 'Orderbook', description: 'Order book data' },
      { name: 'Leaderboard', description: 'Strategy performance rankings' },
      { name: 'Backtest', description: 'Strategy backtesting' },
      { name: 'Bot Management', description: 'Trading bot configuration' },
      { name: 'Bot Control', description: 'Trading bot execution control' },
      { name: 'Webhooks', description: 'Webhook configuration' },
      { name: 'API Keys', description: 'API key management' },
      { name: 'Templates', description: 'Strategy templates marketplace' },
      { name: 'Copy Trading', description: 'Copy trading features' },
      { name: 'Notifications', description: 'User notifications' },
      { name: 'Export', description: 'Data export functionality' },
      { name: 'AI', description: 'AI-powered features' },
      { name: 'Subscriptions', description: 'Subscription management' },
      { name: 'User Dashboard', description: 'User dashboard and profile' },
      { name: 'Schedules', description: 'Scheduled tasks management' },
      { name: 'Alerts', description: 'Alert management' },
    ],
    components: {
      securitySchemes: {
        ApiKeyAuth: {
          type: 'apiKey',
          in: 'header',
          name: 'X-API-Key',
          description: 'API Key for authentication (format: aa_live_xxx or aa_test_xxx)',
        },
        BearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'JWT token obtained from login/register',
        },
      },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            error: { type: 'string' },
            code: { type: 'string' },
          },
        },
        Success: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            data: { type: 'object' },
          },
        },
        Strategy: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            description: { type: 'string' },
            type: { type: 'string', enum: ['SMA', 'RSI', 'MACD', 'Bollinger', 'custom'] },
            params: { type: 'object' },
            status: { type: 'string', enum: ['active', 'paused', 'stopped'] },
            capital: { type: 'number' },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        Trade: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            strategyId: { type: 'string' },
            symbol: { type: 'string' },
            side: { type: 'string', enum: ['buy', 'sell'] },
            quantity: { type: 'number' },
            price: { type: 'number' },
            total: { type: 'number' },
            fee: { type: 'number' },
            timestamp: { type: 'string', format: 'date-time' },
          },
        },
        Portfolio: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            strategyId: { type: 'string' },
            totalValue: { type: 'number' },
            cashBalance: { type: 'number' },
            positions: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  symbol: { type: 'string' },
                  quantity: { type: 'number' },
                  averagePrice: { type: 'number' },
                  currentValue: { type: 'number' },
                },
              },
            },
            realizedPnL: { type: 'number' },
            unrealizedPnL: { type: 'number' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        Order: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            strategyId: { type: 'string' },
            symbol: { type: 'string' },
            side: { type: 'string', enum: ['buy', 'sell'] },
            type: { type: 'string', enum: ['market', 'limit', 'stop_market', 'stop_limit'] },
            quantity: { type: 'number' },
            price: { type: 'number' },
            status: { type: 'string', enum: ['open', 'filled', 'partially_filled', 'cancelled'] },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        Ticker: {
          type: 'object',
          properties: {
            symbol: { type: 'string' },
            price: { type: 'number' },
            priceChange24h: { type: 'number' },
            priceChangePercent24h: { type: 'number' },
            high24h: { type: 'number' },
            low24h: { type: 'number' },
            volume24h: { type: 'number' },
            timestamp: { type: 'integer' },
          },
        },
        OrderBook: {
          type: 'object',
          properties: {
            symbol: { type: 'string' },
            bids: {
              type: 'array',
              items: { type: 'array', items: { type: 'number' } },
              description: '[price, quantity] pairs',
            },
            asks: {
              type: 'array',
              items: { type: 'array', items: { type: 'number' } },
              description: '[price, quantity] pairs',
            },
            timestamp: { type: 'integer' },
          },
        },
        LeaderboardEntry: {
          type: 'object',
          properties: {
            rank: { type: 'integer' },
            strategyId: { type: 'string' },
            strategyName: { type: 'string' },
            totalReturn: { type: 'number' },
            winRate: { type: 'number' },
            profitFactor: { type: 'number' },
            sharpeRatio: { type: 'number' },
            maxDrawdown: { type: 'number' },
            tradeCount: { type: 'integer' },
          },
        },
        BotConfig: {
          type: 'object',
          required: ['id', 'name', 'strategy', 'tradingPair', 'interval', 'mode', 'initialCapital'],
          properties: {
            id: { type: 'string', description: 'Unique bot identifier' },
            name: { type: 'string', description: 'Bot name' },
            description: { type: 'string', description: 'Bot description' },
            strategy: {
              type: 'string',
              enum: ['SMA', 'RSI', 'MACD', 'Bollinger', 'Stochastic', 'ATR'],
              description: 'Trading strategy type',
            },
            tradingPair: {
              type: 'object',
              properties: {
                base: { type: 'string', example: 'BTC' },
                quote: { type: 'string', example: 'USDT' },
                symbol: { type: 'string', example: 'BTCUSDT' },
              },
            },
            interval: {
              type: 'string',
              enum: ['1m', '5m', '15m', '1h', '4h', '1d'],
              description: 'Time interval for strategy execution',
            },
            mode: {
              type: 'string',
              enum: ['paper', 'live'],
              description: 'Trading mode',
            },
            initialCapital: { type: 'number', description: 'Initial capital allocation' },
            enabled: { type: 'boolean', description: 'Whether bot is enabled' },
          },
        },
        BotState: {
          type: 'object',
          properties: {
            botId: { type: 'string' },
            status: { type: 'string', enum: ['stopped', 'running', 'paused', 'error'] },
            portfolioValue: { type: 'number' },
            initialCapital: { type: 'number' },
            realizedPnL: { type: 'number' },
            unrealizedPnL: { type: 'number' },
            totalPnL: { type: 'number' },
            tradeCount: { type: 'integer' },
            winCount: { type: 'integer' },
            lossCount: { type: 'integer' },
          },
        },
        User: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            email: { type: 'string', format: 'email' },
            username: { type: 'string' },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        Notification: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            type: { type: 'string', enum: ['trade', 'signal', 'alert', 'error', 'system'] },
            title: { type: 'string' },
            message: { type: 'string' },
            data: { type: 'object' },
            read: { type: 'boolean' },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
      },
    },
    security: [
      { BearerAuth: [] },
      { ApiKeyAuth: [] },
    ],
  },
  // Scan all API route files for JSDoc @openapi comments
  apis: [
    './src/api/*.ts',
    './src/api/routes/*.ts',
    './src/api/apiDocs.ts',
  ],
};

/**
 * Generate OpenAPI specification from JSDoc comments
 */
export function generateOpenApiSpec() {
  return swaggerJsdoc(options);
}

/**
 * Get OpenAPI specification as JSON
 */
export function getOpenApiJson() {
  return JSON.stringify(generateOpenApiSpec(), null, 2);
}

/**
 * Get OpenAPI specification as YAML
 * Note: YAML conversion would require yamljs, but JSON is valid for Swagger UI
 */
export function getOpenApiYaml() {
  // For YAML output, we would use YAML.stringify, but Swagger UI accepts JSON too
  return generateOpenApiSpec();
}

export default options;