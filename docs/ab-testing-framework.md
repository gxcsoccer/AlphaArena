# A/B Testing Framework

## Overview

This framework provides a comprehensive A/B testing infrastructure for the AlphaArena platform, specifically designed for the referral system experiments.

## Architecture

### Components

1. **Database Layer** (`supabase/migrations/20260401_create_ab_testing_tables.sql`)
   - `experiments` - Store experiment configurations
   - `experiment_variants` - Store variants for each experiment
   - `experiment_assignments` - Track user assignments to variants
   - `experiment_events` - Track all experiment-related events

2. **Data Access Layer** (`src/database/experiment.dao.ts`)
   - CRUD operations for experiments and variants
   - User assignment management
   - Event tracking
   - Statistics calculation

3. **Service Layer** (`src/services/experiment/ExperimentService.ts`)
   - High-level API for experiment management
   - User assignment logic
   - Conversion tracking
   - Helper methods for common use cases

4. **API Layer** (`src/api/experimentRoutes.ts`)
   - REST endpoints for experiment management
   - Public endpoints for client-side participation
   - Admin endpoints for experiment control

## Quick Start

### 1. Create an Experiment

```typescript
import { getExperimentService } from './services/experiment';

const experimentService = getExperimentService();

// Create a referral reward experiment
const result = await experimentService.createExperiment({
  name: 'referral_reward_test',
  description: 'Test different referral reward amounts',
  experimentType: 'referral',
  trafficAllocation: 100,
  variants: [
    {
      name: 'control',
      description: 'Current reward structure',
      config: {
        invitee_bonus_days: 7,
        referrer_bonus_days: 30,
      },
      trafficPercentage: 50,
      isControl: true,
    },
    {
      name: 'treatment',
      description: 'Higher rewards',
      config: {
        invitee_bonus_days: 14,
        referrer_bonus_days: 60,
      },
      trafficPercentage: 50,
      isControl: false,
    },
  ],
});

// Start the experiment
await experimentService.startExperiment(result.experiment.id);
```

### 2. Get Variant for User

```typescript
// Get the variant configuration for a user
const config = await experimentService.getVariantConfig(
  'referral_reward_test',
  userId
);

if (config) {
  const inviteeBonusDays = config.invitee_bonus_days as number;
  const referrerBonusDays = config.referrer_bonus_days as number;
  // Apply the configuration...
}
```

### 3. Track Conversions

```typescript
// Track a conversion event
await experimentService.trackConversion({
  experimentName: 'referral_reward_test',
  userId: userId,
  eventName: 'referral_activated',
  eventData: {
    inviteeUserId: inviteeUserId,
    rewardAmount: 30,
  },
});
```

### 4. View Results

```typescript
// Get experiment results with statistics
const results = await experimentService.getExperimentResults(experimentId);

console.log('Total participants:', results.statistics.totalParticipants);
console.log('Total conversions:', results.statistics.totalConversions);
console.log('Winning variant:', results.statistics.winningVariantId);

// Check significance
results.statistics.comparisons.forEach(comparison => {
  console.log(`Variant ${comparison.variant_name}:`);
  console.log(`  Lift: ${comparison.lift}%`);
  console.log(`  Significant: ${comparison.is_significant}`);
  console.log(`  p-value: ${comparison.p_value}`);
});
```

## API Endpoints

### Public Endpoints (Client-Side)

#### GET `/api/experiments/variant/:experimentName`
Get the variant for the current user in an experiment.

**Response:**
```json
{
  "success": true,
  "data": {
    "inExperiment": true,
    "variant": {
      "name": "treatment",
      "config": {
        "invitee_bonus_days": 14,
        "referrer_bonus_days": 60
      },
      "isControl": false
    },
    "isNewAssignment": true
  }
}
```

#### POST `/api/experiments/convert/:experimentName`
Track a conversion event.

**Request Body:**
```json
{
  "eventName": "referral_activated",
  "eventData": {
    "inviteeUserId": "user-123"
  },
  "conversionValue": 30
}
```

#### GET `/api/experiments/active`
Get all active experiments for the current user.

### Admin Endpoints

#### POST `/api/experiments/admin`
Create a new experiment.

#### GET `/api/experiments/admin`
List all experiments.

#### GET `/api/experiments/admin/:experimentId`
Get experiment details with statistics.

#### POST `/api/experiments/admin/:experimentId/start`
Start an experiment.

#### POST `/api/experiments/admin/:experimentId/pause`
Pause an experiment.

#### POST `/api/experiments/admin/:experimentId/complete`
Complete an experiment with optional winning variant.

## Statistical Analysis

The framework uses a Z-test for comparing proportions to determine statistical significance.

### Key Metrics

- **Participants**: Number of users assigned to each variant
- **Conversions**: Number of users who completed the desired action
- **Conversion Rate**: Conversions / Participants
- **Lift**: Percentage improvement over control
- **Z-score**: Statistical measure of difference
- **p-value**: Probability that results are due to chance

### Significance Calculation

```typescript
// Automatically calculated when you call getExperimentResults()
const results = await experimentService.getExperimentResults(experimentId);

// Check if results are significant
results.statistics.comparisons.forEach(comp => {
  if (comp.is_significant) {
    console.log(`${comp.variant_name} shows significant improvement!`);
    console.log(`Lift: ${comp.lift}%`);
  }
});
```

## Integration Examples

### With Referral System

```typescript
// In your referral service
async function processReferral(inviteToken: string, inviteeUserId: string) {
  // Get experiment variant for referrer
  const rewardConfig = await getRewardConfigForUser(referrerUserId);
  
  // Use variant config to determine rewards
  const inviteeBonusDays = rewardConfig.inviteeBonusDays;
  const referrerBonusDays = rewardConfig.referrerBonusDays;
  
  // Process referral with these amounts...
  
  // Track conversion
  await trackReferralConversion(referrerUserId, 'referral_registered');
}
```

### With UI Components

```typescript
// In your React component
const InviteCodePage = () => {
  const [config, setConfig] = useState({});
  
  useEffect(() => {
    // Get UI experiment variant
    fetch('/api/experiments/variant/invite_code_style_test')
      .then(res => res.json())
      .then(data => {
        if (data.success && data.data.variant) {
          setConfig(data.data.variant.config);
        }
      });
  }, []);
  
  return (
    <div>
      {config.showQRCode && <QRCode value={referralLink} />}
      {config.showSocialShare && <SocialShareButtons />}
    </div>
  );
};
```

## Best Practices

### 1. Define Clear Hypotheses

Before creating an experiment, define:
- What you're testing
- What metric you're optimizing
- What success looks like

### 2. Use Control Groups

Always have a control variant to compare against. This ensures you can measure the actual impact of changes.

### 3. Set Appropriate Sample Sizes

Use the `minimumSampleSize` parameter to ensure you have enough data before drawing conclusions:
- Small changes: 1,000+ participants per variant
- Medium changes: 500+ participants per variant
- Large changes: 100+ participants per variant

### 4. Monitor Results Regularly

Check experiment results regularly but avoid stopping experiments early unless results are overwhelming.

### 5. Document Findings

Keep track of what you learn from each experiment:
- What worked?
- What didn't?
- Why do you think that is?

## Database Schema

### experiments
| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| name | VARCHAR(100) | Unique experiment name |
| description | TEXT | Experiment description |
| experiment_type | VARCHAR(50) | Type: referral, ui, feature, etc. |
| status | VARCHAR(20) | draft, running, paused, completed, archived |
| traffic_allocation | DECIMAL(5,2) | Percentage of users to include |
| significance_level | DECIMAL(3,2) | p-value threshold (default: 0.05) |
| minimum_sample_size | INTEGER | Minimum participants before analysis |

### experiment_variants
| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| experiment_id | UUID | Foreign key to experiments |
| name | VARCHAR(100) | Variant name (control, treatment, etc.) |
| config | JSONB | Variant configuration |
| traffic_percentage | DECIMAL(5,2) | Percentage of experiment traffic |
| is_control | BOOLEAN | Whether this is the control variant |
| participants | INTEGER | Number of users assigned |
| conversions | INTEGER | Number of conversions |

### experiment_assignments
| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| experiment_id | UUID | Foreign key to experiments |
| variant_id | UUID | Foreign key to variants |
| user_id | UUID | User assigned to variant |
| converted | BOOLEAN | Whether user converted |
| converted_at | TIMESTAMPTZ | When conversion occurred |

## Migration

To apply the database migration:

```bash
# Using Supabase CLI
supabase db push

# Or apply manually in Supabase dashboard
# Copy the SQL from supabase/migrations/20260401_create_ab_testing_tables.sql
```

## Testing

Run the test suite:

```bash
npm test -- src/database/__tests__/experiment.dao.test.ts
npm test -- src/services/experiment/__tests__/ExperimentService.test.ts
```

## Future Enhancements

1. **Admin Dashboard UI**: Visual interface for managing experiments
2. **Real-time Analytics**: Live experiment metrics
3. **Multi-armed Bandit**: Automatic traffic allocation optimization
4. **Segmentation**: Target specific user segments
5. **A/A Testing**: Validate experiment infrastructure