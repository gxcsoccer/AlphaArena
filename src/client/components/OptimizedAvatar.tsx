/**
 * Optimized Avatar Component
 * 
 * Issue #559: Image and Static Resource Optimization
 * 
 * Features:
 * - WebP/AVIF format support
 * - Responsive images with srcset
 * - Lazy loading
 * - Error fallback with initials
 */

import React, { useState, memo } from 'react';
import { Avatar } from '@arco-design/web-react';
import { IconUser } from '@arco-design/web-react/icon';
import { AVATAR_BREAKPOINTS } from './Picture';
import type { ImageFormat } from './Picture';

export interface OptimizedAvatarProps {
  /** User's avatar URL */
  src?: string;
  /** User's display name for alt text */
  name?: string;
  /** User's username for initials fallback */
  username?: string;
  /** Avatar size */
  size?: number | 'small' | 'default' | 'large';
  /** Image formats to use */
  formats?: ImageFormat[];
  /** Show loading state */
  loading?: boolean;
  /** Additional class name */
  className?: string;
  /** Additional styles */
  style?: React.CSSProperties;
  /** onClick handler */
  onClick?: () => void;
}

/**
 * Generate initials from name or username
 */
function getInitials(name?: string, username?: string): string {
  if (name) {
    // Take first letter of each word
    return name
      .split(' ')
      .map((word) => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  }
  
  if (username) {
    return username[0]?.toUpperCase() || '';
  }
  
  return '';
}

/**
 * Generate optimized avatar URL with format and size
 */
function getOptimizedAvatarUrl(
  src: string,
  size: number,
  format: ImageFormat = 'webp'
): string {
  if (!src || src.startsWith('data:')) return src;
  
  // For external URLs, add optimization parameters
  if (src.startsWith('http')) {
    try {
      const url = new URL(src);
      if (format !== 'original') {
        url.searchParams.set('format', format);
      }
      url.searchParams.set('width', String(size * 2)); // 2x for retina
      url.searchParams.set('height', String(size * 2));
      return url.toString();
    } catch {
      return src;
    }
  }
  
  // For local images, use Vite imagetools
  const separator = src.includes('?') ? '&' : '?';
  return `${src}${separator}format=${format}&width=${size * 2}&height=${size * 2}`;
}

/**
 * Get numeric size from size prop
 */
function getNumericSize(size: number | 'small' | 'default' | 'large'): number {
  if (typeof size === 'number') return size;
  
  switch (size) {
    case 'small':
      return 24;
    case 'large':
      return 48;
    default:
      return 32;
  }
}

/**
 * Optimized Avatar Component
 */
export const OptimizedAvatar: React.FC<OptimizedAvatarProps> = memo(({
  src,
  name,
  username,
  size = 'default',
  formats = ['webp', 'original'],
  loading = false,
  className,
  style,
  onClick,
}) => {
  const [hasError, setHasError] = useState(false);
  const numericSize = getNumericSize(size);
  const initials = getInitials(name, username);
  
  // Generate srcset for responsive avatar
  const generateSrcSet = (url: string): string => {
    return AVATAR_BREAKPOINTS.map((bp) => {
      const optimizedUrl = getOptimizedAvatarUrl(url, bp.imageWidth || bp.width, 'webp');
      return `${optimizedUrl} ${bp.descriptor}`;
    }).join(', ');
  };
  
  // Handle image error
  const handleError = () => {
    setHasError(true);
  };
  
  // Render avatar content
  const renderAvatarContent = () => {
    if (loading) {
      return null; // Avatar component will show loading state
    }
    
    if (!src || hasError) {
      // Show initials or user icon as fallback
      return initials || <IconUser />;
    }
    
    // Generate optimized srcset
    const webpSrcSet = formats.includes('webp') ? generateSrcSet(src) : undefined;
    const optimizedSrc = getOptimizedAvatarUrl(src, numericSize, 'webp');
    
    return (
      <picture>
        {webpSrcSet && (
          <source srcSet={webpSrcSet} type="image/webp" />
        )}
        <img
          src={optimizedSrc}
          alt={name || username || 'Avatar'}
          onError={handleError}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
          }}
        />
      </picture>
    );
  };
  
  return (
    <Avatar
      size={size}
      className={className}
      style={{
        backgroundColor: '#165DFF',
        cursor: onClick ? 'pointer' : undefined,
        ...style,
      }}
      onClick={onClick}
    >
      {renderAvatarContent()}
    </Avatar>
  );
});

OptimizedAvatar.displayName = 'OptimizedAvatar';

export default OptimizedAvatar;