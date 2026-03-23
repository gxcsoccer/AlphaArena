/**
 * PageTransition Component
 * 
 * Issue #571: 交互体验优化 - 页面过渡动效
 * 
 * 提供页面切换时的平滑过渡效果
 */

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useLocation } from 'react-router-dom';

type TransitionType = 'fade' | 'slide' | 'scale' | 'none';

interface PageTransitionProps {
  children: React.ReactNode;
  /** 过渡类型 */
  type?: TransitionType;
  /** 过渡持续时间（毫秒） */
  duration?: number;
  /** 是否在首次加载时跳过动画 */
  skipFirstTransition?: boolean;
  /** 进入动画完成回调 */
  onEnterComplete?: () => void;
  /** 退出动画完成回调 */
  onExitComplete?: () => void;
  /** 自定义类名 */
  className?: string;
  /** 自定义样式 */
  style?: React.CSSProperties;
}

interface PageTransitionState {
  status: 'entering' | 'entered' | 'exiting' | 'exited';
  childKey: string;
}

/**
 * PageTransition 组件
 * 
 * 包装页面内容，提供切换过渡动画
 */
const PageTransition: React.FC<PageTransitionProps> = ({
  children,
  type = 'fade',
  duration = 300,
  skipFirstTransition = true,
  onEnterComplete,
  onExitComplete,
  className = '',
  style,
}) => {
  const location = useLocation();
  const isFirstRender = useRef(skipFirstTransition);
  const [state, setState] = useState<PageTransitionState>({
    status: isFirstRender.current ? 'entered' : 'entering',
    childKey: location.pathname,
  });
  const [prevChildren, setPrevChildren] = useState<React.ReactNode>(null);
  const [currentChildren, setCurrentChildren] = useState<React.ReactNode>(children);

  // 获取过渡样式类名
  const getTransitionClass = useCallback((status: string) => {
    if (type === 'none') return '';
    return `page-${type}-${status}`;
  }, [type]);

  // 获取内联样式
  const getTransitionStyle = useCallback((status: string): React.CSSProperties => {
    if (type === 'none') return {};
    
    const baseStyle: React.CSSProperties = {
      transitionDuration: `${duration}ms`,
    };

    switch (status) {
      case 'entering':
        return {
          ...baseStyle,
          opacity: 0,
          transform: type === 'slide' ? 'translateX(30px)' : type === 'scale' ? 'scale(0.95)' : undefined,
        };
      case 'entered':
        return {
          ...baseStyle,
          opacity: 1,
          transform: 'translateX(0) scale(1)',
        };
      case 'exiting':
        return {
          ...baseStyle,
          opacity: 1,
          transform: 'translateX(0) scale(1)',
        };
      case 'exited':
        return {
          ...baseStyle,
          opacity: 0,
          transform: type === 'slide' ? 'translateX(-30px)' : type === 'scale' ? 'scale(1.05)' : undefined,
        };
      default:
        return baseStyle;
    }
  }, [type, duration]);

  // 处理路由变化
  useEffect(() => {
    if (location.pathname === state.childKey) return;

    if (isFirstRender.current) {
      isFirstRender.current = false;
      setState({
        status: 'entered',
        childKey: location.pathname,
      });
      setCurrentChildren(children);
      return;
    }

    // 开始退出动画
    setState(prev => ({ ...prev, status: 'exiting' }));
    setPrevChildren(currentChildren);

    // 退出动画完成后，开始进入动画
    const exitTimer = setTimeout(() => {
      onExitComplete?.();
      setState({
        status: 'entering',
        childKey: location.pathname,
      });
      setCurrentChildren(children);

      // 进入动画完成
      requestAnimationFrame(() => {
        setState(prev => ({ ...prev, status: 'entered' }));
        
        const enterTimer = setTimeout(() => {
          onEnterComplete?.();
          setPrevChildren(null);
        }, duration);

        return () => clearTimeout(enterTimer);
      });
    }, duration);

    return () => clearTimeout(exitTimer);
  }, [location.pathname, children, duration, onEnterComplete, onExitComplete, currentChildren, state.childKey]);

  // 首次渲染
  useEffect(() => {
    if (!isFirstRender.current && state.status === 'entering') {
      requestAnimationFrame(() => {
        setState(prev => ({ ...prev, status: 'entered' }));
      });
    }
  }, [state.status]);

  return (
    <div 
      className={`page-transition-container ${className}`.trim()}
      style={style}
    >
      {/* 退出的页面 */}
      {prevChildren && state.status === 'exiting' && (
        <div
          className={`page-wrapper ${getTransitionClass('exit-active')}`}
          style={getTransitionStyle('exiting')}
          aria-hidden="true"
        >
          {prevChildren}
        </div>
      )}

      {/* 当前页面 */}
      <div
        className={`page-wrapper ${getTransitionClass(state.status === 'entered' ? 'enter-active' : '')}`}
        style={getTransitionStyle(state.status)}
        key={state.childKey}
        role="main"
      >
        {currentChildren}
      </div>

      <style>{`
        .page-transition-container {
          position: relative;
          width: 100%;
          height: 100%;
        }
        
        .page-wrapper {
          position: relative;
          width: 100%;
          transition: opacity ${duration}ms ease-in-out,
                      transform ${duration}ms ease-in-out;
        }
        
        .page-fade-entering {
          opacity: 0;
        }
        
        .page-fade-enter-active,
        .page-fade-entered {
          opacity: 1;
        }
        
        .page-fade-exiting {
          opacity: 1;
        }
        
        .page-fade-exit-active {
          opacity: 0;
        }
        
        .page-slide-entering {
          opacity: 0;
          transform: translateX(30px);
        }
        
        .page-slide-enter-active,
        .page-slide-entered {
          opacity: 1;
          transform: translateX(0);
        }
        
        .page-slide-exiting {
          opacity: 1;
          transform: translateX(0);
        }
        
        .page-slide-exit-active {
          opacity: 0;
          transform: translateX(-30px);
        }
        
        .page-scale-entering {
          opacity: 0;
          transform: scale(0.95);
        }
        
        .page-scale-enter-active,
        .page-scale-entered {
          opacity: 1;
          transform: scale(1);
        }
        
        .page-scale-exiting {
          opacity: 1;
          transform: scale(1);
        }
        
        .page-scale-exit-active {
          opacity: 0;
          transform: scale(1.05);
        }
      `}</style>
    </div>
  );
};

export default PageTransition;

/**
 * FadeTransition 组件
 * 简单的淡入淡出过渡
 */
export const FadeTransition: React.FC<{
  children: React.ReactNode;
  visible: boolean;
  duration?: number;
  onTransitionEnd?: () => void;
}> = ({ children, visible, duration = 300, onTransitionEnd }) => {
  return (
    <div
      style={{
        opacity: visible ? 1 : 0,
        transition: `opacity ${duration}ms ease-in-out`,
        pointerEvents: visible ? 'auto' : 'none',
      }}
      onTransitionEnd={onTransitionEnd}
    >
      {children}
    </div>
  );
};

/**
 * SlideTransition 组件
 * 滑动过渡效果
 */
export const SlideTransition: React.FC<{
  children: React.ReactNode;
  visible: boolean;
  direction?: 'left' | 'right' | 'up' | 'down';
  duration?: number;
  onTransitionEnd?: () => void;
}> = ({ children, visible, direction = 'left', duration = 300, onTransitionEnd }) => {
  const getTransform = () => {
    if (visible) return 'translateX(0) translateY(0)';
    
    switch (direction) {
      case 'left':
        return 'translateX(-100%)';
      case 'right':
        return 'translateX(100%)';
      case 'up':
        return 'translateY(-100%)';
      case 'down':
        return 'translateY(100%)';
      default:
        return 'translateX(0)';
    }
  };

  return (
    <div
      style={{
        transform: getTransform(),
        transition: `transform ${duration}ms ease-in-out`,
      }}
      onTransitionEnd={onTransitionEnd}
    >
      {children}
    </div>
  );
};

/**
 * ScaleTransition 组件
 * 缩放过渡效果
 */
export const ScaleTransition: React.FC<{
  children: React.ReactNode;
  visible: boolean;
  duration?: number;
  onTransitionEnd?: () => void;
}> = ({ children, visible, duration = 300, onTransitionEnd }) => {
  return (
    <div
      style={{
        transform: visible ? 'scale(1)' : 'scale(0)',
        opacity: visible ? 1 : 0,
        transition: `transform ${duration}ms ease-in-out, opacity ${duration}ms ease-in-out`,
      }}
      onTransitionEnd={onTransitionEnd}
    >
      {children}
    </div>
  );
};