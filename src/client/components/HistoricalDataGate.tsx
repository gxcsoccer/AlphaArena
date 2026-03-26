/**
 * HistoricalDataGate Component
 * Controls access to historical data based on subscription tier
 * 
 * Free: 7 days
 * Pro: 30 days
 * Enterprise: Unlimited
 */

import React, { useMemo, useCallback, useEffect, useState } from 'react';
import {
  Card,
  Button,
  Typography,
  Space,
  Tag,
  Message,
  DatePicker,
  Tooltip,
  Alert,
} from '@arco-design/web-react';
import {
  IconCalendar,
  IconLock,
  IconUnlock,
} from '@arco-design/web-react/icon';
import { useSubscription, usePlan } from '../hooks/useSubscription';
import { FeatureGate } from './FeatureGate';
import { createLogger } from '../../utils/logger';

const log = createLogger('HistoricalDataGate');
const { Text, Title } = Typography;
const { RangePicker } = DatePicker;

// Data limits per plan (in days)
const HISTORICAL_DATA_LIMITS = {
  free: 7,
  pro: 30,
  enterprise: -1, // unlimited
};

// Plan display info
const PLAN_INFO = {
  free: { name: 'Free', limit: '7 天', color: 'gray' },
  pro: { name: 'Pro', limit: '30 天', color: 'blue' },
  enterprise: { name: 'Enterprise', limit: '无限制', color: 'gold' },
};

interface HistoricalDataGateProps {
  children: React.ReactNode;
  requestedDays?: number;
  onRequestUpgrade?: () => void;
  onDateRangeLimited?: (maxDays: number) => void;
}

/**
 * Hook to get historical data limit based on subscription
 */
export function useHistoricalDataLimit(): {
  maxDays: number;
  isLimited: boolean;
  planName: string;
  canAccessDays: (days: number) => boolean;
  limitDateRange: (start: Date, end: Date) => { start: Date; end: Date };
} {
  const { plan } = usePlan();

  const maxDays = useMemo(() => {
    return HISTORICAL_DATA_LIMITS[plan] || HISTORICAL_DATA_LIMITS.free;
  }, [plan]);

  const isLimited = useMemo(() => {
    return maxDays !== -1;
  }, [maxDays]);

  const planName = useMemo(() => {
    return PLAN_INFO[plan]?.name || 'Free';
  }, [plan]);

  const canAccessDays = useCallback((days: number): boolean => {
    if (maxDays === -1) return true; // unlimited
    return days <= maxDays;
  }, [maxDays]);

  const limitDateRange = useCallback((start: Date, end: Date): { start: Date; end: Date } => {
    if (maxDays === -1) return { start, end };

    const now = new Date();
    const minDate = new Date(now.getTime() - maxDays * 24 * 60 * 60 * 1000);

    // If start is before min date, clamp it
    const limitedStart = start < minDate ? minDate : start;
    
    return { start: limitedStart, end };
  }, [maxDays]);

  return {
    maxDays,
    isLimited,
    planName,
    canAccessDays,
    limitDateRange,
  };
}

/**
 * HistoricalDataGate Component
 * Wraps components that need historical data and enforces access limits
 */
const HistoricalDataGate: React.FC<HistoricalDataGateProps> = ({
  children,
  requestedDays,
  onRequestUpgrade,
  onDateRangeLimited,
}) => {
  const { plan, isPro, isEnterprise } = usePlan();
  const { maxDays, isLimited, planName, canAccessDays } = useHistoricalDataLimit();
  const [showUpgradePrompt, setShowUpgradePrompt] = useState(false);

  // Check if requested days exceeds limit
  const exceedsLimit = useMemo(() => {
    if (!requestedDays) return false;
    return !canAccessDays(requestedDays);
  }, [requestedDays, canAccessDays]);

  // Handle upgrade click
  const handleUpgrade = useCallback(() => {
    if (onRequestUpgrade) {
      onRequestUpgrade();
    } else {
      window.location.href = '/subscription';
    }
  }, [onRequestUpgrade]);

  // Notify parent if limited
  useEffect(() => {
    if (exceedsLimit && onDateRangeLimited) {
      onDateRangeLimited(maxDays);
    }
  }, [exceedsLimit, maxDays, onDateRangeLimited]);

  // Render info banner
  const renderInfoBanner = () => (
    <Card size="small" style={{ marginBottom: 16 }}>
      <Space>
        <IconCalendar />
        <Text>
          当前套餐: <Tag color={PLAN_INFO[plan]?.color}>{planName}</Tag>
        </Text>
        <Text type="secondary">
          历史数据范围: <Text bold>{PLAN_INFO[plan]?.limit}</Text>
        </Text>
        {isLimited && (
          <Button size="small" type="primary" onClick={handleUpgrade}>
            升级获取更多数据
          </Button>
        )}
      </Space>
    </Card>
  );

  // Render limit warning
  const renderLimitWarning = () => {
    if (!exceedsLimit) return null;

    return (
      <Alert
        type="warning"
        title="数据范围限制"
        content={
          <Space direction="vertical">
            <Text>
              您当前的 {planName} 套餐仅支持 {maxDays} 天历史数据。
            </Text>
            <Text type="secondary">
              升级到 Pro 可获取 30 天数据，Enterprise 用户无限制。
            </Text>
            <Button type="primary" size="small" onClick={handleUpgrade}>
              查看升级选项
            </Button>
          </Space>
        }
        style={{ marginBottom: 16 }}
      />
    );
  };

  return (
    <div className="historical-data-gate">
      {renderInfoBanner()}
      {renderLimitWarning()}
      {children}
    </div>
  );
};

/**
 * DateRangeSelector Component
 * Date picker that enforces historical data limits
 */
export const DateRangeSelector: React.FC<{
  value?: [Date, Date];
  onChange?: (range: [Date, Date]) => void;
  disabled?: boolean;
}> = ({ value, onChange, disabled }) => {
  const { maxDays, isLimited, planName } = useHistoricalDataLimit();
  const [internalValue, setInternalValue] = useState<[Date, Date]>(() => {
    const end = new Date();
    const start = new Date(end.getTime() - (isLimited ? maxDays : 30) * 24 * 60 * 60 * 1000);
    return [start, end];
  });

  const handleChange = useCallback((dates: [Date, Date] | null) => {
    if (!dates) return;

    let [start, end] = dates;

    // Enforce limit if not unlimited
    if (isLimited) {
      const now = new Date();
      const minDate = new Date(now.getTime() - maxDays * 24 * 60 * 60 * 1000);

      if (start < minDate) {
        Message.warning(`${planName} 用户只能查看最近 ${maxDays} 天的数据`);
        start = minDate;
      }
    }

    const range: [Date, Date] = [start, end];
    setInternalValue(range);
    onChange?.(range);
  }, [isLimited, maxDays, planName, onChange]);

  // Calculate disabled date
  const disabledDate = useCallback((current: Date) => {
    if (!isLimited) return false;

    const now = new Date();
    const minDate = new Date(now.getTime() - maxDays * 24 * 60 * 60 * 1000);

    return current < minDate;
  }, [isLimited, maxDays]);

  return (
    <Space>
      <RangePicker
        value={internalValue}
        onChange={handleChange}
        disabled={disabled}
        disabledDate={disabledDate}
        showTime
      />
      {isLimited && (
        <Tooltip content={`${planName} 用户最多可查看 ${maxDays} 天历史数据`}>
          <Tag color="orange">
            <IconLock style={{ marginRight: 4 }} />
            限制 {maxDays} 天
          </Tag>
        </Tooltip>
      )}
      {!isLimited && (
        <Tag color="green">
          <IconUnlock style={{ marginRight: 4 }} />
          无限制
        </Tag>
      )}
    </Space>
  );
};

export default HistoricalDataGate;