/**
 * SmartOnboarding Component
 *
 * Enhanced onboarding flow with interactive guidance using driver.js
 *
 * @module client/components/SmartOnboarding
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { driver, DriveStep, Config } from 'driver.js';
import 'driver.js/dist/driver.css';
import {
  Button,
  Modal,
  Typography,
  Progress,
  Space,
  Checkbox,
  Tag,
  Tooltip,
} from '@arco-design/web-react';
import {
  IconClose,
  IconLeft,
  IconRight,
  IconCheck,
  IconPlayCircle,
  IconQuestionCircle,
} from '@arco-design/web-react/icon';
import { OnboardingStep, OnboardingFlow } from '../../analytics/onboarding.types';
import { onboardingService } from '../../analytics/OnboardingService';
import { useAuth } from '../hooks/useAuth';
import './SmartOnboarding.css';

const { Title, Text, Paragraph } = Typography;

/**
 * Props for SmartOnboarding component
 */
interface SmartOnboardingProps {
  /** Whether to auto-show for new users */
  autoShow?: boolean;
  /** Delay before showing (ms) */
  showDelay?: number;
  /** Callback when onboarding completes */
  onComplete?: () => void;
  /** Callback when onboarding is skipped */
  onSkip?: () => void;
  /** Custom flow to use */
  customFlow?: OnboardingFlow;
  /** Whether to show progress indicator */
  showProgress?: boolean;
  /** Whether to allow replay */
  allowReplay?: boolean;
  /** Theme for driver.js */
  theme?: 'light' | 'dark';
}

/**
 * Convert our step definition to driver.js step
 */
function toDriverStep(step: OnboardingStep, isLast: boolean): DriveStep {
  const baseStep: DriveStep = {
    popover: {
      title: step.title,
      description: step.description,
      showButtons: !isLast ? ['next', 'previous'] : ['next'],
      nextBtnText: isLast ? '完成' : '下一步',
      prevBtnText: '上一步',
      doneBtnText: '开始使用',
    },
  };

  if (step.targetSelector) {
    baseStep.element = step.targetSelector;
    baseStep.popover!.side = step.side || 'bottom';
    baseStep.popover!.align = step.align || 'start';
  }

  return baseStep;
}

/**
 * SmartOnboarding Component
 */
const SmartOnboarding: React.FC<SmartOnboardingProps> = ({
  autoShow = true,
  showDelay = 1500,
  onComplete,
  onSkip,
  customFlow,
  showProgress = true,
  allowReplay = true,
  theme = 'light',
}) => {
  const { user } = useAuth();
  const [visible, setVisible] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<string[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [dontShowAgain, setDontShowAgain] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);

  const driverRef = useRef<typeof driver | null>(null);
  const stepStartTimeRef = useRef<number>(Date.now());
  const sessionIdRef = useRef<string>(`onboarding_${Date.now()}`);

  const flow = customFlow || onboardingService.getOnboardingFlow();
  const totalSteps = flow.steps.length;
  const progress = ((currentStep + 1) / totalSteps) * 100;

  /**
   * Initialize driver.js
   */
  const initDriver = useCallback(() => {
    if (driverRef.current) {
      driverRef.current.destroy();
    }

    const driverSteps = flow.steps.map((step, index) =>
      toDriverStep(step, index === flow.steps.length - 1)
    );

    driverRef.current = driver({
      showProgress,
      animate: true,
      overlayColor: theme === 'dark' ? 'rgba(0, 0, 0, 0.75)' : 'rgba(0, 0, 0, 0.5)',
      stageColor: theme === 'dark' ? '#1a1a1a' : '#ffffff',
      popoverClass: `smart-onboarding-popover ${theme}`,
      onHighlightStarted: (element, step, opts) => {
        const stepIndex = opts?.step?.popover ? driverSteps.indexOf(step) : -1;
        if (stepIndex >= 0) {
          setCurrentStep(stepIndex);
          stepStartTimeRef.current = Date.now();

          // Track step viewed
          if (user?.id) {
            const flowStep = flow.steps[stepIndex];
            onboardingService.trackStepViewed(
              user.id,
              flowStep.id,
              sessionIdRef.current
            ).catch(console.error);
          }
        }
      },
      onNextClick: (element, step, opts) => {
        const stepIndex = driverSteps.indexOf(step);
        if (stepIndex >= 0 && user?.id) {
          const flowStep = flow.steps[stepIndex];
          const timeOnStep = Date.now() - stepStartTimeRef.current;

          // Track step completed
          onboardingService.completeStep(
            user.id,
            flowStep.id,
            sessionIdRef.current,
            timeOnStep
          ).catch(console.error);

          setCompletedSteps(prev => [...prev, flowStep.id]);
        }

        driverRef.current?.moveNext();
      },
      onPrevClick: () => {
        driverRef.current?.movePrevious();
      },
      onCloseClick: () => {
        handleSkip();
      },
      onDestroyStarted: () => {
        if (!isCompleted) {
          // User closed without completing
          handleSkip();
        }
      },
    } as Config);

    driverRef.current.setSteps(driverSteps);
  }, [flow, showProgress, theme, user?.id, isCompleted]);

  /**
   * Start onboarding
   */
  const startOnboarding = useCallback(async () => {
    if (!user?.id) {
      // For non-authenticated users, use local storage
      const hasCompleted = localStorage.getItem('alphaarena_onboarding_completed');
      if (hasCompleted) {
        return;
      }
    }

    setIsRunning(true);

    if (user?.id) {
      try {
        await onboardingService.startOnboarding(
          user.id,
          'free', // Default role
          sessionIdRef.current
        );
      } catch (error) {
        console.error('Failed to start onboarding:', error);
      }
    }

    initDriver();

    // Show welcome modal first if first step is modal type
    const firstStep = flow.steps[0];
    if (firstStep.type === 'modal' && !firstStep.targetSelector) {
      setShowWelcome(true);
    } else {
      driverRef.current?.drive();
    }
  }, [user?.id, flow, initDriver]);

  /**
   * Handle welcome modal continue
   */
  const handleWelcomeContinue = useCallback(() => {
    setShowWelcome(false);
    setCurrentStep(1);
    driverRef.current?.drive(1);
  }, []);

  /**
   * Handle skip
   */
  const handleSkip = useCallback(async () => {
    if (user?.id) {
      try {
        await onboardingService.skipOnboarding(user.id, sessionIdRef.current);
      } catch (error) {
        console.error('Failed to skip onboarding:', error);
      }
    }

    localStorage.setItem('alphaarena_onboarding_completed', 'true');

    setIsRunning(false);
    setVisible(false);
    driverRef.current?.destroy();
    onSkip?.();
  }, [user?.id, onSkip]);

  /**
   * Handle completion
   */
  const handleComplete = useCallback(async () => {
    setIsCompleted(true);

    if (dontShowAgain) {
      localStorage.setItem('alphaarena_onboarding_completed', 'true');
    }

    setIsRunning(false);
    setVisible(false);

    if (user?.id) {
      try {
        await onboardingService.completeStep(
          user.id,
          flow.steps[flow.steps.length - 1].id,
          sessionIdRef.current,
          Date.now() - stepStartTimeRef.current
        );
      } catch (error) {
        console.error('Failed to complete onboarding:', error);
      }
    }

    onComplete?.();
  }, [user?.id, flow, dontShowAgain, onComplete]);

  /**
   * Handle replay request
   */
  const handleReplay = useCallback(async () => {
    if (user?.id) {
      try {
        await onboardingService.replayOnboarding(user.id, sessionIdRef.current);
      } catch (error) {
        console.error('Failed to replay onboarding:', error);
      }
    }

    localStorage.removeItem('alphaarena_onboarding_completed');
    setCurrentStep(0);
    setCompletedSteps([]);
    setIsCompleted(false);
    startOnboarding();
  }, [user?.id, startOnboarding]);

  /**
   * Check if should show onboarding on mount
   */
  useEffect(() => {
    if (!autoShow) return;

    const checkAndShow = async () => {
      // Check local storage first
      const hasCompleted = localStorage.getItem('alphaarena_onboarding_completed');
      const hasSkipped = localStorage.getItem('alphaarena_onboarding_skipped');

      if (hasCompleted || hasSkipped) {
        return;
      }

      // Check server state for authenticated users
      if (user?.id) {
        try {
          const shouldShow = await onboardingService.shouldShowOnboarding(user.id);
          if (!shouldShow) {
            return;
          }
        } catch (error) {
          console.error('Failed to check onboarding state:', error);
        }
      }

      // Show after delay
      const timer = setTimeout(() => {
        setVisible(true);
        startOnboarding();
      }, showDelay);

      return () => clearTimeout(timer);
    };

    checkAndShow();
  }, [autoShow, showDelay, user?.id, startOnboarding]);

  /**
   * Cleanup on unmount
   */
  useEffect(() => {
    return () => {
      if (driverRef.current) {
        driverRef.current.destroy();
      }
    };
  }, []);

  // Expose replay function globally
  useEffect(() => {
    (window as any).replayOnboarding = handleReplay;
    return () => {
      delete (window as any).replayOnboarding;
    };
  }, [handleReplay]);

  /**
   * Render welcome modal (first step)
   */
  const renderWelcomeModal = () => {
    const firstStep = flow.steps[0];

    return (
      <Modal
        visible={showWelcome}
        onCancel={handleSkip}
        footer={null}
        closable={true}
        closeIcon={<IconClose />}
        maskClosable={false}
        style={{ maxWidth: 520 }}
        className="smart-onboarding-welcome"
      >
        <div className="onboarding-welcome-content">
          {/* Progress indicator */}
          {showProgress && (
            <div className="onboarding-progress-container">
              <Progress
                percent={progress}
                strokeWidth={4}
                showText={false}
                className="onboarding-progress"
              />
              <Text type="secondary" className="onboarding-step-counter">
                步骤 {currentStep + 1} / {totalSteps}
              </Text>
            </div>
          )}

          {/* Icon */}
          <div className="onboarding-icon-wrapper">
            <IconPlayCircle className="onboarding-icon" />
          </div>

          {/* Title and description */}
          <Title heading={4} className="onboarding-title">
            {firstStep.title}
          </Title>
          <Paragraph className="onboarding-description">
            {firstStep.description}
          </Paragraph>

          {/* Feature highlights */}
          <div className="onboarding-features">
            {flow.steps.slice(1, 5).map((step, index) => (
              <Tag key={step.id} className="onboarding-feature-tag">
                {step.title}
              </Tag>
            ))}
          </div>

          {/* Actions */}
          <div className="onboarding-actions">
            <Checkbox
              checked={dontShowAgain}
              onChange={setDontShowAgain}
              className="onboarding-checkbox"
            >
              不再显示
            </Checkbox>

            <Space>
              <Button onClick={handleSkip} type="text">
                跳过
              </Button>
              <Button type="primary" onClick={handleWelcomeContinue}>
                开始引导
                <IconRight style={{ marginLeft: 4 }} />
              </Button>
            </Space>
          </div>
        </div>
      </Modal>
    );
  };

  /**
   * Render completion modal (last step)
   */
  const renderCompletionModal = () => {
    const lastStep = flow.steps[flow.steps.length - 1];

    return (
      <Modal
        visible={isCompleted}
        onCancel={() => setIsCompleted(false)}
        footer={null}
        closable={true}
        closeIcon={<IconClose />}
        style={{ maxWidth: 480 }}
        className="smart-onboarding-complete"
      >
        <div className="onboarding-complete-content">
          <div className="onboarding-icon-wrapper success">
            <IconCheck className="onboarding-icon" />
          </div>

          <Title heading={4}>{lastStep.title}</Title>
          <Paragraph type="secondary">{lastStep.description}</Paragraph>

          {/* Stats */}
          <div className="onboarding-stats">
            <div className="stat-item">
              <Text type="secondary">已完成步骤</Text>
              <Text strong>{completedSteps.length} / {totalSteps}</Text>
            </div>
          </div>

          <Space direction="vertical" style={{ width: '100%' }}>
            <Button type="primary" long onClick={() => setIsCompleted(false)}>
              开始使用
            </Button>
            {allowReplay && (
              <Button type="text" long onClick={handleReplay}>
                <IconPlayCircle style={{ marginRight: 8 }} />
                重新播放引导
              </Button>
            )}
          </Space>
        </div>
      </Modal>
    );
  };

  /**
   * Render floating help button
   */
  const renderHelpButton = () => {
    if (isRunning) return null;

    return (
      <Tooltip content="查看引导教程" position="left">
        <Button
          type="primary"
          shape="circle"
          size="large"
          icon={<IconQuestionCircle />}
          className="onboarding-help-button"
          onClick={handleReplay}
        />
      </Tooltip>
    );
  };

  return (
    <>
      {renderWelcomeModal()}
      {renderCompletionModal()}
      {renderHelpButton()}

      {/* Hidden button to programmatically trigger replay */}
      <button
        id="trigger-onboarding-replay"
        style={{ display: 'none' }}
        onClick={handleReplay}
      />
    </>
  );
};

export default SmartOnboarding;

/**
 * Hook to control onboarding programmatically
 */
export function useOnboarding() {
  const [isAvailable, setIsAvailable] = useState(false);

  useEffect(() => {
    setIsAvailable(typeof window !== 'undefined' && !!(window as any).replayOnboarding);
  }, []);

  const replay = useCallback(() => {
    if ((window as any).replayOnboarding) {
      (window as any).replayOnboarding();
    }
  }, []);

  const triggerReplay = useCallback(() => {
    const btn = document.getElementById('trigger-onboarding-replay');
    if (btn) {
      btn.click();
    }
  }, []);

  return {
    isAvailable,
    replay,
    triggerReplay,
  };
}