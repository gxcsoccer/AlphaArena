/**
 * Locale Provider Component
 * 
 * Provides unified language management for both i18next and Arco Design.
 * 
 * Usage:
 * ```tsx
 * import { LocaleProvider } from './i18n/LocaleProvider';
 * 
 * function App() {
 *   return (
 *     <LocaleProvider>
 *       <YourApp />
 *     </LocaleProvider>
 *   );
 * }
 * ```
 */

import React, { createContext, useContext, useMemo, useEffect, useState } from 'react';
import { ConfigProvider } from '@arco-design/web-react';
import { I18nextProvider, useTranslation } from 'react-i18next';
import i18n, { SupportedLanguage, SUPPORTED_LANGUAGES, DEFAULT_LANGUAGE } from './index';

// Import Arco Design locales (use lib for CommonJS compatibility in Jest)
import zhCN from '@arco-design/web-react/lib/locale/zh-CN';
import enUS from '@arco-design/web-react/lib/locale/en-US';
import jaJP from '@arco-design/web-react/lib/locale/ja-JP';
import koKR from '@arco-design/web-react/lib/locale/ko-KR';

// Arco locale map
const ARCO_LOCALES: Record<string, typeof zhCN> = {
  'zh-CN': zhCN,
  'en-US': enUS,
  'ja-JP': jaJP,
  'ko-KR': koKR,
};

// Context for locale management
interface LocaleContextValue {
  currentLanguage: SupportedLanguage;
  changeLanguage: (lang: SupportedLanguage) => Promise<void>;
  supportedLanguages: Array<{
    code: SupportedLanguage;
    name: string;
    nativeName: string;
    arcoLocale: string;
  }>;
}

const LocaleContext = createContext<LocaleContextValue | null>(null);

export function useLocaleContext() {
  const context = useContext(LocaleContext);
  if (!context) {
    throw new Error('useLocaleContext must be used within a LocaleProvider');
  }
  return context;
}

// Inner component that has access to i18n hooks
function LocaleProviderInner({ children }: { children: React.ReactNode }) {
  const [currentLanguage, setCurrentLanguage] = useState<SupportedLanguage>(
    i18n.language as SupportedLanguage || DEFAULT_LANGUAGE
  );

  // Listen for language changes
  useEffect(() => {
    const handleLanguageChanged = (lang: string) => {
      const supportedLang = lang in SUPPORTED_LANGUAGES ? lang as SupportedLanguage : DEFAULT_LANGUAGE;
      setCurrentLanguage(supportedLang);
    };

    i18n.on('languageChanged', handleLanguageChanged);
    return () => {
      i18n.off('languageChanged', handleLanguageChanged);
    };
  }, []);

  const changeLanguage = async (lang: SupportedLanguage) => {
    await i18n.changeLanguage(lang);
  };

  const supportedLanguages = useMemo(() => 
    Object.entries(SUPPORTED_LANGUAGES).map(([code, info]) => ({
      code: code as SupportedLanguage,
      ...info,
    })),
  []);

  const arcoLocale = ARCO_LOCALES[currentLanguage] || ARCO_LOCALES[DEFAULT_LANGUAGE];

  const contextValue = useMemo(() => ({
    currentLanguage,
    changeLanguage,
    supportedLanguages,
  }), [currentLanguage]);

  return (
    <LocaleContext.Provider value={contextValue}>
      <ConfigProvider locale={arcoLocale}>
        {children}
      </ConfigProvider>
    </LocaleContext.Provider>
  );
}

// Main provider component
interface LocaleProviderProps {
  children: React.ReactNode;
}

export function LocaleProvider({ children }: LocaleProviderProps) {
  return (
    <I18nextProvider i18n={i18n}>
      <LocaleProviderInner>
        {children}
      </LocaleProviderInner>
    </I18nextProvider>
  );
}

// Language switcher component
export function LanguageSwitcher() {
  const { currentLanguage, changeLanguage, supportedLanguages } = useLocaleContext();
  const { t } = useTranslation('common');

  return (
    <div className="language-switcher">
      {supportedLanguages.map(lang => (
        <button
          key={lang.code}
          onClick={() => changeLanguage(lang.code)}
          className={`language-btn ${currentLanguage === lang.code ? 'active' : ''}`}
          title={lang.nativeName}
          style={{
            padding: '4px 8px',
            margin: '0 2px',
            border: 'none',
            borderRadius: '4px',
            background: currentLanguage === lang.code ? 'var(--color-primary)' : 'transparent',
            color: currentLanguage === lang.code ? 'white' : 'inherit',
            cursor: 'pointer',
            transition: 'all 0.2s',
          }}
        >
          {lang.nativeName}
        </button>
      ))}
    </div>
  );
}

export default LocaleProvider;