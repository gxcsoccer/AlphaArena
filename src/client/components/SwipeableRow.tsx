import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Button, Typography, Space } from '@arco-design/web-react';
import { IconDelete, IconEdit, IconCheck } from '@arco-design/web-react/icon';
import '../styles/touch-feedback.css';

const { Text } = Typography;

export interface SwipeAction {
  key: string;
  label: string;
  icon?: React.ReactNode;
  color?: string;
  backgroundColor?: string;
  onClick: () => void;
}

interface SwipeableRowProps {
  children: React.ReactNode;
  leftActions?: SwipeAction[];
  rightActions?: SwipeAction[];
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  disabled?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * SwipeableRow - A row component that reveals actions when swiped
 * 
 * Used for swipe-to-delete, swipe-to-edit, etc.
 * 
 * Usage:
 * ```tsx
 * <SwipeableRow
 *   rightActions={[
 *     { key: 'delete', label: '删除', icon: <IconDelete />, backgroundColor: '#f53f3f', onClick: handleDelete },
 *     { key: 'edit', label: '编辑', icon: <IconEdit />, backgroundColor: '#165dff', onClick: handleEdit },
 *   ]}
 * >
 *   <div>Content here</div>
 * </SwipeableRow>
 * ```
 */
const SwipeableRow: React.FC<SwipeableRowProps> = ({
  children,
  leftActions = [],
  rightActions = [],
  disabled = false,
  className = '',
  style,
}) => {
  const [translateX, setTranslateX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [revealedSide, setRevealedSide] = useState<'left' | 'right' | null>(null);
  
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const lastTranslateX = useRef(0);
  const isHorizontalSwipe = useRef<boolean | null>(null);
  const rowRef = useRef<HTMLDivElement>(null);
  
  const ACTION_WIDTH = 80; // Width of each action button
  const THRESHOLD = ACTION_WIDTH * 0.5; // Threshold to reveal actions
  
  // Default actions if not provided
  const defaultRightActions: SwipeAction[] = rightActions.length > 0 ? rightActions : [
    {
      key: 'delete',
      label: '删除',
      icon: <IconDelete />,
      backgroundColor: '#f53f3f',
      color: 'white',
      onClick: () => {},
    },
  ];
  
  const defaultLeftActions: SwipeAction[] = leftActions.length > 0 ? leftActions : [];
  
  // Calculate max reveal distance
  const maxLeftReveal = defaultLeftActions.length * ACTION_WIDTH;
  const maxRightReveal = defaultRightActions.length * ACTION_WIDTH;
  
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (disabled) return;
    
    const touch = e.touches[0];
    touchStartX.current = touch.clientX;
    touchStartY.current = touch.clientY;
    lastTranslateX.current = translateX;
    isHorizontalSwipe.current = null;
    setIsDragging(true);
  }, [disabled, translateX]);
  
  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (disabled || !isDragging) return;
    
    const touch = e.touches[0];
    const deltaX = touch.clientX - touchStartX.current;
    const deltaY = touch.clientY - touchStartY.current;
    
    // Determine swipe direction on first move
    if (isHorizontalSwipe.current === null) {
      isHorizontalSwipe.current = Math.abs(deltaX) > Math.abs(deltaY);
    }
    
    // Only handle horizontal swipes
    if (!isHorizontalSwipe.current) return;
    
    // Prevent vertical scroll during horizontal swipe
    e.preventDefault();
    
    // Calculate new translate position
    let newTranslateX = lastTranslateX.current + deltaX;
    
    // Apply resistance at boundaries
    if (newTranslateX > maxLeftReveal) {
      newTranslateX = maxLeftReveal + (newTranslateX - maxLeftReveal) * 0.3;
    } else if (newTranslateX < -maxRightReveal) {
      newTranslateX = -maxRightReveal + (newTranslateX + maxRightReveal) * 0.3;
    }
    
    setTranslateX(newTranslateX);
  }, [disabled, isDragging, maxLeftReveal, maxRightReveal]);
  
  const handleTouchEnd = useCallback(() => {
    if (disabled || !isDragging) return;
    
    setIsDragging(false);
    
    // Determine final position based on threshold
    if (translateX > THRESHOLD && defaultLeftActions.length > 0) {
      // Reveal left actions
      setTranslateX(maxLeftReveal);
      setRevealedSide('left');
    } else if (translateX < -THRESHOLD && defaultRightActions.length > 0) {
      // Reveal right actions
      setTranslateX(-maxRightReveal);
      setRevealedSide('right');
    } else {
      // Snap back
      setTranslateX(0);
      setRevealedSide(null);
    }
  }, [disabled, isDragging, translateX, THRESHOLD, maxLeftReveal, maxRightReveal, defaultLeftActions.length, defaultRightActions.length]);
  
  // Close revealed actions when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (rowRef.current && !rowRef.current.contains(e.target as Node) && revealedSide) {
        setTranslateX(0);
        setRevealedSide(null);
      }
    };
    
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [revealedSide]);
  
  // Handle action click
  const handleActionClick = useCallback((action: SwipeAction) => {
    action.onClick();
    setTranslateX(0);
    setRevealedSide(null);
  }, []);
  
  // Render action buttons
  const renderActions = (actions: SwipeAction[], side: 'left' | 'right') => {
    if (actions.length === 0) return null;
    
    return (
      <div
        className={`swipe-actions__${side}`}
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          display: 'flex',
          [side === 'left' ? 'right' : 'left']: '100%',
          [side === 'left' ? 'marginRight' : 'marginLeft']: side === 'left' ? -actions.length * ACTION_WIDTH : 0,
        }}
      >
        {actions.map((action, index) => (
          <Button
            key={action.key}
            style={{
              width: ACTION_WIDTH,
              height: '100%',
              borderRadius: 0,
              backgroundColor: action.backgroundColor || 'var(--color-primary)',
              color: action.color || 'white',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 4,
            }}
            onClick={() => handleActionClick(action)}
          >
            {action.icon}
            <Text style={{ color: action.color || 'white', fontSize: 12 }}>
              {action.label}
            </Text>
          </Button>
        ))}
      </div>
    );
  };
  
  return (
    <div
      ref={rowRef}
      className={`swipe-actions ${className}`}
      style={{
        position: 'relative',
        overflow: 'hidden',
        ...style,
      }}
    >
      {/* Left actions */}
      {renderActions(defaultLeftActions, 'left')}
      
      {/* Right actions */}
      {renderActions(defaultRightActions, 'right')}
      
      {/* Main content */}
      <div
        className="swipe-actions__content"
        style={{
          transform: `translateX(${translateX}px)`,
          transition: isDragging ? 'none' : 'transform 0.2s ease',
          touchAction: 'pan-y',
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {children}
      </div>
    </div>
  );
};

export default SwipeableRow;