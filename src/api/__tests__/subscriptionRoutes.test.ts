/**
 * Tests for Subscription Routes
 */

import request from 'supertest';
import express, { Express } from 'express';
import subscriptionRoutes from '../subscriptionRoutes';

// Mock dependencies
jest.mock('../authMiddleware', () => ({
  authMiddleware: jest.fn((req, res, next) => {
    req.user = { id: 'test-user-id', email: 'test@example.com' };
    next();
  }),
}));

jest.mock('../../services/stripeService', () => ({
  createCheckoutSession: jest.fn(),
  createCustomerPortalSession: jest.fn(),
  getCustomerByEmail: jest.fn(),
  createCustomer: jest.fn(() => 'cus_test123'),
  getPriceId: jest.fn((plan, period) => `price_${plan}_${period}`),
}));

jest.mock('../../database/subscription.dao', () => ({
  SubscriptionDAO: {
    getAllPlans: jest.fn(() => [
      { id: 'free', name: '免费版', price: 0 },
      { id: 'pro', name: '专业版', price: 99 },
      { id: 'enterprise', name: '企业版', price: 0 },
    ]),
    getPlan: jest.fn(),
    getUserSubscription: jest.fn(),
    getUserSubscriptionWithPlan: jest.fn(),
    getSubscriptionHistory: jest.fn(() => []),
    cancelSubscription: jest.fn(),
    checkFeatureAccess: jest.fn(() => true),
    checkMultipleFeatureAccesses: jest.fn(() => ({ backtests: true })),
    checkFeatureLimit: jest.fn(() => ({ allowed: true, current_usage: 0, limit: 10 })),
    getFeatureUsage: jest.fn(() => 5),
    incrementFeatureUsage: jest.fn(() => 6),
    getAllFeatureUsage: jest.fn(() => []),
    getAllFeaturePermissions: jest.fn(() => []),
    upsertSubscription: jest.fn(),
    updateExpiredSubscriptions: jest.fn(() => 0),
    getExpiringSubscriptions: jest.fn(() => []),
  },
}));

const stripeService = require('../../services/stripeService');
const { SubscriptionDAO } = require('../../database/subscription.dao');

describe('Subscription Routes', () => {
  let app: Express;

  beforeEach(() => {
    jest.clearAllMocks();
    app = express();
    app.use(express.json());
    app.use('/api/subscriptions', subscriptionRoutes);
  });

  describe('GET /api/subscriptions/plans', () => {
    it('should return all subscription plans', async () => {
      const response = await request(app).get('/api/subscriptions/plans');

      expect(response.status).toBe(200);
      expect(response.body.plans).toHaveLength(3);
    });
  });

  describe('POST /api/subscriptions/checkout', () => {
    it('should create checkout session for pro plan', async () => {
      stripeService.getCustomerByEmail.mockResolvedValue(null);
      stripeService.createCheckoutSession.mockResolvedValue('https://checkout.stripe.com/test');

      const response = await request(app)
        .post('/api/subscriptions/checkout')
        .set('Authorization', 'Bearer test-token')
        .send({
          planId: 'pro',
          billingPeriod: 'monthly',
        });

      expect(response.status).toBe(200);
      expect(response.body.checkoutUrl).toBe('https://checkout.stripe.com/test');
    });

    it('should return contact info for enterprise plan', async () => {
      const response = await request(app)
        .post('/api/subscriptions/checkout')
        .set('Authorization', 'Bearer test-token')
        .send({
          planId: 'enterprise',
          billingPeriod: 'monthly',
        });

      expect(response.status).toBe(200);
      expect(response.body.email).toBe('sales@alphaarena.com');
    });

    it('should reject invalid plan', async () => {
      const response = await request(app)
        .post('/api/subscriptions/checkout')
        .set('Authorization', 'Bearer test-token')
        .send({
          planId: 'invalid',
          billingPeriod: 'monthly',
        });

      expect(response.status).toBe(400);
    });
  });

  describe('POST /api/subscriptions/portal', () => {
    it('should create customer portal session', async () => {
      SubscriptionDAO.getUserSubscription.mockResolvedValue({
        stripeCustomerId: 'cus_test123',
      });
      stripeService.createCustomerPortalSession.mockResolvedValue('https://billing.stripe.com/test');

      const response = await request(app)
        .post('/api/subscriptions/portal')
        .set('Authorization', 'Bearer test-token');

      expect(response.status).toBe(200);
      expect(response.body.portalUrl).toBe('https://billing.stripe.com/test');
    });

    it('should return error if no active subscription', async () => {
      SubscriptionDAO.getUserSubscription.mockResolvedValue(null);

      const response = await request(app)
        .post('/api/subscriptions/portal')
        .set('Authorization', 'Bearer test-token');

      expect(response.status).toBe(400);
    });
  });

  describe('GET /api/subscriptions/current', () => {
    it('should return current user subscription', async () => {
      SubscriptionDAO.getUserSubscriptionWithPlan.mockResolvedValue({
        planId: 'pro',
        status: 'active',
      });

      const response = await request(app)
        .get('/api/subscriptions/current')
        .set('Authorization', 'Bearer test-token');

      expect(response.status).toBe(200);
    });
  });
});