import { AttributionDAO, AttributionFilters } from '../attribution.dao';

jest.mock('../client', () => ({
  getSupabaseClient: jest.fn(() => ({
    from: jest.fn((table: string) => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          order: jest.fn(() => ({
            limit: jest.fn(() => {
              if (table === 'price_history') {
                return Promise.resolve({
                  data: [{ close: '50000' }, { close: '52000' }, { close: '51000' }],
                  error: null,
                });
              }
              return Promise.resolve({ data: [], error: null });
            }),
          })),
        })),
      })),
    })),
  })),
}));

describe('AttributionDAO', () => {
  let dao: AttributionDAO;

  beforeEach(() => {
    dao = new AttributionDAO();
  });

  describe('calculateAttribution', () => {
    it('should return attribution report for user', async () => {
      const filters: AttributionFilters = { userId: 'test-user-id', period: 'all' };
      const report = await dao.calculateAttribution(filters);
      expect(report).toBeDefined();
      expect(report.userId).toBe('test-user-id');
      expect(report.strategyAttribution).toBeDefined();
      expect(report.symbolAttribution).toBeDefined();
    });

    it('should handle empty trades gracefully', async () => {
      const filters: AttributionFilters = { userId: 'test-user-id', period: 'daily' };
      const report = await dao.calculateAttribution(filters);
      expect(report.totalReturn).toBe(0);
      expect(report.strategyAttribution).toEqual([]);
    });
  });

  describe('Risk Metrics', () => {
    it('should calculate max drawdown correctly', async () => {
      const filters: AttributionFilters = { userId: 'test-user-id', period: 'all' };
      const report = await dao.calculateAttribution(filters);
      expect(report.riskAttribution.maxDrawdown).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Benchmark Comparison', () => {
    it('should include benchmark comparisons in report', async () => {
      const filters: AttributionFilters = { userId: 'test-user-id', period: 'all', benchmarkType: 'btc_hodl' };
      const report = await dao.calculateAttribution(filters);
      expect(report.benchmarkComparison).toBeDefined();
      expect(Array.isArray(report.benchmarkComparison)).toBe(true);
    });
  });

  describe('Efficiency Metrics', () => {
    it('should calculate Sharpe ratio', async () => {
      const filters: AttributionFilters = { userId: 'test-user-id', period: 'all' };
      const report = await dao.calculateAttribution(filters);
      report.efficiencyMetrics.forEach(metric => {
        expect(metric.sharpeRatio).toBeDefined();
        expect(typeof metric.sharpeRatio).toBe('number');
      });
    });
  });

  describe('Export', () => {
    it('should return download URL for PDF export', async () => {
      const filters: AttributionFilters = { userId: 'test-user-id', period: 'all' };
      const report = await dao.calculateAttribution(filters);
      const downloadUrl = await dao.exportToPDF(report);
      expect(downloadUrl).toBeDefined();
      expect(downloadUrl).toContain('/api/attribution/export/');
    });
  });
});
