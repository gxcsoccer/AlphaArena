/**
 * AlphaArena Public API SDK (JavaScript)
 * 
 * Simple JavaScript SDK for the AlphaArena Public API
 * 
 * Usage:
 *   const { AlphaArenaClient } = require('./alphaarena-sdk');
 *   
 *   const client = new AlphaArenaClient({
 *     apiKey: 'aa_live_xxxxx',
 *     baseUrl: 'https://alphaarena-production.up.railway.app'
 *   });
 *   
 *   // Get account info
 *   const account = await client.account.getInfo();
 *   
 *   // Run a backtest
 *   const result = await client.backtest.run({
 *     symbol: 'BTC/USDT',
 *     strategy: 'sma',
 *     capital: 10000,
 *     startTime: '2024-01-01T00:00:00Z',
 *     endTime: '2024-12-31T23:59:59Z'
 *   });
 */

class AlphaArenaError extends Error {
  constructor(message, code, statusCode) {
    super(message);
    this.name = 'AlphaArenaError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

class AlphaArenaClient {
  constructor(config) {
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl || 'https://alphaarena-production.up.railway.app';
    this.timeout = config.timeout || 30000;
    
    // Initialize API modules
    this.strategies = new StrategyAPI(this);
    this.backtest = new BacktestAPI(this);
    this.account = new AccountAPI(this);
    this.leaderboard = new LeaderboardAPI(this);
  }

  async request(method, path, data = null) {
    const url = `${this.baseUrl}${path}`;
    
    const options = {
      method,
      headers: {
        'X-API-Key': this.apiKey,
        'Content-Type': 'application/json',
      },
    };

    if (data) {
      options.body = JSON.stringify(data);
    }

    const response = await fetch(url, options);
    const result = await response.json();

    if (!response.ok) {
      throw new AlphaArenaError(
        result.error || 'API request failed',
        result.code,
        response.status
      );
    }

    return result;
  }

  async getInfo() {
    return this.request('GET', '/public/v1');
  }

  async healthCheck() {
    const response = await fetch(`${this.baseUrl}/health`);
    return response.json();
  }
}

class StrategyAPI {
  constructor(client) {
    this.client = client;
  }

  async list(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.client.request('GET', `/public/v1/strategies?${query}`);
  }

  async get(id) {
    return this.client.request('GET', `/public/v1/strategies/${id}`);
  }

  async create(params) {
    return this.client.request('POST', '/public/v1/strategies', params);
  }

  async updateStatus(id, status) {
    return this.client.request('PUT', `/public/v1/strategies/${id}/status`, { status });
  }
}

class BacktestAPI {
  constructor(client) {
    this.client = client;
  }

  async run(config) {
    return this.client.request('POST', '/public/v1/backtest/run', config);
  }

  async listStrategies() {
    return this.client.request('GET', '/public/v1/backtest/strategies');
  }

  async listSymbols() {
    return this.client.request('GET', '/public/v1/backtest/symbols');
  }
}

class AccountAPI {
  constructor(client) {
    this.client = client;
  }

  async getInfo() {
    return this.client.request('GET', '/public/v1/account');
  }

  async listPositions() {
    return this.client.request('GET', '/public/v1/account/positions');
  }

  async listOrders(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.client.request('GET', `/public/v1/account/orders?${query}`);
  }

  async createOrder(params) {
    return this.client.request('POST', '/public/v1/account/orders', params);
  }

  async cancelOrder(orderId) {
    return this.client.request('POST', `/public/v1/account/orders/${orderId}/cancel`);
  }

  async listTrades(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.client.request('GET', `/public/v1/account/trades?${query}`);
  }
}

class LeaderboardAPI {
  constructor(client) {
    this.client = client;
  }

  async get(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.client.request('GET', `/public/v1/leaderboard?${query}`);
  }
}

module.exports = { AlphaArenaClient, AlphaArenaError };