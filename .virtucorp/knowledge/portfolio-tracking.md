# Portfolio Tracking Implementation

## Date: 2026-03-11
## Issue: #3
## PR: #9

## Implementation Summary

### Core Design
- **Portfolio class** manages cash balance and stock positions
- Uses `Map<string, Position>` for efficient position lookup by symbol
- Position tracks: symbol, quantity, averageCost

### Key Methods
1. **onTrade(trade, portfolioOrderId)**: Update portfolio from trade
   - Requires portfolioOrderId to determine buy/sell side
   - Buy: increases position, updates average cost, decreases cash
   - Sell: decreases position, calculates realized P&L, increases cash
   - Clears position (quantity=0, averageCost=0) when fully sold

2. **getCash()**: Returns current cash balance

3. **getPosition(symbol)**: Returns position for symbol or undefined

4. **getPositionValue(marketPrices)**: Calculate total position value
   - Takes Map<string, number> of current market prices
   - Ignores positions without price data

5. **getTotalValue(marketPrices)**: Cash + position value

6. **getUnrealizedPnL(marketPrices)**: Sum of (currentPrice - averageCost) * quantity
   - Only includes positions with quantity > 0

7. **getSnapshot(marketPrices)**: Complete portfolio state

### Trade Integration
- Portfolio needs to know which order ID belongs to it
- `onTrade` accepts `portfolioOrderId` parameter
- Determines buy/sell by comparing: `trade.buyOrderId === portfolioOrderId`
- This design allows Portfolio to subscribe to trade stream and filter its own trades

### Average Cost Calculation
```typescript
totalCost = oldQuantity * oldAverageCost + tradeQuantity * tradePrice
newAverageCost = totalCost / newQuantity
```

### Realized P&L (on sell)
```typescript
costBasis = averageCost * sellQuantity
proceeds = tradePrice * sellQuantity
realizedPnL = proceeds - costBasis
```

## Test Coverage
- 28 test cases covering:
  - Constructor and initial state
  - Buy orders (new position, additional buys, multiple trades)
  - Sell orders (reduce position, realized P&L, clear position)
  - Position value calculations
  - Total value and unrealized P&L
  - Multiple symbols
  - Edge cases (zero quantity, large numbers)

## Files Created
- `src/portfolio/types.ts`: Position, PortfolioSnapshot, PortfolioUpdateResult
- `src/portfolio/Portfolio.ts`: Main Portfolio class
- `src/portfolio/index.ts`: Module exports
- `src/index.ts`: Main entry point (re-exports all modules)
- `tests/portfolio.test.ts`: Unit tests

## Lessons Learned
1. Trade records have both buyOrderId and sellOrderId - need external context to know which belongs to portfolio
2. Average cost should only be updated on buys, not sells
3. Position should be cleared (not removed from map) when quantity reaches zero
4. Unrealized P&L should ignore zero-quantity positions

## Next Steps
- Issue #4 (Strategy Interface) can now depend on Portfolio
- Strategy will need market prices for P&L calculations
- Consider adding realized P&L tracking over time
