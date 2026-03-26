/**
 * Payment Monitoring Service Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies before importing
vi.mock('../../src/database/client', () => ({
  getSupabaseAdminClient: vi.fn(() => ({
    rpc: vi.fn().mockResolvedValue({ data: [], error: null }),
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          single: vi.fn().mockResolvedValue({ data: { id: 'test' }, error: null }),
          limit: vi.fn().mockResolvedValue({ data: [], error: null }),
          in: vi.fn(() => ({
            order: vi.fn(() => ({
              limit: vi.fn().mockResolvedValue({ data: [], error: null }),
            })),
          })),
        })),
        insert: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn().mockResolvedValue({ data: { id: 'test', created_at: new Date().toISOString() }, error: null }),
          })),
        })),
        update: vi.fn(() => ({
          eq: vi.fn().mockResolvedValue({ error: null }),
        })),
        order: vi.fn(() => ({
          limit: vi.fn().mockResolvedValue({ data: [], error: null }),
        })),
        range: vi.fn(() => ({
          order: vi.fn(() => ({
            limit: vi.fn().mockResolvedValue({ data: [], error: null }),
          })),
        })),
        contains: vi.fn(() => ({
          order: vi.fn(() => ({
            limit: vi.fn().mockResolvedValue({ data: [], error: null }),
          })),
        })),
      })),
    })),
  })),
}));

// Mock FeishuAlertService as a class
class MockFeishuAlertService {
  sendAlert = vi.fn().mockResolvedValue(true);
}

vi.mock('../../src/monitoring/FeishuAlertService', () => ({
  FeishuAlertService: MockFeishuAlertService,
}));

vi.mock('../../src/utils/logger', () => ({
  createLogger: vi.fn(() => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  })),
}));

describe('PaymentMonitoringService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Basic functionality', () => {
    it('should be importable', async () => {
      const { PaymentMonitoringService } = await import('../../src/services/paymentMonitoringService');
      expect(PaymentMonitoringService).toBeDefined();
    });

    it('should create an instance', async () => {
      const { PaymentMonitoringService } = await import('../../src/services/paymentMonitoringService');
      const service = new PaymentMonitoringService();
      expect(service).toBeDefined();
    });

    it('should have required methods', async () => {
      const { PaymentMonitoringService } = await import('../../src/services/paymentMonitoringService');
      const service = new PaymentMonitoringService();
      
      expect(typeof service.getMetrics).toBe('function');
      expect(typeof service.getPaymentMethodMetrics).toBe('function');
      expect(typeof service.getFailureReasons).toBe('function');
      expect(typeof service.getPaymentTrend).toBe('function');
      expect(typeof service.getFailedPayments).toBe('function');
      expect(typeof service.getActiveAlerts).toBe('function');
      expect(typeof service.getAlertThresholds).toBe('function');
      expect(typeof service.updateAlertThreshold).toBe('function');
      expect(typeof service.checkPaymentHealth).toBe('function');
      expect(typeof service.acknowledgeAlert).toBe('function');
      expect(typeof service.resolveAlert).toBe('function');
      expect(typeof service.getDashboardData).toBe('function');
    });
  });

  describe('getMetrics', () => {
    it('should call RPC with correct parameters', async () => {
      const { PaymentMonitoringService } = await import('../../src/services/paymentMonitoringService');
      const { getSupabaseAdminClient } = await import('../../src/database/client');
      
      const mockRpc = vi.fn().mockResolvedValue({
        data: [{
          total_payments: 100,
          succeeded_payments: 95,
          failed_payments: 5,
          pending_payments: 0,
          refunded_payments: 0,
          total_revenue: 10000,
          total_refunded: 0,
          unique_customers: 80,
          retry_rate: 25,
        }],
        error: null,
      });
      
      (getSupabaseAdminClient as any).mockReturnValue({
        rpc: mockRpc,
        from: vi.fn(() => ({
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
            })),
          })),
        })),
      });

      const service = new PaymentMonitoringService();
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');
      
      const metrics = await service.getMetrics(startDate, endDate);
      
      expect(mockRpc).toHaveBeenCalledWith(
        'get_payment_metrics',
        expect.objectContaining({
          p_start_date: startDate.toISOString(),
          p_end_date: endDate.toISOString(),
        })
      );
      expect(metrics.totalPayments).toBe(100);
      expect(metrics.successRate).toBe(95);
    });
  });

  describe('getPaymentMethodMetrics', () => {
    it('should return payment method breakdown', async () => {
      const { PaymentMonitoringService } = await import('../../src/services/paymentMonitoringService');
      const { getSupabaseAdminClient } = await import('../../src/database/client');
      
      const mockRpc = vi.fn().mockResolvedValue({
        data: [
          { method: 'stripe', total_payments: 50, succeeded_payments: 48, failed_payments: 2, total_amount: 5000 },
        ],
        error: null,
      });
      
      (getSupabaseAdminClient as any).mockReturnValue({ rpc: mockRpc });

      const service = new PaymentMonitoringService();
      const result = await service.getPaymentMethodMetrics(new Date(), new Date());
      
      expect(result).toHaveLength(1);
      expect(result[0].method).toBe('stripe');
    });
  });

  describe('acknowledgeAlert', () => {
    it('should update alert status', async () => {
      const { PaymentMonitoringService } = await import('../../src/services/paymentMonitoringService');
      const { getSupabaseAdminClient } = await import('../../src/database/client');
      
      const mockEq = vi.fn().mockResolvedValue({ error: null });
      
      (getSupabaseAdminClient as any).mockReturnValue({
        from: vi.fn(() => ({
          update: vi.fn(() => ({ eq: mockEq })),
        })),
      });

      const service = new PaymentMonitoringService();
      await service.acknowledgeAlert('alert-123');
      
      expect(mockEq).toHaveBeenCalledWith('id', 'alert-123');
    });
  });

  describe('resolveAlert', () => {
    it('should resolve an alert', async () => {
      const { PaymentMonitoringService } = await import('../../src/services/paymentMonitoringService');
      const { getSupabaseAdminClient } = await import('../../src/database/client');
      
      const mockEq = vi.fn().mockResolvedValue({ error: null });
      
      (getSupabaseAdminClient as any).mockReturnValue({
        from: vi.fn(() => ({
          update: vi.fn(() => ({ eq: mockEq })),
        })),
      });

      const service = new PaymentMonitoringService();
      await service.resolveAlert('alert-456');
      
      expect(mockEq).toHaveBeenCalledWith('id', 'alert-456');
    });
  });

  describe('PaymentMetrics type', () => {
    it('should have correct structure', async () => {
      const { PaymentMonitoringService } = await import('../../src/services/paymentMonitoringService');
      const { getSupabaseAdminClient } = await import('../../src/database/client');
      
      (getSupabaseAdminClient as any).mockReturnValue({
        rpc: vi.fn().mockResolvedValue({
          data: [{
            total_payments: 100,
            succeeded_payments: 95,
            failed_payments: 5,
            pending_payments: 0,
            refunded_payments: 0,
            total_revenue: 10000,
            total_refunded: 0,
            unique_customers: 80,
            retry_rate: 25,
          }],
          error: null,
        }),
      });

      const service = new PaymentMonitoringService();
      const metrics = await service.getMetrics(new Date(), new Date());
      
      // Verify all required fields exist
      expect(metrics).toHaveProperty('totalPayments');
      expect(metrics).toHaveProperty('succeededPayments');
      expect(metrics).toHaveProperty('failedPayments');
      expect(metrics).toHaveProperty('successRate');
      expect(metrics).toHaveProperty('failureRate');
      expect(metrics).toHaveProperty('totalRevenue');
      expect(metrics).toHaveProperty('uniqueCustomers');
    });
  });
});