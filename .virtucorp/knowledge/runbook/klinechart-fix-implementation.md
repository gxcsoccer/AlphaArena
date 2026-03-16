# klinechart-fix-implementation

_Saved: 2026-03-16_

# KLineChart 组件修复实施指南

## 问题概述

KLineChart 组件与 Arco Design Spin 组件存在 DOM 操作冲突，导致 `removeChild` 错误。

## 修复步骤

### 1. 添加安全清理函数

```tsx
function safeRemoveChart(chart: IChartApi | null): void {
  if (!chart) return;
  try {
    chart.remove();
  } catch (err: any) {
    if (!err.message?.includes('removeChild') && 
        !err.message?.includes('not a child') &&
        err.name !== 'NotFoundError') {
      console.error('[KLineChart] Unexpected error:', err);
    }
  }
}
```

### 2. 添加挂载状态追踪

```tsx
const isMountedRef = useRef(true);
const resizeObserverRef = useRef<ResizeObserver | null>(null);
const initTimeoutRef = useRef<ReturnType<typeof requestAnimationFrame> | null>(null);

useEffect(() => {
  isMountedRef.current = true;
  return () => { isMountedRef.current = false; };
}, []);
```

### 3. 修改 useLayoutEffect

关键变更：
- 添加 `loading` 到依赖数组
- 在 `loading=true` 时跳过初始化
- 使用 `requestAnimationFrame` 延迟初始化
- 在清理时取消所有异步操作

### 4. 清理函数改进

```tsx
const cleanupChart = useCallback(() => {
  if (initTimeoutRef.current) {
    cancelAnimationFrame(initTimeoutRef.current);
    initTimeoutRef.current = null;
  }
  if (resizeObserverRef.current) {
    resizeObserverRef.current.disconnect();
    resizeObserverRef.current = null;
  }
  if (chartRef.current) {
    safeRemoveChart(chartRef.current);
    chartRef.current = null;
  }
  candleSeriesRef.current = null;
  volumeSeriesRef.current = null;
}, []);
```

## 测试验证

1. 打开首页，确认 K 线图表正常渲染
2. 切换交易对，确认图表数据正确更新
3. 切换时间周期，确认图表正常刷新
4. 在浏览器控制台确认无 DOM 错误

## 相关资源

- [lightweight-charts React 集成文档](https://tradingview.github.io/lightweight-charts/tutorials/react/advanced)
- [lightweight-charts issue #1429](https://github.com/tradingview/lightweight-charts/issues/1429)