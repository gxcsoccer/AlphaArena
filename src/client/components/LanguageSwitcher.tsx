/**
 * Language Switcher Component
 * 
 * A dropdown-based language switcher that allows users to change the interface language.
 * 
 * Features:
 * - Dropdown menu with language options
 * - Current language indicator with globe icon
 * - Smooth transition animations
 * - Mobile-responsive design
 * - Keyboard accessible
 * 
 * Issue #586: 语言切换功能实现
 * Issue #598: Fixed dropdown click handling by using Arco Menu component
 */

import React, { useCallback, useEffect, useState } from 'react';
import { Dropdown, Button, Space, Tooltip, Menu } from '@arco-design/web-react';
import {
  IconLanguage,
  IconCheck,
} from '@arco-design/web-react/icon';
import { useNavigate, useLocation } from 'react-router-dom';
import { useLocaleContext, useLanguage, SupportedLanguage, SUPPORTED_LANGUAGES } from '../i18n/mod';
import { useAuth } from '../hooks/useAuth';
import { useTranslation } from 'react-i18next';
import './LanguageSwitcher.css';

interface LanguageSwitcherProps {
  /** Compact mode for mobile view */
  compact?: boolean;
  /** Show as icon-only button */
  iconOnly?: boolean;
}

/**
 * Language Switcher Component
 */
export function LanguageSwitcher({ compact = false, iconOnly = false }: LanguageSwitcherProps) {
  const { currentLanguage, changeLanguage, supportedLanguages } = useLocaleContext();
  const { t } = useTranslation('common');
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated } = useAuth();
  const [isChanging, setIsChanging] = useState(false);

  // Handle language change
  const handleLanguageChange = useCallback(async (lang: SupportedLanguage) => {
    if (lang === currentLanguage || isChanging) return;

    setIsChanging(true);
    try {
      await changeLanguage(lang);

      // Update URL with lang parameter
      const searchParams = new URLSearchParams(location.search);
      searchParams.set('lang', lang);
      navigate(
        { pathname: location.pathname, search: searchParams.toString() },
        { replace: true }
      );

      // Save to user preferences if logged in
      if (isAuthenticated) {
        try {
          await fetch('/api/user/preferences', {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ language: lang }),
          });
        } catch (error) {
          console.warn('Failed to save language preference to server:', error);
        }
      }
    } catch (error) {
      console.error('Failed to change language:', error);
    } finally {
      setIsChanging(false);
    }
  }, [currentLanguage, isChanging, changeLanguage, location, navigate, isAuthenticated]);

  // Build dropdown menu using Arco Design Menu component
  // Issue #598: Using proper Menu component for reliable click handling
  const menuDroplist = (
    <Menu
      className="language-dropdown-menu"
      selectedKeys={[currentLanguage]}
      onClickMenuItem={(key) => {
        handleLanguageChange(key as SupportedLanguage);
      }}
    >
      {supportedLanguages.map(lang => (
        <Menu.Item key={lang.code} className="language-menu-item">
          <div className="language-option">
            <span className="language-option__name">{lang.nativeName}</span>
            {currentLanguage === lang.code && (
              <IconCheck className="language-option__check" />
            )}
          </div>
        </Menu.Item>
      ))}
    </Menu>
  );

  // Get current language display name
  const currentLangInfo = SUPPORTED_LANGUAGES[currentLanguage] || SUPPORTED_LANGUAGES['zh-CN'];

  // Button content based on mode
  const buttonContent = iconOnly ? (
    <IconLanguage />
  ) : compact ? (
    <IconLanguage />
  ) : (
    <Space size={4}>
      <IconLanguage />
      <span className="language-switcher__label">{currentLangInfo.nativeName}</span>
    </Space>
  );

  return (
    <Dropdown
      trigger="click"
      position="bottomRight"
      droplist={menuDroplist}
      // Issue #606: Render dropdown to body to escape stacking context
      // caused by backdrop-filter on parent containers (e.g., landing-header)
      getPopupContainer={() => document.body}
    >
      <Tooltip content={t('language.switchTo')} position="bottom">
        <Button
          type="text"
          className={`language-switcher ${isChanging ? 'language-switcher--changing' : ''}`}
          loading={isChanging}
          aria-label={t('language.switchTo')}
          aria-haspopup="listbox"
        >
          {buttonContent}
        </Button>
      </Tooltip>
    </Dropdown>
  );
}

/**
 * Hook to sync language from URL parameter
 * Should be used in the root component
 */
export function useLanguageUrlSync() {
  const location = useLocation();
  const { changeLanguage, currentLanguage } = useLanguage();

  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const langParam = searchParams.get('lang');

    if (langParam && langParam !== currentLanguage) {
      const supportedLangs = Object.keys(SUPPORTED_LANGUAGES) as SupportedLanguage[];
      if (supportedLangs.includes(langParam as SupportedLanguage)) {
        changeLanguage(langParam as SupportedLanguage);
      }
    }
  }, [location.search, currentLanguage, changeLanguage]);
}

/**
 * Hook to sync language with user preferences on login
 */
export function useLanguageUserSync() {
  const { isAuthenticated, user } = useAuth();
  const { changeLanguage, currentLanguage } = useLanguage();

  useEffect(() => {
    // When user logs in, fetch their language preference
    if (isAuthenticated && user) {
      const savedLang = localStorage.getItem('i18nextLng');
      // Prefer the server-side preference if available
      // For now, we'll keep the localStorage preference
      // This can be enhanced later with a user preferences API
    }
  }, [isAuthenticated, user, changeLanguage, currentLanguage]);
}

export default LanguageSwitcher;