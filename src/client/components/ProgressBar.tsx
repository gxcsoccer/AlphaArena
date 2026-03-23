/**
 * ProgressBar Component
 * 
 * Issue #571: 交互体验优化 - 数据可视化动效
 * 
 * 进度条组件，支持多种样式和动画效果
 */

import React, { useEffect, useState, useRef } from 'react';

type ProgressBarType = 'line' | 'circle' | 'dashboard';
type ProgressBarStatus = 'normal' | 'success' | 'error' | 'warning';
type ProgressBarShape = 'round' | 'square';

interface BaseProgressProps {
  /** 当前进度（0-100） */
  percent: number;
  /** 进度条类型 */
  type?: ProgressBarType;
  /** 状态 */
  status?: ProgressBarStatus;
  /** 是否显示进度文字 */
  showText?: boolean;
  /** 进度条粗细 */
  strokeWidth?: number;
  /** 宽度（用于环形进度条） */
  width?: number;
  /** 自定义颜色 */
  strokeColor?: string | { [key: string]: string };
  /** 轨道颜色 */
  trailColor?: string;
  /** 是否显示条纹 */
  striped?: boolean;
  /** 是否显示动画（条纹流动） */
  animated?: boolean;
  /** 动画持续时间（毫秒） */
  duration?: number;
  /** 自定义类名 */
  className?: string;
  /** 自定义样式 */
  style?: React.CSSProperties;
  /** 完成回调 */
  onComplete?: () => void;
}

interface LineProgressProps extends BaseProgressProps {
  type?: 'line';
  /** 两端形状 */
  strokeLinecap?: ProgressBarShape;
}

interface CircleProgressProps extends BaseProgressProps {
  type: 'circle' | 'dashboard';
}

type ProgressProps = LineProgressProps | CircleProgressProps;

/**
 * 获取状态对应的颜色
 */
const getStatusColor = (status: ProgressBarStatus): string => {
  switch (status) {
    case 'success':
      return 'var(--color-success)';
    case 'error':
      return 'var(--color-danger)';
    case 'warning':
      return 'var(--color-warning)';
    default:
      return 'var(--color-primary)';
  }
};

/**
 * 线形进度条
 */
const LineProgress: React.FC<LineProgressProps> = ({
  percent,
  status = 'normal',
  showText = true,
  strokeWidth = 8,
  strokeLinecap = 'round',
  strokeColor,
  trailColor = 'var(--color-fill-2)',
  striped = false,
  animated = false,
  duration = 500,
  className = '',
  style,
  onComplete,
}) => {
  const [displayPercent, setDisplayPercent] = useState(0);
  const prevPercentRef = useRef(0);

  // 动画效果
  useEffect(() => {
    const startPercent = prevPercentRef.current;
    const startTime = performance.now();
    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const currentPercent = startPercent + (percent - startPercent) * progress;
      setDisplayPercent(currentPercent);
      
      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        setDisplayPercent(percent);
        prevPercentRef.current = percent;
        if (percent >= 100) {
          onComplete?.();
        }
      }
    };
    
    requestAnimationFrame(animate);
  }, [percent, duration, onComplete]);

  // 计算颜色
  const getStrokeColor = () => {
    if (strokeColor) {
      if (typeof strokeColor === 'string') {
        return strokeColor;
      }
      // 渐变色 - 找到最接近的颜色
      const keys = Object.keys(strokeColor).map(Number).sort((a, b) => a - b);
      for (let i = 0; i < keys.length - 1; i++) {
        if (displayPercent >= keys[i] && displayPercent < keys[i + 1]) {
          return strokeColor[keys[i]];
        }
      }
      return strokeColor[keys[keys.length - 1]];
    }
    return getStatusColor(status);
  };

  const color = getStrokeColor();

  return (
    <div
      className={`progress-bar progress-bar--line ${className}`.trim()}
      style={style}
    >
      <div
        className="progress-bar__track"
        style={{
          height: strokeWidth,
          background: trailColor,
          borderRadius: strokeLinecap === 'round' ? strokeWidth / 2 : 0,
          overflow: 'hidden',
        }}
      >
        <div
          className={`progress-bar__fill ${striped ? 'progress-bar__fill--striped' : ''} ${animated ? 'progress-bar__fill--animated' : ''}`}
          style={{
            width: `${Math.min(displayPercent, 100)}%`,
            height: '100%',
            background: color,
            borderRadius: strokeLinecap === 'round' ? strokeWidth / 2 : 0,
            transition: `width ${duration}ms ease-out`,
          }}
        />
      </div>
      
      {showText && (
        <span
          className="progress-bar__text"
          style={{
            marginLeft: 8,
            fontSize: 'var(--font-size-sm)',
            color: 'var(--color-text-1)',
            fontWeight: 500,
          }}
        >
          {Math.round(displayPercent)}%
        </span>
      )}
    </div>
  );
};

/**
 * 圆形进度条
 */
const CircleProgress: React.FC<CircleProgressProps> = ({
  percent,
  status = 'normal',
  showText = true,
  strokeWidth = 6,
  width = 120,
  strokeColor,
  trailColor = 'var(--color-fill-2)',
  duration = 500,
  className = '',
  style,
  type = 'circle',
  onComplete,
}) => {
  const [displayPercent, setDisplayPercent] = useState(0);
  const prevPercentRef = useRef(0);

  // 动画效果
  useEffect(() => {
    const startPercent = prevPercentRef.current;
    const startTime = performance.now();
    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const currentPercent = startPercent + (percent - startPercent) * progress;
      setDisplayPercent(currentPercent);
      
      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        setDisplayPercent(percent);
        prevPercentRef.current = percent;
        if (percent >= 100) {
          onComplete?.();
        }
      }
    };
    
    requestAnimationFrame(animate);
  }, [percent, duration, onComplete]);

  const radius = (width - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  
  // 对于 dashboard 类型，从底部开始
  const rotation = type === 'dashboard' ? 90 : -90;
  const gapAngle = type === 'dashboard' ? 75 : 0;
  const gapRatio = gapAngle / 360;
  
  const strokeDasharray = type === 'dashboard' 
    ? `${(1 - gapRatio) * circumference} ${circumference}`
    : circumference;
  
  const strokeDashoffset = type === 'dashboard'
    ? circumference * (1 - gapRatio) * (1 - displayPercent / 100)
    : circumference * (1 - displayPercent / 100);

  const color = strokeColor || getStatusColor(status);

  return (
    <div
      className={`progress-bar progress-bar--circle ${className}`.trim()}
      style={{
        width,
        height: width,
        position: 'relative',
        ...style,
      }}
    >
      <svg
        viewBox={`0 0 ${width} ${width}`}
        style={{ width: '100%', height: '100%' }}
      >
        {/* 轨道 */}
        <circle
          cx={width / 2}
          cy={width / 2}
          r={radius}
          fill="none"
          stroke={trailColor}
          strokeWidth={strokeWidth}
          strokeDasharray={type === 'dashboard' ? strokeDasharray : undefined}
          strokeDashoffset={type === 'dashboard' ? 0 : undefined}
          style={{
            transform: `rotate(${rotation}deg)`,
            transformOrigin: 'center',
          }}
        />
        
        {/* 进度 */}
        <circle
          cx={width / 2}
          cy={width / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={strokeDasharray}
          strokeDashoffset={strokeDashoffset}
          style={{
            transform: `rotate(${rotation}deg)`,
            transformOrigin: 'center',
            transition: `stroke-dashoffset ${duration}ms ease-out`,
          }}
        />
      </svg>
      
      {showText && (
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            textAlign: 'center',
          }}
        >
          <span
            style={{
              fontSize: 'var(--font-size-xl)',
              fontWeight: 600,
              color: 'var(--color-text-1)',
            }}
          >
            {Math.round(displayPercent)}%
          </span>
        </div>
      )}
    </div>
  );
};

/**
 * ProgressBar 组件
 * 
 * 支持线形和圆形进度条
 */
const ProgressBar: React.FC<ProgressProps> = (props) => {
  if (props.type === 'circle' || props.type === 'dashboard') {
    return <CircleProgress {...props} />;
  }
  return <LineProgress {...props} />;
};

export default ProgressBar;

/**
 * IndeterminateProgress 组件
 * 不确定进度的加载条
 */
export const IndeterminateProgress: React.FC<{
  height?: number;
  color?: string;
  className?: string;
  style?: React.CSSProperties;
}> = ({ height = 4, color = 'var(--color-primary)', className = '', style }) => {
  return (
    <div
      className={`progress-indeterminate ${className}`.trim()}
      style={{
        height,
        background: 'var(--color-fill-2)',
        borderRadius: height / 2,
        overflow: 'hidden',
        ...style,
      }}
    >
      <div
        style={{
          height: '100%',
          background: `linear-gradient(90deg, transparent, ${color}, transparent)`,
          animation: 'progress-indeterminate 1.5s ease-in-out infinite',
        }}
      />
      
      <style>{`
        @keyframes progress-indeterminate {
          0% { transform: translateX(-100%); width: 50%; }
          100% { transform: translateX(300%); width: 50%; }
        }
      `}</style>
    </div>
  );
};

/**
 * StepProgress 组件
 * 步骤进度条
 */
export const StepProgress: React.FC<{
  steps: number;
  current: number;
  size?: number;
  strokeColor?: string;
  trailColor?: string;
  className?: string;
  style?: React.CSSProperties;
}> = ({
  steps,
  current,
  size = 8,
  strokeColor = 'var(--color-primary)',
  trailColor = 'var(--color-fill-2)',
  className = '',
  style,
}) => {
  return (
    <div
      className={`step-progress ${className}`.trim()}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: size / 2,
        ...style,
      }}
    >
      {Array.from({ length: steps }).map((_, index) => (
        <React.Fragment key={index}>
          <div
            style={{
              width: size,
              height: size,
              borderRadius: '50%',
              background: index < current ? strokeColor : trailColor,
              transition: 'background 0.3s ease',
            }}
          />
          {index < steps - 1 && (
            <div
              style={{
                flex: 1,
                height: 2,
                background: index < current - 1 ? strokeColor : trailColor,
                transition: 'background 0.3s ease',
              }}
            />
          )}
        </React.Fragment>
      ))}
    </div>
  );
};

/**
 * AnimatedNumber 组件
 * 带动画的数字显示
 */
export const AnimatedNumber: React.FC<{
  value: number;
  total?: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  className?: string;
  style?: React.CSSProperties;
}> = ({
  value,
  total,
  prefix = '',
  suffix = '',
  decimals = 0,
  className = '',
  style,
}) => {
  const percent = total ? Math.round((value / total) * 100) : 0;
  
  return (
    <span
      className={className}
      style={{
        fontVariantNumeric: 'tabular-nums',
        ...style,
      }}
    >
      {prefix}
      {value.toLocaleString(undefined, { maximumFractionDigits: decimals })}
      {total && (
        <span style={{ color: 'var(--color-text-3)', marginLeft: 4 }}>
          / {total.toLocaleString(undefined, { maximumFractionDigits: decimals })}
        </span>
      )}
      {suffix}
      {total && (
        <span style={{ color: 'var(--color-text-3)', marginLeft: 8 }}>
          ({percent}%)
        </span>
      )}
    </span>
  );
};