/**
 * useSEO Hook
 * 
 * Issue #617: International SEO Optimization
 * 
 * React hook for managing SEO meta tags with i18n support.
 * Automatically updates:
 * - Document title
 * - Meta description
 * - Open Graph tags
 * - Twitter Card tags
 * - hreflang tags
 * - Canonical URL
 * - HTML lang attribute
 */

import { useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';
import { 
  updateSEOMeta, 
  updateHtmlLang,
  updateHreflangTags,
  generateWebsiteStructuredData,
  updateStructuredData,
  SEOMeta,
  SITE_URL 
} from '../utils/seo';
import { useLanguage } from '../i18n/hooks';

/**
 * SEO configuration for a page
 */
export interface SEOConfig {
  title?: string;
  description?: string;
  keywords?: string | string[];
  ogImage?: string;
  ogType?: 'website' | 'article' | 'product';
  ogImageAlt?: string;
  twitterCard?: 'summary' | 'summary_large_image';
  canonicalUrl?: string;
  noIndex?: boolean;
  structuredData?: object | object[];
}

/**
 * Page-specific SEO keys
 */
type PageKey = 'home' | 'landing' | 'login' | 'register' | 'leaderboard' | 'subscription' | 'marketplace' | 'apiDocs' | 'dashboard' | 'strategies' | 'trades' | 'holdings' | 'performance' | 'backtest';

/**
 * Page SEO configuration map
 * These are keys that map to the seo.json translation files
 */
export const PAGE_SEO_CONFIGS: Record<PageKey, SEOConfig> = {
  home: { ogType: 'website' },
  landing: { ogType: 'website' },
  login: { ogType: 'website', noIndex: true },
  register: { ogType: 'website' },
  leaderboard: { ogType: 'website' },
  subscription: { ogType: 'website' },
  marketplace: { ogType: 'website' },
  apiDocs: { ogType: 'website' },
  // Private pages - noIndex to prevent search indexing
  dashboard: { noIndex: true },
  strategies: { noIndex: true },
  trades: { noIndex: true },
  holdings: { noIndex: true },
  performance: { noIndex: true },
  backtest: { noIndex: true },
};

/**
 * Hook for managing page-level SEO
 * 
 * @param pageKeyOrConfig - Either a page key (from PAGE_SEO_CONFIGS) or a custom SEO config
 * @param customMeta - Additional custom meta to merge with page config
 */
export function useSEO(pageKeyOrConfig?: PageKey | SEOConfig, customMeta?: SEOConfig) {
  const { t } = useTranslation('seo');
  const language = useLanguage();
  const location = useLocation();
  
  // Determine if first arg is a page key or config
  const isPageKey = typeof pageKeyOrConfig === 'string';
  const pageKey = isPageKey ? pageKeyOrConfig as PageKey : undefined;
  const customConfig = isPageKey ? customMeta : pageKeyOrConfig as SEOConfig;
  
  // Get page config from PAGE_SEO_CONFIGS
  const pageConfig = pageKey ? PAGE_SEO_CONFIGS[pageKey] : {};
  
  // Merge configs
  const mergedConfig = useMemo(() => ({
    ...pageConfig,
    ...customConfig,
  }), [pageConfig, customConfig]);
  
  const updateSEO = useCallback(() => {
    // Get page-specific SEO data from translations
    const pageData = pageKey ? {
      title: t(`pages.${pageKey}.title`),
      description: t(`pages.${pageKey}.description`),
    } : {
      title: t('meta.title'),
      description: t('meta.description'),
    };
    
    // Convert keywords array to string if needed
    let keywords = mergedConfig.keywords;
    if (Array.isArray(keywords)) {
      keywords = keywords.join(', ');
    }
    
    // Build SEO meta object
    const seoMeta: SEOMeta = {
      title: mergedConfig.title || pageData.title,
      description: mergedConfig.description || pageData.description,
      keywords: keywords || t('meta.keywords'),
      ogImage: mergedConfig.ogImage,
      ogType: mergedConfig.ogType || 'website',
      twitterCard: mergedConfig.twitterCard || 'summary_large_image',
      canonicalUrl: mergedConfig.canonicalUrl || `${SITE_URL}${location.pathname}`,
      noIndex: mergedConfig.noIndex,
    };
    
    // Update all SEO meta tags
    updateSEOMeta(seoMeta, language, location.pathname);
    
    // Update hreflang tags
    updateHreflangTags(location.pathname, language);
    
    // Update structured data
    const structuredData = generateWebsiteStructuredData(language);
    updateStructuredData(structuredData);
    
    // Add custom structured data if provided
    if (mergedConfig.structuredData) {
      const structuredDataItems = Array.isArray(mergedConfig.structuredData) 
        ? mergedConfig.structuredData 
        : [mergedConfig.structuredData];
      
      structuredDataItems.forEach((data, index) => {
        updateStructuredData(data, `custom-schema-${index}`);
      });
    }
  }, [pageKey, mergedConfig, language, location.pathname, t]);
  
  useEffect(() => {
    updateSEO();
  }, [updateSEO]);
  
  // Update HTML lang attribute on language change
  useEffect(() => {
    updateHtmlLang(language);
  }, [language]);
  
  return {
    updateSEO,
    language,
    currentPath: location.pathname,
    pageConfig: mergedConfig,
  };
}

/**
 * Hook for updating hreflang tags only
 * Use this for pages that don't need full SEO management
 */
export function useHreflang() {
  const language = useLanguage();
  const location = useLocation();
  
  useEffect(() => {
    updateHreflangTags(location.pathname, language);
  }, [language, location.pathname]);
}

/**
 * Hook for updating HTML lang attribute only
 * Use this in the root component to ensure lang attribute is always correct
 */
export function useHtmlLang() {
  const language = useLanguage();
  
  useEffect(() => {
    updateHtmlLang(language);
  }, [language]);
  
  return language;
}

export default useSEO;