/**
 * Tests for Anti-Fraud Service
 */

import { AntiFraudService, getAntiFraudService } from '../AntiFraudService';

// Mock Supabase client
jest.mock('../../../database/client', () => ({
  getSupabaseAdminClient: jest.fn(() => ({
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        data: [],
        error: null,
        maybeSingle: jest.fn(() => ({
          data: null,
          error: null,
        })),
        eq: jest.fn(() => ({
          data: [],
          error: null,
          maybeSingle: jest.fn(() => ({
            data: null,
            error: null,
          })),
          order: jest.fn(() => ({
            limit: jest.fn(() => ({
              data: [],
              error: null,
            })),
          })),
        })),
        order: jest.fn(() => ({
          limit: jest.fn(() => ({
            data: [],
            error: null,
          })),
        })),
      })),
      insert: jest.fn(() => ({
        select: jest.fn(() => ({
          single: jest.fn(() => ({
            data: {
              id: 'flag-id',
              referral_id: 'referral-id',
              flag_type: 'self_referral',
              severity: 'critical',
              details: {},
              risk_score: 100,
              resolved: false,
              created_at: new Date().toISOString(),
            },
            error: null,
          })),
        })),
      })),
      update: jest.fn(() => ({
        eq: jest.fn(() => ({
          error: null,
        })),
      })),
    })),
    rpc: jest.fn(),
  })),
}));

describe('AntiFraudService', () => {
  let service: AntiFraudService;

  beforeEach(() => {
    service = new AntiFraudService();
    jest.clearAllMocks();
  });

  describe('checkForFraud', () => {
    it('should detect self-referral as critical fraud', async () => {
      const result = await service.checkForFraud({
        referrerUserId: 'user-1',
        inviteeUserId: 'user-1', // Same user
      });

      expect(result.isFraud).toBe(true);
      expect(result.riskScore).toBeGreaterThanOrEqual(80);
      expect(result.recommendation).toBe('block');
      expect(result.flags.some(f => f.type === 'self_referral')).toBe(true);
    });

    it('should detect same device fraud', async () => {
      // Mock device history
      jest.spyOn(service as any, 'gatherFraudHistory').mockResolvedValue({
        referrerReferrals: [
          {
            id: 'ref-1',
            status: 'registered',
            invitee_user_id: 'user-2',
            invitee_device_fingerprint: 'device-123',
            invitee_ip_address: '192.168.1.1',
            invited_at: new Date().toISOString(),
            registered_at: new Date().toISOString(),
          },
        ],
        deviceHistory: [],
        ipHistory: [],
        userHistory: [],
      });

      const result = await service.checkForFraud({
        referrerUserId: 'user-1',
        inviteeUserId: 'user-3',
        deviceFingerprint: 'device-123', // Same device as previous referral
      });

      expect(result.flags.some(f => f.type === 'same_device')).toBe(true);
    });

    it('should detect rapid registration pattern', async () => {
      // Mock many recent referrals
      const recentReferrals = Array(6).fill(null).map((_, i) => ({
        id: `ref-${i}`,
        status: 'registered',
        invitee_user_id: `user-${i}`,
        invitee_device_fingerprint: `device-${i}`,
        invitee_ip_address: '192.168.1.1',
        invited_at: new Date(Date.now() - 30 * 60 * 1000).toISOString(), // 30 min ago
        registered_at: new Date().toISOString(),
      }));

      jest.spyOn(service as any, 'gatherFraudHistory').mockResolvedValue({
        referrerReferrals: recentReferrals,
        deviceHistory: [],
        ipHistory: [],
        userHistory: [],
      });

      const result = await service.checkForFraud({
        referrerUserId: 'user-1',
        inviteeUserId: 'user-new',
      });

      expect(result.flags.some(f => f.type === 'rapid_registration')).toBe(true);
      expect(result.riskScore).toBeGreaterThan(50);
    });

    it('should detect temporary email domains', async () => {
      jest.spyOn(service as any, 'gatherFraudHistory').mockResolvedValue({
        referrerReferrals: [],
        deviceHistory: [],
        ipHistory: [],
        userHistory: [],
      });

      const result = await service.checkForFraud({
        referrerUserId: 'user-1',
        inviteeUserId: 'user-2',
        email: 'test@tempmail.com',
      });

      expect(result.flags.some(f => f.type === 'suspicious_pattern')).toBe(true);
      expect(result.flags.some(f => f.severity === 'high')).toBe(true);
    });

    it('should detect emulator in user agent', async () => {
      jest.spyOn(service as any, 'gatherFraudHistory').mockResolvedValue({
        referrerReferrals: [],
        deviceHistory: [],
        ipHistory: [],
        userHistory: [],
      });

      const result = await service.checkForFraud({
        referrerUserId: 'user-1',
        inviteeUserId: 'user-2',
        userAgent: 'Mozilla/5.0 (Linux; Android 10; emulator x86 Build/QSR1.210802.001; wv)',
      });

      expect(result.flags.some(f => f.type === 'device_emulator')).toBe(true);
    });

    it('should allow clean referrals', async () => {
      jest.spyOn(service as any, 'gatherFraudHistory').mockResolvedValue({
        referrerReferrals: [
          {
            id: 'ref-1',
            status: 'registered',
            invitee_user_id: 'user-2',
            invitee_device_fingerprint: 'device-old',
            invitee_ip_address: '192.168.1.1',
            invited_at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days ago
            registered_at: new Date().toISOString(),
          },
        ],
        deviceHistory: [],
        ipHistory: [],
        userHistory: [],
      });

      const result = await service.checkForFraud({
        referrerUserId: 'user-1',
        inviteeUserId: 'user-3',
        deviceFingerprint: 'device-new',
        ipAddress: '192.168.1.2',
        email: 'user@example.com',
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
      });

      expect(result.isFraud).toBe(false);
      expect(result.riskScore).toBeLessThan(20);
      expect(result.recommendation).toBe('allow');
    });

    it('should flag invite farming pattern', async () => {
      jest.spyOn(service as any, 'gatherFraudHistory').mockResolvedValue({
        referrerReferrals: Array(15).fill(null).map((_, i) => ({
          id: `ref-${i}`,
          status: i < 5 ? 'cancelled' : 'registered',
          invitee_user_id: `user-${i}`,
          invitee_device_fingerprint: `device-${i}`,
          invitee_ip_address: '192.168.1.1',
          invited_at: new Date().toISOString(),
          registered_at: new Date().toISOString(),
        })),
        deviceHistory: [],
        ipHistory: [],
        userHistory: [],
      });

      const result = await service.checkForFraud({
        referrerUserId: 'user-1',
        inviteeUserId: 'user-new',
        referrerHistory: {
          totalReferrals: 15,
          recentReferrals: 10,
          flaggedReferrals: 5, // 33% flagged rate
        },
      });

      expect(result.flags.some(f => f.type === 'invite_farming')).toBe(true);
    });
  });

  describe('calculateRiskScore', () => {
    it('should return 0 for empty flags', () => {
      const score = (service as any).calculateRiskScore([]);
      expect(score).toBe(0);
    });

    it('should weight critical severity higher', () => {
      const lowFlags = [{ type: 'same_ip', severity: 'low', details: {}, score: 20 }];
      const criticalFlags = [{ type: 'self_referral', severity: 'critical', details: {}, score: 100 }];

      const lowScore = (service as any).calculateRiskScore(lowFlags);
      const criticalScore = (service as any).calculateRiskScore(criticalFlags);

      expect(criticalScore).toBeGreaterThan(lowScore);
    });

    it('should cap score at 100', () => {
      const flags = [
        { type: 'self_referral', severity: 'critical', details: {}, score: 100 },
        { type: 'same_device', severity: 'high', details: {}, score: 70 },
        { type: 'same_ip', severity: 'medium', details: {}, score: 40 },
      ];

      const score = (service as any).calculateRiskScore(flags);
      expect(score).toBeLessThanOrEqual(100);
    });
  });

  describe('getRecommendation', () => {
    it('should return block for critical flags', () => {
      const flags = [{ type: 'self_referral', severity: 'critical', details: {}, score: 100 }];
      const recommendation = (service as any).getRecommendation(100, flags);
      expect(recommendation).toBe('block');
    });

    it('should return block for high risk score with high severity', () => {
      const flags = [{ type: 'same_device', severity: 'high', details: {}, score: 70 }];
      const recommendation = (service as any).getRecommendation(75, flags);
      expect(recommendation).toBe('block');
    });

    it('should return review for medium risk', () => {
      const flags = [{ type: 'same_ip', severity: 'medium', details: {}, score: 50 }];
      const recommendation = (service as any).getRecommendation(55, flags);
      expect(recommendation).toBe('review');
    });

    it('should return flag for low risk with flags', () => {
      const flags = [{ type: 'same_ip', severity: 'low', details: {}, score: 25 }];
      const recommendation = (service as any).getRecommendation(25, flags);
      expect(recommendation).toBe('flag');
    });

    it('should return allow for clean checks', () => {
      const recommendation = (service as any).getRecommendation(0, []);
      expect(recommendation).toBe('allow');
    });
  });
});

describe('getAntiFraudService', () => {
  it('should return a singleton instance', () => {
    const instance1 = getAntiFraudService();
    const instance2 = getAntiFraudService();
    expect(instance1).toBe(instance2);
  });
});