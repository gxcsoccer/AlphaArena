/**
 * EquityCurveChart - 资金曲线图组件
 * 
 * Shows portfolio value over time with drawdown visualization
 */

import React, { useMemo } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { Card, Spin, Empty, Typography, Space, Button } from '@arco-design/web-react';
import { IconDownload } from '@arco-design/web-react/icon';
import { useTranslation, useNumberFormatter } from '../i18n/mod';

const { Text, _Title } = Typography;

export interface EquityDataPoint {
  timestamp: number;
  date: string;
  equity: number;
  drawdown: number;
  highWaterMark: number;
}

interface EquityCurveChartProps {
  data: EquityDataPoint[];
  loading?: boolean;
  title?: string;
  onExport?: () => void;
  height?: number;
}

/**
 * Custom Tooltip Component with i18n support
 */
const CustomTooltip: React.FC<{
  active?: boolean;
  payload?: any[];
  label?: string;
  t: (key: string) => string;
  formatCurrency: (value: number) => string;
}> = ({ active, payload, label: _label, t, formatCurrency }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div
        style={{
          backgroundColor: 'var(--color-bg-3)',
          border: '1px solid var(--color-border)',
          borderRadius: 4,
          padding: 12,
        }}
      >
        <Text style={{ fontWeight: 'bold', display: 'block', marginBottom: 8 }}>
          {data.date}
        </Text>
        <Space direction="vertical" size={4}>
          <Text>{t('chart.equity')}: {formatCurrency(data.equity)}</Text>
          <Text type={data.drawdown < 0 ? 'error' : 'success'}>
            {t('chart.drawdown')}: {data.drawdown.toFixed(2)}%
          </Text>
          <Text type="secondary">
            {t('chart.highWaterMark')}: {formatCurrency(data.highWaterMark)}
          </Text>
        </Space>
      </div>
    );
  }
  return null;
};

export const EquityCurveChart: React.FC<EquityCurveChartProps> = ({
  data,
  loading = false,
  title,
  onExport,
  height = 300,
}) => {
  const { t } = useTranslation('common');
  const { formatCurrency } = useNumberFormatter();
  
  // Use translated title if not provided
  const chartTitle = title || t('chart.equity') + ' ' + t('chart.drawdown').toLowerCase();
  
  // Format date helper using current locale
  const formatDate = (timestamp: number): string => {
    const date = new Date(timestamp);
    return `${date.getMonth() + 1}/${date.getDate()}`;
  };
  
  const chartData = useMemo(() => {
    if (!data || data.length === 0) return [];
    
    // Calculate high water mark and drawdown
    let highWaterMark = data[0].equity;
    return data.map((point) => {
      highWaterMark = Math.max(highWaterMark, point.equity);
      const drawdown = ((highWaterMark - point.equity) / highWaterMark) * 100;
      return {
        ...point,
        date: point.date || formatDate(point.timestamp),
        highWaterMark,
        drawdown: -drawdown,
      };
    });
  }, [data]);

  const stats = useMemo(() => {
    if (!data || data.length === 0) return null;
    
    const startEquity = data[0].equity;
    const endEquity = data[data.length - 1].equity;
    const totalReturn = ((endEquity - startEquity) / startEquity) * 100;
    
    let maxDrawdown = 0;
    let highWaterMark = startEquity;
    for (const point of data) {
      highWaterMark = Math.max(highWaterMark, point.equity);
      const dd = ((highWaterMark - point.equity) / highWaterMark) * 100;
      maxDrawdown = Math.max(maxDrawdown, dd);
    }
    
    return {
      startEquity,
      endEquity,
      totalReturn,
      maxDrawdown,
    };
  }, [data]);

  if (loading) {
    return (
      <Card>
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height }}>
          <Spin size="large" />
        </div>
      </Card>
    );
  }

  if (!data || data.length === 0) {
    return (
      <Card>
        <Empty description={t('chart.noData')} />
      </Card>
    );
  }

  return (
    <Card
      title={
        <Space>
          <span>{chartTitle}</span>
          {stats && (
            <Space size="large" style={{ marginLeft: 16 }}>
              <Text type="success">
                {t('chart.return')}: {stats.totalReturn.toFixed(2)}%
              </Text>
              <Text type="error">
                {t('chart.maxDrawdown')}: {stats.maxDrawdown.toFixed(2)}%
              </Text>
            </Space>
          )}
        </Space>
      }
      extra={
        onExport && (
          <Button
            icon={<IconDownload />}
            size="small"
            onClick={onExport}
          >
            {t('button.export')}
          </Button>
        )
      }
    >
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={chartData}>
          <defs>
            <linearGradient id="equityGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="rgb(var(--primary-6))" stopOpacity={0.3} />
              <stop offset="95%" stopColor="rgb(var(--primary-6))" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 12 }}
            stroke="var(--color-text-3)"
          />
          <YAxis
            tick={{ fontSize: 12 }}
            stroke="var(--color-text-3)"
            tickFormatter={(value) => formatCurrency(value)}
          />
          <Tooltip content={<CustomTooltip t={t} formatCurrency={formatCurrency} />} />
          <ReferenceLine
            y={stats?.startEquity}
            stroke="var(--color-text-3)"
            strokeDasharray="3 3"
          />
          <Area
            type="monotone"
            dataKey="equity"
            stroke="rgb(var(--primary-6))"
            fillOpacity={1}
            fill="url(#equityGradient)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </Card>
  );
};

export default EquityCurveChart;
