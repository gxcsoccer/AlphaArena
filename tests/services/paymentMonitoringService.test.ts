/**
 * Payment Monitoring Service Tests
 * Basic tests for service instantiation and method signatures
 */

// Mock dependencies before importing
jest.mock('../../src/database/client', () => ({
  getSupabaseAdminClient: jest.fn(() => ({
    rpc: jest.fn().mockResolvedValue({ data: [], error: null }),
    from: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
      single: jest.fn().mockResolvedValue({ data: { id: 'test' }, error: null }),
      limit: jest.fn().mockResolvedValue({ data: [], error: null }),
      order: jest.fn().mockResolvedValue({ data: [], error: null }),
      update: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
    })),
  })),
}));

jest.mock('../../src/monitoring/FeishuAlertService', () => ({
  FeishuAlertService: jest.fn().mockImplementation(() => ({
    sendAlert: jest.fn().mockResolvedValue(true),
  })),
}));

jest.mock('../../src/utils/logger', () => ({
  createLogger: jest.fn(() => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  })),
}));

describe('PaymentMonitoringService', () => {
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
    it('should return metrics with default values when no data', async () => {
      const { PaymentMonitoringService } = await import('../../src/services/paymentMonitoringService');
      
      const service = new PaymentMonitoringService();
      const metrics = await service.getMetrics(new Date(), new Date());
      
      // Should return valid metrics structure
      expect(metrics).toHaveProperty('totalPayments');
      expect(metrics).toHaveProperty('succeededPayments');
      expect(metrics).toHaveProperty('failedPayments');
      expect(metrics).toHaveProperty('successRate');
      expect(metrics).toHaveProperty('failureRate');
      expect(metrics).toHaveProperty('totalRevenue');
    });
  });

  describe('getPaymentMethodMetrics', () => {
    it('should return an array', async () => {
      const { PaymentMonitoringService } = await import('../../src/services/paymentMonitoringService');
      const service = new PaymentMonitoringService();
      const result = await service.getPaymentMethodMetrics(new Date(), new Date());
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('acknowledgeAlert', () => {
    it('should complete without error', async () => {
      const { PaymentMonitoringService } = await import('../../src/services/paymentMonitoringService');
      const service = new PaymentMonitoringService();
      // Should not throw
      await expect(service.acknowledgeAlert('alert-123')).resolves.not.toThrow();
    });
  });

  describe('resolveAlert', () => {
    it('should complete without error', async () => {
      const { PaymentMonitoringService } = await import('../../src/services/paymentMonitoringService');
      const service = new PaymentMonitoringService();
      // Should not throw
      await expect(service.resolveAlert('alert-456')).resolves.not.toThrow();
    });
  });
});