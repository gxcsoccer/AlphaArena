// Database client
export { getSupabaseClient, type Database } from './client';

// DAOs
export { StrategiesDAO, type Strategy, type StrategyConfig } from './strategies.dao';
export { TradesDAO, type Trade, type TradeFilters } from './trades.dao';
export { PortfoliosDAO, type Portfolio, type PortfolioSnapshot } from './portfolios.dao';
export { PriceHistoryDAO, type PriceHistory, type PricePoint } from './price-history.dao';

// Database manager for easy access
import { StrategiesDAO } from './strategies.dao';
import { TradesDAO } from './trades.dao';
import { PortfoliosDAO } from './portfolios.dao';
import { PriceHistoryDAO } from './price-history.dao';

export class DatabaseManager {
  private static instance: DatabaseManager;

  private _strategies: StrategiesDAO | null = null;
  private _trades: TradesDAO | null = null;
  private _portfolios: PortfoliosDAO | null = null;
  private _priceHistory: PriceHistoryDAO | null = null;

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
}

export const db = DatabaseManager.getInstance();
