import React, { useCallback, useMemo, memo, useState } from 'react';
import { Card, Typography, Tooltip, Space, Tag } from '@arco-design/web-react';
import {
  IconArrowRise,
  IconArrowFall,
  IconInfoCircle,
} from '@arco-design/web-react/icon';
import { useOrderBook } from '../hooks/useData';

/**
 * Enhanced OrderBook Component with Better UX
 * 
 * Issue #514: UX 改进 - 订单簿可视化优化
 * - 添加深度可视化条
 * - 改进悬停效果和点击反馈
 * - 添加价格变化指示器
 * - 优化移动端交互
 */

const { Text } = Typography;

interface OrderBookRow {
  key: string;
  price: number;
  quantity: number;
  total: number;
  type: 'bid' | 'ask';
  depth: number; // 深度百分比
  priceChange?: 'up' | 'down' | 'same'; // 价格变化方向
}

interface OrderBookProps {
  symbol: string;
  levels?: number;
  onPriceClick?: (price: number, type: 'bid' | 'ask') => void;
  showDepth?: boolean; // 显示深度条
  highlightChanges?: boolean; // 高亮价格变化
}

// 单个订单行组件（带动画和深度可视化）
interface EnhancedOrderRowProps {
  row: OrderBookRow;
  onPriceClick: (price: number, type: 'bid' | 'ask') => void;
  showDepth: boolean;
  isHovered: boolean;
  onHover: (key: string | null) => void;
}

const EnhancedOrderRow: React.FC<EnhancedOrderRowProps> = memo(({
  row,
  onPriceClick,
  showDepth,
  isHovered,
  onHover,
}) => {
  const [isClicking, setIsClicking] = useState(false);

  const handleClick = () => {
    setIsClicking(true);
    setTimeout(() => setIsClicking(false), 150);
    onPriceClick(row.price, row.type);
  };

  return (
    <div
      style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        padding: '0 8px',
        height: 36,
        backgroundColor: isHovered
          ? row.type === 'bid'
            ? 'rgba(0, 180, 42, 0.12)'
            : 'rgba(245, 63, 63, 0.12)'
          : row.type === 'bid'
          ? 'rgba(0, 180, 42, 0.04)'
          : 'rgba(245, 63, 63, 0.04)',
        borderBottom: '1px solid var(--color-border-1, #e5e6eb)',
        cursor: 'pointer',
        transition: 'all 0.15s ease',
        transform: isClicking ? 'scale(0.98)' : 'scale(1)',
      }}
      onClick={handleClick}
      onMouseEnter={() => onHover(row.key)}
      onMouseLeave={() => onHover(null)}
      role="row"
    >
      {/* 深度可视化条 */}
      {showDepth && (
        <div
          style={{
            position: 'absolute',
            right: 0,
            top: 0,
            bottom: 0,
            width: `${row.depth}%`,
            background: row.type === 'bid'
              ? 'linear-gradient(to left, rgba(0, 180, 42, 0.2), transparent)'
              : 'linear-gradient(to left, rgba(245, 63, 63, 0.2), transparent)',
            transition: 'width 0.3s ease',
            pointerEvents: 'none',
          }}
        />
      )}

      {/* 价格 */}
      <div
        style={{
          width: '40%',
          color: row.type === 'bid' ? '#00b42a' : '#f53f3f',
          fontWeight: 600,
          fontSize: 13,
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          zIndex: 1,
        }}
        role="gridcell"
      >
        {row.priceChange === 'up' && (
          <IconArrowRise style={{ fontSize: 12 }} />
        )}
        {row.priceChange === 'down' && (
          <IconArrowFall style={{ fontSize: 12 }} />
        )}
        {row.price.toLocaleString(undefined, { minimumFractionDigits: 2 })}
      </div>

      {/* 数量 */}
      <div
        style={{
          width: '35%',
          fontSize: 13,
          color: '#4e5969',
          textAlign: 'center',
          zIndex: 1,
        }}
        role="gridcell"
      >
        {row.quantity.toFixed(4)}
      </div>

      {/* 总额 */}
      <div
        style={{
          width: '25%',
          fontSize: 13,
          color: '#4e5969',
          textAlign: 'right',
          zIndex: 1,
        }}
        role="gridcell"
      >
        ${row.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}
      </div>

      {/* 悬停提示 */}
      {isHovered && (
        <div
          style={{
            position: 'absolute',
            left: 8,
            top: '50%',
            transform: 'translateY(-50%)',
            fontSize: 11,
            color: '#86909c',
            background: 'rgba(255, 255, 255, 0.9)',
            padding: '2px 8px',
            borderRadius: 4,
            zIndex: 2,
          }}
        >
          点击使用此价格
        </div>
      )}
    </div>
  );
});

EnhancedOrderRow.displayName = 'EnhancedOrderRow';

const OrderBookEnhanced: React.FC<OrderBookProps> = memo(({
  symbol,
  levels = 20,
  onPriceClick,
  showDepth = true,
  highlightChanges = true,
}) => {
  const { orderBook, loading, error } = useOrderBook(symbol, levels);
  const [isMobile, setIsMobile] = React.useState(false);
  const [hoveredRow, setHoveredRow] = useState<string | null>(null);
  const [prevPrices, setPrevPrices] = useState<Map<string, number>>(new Map());

  // 检测移动端
  React.useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // 计算显示层级数
  const displayLevels = isMobile ? 10 : levels;

  // 准备订单簿数据
  const preparedData = useMemo((): OrderBookRow[] => {
    if (!orderBook) {
      return [];
    }

    const rawBids = Array.isArray(orderBook.bids) ? orderBook.bids : [];
    const rawAsks = Array.isArray(orderBook.asks) ? orderBook.asks : [];

    const rows: OrderBookRow[] = [];
    const newPrices = new Map<string, number>();

    // 计算最大深度
    let maxBidDepth = 0;
    let maxAskDepth = 0;

    // 处理卖单（升序排列，最低价在前）
    const asks = [...rawAsks]
      .sort((a, b) => a.price - b.price)
      .slice(0, displayLevels);

    asks.forEach(level => {
      maxAskDepth = Math.max(maxAskDepth, level.totalQuantity);
    });

    asks.forEach(level => {
      const prevPrice = prevPrices.get(`ask-${level.price}`);
      const priceChange = highlightChanges && prevPrice
        ? level.price > prevPrice ? 'up' : level.price < prevPrice ? 'down' : 'same'
        : undefined;

      newPrices.set(`ask-${level.price}`, level.price);

      rows.push({
        key: `ask-${level.price}`,
        price: level.price,
        quantity: level.totalQuantity,
        total: level.price * level.totalQuantity,
        type: 'ask',
        depth: (level.totalQuantity / maxAskDepth) * 100,
        priceChange,
      });
    });

    // 处理买单（降序排列，最高价在前）
    const bids = [...rawBids]
      .sort((a, b) => b.price - a.price)
      .slice(0, displayLevels);

    bids.forEach(level => {
      maxBidDepth = Math.max(maxBidDepth, level.totalQuantity);
    });

    bids.forEach(level => {
      const prevPrice = prevPrices.get(`bid-${level.price}`);
      const priceChange = highlightChanges && prevPrice
        ? level.price > prevPrice ? 'up' : level.price < prevPrice ? 'down' : 'same'
        : undefined;

      newPrices.set(`bid-${level.price}`, level.price);

      rows.push({
        key: `bid-${level.price}`,
        price: level.price,
        quantity: level.totalQuantity,
        total: level.price * level.totalQuantity,
        type: 'bid',
        depth: (level.totalQuantity / maxBidDepth) * 100,
        priceChange,
      });
    });

    // 更新价格历史
    setPrevPrices(newPrices);

    return rows;
  }, [orderBook, displayLevels, prevPrices, highlightChanges]);

  // 计算价差信息
  const spreadInfo = useMemo(() => {
    if (!orderBook?.bids?.length || !orderBook?.asks?.length) {
      return null;
    }

    let bestBid = -Infinity;
    let bestAsk = Infinity;

    for (const bid of orderBook.bids) {
      if (bid.price > bestBid) bestBid = bid.price;
    }

    for (const ask of orderBook.asks) {
      if (ask.price < bestAsk) bestAsk = ask.price;
    }

    const spread = bestAsk - bestBid;
    const midPrice = (bestBid + bestAsk) / 2;
    const spreadPercentage = (spread / midPrice) * 100;

    return { bestBid, bestAsk, spread, midPrice, spreadPercentage };
  }, [orderBook]);

  // 处理价格点击
  const handlePriceClick = useCallback(
    (price: number, type: 'bid' | 'ask') => {
      onPriceClick?.(price, type);
    },
    [onPriceClick]
  );

  // 表头
  const tableHeader = useMemo(() => (
    <div
      style={{
        display: 'flex',
        padding: '8px 12px',
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
      title={
        <Space>
          <span>{symbol} 订单簿</span>
          <Tooltip content="点击价格可快速下单">
            <IconInfoCircle style={{ color: '#86909c', cursor: 'help' }} />
          </Tooltip>
        </Space>
      }
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
          <Space size="large">
            <div>
              <Text type="secondary" style={{ fontSize: 12 }}>价差</Text>
              <div>
                <Text style={{ fontSize: 13 }}>
                  ${spreadInfo.spread.toFixed(2)}
                </Text>
                <Tag
                  size="small"
                  style={{ marginLeft: 4 }}
                  color={spreadInfo.spreadPercentage < 0.1 ? 'green' : 'orange'}
                >
                  {spreadInfo.spreadPercentage.toFixed(3)}%
                </Tag>
              </div>
            </div>
            <div>
              <Text type="secondary" style={{ fontSize: 12 }}>中间价</Text>
              <div>
                <Text style={{ fontSize: 13 }}>
                  ${spreadInfo.midPrice.toFixed(2)}
                </Text>
              </div>
            </div>
          </Space>
        )
      }
      role="region"
      aria-label={`${symbol} 订单簿`}
    >
      {loading && (
        <div style={{ padding: 16, textAlign: 'center' }}>
          <Text type="secondary">加载中...</Text>
        </div>
      )}
      {error && (
        <div style={{ padding: 16, textAlign: 'center' }}>
          <Text type="danger">加载失败：{error}</Text>
        </div>
      )}
      {!loading && !error && orderBook && (
        <div role="grid" aria-label={`${symbol} 订单簿表格`} style={{ maxHeight: 500, overflow: 'auto' }}>
          {tableHeader}
          {preparedData.map(row => (
            <EnhancedOrderRow
              key={row.key}
              row={row}
              onPriceClick={handlePriceClick}
              showDepth={showDepth}
              isHovered={hoveredRow === row.key}
              onHover={setHoveredRow}
            />
          ))}
        </div>
      )}
      {!loading && !error && !orderBook && (
        <div style={{ padding: 16, textAlign: 'center' }}>
          <Text type="secondary">暂无数据</Text>
        </div>
      )}

      {/* 动画样式 */}
      <style>
        {`
          @keyframes priceChangeFlash {
            0% { background-color: rgba(22, 93, 255, 0.2); }
            100% { background-color: transparent; }
          }
          
          .price-change {
            animation: priceChangeFlash 0.5s ease;
          }
        `}
      </style>
    </Card>
  );
});

OrderBookEnhanced.displayName = 'OrderBookEnhanced';

export default OrderBookEnhanced;