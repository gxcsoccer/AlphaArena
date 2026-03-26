# AlphaArena UI 设计规范建议

## 背景
用户反馈界面「很丑，不像商业化产品」。本文档提供系统性设计规范建议，帮助建立专业可信的视觉形象。

---

## 一、品牌定位

### 核心价值
- **专业** - 金融级交易工具
- **可信** - 安全可靠的数据处理
- **科技** - AI 驱动的智能策略

### 品牌调性
- 简洁、现代、专业
- 避免过度装饰
- 数据驱动的理性美感

---

## 二、色彩系统

### 推荐主色调

**方案 A：科技蓝（推荐）**
```css
--primary-50: #EFF6FF;
--primary-100: #DBEAFE;
--primary-200: #BFDBFE;
--primary-300: #93C5FD;
--primary-400: #60A5FA;
--primary-500: #3B82F6;  /* 主品牌色 */
--primary-600: #2563EB;
--primary-700: #1D4ED8;
--primary-800: #1E40AF;
--primary-900: #1E3A8A;
```

**方案 B：金融绿**
```css
--primary-500: #10B981;  /* 主品牌色 */
```

**方案 C：深紫科技**
```css
--primary-500: #7C3AED;  /* 主品牌色 */
```

### 功能色
```css
/* 成功 - 绿色 */
--success-500: #10B981;

/* 警告 - 橙色 */
--warning-500: #F59E0B;

/* 错误 - 红色 */
--error-500: #EF4444;

/* 信息 - 蓝色 */
--info-500: #3B82F6;
```

### 中性色
```css
/* 浅色主题 */
--neutral-50: #FAFAFA;
--neutral-100: #F4F4F5;
--neutral-200: #E4E4E7;
--neutral-300: #D4D4D8;
--neutral-400: #A1A1AA;
--neutral-500: #71717A;
--neutral-600: #52525B;
--neutral-700: #3F3F46;
--neutral-800: #27272A;
--neutral-900: #18181B;

/* 深色主题需要反转 */
```

---

## 三、排版规范

### 字体推荐

**中文字体**
- 思源黑体 (Noto Sans SC) - 免费、专业
- 苹方 (PingFang SC) - macOS/iOS 原生

**英文字体**
- Inter - 现代、易读
- SF Pro - Apple 系统字体
- system-ui - 系统默认

### 字体层级

```css
/* 标题 */
--font-size-h1: 32px;    /* 页面主标题 */
--font-size-h2: 24px;    /* 区块标题 */
--font-size-h3: 20px;    /* 卡片标题 */
--font-size-h4: 18px;    /* 小标题 */
--font-size-h5: 16px;    /* 次级标题 */
--font-size-h6: 14px;    /* 辅助标题 */

/* 正文 */
--font-size-body: 14px;  /* 主要正文 */
--font-size-small: 12px; /* 辅助文字 */
--font-size-xs: 10px;    /* 标签、徽章 */

/* 行高 */
--line-height-tight: 1.25;
--line-height-normal: 1.5;
--line-height-relaxed: 1.75;

/* 字重 */
--font-weight-normal: 400;
--font-weight-medium: 500;
--font-weight-semibold: 600;
--font-weight-bold: 700;
```

---

## 四、间距系统

### 基础单位
基于 4px 网格系统：

```css
--spacing-0: 0;
--spacing-1: 4px;   /* 最小间距 */
--spacing-2: 8px;   /* 元素内部间距 */
--spacing-3: 12px;  /* 紧凑间距 */
--spacing-4: 16px;  /* 标准间距 */
--spacing-5: 20px;  /* 宽松间距 */
--spacing-6: 24px;  /* 区块间距 */
--spacing-8: 32px;  /* 大区块间距 */
--spacing-10: 40px; /* 章节间距 */
--spacing-12: 48px; /* 页面边距 */
--spacing-16: 64px; /* 大章节间距 */
```

### 圆角
```css
--radius-sm: 4px;   /* 小元素（标签） */
--radius-md: 8px;   /* 按钮、输入框 */
--radius-lg: 12px;  /* 卡片 */
--radius-xl: 16px;  /* 大卡片 */
--radius-full: 9999px; /* 圆形 */
```

### 阴影
```css
/* 浅色主题 */
--shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
--shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
--shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
--shadow-xl: 0 20px 25px -5px rgba(0, 0, 0, 0.1);

/* 深色主题 - 使用更柔和的阴影或发光 */
--shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.3);
--shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.4);
```

---

## 五、组件规范

### 按钮

**尺寸**
```css
/* 小按钮 */
--btn-sm-height: 28px;
--btn-sm-padding: 8px 12px;
--btn-sm-font: 12px;

/* 默认按钮 */
--btn-md-height: 36px;
--btn-md-padding: 12px 16px;
--btn-md-font: 14px;

/* 大按钮 */
--btn-lg-height: 44px;
--btn-lg-padding: 16px 24px;
--btn-lg-font: 16px;
```

**类型**
- Primary - 主要操作（品牌色）
- Secondary - 次要操作（中性色）
- Ghost - 轻量操作（无边框）
- Danger - 危险操作（红色）

### 卡片

```css
/* 标准卡片 */
.card {
  background: var(--color-bg-2);
  border-radius: var(--radius-lg);
  border: 1px solid var(--color-border-1);
  padding: var(--spacing-6);
}

/* 悬停效果 */
.card:hover {
  box-shadow: var(--shadow-lg);
  transform: translateY(-2px);
  transition: all 0.2s ease;
}
```

### 表单

```css
/* 输入框 */
.input {
  height: 36px;
  padding: 8px 12px;
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border-2);
}

.input:focus {
  border-color: var(--primary-500);
  box-shadow: 0 0 0 3px var(--primary-100);
}
```

---

## 六、动效规范

### 过渡时间
```css
--duration-fast: 150ms;   /* 微交互 */
--duration-normal: 250ms; /* 标准过渡 */
--duration-slow: 350ms;   /* 大动作 */
```

### 缓动函数
```css
--ease-in: cubic-bezier(0.4, 0, 1, 1);
--ease-out: cubic-bezier(0, 0, 0.2, 1);
--ease-in-out: cubic-bezier(0.4, 0, 0.2, 1);
```

### 常用动效
- 按钮点击：scale(0.98) + 150ms
- 卡片悬停：translateY(-2px) + shadow + 250ms
- 页面进入：opacity 0→1 + translateY(10px→0) + 350ms
- 模态框：scale(0.95→1) + opacity + 250ms

---

## 七、参考设计

### 优秀案例

1. **Linear** (linear.app)
   - 简洁专业的设计语言
   - 精致的深色模式
   - 流畅的动效

2. **Vercel** (vercel.com)
   - 科技感强烈的 Landing Page
   - 清晰的价值主张展示
   - 专业的数据可视化

3. **Stripe** (stripe.com)
   - 建立信任感的设计
   - 清晰的功能展示
   - 优秀的移动端体验

4. **Coinbase** (coinbase.com)
   - 金融产品的信任感设计
   - 数据可视化
   - 安全感传达

---

## 八、实施优先级

### P0（立即）
1. 建立色彩系统
2. 统一字体规范
3. Landing Page 改版

### P1（短期）
1. 动效系统
2. 空状态设计
3. Logo 设计

### P2（中期）
1. 全面组件库升级
2. 深色模式优化
3. 邮件模板设计

---

## 相关 Issues

- #569: 视觉设计系统建立
- #570: Landing Page 改版
- #571: 交互体验优化
- #572: 品牌视觉元素强化
- #573: 仪表板与核心页面视觉优化