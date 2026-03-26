/**
 * Tests for Subscription Middleware
 * VIP Subscription System - Permission Middleware Tests
 */

import { Request, Response, NextFunction } from 'express';
import {
  requirePlan,
  requireFeature,
  trackFeatureUsage,
  requireActiveSubscription,
  attachSubscription,
} from '../subscription.middleware';

// Mock the SubscriptionDAO
jest.mock('../../database/subscription.dao', () => ({
  SubscriptionDAO: {
    getUserSubscription: jest.fn(),
    checkFeatureAccess: jest.fn(),
    checkFeatureLimit: jest.fn(),
    incrementFeatureUsage: jest.fn(),
    getFeaturePermission: jest.fn(),
  },
}));

import { SubscriptionDAO } from '../../database/subscription.dao';

const mockRequest = (overrides: Partial<Request> = {}): Request => {
  return {
    user: { id: 'user-1' },
    ...overrides,
  } as Request;
};

const mockResponse = (): Response => {
  const res: Partial<Response> = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    send: jest.fn().mockReturnThis(),
  };
  return res as Response;
};

const mockNext: NextFunction = jest.fn();

describe('Subscription Middleware', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ========================================
  // requirePlan Middleware
  // ========================================
  describe('requirePlan', () => {
    it('should allow access for user with required plan', async () => {
      (SubscriptionDAO.getUserSubscription as jest.Mock).mockResolvedValue({
        planId: 'pro',
        status: 'active',
      });

      const req = mockRequest();
      const res = mockResponse();
      const middleware = requirePlan('pro');

      await middleware(req, res, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(req.subscription).toBeDefined();
    });

    it('should allow access for user with higher plan', async () => {
      (SubscriptionDAO.getUserSubscription as jest.Mock).mockResolvedValue({
        planId: 'enterprise',
        status: 'active',
      });

      const req = mockRequest();
      const res = mockResponse();
      const middleware = requirePlan('pro');

      await middleware(req, res, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should deny access for user with lower plan', async () => {
      (SubscriptionDAO.getUserSubscription as jest.Mock).mockResolvedValue({
        planId: 'free',
        status: 'active',
      });

      const req = mockRequest();
      const res = mockResponse();
      const middleware = requirePlan('pro');

      await middleware(req, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Forbidden',
        })
      );
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should deny access for unauthenticated user', async () => {
      const req = mockRequest({ user: undefined });
      const res = mockResponse();
      const middleware = requirePlan('pro');

      await middleware(req, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should default to free plan for user without subscription', async () => {
      (SubscriptionDAO.getUserSubscription as jest.Mock).mockResolvedValue(null);

      const req = mockRequest();
      const res = mockResponse();
      const middleware = requirePlan('free');

      await middleware(req, res, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should accept array of plans', async () => {
      (SubscriptionDAO.getUserSubscription as jest.Mock).mockResolvedValue({
        planId: 'pro',
        status: 'active',
      });

      const req = mockRequest();
      const res = mockResponse();
      const middleware = requirePlan(['pro', 'enterprise']);

      await middleware(req, res, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });
  });

  // ========================================
  // requireFeature Middleware
  // ========================================
  describe('requireFeature', () => {
    it('should allow access when user has feature', async () => {
      (SubscriptionDAO.checkFeatureAccess as jest.Mock).mockResolvedValue(true);

      const req = mockRequest();
      const res = mockResponse();
      const middleware = requireFeature('advanced_charts');

      await middleware(req, res, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should deny access when user lacks feature', async () => {
      (SubscriptionDAO.checkFeatureAccess as jest.Mock).mockResolvedValue(false);
      (SubscriptionDAO.getFeaturePermission as jest.Mock).mockResolvedValue({
        required_plan: 'pro',
      });

      const req = mockRequest();
      const res = mockResponse();
      const middleware = requireFeature('advanced_charts');

      await middleware(req, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should deny access for unauthenticated user', async () => {
      const req = mockRequest({ user: undefined });
      const res = mockResponse();
      const middleware = requireFeature('advanced_charts');

      await middleware(req, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  // ========================================
  // trackFeatureUsage Middleware
  // ========================================
  describe('trackFeatureUsage', () => {
    it('should allow request and increment usage on success', async () => {
      (SubscriptionDAO.checkFeatureLimit as jest.Mock).mockResolvedValue({
        allowed: true,
        limit: 10,
        current_usage: 5,
      });

      const req = mockRequest();
      const res = mockResponse();
      res.send = jest.fn().mockReturnThis();
      res.statusCode = 200;
      const middleware = trackFeatureUsage('dailyBacktests');

      await middleware(req, res, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should deny request when usage limit exceeded', async () => {
      (SubscriptionDAO.checkFeatureLimit as jest.Mock).mockResolvedValue({
        allowed: false,
        limit: 10,
        current_usage: 10,
      });

      const req = mockRequest();
      const res = mockResponse();
      const middleware = trackFeatureUsage('dailyBacktests');

      await middleware(req, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should allow unlimited usage for -1 limit', async () => {
      (SubscriptionDAO.checkFeatureLimit as jest.Mock).mockResolvedValue({
        allowed: true,
        limit: -1,
        current_usage: 1000,
      });

      const req = mockRequest();
      const res = mockResponse();
      const middleware = trackFeatureUsage('dailyBacktests');

      await middleware(req, res, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });
  });

  // ========================================
  // requireActiveSubscription Middleware
  // ========================================
  describe('requireActiveSubscription', () => {
    it('should allow access for active subscription', async () => {
      (SubscriptionDAO.getUserSubscription as jest.Mock).mockResolvedValue({
        status: 'active',
        planId: 'pro',
      });

      const req = mockRequest();
      const res = mockResponse();
      const middleware = requireActiveSubscription();

      await middleware(req, res, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(req.subscription).toBeDefined();
    });

    it('should deny access for canceled subscription', async () => {
      (SubscriptionDAO.getUserSubscription as jest.Mock).mockResolvedValue({
        status: 'canceled',
        planId: 'pro',
      });

      const req = mockRequest();
      const res = mockResponse();
      const middleware = requireActiveSubscription();

      await middleware(req, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should deny access for expired subscription', async () => {
      (SubscriptionDAO.getUserSubscription as jest.Mock).mockResolvedValue({
        status: 'expired',
        planId: 'pro',
      });

      const req = mockRequest();
      const res = mockResponse();
      const middleware = requireActiveSubscription();

      await middleware(req, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('should deny access for user without subscription', async () => {
      (SubscriptionDAO.getUserSubscription as jest.Mock).mockResolvedValue(null);

      const req = mockRequest();
      const res = mockResponse();
      const middleware = requireActiveSubscription();

      await middleware(req, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(403);
    });
  });

  // ========================================
  // attachSubscription Middleware
  // ========================================
  describe('attachSubscription', () => {
    it('should attach subscription to request', async () => {
      (SubscriptionDAO.getUserSubscription as jest.Mock).mockResolvedValue({
        planId: 'pro',
        status: 'active',
      });

      const req = mockRequest();
      const res = mockResponse();
      const middleware = attachSubscription();

      await middleware(req, res, mockNext);

      expect(req.subscription).toBeDefined();
      expect(mockNext).toHaveBeenCalled();
    });

    it('should continue without subscription if user has none', async () => {
      (SubscriptionDAO.getUserSubscription as jest.Mock).mockResolvedValue(null);

      const req = mockRequest();
      const res = mockResponse();
      const middleware = attachSubscription();

      await middleware(req, res, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should continue even on error', async () => {
      (SubscriptionDAO.getUserSubscription as jest.Mock).mockRejectedValue(
        new Error('Database error')
      );

      const req = mockRequest();
      const res = mockResponse();
      const middleware = attachSubscription();

      await middleware(req, res, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should not attach subscription for unauthenticated user', async () => {
      const req = mockRequest({ user: undefined });
      const res = mockResponse();
      const middleware = attachSubscription();

      await middleware(req, res, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });
  });
});