import React from 'react';
import { Skeleton } from '@arco-design/web-react';

/**
 * Trading Interface Skeleton Components
 * 
 * Issue #514: UX 改进 - 加载状态优化
 * - 为交易界面提供骨架屏加载状态
 * - 改善用户体验，避免布局跳动
 */

// 基础骨架屏样式
const skeletonStyle = {
  background: 'linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%)',
  backgroundSize: '200% 100%',
  animation: 'shimmer 1.5s infinite',
};

// 注入动画样式
const injectStyles = () => {
  if (typeof document !== 'undefined' && !document.getElementById('skeleton-styles')) {
    const styleSheet = document.createElement('style');
    styleSheet.id = 'skeleton-styles';
    styleSheet.textContent = `
      @keyframes shimmer {
        0% { background-position: 200% 0; }
        100% { background-position: -200% 0; }
      }
      
      @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
      }
      
      .skeleton-fade-in {
        animation: fadeIn 0.3s ease-in;
      }
    `;
    document.head.appendChild(styleSheet);
  }
};

// 订单簿骨架屏
export const OrderBookSkeleton: React.FC<{ rows?: number }> = ({ rows = 10 }) => {
  injectStyles();
  
  return (
    <div className="skeleton-fade-in">
      {/* 标题 */}
      <div style={{ padding: '16px', borderBottom: '1px solid #e5e6eb' }}>
        <Skeleton animation text={{ rows: 1, width: '30%' }} />
      </div>
      
      {/* 表头 */}
      <div style={{ 
        display: 'flex', 
        padding: '8px 16px', 
        background: '#f7f8fa',
        borderBottom: '1px solid #e5e6eb' 
      }}>
        <div style={{ width: '40%' }}><Skeleton animation text={{ rows: 1, width: '60%' }} /></div>
        <div style={{ width: '35%', textAlign: 'center' }}><Skeleton animation text={{ rows: 1, width: '60%' }} /></div>
        <div style={{ width: '25%', textAlign: 'right' }}><Skeleton animation text={{ rows: 1, width: '60%' }} /></div>
      </div>
      
      {/* 行 */}
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          style={{
            display: 'flex',
            padding: '8px 16px',
            borderBottom: '1px solid #e5e6eb',
            background: i % 2 === 0 ? 'rgba(0, 180, 42, 0.04)' : 'rgba(245, 63, 63, 0.04)',
          }}
        >
          <div style={{ width: '40%' }}><Skeleton animation text={{ rows: 1, width: '50%' }} /></div>
          <div style={{ width: '35%', textAlign: 'center' }}><Skeleton animation text={{ rows: 1, width: '50%' }} /></div>
          <div style={{ width: '25%', textAlign: 'right' }}><Skeleton animation text={{ rows: 1, width: '60%' }} /></div>
        </div>
      ))}
    </div>
  );
};

// 交易下单骨架屏
export const TradingOrderSkeleton: React.FC = () => {
  injectStyles();
  
  return (
    <div className="skeleton-fade-in" style={{ padding: '16px' }}>
      {/* 标题 */}
      <div style={{ marginBottom: 16 }}>
        <Skeleton animation text={{ rows: 1, width: '40%' }} />
      </div>
      
      {/* 标签页 */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        <Skeleton animation style={{ width: 80, height: 32, borderRadius: 16 }} />
        <Skeleton animation style={{ width: 80, height: 32, borderRadius: 16 }} />
      </div>
      
      {/* 订单类型 */}
      <div style={{ marginBottom: 16 }}>
        <Skeleton animation text={{ rows: 1, width: '30%' }} />
        <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} animation style={{ width: 60, height: 24, borderRadius: 4 }} />
          ))}
        </div>
      </div>
      
      {/* 价格输入 */}
      <div style={{ marginBottom: 16 }}>
        <Skeleton animation text={{ rows: 1, width: '20%' }} />
        <Skeleton animation style={{ width: '100%', height: 36, marginTop: 8, borderRadius: 4 }} />
      </div>
      
      {/* 数量输入 */}
      <div style={{ marginBottom: 16 }}>
        <Skeleton animation text={{ rows: 1, width: '20%' }} />
        <Skeleton animation style={{ width: '100%', height: 36, marginTop: 8, borderRadius: 4 }} />
      </div>
      
      {/* 快捷按钮 */}
      <div style={{ marginBottom: 16 }}>
        <Skeleton animation text={{ rows: 1, width: '20%' }} />
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} animation style={{ width: 50, height: 24, borderRadius: 4 }} />
          ))}
        </div>
      </div>
      
      {/* 余额信息 */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
          <Skeleton animation text={{ rows: 1, width: '30%' }} />
          <Skeleton animation text={{ rows: 1, width: '40%' }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <Skeleton animation text={{ rows: 1, width: '30%' }} />
          <Skeleton animation text={{ rows: 1, width: '40%' }} />
        </div>
      </div>
      
      {/* 提交按钮 */}
      <Skeleton animation style={{ width: '100%', height: 48, borderRadius: 4, marginTop: 16 }} />
    </div>
  );
};

// K线图骨架屏
export const KLineChartSkeleton: React.FC<{ height?: number }> = ({ height = 400 }) => {
  injectStyles();
  
  return (
    <div className="skeleton-fade-in">
      {/* 控制栏 */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between',
        padding: '12px 16px',
        borderBottom: '1px solid #e5e6eb'
      }}>
        <Skeleton animation text={{ rows: 1, width: '30%' }} />
        <div style={{ display: 'flex', gap: 8 }}>
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} animation style={{ width: 40, height: 24, borderRadius: 4 }} />
          ))}
        </div>
      </div>
      
      {/* 图表区域 */}
      <div style={{ height }}>
        <Skeleton
          animation
          style={{
            width: '100%',
            height: '100%',
            borderRadius: 0,
          }}
        />
      </div>
    </div>
  );
};

// 交易对列表骨架屏
export const TradingPairListSkeleton: React.FC<{ count?: number }> = ({ count = 5 }) => {
  injectStyles();
  
  return (
    <div className="skeleton-fade-in" style={{ padding: '8px' }}>
      {/* 搜索框 */}
      <div style={{ marginBottom: 12 }}>
        <Skeleton animation style={{ width: '100%', height: 32, borderRadius: 4 }} />
      </div>
      
      {/* 列表项 */}
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          style={{
            display: 'flex',
            alignItems: 'center',
            padding: '12px 8px',
            borderBottom: '1px solid #e5e6eb',
          }}
        >
          {/* 图标 */}
          <Skeleton animation circle style={{ width: 32, height: 32, marginRight: 12 }} />
          
          {/* 内容 */}
          <div style={{ flex: 1 }}>
            <Skeleton animation text={{ rows: 1, width: '30%', style: { marginBottom: 4 } }} />
            <Skeleton animation text={{ rows: 1, width: '50%' }} />
          </div>
          
          {/* 价格 */}
          <div style={{ textAlign: 'right' }}>
            <Skeleton animation text={{ rows: 1, width: 60, style: { marginBottom: 4 } }} />
            <Skeleton animation text={{ rows: 1, width: 40 }} />
          </div>
        </div>
      ))}
    </div>
  );
};

// 完整交易界面骨架屏
export const TradingPageSkeleton: React.FC = () => {
  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '250px 1fr 300px', gap: 16 }}>
        {/* 左侧：交易对列表 */}
        <div>
          <TradingPairListSkeleton count={8} />
        </div>
        
        {/* 中间：K线图 + 订单簿 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <KLineChartSkeleton height={400} />
          <OrderBookSkeleton rows={10} />
        </div>
        
        {/* 右侧：交易下单 */}
        <div>
          <TradingOrderSkeleton />
        </div>
      </div>
    </div>
  );
};

// 移动端交易界面骨架屏
export const MobileTradingSkeleton: React.FC = () => {
  return (
    <div style={{ padding: 8 }}>
      {/* 交易对选择器 */}
      <TradingPairListSkeleton count={2} />
      
      {/* 标签页 */}
      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} animation style={{ width: 60, height: 32, borderRadius: 16 }} />
        ))}
      </div>
      
      {/* K线图 */}
      <div style={{ marginTop: 8 }}>
        <KLineChartSkeleton height={300} />
      </div>
    </div>
  );
};

export default {
  OrderBook: OrderBookSkeleton,
  TradingOrder: TradingOrderSkeleton,
  KLineChart: KLineChartSkeleton,
  TradingPairList: TradingPairListSkeleton,
  Page: TradingPageSkeleton,
  Mobile: MobileTradingSkeleton,
};