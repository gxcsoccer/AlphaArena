/**
 * Brand Components Index
 * 
 * Issue #572: Brand Visual Elements
 * 
 * Export all brand-related components:
 * - Logo
 * - Empty State Illustrations
 * - Error Pages
 * - Loading Animations
 */

export { Logo, LogoIcon, HeaderLogo } from './Logo';
export type { LogoProps } from './Logo';

export { EmptyStateIllustration } from './EmptyState';
export type { EmptyStateType, EmptyStateIllustrationProps } from './EmptyState';

export {
  NotFoundPage,
  ServerErrorPage,
  NetworkErrorPage,
  PermissionDeniedPage,
  ErrorFallback,
} from './ErrorPages';

// Re-export LoadingIndicator from existing component
export {
  default as LoadingIndicator,
  PageLoading,
  SectionLoading,
  InlineLoading,
  ButtonLoading,
  SkeletonLoading,
} from '../LoadingIndicator';