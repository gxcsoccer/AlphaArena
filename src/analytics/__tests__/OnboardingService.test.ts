/**
 * Tests for Onboarding Service
 *
 * @module analytics/__tests__/OnboardingService.test
 */

import { onboardingService } from '../OnboardingService';
import { onboardingDAO, DEFAULT_ONBOARDING_FLOW } from '../../database/onboarding.dao';

// Mock the DAO
jest.mock('../../database/onboarding.dao', () => ({
  onboardingDAO: {
    getUserOnboardingState: jest.fn(),
    initializeOnboardingState: jest.fn(),
    completeStep: jest.fn(),
    skipOnboarding: jest.fn(),
    resetOnboarding: jest.fn(),
    trackOnboardingEvent: jest.fn(),
    getNextStepId: jest.fn(),
    getStepById: jest.fn(),
  },
  DEFAULT_ONBOARDING_FLOW: {
    id: 'default-new-user',
    name: 'New User Onboarding',
    steps: [
      { id: 'welcome', title: 'Welcome', order: 1, type: 'modal' },
      { id: 'market', title: 'Market', order: 2, type: 'spotlight' },
      { id: 'complete', title: 'Complete', order: 3, type: 'modal' },
    ],
  },
}));

describe('OnboardingService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getOnboardingFlow', () => {
    it('should return the default onboarding flow', () => {
      const flow = onboardingService.getOnboardingFlow();
      expect(flow).toBeDefined();
      expect(flow.id).toBe('default-new-user');
      expect(flow.steps.length).toBeGreaterThan(0);
    });
  });

  describe('getStep', () => {
    it('should return a step by ID', () => {
      const mockStep = { id: 'welcome', title: 'Welcome', order: 1, type: 'modal' };
      (onboardingDAO.getStepById as jest.Mock).mockReturnValue(mockStep);

      const step = onboardingService.getStep('welcome');
      expect(step).toEqual(mockStep);
      expect(onboardingDAO.getStepById).toHaveBeenCalledWith('welcome');
    });

    it('should return undefined for non-existent step', () => {
      (onboardingDAO.getStepById as jest.Mock).mockReturnValue(undefined);

      const step = onboardingService.getStep('non-existent');
      expect(step).toBeUndefined();
    });
  });

  describe('startOnboarding', () => {
    it('should initialize onboarding for new user', async () => {
      const mockState = {
        userId: 'user-123',
        completedSteps: 0,
        completedStepIds: [],
        currentStepId: 'welcome',
        isCompleted: false,
        startedAt: new Date(),
        skipped: false,
        lastActiveStep: 'welcome',
        stepTimestamps: {},
        userRole: 'free',
      };

      (onboardingDAO.getUserOnboardingState as jest.Mock).mockResolvedValue(null);
      (onboardingDAO.initializeOnboardingState as jest.Mock).mockResolvedValue(mockState);
      (onboardingDAO.trackOnboardingEvent as jest.Mock).mockResolvedValue(undefined);

      const result = await onboardingService.startOnboarding('user-123', 'free', 'session-1');

      expect(result.state).toEqual(mockState);
      expect(result.flow).toBeDefined();
    });
  });

  describe('completeStep', () => {
    it('should complete a step and track event', async () => {
      const mockState = {
        userId: 'user-123',
        completedSteps: 1,
        completedStepIds: ['welcome'],
        currentStepId: 'market',
        isCompleted: false,
        startedAt: new Date(),
        skipped: false,
        lastActiveStep: 'welcome',
        stepTimestamps: { welcome: new Date() },
        userRole: 'free',
      };

      const updatedState = {
        ...mockState,
        completedSteps: 2,
        completedStepIds: ['welcome', 'market'],
        currentStepId: 'complete',
      };

      (onboardingDAO.getUserOnboardingState as jest.Mock).mockResolvedValue(mockState);
      (onboardingDAO.getNextStepId as jest.Mock).mockReturnValue('complete');
      (onboardingDAO.getStepById as jest.Mock).mockReturnValue({ id: 'market', order: 2 });
      (onboardingDAO.completeStep as jest.Mock).mockResolvedValue(updatedState);
      (onboardingDAO.trackOnboardingEvent as jest.Mock).mockResolvedValue(undefined);

      const result = await onboardingService.completeStep('user-123', 'market', 'session-1', 5000);

      expect(result.completedStepIds).toContain('market');
    });
  });

  describe('skipOnboarding', () => {
    it('should skip onboarding and mark as completed', async () => {
      const mockState = {
        userId: 'user-123',
        completedSteps: 0,
        completedStepIds: [],
        currentStepId: null,
        isCompleted: true,
        startedAt: new Date(),
        completedAt: new Date(),
        skipped: true,
        lastActiveStep: '',
        stepTimestamps: {},
        userRole: 'free',
      };

      (onboardingDAO.skipOnboarding as jest.Mock).mockResolvedValue(mockState);
      (onboardingDAO.trackOnboardingEvent as jest.Mock).mockResolvedValue(undefined);

      const result = await onboardingService.skipOnboarding('user-123', 'session-1');

      expect(result.skipped).toBe(true);
      expect(result.isCompleted).toBe(true);
    });
  });

  describe('replayOnboarding', () => {
    it('should reset onboarding state', async () => {
      const mockState = {
        userId: 'user-123',
        completedSteps: 0,
        completedStepIds: [],
        currentStepId: 'welcome',
        isCompleted: false,
        startedAt: new Date(),
        skipped: false,
        lastActiveStep: 'welcome',
        stepTimestamps: {},
        userRole: 'free',
      };

      (onboardingDAO.resetOnboarding as jest.Mock).mockResolvedValue(mockState);
      (onboardingDAO.trackOnboardingEvent as jest.Mock).mockResolvedValue(undefined);

      const result = await onboardingService.replayOnboarding('user-123', 'session-1');

      expect(result.state.isCompleted).toBe(false);
      expect(result.state.completedSteps).toBe(0);
    });
  });
});

describe('DEFAULT_ONBOARDING_FLOW', () => {
  it('should have valid steps', () => {
    expect(DEFAULT_ONBOARDING_FLOW.steps.length).toBeGreaterThan(0);
    expect(DEFAULT_ONBOARDING_FLOW.steps[0].type).toBeDefined();
  });

  it('should have steps in order', () => {
    const orders = DEFAULT_ONBOARDING_FLOW.steps.map(s => s.order);
    const sortedOrders = [...orders].sort((a, b) => a - b);
    expect(orders).toEqual(sortedOrders);
  });
});