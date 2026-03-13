import React, { useCallback, useMemo, memo } from 'react';
import { Card, Typography, Table, Tag } from '@arco-design/web-react';
import { useOrderBook } from '../hooks/useData';
import type { TableProps } from '@arco-design/web-react';

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

const OrderBook: React.FC<OrderBookProps> = memo(({
  symbol,
  levels = 20,
  onPriceClick,
}) => {
  const { orderBook, loading, error } = useOrderBook(symbol, levels);
  const [isMobile, setIsMobile] = React.useState(false);

  // Detect mobile on mount and resize
  React.useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Memoize prepared data to avoid recalculation on every render
  const preparedData = useMemo((): OrderBookRow[] => {
    if (!orderBook) return [];

    const rows: OrderBookRow[] = [];

    // Add asks (sell orders) - sorted by price ascending (lowest first)
    const asks = [...(orderBook.asks || [])].sort((a, b) => a.price - b.price);
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
    const bids = [...(orderBook.bids || [])].sort((a, b) => b.price - a.price);
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
  }, [orderBook]);

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
          }}
          onClick={() => handlePriceClick(price, record.type)}
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
      render: (quantity: number) => quantity.toFixed(4),
    },
    {
      title: '总额',
      dataIndex: 'total',
      key: 'total',
      width: '25%',
      render: (total: number) =>
        `$${total.toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
    },
  ], [handlePriceClick]);

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
        maxHeight: isMobile ? 400 : 'calc(100% - 57px)',
      }}
      extra={
        spreadInfo && (
          <Text type="secondary" size="small">
            价差：${spreadInfo.spread.toFixed(2)} |{' '}
            中间价：${spreadInfo.midPrice.toFixed(2)}
          </Text>
        )
      }
    >
      {loading && <Text type="secondary">加载中...</Text>}
      {error && <Text type="danger">加载失败：{error}</Text>}
      {!loading && !error && orderBook && (
        <Table
          columns={columns}
          data={preparedData}
          rowKey="key"
          pagination={false}
          size="small"
          border={false}
          style={{ fontSize: isMobile ? 11 : 12 }}
          scroll={isMobile ? { x: 300 } : undefined}
        />
      )}
      {!loading && !error && !orderBook && (
        <Text type="secondary">暂无数据</Text>
      )}
    </Card>
  );
});

export default OrderBook;
