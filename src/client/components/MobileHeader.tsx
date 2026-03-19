import React from 'react';
import { Button, Space, Badge } from '@arco-design/web-react';
import {
  IconMenu,
  IconBell,
  IconSettings,
  IconUser,
} from '@arco-design/web-react/icon';
import ThemeToggle from './ThemeToggle';
import './MobileHeader.css';

interface MobileHeaderProps {
  title?: string;
  onMenuClick: () => void;
  notificationCount?: number;
  showUser?: boolean;
}

/**
 * MobileHeader - Optimized header component for mobile devices
 * 
 * Features:
 * - Hamburger menu button
 * - Title with logo
 * - Quick action buttons (notifications, settings, theme)
 * - Touch-optimized button sizes (min 44px)
 */
const MobileHeader: React.FC<MobileHeaderProps> = ({
  title = 'AlphaArena',
  onMenuClick,
  notificationCount = 0,
  showUser = true,
}) => {
  return (
    <header className="mobile-header" role="banner">
      <div className="mobile-header__left">
        <Button
          type="text"
          icon={<IconMenu />}
          onClick={onMenuClick}
          className="mobile-header__menu-btn"
          aria-label="打开导航菜单"
        />
        <h1 className="mobile-header__title">{title}</h1>
      </div>
      
      <div className="mobile-header__right">
        <Space size={4}>
          <ThemeToggle compact />
          
          <Button
            type="text"
            icon={
              <Badge count={notificationCount} dot={notificationCount > 0}>
                <IconBell />
              </Badge>
            }
            className="mobile-header__action-btn"
            aria-label={`通知${notificationCount > 0 ? ` (${notificationCount}条未读)` : ''}`}
          />
          
          {showUser && (
            <Button
              type="text"
              icon={<IconUser />}
              className="mobile-header__action-btn"
              aria-label="用户菜单"
            />
          )}
        </Space>
      </div>
    </header>
  );
};

export default MobileHeader;