/**
 * Database Module
 * 
 * Exports database client and DAOs for all data entities.
 */

// Database client
export { getSupabaseClient, type Database } from './client';

// DAOs
export { StrategiesDAO, type Strategy, type StrategyConfig } from './strategies.dao';
export { TradesDAO, type Trade, type TradeFilters } from './trades.dao';
export { PortfoliosDAO, type Portfolio, type PortfolioSnapshot } from './portfolios.dao';
export { PriceHistoryDAO, type PriceHistory, type PricePoint } from './price-history.dao';
export { LeaderboardDAO, type LeaderboardSnapshotRecord, type LeaderboardEntryRecord } from './leaderboard.dao';
export { ConditionalOrdersDAO, type ConditionalOrder, type ConditionalOrderFilters } from './conditional-orders.dao';
export { OCOOrdersDAO, type OCOOrder, type CreateOCOOrderInput, type OCOOrderFilters } from './oco-orders.dao';
export { RebalanceDAO, rebalanceDAO } from './rebalance.dao';
export { FollowersDAO, type Follower, type FollowerSettings, type CreateFollowerInput, type UpdateFollowerInput, type FollowerFilters, type FollowerStatus, type CopyMode } from './followers.dao';
export { CopyTradesDAO, type CopyTrade, type CreateCopyTradeInput, type CopyTradeFilters, type CopyTradeStatus } from './copy-trades.dao';
export { FollowerStatsDAO, type FollowerStatsRecord, type CreateFollowerStatsInput, type FollowerStatsFilters, type PeriodType } from './follower-stats.dao';
export { CompetitionsDAO, type Competition, type CompetitionParticipant, type CompetitionWithStats, type CreateCompetitionInput } from './competitions.dao';
export { SocialDAO, type User, type UserFollow, type UserBadge, type StrategyStats, type CreateUserInput } from './social.dao';
export { TradeJournalDAO, type TradeJournal, type CreateTradeJournalInput, type UpdateTradeJournalInput, type TradeJournalFilters, type TradeJournalStats, type TradeJournalType, type TradeJournalStatus, type EmotionType } from './trade-journal.dao';
export { StrategyTemplatesDAO, type StrategyTemplate, type TemplateRating, type TemplateUsage, type CreateTemplateInput, type TemplateFilter } from './strategyTemplates.dao';

// Signal DAOs
export { TradingSignalsDAO, type TradingSignal, type CreateSignalInput, type UpdateSignalInput, type SignalFilters, type SignalStatus, type SignalType, type RiskLevel } from './trading-signals.dao';
export { SignalSubscriptionsDAO, type SignalSubscription, type CreateSubscriptionInput, type UpdateSubscriptionInput, type SubscriptionFilters, type SubscriptionType, type SubscriptionStatus } from './signal-subscriptions.dao';
export { SignalExecutionsDAO, type SignalExecution, type CreateExecutionInput, type UpdateExecutionInput, type ExecutionFilters, type ExecutionType, type ExecutionStatus } from './signal-executions.dao';
export { SignalPublisherStatsDAO, type PublisherStats, type CreateStatsInput, type UpdateStatsInput, type StatsFilters } from './signal-publisher-stats.dao';
export { CommentsDAO, commentsDAO, StrategyComment, CommentLike, CommentReport, CreateCommentInput, UpdateCommentInput, CommentListOptions } from './comments.dao';
export { RiskMonitorDAO, riskMonitorDAO, type RiskAlert, type CreateRiskAlertInput, type UpdateRiskAlertInput, type RiskAlertHistoryEntry, type RiskHistoryEntry, type CreateRiskHistoryInput, type PositionRisk, type CreatePositionRiskInput, type CorrelationEntry, type CreateCorrelationInput, type RiskHistoryFilters, type RiskAlertFilters, type RiskMetric, type AlertOperator, type AlertChannel, type RiskPeriodType } from './risk-monitor.dao';
export * from './ai.dao.js';

// Exchange Accounts DAO
export { 
  ExchangeAccountsDAO, 
  type ExchangeAccount, 
  type AccountBalance, 
  type AccountPosition, 
  type AccountGroup,
  type UnifiedAccountSummary,
  type AccountSummaryItem,
  type UnifiedPositionSummary,
  type CreateExchangeAccountData, 
  type UpdateExchangeAccountData,
  type CreateAccountGroupData,
  type UpdateAccountGroupData,
  type ExchangeType,
  type AccountStatus,
  type AccountEnvironment
} from './exchange-accounts.dao';

// Performance Metrics DAO
export {
  PerformanceMetricsDAO,
  getPerformanceMetricsDAO,
  type PerformanceMetric,
  type CreatePerformanceMetricInput,
  type PerformanceFilters,
  type AggregatedMetrics,
  type DeviceDistribution,
  type ConnectionDistribution,
  type PerformanceAlert,
} from './performance-metrics.dao';

// Database manager for easy access
import { StrategiesDAO } from './strategies.dao';
import { TradesDAO } from './trades.dao';
import { PortfoliosDAO } from './portfolios.dao';
import { PriceHistoryDAO } from './price-history.dao';
import { LeaderboardDAO } from './leaderboard.dao';
import { ConditionalOrdersDAO } from './conditional-orders.dao';
import { OCOOrdersDAO } from './oco-orders.dao';
import { RebalanceDAO } from './rebalance.dao';
import { FollowersDAO } from './followers.dao';
import { CopyTradesDAO } from './copy-trades.dao';
import { FollowerStatsDAO } from './follower-stats.dao';
import { CompetitionsDAO } from './competitions.dao';
import { SocialDAO } from './social.dao';
import { TradeJournalDAO } from './trade-journal.dao';
import { StrategyTemplatesDAO } from './strategyTemplates.dao';
import { TradingSignalsDAO } from './trading-signals.dao';
import { SignalSubscriptionsDAO } from './signal-subscriptions.dao';
import { SignalExecutionsDAO } from './signal-executions.dao';
import { SignalPublisherStatsDAO } from './signal-publisher-stats.dao';
import { RiskMonitorDAO } from './risk-monitor.dao';
import { CommentsDAO } from './comments.dao';

export class DatabaseManager {
  private static instance: DatabaseManager;

  private _strategies: StrategiesDAO | null = null;
  private _trades: TradesDAO | null = null;
  private _portfolios: PortfoliosDAO | null = null;
  private _priceHistory: PriceHistoryDAO | null = null;
  private _leaderboard: LeaderboardDAO | null = null;
  private _conditionalOrders: ConditionalOrdersDAO | null = null;
  private _ocoOrders: OCOOrdersDAO | null = null;
  private _rebalance: RebalanceDAO | null = null;
  private _followers: FollowersDAO | null = null;
  private _copyTrades: CopyTradesDAO | null = null;
  private _followerStats: FollowerStatsDAO | null = null;
  private _competitions: CompetitionsDAO | null = null;
  private _social: SocialDAO | null = null;
  private _tradeJournal: TradeJournalDAO | null = null;
  private _strategyTemplates: StrategyTemplatesDAO | null = null;
  private _tradingSignals: TradingSignalsDAO | null = null;
  private _signalSubscriptions: SignalSubscriptionsDAO | null = null;
  private _signalExecutions: SignalExecutionsDAO | null = null;
  private _signalPublisherStats: SignalPublisherStatsDAO | null = null;
  private _riskMonitor: RiskMonitorDAO | null = null;
  private _comments: CommentsDAO | null = null;

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

  get ocoOrders(): OCOOrdersDAO {
    if (!this._ocoOrders) {
      this._ocoOrders = new OCOOrdersDAO();
    }
    return this._ocoOrders;
  }

  get rebalance(): RebalanceDAO {
    if (!this._rebalance) {
      this._rebalance = new RebalanceDAO();
    }
    return this._rebalance;
  }

  get followers(): FollowersDAO {
    if (!this._followers) {
      this._followers = new FollowersDAO();
    }
    return this._followers;
  }

  get copyTrades(): CopyTradesDAO {
    if (!this._copyTrades) {
      this._copyTrades = new CopyTradesDAO();
    }
    return this._copyTrades;
  }

  get followerStats(): FollowerStatsDAO {
    if (!this._followerStats) {
      this._followerStats = new FollowerStatsDAO();
    }
    return this._followerStats;
  }

  get competitions(): CompetitionsDAO {
    if (!this._competitions) {
      this._competitions = new CompetitionsDAO();
    }
    return this._competitions;
  }

  get social(): SocialDAO {
    if (!this._social) {
      this._social = new SocialDAO();
    }
    return this._social;
  }

  get tradeJournal(): TradeJournalDAO {
    if (!this._tradeJournal) {
      this._tradeJournal = new TradeJournalDAO();
    }
    return this._tradeJournal;
  }

  get strategyTemplates(): StrategyTemplatesDAO {
    if (!this._strategyTemplates) {
      this._strategyTemplates = new StrategyTemplatesDAO();
    }
    return this._strategyTemplates;
  }

  get tradingSignals(): TradingSignalsDAO {
    if (!this._tradingSignals) {
      this._tradingSignals = new TradingSignalsDAO();
    }
    return this._tradingSignals;
  }

  get signalSubscriptions(): SignalSubscriptionsDAO {
    if (!this._signalSubscriptions) {
      this._signalSubscriptions = new SignalSubscriptionsDAO();
    }
    return this._signalSubscriptions;
  }

  get signalExecutions(): SignalExecutionsDAO {
    if (!this._signalExecutions) {
      this._signalExecutions = new SignalExecutionsDAO();
    }
    return this._signalExecutions;
  }

  get signalPublisherStats(): SignalPublisherStatsDAO {
    if (!this._signalPublisherStats) {
      this._signalPublisherStats = new SignalPublisherStatsDAO();
    }
    return this._signalPublisherStats;
  }

  get riskMonitor(): RiskMonitorDAO {
    if (!this._riskMonitor) {
      this._riskMonitor = new RiskMonitorDAO();
    }
    return this._riskMonitor;
  }

  get comments(): CommentsDAO {
    if (!this._comments) {
      this._comments = new CommentsDAO();
    }
    return this._comments;
  }
}

export const db = DatabaseManager.getInstance();

// Subscription DAO
export { 
  SubscriptionDAO, 
  getSubscriptionDAO, 
  type SubscriptionPlan, 
  type PlanLimits,
  type UserSubscription, 
  type SubscriptionHistory,
  type FeatureUsage,
  type FeatureAccessResult,
  type UserSubscriptionStatus 
} from './subscription.dao';
export { PromoCodeDAO, getPromoCodeDAO, type PromoCode, type PromoCodeUsage, type UserTrial, type PromoCodeValidationResult, type TrialStartResult } from './promo-code.dao';

// Trading Schedules DAO
export { TradingSchedulesDAO, tradingSchedulesDAO } from './trading-schedules.dao';
export type { 
  TradingSchedule, 
  CreateScheduleInput, 
  UpdateScheduleInput, 
  ScheduleFilters, 
  ScheduleExecution,
  ScheduleSafetyConfig, 
  CreateSafetyConfigInput, 
  UpdateSafetyConfigInput, 
  ScheduleType, 
  TriggerType, 
  ConditionType 
} from './trading-schedules.dao';
export type { 
  CreateExecutionInput as ScheduleCreateExecutionInput, 
  UpdateExecutionInput as ScheduleUpdateExecutionInput, 
  ExecutionFilters as ScheduleExecutionFilters,
  ExecutionStatus as ScheduleExecutionStatus
} from './trading-schedules.dao';

// Performance Analytics DAO
export { PerformanceDAO, performanceDAO } from './performance.dao';

// Backtest-Live Integration DAO
export { BacktestLiveDAO, backtestLiveDAO } from './backtest-live.dao';

// User Tracking DAO
export { userTrackingDAO } from './user-tracking.dao';
