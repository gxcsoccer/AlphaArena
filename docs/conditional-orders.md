# Conditional Orders Feature (Stop-Loss & Take-Profit)

## Overview

This feature implements conditional order types for risk management in trading:
- **Stop-Loss Orders**: Automatically sell when the price drops to a specified level (limits losses)
- **Take-Profit Orders**: Automatically sell when the price rises to a specified level (locks in profits)

## Architecture

### Database Schema

A new `conditional_orders` table stores conditional orders:

```sql
CREATE TABLE conditional_orders (
  id UUID PRIMARY KEY,
  strategy_id UUID REFERENCES strategies(id),
  symbol VARCHAR(50) NOT NULL,
  side VARCHAR(10) NOT NULL, -- 'buy' or 'sell'
  order_type VARCHAR(20) NOT NULL, -- 'stop_loss' or 'take_profit'
  trigger_price DECIMAL(20, 8) NOT NULL,
  quantity DECIMAL(20, 8) NOT NULL,
  status VARCHAR(20) DEFAULT 'active', -- 'active', 'triggered', 'cancelled', 'expired'
  triggered_at TIMESTAMP WITH TIME ZONE,
  triggered_order_id VARCHAR(255),
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### Backend Components

#### 1. ConditionalOrdersDAO (`src/database/conditional-orders.dao.ts`)

Data Access Object for conditional orders with methods:
- `create()` - Create a new conditional order
- `getById()` - Retrieve order by ID
- `getMany()` - Get orders with filters
- `getActive()` - Get all active orders
- `updateStatus()` - Update order status
- `cancel()` - Cancel an order
- `trigger()` - Mark order as triggered
- `getOrdersToTrigger()` - Get orders that should be triggered based on current price
- `getStats()` - Get order statistics

#### 2. PriceMonitoringService (`src/monitoring/PriceMonitoringService.ts`)

Service that monitors market prices and triggers conditional orders:
- Runs every 5 seconds (configurable)
- Watches specified symbols
- Checks if any conditional orders should be triggered
- Automatically creates market orders when conditions are met
- Emits events for notifications

**Trigger Logic:**
- **Stop-Loss**: Triggers when `currentPrice <= triggerPrice`
- **Take-Profit**: Triggers when `currentPrice >= triggerPrice`

#### 3. API Endpoints (`src/api/server.ts`)

New endpoints for conditional orders:

```
POST   /api/conditional-orders          - Create conditional order
GET    /api/conditional-orders          - List conditional orders
POST   /api/conditional-orders/:id/cancel - Cancel conditional order
GET    /api/conditional-orders/stats    - Get statistics
```

### Frontend Components

#### 1. TradingOrder Component (Updated)

Enhanced to support conditional order types:
- New order type options: "止损单" (Stop-Loss) and "止盈单" (Take-Profit)
- Trigger price input for conditional orders
- Validation for trigger prices
- Different submission logic for conditional vs regular orders

#### 2. ConditionalOrdersPanel Component (New)

Displays conditional orders with:
- Order type badges (止损/止盈)
- Status indicators (生效中/已触发/已取消/已过期)
- Cancel functionality for active orders
- Auto-refresh every 10 seconds
- Mobile-responsive design

#### 3. API Client (Updated)

New methods in `src/client/utils/api.ts`:
- `createConditionalOrder()` - Create stop-loss/take-profit order
- `getConditionalOrders()` - List conditional orders
- `cancelConditionalOrder()` - Cancel an order
- `getConditionalOrderStats()` - Get statistics

## Usage

### Creating a Stop-Loss Order

1. Select "止损单" (Stop-Loss) order type
2. Enter trigger price (e.g., $45,000 for BTC/USD)
3. Enter quantity to sell
4. Submit order

The order will automatically trigger and sell when the market price drops to or below the trigger price.

### Creating a Take-Profit Order

1. Select "止盈单" (Take-Profit) order type
2. Enter trigger price (e.g., $55,000 for BTC/USD)
3. Enter quantity to sell
4. Submit order

The order will automatically trigger and sell when the market price rises to or above the trigger price.

### Viewing Conditional Orders

The ConditionalOrdersPanel shows:
- All active conditional orders
- Recently triggered orders
- Cancelled/expired orders
- Real-time status updates

## Testing

### Unit Tests

1. **ConditionalOrdersDAO Tests** (`tests/database/conditional-orders.dao.test.ts`)
   - Create stop-loss/take-profit orders
   - Trigger orders based on price
   - Cancel orders
   - Get statistics

2. **PriceMonitoringService Tests** (`tests/price-monitoring.test.ts`)
   - Start/stop service
   - Watch symbols
   - Event emission
   - Error handling

### Running Tests

```bash
npm test -- conditional-orders
npm test -- price-monitoring
```

## Monitoring & Alerts

When a conditional order is triggered:
1. A market order is automatically created
2. A trade record is stored in the database
3. The conditional order status is updated to "triggered"
4. A notification is broadcast via Supabase Realtime
5. Console logs are generated (⚠️ for stop-loss, ✅ for take-profit)

**Future Enhancements:**
- Feishu notifications for triggered orders
- Email alerts
- SMS notifications for critical stop-loss triggers

## Security & Validation

The implementation includes several validation layers:

1. **Order Type Validation**: Only 'stop_loss' and 'take_profit' are accepted
2. **Side Validation**: Currently only 'sell' side is supported (for protecting long positions)
3. **Price Validation**: Trigger prices must be positive numbers
4. **Status Validation**: Only 'active' orders can be cancelled
5. **Quantity Validation**: Must be greater than 0 and within balance limits

## Performance Considerations

- Price monitoring runs every 5 seconds (balance between responsiveness and API load)
- Database indexes on `symbol`, `status`, and `order_type` for fast queries
- Conditional orders are filtered by symbol to reduce unnecessary checks
- Auto-cleanup of expired orders (not yet implemented, planned)

## Future Enhancements

1. **Buy-side Conditional Orders**: Support stop-loss/take-profit for short positions
2. **Trailing Stop-Loss**: Dynamic trigger price that follows market movements
3. **OCO Orders**: One-Cancels-Other orders (stop-loss and take-profit paired)
4. **Time-based Expiry**: Automatic expiration after specified duration
5. **Partial Triggers**: Trigger partial quantity at multiple price levels
6. **Backtesting**: Test conditional order strategies against historical data

## Migration

To enable this feature in production:

1. Run the database migration:
   ```bash
   npx supabase db push
   ```

2. Deploy the backend with new API endpoints
3. Deploy the frontend with updated components
4. Monitor the PriceMonitoringService logs for proper operation

## Troubleshooting

### Orders Not Triggering

1. Check if PriceMonitoringService is running: `GET /health/status`
2. Verify the symbol is being watched
3. Check logs for price monitoring errors
4. Ensure current price data is available

### API Errors

1. Verify Supabase connection
2. Check database permissions for `conditional_orders` table
3. Review error logs in monitoring service

### Frontend Issues

1. Clear browser cache
2. Check network requests in DevTools
3. Verify API endpoint availability
