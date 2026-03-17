import { EventEmitter } from 'events';
import { 
  FollowersDAO, 
  CopyTradesDAO, 
  FollowerStatsDAO,
  Follower,
  CopyTrade,
  CreateFollowerInput,
  FollowerSettings,
  CreateCopyTradeInput
} from '../database';
import { createLogger } from '../utils/logger';

const log = createLogger('CopyTradingService');

export interface TradeSignal {
  userId: string;
  symbol: string;
  side: 'buy' | 'sell';
  quantity: number;
  price: number;
  orderId?: string;
  tradeId?: string;
  timestamp: Date;
}

export interface CopyResult {
  success: boolean;
  followerId: string;
  copyTradeId?: string;
  error?: string;
}

export interface CopyTradingConfig {
  maxRetries: number;
  retryDelayMs: number;
  signalTimeoutMs: number;
}

const DEFAULT_CONFIG: CopyTradingConfig = {
  maxRetries: 3,
  retryDelayMs: 1000,
  signalTimeoutMs: 30000,
};

export class CopyTradingService extends EventEmitter {
  private followersDAO: FollowersDAO;
  private copyTradesDAO: CopyTradesDAO;
  private followerStatsDAO: FollowerStatsDAO;
  private config: CopyTradingConfig;

  constructor(config: Partial<CopyTradingConfig> = {}) {
    super();
    this.followersDAO = new FollowersDAO();
    this.copyTradesDAO = new CopyTradesDAO();
    this.followerStatsDAO = new FollowerStatsDAO();
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  async follow(input: CreateFollowerInput): Promise<Follower> {
    const isFollowing = await this.followersDAO.isFollowing(
      input.followerUserId,
      input.leaderUserId
    );

    if (isFollowing) {
      throw new Error('Already following this trader');
    }

    const follower = await this.followersDAO.create(input);
    
    log.info(`User ${input.followerUserId} started following ${input.leaderUserId}`);
    this.emit('follow', follower);

    return follower;
  }

  async unfollow(followerId: string): Promise<void> {
    const follower = await this.followersDAO.getById(followerId);
    
    if (!follower) {
      throw new Error('Follower relationship not found');
    }

    await this.followersDAO.cancel(followerId);
    
    log.info(`User ${follower.followerUserId} unfollowed ${follower.leaderUserId}`);
    this.emit('unfollow', follower);
  }

  async updateSettings(followerId: string, settings: Partial<FollowerSettings>): Promise<Follower> {
    return this.followersDAO.update(followerId, { settings });
  }

  async pause(followerId: string): Promise<Follower> {
    const follower = await this.followersDAO.pause(followerId);
    log.info(`Follower ${followerId} paused`);
    this.emit('pause', follower);
    return follower;
  }

  async resume(followerId: string): Promise<Follower> {
    const follower = await this.followersDAO.resume(followerId);
    log.info(`Follower ${followerId} resumed`);
    this.emit('resume', follower);
    return follower;
  }

  async processTradeSignal(signal: TradeSignal): Promise<CopyResult[]> {
    log.info(`Processing trade signal from ${signal.userId}: ${signal.side} ${signal.quantity} ${signal.symbol}`);

    const followers = await this.followersDAO.getActiveFollowers(signal.userId);

    if (followers.length === 0) {
      log.debug(`No active followers for user ${signal.userId}`);
      return [];
    }

    const results = await Promise.all(
      followers.map(follower => this.copyTradeForFollower(follower, signal))
    );

    return results;
  }

  private async copyTradeForFollower(follower: Follower, signal: TradeSignal): Promise<CopyResult> {
    try {
      const validation = await this.validateCopyTrade(follower, signal);
      
      if (!validation.valid) {
        log.warn(`Copy trade rejected for ${follower.followerUserId}: ${validation.reason}`);
        return {
          success: false,
          followerId: follower.id,
          error: validation.reason,
        };
      }

      const copyQuantity = this.calculateCopyQuantity(follower.settings, signal);

      if (copyQuantity <= 0) {
        return {
          success: false,
          followerId: follower.id,
          error: 'Calculated copy quantity is zero or negative',
        };
      }

      const copyTradeInput: CreateCopyTradeInput = {
        followerId: follower.id,
        originalOrderId: signal.orderId,
        leaderUserId: signal.userId,
        followerUserId: follower.followerUserId,
        symbol: signal.symbol,
        side: signal.side,
        originalQuantity: signal.quantity,
        copiedQuantity: copyQuantity,
        originalPrice: signal.price,
        signalReceivedAt: signal.timestamp,
      };

      const copyTrade = await this.copyTradesDAO.create(copyTradeInput);

      log.info(`Created copy trade ${copyTrade.id} for follower ${follower.followerUserId}`);

      this.emit('copyTradeCreated', {
        follower,
        copyTrade,
        originalSignal: signal,
      });

      return {
        success: true,
        followerId: follower.id,
        copyTradeId: copyTrade.id,
      };

    } catch (error: any) {
      log.error(`Error copying trade for follower ${follower.followerUserId}:`, error);
      return {
        success: false,
        followerId: follower.id,
        error: error.message,
      };
    }
  }

  private async validateCopyTrade(
    follower: Follower,
    signal: TradeSignal
  ): Promise<{ valid: boolean; reason?: string }> {
    const settings = follower.settings;

    if (settings.blockedSymbols.length > 0 && settings.blockedSymbols.includes(signal.symbol)) {
      return { valid: false, reason: `Symbol ${signal.symbol} is blocked` };
    }

    if (settings.allowedSymbols.length > 0 && !settings.allowedSymbols.includes(signal.symbol)) {
      return { valid: false, reason: `Symbol ${signal.symbol} is not in allowed list` };
    }

    const todayCount = await this.copyTradesDAO.getTodayCount(follower.id);
    if (todayCount >= settings.maxDailyTrades) {
      return { valid: false, reason: `Daily trade limit (${settings.maxDailyTrades}) reached` };
    }

    if (settings.maxDailyVolume) {
      const todayVolume = await this.copyTradesDAO.getTodayVolume(follower.id);
      const tradeVolume = signal.quantity * signal.price;
      
      if (todayVolume + tradeVolume > settings.maxDailyVolume) {
        return { valid: false, reason: `Daily volume limit would be exceeded` };
      }
    }

    if (settings.maxCopyAmount) {
      const copyVolume = this.calculateCopyQuantity(settings, signal) * signal.price;
      if (copyVolume > settings.maxCopyAmount) {
        return { valid: false, reason: `Trade exceeds maximum copy amount` };
      }
    }

    return { valid: true };
  }

  private calculateCopyQuantity(settings: FollowerSettings, signal: TradeSignal): number {
    switch (settings.copyMode) {
      case 'mirror':
        return signal.quantity;

      case 'fixed':
        if (settings.fixedAmount && signal.price > 0) {
          return settings.fixedAmount / signal.price;
        }
        return 0;

      case 'proportional':
      default:
        return signal.quantity * settings.copyRatio;
    }
  }

  async markCopyTradeExecuted(
    copyTradeId: string,
    executionDetails: {
      copiedPrice: number;
      price: number;
      orderId?: string;
      tradeId?: string;
      fee?: number;
      feeCurrency?: string;
    }
  ): Promise<CopyTrade> {
    const copyTrade = await this.copyTradesDAO.markFilled(copyTradeId, executionDetails);

    await this.followersDAO.incrementStats(
      copyTrade.followerId,
      executionDetails.copiedPrice * copyTrade.copiedQuantity
    );

    this.emit('copyTradeExecuted', copyTrade);
    return copyTrade;
  }

  async markCopyTradeFailed(copyTradeId: string, error: string): Promise<CopyTrade> {
    const copyTrade = await this.copyTradesDAO.markFailed(copyTradeId, error);
    this.emit('copyTradeFailed', { copyTrade, error });
    return copyTrade;
  }

  async getFollowerPerformance(followerId: string) {
    const [follower, allTimeStats, recentTrades] = await Promise.all([
      this.followersDAO.getById(followerId),
      this.followerStatsDAO.getAllTimeStats(followerId),
      this.copyTradesDAO.getByFollower(followerId, 10),
    ]);

    return {
      follower,
      allTimeStats,
      recentTrades,
    };
  }
}

let copyTradingService: CopyTradingService | null = null;

export function getCopyTradingService(config?: Partial<CopyTradingConfig>): CopyTradingService {
  if (!copyTradingService) {
    copyTradingService = new CopyTradingService(config);
  }
  return copyTradingService;
}
