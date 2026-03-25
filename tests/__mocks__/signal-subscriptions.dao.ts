// Mock for SignalSubscriptionsDAO
export const SignalSubscriptionsDAO = jest.fn().mockImplementation(() => ({
  getActiveSubscriptionsForSource: jest.fn().mockResolvedValue([]),
  getBySubscriber: jest.fn().mockResolvedValue([]),
  create: jest.fn().mockResolvedValue({}),
  update: jest.fn().mockResolvedValue({}),
  delete: jest.fn().mockResolvedValue(true),
}));