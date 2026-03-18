/**
 * AIAssistantButton - Floating AI Assistant Entry Button
 * A floating button that opens the AI Strategy Assistant panel
 */

import React, { useState, useEffect } from 'react';
import { Drawer, Button, Badge, Tooltip, Tag, Spin } from '@arco-design/web-react';
import { IconBulb, IconTrophy } from '@arco-design/web-react/icon';
import AIAssistantPanel from './AIAssistantPanel';

interface UsageInfo {
  planType: 'free' | 'pro';
  messagesToday: number;
  messagesLimit: number;
}

const AIAssistantButton: React.FC = () => {
  const [visible, setVisible] = useState(false);
  const [usageInfo, setUsageInfo] = useState<UsageInfo | null>(null);
  const [loading, setLoading] = useState(true);

  // Fetch usage info on mount
  useEffect(() => {
    fetchUsageInfo();
  }, []);

  const fetchUsageInfo = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('supabase_token') || localStorage.getItem('auth_access_token');
      if (!token) {
        setLoading(false);
        return;
      }

      const response = await fetch('/api/ai/usage', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setUsageInfo(data.data);
      }
    } catch (error) {
      console.error('Failed to fetch usage info:', error);
    } finally {
      setLoading(false);
    }
  };

  // Handle button click - refresh usage info
  const handleClick = () => {
    setVisible(true);
    fetchUsageInfo();
  };

  // Calculate badge status
  const getBadgeStatus = () => {
    if (!usageInfo) return { dot: true, count: 0 };
    if (usageInfo.planType === 'pro') return { dot: false, count: 0 };
    const remaining = usageInfo.messagesLimit - usageInfo.messagesToday;
    if (remaining <= 0) return { dot: true, count: 0, text: 'Limit reached' };
    if (remaining <= 2) return { dot: true, count: remaining };
    return { dot: false, count: 0 };
  };

  const badgeStatus = getBadgeStatus();

  return (
    <>
      {/* Floating Button with usage indicator */}
      <Tooltip
        content={
          usageInfo?.planType === 'pro' 
            ? 'AI Strategy Assistant (Pro)' 
            : usageInfo 
              ? `AI Strategy Assistant (${usageInfo.messagesLimit - usageInfo.messagesToday} messages left today)`
              : 'AI Strategy Assistant'
        }
        position="left"
      >
        <Badge 
          dot={badgeStatus.dot}
          count={badgeStatus.count}
          style={{ 
            position: 'fixed',
            right: 24,
            bottom: 24,
            zIndex: 1000,
          }}
        >
          <Button
            type="primary"
            shape="circle"
            size="large"
            icon={loading ? <Spin size={20} /> : <IconBulb />}
            onClick={handleClick}
            style={{
              width: 56,
              height: 56,
              boxShadow: usageInfo?.planType === 'pro' 
                ? '0 4px 12px rgba(0, 200, 100, 0.4)' 
                : '0 4px 12px rgba(22, 93, 255, 0.4)',
              background: usageInfo?.planType === 'pro' 
                ? 'linear-gradient(135deg, #00c864 0%, #00a64d 100%)' 
                : undefined,
            }}
            aria-label="Open AI Strategy Assistant"
          />
        </Badge>
      </Tooltip>

      {/* AI Assistant Drawer */}
      <Drawer
        title={
          <span>
            <IconBulb style={{ marginRight: 8, color: '#165dff' }} />
            AI 策略助手
            {usageInfo?.planType === 'pro' && (
              <Tag 
                color="green" 
                style={{ marginLeft: 8 }}
                icon={<IconTrophy />}
              >
                Pro
              </Tag>
            )}
          </span>
        }
        placement="right"
        width={450}
        visible={visible}
        onCancel={() => setVisible(false)}
        footer={null}
        unmountOnExit={false}
      >
        <AIAssistantPanel />
      </Drawer>
    </>
  );
};

export default AIAssistantButton;
