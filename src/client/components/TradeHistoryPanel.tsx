import React, { useCallback, useMemo, memo, useRef, useEffect } from 'react';
import { Card, Typography, Table, Tag, Select } from '@arco-design/web-react';
import { useTrades } from '../hooks/useData';
import type { TableProps } from '@arco-design/web-react';

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
}

const TradeHistoryPanel: React.FC<TradeHistoryPanelProps> = memo(({
  symbol,
  limit = 100,
  autoScroll = true,
}) => {
  const [sideFilter, setSideFilter] = React.useState<'all' | 'buy' | 'sell'>('all');
  const [symbolFilter, setSymbolFilter] = React.useState<string>('all');
  const [isMobile, setIsMobile] = React.useState(false);
  const tableRef = useRef<HTMLDivElement>(null);
  const previousTradeCount = useRef<number>(0);

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

  // Auto-scroll to newest trades
  useEffect(() => {
    if (autoScroll && tableRef.current && trades.length > previousTradeCount.current) {
      // Scroll to bottom (newest trades)
      tableRef.current.scrollTop = tableRef.current.scrollHeight;
    }
    previousTradeCount.current = trades.length;
  }, [trades.length, autoScroll]);

  // Extract unique symbols for filter dropdown
  const uniqueSymbols = useMemo(() => {
    const symbols = new Set(trades.map(t => t.symbol));
    return Array.from(symbols);
  }, [trades]);

  // Prepare data for table
  const preparedData = useMemo<TradeHistoryRow[]>(() => {
    return trades.map(trade => ({
      key: trade.id,
      timestamp: new Date(trade.executedAt),
      symbol: trade.symbol,
      side: trade.side,
      price: trade.price,
      quantity: trade.quantity,
      total: trade.price * trade.quantity,
    }));
  }, [trades]);

  // Handle side filter change
  const handleSideFilterChange = useCallback((value: string) => {
    setSideFilter(value as 'all' | 'buy' | 'sell');
  }, []);

  // Handle symbol filter change
  const handleSymbolFilterChange = useCallback((value: string) => {
    setSymbolFilter(value);
  }, []);

  // Format timestamp
  const formatTime = useCallback((date: Date): string => {
    return date.toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
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
          {formatTime(timestamp)}
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
  ], [formatTime]);

  // Filter data based on symbol filter
  const filteredData = useMemo(() => {
    if (symbolFilter === 'all') return preparedData;
    return preparedData.filter(row => row.symbol === symbolFilter);
  }, [preparedData, symbolFilter]);

  return (
    <Card
      title="实时成交"
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
      {loading && <Text type="secondary">加载中...</Text>}
      {error && <Text type="danger">加载失败：{error}</Text>}
      {!loading && !error && (
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
        <Text type="secondary" style={{ display: 'block', textAlign: 'center', padding: '20px 0' }}>
          暂无成交数据
        </Text>
      )}
    </Card>
  );
});

export default TradeHistoryPanel;
