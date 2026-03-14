// Database client
export { getSupabaseClient, type Database } from './client';

// DAOs
export { StrategiesDAO, type Strategy, type StrategyConfig } from './strategies.dao';
export { TradesDAO, type Trade, type TradeFilters } from './trades.dao';
export { PortfoliosDAO, type Portfolio, type PortfolioSnapshot } from './portfolios.dao';
export { PriceHistoryDAO, type PriceHistory, type PricePoint } from './price-history.dao';
export { LeaderboardDAO, type LeaderboardSnapshotRecord, type LeaderboardEntryRecord } from './leaderboard.dao';
export { ConditionalOrdersDAO, type ConditionalOrder, type ConditionalOrderFilters } from './conditional-orders.dao';

// Database manager for easy access
import { StrategiesDAO } from './strategies.dao';
import { TradesDAO } from './trades.dao';
import { PortfoliosDAO } from './portfolios.dao';
import { PriceHistoryDAO } from './price-history.dao';
import { LeaderboardDAO } from './leaderboard.dao';
import { ConditionalOrdersDAO } from './conditional-orders.dao';

export class DatabaseManager {
  private static instance: DatabaseManager;

  private _strategies: StrategiesDAO | null = null;
  private _trades: TradesDAO | null = null;
  private _portfolios: PortfoliosDAO | null = null;
  private _priceHistory: PriceHistoryDAO | null = null;
  private _leaderboard: LeaderboardDAO | null = null;
  private _conditionalOrders: ConditionalOrdersDAO | null = null;

  static getInstance(): DatabaseManager {
    if (!DatabaseManager.instance) {
      DatabaseManager.instance = new DatabaseManager();
    }
    return DatabaseManager.instance;
  }

  get strategies(): StrategiesDAO {
    if (!this._strategies) {
      this._strategies = new StrategiesDAO();
    }
    return this._strategies;
  }

  get trades(): TradesDAO {
    if (!this._trades) {
      this._trades = new TradesDAO();
    }
    return this._trades;
  }

  get portfolios(): PortfoliosDAO {
    if (!this._portfolios) {
      this._portfolios = new PortfoliosDAO();
    }
    return this._portfolios;
  }

  get priceHistory(): PriceHistoryDAO {
    if (!this._priceHistory) {
      this._priceHistory = new PriceHistoryDAO();
    }
    return this._priceHistory;
  }

  get leaderboard(): LeaderboardDAO {
    if (!this._leaderboard) {
      this._leaderboard = new LeaderboardDAO();
    }
    return this._leaderboard;
  }

  get conditionalOrders(): ConditionalOrdersDAO {
    if (!this._conditionalOrders) {
      this._conditionalOrders = new ConditionalOrdersDAO();
    }
    return this._conditionalOrders;
  }
}

export const db = DatabaseManager.getInstance();
