/**
 * Fee Calculator
 * Trading fee calculation with support for different markets
 */

export interface FeeConfig {
  commission: number;       // 佣金率
  minCommission: number;    // 最低佣金
  stamp: number;            // 印花税率 (卖出时)
  transfer: number;         // 过户费率
}

export interface FeeBreakdown {
  commission: number;       // 佣金
  stamp: number;            // 印花税
  transfer: number;         // 过户费
  total: number;            // 总费用
}

export type MarketType = 'us' | 'cn-a' | 'cn-b' | 'hk' | 'crypto';

// ============================================
// Default Fee Configurations by Market
// ============================================

export const DEFAULT_FEE_CONFIGS: Record<MarketType, FeeConfig> = {
  // US stock market
  'us': {
    commission: 0,           // Many brokers offer $0 commission
    minCommission: 0,
    stamp: 0,                // No stamp duty in US
    transfer: 0.00000278,    // SEC fee (sell only, ~$0.0000278 per $1)
  },
  
  // China A-share market
  'cn-a': {
    commission: 0.0003,      // 0.03%
    minCommission: 5,        // 5 CNY minimum
    stamp: 0.001,            // 0.1% (sell only)
    transfer: 0.00001,       // 0.001%
  },
  
  // China B-share market
  'cn-b': {
    commission: 0.0003,
    minCommission: 1,        // 1 USD minimum
    stamp: 0.001,
    transfer: 0.00001,
  },
  
  // Hong Kong stock market
  'hk': {
    commission: 0.0003,
    minCommission: 3,        // 3 HKD minimum
    stamp: 0.001,            // 0.1% (both buy and sell)
    transfer: 0.00005,       // 0.005%
  },
  
  // Crypto market
  'crypto': {
    commission: 0.001,       // 0.1% (typical exchange fee)
    minCommission: 0,
    stamp: 0,
    transfer: 0,
  },
};

// ============================================
// Fee Calculator Class
// ============================================

export class FeeCalculator {
  private config: FeeConfig;
  
  constructor(config?: FeeConfig | MarketType) {
    if (typeof config === 'string') {
      this.config = DEFAULT_FEE_CONFIGS[config];
    } else if (config) {
      this.config = config;
    } else {
      this.config = DEFAULT_FEE_CONFIGS['us'];
    }
  }
  
  /**
   * Calculate trading fee
   */
  calculate(tradeAmount: number, side: 'buy' | 'sell'): FeeBreakdown {
    // Commission
    const commission = Math.max(
      tradeAmount * this.config.commission,
      this.config.minCommission
    );
    
    // Stamp duty (typically sell only)
    const stamp = side === 'sell' 
      ? tradeAmount * this.config.stamp 
      : 0;
    
    // Transfer fee
    const transfer = tradeAmount * this.config.transfer;
    
    // Total
    const total = commission + stamp + transfer;
    
    return {
      commission,
      stamp,
      transfer,
      total,
    };
  }
  
  /**
   * Calculate total cost for a buy order
   */
  calculateBuyCost(price: number, quantity: number): {
    tradeAmount: number;
    fees: FeeBreakdown;
    totalCost: number;
  } {
    const tradeAmount = price * quantity;
    const fees = this.calculate(tradeAmount, 'buy');
    
    return {
      tradeAmount,
      fees,
      totalCost: tradeAmount + fees.total,
    };
  }
  
  /**
   * Calculate net proceeds for a sell order
   */
  calculateSellProceeds(price: number, quantity: number): {
    tradeAmount: number;
    fees: FeeBreakdown;
    netProceeds: number;
  } {
    const tradeAmount = price * quantity;
    const fees = this.calculate(tradeAmount, 'sell');
    
    return {
      tradeAmount,
      fees,
      netProceeds: tradeAmount - fees.total,
    };
  }
  
  /**
   * Calculate realized P&L for a round-trip trade
   */
  calculateRealizedPnl(
    buyPrice: number,
    sellPrice: number,
    quantity: number
  ): {
    grossPnl: number;
    buyFees: FeeBreakdown;
    sellFees: FeeBreakdown;
    totalFees: number;
    netPnl: number;
    pnlPercent: number;
  } {
    const buyAmount = buyPrice * quantity;
    const sellAmount = sellPrice * quantity;
    
    const buyFees = this.calculate(buyAmount, 'buy');
    const sellFees = this.calculate(sellAmount, 'sell');
    
    const grossPnl = sellAmount - buyAmount;
    const totalFees = buyFees.total + sellFees.total;
    const netPnl = grossPnl - totalFees;
    const pnlPercent = buyAmount > 0 ? (netPnl / buyAmount) * 100 : 0;
    
    return {
      grossPnl,
      buyFees,
      sellFees,
      totalFees,
      netPnl,
      pnlPercent,
    };
  }
  
  /**
   * Get current configuration
   */
  getConfig(): FeeConfig {
    return { ...this.config };
  }
  
  /**
   * Update configuration
   */
  setConfig(config: Partial<FeeConfig>): void {
    this.config = { ...this.config, ...config };
  }
}

// ============================================
// Utility Functions
// ============================================

/**
 * Create a fee calculator for a specific market
 */
export function createFeeCalculator(market: MarketType): FeeCalculator {
  return new FeeCalculator(market);
}

/**
 * Calculate fee with default US market configuration
 */
export function calculateUsFee(tradeAmount: number, side: 'buy' | 'sell'): FeeBreakdown {
  const calculator = new FeeCalculator('us');
  return calculator.calculate(tradeAmount, side);
}

/**
 * Calculate fee with default CN-A market configuration
 */
export function calculateCnAFee(tradeAmount: number, side: 'buy' | 'sell'): FeeBreakdown {
  const calculator = new FeeCalculator('cn-a');
  return calculator.calculate(tradeAmount, side);
}

export default FeeCalculator;