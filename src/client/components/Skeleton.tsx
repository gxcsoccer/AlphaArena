/**
 * Skeleton Loading Components
 * Provides placeholder UI during data loading for better perceived performance
 */

import React from 'react';
import { Spin } from '@arco-design/web-react';
import styles from './Skeleton.module.css';

interface SkeletonProps {
  /** Width of the skeleton */
  width?: string | number;
  /** Height of the skeleton */
  height?: string | number;
  /** Border radius */
  borderRadius?: string | number;
  /** Additional class name */
  className?: string;
  /** Animation type */
  animation?: 'pulse' | 'wave' | 'none';
}

/**
 * Basic skeleton component
 */
export const Skeleton: React.FC<SkeletonProps> = ({
  width = '100%',
  height = '20px',
  borderRadius = '4px',
  className = '',
  animation = 'wave',
}) => {
  const style: React.CSSProperties = {
    width: typeof width === 'number' ? `${width}px` : width,
    height: typeof height === 'number' ? `${height}px` : height,
    borderRadius: typeof borderRadius === 'number' ? `${borderRadius}px` : borderRadius,
  };

  return (
    <div
      className={`${styles.skeleton} ${styles[`animation-${animation}`]} ${className}`}
      style={style}
      aria-hidden="true"
    />
  );
};

interface SkeletonTextProps {
  /** Number of lines */
  lines?: number;
  /** Line height */
  lineHeight?: number;
  /** Gap between lines */
  gap?: number;
  /** Last line width (percentage) */
  lastLineWidth?: number;
}

/**
 * Text skeleton for paragraphs
 */
export const SkeletonText: React.FC<SkeletonTextProps> = ({
  lines = 3,
  lineHeight = 16,
  gap = 8,
  lastLineWidth = 60,
}) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: `${gap}px` }}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          height={lineHeight}
          width={i === lines - 1 ? `${lastLineWidth}%` : '100%'}
        />
      ))}
    </div>
  );
};

interface SkeletonCardProps {
  /** Show header */
  showHeader?: boolean;
  /** Number of content lines */
  contentLines?: number;
  /** Card height */
  height?: number | string;
}

/**
 * Card skeleton
 */
export const SkeletonCard: React.FC<SkeletonCardProps> = ({
  showHeader = true,
  contentLines = 4,
  height,
}) => {
  return (
    <div className={styles.skeletonCard} style={{ height }}>
      {showHeader && (
        <div className={styles.skeletonCardHeader}>
          <Skeleton width={200} height={20} />
          <Skeleton width={80} height={32} borderRadius={4} />
        </div>
      )}
      <div className={styles.skeletonCardContent}>
        <SkeletonText lines={contentLines} />
      </div>
    </div>
  );
};

/**
 * Table skeleton
 */
export const SkeletonTable: React.FC<{
  rows?: number;
  columns?: number;
  showHeader?: boolean;
}> = ({ rows = 5, columns = 4, showHeader = true }) => {
  return (
    <div className={styles.skeletonTable}>
      {showHeader && (
        <div className={styles.skeletonTableHeader}>
          {Array.from({ length: columns }).map((_, i) => (
            <Skeleton key={i} height={20} width={`${100 / columns}%`} />
          ))}
        </div>
      )}
      <div className={styles.skeletonTableBody}>
        {Array.from({ length: rows }).map((_, rowIndex) => (
          <div key={rowIndex} className={styles.skeletonTableRow}>
            {Array.from({ length: columns }).map((_, colIndex) => (
              <Skeleton
                key={colIndex}
                height={20}
                width={`${90 - Math.random() * 20}%`}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};

/**
 * Chart skeleton
 */
export const SkeletonChart: React.FC<{
  height?: number;
  showTitle?: boolean;
}> = ({ height = 300, showTitle = true }) => {
  return (
    <div className={styles.skeletonChart} style={{ height }}>
      {showTitle && (
        <div className={styles.skeletonChartHeader}>
          <Skeleton width={150} height={20} />
          <div style={{ display: 'flex', gap: 8 }}>
            <Skeleton width={60} height={20} />
            <Skeleton width={60} height={20} />
          </div>
        </div>
      )}
      <div className={styles.skeletonChartArea}>
        {/* Y-axis */}
        <div className={styles.skeletonChartYAxis}>
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} width={40} height={12} />
          ))}
        </div>
        {/* Chart area with wave effect */}
        <div className={styles.skeletonChartContent}>
          <div className={styles.skeletonChartWave} />
        </div>
      </div>
    </div>
  );
};

/**
 * List skeleton
 */
export const SkeletonList: React.FC<{
  items?: number;
  showAvatar?: boolean;
}> = ({ items = 5, showAvatar = true }) => {
  return (
    <div className={styles.skeletonList}>
      {Array.from({ length: items }).map((_, i) => (
        <div key={i} className={styles.skeletonListItem}>
          {showAvatar && <Skeleton width={40} height={40} borderRadius="50%" />}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <Skeleton height={16} width="60%" />
            <Skeleton height={12} width="40%" />
          </div>
        </div>
      ))}
    </div>
  );
};

/**
 * Page loading component with centered spinner
 */
export const PageLoader: React.FC<{ message?: string }> = ({ message = '加载中...' }) => (
  <div className={styles.pageLoader}>
    <Spin size={40} />
    <span className={styles.pageLoaderMessage}>{message}</span>
  </div>
);

/**
 * Section loading component
 */
export const SectionLoader: React.FC<{ height?: number | string }> = ({ height = 200 }) => (
  <div className={styles.sectionLoader} style={{ height }}>
    <Spin size={32} />
  </div>
);

export default Skeleton;