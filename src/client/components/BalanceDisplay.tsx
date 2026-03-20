import React from 'react';
import { Typography, Spin, Tag } from '@arco-design/web-react';
import { useBalance } from '../hooks/useBalance';

const { Text } = Typography;

interface BalanceDisplayProps {
  compact?: boolean; // For mobile view
}

/**
 * Formats a number as CNY currency
 * Example: 1234.56 → ¥1,234.56
 */
const formatCNY = (value: number): string => {
  return new Intl.NumberFormat('zh-CN', {
    style: 'currency',
    currency: 'CNY',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
};

/**
 * BalanceDisplay Component
 * 
 * Displays user's account balance in the header.
 * Shows total balance and available balance.
 * Updates in real-time when balance changes.
 */
export const BalanceDisplay: React.FC<BalanceDisplayProps> = ({ compact = false }) => {
  const { totalBalance, availableBalance, loading, error } = useBalance();

  // Loading state
  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Spin size={16} />
        {!compact && <Text type="secondary" style={{ fontSize: 13 }}>加载中...</Text>}
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <Tag color="red" size="small">
        余额获取失败
      </Tag>
    );
  }

  // Compact mobile view - show only total balance
  if (compact) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <Text 
          style={{ 
            fontSize: 14, 
            fontWeight: 600,
            color: 'var(--color-text-1)',
          }}
        >
          {formatCNY(totalBalance)}
        </Text>
      </div>
    );
  }

  // Full desktop view - show total and available balance
  return (
    <div 
      style={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: 16,
        padding: '4px 12px',
        background: 'var(--color-fill-1)',
        borderRadius: 6,
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Text 
          type="secondary" 
          style={{ fontSize: 11, lineHeight: 1.4 }}
        >
          总资产
        </Text>
        <Text 
          style={{ 
            fontSize: 16, 
            fontWeight: 600,
            color: totalBalance >= 0 ? 'rgb(0, 180, 42)' : 'rgb(249, 79, 79)',
          }}
        >
          {formatCNY(totalBalance)}
        </Text>
      </div>
      
      <div 
        style={{ 
          width: 1, 
          height: 32, 
          background: 'var(--color-border-2)',
          alignSelf: 'center',
        }} 
      />
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Text 
          type="secondary" 
          style={{ fontSize: 11, lineHeight: 1.4 }}
        >
          可用余额
        </Text>
        <Text 
          style={{ 
            fontSize: 14, 
            fontWeight: 500,
            color: 'var(--color-text-1)',
          }}
        >
          {formatCNY(availableBalance)}
        </Text>
      </div>
    </div>
  );
};

export default BalanceDisplay;
