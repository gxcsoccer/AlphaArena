/**
 * AlertService Tests
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { AlertService, getAlertService } from '../AlertService';

// Mock the database modules
vi.mock('../../database/alert-rules.dao', () => ({
  alertRulesDao: {
    createAlertRule: vi.fn(),
    getAlertRuleById: vi.fn(),
    listAlertRules: vi.fn(),
    updateAlertRule: vi.fn(),
    deleteAlertRule: vi.fn(),
    updateAlertRuleTrigger: vi.fn(),
    isRuleInCooldown: vi.fn(),
    getRulesForEntity: vi.fn(),
  },
}));

vi.mock('../../database/alert-history.dao', () => ({
  alertHistoryDao: {
    createAlertHistory: vi.fn(),
    getAlertHistoryById: vi.fn(),
    listAlertHistory: vi.fn(),
    updateAlertHistory: vi.fn(),
    acknowledgeAlert: vi.fn(),
    resolveAlert: vi.fn(),
    getUnacknowledgedAlerts: vi.fn(),
    getUnresolvedAlerts: vi.fn(),
    getAlertStats: vi.fn(),
    deleteOldAlertHistory: vi.fn(),
  },
}));

vi.mock('../../database/alert-configurations.dao', () => ({
  alertConfigurationsDao: {
    getAlertConfiguration: vi.fn(),
    createDefaultAlertConfiguration: vi.fn(),
    updateAlertConfiguration: vi.fn(),
    isInQuietHours: vi.fn(),
    isAlertTypeEnabled: vi.fn(),
  },
}));

vi.mock('../../notification/NotificationService', () => ({
  createRiskNotification: vi.fn().mockResolvedValue({ id: 'notif-1' }),
  createSystemNotification: vi.fn().mockResolvedValue({ id: 'notif-2' }),
}));

import { alertRulesDao } from '../../database/alert-rules.dao';
import { alertHistoryDao } from '../../database/alert-history.dao';
import { alertConfigurationsDao } from '../../database/alert-configurations.dao';

describe('AlertService', () => {
  let alertService: AlertService;

  beforeEach(() => {
    vi.clearAllMocks();
    alertService = AlertService.getInstance();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('getInstance', () => {
    it('should return a singleton instance', () => {
      const instance1 = getAlertService();
      const instance2 = getAlertService();
      expect(instance1).toBe(instance2);
    });
  });

  describe('createRule', () => {
    it('should create an alert rule', async () => {
      const mockRule = {
        id: 'rule-1',
        user_id: 'user-1',
        name: 'Test Rule',
        rule_type: 'consecutive_failures' as const,
        severity: 'medium' as const,
        conditions: { threshold: 3 },
        channels: { in_app: true, email: false, webhook: false },
        is_enabled: true,
        trigger_count: 0,
        cooldown_minutes: 30,
        created_at: new Date(),
        updated_at: new Date(),
      };

      vi.mocked(alertRulesDao.createAlertRule).mockResolvedValue(mockRule);

      const result = await alertService.createRule({
        user_id: 'user-1',
        name: 'Test Rule',
        rule_type: 'consecutive_failures',
        conditions: { threshold: 3 },
      });

      expect(result).toEqual(mockRule);
      expect(alertRulesDao.createAlertRule).toHaveBeenCalledWith({
        user_id: 'user-1',
        name: 'Test Rule',
        rule_type: 'consecutive_failures',
        severity: 'medium',
        conditions: { threshold: 3 },
        channels: { in_app: true, email: false, webhook: false },
        is_enabled: true,
        cooldown_minutes: 30,
      });
    });
  });

  describe('getRule', () => {
    it('should get an alert rule by ID', async () => {
      const mockRule = {
        id: 'rule-1',
        user_id: 'user-1',
        name: 'Test Rule',
        rule_type: 'consecutive_failures' as const,
        severity: 'medium' as const,
        conditions: { threshold: 3 },
        channels: { in_app: true, email: false, webhook: false },
        is_enabled: true,
        trigger_count: 0,
        cooldown_minutes: 30,
        created_at: new Date(),
        updated_at: new Date(),
      };

      vi.mocked(alertRulesDao.getAlertRuleById).mockResolvedValue(mockRule);

      const result = await alertService.getRule('rule-1');

      expect(result).toEqual(mockRule);
      expect(alertRulesDao.getAlertRuleById).toHaveBeenCalledWith('rule-1');
    });
  });

  describe('listRules', () => {
    it('should list alert rules with filters', async () => {
      const mockRules = [
        {
          id: 'rule-1',
          user_id: 'user-1',
          name: 'Test Rule 1',
          rule_type: 'consecutive_failures' as const,
          severity: 'medium' as const,
          conditions: { threshold: 3 },
          channels: { in_app: true, email: false, webhook: false },
          is_enabled: true,
          trigger_count: 0,
          cooldown_minutes: 30,
          created_at: new Date(),
          updated_at: new Date(),
        },
      ];

      vi.mocked(alertRulesDao.listAlertRules).mockResolvedValue({
        rules: mockRules,
        total: 1,
      });

      const result = await alertService.listRules({ user_id: 'user-1' });

      expect(result.rules).toHaveLength(1);
      expect(result.total).toBe(1);
    });
  });

  describe('deleteRule', () => {
    it('should delete an alert rule', async () => {
      vi.mocked(alertRulesDao.deleteAlertRule).mockResolvedValue(true);

      const result = await alertService.deleteRule('rule-1');

      expect(result).toBe(true);
      expect(alertRulesDao.deleteAlertRule).toHaveBeenCalledWith('rule-1');
    });
  });

  describe('triggerAlert', () => {
    it('should trigger an alert and send notifications', async () => {
      // Mock configuration
      vi.mocked(alertConfigurationsDao.getAlertConfiguration).mockResolvedValue({
        id: 'config-1',
        user_id: 'user-1',
        alerts_enabled: true,
        default_channels: { in_app: true, email: false, webhook: false },
        email_enabled: false,
        quiet_hours_enabled: false,
        max_alerts_per_hour: 10,
        alert_cooldown_minutes: 5,
        alert_preferences: {
          consecutive_failures: { enabled: true, severity_threshold: 'low' },
        },
        created_at: new Date(),
        updated_at: new Date(),
      });

      vi.mocked(alertConfigurationsDao.isInQuietHours).mockResolvedValue(false);
      vi.mocked(alertRulesDao.getRulesForEntity).mockResolvedValue([]);
      vi.mocked(alertRulesDao.isRuleInCooldown).mockResolvedValue(false);

      const mockAlertHistory = {
        id: 'alert-1',
        user_id: 'user-1',
        rule_type: 'consecutive_failures' as const,
        severity: 'medium' as const,
        title: 'Test Alert',
        message: 'Test message',
        context: {},
        notification_status: 'pending' as const,
        notification_channels: { in_app: true },
        is_acknowledged: false,
        is_resolved: false,
        created_at: new Date(),
      };

      vi.mocked(alertHistoryDao.createAlertHistory).mockResolvedValue(mockAlertHistory);
      vi.mocked(alertHistoryDao.updateAlertHistory).mockResolvedValue({
        ...mockAlertHistory,
        notification_status: 'sent',
        sent_at: new Date(),
      });

      const result = await alertService.triggerAlert('consecutive_failures', {
        userId: 'user-1',
        entityType: 'scheduler',
        entityId: 'schedule-1',
        entityName: 'Test Schedule',
      });

      expect(result).not.toBeNull();
      expect(alertHistoryDao.createAlertHistory).toHaveBeenCalled();
    });

    it('should skip alert if user is in quiet hours', async () => {
      vi.mocked(alertConfigurationsDao.getAlertConfiguration).mockResolvedValue({
        id: 'config-1',
        user_id: 'user-1',
        alerts_enabled: true,
        default_channels: { in_app: true, email: false, webhook: false },
        email_enabled: false,
        quiet_hours_enabled: true,
        max_alerts_per_hour: 10,
        alert_cooldown_minutes: 5,
        alert_preferences: {},
        created_at: new Date(),
        updated_at: new Date(),
      });

      vi.mocked(alertConfigurationsDao.isInQuietHours).mockResolvedValue(true);

      const mockAlertHistory = {
        id: 'alert-1',
        user_id: 'user-1',
        rule_type: 'consecutive_failures' as const,
        severity: 'medium' as const,
        title: 'Test Alert',
        message: 'Test message',
        context: {},
        notification_status: 'skipped' as const,
        notification_channels: {},
        is_acknowledged: false,
        is_resolved: false,
        created_at: new Date(),
      };

      vi.mocked(alertHistoryDao.createAlertHistory).mockResolvedValue(mockAlertHistory);

      const result = await alertService.triggerAlert('consecutive_failures', {
        userId: 'user-1',
      });

      expect(result?.notification_status).toBe('skipped');
    });

    it('should not trigger alert if alerts are disabled', async () => {
      vi.mocked(alertConfigurationsDao.getAlertConfiguration).mockResolvedValue({
        id: 'config-1',
        user_id: 'user-1',
        alerts_enabled: false,
        default_channels: { in_app: true, email: false, webhook: false },
        email_enabled: false,
        quiet_hours_enabled: false,
        max_alerts_per_hour: 10,
        alert_cooldown_minutes: 5,
        alert_preferences: {},
        created_at: new Date(),
        updated_at: new Date(),
      });

      const result = await alertService.triggerAlert('consecutive_failures', {
        userId: 'user-1',
      });

      expect(result).toBeNull();
    });
  });

  describe('alertConsecutiveFailures', () => {
    it('should trigger a consecutive failures alert', async () => {
      vi.mocked(alertConfigurationsDao.getAlertConfiguration).mockResolvedValue({
        id: 'config-1',
        user_id: 'user-1',
        alerts_enabled: true,
        default_channels: { in_app: true, email: false, webhook: false },
        email_enabled: false,
        quiet_hours_enabled: false,
        max_alerts_per_hour: 10,
        alert_cooldown_minutes: 5,
        alert_preferences: {
          consecutive_failures: { enabled: true, severity_threshold: 'low' },
        },
        created_at: new Date(),
        updated_at: new Date(),
      });

      vi.mocked(alertConfigurationsDao.isInQuietHours).mockResolvedValue(false);
      vi.mocked(alertRulesDao.getRulesForEntity).mockResolvedValue([]);
      vi.mocked(alertRulesDao.isRuleInCooldown).mockResolvedValue(false);

      const mockAlertHistory = {
        id: 'alert-1',
        user_id: 'user-1',
        rule_type: 'consecutive_failures' as const,
        severity: 'medium' as const,
        title: '连续执行失败告警: Test Schedule',
        message: '调度器 "Test Schedule" 已连续失败 3 次',
        context: { scheduleId: 'schedule-1', consecutiveFailures: 3 },
        notification_status: 'sent' as const,
        notification_channels: { in_app: true },
        is_acknowledged: false,
        is_resolved: false,
        created_at: new Date(),
      };

      vi.mocked(alertHistoryDao.createAlertHistory).mockResolvedValue(mockAlertHistory);
      vi.mocked(alertHistoryDao.updateAlertHistory).mockResolvedValue(mockAlertHistory);

      const result = await alertService.alertConsecutiveFailures(
        'user-1',
        'schedule-1',
        'Test Schedule',
        3,
        'Test error message'
      );

      expect(result).not.toBeNull();
      expect(result?.rule_type).toBe('consecutive_failures');
      expect(alertHistoryDao.createAlertHistory).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: 'user-1',
          rule_type: 'consecutive_failures',
        })
      );
    });
  });

  describe('acknowledgeAlert', () => {
    it('should acknowledge an alert', async () => {
      const mockAlert = {
        id: 'alert-1',
        user_id: 'user-1',
        rule_type: 'consecutive_failures' as const,
        severity: 'medium' as const,
        title: 'Test Alert',
        message: 'Test message',
        context: {},
        notification_status: 'sent' as const,
        notification_channels: {},
        is_acknowledged: true,
        acknowledged_at: new Date(),
        acknowledged_by: 'user-1',
        is_resolved: false,
        created_at: new Date(),
      };

      vi.mocked(alertHistoryDao.acknowledgeAlert).mockResolvedValue(mockAlert);

      const result = await alertService.acknowledgeAlert('alert-1', 'user-1');

      expect(result?.is_acknowledged).toBe(true);
      expect(alertHistoryDao.acknowledgeAlert).toHaveBeenCalledWith('alert-1', 'user-1');
    });
  });

  describe('resolveAlert', () => {
    it('should resolve an alert with a note', async () => {
      const mockAlert = {
        id: 'alert-1',
        user_id: 'user-1',
        rule_type: 'consecutive_failures' as const,
        severity: 'medium' as const,
        title: 'Test Alert',
        message: 'Test message',
        context: {},
        notification_status: 'sent' as const,
        notification_channels: {},
        is_acknowledged: true,
        is_resolved: true,
        resolved_at: new Date(),
        resolution_note: 'Fixed the issue',
        created_at: new Date(),
      };

      vi.mocked(alertHistoryDao.resolveAlert).mockResolvedValue(mockAlert);

      const result = await alertService.resolveAlert('alert-1', 'user-1', 'Fixed the issue');

      expect(result?.is_resolved).toBe(true);
      expect(result?.resolution_note).toBe('Fixed the issue');
      expect(alertHistoryDao.resolveAlert).toHaveBeenCalledWith('alert-1', 'user-1', 'Fixed the issue');
    });
  });

  describe('getAlertStats', () => {
    it('should return alert statistics', async () => {
      vi.mocked(alertHistoryDao.getAlertStats).mockResolvedValue({
        total: 10,
        byType: { consecutive_failures: 5, execution_timeout: 3, position_limit: 2 },
        bySeverity: { low: 2, medium: 5, high: 2, critical: 1 },
        acknowledged: 8,
        resolved: 6,
        avgResolutionTimeMs: 3600000, // 1 hour
      });

      const stats = await alertService.getAlertStats('user-1');

      expect(stats.total).toBe(10);
      expect(stats.byType.consecutive_failures).toBe(5);
      expect(stats.avgResolutionTimeMs).toBe(3600000);
    });
  });

  describe('getConfiguration', () => {
    it('should get user alert configuration', async () => {
      vi.mocked(alertConfigurationsDao.getAlertConfiguration).mockResolvedValue({
        id: 'config-1',
        user_id: 'user-1',
        alerts_enabled: true,
        default_channels: { in_app: true, email: false, webhook: false },
        email_enabled: false,
        quiet_hours_enabled: false,
        max_alerts_per_hour: 10,
        alert_cooldown_minutes: 5,
        alert_preferences: {},
        created_at: new Date(),
        updated_at: new Date(),
      });

      const config = await alertService.getConfiguration('user-1');

      expect(config?.alerts_enabled).toBe(true);
    });
  });
});
