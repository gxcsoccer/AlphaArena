# Sprint 3 Planning - Supabase Realtime Migration & Production Stability

**Date:** 2026-03-13  
**Milestone:** Sprint 3 - Supabase Realtime Migration & Production Stability (#4)  
**Due:** 2026-03-26

---

## Sprint Goal

Complete the migration from Socket.IO (Railway) to Supabase Realtime, resolve production stability issues (CORS), and establish a unified real-time infrastructure on Supabase.

---

## Background

Sprint 2 delivered a fully functional web application with real-time trading features. However, the infrastructure is split:
- **Frontend:** Vercel (static site)
- **Backend:** Railway (Express.js + Socket.IO)
- **Database:** PostgreSQL (various providers)

Sprint 3 consolidates this by migrating WebSocket functionality to Supabase Realtime, reducing operational complexity and cost.

---

## Issues in Sprint 3

### Carry-over from Sprint 2

| # | Title | Priority | Status | Notes |
|---|-------|----------|--------|-------|
| #47 | 调研 Supabase Realtime 替代 WebSocket 方案 | P2 | Research Complete | Research done, migration in progress |
| #49 | 迁移 WebSocket 从 Socket.IO 到 Supabase Realtime | P1 | Phase 1 Complete | Phases 2-5 in this sprint |

### New Issues for Sprint 3

| # | Title | Priority | Agent | Dependencies |
|---|-------|----------|-------|--------------|
| #52 | Phase 2: Backend - Implement Supabase Realtime Broadcast Service | P1 | vc:dev | #49 Phase 1 |
| #53 | Phase 3: Frontend - Integrate Supabase Realtime Client SDK | P1 | vc:dev | #52 |
| #54 | Fix CORS issues for production API calls | P0 | vc:dev | None (bug fix) |
| #55 | Phase 4: Testing and Validation - Realtime Performance Testing | P1 | vc:qa | #52, #53 |
| #56 | Update documentation and deployment runbooks | P2 | vc:ops | #52, #53 |

---

## Development Phases

### Phase 1: Preparation ✅ (Complete)
**Status:** Done in Sprint 2

- [x] Supabase Realtime configuration verified
- [x] SDK installed (@supabase/supabase-js@2.99.0)
- [x] Connection test passed
- [x] Migration plan documented
- [x] Feature branch created

### Phase 2: Backend Transformation (Days 1-4)
**Issue:** #52

- [ ] Remove Socket.IO server dependencies
- [ ] Create Supabase Realtime service class
- [ ] Implement Broadcast for orderbook events
- [ ] Implement Broadcast for ticker events
- [ ] Implement Broadcast for trade events
- [ ] Update APIServer to use Realtime channels
- [ ] Test backend broadcasts locally

**Deliverable:** Backend broadcasts via Supabase Realtime, Socket.IO code removed

### Phase 3: Frontend Integration (Days 4-7)
**Issue:** #53

- [ ] Remove socket.io-client dependency
- [ ] Integrate Supabase Realtime SDK
- [ ] Implement channel subscription pattern
- [ ] Update OrderBook component
- [ ] Update Ticker component
- [ ] Update Trading component
- [ ] Implement reconnection logic
- [ ] Implement cleanup on unmount

**Deliverable:** Frontend receives real-time updates via Supabase Realtime

### Phase 4: Testing & Validation (Days 7-10)
**Issue:** #55

- [ ] Functional testing (all features work)
- [ ] Performance testing (latency < 50ms p95)
- [ ] Concurrent connection testing (>500 connections)
- [ ] Integration testing (end-to-end flows)
- [ ] Edge case testing (reconnection, errors)
- [ ] Performance report with metrics

**Deliverable:** Test report with pass/fail results and performance metrics

### Phase 5: Production Rollout (Days 10-12)
**Issues:** #54, #56

- [ ] Fix CORS configuration (Issue #54)
- [ ] Deploy backend with Realtime changes
- [ ] Deploy frontend with Realtime SDK
- [ ] Monitor production for errors
- [ ] Update documentation (Issue #56)
- [ ] Update deployment runbooks
- [ ] Verify rollback procedure

**Deliverable:** Production deployment with full Realtime functionality

---

## Technical Specifications

### Supabase Realtime Configuration

**Project:** `plnylmnckssnfpwznpwf.supabase.co`  
**Endpoint:** `wss://plnylmnckssnfpwznpwf.supabase.co/realtime/v1`  
**SDK:** `@supabase/supabase-js@2.99.0`

### Channel Naming Convention

```
orderbook:{symbol}    → Order book updates (e.g., orderbook:BTC-USD)
ticker:{symbol}       → Market ticker (e.g., ticker:BTC-USD)
trade:{userId}        → Trade notifications (e.g., trade:user123)
presence:traders      → Online presence
```

### Message Format

```typescript
// Broadcast message structure
{
  type: 'broadcast',
  event: 'update',  // or 'orderbook:update', 'ticker:update', etc.
  payload: {
    // Event-specific data
    symbol: 'BTC-USD',
    bids: [...],
    asks: [...],
    timestamp: '2026-03-19T12:00:00Z'
  }
}
```

### Performance Targets

| Metric | Target | Measurement |
|--------|--------|-------------|
| Message Latency (p95) | < 50ms | Client receive time - server send time |
| Concurrent Connections | > 500 | Load test with multiple clients |
| Message Loss | 0% | Compare sent vs received messages |
| Reconnection Time | < 5s | Time to re-establish after disconnect |

---

## Acceptance Criteria

### Must Have (P0)
- [ ] All API calls work without CORS errors
- [ ] Order book updates in real-time
- [ ] Ticker updates in real-time
- [ ] Trade notifications work
- [ ] No console errors related to WebSocket/Realtime

### Should Have (P1)
- [ ] Message latency < 50ms (p95)
- [ ] Support > 500 concurrent connections
- [ ] Graceful reconnection on network issues
- [ ] Performance test report completed

### Nice to Have (P2)
- [ ] Presence feature (online traders)
- [ ] Documentation fully updated
- [ ] Deployment runbook tested

---

## Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Supabase rate limits exceeded | Medium | High | Monitor usage, upgrade to Pro if needed |
| Migration breaks existing features | Low | High | Parallel running, gradual traffic shift |
| Performance worse than Socket.IO | Low | Medium | Benchmark during testing, rollback if needed |
| CORS issues persist | Low | High | Test in staging before production |

---

## Dependencies

### External
- **Supabase Realtime Service:** Must be available and stable
- **Vercel Deployment:** For frontend updates
- **Railway Deployment:** For backend updates (until migration complete)

### Internal
- **Issue #52 → #53:** Backend must be ready before frontend integration
- **Issue #52, #53 → #55:** Testing requires both backend and frontend changes
- **Issue #52, #53 → #56:** Documentation depends on implementation details

---

## Success Metrics

### Quantitative
- 100% of P0 issues resolved
- 0 CORS errors in production
- < 50ms message latency (p95)
- 0% message loss under normal load

### Qualitative
- Code quality: No Socket.IO remnants
- Documentation: New developer can follow runbook
- Monitoring: Clear visibility into Realtime health
- Rollback: Tested and documented procedure

---

## Sprint Timeline

```
Week 1 (Mar 19-21)
├── Day 1-2: Issue #54 (CORS fix) - P0 priority
├── Day 2-4: Issue #52 (Backend Realtime service)
└── Day 4-5: Issue #53 start (Frontend SDK integration)

Week 2 (Mar 22-26)
├── Day 6-7: Issue #53 complete (Frontend integration)
├── Day 8-9: Issue #55 (Testing & validation)
└── Day 10-11: Issue #56 (Documentation) + Production deployment
```

---

## Team Assignments

| Role | Issues | Responsibilities |
|------|--------|------------------|
| **vc:dev** | #52, #53, #54 | Backend Realtime service, Frontend SDK, CORS fix |
| **vc:qa** | #55 | Performance testing, acceptance testing |
| **vc:ops** | #56 | Documentation, deployment runbooks |
| **vc:pm** | - | Sprint tracking, blocker removal |

---

## Notes for Next Sprint

- If migration completes early, consider starting LLM strategy integration (Issue #19)
- Monitor Supabase usage to determine if Pro plan is needed
- Consider implementing analytics to track Realtime usage patterns

---

**Planning Date:** 2026-03-13  
**Prepared By:** VirtuCorp PM Agent (vc:pm)  
**Sprint Start:** 2026-03-19  
**Sprint End:** 2026-03-26
