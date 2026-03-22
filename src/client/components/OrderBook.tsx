import React, { useCallback, useMemo, memo, useState } from 'react';
import { Card, Typography } from '@arco-design/web-react';
import { useOrderBook } from '../hooks/useData';

/**
 * OrderBook Component with Optimized Rendering
 * 
 * Issue #513: Performance Optimization
 * - Optimized re-renders with memo and useMemo
 * - Reduced DOM nodes for better performance
 * - Efficient data processing with memoization
 * - Removed console.log statements for production
 * 
 * Issue #214: Sprint 11: UI 可访问性增强
 * - Added proper ARIA roles and labels
 * - Added section headers with proper semantics
 * - Enhanced keyboard navigation
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

// Memoized row component for better performance
interface OrderRowProps {
  row: OrderBookRow;
  onPriceClick: (price: number, type: 'bid' | 'ask') => void;
}

const OrderRow: React.FC<OrderRowProps> = memo(({ row, onPriceClick }) => (
  <div
    style={{
      display: 'flex',
      alignItems: 'center',
      padding: '0 8px',
      height: 32,
      backgroundColor: row.type === 'bid' 
        ? 'rgba(0, 180, 42, 0.04)' 
        : 'rgba(245, 63, 63, 0.04)',
      borderBottom: '1px solid var(--color-border-1, #e5e6eb)',
      cursor: 'pointer',
    }}
    onClick={() => onPriceClick(row.price, row.type)}
    role="row"
  >
    <div
      style={{
        width: '40%',
        color: row.type === 'bid' ? '#00b42a' : '#f53f3f',
        fontWeight: 600,
        fontSize: 12,
      }}
      role="gridcell"
    >
      {row.price.toLocaleString(undefined, { minimumFractionDigits: 2 })}
    </div>
    <div
      style={{
        width: '35%',
        fontSize: 12,
        color: '#4e5969',
        textAlign: 'center',
      }}
      role="gridcell"
    >
      {row.quantity.toFixed(4)}
    </div>
    <div
      style={{
        width: '25%',
        fontSize: 12,
        color: '#4e5969',
        textAlign: 'right',
      }}
      role="gridcell"
    >
      ${row.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}
    </div>
  </div>
));

OrderRow.displayName = 'OrderRow';

// Mobile row component for stacked layout
interface MobileOrderRowProps {
  row: OrderBookRow;
  onPriceClick: (price: number, type: 'bid' | 'ask') => void;
}

const MobileOrderRow: React.FC<MobileOrderRowProps> = memo(({ row, onPriceClick }) => (
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
));

MobileOrderRow.displayName = 'MobileOrderRow';

// Mobile stacked layout component
interface MobileLayoutProps {
  bidRows: OrderBookRow[];
  askRows: OrderBookRow[];
  collapsedBids: boolean;
  collapsedAsks: boolean;
  onToggleBids: () => void;
  onToggleAsks: () => void;
  onPriceClick: (price: number, type: 'bid' | 'ask') => void;
}

const MobileLayout: React.FC<MobileLayoutProps> = memo(({
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
));

MobileLayout.displayName = 'MobileLayout';

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
      return [];
    }

    const rawBids = Array.isArray(orderBook.bids) ? orderBook.bids : [];
    const rawAsks = Array.isArray(orderBook.asks) ? orderBook.asks : [];

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

  // Calculate spread and mid price - optimized
  const spreadInfo = useMemo(() => {
    if (!orderBook?.bids?.length || !orderBook?.asks?.length) {
      return null;
    }

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

  // Table header component
  const tableHeader = useMemo(() => (
    <div
      style={{
        display: 'flex',
        padding: '8px',
        backgroundColor: 'var(--color-bg-3, #e8e8e8)',
        borderBottom: '1px solid var(--color-border-1, #e5e6eb)',
        fontWeight: 500,
        fontSize: 12,
        color: 'var(--color-text-3, #86868b)',
      }}
      role="row"
    >
      <div style={{ width: '40%' }} role="columnheader">价格</div>
      <div style={{ width: '35%', textAlign: 'center' }} role="columnheader">数量</div>
      <div style={{ width: '25%', textAlign: 'right' }} role="columnheader">总额</div>
    </div>
  ), []);

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
          <div role="grid" aria-label={`${symbol} 订单簿表格`} style={{ maxHeight: 400, overflow: 'auto' }}>
            {tableHeader}
            {preparedData.map(row => (
              <OrderRow key={row.key} row={row} onPriceClick={handlePriceClick} />
            ))}
          </div>
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