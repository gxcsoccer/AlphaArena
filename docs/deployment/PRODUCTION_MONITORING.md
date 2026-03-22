# AlphaArena 生产监控配置

## 概述

本文档描述 AlphaArena 生产环境的监控和日志配置。

---

## 1. 错误监控

### 当前状态

AlphaArena 已内置错误监控基础设施：

- **前端错误边界**: `src/client/components/ErrorBoundary.tsx`
- **服务端监控服务**: `src/monitoring/MonitoringService.ts`
- **飞书告警服务**: `src/monitoring/FeishuAlertService.ts`

### 飞书告警配置

在 Supabase Edge Functions 环境变量中配置：

```
FEISHU_WEBHOOK_URL=https://open.feishu.cn/open-apis/bot/v2/hook/your-webhook-id
```

### 推荐集成 Sentry（可选）

如需更强大的错误追踪，可集成 Sentry：

#### 前端集成

```bash
npm install @sentry/react
```

```typescript
// src/client/main.tsx
import * as Sentry from '@sentry/react';

Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  environment: 'production',
  tracesSampleRate: 0.1,
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
});
```

#### 环境变量

在 Vercel 中添加：
```
VITE_SENTRY_DSN=https://xxx@xxx.ingest.sentry.io/xxx
```

---

## 2. 性能监控

### Web Vitals 集成

项目已集成 `web-vitals` 包：

```typescript
// src/client/utils/webVitals.ts (建议创建)
import { onCLS, onFID, onLCP, onFCP, onTTFB } from 'web-vitals';

const sendToAnalytics = (metric: any) => {
  // 发送到分析服务
  fetch('/api/analytics/vitals', {
    method: 'POST',
    body: JSON.stringify(metric),
  });
};

onCLS(sendToAnalytics);
onFID(sendToAnalytics);
onLCP(sendToAnalytics);
onFCP(sendToAnalytics);
onTTFB(sendToAnalytics);
```

### 性能基线

| 指标 | 目标值 | 说明 |
|------|--------|------|
| LCP (Largest Contentful Paint) | < 2.5s | 最大内容绘制时间 |
| FID (First Input Delay) | < 100ms | 首次输入延迟 |
| CLS (Cumulative Layout Shift) | < 0.1 | 累积布局偏移 |
| TTFB (Time to First Byte) | < 600ms | 首字节时间 |
| FCP (First Contentful Paint) | < 1.8s | 首次内容绘制 |

### Vercel Analytics

在 Vercel 项目中启用：
1. 进入项目设置 → Analytics
2. 启用 Web Analytics
3. 查看实时性能数据

---

## 3. 访问日志

### Vercel 日志

Vercel 自动记录所有请求日志：
1. 进入项目 → Deployments
2. 选择部署 → Logs
3. 可查看实时日志和历史日志

### Supabase 日志

Supabase 提供详细的日志：
1. 进入 Supabase Dashboard
2. 选择项目 → Logs
3. 可查看：
   - API 日志
   - Postgres 日志
   - Edge Functions 日志
   - Auth 日志

### 日志保留策略

| 服务 | 免费版 | 付费版 |
|------|--------|--------|
| Vercel | 1 天 | 30 天 |
| Supabase | 1 天 | 30 天 |

---

## 4. 正常运行监控

### 现有监控服务

项目包含健康监控：

- `src/monitoring/UptimeMonitor.ts` - 正常运行时间监控
- `src/monitoring/PriceMonitoringService.ts` - 价格监控

### 外部监控（推荐）

推荐使用以下免费服务进行正常运行监控：

#### UptimeRobot 配置

1. 访问 https://uptimerobot.com
2. 添加监控：
   - Monitor Type: HTTPS
   - URL: https://alphaarena.vercel.app
   - Check Interval: 5 minutes
3. 配置告警通知

#### Better Stack (推荐)

1. 访问 https://betterstack.com
2. 创建监控器
3. 配置 Webhook 告警到飞书

---

## 5. 告警配置

### 告警渠道

| 告警类型 | 渠道 | 级别 |
|----------|------|------|
| 服务宕机 | 飞书/短信 | P0 |
| 错误率上升 | 飞书 | P1 |
| 性能下降 | 飞书 | P2 |
| 资源使用高 | 邮件 | P3 |

### 飞书告警模板

```typescript
// 使用现有 FeishuAlertService
import { getFeishuAlertService } from '../monitoring';

const alertService = getFeishuAlertService();

// 发送告警
await alertService.sendAlert({
  title: '🚨 AlphaArena 服务告警',
  content: `
**服务**: AlphaArena
**环境**: Production
**级别**: P0
**时间**: ${new Date().toISOString()}

**问题描述**:
服务响应异常，请立即处理。

**影响范围**:
用户无法访问交易界面。

**建议操作**:
1. 检查 Vercel 部署状态
2. 检查 Supabase 服务状态
3. 准备回滚
  `,
});
```

---

## 6. 监控仪表板

### 推荐仪表板配置

使用 Grafana + Prometheus 或 Vercel + Supabase 内置仪表板：

#### Vercel 仪表板

- 请求量
- 错误率
- 响应时间
- 带宽使用

#### Supabase 仪表板

- 数据库连接数
- 查询性能
- Edge Functions 调用量
- Auth 用户数

---

## 7. 定期检查

### 日常检查（每日）

- [ ] 检查 Vercel 部署状态
- [ ] 检查 Supabase 日志有无异常
- [ ] 检查错误告警

### 周检查

- [ ] 检查性能指标趋势
- [ ] 检查资源使用情况
- [ ] 检查备份状态

### 月检查

- [ ] 审查告警阈值
- [ ] 更新监控规则
- [ ] 清理日志/归档

---

## 8. 故障响应

### P0 故障响应流程

1. **0-5 分钟**: 确认问题，通知团队
2. **5-15 分钟**: 尝试快速修复或回滚
3. **15-30 分钟**: 问题升级，通知用户
4. **30-60 分钟**: 深入调查，制定修复计划
5. **修复后**: 根因分析，记录复盘

### 故障报告模板

```markdown
# 故障报告 - YYYY-MM-DD

## 基本信息
- 发现时间:
- 恢复时间:
- 持续时间:
- 影响范围:
- 处理人员:

## 时间线
- HH:MM 事件发生
- HH:MM 发现告警
- HH:MM 开始处理
- HH:MM 问题解决

## 根因分析
### 直接原因
### 根本原因
### 触发条件

## 影响评估
- 受影响用户数:
- 业务影响:

## 改进措施
1. [改进措施]
2. [改进措施]

## 经验教训
- [教训]
```