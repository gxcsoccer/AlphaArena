# smoke-test-navigation-assertion-issue

_Saved: 2026-03-21_

# Smoke Test Navigation 断言问题

## 问题
smoke-test.yaml 中的 Navigation Test 使用断言 \"页面已导航到新内容，URL 或页面标题发生变化\"，但这对单页应用（SPA）不可靠。

## 原因
1. MidsceneJS 基于单张截图判断，无法看到 URL 栏或页面标题的变化历史
2. SPA 导航可能不会显著改变页面视觉内容
3. 断言过于依赖不可见的元数据变化

## 解决方案
改进导航测试断言：
```yaml
# 原来的断言
- aiAssert: 页面已导航到新内容，URL 或页面标题发生变化

# 改进方案 1：验证特定元素
- ai: 点击第一个股票项
- aiWaitFor: 股票详情面板出现
- aiAssert: 股票详情内容可见

# 改进方案 2：使用 aiQuery 提取 URL
- ai: 点击导航链接
- aiQuery:
    url: 当前页面的完整URL
- # 比较返回的 url 是否包含预期路径
```

## 记录时间
2026-03-21

## 关联 Issue
#TBD (刚创建的改进任务)