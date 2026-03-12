# WebSocket Migration Plan: Socket.IO → Supabase Realtime

**Issue:** #49  
**Status:** Phase 1 - Preparation  
**Started:** 2026-03-12  
**Estimated Completion:** 2026-04-05 (3-4 weeks)

---

## Overview

Migrate real-time WebSocket infrastructure from Socket.IO (hosted on Railway) to Supabase Realtime.

**Goals:**
- Eliminate Railway dependency for WebSocket
- Unified platform (Supabase for DB + Realtime)
- Maintain existing functionality: orderbook, ticker, trade updates
- Achieve < 50ms latency (p95)
- Support > 500 concurrent connections

---

## Phase 1: Preparation (2026-03-12 → 2026-03-14)

### ✅ Completed Tasks

1. **Supabase Configuration Verified**
   - Project URL: `https://plnylmnckssnfpwznpwf.supabase.co`
   - Realtime endpoint: `wss://plnylmnckssnfpwznpwf.supabase.co/realtime/v1`
   - SDK installed: `@supabase/supabase-js@2.99.0`
   - ✓ Realtime connection test passed (channel subscription + broadcast send)

2. **Current Socket.IO Inventory**

   **Server-side (src/api/server.ts):**
   - Rooms: `strategy:${id}`, `symbol:${symbol}`, `orderbook:${symbol}`, `market:tickers`
   - Events emitted:
     - `trade:new` - Trade executions
     - `portfolio:update` - Portfolio changes
     - `strategy:tick` - Strategy updates
     - `leaderboard:update` - Leaderboard changes
     - `orderbook:snapshot` - Full orderbook snapshot
     - `orderbook:delta` - Orderbook incremental updates
     - `market:tick` - Market ticker updates

   **Client-side (src/client/utils/api.ts, src/client/hooks/useMarketData.ts):**
   - WebSocketClient class with Socket.IO
   - Hooks: useMarketData, useKLineData, useData
   - Subscriptions: market, orderbook, strategy

3. **Realtime Channels Design**

   | Channel | Topic Pattern | Purpose | Data Type |
   |---------|--------------|---------|-----------|
   | orderbook | `orderbook:${symbol}` | Order book updates | Broadcast |
   | ticker | `ticker:${symbol}` | Market ticker | Broadcast |
   | trade | `trade:${userId}` | User trade notifications | Broadcast |
   | presence | `presence:traders` | Online trader presence | Presence |

   **Broadcast Events:**
   ```typescript
   // Orderbook
   channel.send({
     type: 'broadcast',
     event: 'snapshot', // or 'delta'
     payload: { bids, asks, timestamp }
   })

   // Ticker
   channel.send({
     type: 'broadcast',
     event: 'tick',
     payload: { symbol, price, change24h, ... }
   })

   // Trades
   channel.send({
     type: 'broadcast',
     event: 'new',
     payload: { tradeId, symbol, side, price, quantity }
   })
   ```

4. **Test Script Created**
   - Location: `scripts/test-realtime.ts`
   - Tests: Broadcast send, channel subscription, presence tracking
   - Result: ✓ Connection successful, broadcast send working

### 📋 Remaining Tasks

- [x] Create Supabase Realtime test script
- [x] Verify Realtime is enabled in Supabase project
- [ ] Document API changes needed
- [x] Create feature branch: `feature/49-supabase-realtime-migration`

---

## Phase 2: Backend Transformation (2026-03-15 → 2026-03-19)

**Tasks:**
- [ ] Remove Socket.IO server dependencies
- [ ] Create Supabase Realtime service class
- [ ] Implement Broadcast for orderbook/ticker/trade events
- [ ] Update APIServer to use Realtime channels
- [ ] Update environment variables

**Files to modify:**
- `src/api/server.ts` - Replace Socket.IO with Realtime
- `package.json` - Remove socket.io, keep socket.io-client for fallback
- `.env.example` - Add Realtime URL

---

## Phase 3: Frontend Transformation (2026-03-20 → 2026-03-25)

**Tasks:**
- [ ] Create Supabase Realtime client wrapper
- [ ] Update WebSocketClient class
- [ ] Update hooks: useMarketData, useKLineData, useData
- [ ] Test subscriptions and message handling
- [ ] Update Presence for online traders

**Files to modify:**
- `src/client/utils/api.ts` - WebSocketClient → RealtimeClient
- `src/client/hooks/useMarketData.ts`
- `src/client/hooks/useKLineData.ts`
- `src/client/hooks/useData.ts`

---

## Phase 4: Testing & Validation (2026-03-26 → 2026-03-30)

**Tasks:**
- [ ] Unit tests for Realtime service
- [ ] Integration tests (client ↔ server)
- [ ] Performance tests (latency, concurrent connections)
- [ ] Staging deployment
- [ ] Canary/gradual rollout

---

## Phase 5: Production Cutover (2026-03-31 → 2026-04-01)

**Tasks:**
- [ ] Deploy to production
- [ ] Monitor logs and metrics
- [ ] Keep Railway as rollback option
- [ ] Validate all features working
- [ ] Document lessons learned

---

## Technical Reference

### Supabase Realtime API

```typescript
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

// Subscribe to channel
const channel = supabase.channel('orderbook:BTC/USD')

// Receive broadcasts
channel.on('broadcast', { event: 'snapshot' }, (payload) => {
  console.log('Orderbook snapshot:', payload)
})

// Send broadcast (server-side)
channel.send({
  type: 'broadcast',
  event: 'snapshot',
  payload: { data: snapshot }
})

// Presence
channel.on('presence', { event: 'sync' }, () => {
  const presenceState = channel.presenceState()
})

// Subscribe
await channel.subscribe((status) => {
  if (status === 'SUBSCRIBED') {
    console.log('Channel subscribed')
  }
})
```

### Migration Mapping

| Socket.IO | Supabase Realtime |
|-----------|------------------|
| `io.to(room).emit(event, data)` | `channel.send({ type: 'broadcast', event, payload: data })` |
| `socket.join(room)` | `supabase.channel(topic)` |
| `socket.on(event, handler)` | `channel.on('broadcast', { event }, handler)` |
| `socket.disconnect()` | `supabase.removeChannel(channel)` |

---

## Risks & Mitigation

| Risk | Impact | Mitigation |
|------|--------|------------|
| Realtime latency > 50ms | High | Test early, optimize payload size |
| Connection limits | Medium | Supabase supports 200k+ concurrent |
| Message ordering | Low | Use timestamps, handle out-of-order |
| Presence reliability | Low | Implement heartbeat + timeout |

---

## Success Criteria

- [ ] All real-time features working with Realtime
- [ ] Latency < 50ms (p95)
- [ ] No message loss in testing
- [ ] Rollback plan tested
- [ ] Documentation updated
