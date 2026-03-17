/**
 * Order Flow Analysis Types
 * 
 * 订单流分析类型定义
 * 用于分析市场微观结构、识别大单动向和流动性变化
 */

/**
 * 成交记录
 */
export interface Trade {
  id: string;
  price: number;
  quantity: number;
  side: 'buy' | 'sell';  // 主买/主卖
  timestamp: number;
  symbol: string;
}

/**
 * 成交聚合数据
 */
export interface AggregatedTrade {
  price: number;
  buyVolume: number;
  sellVolume: number;
  totalVolume: number;
  tradeCount: number;
  timestamp: number;
}

/**
 * Delta 指标 (买卖量差)
 */
export interface Delta {
  value: number;           // 当前 Delta 值
  cumulative: number;      // 累计 Delta
  timestamp: number;
}

/**
 * Cumulative Delta 数据点
 */
export interface CumulativeDeltaPoint {
  timestamp: number;
  delta: number;           // 单个时间段的 Delta
  cumulative: number;      // 累计值
  buyVolume: number;       // 买入量
  sellVolume: number;      // 卖出量
}

/**
 * 大单定义
 */
export interface LargeOrder {
  id: string;
  price: number;
  quantity: number;
  side: 'bid' | 'ask';
  timestamp: number;
  notionalValue: number;   // 名义价值 (价格 * 数量)
  isIceberg: boolean;      // 是否可能是冰山订单
  detectedAt: number;      // 检测时间
}

/**
 * 大单检测配置
 */
export interface LargeOrderConfig {
  minNotionalValue: number;  // 最小名义价值阈值
  minQuantity: number;       // 最小数量阈值
  icebergDetection: boolean; // 是否启用冰山订单检测
  icebergThreshold: number;  // 冰山订单检测阈值 (同一价格重复出现的次数)
}

/**
 * 订单簿不平衡指标
 */
export interface OrderBookImbalance {
  bidDepth: number;         // 买盘深度
  askDepth: number;         // 卖盘深度
  imbalanceRatio: number;   // 不平衡比率 (bidDepth / askDepth)
  imbalancePercent: number; // 不平衡百分比 (-100% ~ 100%)
  timestamp: number;
}

/**
 * 成交流数据
 */
export interface TradeFlow {
  trades: Trade[];
  buyVolume: number;
  sellVolume: number;
  totalVolume: number;
  vwap: number;            // 成交量加权平均价格
  timestamp: number;
}

/**
 * 订单流警报类型
 */
export type OrderFlowAlertType = 
  | 'large_order_buy'
  | 'large_order_sell'
  | 'imbalance_high'
  | 'imbalance_low'
  | 'delta_spike'
  | 'volume_spike';

/**
 * 订单流警报
 */
export interface OrderFlowAlert {
  id: string;
  type: OrderFlowAlertType;
  message: string;
  data: {
    price?: number;
    quantity?: number;
    value?: number;
    ratio?: number;
    delta?: number;
  };
  timestamp: number;
  severity: 'info' | 'warning' | 'critical';
  acknowledged: boolean;
}

/**
 * 警报配置
 */
export interface AlertConfig {
  enabled: boolean;
  largeOrderThreshold: number;    // 大单阈值 (USD)
  imbalanceThreshold: number;     // 不平衡阈值 (比率)
  deltaSpikeThreshold: number;    // Delta 飙升阈值
  volumeSpikeThreshold: number;   // 成交量飙升阈值 (相对于平均值的倍数)
  cooldownMs: number;             // 同类警报冷却时间 (毫秒)
}

/**
 * 订单流分析结果
 */
export interface OrderFlowAnalysisResult {
  symbol: string;
  timestamp: number;
  
  // Delta 指标
  delta: Delta;
  
  // 订单簿不平衡
  imbalance: OrderBookImbalance;
  
  // 大单列表
  largeOrders: LargeOrder[];
  
  // 最近成交流
  tradeFlow: TradeFlow;
  
  // 警报
  alerts: OrderFlowAlert[];
}

/**
 * 订单流分析配置
 */
export interface OrderFlowAnalysisConfig {
  // 大单检测配置
  largeOrder: LargeOrderConfig;
  
  // 警报配置
  alert: AlertConfig;
  
  // 数据聚合配置
  aggregation: {
    intervalMs: number;     // 聚合间隔 (毫秒)
    maxDataPoints: number;  // 最大数据点数
  };
  
  // 性能配置
  performance: {
    updateThrottleMs: number;  // 更新节流 (毫秒)
    historySize: number;        // 历史数据大小
  };
}

/**
 * 订单流历史数据
 */
export interface OrderFlowHistory {
  deltaHistory: CumulativeDeltaPoint[];
  imbalanceHistory: OrderBookImbalance[];
  tradeFlowHistory: TradeFlow[];
  largeOrderHistory: LargeOrder[];
}

/**
 * 订单流分析状态
 */
export interface OrderFlowState {
  symbol: string;
  loading: boolean;
  error: string | null;
  result: OrderFlowAnalysisResult | null;
  history: OrderFlowHistory;
  config: OrderFlowAnalysisConfig;
}

/**
 * 深度图数据点
 */
export interface DepthChartPoint {
  price: number;
  bidQuantity: number;
  askQuantity: number;
  bidTotal: number;   // 累计买单量
  askTotal: number;   // 累计卖单量
}

/**
 * 委托队列分析
 */
export interface OrderQueueAnalysis {
  bidQueue: number;    // 买单队列长度
  askQueue: number;    // 卖单队列长度
  bidVelocity: number; // 买单队列变化速度
  askVelocity: number; // 卖单队列变化速度
  timestamp: number;
}

/**
 * 默认配置
 */
export const DEFAULT_ORDER_FLOW_CONFIG: OrderFlowAnalysisConfig = {
  largeOrder: {
    minNotionalValue: 10000,    // $10,000 USD
    minQuantity: 0.1,
    icebergDetection: true,
    icebergThreshold: 3,
  },
  alert: {
    enabled: true,
    largeOrderThreshold: 50000,    // $50,000 USD
    imbalanceThreshold: 2.0,       // 2:1 比率
    deltaSpikeThreshold: 100,      // Delta 变化阈值
    volumeSpikeThreshold: 3.0,     // 3 倍平均值
    cooldownMs: 60000,             // 1 分钟冷却
  },
  aggregation: {
    intervalMs: 1000,    // 1 秒聚合
    maxDataPoints: 1000, // 最多 1000 个数据点
  },
  performance: {
    updateThrottleMs: 100, // 100ms 节流
    historySize: 500,       // 保留 500 条历史
  },
};
