# AlphaArena 通知功能文档

本文档介绍 AlphaArena 平台的通知系统，包括邮件服务、推送服务、用户通知偏好设置以及 API 端点。

## 目录

- [概述](#概述)
- [EmailService 使用说明](#emailservice-使用说明)
- [PushService 使用说明](#pushservice-使用说明)
- [NotificationService 使用说明](#notificationservice-使用说明)
- [用户通知偏好设置](#用户通知偏好设置)
- [API 端点文档](#api-端点文档)
- [环境变量配置](#环境变量配置)

---

## 概述

AlphaArena 通知系统采用多层架构设计：

```
┌─────────────────────────────────────────────────────────┐
│                    NotificationService                    │
│           (业务层 - 信号/风险/绩效/系统通知)               │
├──────────────────────────┬──────────────────────────────┤
│       EmailService       │        PushService           │
│     (邮件通知服务)        │     (推送通知服务)            │
├──────────────────────────┼──────────────────────────────┤
│     Email Providers      │       Push Providers         │
│  SendGrid/AWS SES/Resend │   FCM/OneSignal/Expo/WebPush │
└──────────────────────────┴──────────────────────────────┘
```

### 核心特性

- **多渠道支持**：邮件 (Email)、应用内推送 (In-App)、移动推送 (Push)
- **多提供商支持**：SendGrid、AWS SES、Firebase Cloud Messaging (FCM) 等
- **模板系统**：内置邮件和推送模板，支持自定义模板
- **用户偏好**：细粒度的通知偏好设置，支持安静时段
- **通知类型**：交易信号、风险警报、绩效报告、系统通知

---

## EmailService 使用说明

`EmailService` 是统一的邮件发送接口，支持多种邮件服务提供商。

### 支持的邮件提供商

| 提供商 | 类型标识 | 说明 |
|--------|----------|------|
| Mock | `mock` | 开发/测试模式，仅日志输出 |
| SendGrid | `sendgrid` | Twilio SendGrid 邮件服务（推荐） |
| AWS SES | `aws-ses` | Amazon Simple Email Service |
| Resend | `resend` | Resend 邮件服务 |
| SMTP | `smtp` | 标准 SMTP 服务器 |

### 基本用法

```typescript
import { EmailService } from './notification';

// 创建邮件服务实例
const emailService = new EmailService({
  provider: 'sendgrid', // 或通过环境变量 EMAIL_PROVIDER 设置
  defaultFrom: { email: 'noreply@alphaarena.com', name: 'AlphaArena' },
});

// 发送简单邮件
await emailService.send({
  to: { email: 'user@example.com', name: 'John Doe' },
  subject: 'Welcome to AlphaArena!',
  html: '<h1>Welcome!</h1><p>Thank you for joining us.</p>',
  text: 'Welcome! Thank you for joining us.',
});
```

### 发送单封邮件

```typescript
// 发送给单个收件人
await emailService.sendTo(
  'user@example.com', // 或 { email: 'user@example.com', name: 'John' }
  'Your Trade Executed',
  {
    html: '<p>Your BTC/USDT order has been filled.</p>',
    text: 'Your BTC/USDT order has been filled.',
  },
  {
    // 可选配置
    tags: { type: 'trade', priority: 'high' },
  }
);
```

### 批量发送

```typescript
// 发送给多个收件人
const recipients = ['user1@example.com', 'user2@example.com'];
const results = await emailService.sendToMany(
  recipients,
  'Market Update',
  { html: '<p>Weekly market summary...</p>' }
);

// results 是一个数组，包含每个收件人的发送结果
results.forEach((result, index) => {
  if (result.success) {
    console.log(`Email sent to ${recipients[index]}`);
  } else {
    console.error(`Failed to send to ${recipients[index]}: ${result.error}`);
  }
});
```

### 使用邮件模板

EmailService 内置以下模板：

| 模板类型 | 标识 | 用途 |
|----------|------|------|
| Welcome | `welcome` | 欢迎新用户 |
| Verification | `verification` | 邮箱验证 |
| Password Reset | `password-reset` | 密码重置 |
| Alert | `alert` | 警报通知 |
| Report | `report` | 报告邮件 |

```typescript
// 使用欢迎邮件模板
await emailService.sendFromTemplate('welcome', 'newuser@example.com', {
  name: 'John',
});

// 使用验证码模板
await emailService.sendFromTemplate('verification', 'user@example.com', {
  code: '847291',
  expiryMinutes: 10,
});

// 使用密码重置模板
await emailService.sendFromTemplate('password-reset', 'user@example.com', {
  resetUrl: 'https://alphaarena.com/reset?token=abc123',
  expiryHours: 1,
});
```

### 自定义模板

```typescript
// 注册自定义邮件模板
emailService.registerTemplate('trade-alert', {
  subject: (data) => `Trade Alert: ${data.symbol}`,
  text: (data) => `Your ${data.side} order for ${data.quantity} ${data.symbol} has been executed at ${data.price}.`,
  html: (data) => `
    <h2>Trade Executed</h2>
    <p><strong>Symbol:</strong> ${data.symbol}</p>
    <p><strong>Side:</strong> ${data.side}</p>
    <p><strong>Quantity:</strong> ${data.quantity}</p>
    <p><strong>Price:</strong> ${data.price}</p>
  `,
});

// 使用自定义模板
await emailService.sendFromTemplate('trade-alert', 'trader@example.com', {
  symbol: 'BTC/USDT',
  side: 'BUY',
  quantity: 0.5,
  price: 45000,
});
```

### 检查配置状态

```typescript
// 检查邮件服务是否已配置
if (emailService.isConfigured) {
  console.log('Email service is ready');
} else {
  console.warn('Email service not configured - emails will not be sent');
}

// 检查是否在开发模式
if (emailService.isDevelopmentMode) {
  console.log('Running in development mode - emails will be logged only');
}
```

---

## PushService 使用说明

`PushService` 是统一的推送通知接口，支持 Firebase Cloud Messaging (FCM) 等多种推送服务。

### 支持的推送提供商

| 提供商 | 类型标识 | 平台支持 |
|--------|----------|----------|
| Mock | `mock` | 开发/测试模式 |
| FCM | `fcm` | iOS, Android, Web |
| OneSignal | `onesignal` | iOS, Android, Web |
| Expo | `expo` | React Native (Expo) |
| Web Push | `webpush` | 浏览器 Web Push |

### 基本用法

```typescript
import { PushService } from './notification';

// 创建推送服务实例
const pushService = new PushService({
  provider: 'fcm', // 或通过环境变量 PUSH_PROVIDER 设置
  defaultIcon: '/icons/notification.png',
  defaultSound: 'default',
});

// 发送推送通知
await pushService.send({
  tokens: [
    { token: 'device-token-1', platform: 'ios' },
    { token: 'device-token-2', platform: 'android' },
  ],
  title: 'Trade Signal',
  body: 'BTC/USDT buy signal detected!',
  options: {
    priority: 'high',
    sound: 'alert.wav',
    data: { symbol: 'BTC/USDT', type: 'signal' },
  },
});
```

### 发送给单个设备

```typescript
// 发送给单个设备
await pushService.sendToDevice(
  { token: 'fcm-token-abc123', platform: 'ios' },
  'Order Filled',
  'Your BTC/USDT limit order has been executed',
  {
    priority: 'high',
    sound: 'trade.wav',
    data: { orderId: '12345' },
  }
);
```

### 发送给多个设备

```typescript
// 发送给多个设备
const tokens = [
  { token: 'token-1', platform: 'ios' },
  { token: 'token-2', platform: 'android' },
  { token: 'token-3', platform: 'web' },
];

const result = await pushService.sendToDevices(
  tokens,
  'Risk Alert',
  'Your position has exceeded the risk threshold',
  { priority: 'high', badge: 1 }
);

console.log(`Sent: ${result.totalSent}, Failed: ${result.totalFailed}`);
```

### 使用推送模板

PushService 内置以下模板：

| 模板类型 | 标识 | 用途 |
|----------|------|------|
| Signal | `signal` | 交易信号通知 |
| Trade Executed | `trade-executed` | 订单成交通知 |
| Trade Closed | `trade-closed` | 仓位关闭通知 |
| Risk Alert | `risk-alert` | 风险警报 |
| Performance Summary | `performance-summary` | 绩效摘要 |
| System Alert | `system-alert` | 系统通知 |

```typescript
// 使用信号模板
await pushService.sendFromTemplate(
  'signal',
  [{ token: 'device-token', platform: 'ios' }],
  {
    symbol: 'BTC/USDT',
    side: 'buy',
    price: 45000,
    confidence: 0.85,
  }
);

// 使用风险警报模板
await pushService.sendFromTemplate(
  'risk-alert',
  [{ token: 'device-token', platform: 'android' }],
  {
    riskType: 'loss_threshold',
    message: 'Daily loss limit exceeded',
    currentValue: '-5.2%',
    threshold: '-3%',
  }
);

// 使用绩效摘要模板
await pushService.sendFromTemplate(
  'performance-summary',
  [{ token: 'device-token', platform: 'ios' }],
  {
    period: 'daily',
    pnl: 1250.50,
    pnlPercent: 2.5,
    winRate: 0.67,
  }
);
```

### 自定义推送模板

```typescript
// 注册自定义推送模板
pushService.registerTemplate('price-alert', {
  title: (data) => `Price Alert: ${data.symbol}`,
  body: (data) => `${data.symbol} has ${data.direction} ${data.threshold}`,
  options: (data) => ({
    sound: 'price_alert.wav',
    priority: 'high',
    data: {
      type: 'price-alert',
      symbol: String(data.symbol),
    },
    actions: [
      { id: 'view', title: 'View Chart' },
      { id: 'trade', title: 'Trade Now' },
    ],
  }),
});
```

### 推送选项详解

```typescript
interface PushOptions {
  // 通知图标 (Android/Web)
  icon?: string;
  
  // 通知图片 (富媒体通知)
  image?: string;
  
  // 角标数字 (iOS)
  badge?: number;
  
  // 提示音
  sound?: string;
  
  // 优先级: 'high' | 'normal'
  priority?: 'high' | 'normal';
  
  // 存活时间 (秒)
  ttl?: number;
  
  // 定时发送
  scheduledAt?: Date;
  
  // 折叠键 (分组)
  collapseKey?: string;
  
  // 自定义数据负载
  data?: Record<string, string | number | boolean | object>;
  
  // 操作按钮
  actions?: Array<{ id: string; title: string; icon?: string }>;
  
  // 分析标签
  tags?: Record<string, string>;
  
  // 通道 ID (Android 8.0+)
  channelId?: string;
}
```

---

## NotificationService 使用说明

`NotificationService` 是业务层通知服务，处理特定类型的业务通知。

### 通知类型

| 类型 | 标识 | 说明 |
|------|------|------|
| SIGNAL | `SIGNAL` | 交易信号通知 |
| RISK | `RISK` | 风险警报通知 |
| PERFORMANCE | `PERFORMANCE` | 绩效报告通知 |
| SYSTEM | `SYSTEM` | 系统通知 |

### 优先级

| 优先级 | 标识 | 说明 |
|--------|------|------|
| LOW | `LOW` | 低优先级 |
| MEDIUM | `MEDIUM` | 中优先级 |
| HIGH | `HIGH` | 高优先级 |
| URGENT | `URGENT` | 紧急 |

### 创建交易信号通知

```typescript
import { NotificationService } from './notification';

// 创建信号通知
const notification = await NotificationService.createSignalNotification(
  'user-123',
  'New Trading Signal',
  'BTC/USDT buy signal detected with 85% confidence',
  {
    symbol: 'BTC/USDT',
    side: 'buy',
    price: 45000,
    strategy: 'sma_crossover',
    confidence: 0.85,
  },
  {
    priority: 'HIGH',
    actionUrl: '/trading/signals/btc-usdt',
    strategyId: 'strategy-456',
  }
);
```

### 创建风险警报通知

```typescript
// 创建风险通知
await NotificationService.createRiskNotification(
  'user-123',
  'Position Risk Alert',
  'Your BTC position has exceeded the 5% loss threshold',
  {
    risk_type: 'loss_threshold',
    symbol: 'BTC/USDT',
    current_value: -5.5,
    threshold_value: -5.0,
    message_details: 'Current P&L: -$550 (5.5% loss)',
  },
  {
    priority: 'URGENT',
    actionUrl: '/positions/btc-usdt',
  }
);
```

### 创建绩效报告通知

```typescript
// 创建绩效通知
await NotificationService.createPerformanceNotification(
  'user-123',
  'Daily Performance Report',
  'Your portfolio gained 2.5% today with a 67% win rate',
  {
    period: 'daily',
    total_pnl: 250.00,
    total_pnl_percent: 2.5,
    win_rate: 0.67,
    trade_count: 12,
    best_trade: { symbol: 'ETH/USDT', pnl: 150 },
    worst_trade: { symbol: 'SOL/USDT', pnl: -50 },
  }
);
```

### 创建系统通知

```typescript
// 创建系统通知
await NotificationService.createSystemNotification(
  'user-123',
  'Scheduled Maintenance',
  'The platform will undergo maintenance on March 25, 2026 at 02:00 UTC',
  {
    event_type: 'maintenance',
    scheduled_time: '2026-03-25T02:00:00Z',
    duration_minutes: 120,
    details: 'Expected downtime: 2 hours',
  },
  {
    priority: 'MEDIUM',
    expiresAt: '2026-03-25T06:00:00Z',
  }
);
```

### 广播通知

```typescript
// 向多个用户发送通知
const userIds = ['user-1', 'user-2', 'user-3'];
const notifications = await NotificationService.broadcastNotification(
  userIds,
  'SYSTEM',
  'Platform Update',
  'New features are now available! Check out the latest updates.',
  {
    priority: 'MEDIUM',
    actionUrl: '/updates',
  }
);
```

### 获取用户通知

```typescript
// 获取用户通知列表
const { notifications, total } = await NotificationService.getUserNotifications(
  'user-123',
  {
    limit: 20,
    offset: 0,
    is_read: false, // 只获取未读通知
    type: 'SIGNAL', // 可选：按类型筛选
    priority: 'HIGH', // 可选：按优先级筛选
  }
);

// 获取未读数量
const unreadCount = await NotificationService.getUserUnreadCount('user-123');
```

### 标记已读和删除

```typescript
// 标记单个通知为已读
await NotificationService.readNotification('notification-123', 'user-123');

// 标记所有通知为已读
const markedCount = await NotificationService.readAllNotifications('user-123');

// 删除通知
await NotificationService.removeNotification('notification-123', 'user-123');
```

---

## 用户通知偏好设置

用户可以细粒度地控制接收哪些通知以及通过哪些渠道接收。

### 偏好设置结构

```typescript
interface NotificationPreferences {
  // 渠道开关
  in_app_enabled: boolean;      // 应用内通知
  email_enabled: boolean;       // 邮件通知
  push_enabled: boolean;        // 推送通知
  
  // 类型开关
  signal_notifications: boolean;       // 交易信号
  risk_notifications: boolean;         // 风险警报
  performance_notifications: boolean;  // 绩效报告
  system_notifications: boolean;       // 系统通知
  
  // 优先级阈值 (只接收此优先级及以上)
  priority_threshold: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  
  // 安静时段
  quiet_hours_enabled: boolean;
  quiet_hours_start?: string;    // e.g., "22:00"
  quiet_hours_end?: string;      // e.g., "08:00"
  quiet_hours_timezone?: string; // e.g., "Asia/Shanghai"
  
  // 摘要功能
  digest_enabled: boolean;
  digest_frequency?: 'hourly' | 'daily' | 'weekly';
}
```

### 获取用户偏好

```typescript
// 获取用户通知偏好
const preferences = await NotificationService.getUserPreferences('user-123');

console.log('Email enabled:', preferences.email_enabled);
console.log('Quiet hours:', preferences.quiet_hours_start, '-', preferences.quiet_hours_end);
```

### 更新用户偏好

```typescript
// 更新通知偏好
const updated = await NotificationService.updateUserPreferences('user-123', {
  // 开启邮件和推送
  email_enabled: true,
  push_enabled: true,
  
  // 关闭应用内通知
  in_app_enabled: false,
  
  // 只接收高风险及以上通知
  priority_threshold: 'HIGH',
  
  // 开启安静时段 (22:00 - 08:00)
  quiet_hours_enabled: true,
  quiet_hours_start: '22:00',
  quiet_hours_end: '08:00',
  quiet_hours_timezone: 'Asia/Shanghai',
  
  // 开启每日摘要
  digest_enabled: true,
  digest_frequency: 'daily',
});
```

### 偏好设置示例

#### 保守型交易者

```typescript
// 只接收风险警报和系统通知
await NotificationService.updateUserPreferences('user-123', {
  signal_notifications: false,
  risk_notifications: true,
  performance_notifications: false,
  system_notifications: true,
  priority_threshold: 'HIGH',
  push_enabled: true,
  email_enabled: true,
});
```

#### 活跃交易者

```typescript
// 接收所有通知，高优先级
await NotificationService.updateUserPreferences('user-123', {
  signal_notifications: true,
  risk_notifications: true,
  performance_notifications: true,
  system_notifications: true,
  priority_threshold: 'LOW',
  push_enabled: true,
  email_enabled: false, // 仅推送
});
```

#### 开启安静时段

```typescript
// 晚间不接收通知
await NotificationService.updateUserPreferences('user-123', {
  quiet_hours_enabled: true,
  quiet_hours_start: '22:00',
  quiet_hours_end: '08:00',
  quiet_hours_timezone: 'Asia/Shanghai',
});
```

---

## API 端点文档

### 基础 URL

```
https://api.alphaarena.com/api/notifications
```

### 认证

所有端点需要 Bearer Token 认证：

```
Authorization: Bearer <your-jwt-token>
```

---

### 获取通知列表

**GET** `/api/notifications`

获取当前用户的通知列表。

#### 查询参数

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `type` | string | 否 | 通知类型: `SIGNAL`, `RISK`, `PERFORMANCE`, `SYSTEM` |
| `is_read` | boolean | 否 | 是否已读 |
| `priority` | string | 否 | 优先级: `LOW`, `MEDIUM`, `HIGH`, `URGENT` |
| `limit` | number | 否 | 每页数量，默认 20 |
| `offset` | number | 否 | 偏移量，默认 0 |

#### 响应示例

```json
{
  "success": true,
  "data": [
    {
      "id": "notif-123",
      "user_id": "user-123",
      "type": "SIGNAL",
      "priority": "HIGH",
      "title": "New Trading Signal",
      "message": "BTC/USDT buy signal detected",
      "data": {
        "symbol": "BTC/USDT",
        "side": "buy",
        "confidence": 0.85
      },
      "is_read": false,
      "action_url": "/trading/signals/btc-usdt",
      "created_at": "2026-03-20T10:30:00Z"
    }
  ],
  "total": 42
}
```

---

### 获取未读数量

**GET** `/api/notifications/unread-count`

获取当前用户的未读通知数量。

#### 响应示例

```json
{
  "success": true,
  "count": 5
}
```

---

### 标记通知已读

**PUT** `/api/notifications/:id/read`

标记指定通知为已读。

#### 路径参数

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `id` | string | 是 | 通知 ID |

#### 响应示例

```json
{
  "success": true,
  "data": {
    "id": "notif-123",
    "is_read": true,
    "read_at": "2026-03-20T11:00:00Z"
  }
}
```

---

### 标记全部已读

**PUT** `/api/notifications/read-all`

标记当前用户所有通知为已读。

#### 响应示例

```json
{
  "success": true,
  "marked_count": 5
}
```

---

### 删除通知

**DELETE** `/api/notifications/:id`

删除指定通知。

#### 路径参数

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `id` | string | 是 | 通知 ID |

#### 响应示例

```json
{
  "success": true
}
```

---

### 获取通知偏好

**GET** `/api/notifications/preferences`

获取当前用户的通知偏好设置。

#### 响应示例

```json
{
  "success": true,
  "data": {
    "id": "pref-123",
    "user_id": "user-123",
    "in_app_enabled": true,
    "email_enabled": true,
    "push_enabled": true,
    "signal_notifications": true,
    "risk_notifications": true,
    "performance_notifications": true,
    "system_notifications": true,
    "priority_threshold": "MEDIUM",
    "quiet_hours_enabled": false,
    "digest_enabled": false,
    "created_at": "2026-01-15T08:00:00Z",
    "updated_at": "2026-03-20T10:00:00Z"
  }
}
```

---

### 更新通知偏好

**PUT** `/api/notifications/preferences`

更新当前用户的通知偏好设置。

#### 请求体

```json
{
  "email_enabled": true,
  "push_enabled": true,
  "signal_notifications": true,
  "risk_notifications": true,
  "performance_notifications": false,
  "priority_threshold": "HIGH",
  "quiet_hours_enabled": true,
  "quiet_hours_start": "22:00",
  "quiet_hours_end": "08:00",
  "quiet_hours_timezone": "Asia/Shanghai"
}
```

#### 可更新字段

| 字段 | 类型 | 说明 |
|------|------|------|
| `in_app_enabled` | boolean | 应用内通知开关 |
| `email_enabled` | boolean | 邮件通知开关 |
| `push_enabled` | boolean | 推送通知开关 |
| `signal_notifications` | boolean | 交易信号通知开关 |
| `risk_notifications` | boolean | 风险警报通知开关 |
| `performance_notifications` | boolean | 绩效报告通知开关 |
| `system_notifications` | boolean | 系统通知开关 |
| `priority_threshold` | string | 优先级阈值 |
| `quiet_hours_enabled` | boolean | 安静时段开关 |
| `quiet_hours_start` | string | 安静时段开始时间 |
| `quiet_hours_end` | string | 安静时段结束时间 |
| `quiet_hours_timezone` | string | 安静时段时区 |
| `digest_enabled` | boolean | 摘要功能开关 |
| `digest_frequency` | string | 摘要频率: `hourly`, `daily`, `weekly` |

#### 响应示例

```json
{
  "success": true,
  "data": {
    "id": "pref-123",
    "user_id": "user-123",
    "in_app_enabled": true,
    "email_enabled": true,
    "push_enabled": true,
    "signal_notifications": true,
    "risk_notifications": true,
    "performance_notifications": false,
    "system_notifications": true,
    "priority_threshold": "HIGH",
    "quiet_hours_enabled": true,
    "quiet_hours_start": "22:00",
    "quiet_hours_end": "08:00",
    "quiet_hours_timezone": "Asia/Shanghai",
    "digest_enabled": false,
    "updated_at": "2026-03-20T11:00:00Z"
  }
}
```

---

### 创建测试通知 (开发环境)

**POST** `/api/notifications/test`

创建一条测试通知（仅用于开发/测试环境）。

#### 请求体

```json
{
  "type": "SYSTEM",
  "title": "Test Notification",
  "message": "This is a test notification"
}
```

#### 响应示例

```json
{
  "success": true,
  "data": {
    "id": "notif-test-123",
    "type": "SYSTEM",
    "title": "Test Notification",
    "message": "This is a test notification",
    "is_read": false,
    "created_at": "2026-03-20T11:30:00Z"
  }
}
```

---

## 环境变量配置

### EmailService 配置

```bash
# 邮件提供商: mock | sendgrid | aws-ses | resend | smtp
EMAIL_PROVIDER=sendgrid

# 发件人地址
EMAIL_FROM=noreply@alphaarena.com
EMAIL_FROM_NAME=AlphaArena

# SendGrid 配置
SENDGRID_API_KEY=SG.xxxxxxxxxxxxx

# AWS SES 配置
AWS_SES_REGION=us-east-1
AWS_SES_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE
AWS_SES_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY

# Resend 配置
RESEND_API_KEY=re_xxxxxxxxxxxxx

# SMTP 配置
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_SECURE=true
SMTP_USER=username
SMTP_PASSWORD=password
```

### PushService 配置

```bash
# 推送提供商: mock | fcm | onesignal | expo | webpush
PUSH_PROVIDER=fcm

# 默认通知图标和声音
PUSH_DEFAULT_ICON=/icons/notification.png
PUSH_DEFAULT_SOUND=default

# Firebase Cloud Messaging (FCM) 配置
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"

# 或使用服务账号文件
FCM_SERVICE_ACCOUNT_PATH=/path/to/service-account.json

# OneSignal 配置
ONESIGNAL_APP_ID=your-app-id
ONESIGNAL_API_KEY=your-api-key

# Expo Push 配置
EXPO_ACCESS_TOKEN=your-expo-access-token

# Web Push (VAPID) 配置
VAPID_PUBLIC_KEY=your-public-key
VAPID_PRIVATE_KEY=your-private-key
VAPID_SUBJECT=mailto:noreply@alphaarena.com
```

### 开发模式

在开发环境中，如果不配置提供商，系统会自动使用 Mock 模式：

```bash
# 开发环境
NODE_ENV=development

# 不配置 EMAIL_PROVIDER/PUSH_PROVIDER 时，自动使用 mock 模式
# Mock 模式下，邮件和推送通知只会输出到日志
```

---

## 最佳实践

### 1. 根据用户偏好发送通知

始终检查用户偏好后再发送通知：

```typescript
// NotificationService 内部已实现偏好检查
// 如果用户关闭了某类通知，createXxxNotification 会返回 null
const notification = await NotificationService.createSignalNotification(
  userId, title, message, data
);

if (notification) {
  console.log('Notification created:', notification.id);
} else {
  console.log('User has disabled this notification type');
}
```

### 2. 设置合适的优先级

- `URGENT`: 紧急风险警报、系统故障
- `HIGH`: 重要交易信号、风险警报
- `MEDIUM`: 常规交易通知、绩效报告
- `LOW`: 一般信息、营销通知

### 3. 使用模板而非硬编码

```typescript
// 推荐：使用模板
await emailService.sendFromTemplate('alert', email, data);

// 不推荐：硬编码内容
await emailService.send({
  to: email,
  subject: `Alert: ${data.title}`,
  html: `<p>${data.message}</p>`,
});
```

### 4. 处理发送失败

```typescript
const result = await emailService.send(message);

if (!result.success) {
  // 记录错误
  console.error('Failed to send email:', result.error);
  
  // 可以考虑重试或降级到其他通知渠道
}
```

### 5. 开发环境使用 Mock

开发时不需要真实发送通知：

```typescript
// 开发环境自动使用 Mock
const emailService = new EmailService({
  developmentMode: process.env.NODE_ENV !== 'production',
});

// Mock 模式下，通知会输出到控制台日志
```

---

## 故障排除

### 邮件发送失败

1. **检查 API Key 配置**：确保 `SENDGRID_API_KEY` 或其他提供商的凭证已正确配置
2. **验证发件人地址**：确保发件人域名已在提供商处验证
3. **检查开发模式**：开发环境下默认使用 Mock，不会真正发送

### 推送通知不工作

1. **检查 FCM 配置**：确保 Firebase 凭证正确
2. **验证设备 Token**：确保设备 Token 有效且未过期
3. **检查平台配置**：iOS 需要 APNs 证书，Android 需要 FCM 项目配置

### 用户收不到通知

1. **检查用户偏好**：用户可能关闭了该类型通知
2. **检查优先级阈值**：通知优先级可能低于用户设置的阈值
3. **检查安静时段**：用户可能开启了安静时段

---

## 相关文档

- [架构设计文档](./architecture.md)
- [API 文档](./api/openapi.yaml)
- [策略开发指南](./guides/strategy-development.md)