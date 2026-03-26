# smoke-test-midscene-execution-failure

_Saved: 2026-03-24_

# Smoke Test MidsceneJS 执行失败问题

## 问题现象
smoke-test.yaml 测试报告 "Execution failed"，但所有已执行的 18 个断言都通过了。测试在 "Language Switcher - Functionality" 任务的第 8 步（验证英文内容）后中断，未执行后续的切换回中文的步骤。

## 调查结果

### 1. 语言切换功能正常
单独测试语言切换功能（中文→英文→中文）完全通过，证明语言切换功能本身没有问题。

### 2. 问题根源：测试执行时间过长
- 完整 smoke-test.yaml 执行时间：303,832 ms（约 5 分钟）
- 测试包含 4 个任务，共 36 个步骤，18 个断言
- MidsceneJS 在长时间运行后可能出现资源耗尽或超时问题

### 3. 失败模式分析
- 测试在执行完第 18 个断言后突然停止
- 没有 JavaScript 错误或断言失败
- 测试框架报告 "Execution failed" 但无具体错误信息
- 可能是 MidsceneJS 内部的执行超时或资源限制

## 解决方案

### 方案 1：拆分测试文件（推荐）
将 smoke-test.yaml 拆分为多个独立的小测试文件：
- `smoke-test-basic.yaml`: 基本页面加载和导航测试
- `smoke-test-language.yaml`: 语言切换功能测试
- `smoke-test-auth.yaml`: 认证相关测试

每个测试文件执行时间控制在 2 分钟以内。

### 方案 2：简化测试流程
使用已有的简化版快速测试（参考 runbook/smoke-test-timing-issues.md），只测试核心功能：
- 页面加载
- 语言切换（简化版）

### 方案 3：增加超时配置
在 smoke-test.yaml 的 web 配置中添加：
```yaml
web:
  url: "https://alphaarena-eight.vercel.app"
  waitForNetworkIdle:
    timeout: 10000
    continueOnNetworkIdleError: true
  timeout: 300000  # 5 分钟总超时
  actionTimeout: 30000  # 每个操作 30 秒超时
```

## 验证测试
已验证单独的语言切换测试通过：
```yaml
tasks:
  - name: "Language Switcher - Full Cycle Test"
    flow:
      - sleep: 3000
      - aiAssert: "页面正常加载，语言切换按钮可见"
      - ai: "点击语言切换按钮"
      - sleep: 500
      - aiAssert: "出现语言选择下拉菜单，包含简体中文和English选项"
      - ai: "点击English选项"
      - sleep: 1500
      - aiAssert: "页面内容切换为英文，显示 Sign Up 或 Professional 文字"
      - ai: "再次点击语言切换按钮"
      - sleep: 500
      - aiAssert: "再次出现语言选择下拉菜单"
      - ai: "点击简体中文选项"
      - sleep: 1500
      - aiAssert: "页面内容切换回中文，显示 免费注册 或 专业级 文字"
```

## 建议
立即采用方案 1，拆分测试文件，确保每个测试能在 2 分钟内完成。这样可以：
1. 避免 MidsceneJS 长时间运行的问题
2. 更快定位失败的具体功能
3. 支持并行执行多个测试

## 日期
2026-03-24

## 相关
- PR #598: fix: Language switcher cannot switch back to Chinese
- runbook/smoke-test-timing-issues.md
- patterns/smoke-test-navigation-assertion-issue.md