# flaky-e2e-trading-pair-switch

_Saved: 2026-05-11_

# Flaky E2E Test: Trading Pair Switch

## Issue
E2E test "Trading Pair Switch" fails intermittently (2/5 recent runs on main branch).

## Symptom
- Could not find trading pair in table
- Unrelated to locale/i18n changes

## Impact
- Causes false negatives on PR CI checks
- Does NOT affect actual functionality

## Status
- Documented 2026-05-11 during PR #769 review
- Needs investigation but not blocking production deployments

## Recommendation
When this E2E test fails:
1. Check if other tests pass
2. Verify failure is unrelated to PR changes
3. Proceed with merge if fix is otherwise sound
4. Create issue for E2E flakiness investigation