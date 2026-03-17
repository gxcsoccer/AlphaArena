import React from 'react';
import { Badge } from '@arco-design/web-react';
import {
  IconHome,
  IconDashboard,
  IconSwap,
  IconSafe,
  IconUser,
  IconApps,
  IconExperiment,
} from '@arco-design/web-react/icon';
import { useLocation, useNavigate } from 'react-router-dom';
import './MobileBottomNav.css';

interface NavItem {
  key: string;
  icon: React.ReactNode;
  label: string;
  badge?: number;
}

const navItems: NavItem[] = [
  { key: '/', icon: <IconHome />, label: '行情' },
  { key: '/dashboard', icon: <IconDashboard />, label: '仪表板' },
  { key: '/trades', icon: <IconSwap />, label: '交易' },
  { key: '/holdings', icon: <IconSafe />, label: '持仓' },
  { key: '/strategies', icon: <IconApps />, label: '策略' },
  { key: '/rebalance', icon: <IconExperiment />, label: '再平衡' },
  { key: '/user-dashboard', icon: <IconUser />, label: '我的' },
];

interface MobileBottomNavProps {
  visible?: boolean;
}

const MobileBottomNav: React.FC<MobileBottomNavProps> = ({ visible = true }) => {
  const location = useLocation();
  const navigate = useNavigate();

  if (!visible) return null;

  const handleNavClick = (key: string) => {
    navigate(key);
  };

  return (
    <nav className="mobile-bottom-nav" role="navigation" aria-label="移动端底部导航">
      {navItems.map((item) => {
        const isActive = location.pathname === item.key;
        return (
          <button
            key={item.key}
            className={`mobile-bottom-nav__item ${isActive ? 'mobile-bottom-nav__item--active' : ''}`}
            onClick={() => handleNavClick(item.key)}
            aria-label={item.label}
            aria-current={isActive ? 'page' : undefined}
          >
            <span className="mobile-bottom-nav__icon">
              {item.badge ? (
                <Badge count={item.badge} dot>
                  {item.icon}
                </Badge>
              ) : (
                item.icon
              )}
            </span>
            <span className="mobile-bottom-nav__label">{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
};

export default MobileBottomNav;
