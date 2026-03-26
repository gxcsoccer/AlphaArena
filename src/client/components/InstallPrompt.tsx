/**
 * Install Prompt Component
 * 
 * Issue #628: PWA 支持与离线能力
 * 
 * Shows a prompt to install the app as a PWA on supported browsers.
 * Uses the beforeinstallprompt event for deferred installation.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Button, Typography, Space } from '@arco-design/web-react';
import { IconDownload, IconClose } from '@arco-design/web-react/icon';

const { Title, Text } = Typography;

// Type for the BeforeInstallPromptEvent
interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

interface InstallPromptState {
  deferredPrompt: BeforeInstallPromptEvent | null;
  isInstallable: boolean;
  isInstalled: boolean;
}

/**
 * Hook to manage PWA install prompt
 */
export function usePWAInstall() {
  const [state, setState] = useState<InstallPromptState>({
    deferredPrompt: null,
    isInstallable: false,
    isInstalled: false,
  });

  useEffect(() => {
    // Check if already installed (standalone mode)
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true;
    
    if (isStandalone) {
      setState(prev => ({ ...prev, isInstalled: true }));
      return;
    }

    // Listen for the beforeinstallprompt event
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      const promptEvent = e as BeforeInstallPromptEvent;
      
      setState(prev => ({
        ...prev,
        deferredPrompt: promptEvent,
        isInstallable: true,
      }));
      
      console.log('[PWA] Install prompt available');
    };

    // Listen for app installed event
    const handleAppInstalled = () => {
      console.log('[PWA] App installed successfully');
      setState(prev => ({
        ...prev,
        deferredPrompt: null,
        isInstallable: false,
        isInstalled: true,
      }));
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const install = useCallback(async () => {
    if (!state.deferredPrompt) {
      console.log('[PWA] No deferred prompt available');
      return false;
    }

    try {
      // Show the install prompt
      await state.deferredPrompt.prompt();
      
      // Wait for the user's response
      const { outcome } = await state.deferredPrompt.userChoice;
      
      console.log('[PWA] Install prompt outcome:', outcome);
      
      if (outcome === 'accepted') {
        setState(prev => ({
          ...prev,
          deferredPrompt: null,
          isInstallable: false,
          isInstalled: true,
        }));
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('[PWA] Install error:', error);
      return false;
    }
  }, [state.deferredPrompt]);

  return {
    ...state,
    install,
  };
}

/**
 * Install Prompt Component Props
 */
interface InstallPromptProps {
  /** Auto-show the prompt after a delay (default: true) */
  autoShow?: boolean;
  /** Delay before auto-show in ms (default: 5000) */
  autoShowDelay?: number;
  /** Callback when install is accepted */
  onInstall?: () => void;
  /** Callback when prompt is dismissed */
  onDismiss?: () => void;
}

/**
 * Install Prompt Component
 * 
 * Shows a floating card prompting the user to install the PWA.
 */
const InstallPrompt: React.FC<InstallPromptProps> = ({
  autoShow = true,
  autoShowDelay = 5000,
  onInstall,
  onDismiss,
}) => {
  const { isInstallable, isInstalled, install } = usePWAInstall();
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  // Check if we should show the prompt
  useEffect(() => {
    if (!autoShow || !isInstallable || isInstalled || dismissed) {
      return;
    }

    // Check if user has previously dismissed the prompt
    const dismissedAt = localStorage.getItem('pwa-install-dismissed');
    if (dismissedAt) {
      const dismissedTime = parseInt(dismissedAt, 10);
      const daysSinceDismissed = (Date.now() - dismissedTime) / (1000 * 60 * 60 * 24);
      
      // Don't show again for 7 days after dismissal
      if (daysSinceDismissed < 7) {
        return;
      }
    }

    // Show prompt after delay
    const timer = setTimeout(() => {
      setVisible(true);
    }, autoShowDelay);

    return () => clearTimeout(timer);
  }, [autoShow, autoShowDelay, isInstallable, isInstalled, dismissed]);

  const handleInstall = async () => {
    const success = await install();
    if (success) {
      setVisible(false);
      onInstall?.();
    }
  };

  const handleDismiss = () => {
    setVisible(false);
    setDismissed(true);
    // Remember dismissal for 7 days
    localStorage.setItem('pwa-install-dismissed', Date.now().toString());
    onDismiss?.();
  };

  // Don't render if not applicable
  if (isInstalled || !isInstallable || !visible) {
    return null;
  }

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 24,
        right: 24,
        maxWidth: 360,
        background: 'var(--color-bg-2)',
        borderRadius: 12,
        boxShadow: '0 4px 24px rgba(0, 0, 0, 0.15)',
        padding: 20,
        zIndex: 1000,
        border: '1px solid var(--color-border)',
      }}
    >
      {/* Close button */}
      <button
        onClick={handleDismiss}
        style={{
          position: 'absolute',
          top: 12,
          right: 12,
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: 4,
          color: 'var(--color-text-3)',
        }}
        aria-label="关闭"
      >
        <IconClose style={{ fontSize: 16 }} />
      </button>

      {/* Icon */}
      <div
        style={{
          width: 56,
          height: 56,
          marginBottom: 16,
          borderRadius: 14,
          background: 'linear-gradient(135deg, #3B82F6 0%, #8B5CF6 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <IconDownload style={{ fontSize: 28, color: '#fff' }} />
      </div>

      {/* Title */}
      <Title heading={5} style={{ marginBottom: 8 }}>
        安装 AlphaArena
      </Title>

      {/* Description */}
      <Text style={{ color: 'var(--color-text-2)', display: 'block', marginBottom: 16 }}>
        将 AlphaArena 添加到主屏幕，享受更流畅的交易体验
      </Text>

      {/* Benefits */}
      <div
        style={{
          background: 'var(--color-fill-1)',
          borderRadius: 8,
          padding: 12,
          marginBottom: 16,
          fontSize: 13,
        }}
      >
        <div style={{ color: 'var(--color-text-2)' }}>✅ 离线访问已缓存数据</div>
        <div style={{ color: 'var(--color-text-2)', marginTop: 4 }}>✅ 更快的启动速度</div>
        <div style={{ color: 'var(--color-text-2)', marginTop: 4 }}>✅ 类原生应用体验</div>
      </div>

      {/* Buttons */}
      <Space size="medium">
        <Button size="small" onClick={handleDismiss}>
          稍后再说
        </Button>
        <Button type="primary" size="small" onClick={handleInstall}>
          立即安装
        </Button>
      </Space>
    </div>
  );
};

/**
 * Install Button Component
 * 
 * A simple button that triggers the install prompt when clicked.
 * Use this for manual install triggers (e.g., in settings).
 */
export const InstallButton: React.FC<{ className?: string; style?: React.CSSProperties }> = ({
  className,
  style,
}) => {
  const { isInstallable, isInstalled, install } = usePWAInstall();
  const [installing, setInstalling] = useState(false);

  const handleClick = async () => {
    setInstalling(true);
    await install();
    setInstalling(false);
  };

  if (isInstalled) {
    return (
      <Button disabled icon={<IconDownload />}>
        已安装
      </Button>
    );
  }

  if (!isInstallable) {
    return null;
  }

  return (
    <Button
      type="primary"
      icon={<IconDownload />}
      loading={installing}
      onClick={handleClick}
      className={className}
      style={style}
    >
      安装应用
    </Button>
  );
};

export default InstallPrompt;