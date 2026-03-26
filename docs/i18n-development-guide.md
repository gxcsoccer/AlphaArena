# i18n 开发指南

本文档提供 AlphaArena 国际化功能的开发指南，包括最佳实践、常见模式和注意事项。

## 快速开始

### 基本使用

```tsx
import { useTranslation } from '../i18n/mod';

function MyComponent() {
  const { t } = useTranslation('common');
  
  return (
    <div>
      <h1>{t('label.title')}</h1>
      <button>{t('button.submit')}</button>
    </div>
  );
}
```

### 多命名空间

```tsx
import { useTranslation } from '../i18n/mod';

function TradingPanel() {
  const { t: common } = useTranslation('common');
  const { t: trading } = useTranslation('trading');
  
  return (
    <div>
      <button>{common('button.submit')}</button>
      <span>{trading('order.buy')}</span>
    </div>
  );
}
```

## 数字和日期格式化

### 使用 hooks

```tsx
import { useNumberFormatter, useDateFormatter } from '../i18n/mod';

function PriceDisplay({ price, timestamp }: { price: number; timestamp: Date }) {
  const { formatCurrency, formatNumber, formatPercent } = useNumberFormatter();
  const { formatDate, formatDateTime } = useDateFormatter();
  
  return (
    <div>
      <p>Price: {formatCurrency(price, 'USD')}</p>
      <p>Change: {formatPercent(0.05)}</p>
      <p>Date: {formatDateTime(timestamp)}</p>
    </div>
  );
}
```

### 格式化选项

```tsx
const { formatCurrency } = useNumberFormatter();

// 带选项的货币格式化
formatCurrency(1234.56, 'USD', { 
  minimumFractionDigits: 0,
  maximumFractionDigits: 0 
});
// zh-CN: ¥1,235
// en-US: $1,235

// 百分比格式化
formatPercent(0.1234, { 
  minimumFractionDigits: 2 
});
// zh-CN: 12.34%
// en-US: 12.34%
```

## 组件国际化模式

### 1. 替换硬编码字符串

**❌ 错误做法:**
```tsx
<Text>暂无数据</Text>
```

**✅ 正确做法:**
```tsx
const { t } = useTranslation('common');
<Text>{t('message.noData')}</Text>
```

### 2. 使用本地化格式化函数

**❌ 错误做法:**
```tsx
const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('zh-CN', {
    style: 'currency',
    currency: 'USD',
  }).format(value);
};
```

**✅ 正确做法:**
```tsx
const { formatCurrency } = useNumberFormatter();
// 自动根据当前语言选择合适的 locale
```

### 3. 图表组件国际化

```tsx
import { useTranslation, useNumberFormatter } from '../i18n/mod';

function ChartComponent({ data }) {
  const { t } = useTranslation('common');
  const { formatCurrency } = useNumberFormatter();
  
  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div>
          <p>{t('chart.equity')}: {formatCurrency(data.equity)}</p>
          <p>{t('chart.drawdown')}: {data.drawdown}%</p>
        </div>
      );
    }
    return null;
  };
  
  return (
    <ResponsiveContainer>
      <AreaChart data={data}>
        <Tooltip content={<CustomTooltip />} />
      </AreaChart>
    </ResponsiveContainer>
  );
}
```

### 4. 动态标题和标签

```tsx
function Card({ titleKey, data }) {
  const { t } = useTranslation('dashboard');
  
  // 支持传入 key 或直接使用翻译
  const title = titleKey ? t(titleKey) : t('chart.equityCurve');
  
  return (
    <Card title={title}>
      {/* ... */}
    </Card>
  );
}
```

## 第三方组件本地化

### Arco Design

Arco Design 组件通过 `LocaleProvider` 自动本地化：

```tsx
// 已在 App.tsx 中配置
<LocaleProvider>
  <App />
</LocaleProvider>

// DatePicker, Pagination 等组件会自动使用正确的语言
<DatePicker />  // 会显示中文或英文
```

### Recharts 图表

Recharts 需要手动本地化标签和提示：

```tsx
function LocalizedChart({ data }) {
  const { t } = useTranslation('common');
  const { formatCurrency } = useNumberFormatter();
  
  return (
    <ResponsiveContainer>
      <AreaChart data={data}>
        <XAxis tickFormatter={(value) => formatXAxis(value)} />
        <YAxis tickFormatter={(value) => formatCurrency(value)} />
        <Tooltip content={<LocalizedTooltip t={t} formatCurrency={formatCurrency} />} />
      </AreaChart>
    </ResponsiveContainer>
  );
}
```

## 语言切换

### 使用 LanguageSwitcher 组件

```tsx
import { LanguageSwitcher } from '../components/LanguageSwitcher';

function Header() {
  return (
    <div>
      <LanguageSwitcher />
    </div>
  );
}
```

### 编程式切换

```tsx
import { useLocaleContext } from '../i18n/mod';

function MyComponent() {
  const { currentLanguage, changeLanguage } = useLocaleContext();
  
  const handleLanguageChange = async (lang: 'zh-CN' | 'en-US') => {
    await changeLanguage(lang);
  };
  
  return (
    <button onClick={() => handleLanguageChange('en-US')}>
      Switch to English
    </button>
  );
}
```

## 测试

### 单元测试

使用 i18n mock 进行测试：

```tsx
// tests/__mocks__/i18n.ts 已配置好 mock
import { render, screen } from '@testing-library/react';
import { LocaleProvider } from '../../src/client/i18n/LocaleProvider';
import MyComponent from './MyComponent';

describe('MyComponent', () => {
  it('should display translated text', async () => {
    render(
      <LocaleProvider>
        <MyComponent />
      </LocaleProvider>
    );
    
    expect(screen.getByText('提交')).toBeInTheDocument(); // zh-CN 默认
  });
});
```

### E2E 测试

E2E 测试应支持多语言断言：

```yaml
- aiAssert: "页面有'免费注册'或 'Sign Up' 按钮，按钮可点击"
```

## 常见问题

### Q: 翻译不生效？

检查以下几点：
1. 确保组件被 `LocaleProvider` 包裹
2. 检查 namespace 是否正确
3. 确认翻译 key 存在于对应的 JSON 文件中

### Q: 数字格式化显示错误？

确保使用 `useNumberFormatter` hook，而不是硬编码 locale：

```tsx
// ❌ 错误
new Intl.NumberFormat('zh-CN', ...).format(value)

// ✅ 正确
const { formatCurrency } = useNumberFormatter();
formatCurrency(value);
```

### Q: Arco Design 组件语言不正确？

确保 `LocaleProvider` 正确包裹了应用，并且 Arco locale 已配置：

```tsx
// src/client/i18n/LocaleProvider.tsx
<ConfigProvider locale={arcoLocale}>
  {children}
</ConfigProvider>
```

## 添加新翻译

### 1. 在翻译文件中添加 key

翻译文件位于 `public/locales/` 目录，由 HTTP 后端按需加载（Issue #618）：

```json
// public/locales/zh-CN/common.json
{
  "newKey": {
    "title": "新标题",
    "description": "新描述"
  }
}

// public/locales/en-US/common.json
{
  "newKey": {
    "title": "New Title",
    "description": "New Description"
  }
}
```

### 2. 在组件中使用

```tsx
const { t } = useTranslation('common');
<h1>{t('newKey.title')}</h1>
```

## 相关文件

- 翻译文件: `public/locales/` (HTTP 后端加载)
- i18n 配置: `src/client/i18n/index.ts`
- Locale Provider: `src/client/i18n/LocaleProvider.tsx`
- Hooks: `src/client/i18n/hooks.ts`
- 语言切换器: `src/client/components/LanguageSwitcher.tsx`
- 命名规范: `docs/i18n-naming-convention.md`