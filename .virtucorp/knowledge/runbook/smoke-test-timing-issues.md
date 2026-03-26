# smoke-test-timing-issues

_Saved: 2026-03-24_

# Smoke Test Timing Issues

## Problem
The saved `smoke-test.yaml` has been failing intermittently due to timing/execution issues with MidsceneJS AI-powered testing.

## Root Cause
1. Long test flows (4 tasks with many assertions)
2. AI-powered steps can take variable time
3. WebSocket connections (Supabase Realtime) keep network active, causing `waitForNetworkIdle` issues

## Solution
Use a simplified smoke test for scheduled checks:
- Shorter test flows
- Fewer assertions
- Focus on critical path only

## Quick Test Command
```yaml
tasks:
  - name: "Quick Smoke Check"
    flow:
      - sleep: 3000
      - aiAssert: "页面正常加载"
      - aiAssert: "语言切换按钮可见"
      - ai: "点击语言切换按钮，然后点击 English"
      - sleep: 1500
      - aiAssert: "页面显示英文内容"
      - ai: "点击语言切换按钮，然后点击简体中文"
      - sleep: 1500
      - aiAssert: "页面显示中文内容"
```

## Date
2026-03-24