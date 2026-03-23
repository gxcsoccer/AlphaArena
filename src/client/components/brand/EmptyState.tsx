/**
 * Empty State Illustrations Component
 * 
 * Issue #572: Brand Visual Elements
 * 
 * Professional empty state illustrations for different scenarios:
 * - No trades
 * - No holdings
 * - No strategies
 * - No notifications
 * - Search no results
 * - Error pages
 */

import React from 'react';

export type EmptyStateType =
  | 'no-trades'
  | 'no-holdings'
  | 'no-strategies'
  | 'no-notifications'
  | 'no-results'
  | 'no-data'
  | 'no-portfolio'
  | 'no-orders';

export interface EmptyStateIllustrationProps {
  type: EmptyStateType;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  style?: React.CSSProperties;
}

const sizeConfig = {
  sm: { width: 120, height: 120 },
  md: { width: 200, height: 200 },
  lg: { width: 280, height: 280 },
};

/**
 * Trading Chart Empty State
 */
const NoTradesIllustration: React.FC<{ size: { width: number; height: number } }> = ({ size }) => (
  <svg
    width={size.width}
    height={size.height}
    viewBox="0 0 200 200"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    {/* Chart frame */}
    <rect x="30" y="30" width="140" height="100" rx="8" fill="var(--color-fill-1)" stroke="var(--color-border-1)" strokeWidth="2" />
    
    {/* Grid lines */}
    <path d="M50 130V50M80 130V50M110 130V50M140 130V50" stroke="var(--color-border-1)" strokeWidth="1" opacity="0.5" />
    <path d="M30 70H170M30 90H170M30 110H170" stroke="var(--color-border-1)" strokeWidth="1" opacity="0.5" />
    
    {/* Dashed line indicating no data */}
    <path d="M50 100Q90 80 130 100" stroke="var(--color-text-3)" strokeWidth="2" strokeDasharray="6 4" fill="none" />
    
    {/* Question mark */}
    <circle cx="100" cy="85" r="20" fill="var(--color-bg-1)" stroke="var(--color-primary-300)" strokeWidth="2" />
    <text x="100" y="92" textAnchor="middle" fill="var(--color-text-3)" fontSize="20" fontFamily="system-ui">?</text>
    
    {/* Decorative elements */}
    <circle cx="45" cy="45" r="3" fill="var(--color-primary-200)" />
    <circle cx="155" cy="45" r="3" fill="var(--color-secondary-200)" />
    
    {/* Plus icon - add first trade */}
    <circle cx="160" cy="140" r="16" fill="var(--color-primary-500)" opacity="0.9" />
    <path d="M160 134v12M154 140h12" stroke="white" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

/**
 * Portfolio/Holdings Empty State
 */
const NoHoldingsIllustration: React.FC<{ size: { width: number; height: number } }> = ({ size }) => (
  <svg
    width={size.width}
    height={size.height}
    viewBox="0 0 200 200"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    {/* Wallet shape */}
    <rect x="40" y="50" width="120" height="80" rx="8" fill="var(--color-fill-1)" stroke="var(--color-border-1)" strokeWidth="2" />
    <rect x="40" y="50" width="120" height="25" rx="8" fill="var(--color-primary-100)" />
    
    {/* Coin slots - empty */}
    <circle cx="80" cy="95" r="12" fill="var(--color-bg-1)" stroke="var(--color-border-2)" strokeWidth="2" strokeDasharray="4 2" />
    <circle cx="120" cy="95" r="12" fill="var(--color-bg-1)" stroke="var(--color-border-2)" strokeWidth="2" strokeDasharray="4 2" />
    
    {/* Floating coin */}
    <g transform="translate(145, 55)">
      <circle cx="0" cy="0" r="18" fill="var(--color-warning-100)" stroke="var(--color-warning-400)" strokeWidth="2" />
      <text x="0" y="5" textAnchor="middle" fill="var(--color-warning-600)" fontSize="14" fontWeight="bold">$</text>
    </g>
    
    {/* Sparkles */}
    <path d="M55 40l2 4 4 2-4 2-2 4-2-4-4-2 4-2z" fill="var(--color-secondary-300)" />
    <path d="M170 100l1.5 3 3 1.5-3 1.5-1.5 3-1.5-3-3-1.5 3-1.5z" fill="var(--color-primary-300)" />
    
    {/* Arrow pointing to wallet */}
    <path d="M30 140l10-15 10 15" stroke="var(--color-text-3)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    <line x1="40" y1="125" x2="40" y2="145" stroke="var(--color-text-3)" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

/**
 * Strategy Empty State
 */
const NoStrategiesIllustration: React.FC<{ size: { width: number; height: number } }> = ({ size }) => (
  <svg
    width={size.width}
    height={size.height}
    viewBox="0 0 200 200"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    {/* Brain/AI shape */}
    <ellipse cx="100" cy="75" rx="50" ry="40" fill="var(--color-secondary-50)" stroke="var(--color-secondary-300)" strokeWidth="2" />
    
    {/* Neural network nodes */}
    <circle cx="80" cy="65" r="6" fill="var(--color-primary-400)" />
    <circle cx="100" cy="55" r="6" fill="var(--color-secondary-400)" />
    <circle cx="120" cy="65" r="6" fill="var(--color-primary-400)" />
    <circle cx="90" cy="85" r="6" fill="var(--color-secondary-400)" />
    <circle cx="110" cy="85" r="6" fill="var(--color-primary-400)" />
    
    {/* Connection lines */}
    <path d="M80 65L100 55M100 55L120 65M80 65L90 85M90 85L110 85M110 85L120 65" stroke="var(--color-border-1)" strokeWidth="1.5" />
    
    {/* Code/algorithm block */}
    <rect x="60" y="130" width="80" height="45" rx="6" fill="var(--color-fill-1)" stroke="var(--color-border-1)" strokeWidth="2" />
    <line x1="75" y1="145" x2="125" y2="145" stroke="var(--color-primary-400)" strokeWidth="3" strokeLinecap="round" />
    <line x1="75" y1="155" x2="105" y2="155" stroke="var(--color-secondary-400)" strokeWidth="3" strokeLinecap="round" />
    <line x1="75" y1="165" x2="115" y2="165" stroke="var(--color-text-3)" strokeWidth="3" strokeLinecap="round" />
    
    {/* Plus icon */}
    <circle cx="155" cy="40" r="14" fill="var(--color-primary-500)" />
    <path d="M155 34v12M149 40h12" stroke="white" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

/**
 * Notifications Empty State
 */
const NoNotificationsIllustration: React.FC<{ size: { width: number; height: number } }> = ({ size }) => (
  <svg
    width={size.width}
    height={size.height}
    viewBox="0 0 200 200"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    {/* Bell shape */}
    <path d="M100 35c-20 0-35 16-35 36v30l-12 20v5h94v-5l-12-20V71c0-20-15-36-35-36z" fill="var(--color-fill-1)" stroke="var(--color-border-1)" strokeWidth="2" />
    <ellipse cx="100" cy="130" rx="18" ry="8" fill="var(--color-fill-1)" stroke="var(--color-border-1)" strokeWidth="2" />
    
    {/* No notification indicator */}
    <circle cx="100" cy="75" r="15" fill="var(--color-success-100)" stroke="var(--color-success-400)" strokeWidth="2" />
    <path d="M93 75l5 5 9-10" stroke="var(--color-success-500)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    
    {/* Zzz - sleeping/quiet */}
    <text x="140" y="50" fill="var(--color-text-3)" fontSize="16" fontFamily="system-ui" opacity="0.6">z</text>
    <text x="150" y="40" fill="var(--color-text-3)" fontSize="14" fontFamily="system-ui" opacity="0.5">z</text>
    <text x="158" y="32" fill="var(--color-text-3)" fontSize="12" fontFamily="system-ui" opacity="0.4">z</text>
    
    {/* Stars/sparkles */}
    <path d="M55 55l2 4 4 2-4 2-2 4-2-4-4-2 4-2z" fill="var(--color-warning-300)" />
  </svg>
);

/**
 * Search No Results Empty State
 */
const NoResultsIllustration: React.FC<{ size: { width: number; height: number } }> = ({ size }) => (
  <svg
    width={size.width}
    height={size.height}
    viewBox="0 0 200 200"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    {/* Magnifying glass */}
    <circle cx="85" cy="85" r="40" fill="var(--color-fill-1)" stroke="var(--color-border-1)" strokeWidth="3" />
    <line x1="115" y1="115" x2="155" y2="155" stroke="var(--color-border-1)" strokeWidth="6" strokeLinecap="round" />
    
    {/* X mark inside */}
    <path d="M70 70L100 100M100 70L70 100" stroke="var(--color-text-3)" strokeWidth="3" strokeLinecap="round" />
    
    {/* Question marks */}
    <text x="145" y="65" fill="var(--color-text-3)" fontSize="20" fontFamily="system-ui" opacity="0.6">?</text>
    <text x="35" y="120" fill="var(--color-text-3)" fontSize="16" fontFamily="system-ui" opacity="0.4">?</text>
    
    {/* Floating elements */}
    <circle cx="40" cy="50" r="4" fill="var(--color-primary-200)" />
    <circle cx="165" cy="90" r="3" fill="var(--color-secondary-200)" />
    <circle cx="150" cy="175" r="4" fill="var(--color-primary-200)" />
  </svg>
);

/**
 * Generic No Data Empty State
 */
const NoDataIllustration: React.FC<{ size: { width: number; height: number } }> = ({ size }) => (
  <svg
    width={size.width}
    height={size.height}
    viewBox="0 0 200 200"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    {/* Document shape */}
    <rect x="50" y="30" width="100" height="130" rx="8" fill="var(--color-fill-1)" stroke="var(--color-border-1)" strokeWidth="2" />
    
    {/* Lines indicating text */}
    <line x1="65" y1="55" x2="135" y2="55" stroke="var(--color-border-2)" strokeWidth="3" strokeLinecap="round" />
    <line x1="65" y1="75" x2="120" y2="75" stroke="var(--color-border-2)" strokeWidth="3" strokeLinecap="round" />
    <line x1="65" y1="95" x2="135" y2="95" stroke="var(--color-border-2)" strokeWidth="3" strokeLinecap="round" />
    
    {/* Empty circle indicator */}
    <circle cx="100" cy="130" r="15" fill="var(--color-bg-1)" stroke="var(--color-text-3)" strokeWidth="2" strokeDasharray="4 2" />
    
    {/* Floating dots */}
    <circle cx="30" cy="80" r="4" fill="var(--color-primary-200)" />
    <circle cx="175" cy="70" r="3" fill="var(--color-secondary-200)" />
    <circle cx="170" cy="150" r="5" fill="var(--color-primary-200)" />
  </svg>
);

/**
 * Portfolio Empty State
 */
const NoPortfolioIllustration: React.FC<{ size: { width: number; height: number } }> = ({ size }) => (
  <svg
    width={size.width}
    height={size.height}
    viewBox="0 0 200 200"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    {/* Pie chart outline */}
    <circle cx="100" cy="90" r="50" fill="var(--color-fill-1)" stroke="var(--color-border-1)" strokeWidth="2" />
    
    {/* Empty slices */}
    <path d="M100 90L100 40A50 50 0 0 1 143 115Z" fill="var(--color-bg-1)" stroke="var(--color-border-1)" strokeWidth="1" strokeDasharray="4 2" />
    <path d="M100 90L143 115A50 50 0 0 1 70 135Z" fill="var(--color-bg-1)" stroke="var(--color-border-1)" strokeWidth="1" strokeDasharray="4 2" />
    
    {/* Center dot */}
    <circle cx="100" cy="90" r="8" fill="var(--color-bg-1)" stroke="var(--color-text-3)" strokeWidth="2" />
    
    {/* Plus button */}
    <circle cx="145" cy="55" r="16" fill="var(--color-primary-500)" />
    <path d="M145 49v12M139 55h12" stroke="white" strokeWidth="2" strokeLinecap="round" />
    
    {/* Labels */}
    <circle cx="35" cy="170" r="6" fill="var(--color-primary-300)" />
    <line x1="45" y1="170" x2="75" y2="170" stroke="var(--color-text-3)" strokeWidth="2" strokeLinecap="round" />
    
    <circle cx="110" cy="170" r="6" fill="var(--color-secondary-300)" />
    <line x1="120" y1="170" x2="150" y2="170" stroke="var(--color-text-3)" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

/**
 * Orders Empty State
 */
const NoOrdersIllustration: React.FC<{ size: { width: number; height: number } }> = ({ size }) => (
  <svg
    width={size.width}
    height={size.height}
    viewBox="0 0 200 200"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    {/* Order ticket */}
    <rect x="45" y="35" width="110" height="100" rx="6" fill="var(--color-fill-1)" stroke="var(--color-border-1)" strokeWidth="2" />
    
    {/* Order lines */}
    <rect x="60" y="55" width="80" height="8" rx="2" fill="var(--color-border-2)" />
    <rect x="60" y="75" width="50" height="8" rx="2" fill="var(--color-border-2)" />
    <rect x="60" y="95" width="65" height="8" rx="2" fill="var(--color-border-2)" />
    
    {/* Arrow up/buy */}
    <g transform="translate(50, 155)">
      <circle cx="25" cy="15" r="20" fill="var(--color-success-100)" stroke="var(--color-success-400)" strokeWidth="2" />
      <path d="M25 8v14M18 15l7-7 7 7" stroke="var(--color-success-500)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </g>
    
    {/* Arrow down/sell */}
    <g transform="translate(100, 155)">
      <circle cx="25" cy="15" r="20" fill="var(--color-error-100)" stroke="var(--color-error-400)" strokeWidth="2" />
      <path d="M25 22v-14M18 15l7 7 7-7" stroke="var(--color-error-500)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </g>
  </svg>
);

const illustrationMap: Record<EmptyStateType, React.FC<{ size: { width: number; height: number } }>> = {
  'no-trades': NoTradesIllustration,
  'no-holdings': NoHoldingsIllustration,
  'no-strategies': NoStrategiesIllustration,
  'no-notifications': NoNotificationsIllustration,
  'no-results': NoResultsIllustration,
  'no-data': NoDataIllustration,
  'no-portfolio': NoPortfolioIllustration,
  'no-orders': NoOrdersIllustration,
};

export const EmptyStateIllustration: React.FC<EmptyStateIllustrationProps> = ({
  type,
  size = 'md',
  className = '',
  style,
}) => {
  const Illustration = illustrationMap[type];
  const dimensions = sizeConfig[size];

  return (
    <div
      className={`empty-state-illustration ${className}`}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        ...style,
      }}
      role="img"
      aria-label={`${type} illustration`}
    >
      <Illustration size={dimensions} />
    </div>
  );
};

export default EmptyStateIllustration;