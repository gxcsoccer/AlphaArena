/**
 * SocialShare Component
 * Provides social sharing functionality with UTM tracking
 */

import React, { useState, useCallback } from 'react';
import { 
  Button, 
  Space, 
  Message, 
  Popover,
  Typography,
  Tooltip,
} from '@arco-design/web-react';
import {
  IconShareAlt,
  IconCopy,
  IconCheck,
} from '@arco-design/web-react/icon';
import { generateShareUrl, copyShareUrl } from '../utils/seo';

const { Text } = Typography;

interface SocialShareProps {
  /** Share title */
  title?: string;
  /** Share description */
  description?: string;
  /** UTM source for tracking */
  source?: string;
  /** UTM campaign for tracking */
  campaign?: string;
  /** Compact mode (icon only) */
  compact?: boolean;
  /** Callback when share is successful */
  onShare?: (platform: string) => void;
}

interface SharePlatform {
  name: string;
  icon: React.ReactNode;
  getUrl: (url: string, title: string) => string;
}

// Define share platforms
const sharePlatforms: SharePlatform[] = [
  {
    name: '微信',
    icon: <span style={{ fontSize: 20 }}>💬</span>,
    getUrl: (url, title) => `https://service.weibo.com/share/share.php?url=${encodeURIComponent(url)}&title=${encodeURIComponent(title)}`,
  },
  {
    name: '微博',
    icon: <span style={{ fontSize: 20 }}>📱</span>,
    getUrl: (url, title) => `https://service.weibo.com/share/share.php?url=${encodeURIComponent(url)}&title=${encodeURIComponent(title)}`,
  },
  {
    name: 'Twitter',
    icon: <span style={{ fontSize: 20 }}>🐦</span>,
    getUrl: (url, title) => `https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}`,
  },
  {
    name: 'LinkedIn',
    icon: <span style={{ fontSize: 20 }}>💼</span>,
    getUrl: (url, title) => `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`,
  },
  {
    name: 'Facebook',
    icon: <span style={{ fontSize: 20 }}>📘</span>,
    getUrl: (url) => `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
  },
];

const SocialShare: React.FC<SocialShareProps> = ({
  title = 'AlphaArena - 专业级算法交易平台',
  description = 'AI 驱动的智能策略，无风险的模拟交易环境',
  source = 'web',
  campaign = 'share',
  compact = false,
  onShare,
}) => {
  const [copied, setCopied] = useState(false);
  const [popoverVisible, setPopoverVisible] = useState(false);

  // Generate share URL with UTM parameters
  const shareUrl = generateShareUrl(source, 'social', campaign);
  const shareTitle = `${title}\n${description}`;

  // Handle copy to clipboard
  const handleCopy = useCallback(async () => {
    const success = await copyShareUrl(source);
    if (success) {
      setCopied(true);
      Message.success('链接已复制到剪贴板');
      onShare?.('clipboard');
      setTimeout(() => setCopied(false), 2000);
    } else {
      Message.error('复制失败，请手动复制');
    }
  }, [source, onShare]);

  // Handle native share
  const handleNativeShare = useCallback(async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title,
          text: description,
          url: shareUrl,
        });
        onShare?.('native');
      } catch (err) {
        // User cancelled or error
        console.log('Share cancelled');
      }
    } else {
      setPopoverVisible(true);
    }
  }, [title, description, shareUrl, onShare]);

  // Handle platform share
  const handlePlatformShare = useCallback((platform: SharePlatform) => {
    const url = platform.getUrl(shareUrl, shareTitle);
    window.open(url, '_blank', 'width=600,height=400');
    onShare?.(platform.name);
    setPopoverVisible(false);
  }, [shareUrl, shareTitle, onShare]);

  // Share dropdown content
  const shareContent = (
    <div style={{ padding: '8px 0' }}>
      <Space direction="vertical" size="small" style={{ width: '100%' }}>
        <Text type="secondary" style={{ fontSize: 12, marginBottom: 8 }}>
          分享到
        </Text>
        <Space wrap>
          {sharePlatforms.map((platform) => (
            <Tooltip key={platform.name} content={platform.name}>
              <Button
                type="text"
                icon={platform.icon}
                onClick={() => handlePlatformShare(platform)}
                style={{ padding: 8 }}
              />
            </Tooltip>
          ))}
        </Space>
        <div style={{ marginTop: 8 }}>
          <Button
            type="outline"
            icon={copied ? <IconCheck /> : <IconCopy />}
            onClick={handleCopy}
            long
            size="small"
          >
            {copied ? '已复制' : '复制链接'}
          </Button>
        </div>
      </Space>
    </div>
  );

  // Compact mode: just an icon button
  if (compact) {
    return (
      <Popover
        content={shareContent}
        position="top"
        visible={popoverVisible}
        onVisibleChange={setPopoverVisible}
      >
        <Button
          type="text"
          icon={<IconShareAlt />}
          onClick={handleNativeShare}
        />
      </Popover>
    );
  }

  // Full mode: button with dropdown
  return (
    <Popover
      content={shareContent}
      position="top"
      visible={popoverVisible}
      onVisibleChange={setPopoverVisible}
    >
      <Button
        type="outline"
        icon={<IconShareAlt />}
        onClick={handleNativeShare}
      >
        分享
      </Button>
    </Popover>
  );
};

export default SocialShare;

/**
 * Hook for programmatic sharing
 */
export function useSocialShare() {
  const share = useCallback(async (
    title: string,
    description: string,
    url?: string
  ): Promise<boolean> => {
    const shareUrl = url || generateShareUrl('web', 'social', 'share');
    
    if (navigator.share) {
      try {
        await navigator.share({
          title,
          text: description,
          url: shareUrl,
        });
        return true;
      } catch {
        return false;
      }
    }
    
    // Fallback to clipboard
    try {
      await navigator.clipboard.writeText(shareUrl);
      return true;
    } catch {
      return false;
    }
  }, []);

  return { share };
}