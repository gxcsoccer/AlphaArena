import { Trade } from '../matching/types';
import { Position, PortfolioSnapshot, PortfolioUpdateResult } from './types';

/**
 * Portfolio - 投资组合管理
 * 
 * 负责跟踪：
 * - 现金余额
 * - 各股票持仓数量和平均成本
 * - 根据成交记录更新持仓
 * - 计算总市值和盈亏
 */
export class Portfolio {
  private cashBalance: number;
  private positions: Map<string, Position>;

  constructor(initialCash: number = 0) {
    this.cashBalance = initialCash;
    this.positions = new Map<string, Position>();
  }

  /**
   * 获取现金余额
   */
  getCash(): number {
    return this.cashBalance;
  }

  /**
   * 获取指定股票的持仓
   * @param symbol 股票代码
   */
  getPosition(symbol: string): Position | undefined {
    return this.positions.get(symbol);
  }

  /**
   * 获取所有持仓
   */
  getAllPositions(): Position[] {
    return Array.from(this.positions.values());
  }

  /**
   * 根据成交记录更新持仓
   * @param trade 成交记录
   * @param portfolioOrderId 属于组合的订单 ID（用于判断是买入还是卖出）
   * @returns 更新结果（包含已实现盈亏）
   */
  onTrade(trade: Trade, portfolioOrderId: string): PortfolioUpdateResult {
    // 判断组合是买方还是卖方
    const isBuy = trade.buyOrderId === portfolioOrderId;
    const symbol = this.extractSymbolFromOrderId(portfolioOrderId);
    
    // 获取或创建持仓
    let position = this.positions.get(symbol);
    if (!position) {
      position = {
        symbol,
        quantity: 0,
        averageCost: 0
      };
      this.positions.set(symbol, position);
    }

    let realizedPnL = 0;

    if (isBuy) {
      // 买入：增加持仓，更新平均成本
      const totalCost = position.quantity * position.averageCost + trade.quantity * trade.price;
      position.quantity += trade.quantity;
      position.averageCost = position.quantity > 0 ? totalCost / position.quantity : 0;
      
      // 扣除现金
      this.cashBalance -= trade.quantity * trade.price;
    } else {
      // 卖出：减少持仓，计算已实现盈亏
      const sellQuantity = trade.quantity;
      const costBasis = position.averageCost * sellQuantity;
      const proceeds = trade.price * sellQuantity;
      
      realizedPnL = proceeds - costBasis;
      
      position.quantity -= sellQuantity;
      
      // 如果持仓清零，平均成本也清零
      if (position.quantity <= 0) {
        position.quantity = 0;
        position.averageCost = 0;
      }
      
      // 增加现金
      this.cashBalance += proceeds;
    }

    return {
      position,
      tradeQuantity: trade.quantity,
      tradePrice: trade.price,
      realizedPnL
    };
  }

  /**
   * 计算持仓总市值（需要当前市场价格）
   * @param marketPrices 各股票的当前市场价格
   */
  getPositionValue(marketPrices: Map<string, number>): number {
    let totalValue = 0;
    for (const position of this.positions.values()) {
      const price = marketPrices.get(position.symbol);
      if (price !== undefined) {
        totalValue += position.quantity * price;
      }
    }
    return totalValue;
  }

  /**
   * 计算总资产值（现金 + 持仓市值）
   * @param marketPrices 各股票的当前市场价格
   */
  getTotalValue(marketPrices: Map<string, number>): number {
    return this.cashBalance + this.getPositionValue(marketPrices);
  }

  /**
   * 计算未实现盈亏
   * @param marketPrices 各股票的当前市场价格
   */
  getUnrealizedPnL(marketPrices: Map<string, number>): number {
    let unrealizedPnL = 0;
    for (const position of this.positions.values()) {
      const currentPrice = marketPrices.get(position.symbol);
      if (currentPrice !== undefined && position.quantity > 0) {
        unrealizedPnL += (currentPrice - position.averageCost) * position.quantity;
      }
    }
    return unrealizedPnL;
  }

  /**
   * 获取组合快照
   * @param marketPrices 各股票的当前市场价格
   */
  getSnapshot(marketPrices: Map<string, number>): PortfolioSnapshot {
    return {
      cash: this.cashBalance,
      positions: this.getAllPositions(),
      totalValue: this.getTotalValue(marketPrices),
      unrealizedPnL: this.getUnrealizedPnL(marketPrices),
      timestamp: Date.now()
    };
  }

  /**
   * 从订单 ID 提取股票代码
   * 假设订单 ID 格式为：symbol-xxx 或包含 symbol 信息
   * @param orderId 订单 ID
   */
  private extractSymbolFromOrderId(orderId: string): string {
    // 简单实现：假设订单 ID 以股票代码开头，用连字符分隔
    const parts = orderId.split('-');
    return parts[0] || 'UNKNOWN';
  }

  /**
   * 重置组合（用于测试）
   */
  reset(initialCash: number = 0): void {
    this.cashBalance = initialCash;
    this.positions.clear();
  }
}
