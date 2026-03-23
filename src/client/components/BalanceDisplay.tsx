import React from 'react';
import { Typography, Spin, Tag } from '@arco-design/web-react';
import { useBalance } from '../hooks/useBalance';
import { useTranslation, useNumberFormatter } from '../i18n/mod';

const { Text } = Typography;

interface BalanceDisplayProps {
  compact?: boolean; // For mobile view
}

/**
 * BalanceDisplay Component
 * 
 * Displays user's account balance in the header.
 * Shows total balance and available balance.
 * Updates in real-time when balance changes.
 */
export const BalanceDisplay: React.FC<BalanceDisplayProps> = ({ compact = false }) => {
  const { totalBalance, availableBalance, loading, error } = useBalance();
  const { t } = useTranslation('common');
  const { formatCurrency } = useNumberFormatter();

  // Loading state
  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Spin size={16} />
        {!compact && <Text type="secondary" style={{ fontSize: 13 }}>{t('button.loading')}</Text>}
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <Tag color="red" size="small">
        {t('message.error')}
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
          {formatCurrency(totalBalance, 'CNY')}
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
          {t('label.total')}
        </Text>
        <Text 
          style={{ 
            fontSize: 16, 
            fontWeight: 600,
            color: totalBalance >= 0 ? 'rgb(0, 180, 42)' : 'rgb(249, 79, 79)',
          }}
        >
          {formatCurrency(totalBalance, 'CNY')}
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
          {t('label.balance')}
        </Text>
        <Text 
          style={{ 
            fontSize: 14, 
            fontWeight: 500,
            color: 'var(--color-text-1)',
          }}
        >
          {formatCurrency(availableBalance, 'CNY')}
        </Text>
      </div>
    </div>
  );
};

export default BalanceDisplay;
