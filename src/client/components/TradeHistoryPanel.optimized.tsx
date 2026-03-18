/**
 * Optimized TradeHistoryPanel Component
 * - Virtual scrolling for large datasets (react-window)
 * - Memoized components and callbacks
 * - Lazy loading support
 * - Performance monitoring
 */

import React, { useCallback, useMemo, memo, useRef, useEffect, useState } from 'react';
import { Card, Typography, Table, Tag, Select, Spin, Empty, Button, Space } from '@arco-design/web-react';
import { FixedSizeList as List } from 'react-window';
import { useTrades } from '../hooks/useData';
import { usePerformanceMonitor, useLazyLoad } from '../hooks/usePerformanceMonitor';
import type { TableProps } from '@arco-design/web-react';
import type { Trade } from '../utils/api';

const { Text } = Typography;
const { Option } = Select;

interface TradeHistoryRow {
  key: string;
  timestamp: Date;
  symbol: string;
  side: 'buy' | 'sell';
  price: number;
  quantity: number;
  total: number;
}

interface TradeHistoryPanelProps {
  symbol?: string;
  limit?: number;
  autoScroll?: boolean;
  virtualizedThreshold?: number;
}

const ROW_HEIGHT = 48;
const VIRTUALIZED_OVERSCAN = 5;

// Memoized row component for virtualized list
const TradeRow = memo(({ data, index, style }: { data: TradeHistoryRow[]; index: number; style: React.CSSProperties }) => {
  const trade = data[index];
  if (!trade) return null;

  return (
    <div
      style={{
        ...style,
        display: 'flex',
        alignItems: 'center',
        borderBottom: '1px solid var(--color-border)',
        backgroundColor: index % 2 === 0 ? 'var(--color-bg-1)' : 'var(--color-bg-2)',
        fontSize: 12,
      }}
    >
      <div style={{ width: '20%', padding: '0 12px' }}>
        <Text type="secondary" size="small">
          {trade.timestamp.toLocaleTimeString('zh-CN', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          })}
        </Text>
      </div>
      <div style={{ width: '20%', padding: '0 12px' }}>
        <Text style={{ fontWeight: 500 }}>{trade.symbol}</Text>
      </div>
      <div style={{ width: '15%', padding: '0 12px' }}>
        <Tag
          color={trade.side === 'buy' ? 'green' : 'red'}
          size="small"
          style={{ fontWeight: 600 }}
        >
          {trade.side === 'buy' ? '买入' : '卖出'}
        </Tag>
      </div>
      <div style={{ width: '25%', padding: '0 12px' }}>
        <Text
          style={{
            color: trade.price > 0 ? '#00b42a' : '#f53f3f',
            fontWeight: 600,
          }}
        >
          ${trade.price.toLocaleString(undefined, { minimumFractionDigits: 2 })}
        </Text>
      </div>
      <div style={{ width: '20%', padding: '0 12px' }}>
        {trade.quantity.toFixed(4)}
      </div>
    </div>
  );
});

TradeRow.displayName = 'TradeRow';

const TradeHistoryPanel: React.FC<TradeHistoryPanelProps> = memo(({
  symbol,
  limit = 100,
  autoScroll = true,
  virtualizedThreshold = 50,
}) => {
  const [sideFilter, setSideFilter] = useState<'all' | 'buy' | 'sell'>('all');
  const [symbolFilter, setSymbolFilter] = useState<string>('all');
  const [isMobile, setIsMobile] = useState(false);
  const tableRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<List>(null);
  const previousTradeCount = useRef<number>(0);

  // Performance monitoring
  const { metrics, trackRenderStart, trackRenderEnd } = usePerformanceMonitor({
    componentName: 'TradeHistoryPanel',
    enableLogging: false,
  });

  // Detect mobile on mount and resize
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Fetch trades with filters
  const filters = useMemo(() => {
    const f: { symbol?: string; side?: 'buy' | 'sell' } = {};
    if (symbol) f.symbol = symbol;
    if (sideFilter !== 'all') f.side = sideFilter;
    return f;
  }, [symbol, sideFilter]);

  const { trades, loading, error } = useTrades(filters, limit);

  // Extract unique symbols for filter dropdown
  const uniqueSymbols = useMemo(() => {
    const symbols = new Set(trades.map(t => t.symbol));
    return Array.from(symbols);
  }, [trades]);

  // Prepare data for table with memoization
  const preparedData = useMemo<TradeHistoryRow[]>(() => {
    trackRenderStart();
    const data = trades.map(trade => ({
      key: trade.id,
      timestamp: new Date(trade.executedAt),
      symbol: trade.symbol,
      side: trade.side,
      price: trade.price,
      quantity: trade.quantity,
      total: trade.price * trade.quantity,
    }));
    trackRenderEnd();
    return data;
  }, [trades, trackRenderStart, trackRenderEnd]);

  // Filter data based on symbol filter
  const filteredData = useMemo(() => {
    if (symbolFilter === 'all') return preparedData;
    return preparedData.filter(row => row.symbol === symbolFilter);
  }, [preparedData, symbolFilter]);

  // Determine if we should use virtualization
  const useVirtualization = filteredData.length > virtualizedThreshold && !isMobile;

  // Auto-scroll to newest trades
  useEffect(() => {
    if (autoScroll && tableRef.current && trades.length > previousTradeCount.current) {
      tableRef.current.scrollTop = tableRef.current.scrollHeight;
    }
    previousTradeCount.current = trades.length;
  }, [trades.length, autoScroll]);

  // Handle side filter change
  const handleSideFilterChange = useCallback((value: string) => {
    setSideFilter(value as 'all' | 'buy' | 'sell');
  }, []);

  // Handle symbol filter change
  const handleSymbolFilterChange = useCallback((value: string) => {
    setSymbolFilter(value);
  }, []);

  // Memoize table columns
  const columns = useMemo<TableProps<TradeHistoryRow>['columns']>(() => [
    {
      title: '时间',
      dataIndex: 'timestamp',
      key: 'timestamp',
      width: '20%',
      render: (timestamp: Date) => (
        <Text type="secondary" size="small">
          {timestamp.toLocaleTimeString('zh-CN', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          })}
        </Text>
      ),
    },
    {
      title: '交易对',
      dataIndex: 'symbol',
      key: 'symbol',
      width: '20%',
      render: (symbol: string) => (
        <Text style={{ fontWeight: 500 }}>{symbol}</Text>
      ),
    },
    {
      title: '方向',
      dataIndex: 'side',
      key: 'side',
      width: '15%',
      render: (side: 'buy' | 'sell') => (
        <Tag
          color={side === 'buy' ? 'green' : 'red'}
          size="small"
          style={{ fontWeight: 600 }}
        >
          {side === 'buy' ? '买入' : '卖出'}
        </Tag>
      ),
    },
    {
      title: '价格',
      dataIndex: 'price',
      key: 'price',
      width: '25%',
      render: (price: number) => (
        <Text
          style={{
            color: price > 0 ? '#00b42a' : '#f53f3f',
            fontWeight: 600,
          }}
        >
          ${price.toLocaleString(undefined, { minimumFractionDigits: 2 })}
        </Text>
      ),
    },
    {
      title: '数量',
      dataIndex: 'quantity',
      key: 'quantity',
      width: '20%',
      render: (quantity: number) => quantity.toFixed(4),
    },
  ], []);

  // Virtualized header
  const virtualizedHeader = useMemo(() => (
    <div
      style={{
        display: 'flex',
        backgroundColor: 'var(--color-bg-3)',
        borderBottom: '1px solid var(--color-border)',
        fontWeight: 500,
        fontSize: 12,
      }}
    >
      <div style={{ width: '20%', padding: '12px' }}>时间</div>
      <div style={{ width: '20%', padding: '12px' }}>交易对</div>
      <div style={{ width: '15%', padding: '12px' }}>方向</div>
      <div style={{ width: '25%', padding: '12px' }}>价格</div>
      <div style={{ width: '20%', padding: '12px' }}>数量</div>
    </div>
  ), []);

  return (
    <Card
      title={
        <Space>
          <span>实时成交</span>
          <Tag color="blue" size="small">{filteredData.length}</Tag>
          {useVirtualization && <Tag color="green" size="small">虚拟滚动</Tag>}
        </Space>
      }
      size="small"
      style={isMobile ? {} : { height: '100%' }}
      bodyStyle={{
        padding: '0',
        height: isMobile ? 'auto' : 'calc(100% - 57px)',
        overflow: isMobile ? 'auto' : 'hidden',
        maxHeight: isMobile ? 400 : 'calc(100% - 57px)',
      }}
      extra={
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <Select
            size="small"
            placeholder="方向"
            value={sideFilter}
            onChange={handleSideFilterChange}
            style={{ width: 80 }}
          >
            <Option value="all">全部</Option>
            <Option value="buy">买入</Option>
            <Option value="sell">卖出</Option>
          </Select>
          {uniqueSymbols.length > 0 && (
            <Select
              size="small"
              placeholder="交易对"
              value={symbolFilter}
              onChange={handleSymbolFilterChange}
              style={{ width: 100 }}
            >
              <Option value="all">全部</Option>
              {uniqueSymbols.map(sym => (
                <Option key={sym} value={sym}>
                  {sym}
                </Option>
              ))}
            </Select>
          )}
        </div>
      }
    >
      {loading && <div style={{ padding: 20, textAlign: 'center' }}><Spin size={24} /></div>}
      {error && <Text type="danger" style={{ padding: 20, display: 'block' }}>加载失败：{error}</Text>}
      
      {!loading && !error && useVirtualization && (
        <div style={{ height: '100%' }}>
          {virtualizedHeader}
          <List
            ref={listRef}
            height={isMobile ? 350 : 400}
            itemCount={filteredData.length}
            itemSize={ROW_HEIGHT}
            width="100%"
            overscanCount={VIRTUALIZED_OVERSCAN}
            itemData={filteredData}
          >
            {({ data, index, style }) => <TradeRow data={data} index={index} style={style} />}
          </List>
        </div>
      )}

      {!loading && !error && !useVirtualization && (
        <div ref={tableRef} style={{ height: '100%', overflow: 'auto' }}>
          <Table
            columns={columns}
            data={filteredData}
            rowKey="key"
            pagination={false}
            size="small"
            border={false}
            style={{ fontSize: isMobile ? 11 : 12 }}
            scroll={isMobile ? { x: 400 } : undefined}
          />
        </div>
      )}
      
      {!loading && !error && filteredData.length === 0 && (
        <Empty description="暂无成交数据" style={{ padding: '40px 0' }} />
      )}
    </Card>
  );
});

export default TradeHistoryPanel;