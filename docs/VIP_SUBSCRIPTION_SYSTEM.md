# VIP Subscription System

## Overview

The VIP subscription system provides tiered access control and feature management for AlphaArena. It supports three subscription tiers (Free, Pro, Enterprise) with feature gating, usage tracking, and Stripe integration.

## Database Schema

### Tables

#### `subscription_plans`
Stores subscription plan configurations and pricing.

```sql
SELECT * FROM subscription_plans;
```

| plan | name | price_monthly | price_yearly | features | limits |
|------|------|---------------|--------------|----------|--------|
| free | Free | 0 | 0 | Basic features | 1 strategy, 7-day data |
| pro | Pro | 9.99 | 99.99 | Advanced features | 10 strategies, 30-day data |
| enterprise | Enterprise | 49.99 | 499.99 | All features | Unlimited |

#### `user_subscriptions`
Tracks user subscription status and billing information.

```sql
SELECT * FROM user_subscriptions WHERE user_id = 'xxx';
```

#### `subscription_history`
Records all subscription changes for audit purposes.

#### `feature_permissions`
Defines which features require which subscription tier.

#### `feature_usage`
Tracks feature usage for plan limit enforcement.

## API Endpoints

### Public Endpoints

```typescript
// Get all subscription plans
GET /api/subscription/plans

// Get specific plan details
GET /api/subscription/plans/:plan
```

### Authenticated Endpoints

```typescript
// Get current user's subscription
GET /api/subscription/current

// Get subscription history
GET /api/subscription/history

// Cancel subscription
POST /api/subscription/cancel
Body: { immediately: boolean }

// Check feature access
GET /api/subscription/features/:featureKey/check

// Check multiple features
POST /api/subscription/features/check-batch
Body: { features: string[] }

// Check feature limit
GET /api/subscription/features/:featureKey/limit

// Get feature usage
GET /api/subscription/features/:featureKey/usage

// Increment feature usage
POST /api/subscription/features/:featureKey/usage
Body: { increment: number }

// Get all feature usage
GET /api/subscription/usage
```

## Backend Usage

### Using Middleware

```typescript
import { requirePlan, requireFeature, trackFeatureUsage } from './middleware/subscription.middleware';

// Require specific plan
app.get('/api/advanced-charts', 
  requirePlan('pro'), 
  (req, res) => { ... }
);

// Require feature access
app.get('/api/backtesting', 
  requireFeature('backtesting'), 
  (req, res) => { ... }
);

// Track and limit feature usage
app.post('/api/trade', 
  trackFeatureUsage('trades_per_day'), 
  (req, res) => { ... }
);
```

### Using DAO

```typescript
import { SubscriptionDAO } from './database/subscription.dao';

// Get user subscription
const subscription = await SubscriptionDAO.getUserSubscription(userId);

// Check feature access
const hasAccess = await SubscriptionDAO.checkFeatureAccess(userId, 'backtesting');

// Check usage limit
const limit = await SubscriptionDAO.checkFeatureLimit(userId, 'api_calls_per_day');

// Increment usage
const newCount = await SubscriptionDAO.incrementFeatureUsage(userId, 'api_calls_per_day');
```

## Frontend Usage

### Setup Provider

```tsx
import { SubscriptionProvider } from './hooks/useSubscription';

function App() {
  return (
    <SubscriptionProvider>
      <YourApp />
    </SubscriptionProvider>
  );
}
```

### Using Hooks

```tsx
import { useSubscription, usePlan, useFeatureAccess } from './hooks/useSubscription';

function MyComponent() {
  const { plan, isActive, features, limits } = useSubscription();
  const { isPro, isEnterprise, isAtLeast } = usePlan();
  
  // Check single feature
  const { hasAccess, loading } = useFeatureAccess('backtesting');
  
  return (
    <div>
      <p>Your plan: {plan}</p>
      <p>Active: {isActive ? 'Yes' : 'No'}</p>
      {hasAccess && <BacktestPanel />}
    </div>
  );
}
```

### Using FeatureGate Component

```tsx
import { FeatureGate, PlanBadge, FeatureLimit } from './components/FeatureGate';

// Gate by plan
<FeatureGate requiredPlan="pro">
  <AdvancedCharts />
</FeatureGate>

// Gate by feature
<FeatureGate feature="backtesting">
  <BacktestPanel />
</FeatureGate>

// Custom fallback
<FeatureGate 
  requiredPlan="enterprise"
  fallback={<div>Enterprise only</div>}
>
  <EnterpriseFeature />
</FeatureGate>

// Display plan badge
<PlanBadge plan="pro" />

// Show usage limit
<FeatureLimit featureKey="api_calls_per_day" label="API Calls" />
```

## Subscription Tiers

### Free Plan
- Price: $0
- 1 trading strategy
- 7 days historical data
- 1 backtest per day
- 100 API calls per day
- Basic charts
- Community support

### Pro Plan ($9.99/month)
- 10 trading strategies
- 30 days historical data
- 50 backtests per day
- 10,000 API calls per day
- Advanced charts
- Strategy backtesting
- Email support

### Enterprise Plan ($49.99/month)
- Unlimited strategies
- Unlimited historical data
- Unlimited backtests
- Unlimited API calls
- All Pro features
- API access
- Webhooks
- Priority support
- Dedicated account manager

## Feature Categories

### Trading
- `basic_trading` - Basic trading functionality (Free)
- `advanced_orders` - Advanced order types (Pro)
- `conditional_orders` - Conditional order execution (Pro)
- `algorithmic_trading` - Algorithmic trading strategies (Enterprise)

### Data
- `basic_charts` - Basic chart types (Free)
- `advanced_charts` - Advanced charts (Pro)
- `real_time_data` - Real-time data streaming (Pro)
- `historical_data_unlimited` - Unlimited historical data (Enterprise)

### Strategies
- `single_strategy` - Create one strategy (Free)
- `multiple_strategies` - Multiple strategies (Pro)
- `backtesting` - Strategy backtesting (Pro)
- `custom_strategies` - Custom strategies (Enterprise)

### API
- `api_basic` - Basic API access (Pro)
- `api_advanced` - Advanced API access (Enterprise)
- `webhooks` - Webhook notifications (Enterprise)

## Database Functions

```sql
-- Get user's current subscription
SELECT * FROM get_user_subscription('user-uuid');

-- Check feature access
SELECT check_feature_access('user-uuid', 'feature-key');

-- Check feature limit
SELECT * FROM check_feature_limit('user-uuid', 'feature-key');

-- Increment feature usage
SELECT increment_feature_usage('user-uuid', 'feature-key');

-- Cancel subscription
SELECT cancel_subscription('user-uuid', false); -- false = at period end
```

## Testing

Run the test suite:

```bash
npm test -- subscription.dao.test.ts
```

## Migration

Apply the database migration:

```bash
supabase db push
```

Or manually run:

```bash
psql -d your_database -f supabase/migrations/20260327_create_vip_subscription_system.sql
```

## Future Enhancements

1. **Stripe Webhook Integration**: Handle subscription events from Stripe
2. **Trial Period Management**: Free trial with automatic conversion
3. **Promotional Codes**: Support for discounts and special offers
4. **Referral Program**: Bonus subscription time for referrals
5. **Usage Analytics Dashboard**: Visualize feature usage patterns
6. **Grace Period**: Soft limits with warning before hard cutoff