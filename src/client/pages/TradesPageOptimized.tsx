/**
 * Optimized Trades Page Example
 * Demonstrates how to apply performance optimizations from Issue #388
 */

import React, { useState, useMemo, useCallback } from 'react';
import { Typography, Card, Tag, Select, Space, Grid } from '@arco-design/web-react';
const { Row, Col } = Grid;
import { useOptimizedQuery } from '../hooks/useOptimizedData';
import { useDebounce } from '../utils/performance';
import { dataCache } from '../utils/cache';
import VirtualizedTable from '../components/VirtualizedTable';
import { SkeletonTable, SkeletonChart } from '../components/Skeleton';
import { LazyLoadWrapper } from '../components/LazyLoadWrapper';
import {  OptimizedBarChart, OptimizedLineChart } from '../components/OptimizedChart';
import { usePerformanceTracking, usePerformanceMetrics } from '../hooks/usePerformanceMonitor';
import { api, Trade } from '../utils/api';
import { ErrorBoundary } from '../components/ErrorBoundary';

const { Title, Text } = Typography;

/**
 * Optimized Trades Page with caching, lazy loading, and virtualization
 */
const TradesPageOptimized: React.FC = () => {
  // Track component performance
  usePerformanceTracking('TradesPageOptimized');

  // Get performance metrics (dev only)
  const { metrics, recordApiCall } = usePerformanceMetrics();

  // Local state
  const [symbol, setSymbol] = useState<string | undefined>(undefined);
  const [side, setSide] = useState<'buy' | 'sell' | undefined>(undefined);
  const [searchQuery, _setSearchQuery] = useState('');

  // Debounce search query
  const _debouncedSearch = useDebounce(searchQuery, 300);

  // Memoize filters
  const filters = useMemo(() => ({ symbol, side }), [symbol, side]);

  // Use optimized query with caching
  const { data: trades, loading: tradesLoading, isCached: tradesCached } = useOptimizedQuery(
    () => {
      recordApiCall();
      return api.getTrades(filters, 100);
    },
    {
      cacheKey: `trades:${JSON.stringify(filters)}`,
      cacheTTL: 30000, // 30 seconds
      deps: [filters],
      enableCache: true,
    }
  );

  // Load strategies with caching
  const { data: _strategies } = useOptimizedQuery(
    () => {
      recordApiCall();
      return api.getStrategies();
    },
    {
      cacheKey: 'strategies',
      cacheTTL: 60000, // 1 minute
      enableCache: true,
    }
  );

  // Available symbols (computed from trades)
  const availableSymbols = useMemo(() => {
    if (!trades) return [];
    return Array.from(new Set(trades.map((t: Trade) => t.symbol)));
  }, [trades]);

  // Chart data (computed only when trades change)
  const chartData = useMemo(() => {
    if (!trades || trades.length === 0) return null;

    // Hourly distribution
    const hourlyDistribution = trades.reduce((acc: any, trade: Trade) => {
      const hour = new Date(trade.executedAt).getHours();
      acc[hour] = (acc[hour] || 0) + 1;
      return acc;
    }, {} as Record<number, number>);

    const hourlyData = Array.from({ length: 24 }, (_, i) => ({
      hour: `${i.toString().padStart(2, '0')}:00`,
      trades: hourlyDistribution[i] || 0,
    }));

    // Volume by symbol
    const volumeBySymbol = trades.reduce((acc: any, trade: Trade) => {
      acc[trade.symbol] = (acc[trade.symbol] || 0) + trade.total;
      return acc;
    }, {} as Record<string, number>);

    const symbolVolumeData = Object.entries(volumeBySymbol)
      .map(([sym, volume]) => ({
        symbol: sym,
        volume: volume as number,
      }))
      .sort((a, b) => b.volume - a.volume)
      .slice(0, 10); // Top 10

    // Price trend
    const priceTrendData = trades
      .sort((a: Trade, b: Trade) => new Date(a.executedAt).getTime() - new Date(b.executedAt).getTime())
      .map((trade: Trade) => ({
        time: new Date(trade.executedAt).toLocaleTimeString(),
        price: trade.price,
        volume: trade.quantity,
      }));

    return { hourlyData, symbolVolumeData, priceTrendData };
  }, [trades]);

  // Table columns for virtualized table
  const tableColumns = useMemo(
    () => [
      {
        title: '时间',
        dataIndex: 'executedAt',
        key: 'executedAt',
        width: 120,
        render: (text: string) => new Date(text).toLocaleString(),
      },
      {
        title: '交易对',
        dataIndex: 'symbol',
        key: 'symbol',
        width: 100,
        render: (text: string) => <Tag color="blue">{text}</Tag>,
      },
      {
        title: '方向',
        dataIndex: 'side',
        key: 'side',
        width: 80,
        render: (side: string) => (
          <Tag color={side === 'buy' ? 'green' : 'red'}>
            {side === 'buy' ? '买入' : '卖出'}
          </Tag>
        ),
      },
      {
        title: '价格',
        dataIndex: 'price',
        key: 'price',
        width: 100,
        align: 'right' as const,
        render: (price: number) => `$${price.toFixed(2)}`,
      },
      {
        title: '数量',
        dataIndex: 'quantity',
        key: 'quantity',
        width: 100,
        align: 'right' as const,
        render: (qty: number) => qty.toFixed(4),
      },
      {
        title: '总额',
        dataIndex: 'total',
        key: 'total',
        width: 120,
        align: 'right' as const,
        render: (total: number) => `$${total.toFixed(2)}`,
      },
    ],
    []
  );

  // Handlers
  const handleSymbolChange = useCallback((value: string | undefined) => {
    setSymbol(value);
    // Clear cache when filter changes
    dataCache.delete(`trades:${JSON.stringify({ symbol: value, side })}`);
  }, [side]);

  const handleSideChange = useCallback((value: 'buy' | 'sell' | undefined) => {
    setSide(value);
    dataCache.delete(`trades:${JSON.stringify({ symbol, side: value })}`);
  }, [symbol]);

  return (
    <ErrorBoundary>
      <div className="trades-page-optimized">
        <Title heading={4}>交易记录</Title>

        {/* Performance metrics (dev only) */}
        {process.env.NODE_ENV === 'development' && (
          <Card size="small" style={{ marginBottom: 16 }}>
            <Space>
              <Text type="secondary">
                API 调用: {metrics.apiCalls || 0}
              </Text>
              <Text type="secondary">
                缓存命中: {metrics.cacheHitRate?.toFixed(0) || 0}%
              </Text>
              {tradesCached && <Tag color="green">来自缓存</Tag>}
            </Space>
          </Card>
        )}

        {/* Filters */}
        <Card style={{ marginBottom: 16 }}>
          <Space size="large">
            <Select
              placeholder="选择交易对"
              value={symbol}
              onChange={handleSymbolChange}
              style={{ width: 150 }}
              allowClear
            >
              {availableSymbols.map((sym) => (
                <Select.Option key={sym} value={sym}>
                  {sym}
                </Select.Option>
              ))}
            </Select>

            <Select
              placeholder="选择方向"
              value={side}
              onChange={handleSideChange}
              style={{ width: 120 }}
              allowClear
            >
              <Select.Option value="buy">买入</Select.Option>
              <Select.Option value="sell">卖出</Select.Option>
            </Select>
          </Space>
        </Card>

        {/* Charts - Lazy loaded for better initial render */}
        <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
          <Col xs={24} md={12}>
            <LazyLoadWrapper minHeight={300}>
              {chartData ? (
                <OptimizedBarChart
                  title="交易时段分布"
                  data={chartData.hourlyData}
                  dataKey="trades"
                  xAxisKey="hour"
                  height={300}
                  enableSampling={true}
                />
              ) : (
                <SkeletonChart height={300} />
              )}
            </LazyLoadWrapper>
          </Col>

          <Col xs={24} md={12}>
            <LazyLoadWrapper minHeight={300}>
              {chartData ? (
                <OptimizedBarChart
                  title="交易量 Top 10"
                  data={chartData.symbolVolumeData}
                  dataKey="volume"
                  xAxisKey="symbol"
                  height={300}
                  color="rgb(var(--success-6))"
                  enableSampling={true}
                />
              ) : (
                <SkeletonChart height={300} />
              )}
            </LazyLoadWrapper>
          </Col>
        </Row>

        {/* Price trend chart - Lazy loaded */}
        <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
          <Col span={24}>
            <LazyLoadWrapper minHeight={300}>
              {chartData ? (
                <OptimizedLineChart
                  title="价格趋势"
                  data={chartData.priceTrendData}
                  dataKey="price"
                  xAxisKey="time"
                  height={300}
                  maxPoints={500}
                  enableSampling={true}
                />
              ) : (
                <SkeletonChart height={300} />
              )}
            </LazyLoadWrapper>
          </Col>
        </Row>

        {/* Trades table - Virtualized for performance */}
        <Card title="交易列表">
          <SkeletonWrapper loading={tradesLoading && !tradesCached} skeleton={<SkeletonTable rows={10} columns={6} />}>
            <VirtualizedTable
              height={400}
              columns={tableColumns}
              data={trades || []}
              rowKey="id"
              loading={tradesLoading && !tradesCached}
            />
          </SkeletonWrapper>
        </Card>
      </div>
    </ErrorBoundary>
  );
};

/**
 * Skeleton Wrapper Component
 */
const SkeletonWrapper: React.FC<{
  loading: boolean;
  skeleton: React.ReactNode;
  children: React.ReactNode;
}> = ({ loading, skeleton, children }) => {
  if (loading) return <>{skeleton}</>;
  return <>{children}</>;
};

export default TradesPageOptimized;