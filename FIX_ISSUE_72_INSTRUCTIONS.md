# Fix for Issue #72: Supabase WebSocket Authentication Failing

## Root Cause Analysis

The Supabase Realtime authentication is failing in production because:

1. **Invalid API Key**: The `VITE_SUPABASE_ANON_KEY` in `vercel.json` and `.env.production` contains a **fake/truncated JWT token** with an invalid signature pattern
2. **Hardcoded Credentials**: Environment variables were hardcoded in `vercel.json` instead of being configured in Vercel Dashboard
3. **Missing Realtime Permissions**: The Supabase project may not have proper Realtime publication permissions configured

## Solution

### Step 1: Get the Correct Supabase Anon Key

1. Log in to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select the AlphaArena project (`plnylmnckssnfpwznpwf`)
3. Go to **Settings** → **API**
4. Under **Project API keys**, copy the `anon` `public` key
   - It should look like: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsbnl5bG1uY2tzc25mcHd6bnB3ZiIsInJvbGUiOiJhbm9uIiwiaWF0IjoxNzQxNzQ4ODQ1LCJleHAiOjIwNTczMjQ4NDV9.[valid_signature]`
   - The signature part should be a long random string, NOT a repeating pattern

### Step 2: Configure Vercel Environment Variables

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Select the AlphaArena project
3. Go to **Settings** → **Environment Variables**
4. Add/Update the following variables for **Production** environment:

| Variable Name | Value |
|--------------|-------|
| `VITE_SUPABASE_URL` | `https://plnylmnckssnfpwznpwf.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | [Paste the actual key from Step 1] |
| `VITE_API_URL` | `https://plnylmnckssnfpwznpwf.supabase.co/functions/v1` |

5. Click **Save**

### Step 3: Configure Supabase Realtime Permissions

1. In Supabase Dashboard, go to **Database** → **Replication**
2. Ensure **Realtime** is enabled (toggle should be ON)
3. Go to **Database** → **Replication** → **Publications**
4. Click on `supabase_realtime` publication
5. Add tables that need Realtime access (or create a custom publication)
6. For broadcast channels (which don't require tables), ensure RLS policies allow anonymous access:

```sql
-- Check current publications
SELECT * FROM pg_publication;

-- If needed, create a publication for Realtime broadcast
-- Note: Broadcast channels don't require table subscriptions
```

### Step 4: Redeploy to Vercel

After updating environment variables, trigger a new deployment:

```bash
# Option 1: Deploy via CLI
vercel --prod

# Option 2: Trigger deployment from Vercel Dashboard
# Go to Deployments → Click "Redeploy" on the latest deployment
```

**Important**: Environment variables in Vercel are baked into the build at build time. A redeploy is **required** for changes to take effect.

### Step 5: Verify the Fix

1. Open the production URL in a browser
2. Open Developer Tools (F12) → Console
3. Look for these success indicators:
   - ✅ `[Realtime] Connection initialized`
   - ✅ `[Realtime] Subscribed to orderbook:BTC/USDT` (or other symbols)
   - ✅ `Subscription status: SUBSCRIBED`
4. Verify NO error messages:
   - ❌ `HTTP Authentication failed; no valid credentials available`
   - ❌ `supabaseKey is required`
5. Check that real-time data updates are working:
   - OrderBook should show live updates
   - Market ticker should refresh automatically

## Changes Made in This PR

### Files Modified

1. **`vercel.json`**: 
   - Removed hardcoded environment variables (security risk)
   - Environment variables should be configured in Vercel Dashboard instead
   
2. **`.env.production`**:
   - Added comments explaining that values should come from Vercel Dashboard
   - Replaced fake key with placeholder text

### Why This Approach?

- **Security**: API keys should never be committed to git, even in config files
- **Flexibility**: Different environments (preview vs production) can have different keys
- **Best Practice**: Follows Vercel's recommended approach for environment variables

## Troubleshooting

### If Authentication Still Fails

1. **Verify the key is correct**:
   ```bash
   # Test the key manually
   curl -H "apikey: YOUR_ANON_KEY" \
        -H "Authorization: Bearer YOUR_ANON_KEY" \
        https://plnylmnckssnfpwznpwf.supabase.co/rest/v1/
   ```
   - Should return `{"message":"Partial response"}` with status 200
   - If 401/403, the key is invalid or doesn't have proper permissions

2. **Check Realtime status**:
   - In Supabase Dashboard → Database → Replication
   - Verify Realtime is enabled
   - Check logs for connection errors

3. **Test Realtime connection**:
   ```javascript
   // In browser console
   const supabase = createClient(
     'https://plnylmnckssnfpwznpwf.supabase.co',
     'YOUR_ANON_KEY'
   );
   const channel = supabase.channel('test-channel');
   channel.subscribe(status => console.log('Status:', status));
   ```

### If Realtime Data Doesn't Update

1. Check that backend is broadcasting:
   ```bash
   supabase functions logs broadcast-market-data --tail
   ```

2. Verify channel names match between frontend and backend:
   - Frontend: `orderbook:BTC/USDT`
   - Backend: `orderbook:BTC/USDT`
   - Must be exact match (case-sensitive)

3. Check for CORS issues in browser Console

## References

- [Supabase Realtime Documentation](https://supabase.com/docs/guides/realtime)
- [Vercel Environment Variables](https://vercel.com/docs/concepts/projects/environment-variables)
- [Supabase Broadcast Feature](https://supabase.com/docs/guides/realtime/broadcast)
