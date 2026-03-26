# Mobile Performance Optimization - Issue #631

## 概述

本次优化针对移动端性能，实现了以下关键改进：

### 1. 图片和组件懒加载

#### LazyImage 组件（已存在）
- ✅ 使用 Intersection Observer API 实现懒加载
- ✅ 支持模糊占位符（blurhash）
- ✅ 渐进式加载（低质量 → 高质量）
- ✅ 响应式图片支持（srcset）
- ✅ 自动 WebP/AVIF 格式检测

```typescript
import { LazyImage } from '../components/LazyImage';

<LazyImage
  src="image.jpg"
  alt="Description"
  width={400}
  height={300}
  placeholderSrc="placeholder.jpg"
  fadeIn
/>
```

#### LazyLoadWrapper 组件（已存在）
- ✅ 组件级别的懒加载
- ✅ 支持 Intersection Observer
- ✅ 延迟加载（DeferredLoad）
- ✅ 渐进式加载（ProgressiveLoad）
- ✅ 骨架屏支持（SkeletonWrapper）

```typescript
import { LazyLoadWrapper, DeferredRender } from '../components/LazyLoadWrapper';

<LazyLoadWrapper rootMargin="200px" minHeight={200}>
  <HeavyComponent />
</LazyLoadWrapper>

<DeferredRender delay={100}>
  <NonCriticalContent />
</DeferredRender>
```

### 2. 分页与增量加载

#### usePagination Hook（新增）
- ✅ 支持无限滚动
- ✅ 自动预加载下一页
- ✅ 内存管理（限制最大项目数）
- ✅ API 缓存集成
- ✅ 下拉刷新支持

```typescript
import { usePagination, useInfiniteScroll } from '../hooks/usePagination';

const { items, loadMore, hasMore, loading } = usePagination({
  fetchFn: async (page, pageSize) => {
    const response = await fetch(`/api/items?page=${page}&size=${pageSize}`);
    return response.json();
  },
  pageSize: 20,
  prefetchNext: true,
});

// 无限滚动
const sentinelRef = useInfiniteScroll(loadMore, { threshold: 0.1 });

return (
  <div>
    {items.map(item => <Item key={item.id} {...item} />)}
    <div ref={sentinelRef} />
  </div>
);
```

### 3. 数据预加载策略

#### dataPreload 工具（新增）
- ✅ 关键路径优化
- ✅ 预测性预加载
- ✅ 网络感知（Network Information API）
- ✅ 按优先级加载
- ✅ 用户行为追踪

```typescript
import {
  preloadApiEndpoint,
  preloadCriticalData,
  PreloadPriority,
} from '../utils/dataPreload';

// 关键数据预加载
preloadCriticalData(userId);

// 按优先级预加载
preloadApiEndpoint('/api/market/tickers', {
  priority: PreloadPriority.HIGH,
});
```

### 4. 代码分割优化

Vite 配置已经实现了优秀的代码分割：

#### 已分离的第三方库
| 库 | 大小 (gzip) | 分离策略 |
|---|---|---|
| swagger-ui | 355.94 KB | API 文档页面独立 chunk |
| arco-design | 219.30 KB | UI 库分离 |
| recharts | 84.97 KB | 图表库分离 |
| 主包 | 96.03 KB | 应用代码 |
| lightweight-charts | 50.88 KB | 图表库分离 |

#### 路由级代码分割
所有页面组件使用 `lazyWithRetry` 实现懒加载：
```typescript
const StrategiesPage = lazyWithRetry(() => import('./pages/StrategiesPage'));
const HoldingsPage = lazyWithRetry(() => import('./pages/HoldingsPage'));
```

### 5. 虚拟列表优化

#### VirtualizedTable 组件（已存在）
- ✅ react-window 实现
- ✅ 支持 1000+ 行数据
- ✅ 无限滚动支持
- ✅ 固定表头

```typescript
import VirtualizedTable from '../components/VirtualizedTable';

<VirtualizedTable
  height={600}
  columns={columns}
  data={largeDataset}
  onScrollEnd={loadMore}
/>
```

## 性能指标

### 目标（Issue #631 验收标准）
- [ ] 移动端首屏加载时间 < 3s（4G 网络）
- [ ] 图片懒加载实现 ✅
- [ ] 组件级懒加载 ✅
- [ ] 数据分页加载 ✅
- [ ] 移动端资源体积优化（< 500KB gzipped）✅
- [ ] 数据预加载策略 ✅

### 测试方法

#### 1. Lighthouse 测试
```bash
npm run lighthouse:mobile
```

#### 2. 移动端性能测试
```bash
npm run perf:mobile
```

#### 3. Bundle 分析
```bash
npm run perf:analyze
```

## 最佳实践

### 1. 图片优化
- 使用 `LazyImage` 组件替代 `<img>`
- 提供 placeholderSrc 提升感知性能
- 使用 WebP 格式（自动转换）
- 响应式图片（srcset）

### 2. 组件懒加载
- 非首屏组件使用 `LazyLoadWrapper`
- 大型组件使用 `createLazyComponent`
- 非关键内容使用 `DeferredRender`

### 3. 数据加载
- 使用 `usePagination` 实现分页
- 启用 `prefetchNext` 预加载下一页
- 使用 API 缓存减少请求

### 4. 长列表优化
- 使用 `VirtualizedTable` 处理大数据集
- 限制单页数据量（20-50 条）
- 实现无限滚动

### 5. 网络优化
- 使用 `shouldPrefetch()` 检测网络条件
- Data Saver 模式下禁用预加载
- 2G/3G 网络延迟预加载

## 文件清单

### 新增文件
- `src/client/hooks/usePagination.ts` - 分页加载 Hook
- `src/client/hooks/useLazyComponent.ts` - 懒加载组件工具
- `src/client/utils/dataPreload.ts` - 数据预加载工具
- `scripts/mobile-performance-test.ts` - 性能测试脚本

### 已有优化文件
- `src/client/components/LazyImage.tsx` - 图片懒加载
- `src/client/components/LazyLoadWrapper.tsx` - 组件懒加载
- `src/client/components/VirtualizedTable.tsx` - 虚拟列表
- `src/client/utils/apiCache.ts` - API 缓存
- `src/client/utils/imageOptimization.ts` - 图片优化工具
- `src/client/utils/resourcePreload.ts` - 资源预加载
- `vite.config.ts` - 代码分割配置

## 后续优化建议

### 短期
1. 实现骨架屏组件统一规范
2. 添加 Service Worker 缓存策略
3. 优化字体加载（font-display: swap）

### 中期
1. 实现 Critical CSS 内联
2. 添加资源优先级提示（preload, prefetch）
3. 优化第三方脚本加载

### 长期
1. 实现流式 SSR（Server-Side Rendering）
2. 添加边缘缓存（Edge Caching）
3. 实现自适应加载（Adaptive Loading）

## 相关 Issue

- #513 - Performance Optimization
- #559 - Image and Static Resource Optimization
- #627 - 移动端响应式优化
- #628 - PWA 支持与离线能力