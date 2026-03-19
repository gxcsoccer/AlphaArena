/**
 * Risk Alert System Types
 * 
 * Defines types for risk monitoring and alerting
 */

/**
 * Risk types for alerts
 */
export type RiskType = 
  | 'concentration'      // 持仓集中度风险
  | 'drawdown'           // 回撤风险
  | 'volatility'         // 波动率风险
  | 'leverage'           // 杠杆风险
  | 'liquidity';         // 流动性风险

/**
 * Risk alert severity levels
 */
export type RiskSeverity = 'low' | 'medium' | 'high' | 'critical';

/**
 * Risk alert status
 */
export type RiskAlertStatus = 
  | 'active'             // 告警激活中
  | 'acknowledged'       // 已确认
  | 'resolved'           // 已解决
  | 'expired';           // 已过期

/**
 * Notification channels
 */
export interface NotificationChannels {
  inApp: boolean;        // 站内通知
  email: boolean;        // 邮件通知
  webhook: boolean;      // Webhook (Slack, 钉钉等)
}

/**
 * Risk alert rule configuration
 */
export interface RiskAlertRule {
  id: string;
  userId: string;
  name: string;
  description?: string;
  riskType: RiskType;
  
  // 阈值配置
  threshold: number;              // 主阈值
  secondaryThreshold?: number;   // 次级阈值（可选）
  
  // 告警配置
  severity: RiskSeverity;
  channels: NotificationChannels;
  webhookUrl?: string;
  emailAddress?: string;
  
  // 冷却时间（分钟）
  cooldownMinutes: number;
  
  // 静默时段
  quietHoursStart?: string;       // HH:MM 格式
  quietHoursEnd?: string;         // HH:MM 格式
  
  // 状态
  isEnabled: boolean;
  lastTriggeredAt?: Date;
  triggerCount: number;
  
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Risk metrics for a portfolio
 */
export interface RiskMetrics {
  // 持仓集中度
  concentration: {
    maxPositionRatio: number;     // 最大持仓占比
    topThreeRatio: number;        // 前三大持仓占比
    herfindahlIndex: number;      // 赫芬达尔指数
  };
  
  // 回撤
  drawdown: {
    current: number;              // 当前回撤
    max: number;                  // 历史最大回撤
    duration: number;             // 回撤持续时间（天）
  };
  
  // 波动率
  volatility: {
    daily: number;               // 日波动率
    weekly: number;              // 周波动率
    monthly: number;             // 月波动率
  };
  
  // 杠杆
  leverage: {
    total: number;                // 总杠杆
    marginUsed: number;          // 已用保证金
    marginAvailable: number;      // 可用保证金
    marginRatio: number;          // 保证金率
  };
  
  // 流动性
  liquidity: {
    avgDailyVolume: number;      // 平均日成交量
    liquidityScore: number;      // 流动性评分 (0-100)
    illiquidPositions: number;   // 流动性不足的持仓数
  };
  
  // 综合风险评分
  overallScore: number;           // 0-100，越高越危险
}

/**
 * Risk alert instance
 */
export interface RiskAlert {
  id: string;
  userId: string;
  ruleId?: string;
  riskType: RiskType;
  severity: RiskSeverity;
  status: RiskAlertStatus;
  
  // 告警详情
  title: string;
  message: string;
  
  // 风险数据
  currentValue: number;
  threshold: number;
  
  // 上下文数据
  context: Record<string, unknown>;
  
  // 时间戳
  triggeredAt: Date;
  acknowledgedAt?: Date;
  resolvedAt?: Date;
  expiresAt?: Date;
  
  // 通知状态
  notificationChannels: NotificationChannels;
  notificationStatus: 'pending' | 'sent' | 'failed' | 'skipped';
  sentAt?: Date;
}

/**
 * Position data for risk calculation
 */
export interface PositionData {
  symbol: string;
  quantity: number;
  averageCost: number;
  currentPrice: number;
  marketValue: number;
  unrealizedPnL: number;
  dailyVolume?: number;
}

/**
 * Portfolio data for risk calculation
 */
export interface PortfolioData {
  totalValue: number;             // 总资产
  cash: number;                  // 现金
  positions: PositionData[];     // 持仓
  marginUsed?: number;            // 已用保证金
  marginAvailable?: number;      // 可用保证金
  equityHighWaterMark?: number;  // 权益高水位
  equityHistory?: number[];       // 权益历史（用于计算波动率）
}

/**
 * Risk alert trigger input
 */
export interface RiskAlertTrigger {
  userId: string;
  riskType: RiskType;
  currentValue: number;
  threshold: number;
  context?: Record<string, unknown>;
}

/**
 * Risk alert configuration for user
 */
export interface UserRiskConfig {
  userId: string;
  alertsEnabled: boolean;
  defaultChannels: NotificationChannels;
  defaultWebhookUrl?: string;
  emailAddress?: string;
  quietHoursStart?: string;
  quietHoursEnd?: string;
  maxAlertsPerHour: number;
  
  // 预设阈值
  presetThresholds: {
    concentration: number;       // 持仓集中度阈值
    drawdown: number;            // 回撤阈值
    volatility: number;          // 波动率阈值
    leverage: number;            // 杠杆阈值
    liquidity: number;           // 流动性阈值
  };
  
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Risk alert history entry
 */
export interface RiskAlertHistory {
  id: string;
  userId: string;
  riskType: RiskType;
  severity: RiskSeverity;
  title: string;
  message: string;
  currentValue: number;
  threshold: number;
  context: Record<string, unknown>;
  notificationStatus: string;
  triggeredAt: Date;
  acknowledgedAt?: Date;
  resolvedAt?: Date;
}

/**
 * Risk calculation result
 */
export interface RiskCalculationResult {
  riskType: RiskType;
  value: number;
  threshold: number;
  exceeded: boolean;
  severity: RiskSeverity;
  message: string;
  details: Record<string, unknown>;
}

/**
 * Risk alert stats
 */
export interface RiskAlertStats {
  totalAlerts: number;
  activeAlerts: number;
  byType: Record<RiskType, number>;
  bySeverity: Record<RiskSeverity, number>;
  avgResponseTime?: number;
  lastAlertAt?: Date;
}