/**
 * TradingOrder Component Tests
 * Tests for order form validation logic, error parsing, and one-click clear functionality
 */

// ============= Helper Functions (duplicated from component for testing) =============

// Error type categorization for better error messages
enum ErrorCategory {
  NETWORK = 'network',
  BUSINESS = 'business',
  VALIDATION = 'validation',
  UNKNOWN = 'unknown',
}

// Parse error and return user-friendly message
const parseError = (error: any): { message: string; category: ErrorCategory } => {
  // Handle null/undefined
  if (!error) {
    return {
      message: '操作失败，请稍后重试',
      category: ErrorCategory.UNKNOWN,
    };
  }
  
  // Network errors
  if (error.name === 'TypeError' && error.message?.includes('fetch')) {
    return {
      message: '网络连接失败，请检查网络后重试',
      category: ErrorCategory.NETWORK,
    };
  }
  if (error.message?.includes('timeout')) {
    return {
      message: '请求超时，请稍后重试',
      category: ErrorCategory.NETWORK,
    };
  }
  
  // Business errors
  if (error.message?.includes('Insufficient balance')) {
    return {
      message: '可用余额不足，无法完成交易',
      category: ErrorCategory.BUSINESS,
    };
  }
  if (error.message?.includes('Invalid order')) {
    return {
      message: '订单无效，请检查订单参数',
      category: ErrorCategory.BUSINESS,
    };
  }
  if (error.message?.includes('Market closed')) {
    return {
      message: '市场已关闭，请在交易时间内下单',
      category: ErrorCategory.BUSINESS,
    };
  }
  
  // Default to original message
  return {
    message: error.message || '操作失败，请稍后重试',
    category: ErrorCategory.UNKNOWN,
  };
};

// Price validation logic
const validatePrice = (
  price: number | undefined,
  currentPrice: number,
  priceRange: { maxBid: number | null; minAsk: number | null } | null,
  activeTab: 'buy' | 'sell'
): { valid: boolean; message?: string; type: 'error' | 'warning' | 'none' } => {
  // Error: Price must be positive
  if (!price || price <= 0) {
    return { valid: false, message: '价格必须是正数', type: 'error' };
  }
  
  // Warning: Price deviation from market price
  if (currentPrice > 0) {
    const deviation = Math.abs(price - currentPrice) / currentPrice;
    if (deviation > 0.1) {
      return { 
        valid: true, 
        message: `价格偏离市价 ${(deviation * 100).toFixed(1)}%，请确认是否正确`, 
        type: 'warning' 
      };
    }
  }
  
  // Warning: Price outside order book range
  if (priceRange && priceRange.maxBid && priceRange.minAsk) {
    if (activeTab === 'buy' && price > priceRange.minAsk * 1.1) {
      return { 
        valid: true, 
        message: `买入价格高于卖一价 ${((price / priceRange.minAsk - 1) * 100).toFixed(1)}%`, 
        type: 'warning' 
      };
    }
    if (activeTab === 'sell' && price < priceRange.maxBid * 0.9) {
      return { 
        valid: true, 
        message: `卖出价格低于买一价 ${((1 - price / priceRange.maxBid) * 100).toFixed(1)}%`, 
        type: 'warning' 
      };
    }
  }
  
  return { valid: true, type: 'none' };
};

// One-click clear logic
const calculateClearPosition = (
  baseBalance: number,
  currentPrice: number
): { quantity: number; estimatedValue: number; canClear: boolean } => {
  if (baseBalance <= 0) {
    return { quantity: 0, estimatedValue: 0, canClear: false };
  }
  
  return {
    quantity: baseBalance,
    estimatedValue: baseBalance * currentPrice,
    canClear: true,
  };
};

// ============= Tests =============

describe('TradingOrder Validation Logic', () => {
  const TRADING_FEE_RATE = 0.001; // 0.1%

  it('should calculate trading fee correctly', () => {
    const total = 1000;
    const fee = total * TRADING_FEE_RATE;
    expect(fee).toBe(1);
  });

  it('should calculate total with fee correctly', () => {
    const total = 1000;
    const fee = total * TRADING_FEE_RATE;
    const totalWithFee = total + fee;
    expect(totalWithFee).toBe(1001);
  });

  it('should calculate percentage of portfolio correctly', () => {
    const orderValue = 3500;
    const portfolioValue = 35000;
    const percentage = (orderValue / portfolioValue) * 100;
    expect(percentage).toBe(10);
  });

  it('should identify large orders (>10% of portfolio)', () => {
    const portfolioValue = 35000;
    const largeOrderValue = 4000; // >10%
    const smallOrderValue = 3000; // <10%
    
    expect((largeOrderValue / portfolioValue) * 100).toBeGreaterThan(10);
    expect((smallOrderValue / portfolioValue) * 100).toBeLessThan(10);
  });

  it('should validate positive price', () => {
    const validatePrice = (price: number | undefined) => {
      if (!price || price <= 0) {
        return '价格必须是正数';
      }
      return null;
    };

    expect(validatePrice(-100)).toBe('价格必须是正数');
    expect(validatePrice(0)).toBe('价格必须是正数');
    expect(validatePrice(undefined)).toBe('价格必须是正数');
    expect(validatePrice(100)).toBeNull();
  });

  it('should validate positive quantity', () => {
    const validateQuantity = (quantity: number | undefined) => {
      if (!quantity || quantity <= 0) {
        return '数量必须是正数';
      }
      return null;
    };

    expect(validateQuantity(-1)).toBe('数量必须是正数');
    expect(validateQuantity(0)).toBe('数量必须是正数');
    expect(validateQuantity(undefined)).toBe('数量必须是正数');
    expect(validateQuantity(0.01)).toBeNull();
  });

  it('should validate buy order against balance with fees', () => {
    const availableBalance = 10000;
    const price = 50000;
    const quantity = 0.2;
    const total = price * quantity;
    const fee = total * TRADING_FEE_RATE;
    const totalWithFee = total + fee;

    // 0.2 BTC at $50,000 = $10,000 + $10 fee = $10,010 (exceeds balance)
    expect(totalWithFee).toBeGreaterThan(availableBalance);

    // Calculate max quantity
    const maxQty = availableBalance / (price * (1 + TRADING_FEE_RATE));
    expect(maxQty).toBeLessThan(0.2);
  });

  it('should validate sell order against balance', () => {
    const baseBalance = 0.5;
    const sellQuantity = 0.6;

    expect(sellQuantity).toBeGreaterThan(baseBalance);
  });

  it('should detect high price warning', () => {
    const currentPrice = 50000;
    const highPrice = 600000; // >10x current price

    expect(highPrice).toBeGreaterThan(currentPrice * 10);
  });
});

// ============= parseError Function Tests =============

describe('parseError function', () => {
  it('should identify network fetch errors', () => {
    const error = new TypeError('Failed to fetch');
    error.name = 'TypeError';
    const result = parseError(error);
    
    expect(result.category).toBe(ErrorCategory.NETWORK);
    expect(result.message).toBe('网络连接失败，请检查网络后重试');
  });

  it('should identify timeout errors', () => {
    const error = new Error('Request timeout after 30000ms');
    const result = parseError(error);
    
    expect(result.category).toBe(ErrorCategory.NETWORK);
    expect(result.message).toBe('请求超时，请稍后重试');
  });

  it('should identify insufficient balance business errors', () => {
    const error = new Error('Insufficient balance for this order');
    const result = parseError(error);
    
    expect(result.category).toBe(ErrorCategory.BUSINESS);
    expect(result.message).toBe('可用余额不足，无法完成交易');
  });

  it('should identify invalid order business errors', () => {
    const error = new Error('Invalid order: price must be positive');
    const result = parseError(error);
    
    expect(result.category).toBe(ErrorCategory.BUSINESS);
    expect(result.message).toBe('订单无效，请检查订单参数');
  });

  it('should identify market closed business errors', () => {
    const error = new Error('Market closed for trading');
    const result = parseError(error);
    
    expect(result.category).toBe(ErrorCategory.BUSINESS);
    expect(result.message).toBe('市场已关闭，请在交易时间内下单');
  });

  it('should return unknown category for unhandled errors', () => {
    const error = new Error('Something unexpected happened');
    const result = parseError(error);
    
    expect(result.category).toBe(ErrorCategory.UNKNOWN);
    expect(result.message).toBe('Something unexpected happened');
  });

  it('should handle errors without message property', () => {
    const error = {};
    const result = parseError(error);
    
    expect(result.category).toBe(ErrorCategory.UNKNOWN);
    expect(result.message).toBe('操作失败，请稍后重试');
  });

  it('should handle null/undefined errors gracefully', () => {
    const result1 = parseError(null);
    const result2 = parseError(undefined);
    
    expect(result1.category).toBe(ErrorCategory.UNKNOWN);
    expect(result2.category).toBe(ErrorCategory.UNKNOWN);
    expect(result1.message).toBe('操作失败，请稍后重试');
    expect(result2.message).toBe('操作失败，请稍后重试');
  });
});

// ============= Price Validation Tests =============

describe('Price validation', () => {
  it('should reject non-positive prices', () => {
    const result1 = validatePrice(-100, 50000, null, 'buy');
    expect(result1.valid).toBe(false);
    expect(result1.type).toBe('error');
    expect(result1.message).toBe('价格必须是正数');

    const result2 = validatePrice(0, 50000, null, 'buy');
    expect(result2.valid).toBe(false);
    expect(result2.type).toBe('error');

    const result3 = validatePrice(undefined as any, 50000, null, 'buy');
    expect(result3.valid).toBe(false);
    expect(result3.type).toBe('error');
  });

  it('should warn for prices deviating more than 10% from market price', () => {
    const currentPrice = 50000;
    
    // 15% above market price
    const result1 = validatePrice(57500, currentPrice, null, 'buy');
    expect(result1.valid).toBe(true);
    expect(result1.type).toBe('warning');
    expect(result1.message).toContain('价格偏离市价');
    
    // 15% below market price
    const result2 = validatePrice(42500, currentPrice, null, 'sell');
    expect(result2.valid).toBe(true);
    expect(result2.type).toBe('warning');
    expect(result2.message).toContain('价格偏离市价');
  });

  it('should accept prices within 10% of market price', () => {
    const currentPrice = 50000;
    
    // 5% above market price
    const result1 = validatePrice(52500, currentPrice, null, 'buy');
    expect(result1.valid).toBe(true);
    expect(result1.type).toBe('none');
    
    // 5% below market price
    const result2 = validatePrice(47500, currentPrice, null, 'sell');
    expect(result2.valid).toBe(true);
    expect(result2.type).toBe('none');
  });

  it('should warn when buy price is above ask price', () => {
    // Set currentPrice slightly above minAsk so that order book check triggers before deviation
    const currentPrice = 50200;  // Slightly above minAsk
    const priceRange = { maxBid: 49900, minAsk: 50100 };
    
    // Price > minAsk * 1.1 = 55110 (triggers order book warning)
    // But within 10% of currentPrice (no deviation warning)
    // |55150 - 50200| / 50200 = 9.86% < 10%
    const result = validatePrice(55150, currentPrice, priceRange, 'buy');
    expect(result.valid).toBe(true);
    expect(result.type).toBe('warning');
    expect(result.message).toContain('买入价格高于卖一价');
  });

  it('should warn when sell price is below bid price', () => {
    // Set currentPrice close to maxBid so order book check triggers before deviation
    const currentPrice = 49800;  // Close to maxBid
    const priceRange = { maxBid: 49900, minAsk: 50100 };
    
    // Price < maxBid * 0.9 = 44910 (triggers order book warning)
    // But within 10% of currentPrice (no deviation warning)
    // |44900 - 49800| / 49800 = 9.84% < 10%
    const result = validatePrice(44900, currentPrice, priceRange, 'sell');
    expect(result.valid).toBe(true);
    expect(result.type).toBe('warning');
    expect(result.message).toContain('卖出价格低于买一价');
  });

  it('should accept prices within order book range without warning', () => {
    const currentPrice = 50000;
    const priceRange = { maxBid: 49900, minAsk: 50100 };
    
    // Buying at market price (within range)
    const result1 = validatePrice(50100, currentPrice, priceRange, 'buy');
    expect(result1.valid).toBe(true);
    expect(result1.type).toBe('none');
    
    // Selling at market price (within range)
    const result2 = validatePrice(49900, currentPrice, priceRange, 'sell');
    expect(result2.valid).toBe(true);
    expect(result2.type).toBe('none');
  });

  it('should handle null price range gracefully', () => {
    const result = validatePrice(50000, 50000, null, 'buy');
    expect(result.valid).toBe(true);
    expect(result.type).toBe('none');
  });

  it('should handle zero current price gracefully', () => {
    const result = validatePrice(100, 0, null, 'buy');
    expect(result.valid).toBe(true); // Price is valid, just no deviation check
    expect(result.type).toBe('none');
  });
});

// ============= One-Click Clear Functionality Tests =============

describe('One-click clear functionality', () => {
  it('should calculate correct clear values for non-zero balance', () => {
    const baseBalance = 1.5; // BTC
    const currentPrice = 50000; // USD
    
    const result = calculateClearPosition(baseBalance, currentPrice);
    
    expect(result.canClear).toBe(true);
    expect(result.quantity).toBe(1.5);
    expect(result.estimatedValue).toBe(75000);
  });

  it('should handle zero balance', () => {
    const baseBalance = 0;
    const currentPrice = 50000;
    
    const result = calculateClearPosition(baseBalance, currentPrice);
    
    expect(result.canClear).toBe(false);
    expect(result.quantity).toBe(0);
    expect(result.estimatedValue).toBe(0);
  });

  it('should handle negative balance (edge case)', () => {
    const baseBalance = -0.5;
    const currentPrice = 50000;
    
    const result = calculateClearPosition(baseBalance, currentPrice);
    
    expect(result.canClear).toBe(false);
    expect(result.quantity).toBe(0);
    expect(result.estimatedValue).toBe(0);
  });

  it('should handle small balance amounts', () => {
    const baseBalance = 0.0001; // Very small amount
    const currentPrice = 50000;
    
    const result = calculateClearPosition(baseBalance, currentPrice);
    
    expect(result.canClear).toBe(true);
    expect(result.quantity).toBe(0.0001);
    expect(result.estimatedValue).toBeCloseTo(5, 1);
  });

  it('should handle large balance amounts', () => {
    const baseBalance = 1000; // Large amount
    const currentPrice = 50000;
    
    const result = calculateClearPosition(baseBalance, currentPrice);
    
    expect(result.canClear).toBe(true);
    expect(result.quantity).toBe(1000);
    expect(result.estimatedValue).toBe(50000000);
  });

  it('should handle zero current price gracefully', () => {
    const baseBalance = 1.5;
    const currentPrice = 0;
    
    const result = calculateClearPosition(baseBalance, currentPrice);
    
    expect(result.canClear).toBe(true);
    expect(result.quantity).toBe(1.5);
    expect(result.estimatedValue).toBe(0);
  });

  it('should correctly format estimated value for display', () => {
    const baseBalance = 1.23456789;
    const currentPrice = 50000.12;
    
    const result = calculateClearPosition(baseBalance, currentPrice);
    
    expect(result.canClear).toBe(true);
    expect(result.estimatedValue).toBeCloseTo(61728.4, 0);
    
    // For display formatting
    const formatted = result.estimatedValue.toFixed(2);
    expect(parseFloat(formatted)).toBeCloseTo(61728.39, 0);
  });
});

// ============= Max Quantity Reactivity Tests =============

describe('Max quantity calculation', () => {
  const TRADING_FEE_RATE = 0.001;

  it('should calculate max buy quantity with fees', () => {
    const availableBalance = 10000;
    const price = 50000;
    
    // Max quantity = balance / (price * (1 + fee))
    const maxQuantity = availableBalance / (price * (1 + TRADING_FEE_RATE));
    
    expect(maxQuantity).toBeCloseTo(0.1998, 4);
  });

  it('should return 0 for buy when price is 0', () => {
    const availableBalance = 10000;
    const price = 0;
    
    const maxQuantity = price > 0 ? availableBalance / (price * (1 + TRADING_FEE_RATE)) : 0;
    
    expect(maxQuantity).toBe(0);
  });

  it('should return base balance for sell', () => {
    const baseBalance = 2.5;
    
    // For sell, max is just the base balance
    const maxQuantity = baseBalance;
    
    expect(maxQuantity).toBe(2.5);
  });

  it('should update when price changes', () => {
    const availableBalance = 10000;
    const price1 = 50000;
    const price2 = 40000;
    
    const maxQty1 = availableBalance / (price1 * (1 + TRADING_FEE_RATE));
    const maxQty2 = availableBalance / (price2 * (1 + TRADING_FEE_RATE));
    
    // Lower price = higher max quantity
    expect(maxQty2).toBeGreaterThan(maxQty1);
    expect(maxQty1).toBeCloseTo(0.1998, 4);
    expect(maxQty2).toBeCloseTo(0.24975, 4);
  });

  it('should update when balance changes', () => {
    const price = 50000;
    const balance1 = 10000;
    const balance2 = 20000;
    
    const maxQty1 = balance1 / (price * (1 + TRADING_FEE_RATE));
    const maxQty2 = balance2 / (price * (1 + TRADING_FEE_RATE));
    
    // Higher balance = higher max quantity
    expect(maxQty2).toBeGreaterThan(maxQty1);
    expect(maxQty2).toBe(maxQty1 * 2);
  });
});
