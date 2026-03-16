import React, { useCallback, useMemo, memo, useState } from 'react';
import { Card, Typography, Table } from '@arco-design/web-react';
import { useOrderBook } from '../hooks/useData';
import type { TableProps } from '@arco-design/web-react';

/**
 * OrderBook Component
 * 
 * Issue #214: Sprint 11: UI 可访问性增强
 * - Added proper ARIA roles and labels
 * - Added section headers with proper semantics
 * - Enhanced keyboard navigation
 * - Added focus indicators
 */

const { Text } = Typography;

interface OrderBookRow {
  key: string;
  price: number;
  quantity: number;
  total: number;
  type: 'bid' | 'ask';
}

interface OrderBookProps {
  symbol: string;
  levels?: number;
  onPriceClick?: (price: number, type: 'bid' | 'ask') => void;
}

// Mobile row component for stacked layout - defined outside to avoid React hooks violations
interface MobileOrderRowProps {
  row: OrderBookRow;
  onPriceClick: (price: number, type: 'bid' | 'ask') => void;
}

const MobileOrderRow: React.FC<MobileOrderRowProps> = ({ row, onPriceClick }) => (
  <div
    style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '12px 16px',
      borderBottom: '1px solid #e5e6eb',
      backgroundColor: row.type === 'bid' ? 'rgba(0, 180, 42, 0.04)' : 'rgba(245, 63, 63, 0.04)',
      minHeight: '60px',
    }}
    role="row"
  >
    <div
      style={{
        flex: 1,
        color: row.type === 'bid' ? '#00b42a' : '#f53f3f',
        fontWeight: 600,
        fontSize: 14,
        cursor: 'pointer',
        padding: '8px 0',
        minHeight: '44px',
        display: 'flex',
        alignItems: 'center',
      }}
      onClick={() => onPriceClick(row.price, row.type)}
      role="gridcell"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onPriceClick(row.price, row.type);
        }
      }}
      aria-label={`${row.type === 'bid' ? '买入' : '卖出'}价格 ${row.price.toLocaleString(undefined, { minimumFractionDigits: 2 })}，点击使用此价格`}
    >
      {row.price.toLocaleString(undefined, { minimumFractionDigits: 2 })}
    </div>
    <div
      style={{
        flex: 1,
        fontSize: 13,
        color: '#4e5969',
        padding: '8px 0',
        minHeight: '44px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      role="gridcell"
      aria-label={`数量 ${row.quantity.toFixed(4)}`}
    >
      {row.quantity.toFixed(4)}
    </div>
    <div
      style={{
        flex: 1,
        fontSize: 13,
        color: '#4e5969',
        textAlign: 'right',
        padding: '8px 0',
        minHeight: '44px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-end',
      }}
      role="gridcell"
      aria-label={`总额 $${row.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
    >
      ${row.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}
    </div>
  </div>
);

// Mobile stacked layout component - defined outside to avoid React hooks violations
interface MobileLayoutProps {
  bidRows: OrderBookRow[];
  askRows: OrderBookRow[];
  collapsedBids: boolean;
  collapsedAsks: boolean;
  onToggleBids: () => void;
  onToggleAsks: () => void;
  onPriceClick: (price: number, type: 'bid' | 'ask') => void;
}

const MobileLayout: React.FC<MobileLayoutProps> = ({
  bidRows,
  askRows,
  collapsedBids,
  collapsedAsks,
  onToggleBids,
  onToggleAsks,
  onPriceClick,
}) => (
  <div style={{ padding: '0' }} role="grid" aria-label="订单簿">
    {/* Header row */}
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        padding: '12px 16px',
        backgroundColor: '#f7f8fa',
        borderBottom: '1px solid #e5e6eb',
        fontSize: 13,
        color: '#86909c',
        fontWeight: 500,
      }}
      role="row"
    >
      <div style={{ flex: 1 }} role="columnheader">价格</div>
      <div style={{ flex: 1, textAlign: 'center' }} role="columnheader">数量</div>
      <div style={{ flex: 1, textAlign: 'right' }} role="columnheader">总额</div>
    </div>

    {/* Asks section (sell orders) */}
    <div style={{ marginBottom: '8px' }} role="region" aria-label="卖单区域">
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '12px 16px',
          backgroundColor: 'rgba(245, 63, 63, 0.08)',
          borderBottom: '1px solid #e5e6eb',
          cursor: 'pointer',
          userSelect: 'none',
        }}
        onClick={onToggleAsks}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onToggleAsks();
          }
        }}
        role="button"
        tabIndex={0}
        aria-expanded={!collapsedAsks}
        aria-controls="asks-list"
        aria-label={`卖单 (Asks)，${askRows.length} 条，${collapsedAsks ? '展开' : '收起'}`}
      >
        <Text style={{ color: '#f53f3f', fontWeight: 600, fontSize: 14 }}>
          卖单 (Asks)
        </Text>
        <Text type="secondary" style={{ fontSize: 12 }}>
          {collapsedAsks ? '展开' : '收起'} {askRows.length} 条
        </Text>
      </div>
      <div id="asks-list" role="rowgroup" aria-label="卖单列表">
        {!collapsedAsks && askRows.map(row => (
          <MobileOrderRow key={row.key} row={row} onPriceClick={onPriceClick} />
        ))}
      </div>
    </div>

    {/* Bids section (buy orders) */}
    <div role="region" aria-label="买单区域">
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '12px 16px',
          backgroundColor: 'rgba(0, 180, 42, 0.08)',
          borderBottom: '1px solid #e5e6eb',
          cursor: 'pointer',
          userSelect: 'none',
        }}
        onClick={onToggleBids}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onToggleBids();
          }
        }}
        role="button"
        tabIndex={0}
        aria-expanded={!collapsedBids}
        aria-controls="bids-list"
        aria-label={`买单 (Bids)，${bidRows.length} 条，${collapsedBids ? '展开' : '收起'}`}
      >
        <Text style={{ color: '#00b42a', fontWeight: 600, fontSize: 14 }}>
          买单 (Bids)
        </Text>
        <Text type="secondary" style={{ fontSize: 12 }}>
          {collapsedBids ? '展开' : '收起'} {bidRows.length} 条
        </Text>
      </div>
      <div id="bids-list" role="rowgroup" aria-label="买单列表">
        {!collapsedBids && bidRows.map(row => (
          <MobileOrderRow key={row.key} row={row} onPriceClick={onPriceClick} />
        ))}
      </div>
    </div>
  </div>
);

const OrderBook: React.FC<OrderBookProps> = memo(({
  symbol,
  levels = 20,
  onPriceClick,
}) => {
  const { orderBook, loading, error } = useOrderBook(symbol, levels);
  const [isMobile, setIsMobile] = React.useState(false);
  const [collapsedBids, setCollapsedBids] = useState(false);
  const [collapsedAsks, setCollapsedAsks] = useState(false);

  // Detect mobile on mount and resize
  React.useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Determine number of levels to show based on screen size
  const displayLevels = isMobile ? 10 : levels;

  // Memoize prepared data to avoid recalculation on every render
  const preparedData = useMemo((): OrderBookRow[] => {
    if (!orderBook) {
      console.log('[OrderBook] No orderBook data available');
      return [];
    }

    // Validate and ensure bids/asks are arrays
    const rawBids = Array.isArray(orderBook.bids) ? orderBook.bids : [];
    const rawAsks = Array.isArray(orderBook.asks) ? orderBook.asks : [];

    console.log('[OrderBook] Processing data - bids:', rawBids.length, 'asks:', rawAsks.length);

    const rows: OrderBookRow[] = [];

    // Add asks (sell orders) - sorted by price ascending (lowest first)
    const asks = [...rawAsks]
      .sort((a, b) => a.price - b.price)
      .slice(0, displayLevels);
    
    for (let i = 0; i < asks.length; i++) {
      const level = asks[i];
      rows.push({
        key: `ask-${level.price}`,
        price: level.price,
        quantity: level.totalQuantity,
        total: level.price * level.totalQuantity,
        type: 'ask',
      });
    }

    // Add bids (buy orders) - sorted by price descending (highest first)
    const bids = [...rawBids]
      .sort((a, b) => b.price - a.price)
      .slice(0, displayLevels);
    
    for (let i = 0; i < bids.length; i++) {
      const level = bids[i];
      rows.push({
        key: `bid-${level.price}`,
        price: level.price,
        quantity: level.totalQuantity,
        total: level.price * level.totalQuantity,
        type: 'bid',
      });
    }

    console.log('[OrderBook] Prepared rows:', rows.length, '(asks:', asks.length, 'bids:', bids.length, ')');
    return rows;
  }, [orderBook, displayLevels]);

  // Separate bids and asks for mobile stacked layout
  const bidRows = useMemo(() => 
    preparedData.filter(row => row.type === 'bid'), 
    [preparedData]
  );
  
  const askRows = useMemo(() => 
    preparedData.filter(row => row.type === 'ask'), 
    [preparedData]
  );

  // Handle price click
  const handlePriceClick = useCallback(
    (price: number, type: 'bid' | 'ask') => {
      onPriceClick?.(price, type);
    },
    [onPriceClick]
  );

  // Memoize table columns to avoid recreation on every render
  const columns = useMemo<TableProps<OrderBookRow>['columns']>(() => [
    {
      title: '价格',
      dataIndex: 'price',
      key: 'price',
      width: '40%',
      render: (price: number, record: OrderBookRow) => (
        <Text
          style={{
            color: record.type === 'bid' ? '#00b42a' : '#f53f3f',
            cursor: 'pointer',
            fontWeight: 600,
            fontSize: isMobile ? 13 : 12,
            padding: '8px 0',
            minHeight: '44px',
            display: 'flex',
            alignItems: 'center',
          }}
          onClick={() => handlePriceClick(price, record.type)}
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              handlePriceClick(price, record.type);
            }
          }}
          aria-label={`${record.type === 'bid' ? '买入' : '卖出'}价格 ${price.toLocaleString(undefined, { minimumFractionDigits: 2 })}，点击使用此价格`}
          role="button"
        >
          {price.toLocaleString(undefined, { minimumFractionDigits: 2 })}
        </Text>
      ),
    },
    {
      title: '数量',
      dataIndex: 'quantity',
      key: 'quantity',
      width: '35%',
      render: (quantity: number) => (
        <span style={{ 
          fontSize: isMobile ? 13 : 12,
          padding: '8px 0',
          display: 'block',
          minHeight: '44px',
          lineHeight: '44px',
        }}>
          {quantity.toFixed(4)}
        </span>
      ),
    },
    {
      title: '总额',
      dataIndex: 'total',
      key: 'total',
      width: '25%',
      render: (total: number) => (
        <span style={{ 
          fontSize: isMobile ? 13 : 12,
          padding: '8px 0',
          display: 'block',
          minHeight: '44px',
          lineHeight: '44px',
        }}>
          ${total.toLocaleString(undefined, { minimumFractionDigits: 2 })}
        </span>
      ),
    },
  ], [handlePriceClick, isMobile]);

  // Calculate spread and mid price - optimized to avoid unnecessary calculations
  const spreadInfo = useMemo(() => {
    if (!orderBook?.bids?.length || !orderBook?.asks?.length) {
      return null;
    }

    // Find best bid/ask without creating intermediate arrays
    let bestBid = -Infinity;
    let bestAsk = Infinity;
    
    for (let i = 0; i < orderBook.bids.length; i++) {
      if (orderBook.bids[i].price > bestBid) {
        bestBid = orderBook.bids[i].price;
      }
    }
    
    for (let i = 0; i < orderBook.asks.length; i++) {
      if (orderBook.asks[i].price < bestAsk) {
        bestAsk = orderBook.asks[i].price;
      }
    }
    
    const spread = bestAsk - bestBid;
    const midPrice = (bestBid + bestAsk) / 2;

    return { bestBid, bestAsk, spread, midPrice };
  }, [orderBook]);

  return (
    <Card
      title={`${symbol} 订单簿`}
      size="small"
      style={isMobile ? {} : { height: '100%' }}
      bodyStyle={{
        padding: '0',
        height: isMobile ? 'auto' : 'calc(100% - 57px)',
        overflow: isMobile ? 'auto' : 'hidden',
        maxHeight: isMobile ? 'none' : 'calc(100% - 57px)',
      }}
      extra={
        spreadInfo && (
          <Text type="secondary" size="small" aria-label={`价差 $${spreadInfo.spread.toFixed(2)}，中间价 $${spreadInfo.midPrice.toFixed(2)}`}>
            价差：${spreadInfo.spread.toFixed(2)} |{' '}
            中间价：${spreadInfo.midPrice.toFixed(2)}
          </Text>
        )
      }
      role="region"
      aria-label={`${symbol} 订单簿`}
    >
      {loading && <Text type="secondary" role="status" aria-live="polite">加载中...</Text>}
      {error && <Text type="danger" role="alert">加载失败：{error}</Text>}
      {!loading && !error && orderBook && (
        isMobile ? (
          <MobileLayout
            bidRows={bidRows}
            askRows={askRows}
            collapsedBids={collapsedBids}
            collapsedAsks={collapsedAsks}
            onToggleBids={() => setCollapsedBids(!collapsedBids)}
            onToggleAsks={() => setCollapsedAsks(!collapsedAsks)}
            onPriceClick={handlePriceClick}
          />
        ) : (
          <Table
            columns={columns}
            data={preparedData}
            rowKey="key"
            pagination={false}
            size="small"
            border={false}
            style={{ fontSize: 12 }}
            role="grid"
            aria-label={`${symbol} 订单簿表格`}
          />
        )
      )}
      {!loading && !error && !orderBook && (
        <Text type="secondary" role="status">暂无数据</Text>
      )}
    </Card>
  );
});

OrderBook.displayName = 'OrderBook';

export default OrderBook;
