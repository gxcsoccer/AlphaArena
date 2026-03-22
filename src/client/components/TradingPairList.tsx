import React, { useState, useMemo } from 'react';
import { Table, Input, Typography, Tag, Grid, Spin, Empty } from '@arco-design/web-react';
import type { TableProps } from '@arco-design/web-react';
import { useMarketData } from '../hooks/useMarketData';

/**
 * TradingPairList Component
 * 
 * Issue #214: Sprint 11: UI 可访问性增强
 * - Added aria-labels to search input
 * - Enhanced table accessibility
 * - Added keyboard navigation support
 */

const { Search } = Input;
const { Text } = Typography;
const { _Row, _Col } = Grid;

export interface TradingPair {
  symbol: string;
  baseCurrency: string;
  quoteCurrency: string;
  lastPrice: number;
  priceChange24h: number;
  priceChangePercent24h: number;
  high24h: number;
  low24h: number;
  volume24h: number;
  quoteVolume24h: number;
  bid: number;
  ask: number;
  timestamp: number;
}

interface TradingPairListProps {
  onPairSelect?: (symbol: string) => void;
  showSearch?: boolean;
  compact?: boolean;
}

const TradingPairList: React.FC<TradingPairListProps> = ({
  onPairSelect,
  showSearch = true,
  compact = false,
}) => {
  const [searchText, setSearchText] = useState('');
  const { marketData, loading, error } = useMarketData();

  // Filter market data based on search
  const filteredPairs = useMemo(() => {
    if (!marketData) return [];
    
    if (!searchText.trim()) {
      return marketData;
    }

    const search = searchText.toLowerCase().trim();
    return marketData.filter(pair =>
      pair.symbol.toLowerCase().includes(search) ||
      pair.baseCurrency.toLowerCase().includes(search) ||
      pair.quoteCurrency.toLowerCase().includes(search)
    );
  }, [marketData, searchText]);

  // Table columns
  const columns: TableProps<TradingPair>['columns'] = [
    {
      title: '交易对',
      dataIndex: 'symbol',
      key: 'symbol',
      width: 120,
      fixed: 'left',
      render: (symbol: string, record: TradingPair) => (
        <div
          style={{ cursor: 'pointer', fontWeight: 500, whiteSpace: 'nowrap' }}
          onClick={() => onPairSelect?.(symbol)}
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onPairSelect?.(symbol);
            }
          }}
          role="button"
          aria-label={`选择交易对 ${record.baseCurrency}/${record.quoteCurrency}`}
        >
          {record.baseCurrency}
          <Text type="secondary" style={{ margin: '0 4px' }}>/</Text>
          {record.quoteCurrency}
        </div>
      ),
    },
    {
      title: '最新价',
      dataIndex: 'lastPrice',
      key: 'lastPrice',
      width: 100,
      render: (price: number) => (
        <Text bold aria-label={`最新价 $${price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}>
          ${price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </Text>
      ),
    },
    {
      title: '24h 涨跌',
      dataIndex: 'priceChangePercent24h',
      key: 'priceChangePercent24h',
      width: 100,
      render: (percent: number, _record: TradingPair) => {
        const isPositive = percent >= 0;
        return (
          <Tag color={isPositive ? 'red' : 'green'} aria-label={`24小时涨跌 ${isPositive ? '+' : ''}${percent.toFixed(2)}%`}>
            {isPositive ? '+' : ''}{percent.toFixed(2)}%
          </Tag>
        );
      },
    },
    {
      title: '24h 最高',
      dataIndex: 'high24h',
      key: 'high24h',
      width: 90,
      render: (price: number) => <span aria-label={`24小时最高价 $${price.toLocaleString(undefined, { minimumFractionDigits: 2 })}`}>${price.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>,
    },
    {
      title: '24h 最低',
      dataIndex: 'low24h',
      key: 'low24h',
      width: 90,
      render: (price: number) => <span aria-label={`24小时最低价 $${price.toLocaleString(undefined, { minimumFractionDigits: 2 })}`}>${price.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>,
    },
    {
      title: '24h 成交量',
      dataIndex: 'volume24h',
      key: 'volume24h',
      width: 120,
      render: (volume: number) => <span aria-label={`24小时成交量 ${volume.toLocaleString(undefined, { maximumFractionDigits: 4 })}`}>{volume.toLocaleString(undefined, { maximumFractionDigits: 4 })}</span>,
    },
    {
      title: '24h 成交额',
      dataIndex: 'quoteVolume24h',
      key: 'quoteVolume24h',
      width: 120,
      render: (volume: number) => <span aria-label={`24小时成交额 $${volume.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}>${volume.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>,
    },
    {
      title: '买一价',
      dataIndex: 'bid',
      key: 'bid',
      width: 90,
      render: (price: number) => (
        <Text type="success" aria-label={`买一价 $${price.toLocaleString(undefined, { minimumFractionDigits: 2 })}`}>
          ${price.toLocaleString(undefined, { minimumFractionDigits: 2 })}
        </Text>
      ),
    },
    {
      title: '卖一价',
      dataIndex: 'ask',
      key: 'ask',
      width: 90,
      render: (price: number) => (
        <Text type="danger" aria-label={`卖一价 $${price.toLocaleString(undefined, { minimumFractionDigits: 2 })}`}>
          ${price.toLocaleString(undefined, { minimumFractionDigits: 2 })}
        </Text>
      ),
    },
  ];

  if (error) {
    return (
      <div style={{ padding: '40px', textAlign: 'center' }} role="alert">
        <Text type="danger">加载失败：{error}</Text>
      </div>
    );
  }

  return (
    <div style={{ height: '100%', overflow: 'hidden' }} role="region" aria-label="交易对列表">
      {showSearch && (
        <div style={{ marginBottom: 16 }}>
          <Search
            placeholder="搜索交易对..."
            value={searchText}
            onChange={setSearchText}
            style={{ maxWidth: 300 }}
            allowClear
            aria-label="搜索交易对"
            aria-describedby="search-hint"
          />
          <span id="search-hint" className="sr-only" style={{ position: 'absolute', left: '-9999px' }}>
            输入交易对名称或货币代码进行搜索
          </span>
        </div>
      )}

      <Spin loading={loading} style={{ width: '100%' }} tip="加载中...">
        {filteredPairs.length === 0 ? (
          <Empty 
            description={searchText ? '未找到匹配的交易对' : '暂无交易对数据'} 
            role="status"
            aria-live="polite"
          />
        ) : (
          <Table
            columns={columns}
            data={filteredPairs}
            rowKey="symbol"
            pagination={false}
            size={compact ? 'small' : 'default'}
            scroll={{ y: 'calc(100vh - 200px)' }}
            onRow={(record) => ({
              onClick: () => onPairSelect?.(record.symbol),
              style: { cursor: 'pointer' },
              tabIndex: 0,
              onKeyDown: (e: any) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onPairSelect?.(record.symbol);
                }
              },
              'aria-label': `选择交易对 ${record.baseCurrency}/${record.quoteCurrency}，当前价格 $${record.lastPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
              role: 'button',
            })}
            role="grid"
            aria-label="交易对表格"
          />
        )}
      </Spin>
    </div>
  );
};

export default TradingPairList;
