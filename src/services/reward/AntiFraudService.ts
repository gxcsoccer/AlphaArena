/**
 * Anti-Fraud Service
 * Detects and prevents referral fraud
 */

import { getSupabaseAdminClient } from '../../database/client';
import { createLogger } from '../../utils/logger';

const log = createLogger('AntiFraudService');

// ============================================
// Type Definitions
// ============================================

export type FraudFlagType = 
  | 'same_device'
  | 'same_ip'
  | 'rapid_registration'
  | 'suspicious_pattern'
  | 'self_referral'
  | 'multiple_accounts'
  | 'proxy_vpn'
  | 'device_emulator'
  | 'behavioral_anomaly'
  | 'invite_farming';

export type FraudSeverity = 'low' | 'medium' | 'high' | 'critical';

export interface FraudFlag {
  id: string;
  referralId: string;
  flagType: FraudFlagType;
  severity: FraudSeverity;
  details: Record<string, unknown>;
  riskScore: number;
  resolved: boolean;
  resolvedAt: Date | null;
  resolutionNote: string | null;
  createdAt: Date;
}

export interface FraudCheckResult {
  isFraud: boolean;
  riskScore: number; // 0-100
  flags: Array<{
    type: FraudFlagType;
    severity: FraudSeverity;
    details: Record<string, unknown>;
  }>;
  recommendation: 'allow' | 'flag' | 'block' | 'review';
}

export interface FraudCheckContext {
  referrerUserId: string;
  inviteeUserId: string;
  deviceFingerprint?: string;
  ipAddress?: string;
  userAgent?: string;
  email?: string;
  phone?: string;
  registrationTime?: Date;
  referrerHistory?: {
    totalReferrals: number;
    recentReferrals: number;
    flaggedReferrals: number;
  };
}

// ============================================
// Anti-Fraud Rules Configuration
// ============================================

interface FraudRule {
  type: FraudFlagType;
  check: (context: FraudCheckContext, history: FraudHistoryData) => FraudCheck | null;
  baseScore: number;
  severity: FraudSeverity;
}

interface FraudCheck {
  type: FraudFlagType;
  severity: FraudSeverity;
  details: Record<string, unknown>;
  score: number;
}

interface FraudHistoryData {
  referrerReferrals: ReferrerReferralData[];
  deviceHistory: DeviceHistoryData[];
  ipHistory: IPHistoryData[];
  userHistory: UserHistoryData[];
}

interface ReferrerReferralData {
  id: string;
  status: string;
  invitee_user_id: string | null;
  invitee_device_fingerprint: string | null;
  invitee_ip_address: string | null;
  invited_at: string;
  registered_at: string | null;
}

interface DeviceHistoryData {
  user_id: string;
  device_fingerprint: string;
  first_seen: string;
  account_count: number;
}

interface IPHistoryData {
  ip_address: string;
  user_count: number;
  recent_registrations: number;
}

interface UserHistoryData {
  user_id: string;
  email: string | null;
  phone: string | null;
  created_at: string;
  has_subscription: boolean;
  trade_count: number;
}

// ============================================
// Anti-Fraud Service Class
// ============================================

export class AntiFraudService {
  private readonly FRAUD_THRESHOLD = {
    low: 20,
    medium: 40,
    high: 60,
    critical: 80,
  };

  /**
   * Perform comprehensive fraud check
   */
  async checkForFraud(context: FraudCheckContext): Promise<FraudCheckResult> {
    const history = await this.gatherFraudHistory(context);
    const flags: FraudCheck[] = [];
    
    // Run all fraud checks
    const fraudRules = this.getFraudRules();
    
    for (const rule of fraudRules) {
      const result = rule.check(context, history);
      if (result) {
        flags.push(result);
      }
    }

    // Calculate total risk score
    const riskScore = this.calculateRiskScore(flags);
    
    // Determine recommendation
    const recommendation = this.getRecommendation(riskScore, flags);

    return {
      isFraud: riskScore >= this.FRAUD_THRESHOLD.high,
      riskScore,
      flags: flags.map(f => ({
        type: f.type,
        severity: f.severity,
        details: f.details,
      })),
      recommendation,
    };
  }

  /**
   * Record a fraud flag
   */
  async recordFraudFlag(
    referralId: string,
    flagType: FraudFlagType,
    severity: FraudSeverity,
    details: Record<string, unknown>,
    riskScore: number
  ): Promise<FraudFlag> {
    const supabase = getSupabaseAdminClient();
    
    const { data, error } = await supabase
      .from('referral_fraud_flags')
      .insert({
        referral_id: referralId,
        flag_type: flagType,
        severity,
        details,
        risk_score: riskScore,
        resolved: false,
      })
      .select()
      .single();

    if (error) {
      log.error('Failed to record fraud flag:', error);
      throw error;
    }

    return this.mapFraudFlagRow(data);
  }

  /**
   * Resolve a fraud flag
   */
  async resolveFraudFlag(
    flagId: string,
    resolutionNote: string
  ): Promise<void> {
    const supabase = getSupabaseAdminClient();
    
    const { error } = await supabase
      .from('referral_fraud_flags')
      .update({
        resolved: true,
        resolved_at: new Date().toISOString(),
        resolution_note: resolutionNote,
      })
      .eq('id', flagId);

    if (error) {
      log.error('Failed to resolve fraud flag:', error);
      throw error;
    }
  }

  /**
   * Get pending fraud flags for review
   */
  async getPendingFlags(options?: {
    severity?: FraudSeverity;
    limit?: number;
    offset?: number;
  }): Promise<{ flags: FraudFlag[]; total: number }> {
    const supabase = getSupabaseAdminClient();
    
    let query = supabase
      .from('referral_fraud_flags')
      .select('*', { count: 'exact' })
      .eq('resolved', false);

    if (options?.severity) {
      query = query.eq('severity', options.severity);
    }

    const limit = options?.limit ?? 50;
    const offset = options?.offset ?? 0;
    
    query = query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      log.error('Failed to get pending flags:', error);
      throw error;
    }

    return {
      flags: (data || []).map(this.mapFraudFlagRow),
      total: count || 0,
    };
  }

  /**
   * Get fraud statistics
   */
  async getFraudStats(): Promise<{
    totalFlags: number;
    pendingFlags: number;
    resolvedFlags: number;
    bySeverity: Record<FraudSeverity, number>;
    byType: Record<FraudFlagType, number>;
    averageRiskScore: number;
  }> {
    const supabase = getSupabaseAdminClient();
    
    const { data, error } = await supabase
      .from('referral_fraud_flags')
      .select('severity, flag_type, risk_score, resolved');

    if (error) {
      log.error('Failed to get fraud stats:', error);
      throw error;
    }

    const flags = data || [];
    
    const stats = {
      totalFlags: flags.length,
      pendingFlags: flags.filter(f => !f.resolved).length,
      resolvedFlags: flags.filter(f => f.resolved).length,
      bySeverity: {
        low: 0,
        medium: 0,
        high: 0,
        critical: 0,
      } as Record<FraudSeverity, number>,
      byType: {} as Record<FraudFlagType, number>,
      averageRiskScore: 0,
    };

    let totalRiskScore = 0;
    
    for (const flag of flags) {
      const severity = flag.severity as FraudSeverity;
      const type = flag.flag_type as FraudFlagType;
      
      stats.bySeverity[severity]++;
      stats.byType[type] = (stats.byType[type] || 0) + 1;
      totalRiskScore += (flag.risk_score as number) || 0;
    }

    stats.averageRiskScore = flags.length > 0 ? totalRiskScore / flags.length : 0;

    return stats;
  }

  // ============================================
  // Private Methods
  // ============================================

  private getFraudRules(): FraudRule[] {
    return [
      // Self-referral check
      {
        type: 'self_referral',
        severity: 'critical',
        baseScore: 100,
        check: (context, _history) => {
          if (context.referrerUserId === context.inviteeUserId) {
            return {
              type: 'self_referral' as FraudFlagType,
              severity: 'critical' as FraudSeverity,
              details: { referrerUserId: context.referrerUserId },
              score: 100,
            };
          }
          return null;
        },
      },
      
      // Same device check
      {
        type: 'same_device',
        severity: 'high',
        baseScore: 70,
        check: (context, history) => {
          if (!context.deviceFingerprint) return null;
          
          const sameDeviceReferrals = history.referrerReferrals.filter(
            r => r.invitee_device_fingerprint === context.deviceFingerprint
          );
          
          if (sameDeviceReferrals.length > 0) {
            return {
              type: 'same_device' as FraudFlagType,
              severity: 'high' as FraudSeverity,
              details: {
                deviceFingerprint: context.deviceFingerprint,
                previousReferrals: sameDeviceReferrals.length,
              },
              score: 70,
            };
          }
          
          // Check if referrer previously used this device as invitee
          const deviceUsedAsInvitee = history.deviceHistory.find(
            d => d.device_fingerprint === context.deviceFingerprint && 
                 d.user_id === context.referrerUserId
          );
          
          if (deviceUsedAsInvitee) {
            return {
              type: 'multiple_accounts' as FraudFlagType,
              severity: 'high' as FraudSeverity,
              details: {
                deviceFingerprint: context.deviceFingerprint,
                message: 'Referrer has previously used this device as an invitee',
              },
              score: 80,
            };
          }
          
          return null;
        },
      },
      
      // Same IP check
      {
        type: 'same_ip',
        severity: 'medium',
        baseScore: 40,
        check: (context, history) => {
          if (!context.ipAddress) return null;
          
          const recentSameIPReferrals = history.referrerReferrals.filter(
            r => r.invitee_ip_address === context.ipAddress &&
                 new Date(r.invited_at) > new Date(Date.now() - 24 * 60 * 60 * 1000)
          );
          
          if (recentSameIPReferrals.length >= 3) {
            return {
              type: 'same_ip' as FraudFlagType,
              severity: 'high' as FraudSeverity,
              details: {
                ipAddress: context.ipAddress,
                recentReferralsWithSameIP: recentSameIPReferrals.length,
              },
              score: 60,
            };
          }
          
          if (recentSameIPReferrals.length >= 1) {
            return {
              type: 'same_ip' as FraudFlagType,
              severity: 'medium' as FraudSeverity,
              details: {
                ipAddress: context.ipAddress,
                recentReferralsWithSameIP: recentSameIPReferrals.length,
              },
              score: 40,
            };
          }
          
          return null;
        },
      },
      
      // Rapid registration check
      {
        type: 'rapid_registration',
        severity: 'medium',
        baseScore: 50,
        check: (context, history) => {
          const recentReferrals = history.referrerReferrals.filter(
            r => new Date(r.invited_at) > new Date(Date.now() - 60 * 60 * 1000) // 1 hour
          );
          
          if (recentReferrals.length >= 5) {
            return {
              type: 'rapid_registration' as FraudFlagType,
              severity: 'high' as FraudSeverity,
              details: {
                referralsInLastHour: recentReferrals.length,
              },
              score: 70,
            };
          }
          
          if (recentReferrals.length >= 3) {
            return {
              type: 'rapid_registration' as FraudFlagType,
              severity: 'medium' as FraudSeverity,
              details: {
                referralsInLastHour: recentReferrals.length,
              },
              score: 50,
            };
          }
          
          return null;
        },
      },
      
      // Invite farming check
      {
        type: 'invite_farming',
        severity: 'high',
        baseScore: 60,
        check: (context, history) => {
          if (!context.referrerHistory) return null;
          
          const { totalReferrals, flaggedReferrals } = context.referrerHistory;
          const flaggedRate = totalReferrals > 0 ? flaggedReferrals / totalReferrals : 0;
          
          if (totalReferrals >= 10 && flaggedRate >= 0.3) {
            return {
              type: 'invite_farming' as FraudFlagType,
              severity: 'high' as FraudSeverity,
              details: {
                totalReferrals,
                flaggedReferrals,
                flaggedRate: Math.round(flaggedRate * 100) / 100,
              },
              score: Math.min(80, 40 + flaggedRate * 50),
            };
          }
          
          return null;
        },
      },
      
      // Suspicious pattern check
      {
        type: 'suspicious_pattern',
        severity: 'medium',
        baseScore: 45,
        check: (context, history) => {
          // Check for patterns like sequential emails, similar names, etc.
          if (!context.email) return null;
          
          const emailDomain = context.email.split('@')[1];
          const tempEmailDomains = [
            'tempmail.com', 'throwaway.email', 'guerrillamail.com',
            'mailinator.com', '10minutemail.com', 'fakeinbox.com',
          ];
          
          if (tempEmailDomains.includes(emailDomain)) {
            return {
              type: 'suspicious_pattern' as FraudFlagType,
              severity: 'high' as FraudSeverity,
              details: {
                emailDomain,
                message: 'Temporary email domain detected',
              },
              score: 65,
            };
          }
          
          return null;
        },
      },
      
      // Device emulator check
      {
        type: 'device_emulator',
        severity: 'high',
        baseScore: 55,
        check: (context, _history) => {
          if (!context.userAgent) return null;
          
          const emulatorIndicators = [
            ' emulator', 'simulator', 'android sdk', 'genymotion',
            'bluestacks', 'nox', 'memu', 'ldplayer',
          ];
          
          const ua = context.userAgent.toLowerCase();
          const detected = emulatorIndicators.find(indicator => ua.includes(indicator));
          
          if (detected) {
            return {
              type: 'device_emulator' as FraudFlagType,
              severity: 'high' as FraudSeverity,
              details: {
                userAgent: context.userAgent,
                detectedIndicator: detected,
              },
              score: 75,
            };
          }
          
          return null;
        },
      },
    ];
  }

  private async gatherFraudHistory(context: FraudCheckContext): Promise<FraudHistoryData> {
    const supabase = getSupabaseAdminClient();
    
    // Get referrer's recent referrals
    const { data: referrerReferrals } = await supabase
      .from('referrals')
      .select('id, status, invitee_user_id, invitee_device_fingerprint, invitee_ip_address, invited_at, registered_at')
      .eq('referrer_user_id', context.referrerUserId)
      .order('invited_at', { ascending: false })
      .limit(100);

    // Get device history
    let deviceHistory: DeviceHistoryData[] = [];
    if (context.deviceFingerprint) {
      const { data } = await supabase
        .from('referrals')
        .select('invitee_user_id, invitee_device_fingerprint, created_at')
        .eq('invitee_device_fingerprint', context.deviceFingerprint);
      
      deviceHistory = (data || []).map(r => ({
        user_id: r.invitee_user_id || '',
        device_fingerprint: r.invitee_device_fingerprint || '',
        first_seen: r.created_at,
        account_count: 1,
      }));
    }

    // Get IP history
    let ipHistory: IPHistoryData[] = [];
    if (context.ipAddress) {
      const { data } = await supabase
        .from('referrals')
        .select('invitee_ip_address, invitee_user_id')
        .eq('invitee_ip_address', context.ipAddress);
      
      ipHistory = [{
        ip_address: context.ipAddress,
        user_count: new Set(data?.map(r => r.invitee_user_id).filter(Boolean)).size || 0,
        recent_registrations: data?.length || 0,
      }];
    }

    // Get user history
    let userHistory: UserHistoryData[] = [];
    if (context.inviteeUserId) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('id, email, phone, created_at')
        .eq('id', context.inviteeUserId)
        .maybeSingle();

      if (profile) {
        const { count: tradeCount } = await supabase
          .from('trades')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', context.inviteeUserId);

        const { count: subCount } = await supabase
          .from('user_subscriptions')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', context.inviteeUserId)
          .eq('status', 'active');

        userHistory = [{
          user_id: profile.id,
          email: profile.email,
          phone: profile.phone,
          created_at: profile.created_at,
          has_subscription: (subCount || 0) > 0,
          trade_count: tradeCount || 0,
        }];
      }
    }

    return {
      referrerReferrals: (referrerReferrals || []) as ReferrerReferralData[],
      deviceHistory,
      ipHistory,
      userHistory,
    };
  }

  private calculateRiskScore(flags: FraudCheck[]): number {
    if (flags.length === 0) return 0;
    
    // Weight by severity
    const severityWeights: Record<FraudSeverity, number> = {
      low: 0.5,
      medium: 1.0,
      high: 1.5,
      critical: 2.0,
    };
    
    let totalScore = 0;
    let totalWeight = 0;
    
    for (const flag of flags) {
      const weight = severityWeights[flag.severity];
      totalScore += flag.score * weight;
      totalWeight += weight;
    }
    
    // Weighted average, capped at 100
    return Math.min(100, Math.round(totalScore / totalWeight));
  }

  private getRecommendation(
    riskScore: number,
    flags: FraudCheck[]
  ): 'allow' | 'flag' | 'block' | 'review' {
    // Critical flags always block
    if (flags.some(f => f.severity === 'critical')) {
      return 'block';
    }
    
    // High risk score with high severity flags
    if (riskScore >= 70 && flags.some(f => f.severity === 'high')) {
      return 'block';
    }
    
    // Medium to high risk
    if (riskScore >= 50) {
      return 'review';
    }
    
    // Low risk but some flags
    if (flags.length > 0) {
      return 'flag';
    }
    
    return 'allow';
  }

  private mapFraudFlagRow(row: Record<string, unknown>): FraudFlag {
    return {
      id: row.id as string,
      referralId: row.referral_id as string,
      flagType: row.flag_type as FraudFlagType,
      severity: row.severity as FraudSeverity,
      details: (row.details as Record<string, unknown>) || {},
      riskScore: row.risk_score as number,
      resolved: row.resolved as boolean,
      resolvedAt: row.resolved_at ? new Date(row.resolved_at as string) : null,
      resolutionNote: row.resolution_note as string | null,
      createdAt: new Date(row.created_at as string),
    };
  }
}

// Singleton instance
let antiFraudService: AntiFraudService | null = null;

export function getAntiFraudService(): AntiFraudService {
  if (!antiFraudService) {
    antiFraudService = new AntiFraudService();
  }
  return antiFraudService;
}

export default AntiFraudService;