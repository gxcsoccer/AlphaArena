/**
 * useOnboarding Hook
 *
 * React hook for managing onboarding state and interactions
 *
 * @module client/hooks/useOnboarding
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { OnboardingFlow, UserOnboardingState } from '../../analytics/onboarding.types';

interface OnboardingHookResult {
  /** Whether onboarding is loading */
  isLoading: boolean;
  /** Whether onboarding is active/visible */
  isActive: boolean;
  /** Current step index */
  currentStep: number;
  /** Total steps in flow */
  totalSteps: number;
  /** User's onboarding state from server */
  userState: UserOnboardingState | null;
  /** Whether onboarding is completed */
  isCompleted: boolean;
  /** Whether onboarding should be shown */
  shouldShow: boolean;
  /** Start the onboarding flow */
  start: () => Promise<void>;
  /** Complete current step */
  completeStep: (stepId: string) => Promise<void>;
  /** Skip current step */
  skipStep: (stepId: string) => Promise<void>;
  /** Skip entire onboarding */
  skip: () => Promise<void>;
  /** Replay onboarding from beginning */
  replay: () => Promise<void>;
  /** Hide onboarding UI */
  hide: () => void;
  /** Show onboarding UI */
  show: () => void;
  /** Track step viewed */
  trackView: (stepId: string) => Promise<void>;
  /** Refresh state from server */
  refresh: () => Promise<void>;
}

/**
 * Hook for managing onboarding state
 */
export function useOnboarding(autoStart: boolean = false): OnboardingHookResult {
  const [isLoading, setIsLoading] = useState(false);
  const [isActive, setIsActive] = useState(false);
  const [userState, setUserState] = useState<UserOnboardingState | null>(null);
  const [shouldShow, setShouldShow] = useState(false);
  const sessionIdRef = useRef<string>(`onboarding_${Date.now()}_${Math.random().toString(36).slice(2)}`);

  /**
   * Fetch onboarding state from server
   */
  const fetchState = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/onboarding/state', {
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        setUserState(data.state);
        setShouldShow(data.shouldShow);
      } else if (response.status === 401) {
        // User not authenticated - check local storage
        const localCompleted = localStorage.getItem('alphaarena_onboarding_completed');
        setShouldShow(!localCompleted);
      }
    } catch (error) {
      console.error('Failed to fetch onboarding state:', error);
      // Fallback to local storage
      const localCompleted = localStorage.getItem('alphaarena_onboarding_completed');
      setShouldShow(!localCompleted);
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Start onboarding
   */
  const start = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/onboarding/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ sessionId: sessionIdRef.current }),
      });

      if (response.ok) {
        const data = await response.json();
        setUserState(data.state);
        setIsActive(true);
      } else {
        // Fallback for non-authenticated users
        setIsActive(true);
      }
    } catch (error) {
      console.error('Failed to start onboarding:', error);
      setIsActive(true);
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Complete a step
   */
  const completeStep = useCallback(async (stepId: string) => {
    try {
      const response = await fetch(`/api/onboarding/step/${stepId}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ sessionId: sessionIdRef.current }),
      });

      if (response.ok) {
        const data = await response.json();
        setUserState(data.state);

        if (data.state.isCompleted) {
          localStorage.setItem('alphaarena_onboarding_completed', 'true');
          setIsActive(false);
        }
      }
    } catch (error) {
      console.error('Failed to complete step:', error);
    }
  }, []);

  /**
   * Skip a step
   */
  const skipStep = useCallback(async (stepId: string) => {
    try {
      const response = await fetch(`/api/onboarding/step/${stepId}/skip`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ sessionId: sessionIdRef.current }),
      });

      if (response.ok) {
        const data = await response.json();
        setUserState(data.state);
      }
    } catch (error) {
      console.error('Failed to skip step:', error);
    }
  }, []);

  /**
   * Skip entire onboarding
   */
  const skip = useCallback(async () => {
    try {
      const response = await fetch('/api/onboarding/skip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ sessionId: sessionIdRef.current }),
      });

      if (response.ok) {
        const data = await response.json();
        setUserState(data.state);
      }

      localStorage.setItem('alphaarena_onboarding_completed', 'true');
      localStorage.setItem('alphaarena_onboarding_skipped', 'true');
      setIsActive(false);
    } catch (error) {
      console.error('Failed to skip onboarding:', error);
      localStorage.setItem('alphaarena_onboarding_completed', 'true');
      setIsActive(false);
    }
  }, []);

  /**
   * Replay onboarding
   */
  const replay = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/onboarding/replay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ sessionId: sessionIdRef.current }),
      });

      if (response.ok) {
        const data = await response.json();
        setUserState(data.state);
        setIsActive(true);
      }

      localStorage.removeItem('alphaarena_onboarding_completed');
      localStorage.removeItem('alphaarena_onboarding_skipped');
    } catch (error) {
      console.error('Failed to replay onboarding:', error);
      localStorage.removeItem('alphaarena_onboarding_completed');
      setIsActive(true);
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Track step viewed
   */
  const trackView = useCallback(async (stepId: string) => {
    try {
      await fetch('/api/onboarding/track-view', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          stepId,
          sessionId: sessionIdRef.current,
        }),
      });
    } catch (error) {
      // Silently fail for tracking
      console.debug('Failed to track step view:', error);
    }
  }, []);

  /**
   * Hide onboarding UI
   */
  const hide = useCallback(() => {
    setIsActive(false);
  }, []);

  /**
   * Show onboarding UI
   */
  const show = useCallback(() => {
    setIsActive(true);
  }, []);

  /**
   * Refresh state from server
   */
  const refresh = useCallback(async () => {
    await fetchState();
  }, [fetchState]);

  // Fetch state on mount
  useEffect(() => {
    fetchState();
  }, [fetchState]);

  // Auto-start if enabled and should show
  useEffect(() => {
    if (autoStart && shouldShow && !isLoading && !userState?.isCompleted) {
      start();
    }
  }, [autoStart, shouldShow, isLoading, userState?.isCompleted, start]);

  return {
    isLoading,
    isActive,
    currentStep: userState?.completedSteps || 0,
    totalSteps: 8, // Default flow has 8 steps
    userState,
    isCompleted: userState?.isCompleted || false,
    shouldShow,
    start,
    completeStep,
    skipStep,
    skip,
    replay,
    hide,
    show,
    trackView,
    refresh,
  };
}

export default useOnboarding;