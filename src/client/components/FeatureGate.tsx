/**
 * FeatureGate Component
 * Wraps components to check feature access before rendering
 */

import React, { useState, useEffect, useCallback, ReactNode } from 'react';
import { Modal, Button, Spin } from '@arco-design/web-react';
import { IconLock } from '@arco-design/web-react/icon';
import { useSubscription } from '../hooks/useSubscription';
import UpgradeModal from './UpgradeModal';

interface FeatureGateProps {
  featureKey: string;
  featureName: string;
  children: ReactNode;
  fallback?: ReactNode;
  showUpgradeOnLimit?: boolean;
  onLimitReached?: () => void;
}

/**
 * FeatureGate checks if user has access to a feature before rendering children.
 * 
 * Usage:
 * <FeatureGate featureKey="aiAssistant" featureName="AI 助手">
 *   <AIAssistantPanel />
 * </FeatureGate>
 */
const FeatureGate: React.FC<FeatureGateProps> = ({
  featureKey,
  featureName,
  children,
  fallback = null,
  showUpgradeOnLimit = true,
  onLimitReached,
}) => {
  const { subscription, usage, isLoading, isPro } = useSubscription();
  const [upgradeModalVisible, setUpgradeModalVisible] = useState(false);
  const [hasChecked, setHasChecked] = useState(false);

  const checkAccess = useCallback(() => {
    // Pro users have access to everything
    if (isPro) return { hasAccess: true, remaining: -1 };

    const featureUsage = usage[featureKey];
    if (!featureUsage) return { hasAccess: true, remaining: -1 };

    const { limit, currentUsage } = featureUsage;
    if (limit === -1) return { hasAccess: true, remaining: -1 };

    const remaining = limit - currentUsage;
    return { hasAccess: remaining > 0, remaining };
  }, [isPro, usage, featureKey]);

  useEffect(() => {
    if (!isLoading) {
      setHasChecked(true);
    }
  }, [isLoading]);

  const { hasAccess, remaining } = checkAccess();

  const handleUpgrade = () => {
    window.location.href = '/subscription';
  };

  const handleLimitReached = () => {
    if (onLimitReached) {
      onLimitReached();
    } else if (showUpgradeOnLimit) {
      setUpgradeModalVisible(true);
    }
  };

  // Show loading state
  if (isLoading || !hasChecked) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 24 }}>
        <Spin />
      </div>
    );
  }

  // No access - show fallback or upgrade prompt
  if (!hasAccess) {
    if (fallback) {
      return <>{fallback}</>;
    }

    return (
      <>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 32,
            background: 'var(--color-fill-1)',
            borderRadius: 8,
            textAlign: 'center',
          }}
        >
          <IconLock style={{ fontSize: 48, color: '#86909c', marginBottom: 16 }} />
          <div style={{ fontSize: 16, fontWeight: 500, marginBottom: 8 }}>
            {featureName}已达使用限制
          </div>
          <div style={{ color: '#86909c', marginBottom: 16 }}>
            升级到专业版以解锁无限使用
          </div>
          <Button type="primary" onClick={handleUpgrade}>
            立即升级
          </Button>
        </div>
        <UpgradeModal
          visible={upgradeModalVisible}
          onClose={() => setUpgradeModalVisible(false)}
          onUpgrade={handleUpgrade}
          featureName={featureName}
        />
      </>
    );
  }

  // Has access - render children with usage info
  return (
    <>
      {children}
      <UpgradeModal
        visible={upgradeModalVisible}
        onClose={() => setUpgradeModalVisible(false)}
        onUpgrade={handleUpgrade}
        featureName={featureName}
      />
    </>
  );
};

/**
 * useFeatureGate hook
 * Returns access state and handlers for programmatic use
 */
export function useFeatureGate(featureKey: string) {
  const { subscription, usage, isLoading, isPro, refreshSubscription } = useSubscription();
  const [upgradeModalVisible, setUpgradeModalVisible] = useState(false);

  const checkAccess = useCallback(() => {
    if (isPro) return { hasAccess: true, remaining: -1, isNearLimit: false };

    const featureUsage = usage[featureKey];
    if (!featureUsage) return { hasAccess: true, remaining: -1, isNearLimit: false };

    const { limit, currentUsage } = featureUsage;
    if (limit === -1) return { hasAccess: true, remaining: -1, isNearLimit: false };

    const remaining = limit - currentUsage;
    const isNearLimit = remaining <= Math.ceil(limit * 0.2);

    return { hasAccess: remaining > 0, remaining, isNearLimit };
  }, [isPro, usage, featureKey]);

  const showUpgradeModal = useCallback(() => {
    setUpgradeModalVisible(true);
  }, []);

  const hideUpgradeModal = useCallback(() => {
    setUpgradeModalVisible(false);
  }, []);

  const handleUpgrade = useCallback(() => {
    window.location.href = '/subscription';
  }, []);

  return {
    ...checkAccess(),
    isLoading,
    showUpgradeModal,
    hideUpgradeModal,
    handleUpgrade,
    upgradeModalVisible,
    refreshSubscription,
  };
}

export default FeatureGate;
