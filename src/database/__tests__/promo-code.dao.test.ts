/**
 * Promo Code DAO Tests
 */

import { PromoCodeDAO } from '../promo-code.dao';

// Mock the logger
jest.mock('../../utils/logger', () => ({
  createLogger: jest.fn(() => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  })),
}));

describe('PromoCodeDAO', () => {
  describe('createPromoCode', () => {
    it('should create a promo code with valid data', async () => {
      const mockAdminClient = {
        from: jest.fn(() => ({
          insert: jest.fn(() => ({
            select: jest.fn(() => ({
              single: jest.fn(() => Promise.resolve({ 
                data: { 
                  id: 'test-id',
                  code: 'TESTCODE',
                  description: 'Test code',
                  discount_type: 'percentage',
                  discount_value: 20,
                  currency: 'CNY',
                  valid_from: new Date().toISOString(),
                  valid_until: null,
                  max_uses: null,
                  max_uses_per_user: 1,
                  current_uses: 0,
                  stripe_coupon_id: null,
                  stripe_promotion_code_id: null,
                  applicable_plans: null,
                  min_purchase_amount: null,
                  first_time_users_only: false,
                  is_active: true,
                  created_by: null,
                  metadata: {},
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                }, 
                error: null 
              })),
            })),
          })),
        })),
        rpc: jest.fn(),
      };

      const mockAnonClient = {
        from: jest.fn(),
        rpc: jest.fn(),
      };

      const dao = new PromoCodeDAO(mockAnonClient as any, mockAdminClient as any);
      const promoCode = await dao.createPromoCode({
        code: 'testcode',
        discountType: 'percentage',
        discountValue: 20,
      });

      expect(promoCode).toBeDefined();
      expect(promoCode.code).toBe('TESTCODE');
      expect(promoCode.discountType).toBe('percentage');
      expect(promoCode.discountValue).toBe(20);
    });

    it('should convert code to uppercase', async () => {
      const mockAdminClient = {
        from: jest.fn(() => ({
          insert: jest.fn((data: any) => ({
            select: jest.fn(() => ({
              single: jest.fn(() => Promise.resolve({ 
                data: { 
                  id: 'test-id',
                  code: data.code, // This will be uppercase from the DAO
                  description: 'Test code',
                  discount_type: 'fixed',
                  discount_value: 50,
                  currency: 'CNY',
                  valid_from: new Date().toISOString(),
                  valid_until: null,
                  max_uses: null,
                  max_uses_per_user: 1,
                  current_uses: 0,
                  stripe_coupon_id: null,
                  stripe_promotion_code_id: null,
                  applicable_plans: null,
                  min_purchase_amount: null,
                  first_time_users_only: false,
                  is_active: true,
                  created_by: null,
                  metadata: {},
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                }, 
                error: null 
              })),
            })),
          })),
        })),
        rpc: jest.fn(),
      };

      const mockAnonClient = {
        from: jest.fn(),
        rpc: jest.fn(),
      };

      const dao = new PromoCodeDAO(mockAnonClient as any, mockAdminClient as any);
      const promoCode = await dao.createPromoCode({
        code: 'lowercase',
        discountType: 'fixed',
        discountValue: 50,
      });

      expect(promoCode.code).toBe('LOWERCASE');
    });
  });

  describe('validatePromoCode', () => {
    it('should call RPC with correct parameters', async () => {
      const mockAdminClient = {
        from: jest.fn(),
        rpc: jest.fn(() => Promise.resolve({
          data: {
            valid: true,
            code: 'TESTCODE',
            discountType: 'percentage',
            discountValue: 20,
          },
          error: null,
        })),
      };

      const mockAnonClient = {
        from: jest.fn(),
        rpc: jest.fn(),
      };

      const dao = new PromoCodeDAO(mockAnonClient as any, mockAdminClient as any);
      const result = await dao.validatePromoCode('TESTCODE', 'user-123', 'pro', 99);

      expect(result.valid).toBe(true);
      expect(mockAdminClient.rpc).toHaveBeenCalledWith('validate_promo_code', {
        p_code: 'TESTCODE',
        p_user_id: 'user-123',
        p_plan_id: 'pro',
        p_amount: 99,
      });
    });
  });

  describe('startTrial', () => {
    it('should start a trial for a new user', async () => {
      const mockAdminClient = {
        from: jest.fn(),
        rpc: jest.fn(() => Promise.resolve({
          data: {
            success: true,
            trial: {
              planId: 'pro',
              trialStart: new Date().toISOString(),
              trialEnd: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
              trialDays: 14,
            },
          },
          error: null,
        })),
      };

      const mockAnonClient = {
        from: jest.fn(),
        rpc: jest.fn(),
      };

      const dao = new PromoCodeDAO(mockAnonClient as any, mockAdminClient as any);
      const result = await dao.startTrial('user-123', 14, 'pro');

      expect(result.success).toBe(true);
      expect(result.trial?.planId).toBe('pro');
      expect(result.trial?.trialDays).toBe(14);
    });
  });

  describe('getUserTrial', () => {
    it('should return null if no trial exists', async () => {
      const mockAnonClient = {
        from: jest.fn(() => ({
          select: jest.fn(() => ({
            eq: jest.fn(() => ({
              maybeSingle: jest.fn(() => Promise.resolve({ data: null, error: null })),
            })),
          })),
        })),
        rpc: jest.fn(),
      };

      const mockAdminClient = {
        from: jest.fn(),
        rpc: jest.fn(),
      };

      const dao = new PromoCodeDAO(mockAnonClient as any, mockAdminClient as any);
      const result = await dao.getUserTrial('user-123');

      expect(result).toBeNull();
    });
  });
});
