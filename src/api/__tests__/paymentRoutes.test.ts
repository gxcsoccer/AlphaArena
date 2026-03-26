/**
 * Payment Routes Tests
 */

import request from 'supertest';
import express, { Express } from 'express';
import paymentRoutes from '../paymentRoutes';
import { authMiddleware } from '../authMiddleware';
import * as stripeService from '../../services/stripeService';
import { SubscriptionDAO } from '../../database/subscription.dao';
import { getPaymentDAO } from '../../database/payment.dao';

// Mock dependencies
jest.mock('../authMiddleware');
jest.mock('../../services/stripeService');
jest.mock('../../database/subscription.dao');
jest.mock('../../database/payment.dao');
jest.mock('../../database/client', () => ({
  getSupabaseAdminClient: jest.fn(() => ({
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          maybeSingle: jest.fn(() => ({ data: null })),
        })),
      })),
      insert: jest.fn(() => ({})),
    })),
  })),
}));

describe('Payment Routes', () => {
  let app: Express;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/payments', paymentRoutes);
    
    // Reset mocks
    jest.clearAllMocks();
  });

  describe('POST /api/payments/webhook/stripe', () => {
    it('should verify webhook signature and return 400 if invalid', async () => {
      (stripeService.verifyWebhookSignature as jest.Mock).mockReturnValue(null);

      const response = await request(app)
        .post('/api/payments/webhook/stripe')
        .set('stripe-signature', 'invalid-signature')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Webhook signature verification failed');
    });

    it('should process valid webhook events', async () => {
      const mockEvent = {
        id: 'evt_test123',
        type: 'checkout.session.completed',
        data: {
          object: {
            id: 'cs_test123',
            client_reference_id: 'user123',
            customer: 'cus_test123',
            subscription: 'sub_test123',
            customer_email: 'test@example.com',
          },
        },
      };

      (stripeService.verifyWebhookSignature as jest.Mock).mockReturnValue(mockEvent);
      (stripeService.getSubscription as jest.Mock).mockReturnValue({
        subscriptionId: 'sub_test123',
        customerId: 'cus_test123',
        status: 'active',
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        priceId: 'price_pro_monthly',
      });
      (stripeService.getPlanIdFromPriceId as jest.Mock).mockReturnValue('pro');
      (stripeService.mapStripeStatus as jest.Mock).mockReturnValue('active');
      (SubscriptionDAO.upsertSubscription as jest.Mock).mockResolvedValue({});
      
      const mockPaymentDAO = {
        getOrCreateStripeCustomer: jest.fn().mockResolvedValue({}),
      };
      (getPaymentDAO as jest.Mock).mockReturnValue(mockPaymentDAO);

      const response = await request(app)
        .post('/api/payments/webhook/stripe')
        .set('stripe-signature', 'valid-signature')
        .send(mockEvent);

      expect(response.status).toBe(200);
      expect(response.body.received).toBe(true);
    });
  });

  describe('POST /api/payments/create-subscription', () => {
    it('should return 401 if not authenticated', async () => {
      (authMiddleware as jest.Mock).mockImplementation((req, res, next) => {
        res.status(401).json({ error: 'Unauthorized' });
      });

      const response = await request(app)
        .post('/api/payments/create-subscription')
        .send({ plan: 'pro', billingPeriod: 'monthly' });

      expect(response.status).toBe(401);
    });

    it('should return 400 for invalid plan', async () => {
      (authMiddleware as jest.Mock).mockImplementation((req: any, res, next) => {
        req.user = { id: 'user123', email: 'test@example.com' };
        next();
      });

      const response = await request(app)
        .post('/api/payments/create-subscription')
        .send({ plan: 'invalid', billingPeriod: 'monthly' });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Invalid plan');
    });

    it('should create checkout session successfully', async () => {
      (authMiddleware as jest.Mock).mockImplementation((req: any, res, next) => {
        req.user = { id: 'user123', email: 'test@example.com' };
        next();
      });

      (stripeService.getCustomerByEmail as jest.Mock).mockResolvedValue(null);
      (stripeService.createCustomer as jest.Mock).mockResolvedValue('cus_test123');
      (stripeService.createCheckoutSession as jest.Mock).mockResolvedValue(
        'https://checkout.stripe.com/test'
      );

      const response = await request(app)
        .post('/api/payments/create-subscription')
        .send({ plan: 'pro', billingPeriod: 'monthly' });

      expect(response.status).toBe(200);
      expect(response.body.checkoutUrl).toBe('https://checkout.stripe.com/test');
    });
  });

  describe('POST /api/payments/create-portal-session', () => {
    it('should return 400 if no active subscription', async () => {
      (authMiddleware as jest.Mock).mockImplementation((req: any, res, next) => {
        req.user = { id: 'user123' };
        next();
      });

      (SubscriptionDAO.getUserSubscription as jest.Mock).mockResolvedValue(null);

      const response = await request(app)
        .post('/api/payments/create-portal-session')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('No active subscription');
    });

    it('should create portal session successfully', async () => {
      (authMiddleware as jest.Mock).mockImplementation((req: any, res, next) => {
        req.user = { id: 'user123' };
        next();
      });

      (SubscriptionDAO.getUserSubscription as jest.Mock).mockResolvedValue({
        stripeCustomerId: 'cus_test123',
        stripeSubscriptionId: 'sub_test123',
      });

      (stripeService.createCustomerPortalSession as jest.Mock).mockResolvedValue(
        'https://billing.stripe.com/test'
      );

      const response = await request(app)
        .post('/api/payments/create-portal-session')
        .send({});

      expect(response.status).toBe(200);
      expect(response.body.portalUrl).toBe('https://billing.stripe.com/test');
    });
  });

  describe('POST /api/payments/cancel', () => {
    it('should cancel subscription successfully', async () => {
      (authMiddleware as jest.Mock).mockImplementation((req: any, res, next) => {
        req.user = { id: 'user123' };
        next();
      });

      (SubscriptionDAO.getUserSubscription as jest.Mock).mockResolvedValue({
        stripeSubscriptionId: 'sub_test123',
      });

      (stripeService.cancelSubscription as jest.Mock).mockResolvedValue(true);
      (SubscriptionDAO.cancelSubscription as jest.Mock).mockResolvedValue(true);

      const response = await request(app)
        .post('/api/payments/cancel')
        .send({});

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe('GET /api/payments/history', () => {
    it('should return payment history', async () => {
      (authMiddleware as jest.Mock).mockImplementation((req: any, res, next) => {
        req.user = { id: 'user123' };
        next();
      });

      const mockPaymentHistory = [
        {
          id: 'pay1',
          amount: 9.99,
          currency: 'USD',
          status: 'succeeded',
          createdAt: new Date(),
        },
      ];

      const mockPaymentDAO = {
        getPaymentHistory: jest.fn().mockResolvedValue(mockPaymentHistory),
      };
      (getPaymentDAO as jest.Mock).mockReturnValue(mockPaymentDAO);

      const response = await request(app)
        .get('/api/payments/history')
        .query({ limit: 10 });

      expect(response.status).toBe(200);
      expect(response.body.history).toBeDefined();
      expect(response.body.history).toHaveLength(1);
    });
  });
});