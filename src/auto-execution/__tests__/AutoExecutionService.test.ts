/**
 * Auto Execution Service Tests
 */

import { AutoExecutionService, ExecutionSignal } from '../AutoExecutionService';
import { autoExecutionDAO } from '../auto-execution.dao';
import { SubscriptionDAO } from '../../database/subscription.dao';
import {
  AutoExecutionConfig,
  CreateAutoExecutionInput,
  DEFAULT_RISK_CONTROLS,
} from '../types';

// Mock dependencies
jest.mock('../../database/client', () => ({
  getSupabaseClient: () => ({
    auth: {
      getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'test-user' } }, error: null }),
    },
    from: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    lt: jest.fn().mockReturnThis(),
    gte: jest.fn().mockReturnThis(),
    lte: jest.fn().mockReturnThis(),
    not: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116' } }),
    maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
  }),
  getSupabaseAdminClient: () => ({
    from: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    lt: jest.fn().mockReturnThis(),
    gte: jest.fn().mockReturnThis(),
    lte: jest.fn().mockReturnThis(),
    not: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue({ data: null, error: null }),
  }),
}));

jest.mock('../../database/subscription.dao', () => ({
  SubscriptionDAO: {
    getUserSubscription: jest.fn(),
    checkFeatureAccess: jest.fn(),
  },
}));

jest.mock('../../notification', () => ({
  notificationService: {
    createSystemNotification: jest.fn().mockResolvedValue(undefined),
    createRiskNotification: jest.fn().mockResolvedValue(undefined),
  },
}));

describe('AutoExecutionService', () => {
  let service: AutoExecutionService;

  beforeEach(() => {
    service = AutoExecutionService.getInstance();
    jest.clearAllMocks();
  });

  afterEach(async () => {
    await service.stop();
  });

  describe('createConfig', () => {
    it('should reject non-VIP users', async () => {
      // Mock non-VIP user
      (SubscriptionDAO.getUserSubscription as jest.Mock).mockResolvedValue({
        id: 'sub-1',
        userId: 'test-user',
        planId: 'free',
        status: 'active',
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(),
        stripeSubscriptionId: null,
        stripeCustomerId: null,
        stripePriceId: null,
        cancelAtPeriodEnd: false,
        canceledAt: null,
        cancellationReason: null,
        trialStart: null,
        trialEnd: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const input: CreateAutoExecutionInput = {
        userId: 'test-user',
        signalSource: 'strategy',
        strategyId: 'strategy-1',
      };

      await expect(service.createConfig(input)).rejects.toThrow('VIP-exclusive');
    });

    it('should create config for VIP users', async () => {
      // Mock VIP user
      (SubscriptionDAO.getUserSubscription as jest.Mock).mockResolvedValue({
        id: 'sub-1',
        userId: 'test-user',
        planId: 'pro',
        status: 'active',
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(),
        stripeSubscriptionId: null,
        stripeCustomerId: null,
        stripePriceId: null,
        cancelAtPeriodEnd: false,
        canceledAt: null,
        cancellationReason: null,
        trialStart: null,
        trialEnd: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Mock DAO
      const mockConfig: AutoExecutionConfig = {
        id: 'config-1',
        userId: 'test-user',
        status: 'disabled',
        signalSource: 'strategy',
        strategyId: 'strategy-1',
        executionMode: 'immediate',
        defaultOrderType: 'market',
        batchIntervalMinutes: 5,
        signalThreshold: 0.7,
        tradingPairs: [],
        executionWindows: [],
        riskControls: DEFAULT_RISK_CONTROLS,
        notifyOnExecution: true,
        notifyOnError: true,
        notifyOnRiskEvent: true,
        totalExecutions: 0,
        successfulExecutions: 0,
        failedExecutions: 0,
        totalVolume: 0,
        totalPnl: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      jest.spyOn(autoExecutionDAO, 'findConfigsByUserId').mockResolvedValue([]);
      jest.spyOn(autoExecutionDAO, 'createConfig').mockResolvedValue(mockConfig);

      const input: CreateAutoExecutionInput = {
        userId: 'test-user',
        signalSource: 'strategy',
        strategyId: 'strategy-1',
      };

      const config = await service.createConfig(input);
      expect(config).toBeDefined();
      expect(config.userId).toBe('test-user');
      expect(config.signalSource).toBe('strategy');
    });
  });

  describe('enableConfig', () => {
    it('should enable config for VIP user', async () => {
      (SubscriptionDAO.getUserSubscription as jest.Mock).mockResolvedValue({
        id: 'sub-1',
        userId: 'test-user',
        planId: 'pro',
        status: 'active',
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(),
        stripeSubscriptionId: null,
        stripeCustomerId: null,
        stripePriceId: null,
        cancelAtPeriodEnd: false,
        canceledAt: null,
        cancellationReason: null,
        trialStart: null,
        trialEnd: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const mockConfig: AutoExecutionConfig = {
        id: 'config-1',
        userId: 'test-user',
        status: 'disabled',
        signalSource: 'strategy',
        strategyId: 'strategy-1',
        executionMode: 'immediate',
        defaultOrderType: 'market',
        batchIntervalMinutes: 5,
        signalThreshold: 0.7,
        tradingPairs: [],
        executionWindows: [],
        riskControls: DEFAULT_RISK_CONTROLS,
        notifyOnExecution: true,
        notifyOnError: true,
        notifyOnRiskEvent: true,
        totalExecutions: 0,
        successfulExecutions: 0,
        failedExecutions: 0,
        totalVolume: 0,
        totalPnl: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      jest.spyOn(autoExecutionDAO, 'findConfigById').mockResolvedValue(mockConfig);
      jest.spyOn(autoExecutionDAO, 'updateConfig').mockResolvedValue({
        ...mockConfig,
        status: 'enabled',
      });

      const config = await service.enableConfig('config-1', 'test-user');
      expect(config.status).toBe('enabled');
    });
  });

  describe('receiveSignal', () => {
    it('should process signal for enabled config', async () => {
      (SubscriptionDAO.getUserSubscription as jest.Mock).mockResolvedValue({
        id: 'sub-1',
        userId: 'test-user',
        planId: 'pro',
        status: 'active',
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(),
        stripeSubscriptionId: null,
        stripeCustomerId: null,
        stripePriceId: null,
        cancelAtPeriodEnd: false,
        canceledAt: null,
        cancellationReason: null,
        trialStart: null,
        trialEnd: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const mockConfig: AutoExecutionConfig = {
        id: 'config-1',
        userId: 'test-user',
        status: 'enabled',
        signalSource: 'strategy',
        strategyId: 'strategy-1',
        executionMode: 'immediate',
        defaultOrderType: 'market',
        batchIntervalMinutes: 5,
        signalThreshold: 0.7,
        tradingPairs: [
          { symbol: 'BTC/USDT', enabled: true, orderType: 'market', slippageTolerance: 0.5 },
        ],
        executionWindows: [],
        riskControls: DEFAULT_RISK_CONTROLS,
        notifyOnExecution: true,
        notifyOnError: true,
        notifyOnRiskEvent: true,
        totalExecutions: 0,
        successfulExecutions: 0,
        failedExecutions: 0,
        totalVolume: 0,
        totalPnl: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      jest.spyOn(autoExecutionDAO, 'findConfigsByUserId').mockResolvedValue([mockConfig]);
      jest.spyOn(autoExecutionDAO, 'findConfigById').mockResolvedValue(mockConfig);
      jest.spyOn(autoExecutionDAO, 'createExecutionLog').mockResolvedValue({
        id: 'log-1',
        configId: 'config-1',
        userId: 'test-user',
        signalId: 'signal-1',
        signalSource: 'strategy',
        signalSide: 'buy',
        signalPrice: 50000,
        signalQuantity: 0.1,
        signalConfidence: 0.8,
        signalTimestamp: new Date(),
        executionStatus: 'pending',
        riskCheckPassed: false,
        riskCheckReasons: [],
        receivedAt: new Date(),
        metadata: {},
        createdAt: new Date(),
      });
      jest.spyOn(autoExecutionDAO, 'updateExecutionLog').mockResolvedValue({} as any);
      jest.spyOn(autoExecutionDAO, 'getTodayExecutionCount').mockResolvedValue(0);
      jest.spyOn(autoExecutionDAO, 'getHourlyExecutionCount').mockResolvedValue(0);
      jest.spyOn(autoExecutionDAO, 'getTodayVolume').mockResolvedValue(0);
      jest.spyOn(autoExecutionDAO, 'getLastTradeTime').mockResolvedValue(null);
      jest.spyOn(autoExecutionDAO, 'getConsecutiveLossCount').mockResolvedValue(0);
      jest.spyOn(autoExecutionDAO, 'updateExecutionStats').mockResolvedValue(undefined);

      const signal: ExecutionSignal = {
        id: 'signal-1',
        source: 'strategy',
        strategyId: 'strategy-1',
        symbol: 'BTC/USDT',
        side: 'buy',
        price: 50000,
        quantity: 0.1,
        confidence: 0.8,
        timestamp: new Date(),
      };

      await service.receiveSignal('test-user', signal);

      // Verify execution log was created
      expect(autoExecutionDAO.createExecutionLog).toHaveBeenCalled();
    });
  });

  describe('risk controls', () => {
    it('should reject signal exceeding daily trade limit', async () => {
      (SubscriptionDAO.getUserSubscription as jest.Mock).mockResolvedValue({
        id: 'sub-1',
        userId: 'test-user',
        planId: 'pro',
        status: 'active',
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(),
        stripeSubscriptionId: null,
        stripeCustomerId: null,
        stripePriceId: null,
        cancelAtPeriodEnd: false,
        canceledAt: null,
        cancellationReason: null,
        trialStart: null,
        trialEnd: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const mockConfig: AutoExecutionConfig = {
        id: 'config-1',
        userId: 'test-user',
        status: 'enabled',
        signalSource: 'strategy',
        strategyId: 'strategy-1',
        executionMode: 'immediate',
        defaultOrderType: 'market',
        batchIntervalMinutes: 5,
        signalThreshold: 0.7,
        tradingPairs: [
          { symbol: 'BTC/USDT', enabled: true, orderType: 'market', slippageTolerance: 0.5 },
        ],
        executionWindows: [],
        riskControls: {
          ...DEFAULT_RISK_CONTROLS,
          maxDailyTrades: 20,
        },
        notifyOnExecution: true,
        notifyOnError: true,
        notifyOnRiskEvent: true,
        totalExecutions: 0,
        successfulExecutions: 0,
        failedExecutions: 0,
        totalVolume: 0,
        totalPnl: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      jest.spyOn(autoExecutionDAO, 'findConfigsByUserId').mockResolvedValue([mockConfig]);
      jest.spyOn(autoExecutionDAO, 'findConfigById').mockResolvedValue(mockConfig);
      jest.spyOn(autoExecutionDAO, 'createExecutionLog').mockResolvedValue({
        id: 'log-1',
        configId: 'config-1',
        userId: 'test-user',
        signalId: 'signal-1',
        signalSource: 'strategy',
        signalSide: 'buy',
        signalPrice: 50000,
        signalQuantity: 0.1,
        signalConfidence: 0.8,
        signalTimestamp: new Date(),
        executionStatus: 'pending',
        riskCheckPassed: false,
        riskCheckReasons: [],
        receivedAt: new Date(),
        metadata: {},
        createdAt: new Date(),
      });
      jest.spyOn(autoExecutionDAO, 'updateExecutionLog').mockResolvedValue({} as any);
      jest.spyOn(autoExecutionDAO, 'getTodayExecutionCount').mockResolvedValue(20); // At limit
      jest.spyOn(autoExecutionDAO, 'getHourlyExecutionCount').mockResolvedValue(0);
      jest.spyOn(autoExecutionDAO, 'getTodayVolume').mockResolvedValue(0);
      jest.spyOn(autoExecutionDAO, 'getLastTradeTime').mockResolvedValue(null);
      jest.spyOn(autoExecutionDAO, 'getConsecutiveLossCount').mockResolvedValue(0);

      const signal: ExecutionSignal = {
        id: 'signal-1',
        source: 'strategy',
        strategyId: 'strategy-1',
        symbol: 'BTC/USDT',
        side: 'buy',
        price: 50000,
        quantity: 0.1,
        confidence: 0.8,
        timestamp: new Date(),
      };

      await service.receiveSignal('test-user', signal);

      // Verify rejection was logged
      expect(autoExecutionDAO.updateExecutionLog).toHaveBeenCalledWith(
        'log-1',
        expect.objectContaining({
          executionStatus: 'rejected',
          errorCode: 'RISK_CHECK_FAILED',
        })
      );
    });

    it('should trigger circuit breaker after consecutive losses', async () => {
      (SubscriptionDAO.getUserSubscription as jest.Mock).mockResolvedValue({
        id: 'sub-1',
        userId: 'test-user',
        planId: 'pro',
        status: 'active',
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(),
        stripeSubscriptionId: null,
        stripeCustomerId: null,
        stripePriceId: null,
        cancelAtPeriodEnd: false,
        canceledAt: null,
        cancellationReason: null,
        trialStart: null,
        trialEnd: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const mockConfig: AutoExecutionConfig = {
        id: 'config-1',
        userId: 'test-user',
        status: 'enabled',
        signalSource: 'strategy',
        strategyId: 'strategy-1',
        executionMode: 'immediate',
        defaultOrderType: 'market',
        batchIntervalMinutes: 5,
        signalThreshold: 0.7,
        tradingPairs: [
          { symbol: 'BTC/USDT', enabled: true, orderType: 'market', slippageTolerance: 0.5 },
        ],
        executionWindows: [],
        riskControls: {
          ...DEFAULT_RISK_CONTROLS,
          circuitBreakerEnabled: true,
          circuitBreakerThreshold: 3,
        },
        notifyOnExecution: true,
        notifyOnError: true,
        notifyOnRiskEvent: true,
        totalExecutions: 0,
        successfulExecutions: 0,
        failedExecutions: 0,
        totalVolume: 0,
        totalPnl: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      jest.spyOn(autoExecutionDAO, 'findConfigsByUserId').mockResolvedValue([mockConfig]);
      jest.spyOn(autoExecutionDAO, 'findConfigById').mockResolvedValue(mockConfig);
      jest.spyOn(autoExecutionDAO, 'createExecutionLog').mockResolvedValue({
        id: 'log-1',
        configId: 'config-1',
        userId: 'test-user',
        signalId: 'signal-1',
        signalSource: 'strategy',
        signalSide: 'buy',
        signalPrice: 50000,
        signalQuantity: 0.1,
        signalConfidence: 0.8,
        signalTimestamp: new Date(),
        executionStatus: 'pending',
        riskCheckPassed: false,
        riskCheckReasons: [],
        receivedAt: new Date(),
        metadata: {},
        createdAt: new Date(),
      });
      jest.spyOn(autoExecutionDAO, 'updateExecutionLog').mockResolvedValue({} as any);
      jest.spyOn(autoExecutionDAO, 'getTodayExecutionCount').mockResolvedValue(0);
      jest.spyOn(autoExecutionDAO, 'getHourlyExecutionCount').mockResolvedValue(0);
      jest.spyOn(autoExecutionDAO, 'getTodayVolume').mockResolvedValue(0);
      jest.spyOn(autoExecutionDAO, 'getLastTradeTime').mockResolvedValue(null);
      jest.spyOn(autoExecutionDAO, 'getConsecutiveLossCount').mockResolvedValue(3); // At threshold
      jest.spyOn(autoExecutionDAO, 'setConfigStatus').mockResolvedValue(undefined);

      const signal: ExecutionSignal = {
        id: 'signal-1',
        source: 'strategy',
        strategyId: 'strategy-1',
        symbol: 'BTC/USDT',
        side: 'buy',
        price: 50000,
        quantity: 0.1,
        confidence: 0.8,
        timestamp: new Date(),
      };

      await service.receiveSignal('test-user', signal);

      // Verify circuit breaker was triggered
      expect(autoExecutionDAO.setConfigStatus).toHaveBeenCalledWith(
        'config-1',
        'paused',
        expect.stringContaining('Circuit breaker')
      );
    });
  });

  describe('service status', () => {
    it('should return correct status', () => {
      const status = service.getStatus();
      expect(status).toHaveProperty('isRunning');
      expect(status).toHaveProperty('pendingSignalsCount');
    });
  });
});