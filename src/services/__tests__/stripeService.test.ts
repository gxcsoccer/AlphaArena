/**
 * Tests for Stripe Service
 */

import {
  getPlanIdFromPriceId,
  mapStripeStatus,
} from '../stripeService';

// Mock Stripe
jest.mock('stripe', () => {
  return jest.fn().mockImplementation(() => ({
    customers: {
      list: jest.fn(),
      create: jest.fn(),
    },
    checkout: {
      sessions: {
        create: jest.fn(),
      },
    },
    billingPortal: {
      sessions: {
        create: jest.fn(),
      },
    },
    subscriptions: {
      retrieve: jest.fn(),
      update: jest.fn(),
    },
    webhooks: {
      constructEvent: jest.fn(),
    },
  }));
});

describe('StripeService', () => {
  describe('getPlanIdFromPriceId', () => {
    it('should return "pro" for exact match "pro"', () => {
      expect(getPlanIdFromPriceId('pro')).toBe('pro');
    });

    it('should return "pro" for exact match "price_pro"', () => {
      expect(getPlanIdFromPriceId('price_pro')).toBe('pro');
    });

    it('should return "pro" for "price_pro_monthly"', () => {
      expect(getPlanIdFromPriceId('price_pro_monthly')).toBe('pro');
    });

    it('should return "pro" for "price_pro_yearly"', () => {
      expect(getPlanIdFromPriceId('price_pro_yearly')).toBe('pro');
    });

    it('should return "pro" for Stripe-style price ID', () => {
      expect(getPlanIdFromPriceId('prod_abc123_price_pro_monthly')).toBe('pro');
    });

    it('should return "enterprise" for exact match "enterprise"', () => {
      expect(getPlanIdFromPriceId('enterprise')).toBe('enterprise');
    });

    it('should return "enterprise" for "price_enterprise_monthly"', () => {
      expect(getPlanIdFromPriceId('price_enterprise_monthly')).toBe('enterprise');
    });

    it('should return "free" for exact match "free"', () => {
      expect(getPlanIdFromPriceId('free')).toBe('free');
    });

    it('should return "free" for unknown price ID', () => {
      expect(getPlanIdFromPriceId('unknown_plan')).toBe('free');
    });

    it('should return "free" for empty string', () => {
      expect(getPlanIdFromPriceId('')).toBe('free');
    });

    // Security tests - avoid false positives
    it('should NOT match "production" as "pro"', () => {
      expect(getPlanIdFromPriceId('production')).toBe('free');
    });

    it('should NOT match "process" as "pro"', () => {
      expect(getPlanIdFromPriceId('process')).toBe('free');
    });

    it('should NOT match "project" as "pro"', () => {
      expect(getPlanIdFromPriceId('project')).toBe('free');
    });

    it('should NOT match "enterpriser" as "enterprise"', () => {
      expect(getPlanIdFromPriceId('enterpriser')).toBe('free');
    });

    it('should handle case-insensitive matching', () => {
      expect(getPlanIdFromPriceId('PRICE_PRO_MONTHLY')).toBe('pro');
      expect(getPlanIdFromPriceId('Price_Pro_Yearly')).toBe('pro');
    });

    it('should handle hyphen-separated IDs', () => {
      expect(getPlanIdFromPriceId('price-pro-monthly')).toBe('pro');
      expect(getPlanIdFromPriceId('price-enterprise-yearly')).toBe('enterprise');
    });
  });

  describe('mapStripeStatus', () => {
    it('should map "active" to "active"', () => {
      expect(mapStripeStatus('active')).toBe('active');
    });

    it('should map "canceled" to "canceled"', () => {
      expect(mapStripeStatus('canceled')).toBe('canceled');
    });

    it('should map "trialing" to "trialing"', () => {
      expect(mapStripeStatus('trialing')).toBe('trialing');
    });

    it('should map "past_due" to "past_due"', () => {
      expect(mapStripeStatus('past_due')).toBe('past_due');
    });

    it('should map "incomplete" to "expired"', () => {
      expect(mapStripeStatus('incomplete')).toBe('expired');
    });

    it('should map "incomplete_expired" to "expired"', () => {
      expect(mapStripeStatus('incomplete_expired')).toBe('expired');
    });

    it('should map "unpaid" to "expired"', () => {
      expect(mapStripeStatus('unpaid')).toBe('expired');
    });

    it('should map "paused" to "past_due"', () => {
      expect(mapStripeStatus('paused')).toBe('past_due');
    });
  });

  describe('getPriceId', () => {
    const originalEnv = process.env;

    beforeEach(() => {
      jest.resetModules();
      process.env = { ...originalEnv };
    });

    afterEach(() => {
      process.env = originalEnv;
    });

    it('should return monthly price ID for monthly billing', () => {
      process.env.STRIPE_PRO_MONTHLY_PRICE_ID = 'price_test_monthly';
      process.env.STRIPE_PRO_YEARLY_PRICE_ID = 'price_test_yearly';
      
      // Re-import to get new env vars
      const { getPriceId } = require('../stripeService');
      
      expect(getPriceId('pro', 'monthly')).toBe('price_test_monthly');
    });

    it('should return yearly price ID for yearly billing', () => {
      process.env.STRIPE_PRO_MONTHLY_PRICE_ID = 'price_test_monthly';
      process.env.STRIPE_PRO_YEARLY_PRICE_ID = 'price_test_yearly';
      
      const { getPriceId } = require('../stripeService');
      
      expect(getPriceId('pro', 'yearly')).toBe('price_test_yearly');
    });

    it('should throw error for unknown plan', () => {
      const { getPriceId } = require('../stripeService');
      
      expect(() => getPriceId('unknown_plan')).toThrow('No Stripe price configured for plan: unknown_plan');
    });
  });
});
