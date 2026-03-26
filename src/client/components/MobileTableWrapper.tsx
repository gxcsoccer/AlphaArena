import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Typography } from '@arco-design/web-react';
import '../styles/touch-feedback.css';

const { Text } = Typography;

interface MobileTableWrapperProps {
  children: React.ReactNode;
  fixedFirstColumn?: boolean;
  minWidth?: number;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * MobileTableWrapper - Wraps tables for mobile-friendly horizontal scrolling
 * 
 * Features:
 * - Horizontal scroll with momentum
 * - Optional fixed first column
 * - Scroll position indicator
 * - Touch-optimized
 * 
 * Usage:
 * ```tsx
 * <MobileTableWrapper fixedFirstColumn minWidth={600}>
 *   <Table columns={columns} dataSource={data} />
 * </MobileTableWrapper>
 * ```
 */
const MobileTableWrapper: React.FC<MobileTableWrapperProps> = ({
  children,
  fixedFirstColumn = true,
  minWidth = 600,
  className = '',
  style,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const tableRef = useRef<HTMLTableElement | null>(null);
  const [scrollLeft, setScrollLeft] = useState(0);
  const [maxScroll, setMaxScroll] = useState(0);
  const [showScrollIndicator, setShowScrollIndicator] = useState(false);
  
  // Find the table element
  useEffect(() => {
    if (containerRef.current) {
      tableRef.current = containerRef.current.querySelector('table');
    }
  }, [children]);
  
  // Update scroll indicator
  const updateScrollIndicator = useCallback(() => {
    if (!containerRef.current) return;
    
    const { scrollLeft: currentScrollLeft, scrollWidth, clientWidth } = containerRef.current;
    setScrollLeft(currentScrollLeft);
    setMaxScroll(scrollWidth - clientWidth);
    setShowScrollIndicator(scrollWidth > clientWidth);
  }, []);
  
  // Set up scroll listener
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    
    container.addEventListener('scroll', updateScrollIndicator);
    window.addEventListener('resize', updateScrollIndicator);
    
    // Initial check
    updateScrollIndicator();
    
    return () => {
      container.removeEventListener('scroll', updateScrollIndicator);
      window.removeEventListener('resize', updateScrollIndicator);
    };
  }, [updateScrollIndicator]);
  
  // Apply fixed first column styles
  useEffect(() => {
    if (!fixedFirstColumn || !tableRef.current) return;
    
    const table = tableRef.current;
    const firstColumnCells = table.querySelectorAll('tr > *:first-child');
    
    firstColumnCells.forEach((cell) => {
      if (cell instanceof HTMLElement) {
        cell.style.position = 'sticky';
        cell.style.left = '0';
        cell.style.zIndex = '10';
        cell.style.backgroundColor = 'var(--color-bg-1)';
        
        // Add shadow effect
        if (scrollLeft > 0) {
          cell.style.boxShadow = '4px 0 8px rgba(0, 0, 0, 0.1)';
        } else {
          cell.style.boxShadow = 'none';
        }
      }
    });
  }, [fixedFirstColumn, scrollLeft, children]);
  
  // Calculate scroll progress
  const scrollProgress = maxScroll > 0 ? (scrollLeft / maxScroll) * 100 : 0;
  
  return (
    <div style={{ position: 'relative' }}>
      {/* Scroll indicator */}
      {showScrollIndicator && (
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: 3,
            backgroundColor: 'var(--color-fill-2)',
            zIndex: 20,
          }}
        >
          <div
            style={{
              position: 'absolute',
              left: `${scrollProgress}%`,
              width: 40,
              height: '100%',
              backgroundColor: 'var(--color-primary)',
              borderRadius: 2,
              transition: 'left 0.1s ease',
            }}
          />
        </div>
      )}
      
      {/* Scroll hint */}
      {showScrollIndicator && scrollLeft === 0 && (
        <div
          style={{
            position: 'absolute',
            right: 8,
            top: '50%',
            transform: 'translateY(-50%)',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            color: 'var(--color-text-3)',
            fontSize: 12,
            padding: '4px 8px',
            backgroundColor: 'var(--color-bg-2)',
            borderRadius: 4,
            boxShadow: 'var(--shadow-1)',
            zIndex: 15,
            animation: 'fade-in 0.3s ease',
          }}
        >
          <Text type="secondary" style={{ fontSize: 12 }}>
            滑动查看 →
          </Text>
        </div>
      )}
      
      {/* Table container */}
      <div
        ref={containerRef}
        className={`touch-scroll momentum-scroll ${className}`}
        style={{
          overflowX: 'auto',
          overflowY: 'hidden',
          WebkitOverflowScrolling: 'touch',
          minWidth: '100%',
          minHeight: 0, // Prevent flex issues
          paddingBottom: showScrollIndicator ? 12 : 0, // Space for indicator
          ...style,
        }}
      >
        <div style={{ minWidth }}>
          {children}
        </div>
      </div>
    </div>
  );
};

export default MobileTableWrapper;