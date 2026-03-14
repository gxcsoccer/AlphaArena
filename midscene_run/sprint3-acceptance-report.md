# Sprint 3 UI Acceptance Test Report

**Generated:** 2026-03-13T21:28:23.150Z

## Summary

| Status | Count |
|--------|-------|
| ✅ PASS | 9 |
| ❌ FAIL | 0 |
| ⚠️ WARN | 5 |
| **Total** | **14** |

## Test Results

### 1. Production - Page Load

- **Status:** ✅ PASS
- **URL:** https://alphaarena-edqxuuu5x-gxcsoccer-s-team.vercel.app
- **Details:** Page loaded successfully. Root content length: 17897 chars
- **Screenshot:** `sprint3-prod-home-page.png`

### 2. Production - OrderBook Component

- **Status:** ✅ PASS
- **URL:** https://alphaarena-edqxuuu5x-gxcsoccer-s-team.vercel.app
- **Details:** Found 20 order book related elements. Order book text present: true


### 3. Production - Bid/Ask Data

- **Status:** ⚠️ WARN
- **URL:** https://alphaarena-edqxuuu5x-gxcsoccer-s-team.vercel.app
- **Details:** Only 3 price data points found


### 4. Production - Real-time Updates

- **Status:** ⚠️ WARN
- **URL:** https://alphaarena-edqxuuu5x-gxcsoccer-s-team.vercel.app
- **Details:** No visible content changes during 15s observation (may need trading activity)


### 5. Production - Price Click to Fill

- **Status:** ⚠️ WARN
- **URL:** https://alphaarena-edqxuuu5x-gxcsoccer-s-team.vercel.app
- **Details:** No clickable price elements found


### 6. Production - Page Layout

- **Status:** ✅ PASS
- **URL:** https://alphaarena-edqxuuu5x-gxcsoccer-s-team.vercel.app
- **Details:** Layout OK: 1 root children, Arco Design present, Grid present: true


### 7. Preview - Page Load

- **Status:** ✅ PASS
- **URL:** https://alphaarena-9b6soez6b-gxcsoccer-s-team.vercel.app
- **Details:** Page loaded successfully. Root content length: 1218 chars
- **Screenshot:** `sprint3-preview-home-page.png`

### 8. Preview - OrderBook Component

- **Status:** ⚠️ WARN
- **URL:** https://alphaarena-9b6soez6b-gxcsoccer-s-team.vercel.app
- **Details:** Only 0 order book elements found


### 9. Preview - Real-time Updates

- **Status:** ⚠️ WARN
- **URL:** https://alphaarena-9b6soez6b-gxcsoccer-s-team.vercel.app
- **Details:** No visible content changes during 15s observation


### 10. Production - Dashboard Page

- **Status:** ✅ PASS
- **URL:** https://alphaarena-edqxuuu5x-gxcsoccer-s-team.vercel.app/dashboard
- **Details:** Page loaded successfully
- **Screenshot:** `sprint3-prod-dashboard-page.png`

### 11. Production - Strategies Page

- **Status:** ✅ PASS
- **URL:** https://alphaarena-edqxuuu5x-gxcsoccer-s-team.vercel.app/strategies
- **Details:** Page loaded successfully
- **Screenshot:** `sprint3-prod-strategies-page.png`

### 12. Production - Trades Page

- **Status:** ✅ PASS
- **URL:** https://alphaarena-edqxuuu5x-gxcsoccer-s-team.vercel.app/trades
- **Details:** Page loaded successfully
- **Screenshot:** `sprint3-prod-trades-page.png`

### 13. Production - Holdings Page

- **Status:** ✅ PASS
- **URL:** https://alphaarena-edqxuuu5x-gxcsoccer-s-team.vercel.app/holdings
- **Details:** Page loaded successfully
- **Screenshot:** `sprint3-prod-holdings-page.png`

### 14. Production - Leaderboard Page

- **Status:** ✅ PASS
- **URL:** https://alphaarena-edqxuuu5x-gxcsoccer-s-team.vercel.app/leaderboard
- **Details:** Page loaded successfully
- **Screenshot:** `sprint3-prod-leaderboard-page.png`


## Console Errors

- [ERROR] WebSocket connection to 'wss://plnylmnckssnfpwznpwf.supabase.co/realtime/v1/websocket?apikey=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsbnl5bG1uY2tzc25mcHd6bnB3ZiIsInJvbGUiOiJhbm9uIiwiaWF0IjoxNzQxNzQ4ODQ1LCJleHAiOjIwNTczMjQ4NDV9.dGZmQz8F5xKqPvqJQqJzKqJzKqJzKqJzKqJzKqJzKqJ&eventsPerSecond=10&vsn=2.0.0' failed: HTTP Authentication failed; no valid credentials available
- [ERROR] [Realtime] Subscription error for orderbook:BTC/USD: CHANNEL_ERROR
- [ERROR] [useOrderBook] Failed to subscribe to orderbook:BTC/USD Error: Subscription failed: CHANNEL_ERROR
- [ERROR] [Realtime] Subscription error for orderbook:BTC/USD: CHANNEL_ERROR
- [ERROR] Failed to load resource: the server responded with a status of 401 ()
- [ERROR] Failed to load resource: the server responded with a status of 401 ()
- [ERROR] Failed to load resource: the server responded with a status of 401 ()
- [ERROR] Failed to load resource: the server responded with a status of 401 ()
- [ERROR] Failed to load resource: the server responded with a status of 401 ()
- [ERROR] WebSocket connection to 'wss://plnylmnckssnfpwznpwf.supabase.co/realtime/v1/websocket?apikey=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsbnl5bG1uY2tzc25mcHd6bnB3ZiIsInJvbGUiOiJhbm9uIiwiaWF0IjoxNzQxNzQ4ODQ1LCJleHAiOjIwNTczMjQ4NDV9.dGZmQz8F5xKqPvqJQqJzKqJzKqJzKqJzKqJzKqJzKqJ&eventsPerSecond=10&vsn=2.0.0' failed: HTTP Authentication failed; no valid credentials available
- [ERROR] [Realtime] Subscription error for orderbook:BTC/USD: CHANNEL_ERROR
- [ERROR] [Realtime] Subscription error for orderbook:BTC/USD: CHANNEL_ERROR
- [ERROR] WebSocket connection to 'wss://plnylmnckssnfpwznpwf.supabase.co/realtime/v1/websocket?apikey=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsbnl5bG1uY2tzc25mcHd6bnB3ZiIsInJvbGUiOiJhbm9uIiwiaWF0IjoxNzQxNzQ4ODQ1LCJleHAiOjIwNTczMjQ4NDV9.dGZmQz8F5xKqPvqJQqJzKqJzKqJzKqJzKqJzKqJzKqJ&eventsPerSecond=10&vsn=2.0.0' failed: HTTP Authentication failed; no valid credentials available
- [ERROR] [Realtime] Subscription error for orderbook:BTC/USD: CHANNEL_ERROR
- [ERROR] [Realtime] Subscription error for orderbook:BTC/USD: CHANNEL_ERROR
- [ERROR] Failed to load resource: the server responded with a status of 401 ()
- [ERROR] WebSocket connection to 'wss://plnylmnckssnfpwznpwf.supabase.co/realtime/v1/websocket?apikey=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsbnl5bG1uY2tzc25mcHd6bnB3ZiIsInJvbGUiOiJhbm9uIiwiaWF0IjoxNzQxNzQ4ODQ1LCJleHAiOjIwNTczMjQ4NDV9.dGZmQz8F5xKqPvqJQqJzKqJzKqJzKqJzKqJzKqJzKqJ&eventsPerSecond=10&vsn=2.0.0' failed: HTTP Authentication failed; no valid credentials available
- [ERROR] [Realtime] Subscription error for orderbook:BTC/USD: CHANNEL_ERROR
- [ERROR] [Realtime] Subscription error for orderbook:BTC/USD: CHANNEL_ERROR
- [ERROR] WebSocket connection to 'wss://plnylmnckssnfpwznpwf.supabase.co/realtime/v1/websocket?apikey=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsbnl5bG1uY2tzc25mcHd6bnB3ZiIsInJvbGUiOiJhbm9uIiwiaWF0IjoxNzQxNzQ4ODQ1LCJleHAiOjIwNTczMjQ4NDV9.dGZmQz8F5xKqPvqJQqJzKqJzKqJzKqJzKqJzKqJzKqJ&eventsPerSecond=10&vsn=2.0.0' failed: HTTP Authentication failed; no valid credentials available
- [ERROR] [Realtime] Subscription error for orderbook:BTC/USD: CHANNEL_ERROR
- [ERROR] [Realtime] Subscription error for orderbook:BTC/USD: CHANNEL_ERROR
- [ERROR] WebSocket connection to 'wss://plnylmnckssnfpwznpwf.supabase.co/realtime/v1/websocket?apikey=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsbnl5bG1uY2tzc25mcHd6bnB3ZiIsInJvbGUiOiJhbm9uIiwiaWF0IjoxNzQxNzQ4ODQ1LCJleHAiOjIwNTczMjQ4NDV9.dGZmQz8F5xKqPvqJQqJzKqJzKqJzKqJzKqJzKqJzKqJ&eventsPerSecond=10&vsn=2.0.0' failed: HTTP Authentication failed; no valid credentials available
- [ERROR] [Realtime] Subscription error for orderbook:BTC/USD: CHANNEL_ERROR
- [ERROR] [Realtime] Subscription error for orderbook:BTC/USD: CHANNEL_ERROR
- [ERROR] Failed to load resource: the server responded with a status of 401 ()
- [ERROR] WebSocket connection to 'wss://plnylmnckssnfpwznpwf.supabase.co/realtime/v1/websocket?apikey=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsbnl5bG1uY2tzc25mcHd6bnB3ZiIsInJvbGUiOiJhbm9uIiwiaWF0IjoxNzQxNzQ4ODQ1LCJleHAiOjIwNTczMjQ4NDV9.dGZmQz8F5xKqPvqJQqJzKqJzKqJzKqJzKqJzKqJzKqJ&eventsPerSecond=10&vsn=2.0.0' failed: HTTP Authentication failed; no valid credentials available
- [ERROR] [Realtime] Subscription error for orderbook:BTC/USD: CHANNEL_ERROR
- [ERROR] [Realtime] Subscription error for orderbook:BTC/USD: CHANNEL_ERROR
- [ERROR] WebSocket connection to 'wss://plnylmnckssnfpwznpwf.supabase.co/realtime/v1/websocket?apikey=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsbnl5bG1uY2tzc25mcHd6bnB3ZiIsInJvbGUiOiJhbm9uIiwiaWF0IjoxNzQxNzQ4ODQ1LCJleHAiOjIwNTczMjQ4NDV9.dGZmQz8F5xKqPvqJQqJzKqJzKqJzKqJzKqJzKqJzKqJ&eventsPerSecond=10&vsn=2.0.0' failed: HTTP Authentication failed; no valid credentials available
- [ERROR] [Realtime] Subscription error for orderbook:BTC/USD: CHANNEL_ERROR
- [ERROR] [Realtime] Subscription error for orderbook:BTC/USD: CHANNEL_ERROR
- [ERROR] Failed to load resource: the server responded with a status of 401 ()
- [ERROR] [Realtime] Subscription error for orderbook:BTC/USD: TIMED_OUT
- [ERROR] WebSocket connection to 'wss://plnylmnckssnfpwznpwf.supabase.co/realtime/v1/websocket?apikey=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsbnl5bG1uY2tzc25mcHd6bnB3ZiIsInJvbGUiOiJhbm9uIiwiaWF0IjoxNzQxNzQ4ODQ1LCJleHAiOjIwNTczMjQ4NDV9.dGZmQz8F5xKqPvqJQqJzKqJzKqJzKqJzKqJzKqJzKqJ&eventsPerSecond=10&vsn=2.0.0' failed: HTTP Authentication failed; no valid credentials available
- [ERROR] [Realtime] Subscription error for orderbook:BTC/USD: CHANNEL_ERROR
- [ERROR] [Realtime] Subscription error for orderbook:BTC/USD: CHANNEL_ERROR
- [ERROR] WebSocket connection to 'wss://plnylmnckssnfpwznpwf.supabase.co/realtime/v1/websocket?apikey=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsbnl5bG1uY2tzc25mcHd6bnB3ZiIsInJvbGUiOiJhbm9uIiwiaWF0IjoxNzQxNzQ4ODQ1LCJleHAiOjIwNTczMjQ4NDV9.dGZmQz8F5xKqPvqJQqJzKqJzKqJzKqJzKqJzKqJzKqJ&eventsPerSecond=10&vsn=2.0.0' failed: HTTP Authentication failed; no valid credentials available
- [ERROR] [Realtime] Subscription error for orderbook:BTC/USD: CHANNEL_ERROR
- [ERROR] [Realtime] Subscription error for orderbook:BTC/USD: CHANNEL_ERROR
- [ERROR] Failed to load resource: the server responded with a status of 401 ()
- [ERROR] WebSocket connection to 'wss://plnylmnckssnfpwznpwf.supabase.co/realtime/v1/websocket?apikey=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsbnl5bG1uY2tzc25mcHd6bnB3ZiIsInJvbGUiOiJhbm9uIiwiaWF0IjoxNzQxNzQ4ODQ1LCJleHAiOjIwNTczMjQ4NDV9.dGZmQz8F5xKqPvqJQqJzKqJzKqJzKqJzKqJzKqJzKqJ&eventsPerSecond=10&vsn=2.0.0' failed: HTTP Authentication failed; no valid credentials available
- [ERROR] [Realtime] Subscription error for orderbook:BTC/USD: CHANNEL_ERROR
- [ERROR] [Realtime] Subscription error for orderbook:BTC/USD: CHANNEL_ERROR
- [ERROR] Failed to load resource: the server responded with a status of 401 ()
- [ERROR] WebSocket connection to 'wss://plnylmnckssnfpwznpwf.supabase.co/realtime/v1/websocket?apikey=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsbnl5bG1uY2tzc25mcHd6bnB3ZiIsInJvbGUiOiJhbm9uIiwiaWF0IjoxNzQxNzQ4ODQ1LCJleHAiOjIwNTczMjQ4NDV9.dGZmQz8F5xKqPvqJQqJzKqJzKqJzKqJzKqJzKqJzKqJ&eventsPerSecond=10&vsn=2.0.0' failed: HTTP Authentication failed; no valid credentials available
- [ERROR] [Realtime] Subscription error for orderbook:BTC/USD: CHANNEL_ERROR
- [ERROR] [Realtime] Subscription error for orderbook:BTC/USD: CHANNEL_ERROR
- [ERROR] Failed to load resource: the server responded with a status of 401 ()
- [ERROR] Failed to load resource: the server responded with a status of 401 ()
- [ERROR] WebSocket connection to 'wss://plnylmnckssnfpwznpwf.supabase.co/realtime/v1/websocket?apikey=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsbnl5bG1uY2tzc25mcHd6bnB3ZiIsInJvbGUiOiJhbm9uIiwiaWF0IjoxNzQxNzQ4ODQ1LCJleHAiOjIwNTczMjQ4NDV9.dGZmQz8F5xKqPvqJQqJzKqJzKqJzKqJzKqJzKqJzKqJ&eventsPerSecond=10&vsn=2.0.0' failed: HTTP Authentication failed; no valid credentials available
- [ERROR] [Realtime] Subscription error for orderbook:BTC/USD: CHANNEL_ERROR
- [ERROR] [Realtime] Subscription error for orderbook:BTC/USD: CHANNEL_ERROR
- [ERROR] Failed to load resource: the server responded with a status of 401 ()
- [ERROR] Error: supabaseKey is required.
- [ERROR] [ErrorBoundary] Caught error: Error: supabaseKey is required. [object Object]
- [ERROR] Error: supabaseKey is required.
- [ERROR] [ErrorBoundary] Caught error: Error: supabaseKey is required. [object Object]
- [ERROR] Error: supabaseKey is required.
- [ERROR] [ErrorBoundary] Caught error: Error: supabaseKey is required. [object Object]
- [ERROR] Failed to load resource: the server responded with a status of 401 ()
- [ERROR] Failed to load resource: the server responded with a status of 401 ()
- [ERROR] Failed to load resource: the server responded with a status of 401 ()
- [ERROR] Failed to load resource: the server responded with a status of 401 ()
- [ERROR] Failed to load resource: the server responded with a status of 401 ()
- [ERROR] Failed to load resource: the server responded with a status of 401 ()
- [ERROR] Failed to load resource: the server responded with a status of 401 ()
- [ERROR] Failed to load resource: the server responded with a status of 401 ()
- [ERROR] Failed to load resource: the server responded with a status of 401 ()
- [ERROR] TypeError: i.off is not a function
- [ERROR] [ErrorBoundary] Caught error: TypeError: i.off is not a function [object Object]
- [ERROR] TypeError: i.off is not a function
- [ERROR] [ErrorBoundary] Caught error: TypeError: i.off is not a function [object Object]
- [ERROR] Failed to load resource: the server responded with a status of 401 ()
- [ERROR] Failed to load resource: the server responded with a status of 401 ()
- [ERROR] Failed to load resource: the server responded with a status of 401 ()
- [ERROR] TypeError: i.off is not a function
- [ERROR] [ErrorBoundary] Caught error: TypeError: i.off is not a function [object Object]
- [ERROR] TypeError: i.off is not a function
- [ERROR] [ErrorBoundary] Caught error: TypeError: i.off is not a function [object Object]
- [ERROR] TypeError: i.off is not a function
- [ERROR] [ErrorBoundary] Caught error: TypeError: i.off is not a function [object Object]
- [ERROR] TypeError: i.off is not a function
- [ERROR] [ErrorBoundary] Caught error: TypeError: i.off is not a function [object Object]
- [ERROR] Failed to load resource: the server responded with a status of 401 ()
- [ERROR] Failed to load resource: the server responded with a status of 401 ()
- [ERROR] Failed to load resource: the server responded with a status of 401 ()

## Screenshots

Screenshots saved to: `./midscene_run/`

- sprint3-prod-home-page.png
- sprint3-preview-home-page.png
- sprint3-prod-dashboard-page.png
- sprint3-prod-strategies-page.png
- sprint3-prod-trades-page.png
- sprint3-prod-holdings-page.png
- sprint3-prod-leaderboard-page.png
