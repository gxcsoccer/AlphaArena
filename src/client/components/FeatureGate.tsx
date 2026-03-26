/**
 * FeatureGate Component
 * Wraps components to check feature access before rendering
 */

import React, { useState, useEffect, useCallback, ReactNode } from 'react';
import { Button, Spin } from '@arco-design/web-react';
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
  const { loading, isPro, isEnterprise, checkFeatureLimit } = useSubscription();
  const [upgradeModalVisible, setUpgradeModalVisible] = useState(false);
  const [hasChecked, setHasChecked] = useState(false);
  const [limitState, setLimitState] = useState<{ allowed: boolean; current: number; limit: number }>({
    allowed: true,
    current: 0,
    limit: -1,
  });

  // Check feature limit on mount
  useEffect(() => {
    const checkLimit = async () => {
      if (isPro || isEnterprise) {
        // Pro and Enterprise users have access to everything
        setLimitState({ allowed: true, current: 0, limit: -1 });
        return;
      }
      
      const result = await checkFeatureLimit(featureKey);
      setLimitState(result);
    };
    
    if (!loading) {
      checkLimit();
    }
  }, [loading, featureKey, checkFeatureLimit, isPro, isEnterprise]);

  useEffect(() => {
    if (!loading) {
      setHasChecked(true);
    }
  }, [loading]);

  const hasAccess = limitState.allowed;

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
  if (loading || !hasChecked) {
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
  const { loading, isPro, isEnterprise, checkFeatureLimit, refresh } = useSubscription();
  const [upgradeModalVisible, setUpgradeModalVisible] = useState(false);
  const [limitState, setLimitState] = useState<{
    allowed: boolean;
    current: number;
    limit: number;
  }>({
    allowed: true,
    current: 0,
    limit: -1,
  });

  // Check feature limit
  useEffect(() => {
    const checkLimit = async () => {
      if (isPro || isEnterprise) {
        setLimitState({ allowed: true, current: 0, limit: -1 });
        return;
      }
      
      const result = await checkFeatureLimit(featureKey);
      setLimitState(result);
    };
    
    if (!loading) {
      checkLimit();
    }
  }, [loading, featureKey, checkFeatureLimit, isPro, isEnterprise]);

  const isNearLimit = limitState.limit > 0 && 
    limitState.current > 0 && 
    (limitState.limit - limitState.current) <= Math.ceil(limitState.limit * 0.2);

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
    hasAccess: limitState.allowed,
    remaining: limitState.limit === -1 ? -1 : limitState.limit - limitState.current,
    isNearLimit,
    isLoading: loading,
    showUpgradeModal,
    hideUpgradeModal,
    handleUpgrade,
    upgradeModalVisible,
    refreshSubscription: refresh,
  };
}

export default FeatureGate;
