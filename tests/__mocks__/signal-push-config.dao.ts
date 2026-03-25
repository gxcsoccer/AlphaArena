// Mock for SignalPushConfigDAO
export const SignalPushConfigDAO = jest.fn().mockImplementation(() => ({
  getOrCreate: jest.fn().mockResolvedValue({
    pushEnabled: true,
    signalTypes: ['all'],
    riskLevels: ['low', 'medium', 'high', 'very_high'],
    symbols: [],
    quietHoursEnabled: false,
  }),
  getByUserId: jest.fn().mockResolvedValue(null),
  update: jest.fn().mockResolvedValue({}),
}));