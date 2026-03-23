/**
 * CountUp Component
 * 
 * Issue #571: 交互体验优化 - 数据可视化动效
 * 
 * 数字变化动画组件，用于展示数值的平滑过渡效果
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';

interface CountUpProps {
  /** 目标数值 */
  value: number;
  /** 起始数值 */
  startValue?: number;
  /** 动画持续时间（毫秒） */
  duration?: number;
  /** 小数位数 */
  decimals?: number;
  /** 小数分隔符 */
  decimalSeparator?: string;
  /** 千分位分隔符 */
  thousandSeparator?: string;
  /** 数值变化时的回调 */
  onValueChange?: (value: number) => void;
  /** 动画完成时的回调 */
  onAnimationEnd?: (value: number) => void;
  /** 前缀 */
  prefix?: string;
  /** 后缀 */
  suffix?: string;
  /** 自定义格式化函数 */
  formatter?: (value: number) => string;
  /** 是否在数值变化时显示闪烁效果 */
  flashOnChange?: boolean;
  /** 闪烁类型：increase（绿色）、decrease（红色）、auto（自动） */
  flashType?: 'increase' | 'decrease' | 'auto';
  /** 自定义类名 */
  className?: string;
  /** 自定义样式 */
  style?: React.CSSProperties;
  /** 是否使用中文单位（万、亿） */
  useChineseUnit?: boolean;
}

/**
 * 将数字格式化为中文单位
 */
function formatChineseUnit(value: number, decimals: number = 2): string {
  const absValue = Math.abs(value);
  
  if (absValue >= 100000000) {
    return (value / 100000000).toFixed(decimals) + '亿';
  } else if (absValue >= 10000) {
    return (value / 10000).toFixed(decimals) + '万';
  } else {
    return value.toFixed(decimals);
  }
}

/**
 * 格式化数字（添加千分位）
 */
function formatNumber(
  value: number,
  decimals: number,
  decimalSeparator: string,
  thousandSeparator: string
): string {
  const fixedValue = value.toFixed(decimals);
  const parts = fixedValue.split('.');
  
  // 添加千分位分隔符
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, thousandSeparator);
  
  return parts.join(decimalSeparator);
}

/**
 * CountUp 组件
 * 
 * 用于数值的平滑过渡动画，支持：
 * - 自定义动画持续时间
 * - 小数位数格式化
 * - 千分位分隔符
 * - 数值变化时的闪烁效果
 * - 中文单位（万、亿）
 * - 前缀和后缀
 */
const CountUp: React.FC<CountUpProps> = ({
  value,
  startValue,
  duration = 500,
  decimals = 0,
  decimalSeparator = '.',
  thousandSeparator = ',',
  onValueChange,
  onAnimationEnd,
  prefix = '',
  suffix = '',
  formatter,
  flashOnChange = false,
  flashType = 'auto',
  className = '',
  style,
  useChineseUnit = false,
}) => {
  const [displayValue, setDisplayValue] = useState(startValue ?? value);
  const [isFlashing, setIsFlashing] = useState(false);
  const [flashDirection, setFlashDirection] = useState<'increase' | 'decrease'>('increase');
  
  const animationRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const startValueRef = useRef(startValue ?? value);
  const previousValueRef = useRef(value);

  // 缓动函数（ease-out）
  const easeOut = useCallback((t: number): number => {
    return 1 - Math.pow(1 - t, 3);
  }, []);

  // 动画帧
  const animate = useCallback((currentTime: number) => {
    if (startTimeRef.current === null) {
      startTimeRef.current = currentTime;
    }

    const elapsed = currentTime - startTimeRef.current;
    const progress = Math.min(elapsed / duration, 1);
    const easedProgress = easeOut(progress);
    
    const currentValue = startValueRef.current + (value - startValueRef.current) * easedProgress;
    
    setDisplayValue(currentValue);
    onValueChange?.(currentValue);

    if (progress < 1) {
      animationRef.current = requestAnimationFrame(animate);
    } else {
      setDisplayValue(value);
      onAnimationEnd?.(value);
      animationRef.current = null;
      startTimeRef.current = null;
    }
  }, [value, duration, easeOut, onValueChange, onAnimationEnd]);

  // 当目标值变化时启动动画
  useEffect(() => {
    // 检测数值变化方向
    if (flashOnChange && previousValueRef.current !== value) {
      setFlashDirection(value > previousValueRef.current ? 'increase' : 'decrease');
      setIsFlashing(true);
      
      // 移除闪烁类
      const timer = setTimeout(() => {
        setIsFlashing(false);
      }, 500);
      
      previousValueRef.current = value;
      
      return () => clearTimeout(timer);
    }
  }, [value, flashOnChange]);

  // 启动动画
  useEffect(() => {
    startValueRef.current = displayValue;
    startTimeRef.current = null;
    
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }
    
    animationRef.current = requestAnimationFrame(animate);
    
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [value, animate]);

  // 格式化显示值
  const formattedValue = React.useMemo(() => {
    if (formatter) {
      return formatter(displayValue);
    }
    
    if (useChineseUnit) {
      return formatChineseUnit(displayValue, decimals);
    }
    
    return formatNumber(displayValue, decimals, decimalSeparator, thousandSeparator);
  }, [displayValue, formatter, useChineseUnit, decimals, decimalSeparator, thousandSeparator]);

  // 闪烁类名
  const flashClassName = React.useMemo(() => {
    if (!isFlashing) return '';
    
    const actualFlashType = flashType === 'auto' ? flashDirection : flashType;
    return actualFlashType === 'increase' 
      ? 'number-flash-increase' 
      : 'number-flash-decrease';
  }, [isFlashing, flashType, flashDirection]);

  return (
    <span 
      className={`count-up ${flashClassName} ${className}`.trim()}
      style={{
        fontVariantNumeric: 'tabular-nums',
        ...style,
      }}
    >
      {prefix}{formattedValue}{suffix}
    </span>
  );
};

export default CountUp;

/**
 * AnimatedPercentage 组件
 * 用于显示百分比变化的动画
 */
export const AnimatedPercentage: React.FC<{
  value: number;
  showSign?: boolean;
  duration?: number;
  className?: string;
  style?: React.CSSProperties;
}> = ({ value, showSign = true, duration = 500, className, style }) => {
  const isPositive = value >= 0;
  
  return (
    <CountUp
      value={Math.abs(value)}
      duration={duration}
      decimals={2}
      flashOnChange
      flashType="auto"
      prefix={showSign ? (isPositive ? '+' : '-') : ''}
      suffix="%"
      className={className}
      style={{
        color: isPositive ? 'var(--color-success)' : 'var(--color-danger)',
        ...style,
      }}
    />
  );
};

/**
 * AnimatedPrice 组件
 * 用于显示价格变化的动画
 */
export const AnimatedPrice: React.FC<{
  value: number;
  decimals?: number;
  currency?: string;
  duration?: number;
  className?: string;
  style?: React.CSSProperties;
}> = ({ value, decimals = 2, currency = '$', duration = 300, className, style }) => {
  return (
    <CountUp
      value={value}
      duration={duration}
      decimals={decimals}
      prefix={currency}
      thousandSeparator=","
      flashOnChange
      className={className}
      style={style}
    />
  );
};

/**
 * AnimatedVolume 组件
 * 用于显示交易量的动画（自动使用中文单位）
 */
export const AnimatedVolume: React.FC<{
  value: number;
  duration?: number;
  className?: string;
  style?: React.CSSProperties;
}> = ({ value, duration = 500, className, style }) => {
  return (
    <CountUp
      value={value}
      duration={duration}
      decimals={2}
      useChineseUnit
      flashOnChange
      className={className}
      style={style}
    />
  );
};