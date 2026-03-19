/**
 * HelpTooltip Component
 * A tooltip component that displays help information with optional link to documentation
 */

import React, { useState } from 'react';
import { Tooltip, Typography, Button } from '@arco-design/web-react';
import { IconQuestionCircle, IconBook } from '@arco-design/web-react/icon';

const { _Text, Paragraph } = Typography;

interface HelpTooltipProps {
  /** Help content to display */
  content: string;
  /** Optional title */
  title?: string;
  /** Link to documentation page */
  docLink?: string;
  /** Position of tooltip */
  position?: 'top' | 'bottom' | 'left' | 'right';
  /** Max width of tooltip */
  maxWidth?: number;
  /** Children element to wrap */
  children?: React.ReactNode;
  /** Whether to show icon */
  showIcon?: boolean;
  /** Icon size */
  iconSize?: number;
}

/**
 * HelpTooltip provides contextual help information via a tooltip.
 * 
 * @example
 * // Basic usage
 * <HelpTooltip content="This is a help message" />
 * 
 * @example
 * // With documentation link
 * <HelpTooltip 
 *   content="Subscription plans determine your feature limits"
 *   docLink="/docs/user-guide/subscription.md"
 * />
 * 
 * @example
 * // Wrapping an element
 * <HelpTooltip content="Click to learn more">
 *   <span>Feature Name</span>
 * </HelpTooltip>
 */
const HelpTooltip: React.FC<HelpTooltipProps> = ({
  content,
  title,
  docLink,
  position = 'top',
  maxWidth = 320,
  children,
  showIcon = true,
  iconSize = 14,
}) => {
  const [visible, setVisible] = useState(false);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  const handleDocClick = () => {
    if (docLink) {
      window.open(docLink, '_blank');
    }
    setVisible(false);
  };

  const tooltipContent = (
    <div style={{ maxWidth }} onClick={handleClick}>
      {title && (
        <div style={{ fontWeight: 500, marginBottom: 8, fontSize: 14 }}>
          {title}
        </div>
      )}
      <Paragraph style={{ margin: 0, color: 'inherit', fontSize: 13 }}>
        {content}
      </Paragraph>
      {docLink && (
        <div style={{ marginTop: 12 }}>
          <Button
            size="mini"
            type="text"
            icon={<IconBook />}
            onClick={handleDocClick}
            style={{ padding: 0 }}
          >
            查看文档
          </Button>
        </div>
      )}
    </div>
  );

  if (children) {
    return (
      <Tooltip
        content={tooltipContent}
        position={position}
        popupVisible={visible}
        onVisibleChange={setVisible}
      >
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          {children}
          {showIcon && (
            <IconQuestionCircle
              style={{ 
                fontSize: iconSize, 
                color: 'var(--color-text-3)',
                cursor: 'help',
              }}
            />
          )}
        </span>
      </Tooltip>
    );
  }

  return (
    <Tooltip
      content={tooltipContent}
      position={position}
      popupVisible={visible}
      onVisibleChange={setVisible}
    >
      <IconQuestionCircle
        style={{ 
          fontSize: iconSize, 
          color: 'var(--color-text-3)',
          cursor: 'help',
        }}
      />
    </Tooltip>
  );
};

export default HelpTooltip;

/**
 * Predefined help tooltips for common features
 */
export const HelpTooltips = {
  subscription: {
    content: '订阅计划决定您可以使用哪些功能以及使用次数。升级以解锁更多功能。',
    docLink: '/docs/user-guide/subscription.md',
  },
  aiAssistant: {
    content: 'AI 策略助手可以帮助您分析市场、优化策略、学习交易知识。',
    docLink: '/docs/user-guide/ai-assistant.md',
  },
  priceAlerts: {
    content: '设置价格提醒，当价格达到目标时自动通知您。',
    docLink: '/docs/user-guide/alerts.md',
  },
  limits: {
    content: '不同计划有不同的功能使用限制，升级以获得更多额度。',
    docLink: '/docs/user-guide/limits.md',
  },
  strategy: {
    content: '策略是根据特定规则自动执行交易的程序。选择合适的策略可以提高交易效率。',
    docLink: '/docs/guides/strategy-development.md',
  },
  backtest: {
    content: '回测是使用历史数据测试策略表现的方法，帮助您评估策略的有效性。',
    docLink: '/docs/guides/backtesting.md',
  },
};