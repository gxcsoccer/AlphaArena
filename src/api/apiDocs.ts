/**
 * API Documentation - JSDoc OpenAPI Annotations
 * 
 * This file contains JSDoc annotations for all API endpoints.
 * swagger-jsdoc extracts these annotations to generate the OpenAPI specification.
 * 
 * Each endpoint is documented with @openapi tag following OpenAPI 3.0 specification.
 */

 

/**
 * @openapi
 * /health:
 *   get:
 *     summary: Health check
 *     description: Check if the API server is running
 *     operationId: healthCheck
 *     tags:
 *       - Health
 *     security: []
 *     responses:
 *       200:
 *         description: Server is healthy
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: ok
 *                 timestamp:
 *                   type: integer
 *                   example: 1710844800000
 */

/**
 * @openapi
 * /health/status:
 *   get:
 *     summary: Detailed health status
 *     description: Get detailed system health status including database, realtime, and order book status
 *     operationId: healthStatus
 *     tags:
 *       - Health
 *     responses:
 *       200:
 *         description: System status
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   enum: [healthy, degraded, unhealthy]
 *                 uptime:
 *                   type: number
 *                   description: Server uptime in seconds
 *                 version:
 *                   type: string
 *                 checks:
 *                   type: object
 *                   properties:
 *                     database:
 *                       type: boolean
 *                     realtime:
 *                       type: boolean
 *                     orderbooks:
 *                       type: integer
 */

/**
 * @openapi
 * /metrics:
 *   get:
 *     summary: System metrics
 *     description: Get system performance metrics including memory, CPU, and request statistics
 *     operationId: getMetrics
 *     tags:
 *       - Health
 *     responses:
 *       200:
 *         description: Metrics data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 memory:
 *                   type: object
 *                   properties:
 *                     used:
 *                       type: integer
 *                     total:
 *                       type: integer
 *                     percentage:
 *                       type: number
 *                 cpu:
 *                   type: object
 *                   properties:
 *                     usage:
 *                       type: number
 *                 requests:
 *                   type: object
 *                   properties:
 *                     total:
 *                       type: integer
 *                     perMinute:
 *                       type: number
 *                     avgResponseTime:
 *                       type: number
 */

/**
 * @openapi
 * /metrics/errors:
 *   get:
 *     summary: Recent errors
 *     description: Get recent system errors for debugging
 *     operationId: getErrors
 *     tags:
 *       - Health
 *     parameters:
 *       - name: limit
 *         in: query
 *         schema:
 *           type: integer
 *           default: 20
 *         description: Maximum number of errors to return
 *     responses:
 *       200:
 *         description: Error list
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 errors:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       message:
 *                         type: string
 *                       severity:
 *                         type: string
 *                         enum: [low, medium, high, critical]
 *                       timestamp:
 *                         type: string
 *                         format: date-time
 *                 bySeverity:
 *                   type: object
 *                   additionalProperties:
 *                     type: integer
 *                 total:
 *                   type: integer
 */

/**
 * @openapi
 * /api:
 *   get:
 *     summary: API information
 *     description: Get API version and available endpoints
 *     operationId: getApiInfo
 *     tags:
 *       - Health
 *     security: []
 *     responses:
 *       200:
 *         description: API information
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 name:
 *                   type: string
 *                   example: AlphaArena API
 *                 version:
 *                   type: string
 *                   example: 1.0.0
 *                 endpoints:
 *                   type: object
 *                   properties:
 *                     strategies:
 *                       type: string
 *                     trades:
 *                       type: string
 *                     portfolios:
 *                       type: string
 *                     stats:
 *                       type: string
 *                     leaderboard:
 *                       type: string
 *                 realtime:
 *                   type: string
 *                   example: Supabase Realtime
 */

/**
 * @openapi
 * /api/strategies:
 *   get:
 *     summary: List all strategies
 *     description: Retrieve a list of all trading strategies
 *     operationId: listStrategies
 *     tags:
 *       - Strategies
 *     parameters:
 *       - name: limit
 *         in: query
 *         schema:
 *           type: integer
 *           default: 50
 *       - name: offset
 *         in: query
 *         schema:
 *           type: integer
 *           default: 0
 *     responses:
 *       200:
 *         description: Successful response
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Strategy'
 */

/**
 * @openapi
 * /api/strategies/{id}:
 *   get:
 *     summary: Get strategy details
 *     description: Retrieve details for a specific strategy
 *     operationId: getStrategy
 *     tags:
 *       - Strategies
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: Strategy ID
 *     responses:
 *       200:
 *         description: Successful response
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/Strategy'
 *       404:
 *         description: Strategy not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */

/**
 * @openapi
 * /api/trades:
 *   get:
 *     summary: List all trades
 *     description: Retrieve a list of all trades with optional filtering
 *     operationId: listTrades
 *     tags:
 *       - Trades
 *     parameters:
 *       - name: strategyId
 *         in: query
 *         schema:
 *           type: string
 *         description: Filter by strategy ID
 *       - name: symbol
 *         in: query
 *         schema:
 *           type: string
 *         description: Filter by trading symbol
 *       - name: side
 *         in: query
 *         schema:
 *           type: string
 *           enum: [buy, sell]
 *         description: Filter by trade side
 *       - name: limit
 *         in: query
 *         schema:
 *           type: integer
 *           default: 100
 *       - name: offset
 *         in: query
 *         schema:
 *           type: integer
 *           default: 0
 *     responses:
 *       200:
 *         description: Successful response
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Trade'
 *                 count:
 *                   type: integer
 */

/**
 * @openapi
 * /api/trades/export:
 *   get:
 *     summary: Export trades
 *     description: Export trades to CSV format
 *     operationId: exportTrades
 *     tags:
 *       - Trades
 *     parameters:
 *       - name: strategyId
 *         in: query
 *         schema:
 *           type: string
 *       - name: symbol
 *         in: query
 *         schema:
 *           type: string
 *       - name: side
 *         in: query
 *         schema:
 *           type: string
 *           enum: [buy, sell]
 *       - name: startDate
 *         in: query
 *         schema:
 *           type: string
 *           format: date
 *       - name: endDate
 *         in: query
 *         schema:
 *           type: string
 *           format: date
 *     responses:
 *       200:
 *         description: Exported trades file
 *         content:
 *           text/csv:
 *             schema:
 *               type: string
 */

/**
 * @openapi
 * /api/portfolios:
 *   get:
 *     summary: List portfolios
 *     description: Retrieve all portfolios
 *     operationId: listPortfolios
 *     tags:
 *       - Portfolios
 *     parameters:
 *       - name: strategyId
 *         in: query
 *         schema:
 *           type: string
 *       - name: symbol
 *         in: query
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Successful response
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/Portfolio'
 */

/**
 * @openapi
 * /api/portfolios/history:
 *   get:
 *     summary: Get portfolio history
 *     description: Retrieve portfolio value history over time
 *     operationId: getPortfolioHistory
 *     tags:
 *       - Portfolios
 *     parameters:
 *       - name: strategyId
 *         in: query
 *         required: true
 *         schema:
 *           type: string
 *       - name: timeRange
 *         in: query
 *         schema:
 *           type: string
 *           enum: [1d, 1w, 1m, all]
 *           default: 1w
 *     responses:
 *       200:
 *         description: Successful response
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       timestamp:
 *                         type: string
 *                         format: date-time
 *                       value:
 *                         type: number
 *       400:
 *         description: Missing strategyId parameter
 */

/**
 * @openapi
 * /api/stats:
 *   get:
 *     summary: Get system statistics
 *     description: Retrieve aggregate statistics about strategies, trades, and volumes
 *     operationId: getStats
 *     tags:
 *       - Strategies
 *     responses:
 *       200:
 *         description: Successful response
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     totalStrategies:
 *                       type: integer
 *                     activeStrategies:
 *                       type: integer
 *                     totalTrades:
 *                       type: integer
 *                     totalVolume:
 *                       type: number
 *                     buyTrades:
 *                       type: integer
 *                     sellTrades:
 *                       type: integer
 */

/**
 * @openapi
 * /api/leaderboard:
 *   get:
 *     summary: Get leaderboard
 *     description: Retrieve the strategy leaderboard with rankings
 *     operationId: getLeaderboard
 *     tags:
 *       - Leaderboard
 *     security: []
 *     parameters:
 *       - name: sortBy
 *         in: query
 *         schema:
 *           type: string
 *           enum: [roi, winRate, profitFactor, sharpeRatio]
 *           default: roi
 *     responses:
 *       200:
 *         description: Successful response
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/LeaderboardEntry'
 *                 timestamp:
 *                   type: integer
 */

/**
 * @openapi
 * /api/leaderboard/{strategyId}:
 *   get:
 *     summary: Get strategy rank
 *     description: Get ranking information for a specific strategy
 *     operationId: getStrategyRank
 *     tags:
 *       - Leaderboard
 *     security: []
 *     parameters:
 *       - name: strategyId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Successful response
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/LeaderboardEntry'
 *       404:
 *         description: Strategy not found in leaderboard
 */

/**
 * @openapi
 * /api/leaderboard/refresh:
 *   post:
 *     summary: Refresh leaderboard
 *     description: Trigger a leaderboard recalculation
 *     operationId: refreshLeaderboard
 *     tags:
 *       - Leaderboard
 *     responses:
 *       200:
 *         description: Leaderboard refreshed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/LeaderboardEntry'
 *                 timestamp:
 *                   type: integer
 */

/**
 * @openapi
 * /api/orders:
 *   get:
 *     summary: List orders
 *     description: Retrieve all orders with optional filtering
 *     operationId: listOrders
 *     tags:
 *       - Orders
 *     parameters:
 *       - name: symbol
 *         in: query
 *         schema:
 *           type: string
 *       - name: status
 *         in: query
 *         schema:
 *           type: string
 *           enum: [pending, filled, cancelled]
 *       - name: limit
 *         in: query
 *         schema:
 *           type: integer
 *           default: 50
 *     responses:
 *       200:
 *         description: Successful response
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Order'
 *                 timestamp:
 *                   type: integer
 *   post:
 *     summary: Create a new order
 *     description: Submit a new order
 *     operationId: createOrder
 *     tags:
 *       - Orders
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - symbol
 *               - side
 *               - type
 *               - quantity
 *             properties:
 *               symbol:
 *                 type: string
 *                 example: BTCUSDT
 *               side:
 *                 type: string
 *                 enum: [buy, sell]
 *               type:
 *                 type: string
 *                 enum: [market, limit]
 *               price:
 *                 type: number
 *                 description: Required for limit orders
 *               quantity:
 *                 type: number
 *     responses:
 *       201:
 *         description: Order created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/Order'
 *                 timestamp:
 *                   type: integer
 *       400:
 *         description: Invalid request
 */

/**
 * @openapi
 * /api/orders/{orderId}/cancel:
 *   post:
 *     summary: Cancel an order
 *     description: Cancel an open order
 *     operationId: cancelOrder
 *     tags:
 *       - Orders
 *     parameters:
 *       - name: orderId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Order cancelled successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/Order'
 *                 timestamp:
 *                   type: integer
 *       400:
 *         description: Only pending orders can be cancelled
 *       404:
 *         description: Order not found
 */

/**
 * @openapi
 * /api/conditional-orders:
 *   get:
 *     summary: List conditional orders
 *     description: Retrieve all conditional orders (stop-loss, take-profit)
 *     operationId: listConditionalOrders
 *     tags:
 *       - Conditional Orders
 *     parameters:
 *       - name: symbol
 *         in: query
 *         schema:
 *           type: string
 *       - name: status
 *         in: query
 *         schema:
 *           type: string
 *           enum: [active, triggered, cancelled]
 *       - name: orderType
 *         in: query
 *         schema:
 *           type: string
 *           enum: [stop_loss, take_profit]
 *       - name: limit
 *         in: query
 *         schema:
 *           type: integer
 *           default: 50
 *     responses:
 *       200:
 *         description: Successful response
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       symbol:
 *                         type: string
 *                       side:
 *                         type: string
 *                         enum: [buy, sell]
 *                       orderType:
 *                         type: string
 *                         enum: [stop_loss, take_profit]
 *                       triggerPrice:
 *                         type: number
 *                       quantity:
 *                         type: number
 *                       status:
 *                         type: string
 *                         enum: [active, triggered, cancelled]
 *                       createdAt:
 *                         type: string
 *                         format: date-time
 *                 timestamp:
 *                   type: integer
 *   post:
 *     summary: Create conditional order
 *     description: Create a new conditional order (stop-loss, take-profit)
 *     operationId: createConditionalOrder
 *     tags:
 *       - Conditional Orders
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - symbol
 *               - side
 *               - orderType
 *               - triggerPrice
 *               - quantity
 *             properties:
 *               symbol:
 *                 type: string
 *               side:
 *                 type: string
 *                 enum: [buy, sell]
 *               orderType:
 *                 type: string
 *                 enum: [stop_loss, take_profit]
 *               triggerPrice:
 *                 type: number
 *               quantity:
 *                 type: number
 *               expiresAt:
 *                 type: string
 *                 format: date-time
 *     responses:
 *       201:
 *         description: Conditional order created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     symbol:
 *                       type: string
 *                     orderType:
 *                       type: string
 *                     triggerPrice:
 *                       type: number
 *                     quantity:
 *                       type: number
 *                     status:
 *                       type: string
 *                 timestamp:
 *                   type: integer
 *       400:
 *         description: Invalid request
 */

/**
 * @openapi
 * /api/conditional-orders/{orderId}/cancel:
 *   post:
 *     summary: Cancel conditional order
 *     description: Cancel an active conditional order
 *     operationId: cancelConditionalOrder
 *     tags:
 *       - Conditional Orders
 *     parameters:
 *       - name: orderId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Conditional order cancelled successfully
 *       400:
 *         description: Only active conditional orders can be cancelled
 *       404:
 *         description: Conditional order not found
 */

/**
 * @openapi
 * /api/conditional-orders/stats:
 *   get:
 *     summary: Get conditional order statistics
 *     description: Retrieve statistics about conditional orders
 *     operationId: getConditionalOrderStats
 *     tags:
 *       - Conditional Orders
 *     parameters:
 *       - name: strategyId
 *         in: query
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Successful response
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     total:
 *                       type: integer
 *                     active:
 *                       type: integer
 *                     triggered:
 *                       type: integer
 *                     cancelled:
 *                       type: integer
 *                 timestamp:
 *                   type: integer
 */

/**
 * @openapi
 * /api/market/tickers:
 *   get:
 *     summary: Get all market tickers
 *     description: Retrieve ticker data for all trading pairs
 *     operationId: getAllTickers
 *     tags:
 *       - Market Data
 *     security: []
 *     responses:
 *       200:
 *         description: Successful response
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Ticker'
 *                 timestamp:
 *                   type: integer
 */

/**
 * @openapi
 * /api/market/tickers/{symbol}:
 *   get:
 *     summary: Get ticker for symbol
 *     description: Retrieve ticker data for a specific trading pair
 *     operationId: getTicker
 *     tags:
 *       - Market Data
 *     security: []
 *     parameters:
 *       - name: symbol
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         example: BTCUSDT
 *     responses:
 *       200:
 *         description: Successful response
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/Ticker'
 *                 timestamp:
 *                   type: integer
 *       404:
 *         description: Ticker not found for symbol
 */

/**
 * @openapi
 * /api/market/kline/{symbol}:
 *   get:
 *     summary: Get K-line (candlestick) data
 *     description: Retrieve candlestick/OHLCV data for a trading pair
 *     operationId: getKlineData
 *     tags:
 *       - Market Data
 *     security: []
 *     parameters:
 *       - name: symbol
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         example: BTCUSDT
 *       - name: timeframe
 *         in: query
 *         schema:
 *           type: string
 *           enum: [1m, 5m, 15m, 1h, 4h, 1d]
 *           default: 1h
 *       - name: limit
 *         in: query
 *         schema:
 *           type: integer
 *           default: 1000
 *     responses:
 *       200:
 *         description: Successful response
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Candle'
 *                 timestamp:
 *                   type: integer
 */

/**
 * @openapi
 * /api/orderbook/{symbol}:
 *   get:
 *     summary: Get orderbook snapshot
 *     description: Retrieve current orderbook (bids and asks) for a trading pair
 *     operationId: getOrderbook
 *     tags:
 *       - Orderbook
 *     security: []
 *     parameters:
 *       - name: symbol
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         example: BTCUSDT
 *       - name: levels
 *         in: query
 *         schema:
 *           type: integer
 *         description: Number of price levels to return
 *     responses:
 *       200:
 *         description: Successful response
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/OrderBook'
 *                 timestamp:
 *                   type: integer
 *       404:
 *         description: Order book not found for symbol
 */

/**
 * @openapi
 * /api/orderbook/{symbol}/best:
 *   get:
 *     summary: Get best bid/ask prices
 *     description: Retrieve the best bid and ask prices for a trading pair
 *     operationId: getBestPrices
 *     tags:
 *       - Orderbook
 *     security: []
 *     parameters:
 *       - name: symbol
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         example: BTCUSDT
 *     responses:
 *       200:
 *         description: Successful response
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     bestBid:
 *                       type: number
 *                     bestAsk:
 *                       type: number
 *                     spread:
 *                       type: number
 *                 timestamp:
 *                   type: integer
 *       404:
 *         description: Order book not found for symbol
 */

/**
 * Candle schema for K-line data
 */
export interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

// This file is for JSDoc documentation only - no runtime exports needed
export default {};