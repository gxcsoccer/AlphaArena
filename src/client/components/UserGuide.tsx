/**
 * UserGuide Component
 * A guided tour component for new users
 */

import React, { useState, useEffect, useCallback } from 'react';
import { 
  Modal, 
  Typography, 
  Button, 
  Space, 
  Progress, 
  Card,
  Checkbox,
  Divider,
} from '@arco-design/web-react';
import {
  IconRight,
  IconLeft,
  IconCheck,
  IconClose,
  IconBook,
  IconRobot,
  IconNotification,
  IconTrophy,
  IconExperiment,
  IconDashboard,
  IconStorage,
} from '@arco-design/web-react/icon';

const { Title, Text, Paragraph } = Typography;

interface GuideStep {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  details: string[];
  link?: string;
}

const GUIDE_STORAGE_KEY = 'alphaarena_guide_completed';

const guideSteps: GuideStep[] = [
  {
    id: 'welcome',
    title: '欢迎来到 AlphaArena',
    description: 'AlphaArena 是一个专业的算法交易平台，帮助您自动化交易策略。',
    icon: <IconTrophy style={{ fontSize: 48, color: '#165dff' }} />,
    details: [
      '模拟交易 - 无需真实资金即可开始',
      '智能策略 - 多种内置策略供您选择',
      'AI 助手 - 智能分析和建议',
      '实时监控 - 价格提醒和风险预警',
    ],
  },
  {
    id: 'market',
    title: '市场数据',
    description: '在行情页面查看实时市场数据和进行交易。',
    icon: <IconDashboard style={{ fontSize: 48, color: '#00b42a' }} />,
    details: [
      '选择交易对查看实时价格',
      '在交易面板快速下单',
      '查看订单簿深度数据',
      '设置价格提醒跟踪市场',
    ],
    link: '/',
  },
  {
    id: 'strategies',
    title: '交易策略',
    description: '使用内置策略或自定义策略进行自动化交易。',
    icon: <IconExperiment style={{ fontSize: 48, color: '#ff7d00' }} />,
    details: [
      '选择适合的策略类型',
      '设置策略参数',
      '启动策略自动执行',
      '监控策略运行状态',
    ],
    link: '/strategies',
  },
  {
    id: 'ai-assistant',
    title: 'AI 策略助手',
    description: '使用 AI 助手分析市场、优化策略。',
    icon: <IconRobot style={{ fontSize: 48, color: '#722ed1' }} />,
    details: [
      '市场趋势分析',
      '策略优化建议',
      '风险管理指导',
      '交易知识解答',
    ],
  },
  {
    id: 'alerts',
    title: '价格提醒',
    description: '设置价格提醒，不错过任何交易机会。',
    icon: <IconNotification style={{ fontSize: 48, color: '#f53f3f' }} />,
    details: [
      '设置目标价格',
      '选择通知方式',
      '循环提醒持续监控',
      '管理所有提醒',
    ],
  },
  {
    id: 'subscription',
    title: '订阅计划',
    description: '选择适合您的订阅计划，解锁更多功能。',
    icon: <IconStorage style={{ fontSize: 48, color: '#165dff' }} />,
    details: [
      '免费版：体验核心功能',
      '专业版：解锁所有功能',
      '企业版：团队协作支持',
      '年付优惠：省2个月费用',
    ],
    link: '/subscription',
  },
];

interface UserGuideProps {
  /** Whether to auto-show the guide */
  autoShow?: boolean;
  /** Callback when guide is completed */
  onComplete?: () => void;
  /** Callback when guide is skipped */
  onSkip?: () => void;
}

/**
 * UserGuide provides a step-by-step introduction for new users.
 * 
 * @example
 * <UserGuide autoShow={true} />
 */
const UserGuide: React.FC<UserGuideProps> = ({
  autoShow = true,
  onComplete,
  onSkip,
}) => {
  const [visible, setVisible] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [_completed, setCompleted] = useState(false);
  const [dontShowAgain, setDontShowAgain] = useState(false);

  useEffect(() => {
    if (autoShow) {
      // Check if user has completed the guide before
      const hasCompleted = localStorage.getItem(GUIDE_STORAGE_KEY);
      if (!hasCompleted) {
        // Show guide after a short delay
        const timer = setTimeout(() => {
          setVisible(true);
        }, 1000);
        return () => clearTimeout(timer);
      }
    }
  }, [autoShow]);

  const handleComplete = useCallback(() => {
    setCompleted(true);
    if (dontShowAgain) {
      localStorage.setItem(GUIDE_STORAGE_KEY, 'true');
    }
    setVisible(false);
    onComplete?.();
  }, [dontShowAgain, onComplete]);

  const handleNext = useCallback(() => {
    if (currentStep < guideSteps.length - 1) {
      setCurrentStep(prev => prev + 1);
    } else {
      handleComplete();
    }
  }, [currentStep, handleComplete]);

  const handlePrev = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  }, [currentStep]);

  const handleSkip = useCallback(() => {
    if (dontShowAgain) {
      localStorage.setItem(GUIDE_STORAGE_KEY, 'true');
    }
    setVisible(false);
    onSkip?.();
  }, [dontShowAgain, onSkip]);

  const handleClose = useCallback(() => {
    setVisible(false);
  }, []);

  const step = guideSteps[currentStep];
  const progress = ((currentStep + 1) / guideSteps.length) * 100;

  return (
    <>
      <Modal
        visible={visible}
        onCancel={handleSkip}
        footer={null}
        closable={true}
        closeIcon={<IconClose />}
        maskClosable={false}
        style={{ maxWidth: 560 }}
        unmountOnExit={false}
      >
        {/* Progress bar */}
        <div style={{ marginBottom: 24 }}>
          <Progress
            percent={progress}
            strokeWidth={4}
            showText={false}
            style={{ marginBottom: 8 }}
          />
          <Text type="secondary" style={{ fontSize: 12 }}>
            步骤 {currentStep + 1} / {guideSteps.length}
          </Text>
        </div>

        {/* Step content */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ marginBottom: 24 }}>
            {step.icon}
          </div>
          <Title heading={4} style={{ marginBottom: 8 }}>{step.title}</Title>
          <Paragraph type="secondary">{step.description}</Paragraph>
        </div>

        {/* Details */}
        <Card bordered={false} style={{ background: 'var(--color-fill-1)', marginBottom: 24 }}>
          <ul style={{ margin: 0, paddingLeft: 20 }}>
            {step.details.map((detail, index) => (
              <li key={index} style={{ marginBottom: index < step.details.length - 1 ? 8 : 0 }}>
                <Text>{detail}</Text>
              </li>
            ))}
          </ul>
        </Card>

        {/* Link */}
        {step.link && (
          <div style={{ textAlign: 'center', marginBottom: 24 }}>
            <Button 
              type="text" 
              icon={<IconBook />}
              onClick={() => {
                window.location.href = step.link!;
                handleClose();
              }}
            >
              前往查看
            </Button>
          </div>
        )}

        <Divider style={{ margin: '16px 0' }} />

        {/* Navigation */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Checkbox 
            checked={dontShowAgain}
            onChange={setDontShowAgain}
          >
            不再显示
          </Checkbox>

          <Space>
            {currentStep > 0 && (
              <Button onClick={handlePrev} icon={<IconLeft />}>
                上一步
              </Button>
            )}
            <Button type="primary" onClick={handleNext}>
              {currentStep < guideSteps.length - 1 ? (
                <>
                  下一步
                  <IconRight style={{ marginLeft: 4 }} />
                </>
              ) : (
                <>
                  开始使用
                  <IconCheck style={{ marginLeft: 4 }} />
                </>
              )}
            </Button>
          </Space>
        </div>
      </Modal>

      {/* Re-open guide button */}
      <Button
        type="text"
        icon={<IconBook />}
        onClick={() => {
          setCurrentStep(0);
          setVisible(true);
        }}
        style={{ display: 'none' }}
        id="reopen-guide-btn"
      />
    </>
  );
};

export default UserGuide;

/**
 * Hook to show the user guide programmatically
 */
export function useUserGuide() {
  const [completed, setCompleted] = useState(false);

  const showGuide = useCallback(() => {
    const btn = document.getElementById('reopen-guide-btn');
    if (btn) {
      btn.click();
    }
  }, []);

  const resetGuide = useCallback(() => {
    localStorage.removeItem(GUIDE_STORAGE_KEY);
    setCompleted(false);
  }, []);

  const isCompleted = useCallback(() => {
    return !!localStorage.getItem(GUIDE_STORAGE_KEY);
  }, []);

  return {
    showGuide,
    resetGuide,
    isCompleted,
    completed,
  };
}