/**
 * SocialShare Component
 * Provides social sharing functionality with UTM tracking and statistics
 */

import React, { useState, useCallback, useEffect } from 'react';
import { 
  Button, 
  Space, 
  Message, 
  Popover,
  Typography,
  Tooltip,
  Modal,
  QRCode,
  Spin,
} from '@arco-design/web-react';
import {
  IconShareAlt,
  IconCopy,
  IconCheck,
  IconWechat,
} from '@arco-design/web-react/icon';
import { generateShareUrl, copyShareUrl } from '../utils/seo';
import { 
  generateTradeResultImage,
  generateStrategyPerformanceImage,
  generateReferralImage,
  generateProfileImage,
  generateLeaderboardImage,
  generateGenericImage,
} from '../utils/shareImageGenerator';

const { Text, Title } = Typography;

// Types
export type SharePlatform = 
  | 'wechat' 
  | 'wechat_moments' 
  | 'weibo' 
  | 'twitter' 
  | 'linkedin' 
  | 'facebook' 
  | 'clipboard' 
  | 'native';

export type ShareContentType = 
  | 'profile' 
  | 'trade_result' 
  | 'strategy_performance' 
  | 'referral_link'
  | 'leaderboard'
  | 'custom';

export interface SocialShareProps {
  /** Share title */
  title?: string;
  /** Share description */
  description?: string;
  /** UTM source for tracking */
  source?: string;
  /** UTM campaign for tracking */
  campaign?: string;
  /** Content type for tracking */
  contentType?: ShareContentType;
  /** Content ID for tracking */
  contentId?: string;
  /** Referral code to include */
  referralCode?: string;
  /** Compact mode (icon only) */
  compact?: boolean;
  /** Show WeChat QR code option */
  showWeChatQR?: boolean;
  /** Share image data for generation */
  shareImageData?: {
    type: 'trade_result' | 'strategy_performance' | 'referral' | 'profile' | 'leaderboard';
    data: Record<string, unknown>;
  };
  /** Callback when share is successful */
  onShare?: (platform: SharePlatform) => void;
}

interface SharePlatformConfig {
  name: string;
  icon: React.ReactNode;
  getUrl: (url: string, title: string, description?: string) => string;
  platform: SharePlatform;
}

// Define share platforms
const sharePlatforms: SharePlatformConfig[] = [
  {
    name: '微信',
    icon: <IconWechat style={{ fontSize: 20, color: '#07c160' }} />,
    getUrl: () => '#wechat', // WeChat requires QR code
    platform: 'wechat',
  },
  {
    name: '微博',
    icon: <span style={{ fontSize: 20 }}>📱</span>,
    getUrl: (url, title) => `https://service.weibo.com/share/share.php?url=${encodeURIComponent(url)}&title=${encodeURIComponent(title)}`,
    platform: 'weibo',
  },
  {
    name: 'Twitter',
    icon: <span style={{ fontSize: 20 }}>🐦</span>,
    getUrl: (url, title) => `https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}`,
    platform: 'twitter',
  },
  {
    name: 'LinkedIn',
    icon: <span style={{ fontSize: 20 }}>💼</span>,
    getUrl: (url) => `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`,
    platform: 'linkedin',
  },
  {
    name: 'Facebook',
    icon: <span style={{ fontSize: 20 }}>📘</span>,
    getUrl: (url) => `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
    platform: 'facebook',
  },
];

const SocialShare: React.FC<SocialShareProps> = ({
  title = 'AlphaArena - 专业级算法交易平台',
  description = 'AI 驱动的智能策略，无风险的模拟交易环境',
  source = 'web',
  campaign = 'share',
  contentType = 'custom',
  contentId,
  referralCode,
  compact = false,
  showWeChatQR = true,
  shareImageData,
  onShare,
}) => {
  const [copied, setCopied] = useState(false);
  const [popoverVisible, setPopoverVisible] = useState(false);
  const [wechatModalVisible, setWechatModalVisible] = useState(false);
  const [shareImageUrl, setShareImageUrl] = useState<string | null>(null);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [isRecording, setIsRecording] = useState(false);

  // Generate share URL with UTM parameters
  const shareUrl = generateShareUrl(source, 'social', campaign);
  const fullShareUrl = referralCode 
    ? `${shareUrl}&ref=${referralCode}` 
    : shareUrl;
  const shareTitle = `${title}\n${description}`;

  // Generate share image when image data is provided
  useEffect(() => {
    if (shareImageData) {
      setIsGeneratingImage(true);
      try {
        let imageUrl: string;
        switch (shareImageData.type) {
          case 'trade_result':
            imageUrl = generateTradeResultImage(shareImageData.data as any);
            break;
          case 'strategy_performance':
            imageUrl = generateStrategyPerformanceImage(shareImageData.data as any);
            break;
          case 'referral':
            imageUrl = generateReferralImage(shareImageData.data as any);
            break;
          case 'profile':
            imageUrl = generateProfileImage(shareImageData.data as any);
            break;
          case 'leaderboard':
            imageUrl = generateLeaderboardImage(shareImageData.data as any);
            break;
          default:
            imageUrl = generateGenericImage(title, description);
        }
        setShareImageUrl(imageUrl);
      } catch (error) {
        console.error('Failed to generate share image:', error);
      } finally {
        setIsGeneratingImage(false);
      }
    }
  }, [shareImageData, title, description]);

  // Record share event to backend
  const recordShareEvent = useCallback(async (platform: SharePlatform) => {
    if (isRecording) return;
    
    setIsRecording(true);
    try {
      const response = await fetch('/api/share/record', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          platform,
          contentType,
          contentId,
          referralCode,
          utmSource: source,
          utmMedium: 'social',
          utmCampaign: campaign,
          shareUrl: fullShareUrl,
        }),
      });

      if (!response.ok) {
        console.warn('Failed to record share event');
      }
    } catch (error) {
      console.warn('Failed to record share event:', error);
    } finally {
      setIsRecording(false);
    }
  }, [contentType, contentId, referralCode, source, campaign, fullShareUrl, isRecording]);

  // Handle copy to clipboard
  const handleCopy = useCallback(async () => {
    const success = await copyShareUrl(source);
    if (success) {
      setCopied(true);
      Message.success('链接已复制到剪贴板');
      await recordShareEvent('clipboard');
      onShare?.('clipboard');
      setTimeout(() => setCopied(false), 2000);
    } else {
      Message.error('复制失败，请手动复制');
    }
  }, [source, recordShareEvent, onShare]);

  // Handle native share
  const handleNativeShare = useCallback(async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title,
          text: description,
          url: fullShareUrl,
        });
        await recordShareEvent('native');
        onShare?.('native');
      } catch (err) {
        // User cancelled or error
        console.log('Share cancelled');
      }
    } else {
      setPopoverVisible(true);
    }
  }, [title, description, fullShareUrl, recordShareEvent, onShare]);

  // Handle platform share
  const handlePlatformShare = useCallback(async (platformConfig: SharePlatformConfig) => {
    if (platformConfig.platform === 'wechat') {
      // Show WeChat QR code modal
      setWechatModalVisible(true);
      setPopoverVisible(false);
      await recordShareEvent('wechat');
      onShare?.('wechat');
      return;
    }

    const url = platformConfig.getUrl(fullShareUrl, shareTitle);
    window.open(url, '_blank', 'width=600,height=400');
    await recordShareEvent(platformConfig.platform);
    onShare?.(platformConfig.platform);
    setPopoverVisible(false);
  }, [fullShareUrl, shareTitle, recordShareEvent, onShare]);

  // Handle WeChat moments share (copy image to clipboard)
  const handleWeChatMomentsShare = useCallback(async () => {
    if (shareImageUrl) {
      try {
        // Convert data URL to blob
        const response = await fetch(shareImageUrl);
        const blob = await response.blob();
        await navigator.clipboard.write([
          new ClipboardItem({ [blob.type]: blob }),
        ]);
        Message.success('图片已复制，可粘贴到微信朋友圈');
        await recordShareEvent('wechat_moments');
        onShare?.('wechat_moments');
      } catch (error) {
        console.error('Failed to copy image:', error);
        Message.error('复制图片失败，请手动保存');
      }
    } else {
      Message.info('请复制链接后分享到朋友圈');
      await handleCopy();
    }
    setWechatModalVisible(false);
  }, [shareImageUrl, recordShareEvent, onShare, handleCopy]);

  // Share dropdown content
  const shareContent = (
    <div style={{ padding: '8px 0', minWidth: 200 }}>
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
        
        {/* Generated share image preview */}
        {shareImageUrl && (
          <div style={{ marginTop: 12 }}>
            <Text type="secondary" style={{ fontSize: 12, marginBottom: 4, display: 'block' }}>
              分享图片
            </Text>
            <img 
              src={shareImageUrl} 
              alt="Share preview" 
              style={{ 
                width: '100%', 
                borderRadius: 8, 
                border: '1px solid var(--color-border)' 
              }} 
            />
          </div>
        )}
        
        <div style={{ marginTop: 12 }}>
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

  return (
    <>
      {/* Compact mode: just an icon button */}
      {compact ? (
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
      ) : (
        // Full mode: button with dropdown
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
      )}

      {/* WeChat QR Code Modal */}
      <Modal
        title={
          <Space>
            <IconWechat style={{ color: '#07c160' }} />
            <span>微信分享</span>
          </Space>
        }
        visible={wechatModalVisible}
        onCancel={() => setWechatModalVisible(false)}
        footer={null}
        style={{ textAlign: 'center' }}
      >
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          <Text type="secondary">
            使用微信扫描二维码访问
          </Text>
          
          <div style={{ padding: 16, background: '#f7f7f7', borderRadius: 8 }}>
            <QRCode 
              value={fullShareUrl}
              size={200}
              bgColor="#ffffff"
              fgColor="#000000"
            />
          </div>

          <Text type="secondary" style={{ fontSize: 12 }}>
            {fullShareUrl}
          </Text>

          <Space>
            <Button 
              type="primary" 
              icon={<IconCopy />}
              onClick={handleCopy}
            >
              复制链接
            </Button>
            {shareImageUrl && (
              <Button 
                type="outline"
                onClick={handleWeChatMomentsShare}
              >
                复制图片发朋友圈
              </Button>
            )}
          </Space>
        </Space>
      </Modal>
    </>
  );
};

/**
 * Hook for programmatic sharing with tracking
 */
export function useSocialShare() {
  const share = useCallback(async (
    title: string,
    description: string,
    url?: string,
    options?: {
      platform?: SharePlatform;
      contentType?: ShareContentType;
      referralCode?: string;
    }
  ): Promise<boolean> => {
    const shareUrl = url || generateShareUrl('web', 'social', 'share');
    const fullUrl = options?.referralCode 
      ? `${shareUrl}&ref=${options.referralCode}` 
      : shareUrl;
    
    // Record share event
    if (options?.platform && options?.contentType) {
      try {
        await fetch('/api/share/record', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            platform: options.platform,
            contentType: options.contentType,
            referralCode: options.referralCode,
            utmSource: 'web',
            utmMedium: 'social',
            utmCampaign: 'share',
            shareUrl: fullUrl,
          }),
        });
      } catch {
        // Ignore recording errors
      }
    }
    
    if (navigator.share) {
      try {
        await navigator.share({
          title,
          text: description,
          url: fullUrl,
        });
        return true;
      } catch {
        return false;
      }
    }
    
    // Fallback to clipboard
    try {
      await navigator.clipboard.writeText(fullUrl);
      return true;
    } catch {
      return false;
    }
  }, []);

  return { share };
}

export default SocialShare;