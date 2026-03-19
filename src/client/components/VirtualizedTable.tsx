/**
 * VirtualizedTable Component
 * High-performance table component using react-window for large datasets
 * Optimized for 1000+ rows with smooth scrolling
 */

import React, { memo, useCallback, useMemo, useRef, useState } from 'react';
import { FixedSizeList as List, ListChildComponentProps } from 'react-window';
import { Table, Typography, Spin, Empty } from '@arco-design/web-react';
import type { TableProps } from '@arco-design/web-react';

const { _Text } = Typography;

interface VirtualizedTableProps<T> extends Omit<TableProps<T>, 'scroll'> {
  /** Height of the table container */
  height: number;
  /** Row height in pixels (default: 48) */
  rowHeight?: number;
  /** Overscan count for smoother scrolling (default: 5) */
  overscanCount?: number;
  /** Enable sticky header */
  stickyHeader?: boolean;
  /** Show loading spinner */
  loading?: boolean;
  /** Empty state description */
  emptyText?: string;
  /** Callback when scrolled to bottom (for infinite loading) */
  onScrollEnd?: () => void;
  /** Threshold to trigger onScrollEnd (default: 100px from bottom) */
  scrollEndThreshold?: number;
}

/**
 * Virtualized Table Component
 * Automatically uses virtual scrolling when data exceeds threshold
 */
function VirtualizedTable<T extends Record<string, any>>({
  height,
  rowHeight = 48,
  overscanCount = 5,
  stickyHeader = true,
  loading = false,
  emptyText = '暂无数据',
  onScrollEnd,
  scrollEndThreshold = 100,
  columns,
  data = [],
  rowKey,
  ...restProps
}: VirtualizedTableProps<T>) {
  const listRef = useRef<List>(null);
  const [scrollTop, setScrollTop] = useState(0);

  // Calculate column widths
  const columnWidths = useMemo(() => {
    return columns?.map(col => {
      if (typeof col.width === 'number') return col.width;
      if (typeof col.width === 'string') {
        const parsed = parseInt(col.width, 10);
        return isNaN(parsed) ? 150 : parsed;
      }
      return 150; // default width
    }) || [];
  }, [columns]);

  const _totalWidth = useMemo(() => {
    return columnWidths.reduce((sum, w) => sum + w, 0);
  }, [columnWidths]);

  // Header component (sticky)
  const HeaderRow = useMemo(() => {
    if (!stickyHeader) return null;
    
    return (
      <div
        style={{
          display: 'flex',
          position: 'sticky',
          top: 0,
          zIndex: 10,
          backgroundColor: 'var(--color-bg-3)',
          borderBottom: '1px solid var(--color-border)',
        }}
      >
        {columns?.map((col, index) => (
          <div
            key={col.key || col.dataIndex || index}
            style={{
              width: columnWidths[index],
              padding: '12px 16px',
              fontWeight: 500,
              fontSize: 14,
              color: 'var(--color-text-2)',
              flexShrink: 0,
              textAlign: col.align || 'left',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {col.title as React.ReactNode}
          </div>
        ))}
      </div>
    );
  }, [columns, columnWidths, stickyHeader]);

  // Row renderer
  const Row = useCallback(({ index, style }: ListChildComponentProps) => {
    const record = data[index];
    if (!record) return null;

    return (
      <div
        style={{
          ...style,
          display: 'flex',
          borderBottom: '1px solid var(--color-border)',
          backgroundColor: index % 2 === 0 ? 'var(--color-bg-1)' : 'var(--color-bg-2)',
        }}
        data-index={index}
      >
        {columns?.map((col, colIndex) => {
          const value = record[col.dataIndex as keyof T];
          const render = col.render;
          
          return (
            <div
              key={col.key || col.dataIndex || colIndex}
              style={{
                width: columnWidths[colIndex],
                padding: '12px 16px',
                flexShrink: 0,
                textAlign: col.align || 'left',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              {render ? render(value, record, index) : value as React.ReactNode}
            </div>
          );
        })}
      </div>
    );
  }, [data, columns, columnWidths]);

  // Handle scroll for infinite loading
  const handleItemsRendered = useCallback(({ visibleStopIndex }: { visibleStopIndex: number }) => {
    if (onScrollEnd && visibleStopIndex >= data.length - 10) {
      onScrollEnd();
    }
  }, [onScrollEnd, data.length]);

  // Handle scroll event for custom scroll tracking
  const handleScroll = useCallback(({ scrollOffset, scrollDirection }: { scrollOffset: number; scrollDirection: 'forward' | 'backward' }) => {
    setScrollTop(scrollOffset);
    
    if (onScrollEnd && scrollDirection === 'forward') {
      const listHeight = data.length * rowHeight;
      const bottomOffset = listHeight - scrollOffset - height;
      if (bottomOffset < scrollEndThreshold) {
        onScrollEnd();
      }
    }
  }, [onScrollEnd, data.length, rowHeight, height, scrollEndThreshold]);

  // Loading state
  if (loading) {
    return (
      <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Spin size={32} />
      </div>
    );
  }

  // Empty state
  if (data.length === 0) {
    return (
      <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Empty description={emptyText} />
      </div>
    );
  }

  // Use virtual scrolling for large datasets
  const useVirtualization = data.length > 50;

  if (!useVirtualization) {
    // Fall back to regular table for small datasets
    return (
      <Table
        columns={columns}
        data={data}
        rowKey={rowKey}
        pagination={false}
        scroll={{ y: height }}
        {...restProps}
      />
    );
  }

  return (
    <div
      style={{
        height,
        width: '100%',
        overflow: 'hidden',
        border: '1px solid var(--color-border)',
        borderRadius: 4,
      }}
    >
      {HeaderRow}
      <List
        ref={listRef}
        height={height - (stickyHeader ? 48 : 0)}
        itemCount={data.length}
        itemSize={rowHeight}
        width="100%"
        overscanCount={overscanCount}
        onItemsRendered={handleItemsRendered}
        onScroll={handleScroll}
      >
        {Row}
      </List>
    </div>
  );
}

export default memo(VirtualizedTable) as typeof VirtualizedTable;