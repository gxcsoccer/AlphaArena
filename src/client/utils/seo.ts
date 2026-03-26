/**
 * SEO Utilities for i18n
 * 
 * Issue #617: International SEO Optimization
 * 
 * Provides utilities for managing SEO meta tags with i18n support:
 * - Dynamic title and description
 * - hreflang tags
 * - Open Graph and Twitter Card meta tags
 * - Canonical URLs
 */

import { SupportedLanguage, DEFAULT_LANGUAGE, SUPPORTED_LANGUAGES } from '../i18n';

// Site configuration
export const SITE_URL = typeof window !== 'undefined' 
  ? window.location.origin 
  : (import.meta.env.VITE_SITE_URL || 'https://alphaarena.app');

// Supported languages for hreflang
const HREFLANG_MAP: Record<string, string> = {
  'zh-CN': 'zh-CN',
  'en-US': 'en-US',
  'ja-JP': 'ja-JP',
  'ko-KR': 'ko-KR',
};

/**
 * SEO meta tags interface
 */
export interface SEOMeta {
  title: string;
  description: string;
  keywords?: string;
  ogImage?: string;
  ogType?: 'website' | 'article' | 'product';
  twitterCard?: 'summary' | 'summary_large_image';
  canonicalUrl?: string;
  noIndex?: boolean;
}

/**
 * Update the document title with language suffix
 */
export function updateDocumentTitle(title: string, lang: SupportedLanguage = DEFAULT_LANGUAGE): void {
  if (typeof document === 'undefined') return;
  
  // Add language suffix for non-default languages
  const languageSuffix = lang === DEFAULT_LANGUAGE ? '' : ` | ${SUPPORTED_LANGUAGES[lang].nativeName}`;
  document.title = `${title}${languageSuffix}`;
  
  // Update meta title tag
  const metaTitle = document.querySelector('meta[name="title"]');
  if (metaTitle) {
    metaTitle.setAttribute('content', document.title);
  }
}

/**
 * Update meta description
 */
export function updateMetaDescription(description: string): void {
  if (typeof document === 'undefined') return;
  
  const metaDesc = document.querySelector('meta[name="description"]');
  if (metaDesc) {
    metaDesc.setAttribute('content', description);
  }
}

/**
 * Update meta keywords
 */
export function updateMetaKeywords(keywords: string): void {
  if (typeof document === 'undefined') return;
  
  let metaKeywords = document.querySelector('meta[name="keywords"]');
  if (!metaKeywords) {
    metaKeywords = document.createElement('meta');
    metaKeywords.setAttribute('name', 'keywords');
    document.head.appendChild(metaKeywords);
  }
  metaKeywords.setAttribute('content', keywords);
}

/**
 * Update Open Graph meta tags
 */
export function updateOpenGraphTags(meta: SEOMeta, lang: SupportedLanguage = DEFAULT_LANGUAGE): void {
  if (typeof document === 'undefined') return;
  
  const ogTags = {
    'og:title': meta.title,
    'og:description': meta.description,
    'og:type': meta.ogType || 'website',
    'og:url': meta.canonicalUrl || window.location.href,
    'og:image': meta.ogImage || `${SITE_URL}/og-image.png`,
    'og:locale': lang.replace('-', '_'),
    'og:site_name': 'AlphaArena',
  };
  
  for (const [property, content] of Object.entries(ogTags)) {
    let metaTag = document.querySelector(`meta[property="${property}"]`);
    if (!metaTag) {
      metaTag = document.createElement('meta');
      metaTag.setAttribute('property', property);
      document.head.appendChild(metaTag);
    }
    metaTag.setAttribute('content', content);
  }
  
  // Add alternate locale tags
  updateAlternateLocaleTags();
}

/**
 * Update Twitter Card meta tags
 */
export function updateTwitterTags(meta: SEOMeta): void {
  if (typeof document === 'undefined') return;
  
  const twitterTags = {
    'twitter:card': meta.twitterCard || 'summary_large_image',
    'twitter:title': meta.title,
    'twitter:description': meta.description,
    'twitter:image': meta.ogImage || `${SITE_URL}/og-image.png`,
  };
  
  for (const [name, content] of Object.entries(twitterTags)) {
    let metaTag = document.querySelector(`meta[name="${name}"]`);
    if (!metaTag) {
      metaTag = document.createElement('meta');
      metaTag.setAttribute('name', name);
      document.head.appendChild(metaTag);
    }
    metaTag.setAttribute('content', content);
  }
}

/**
 * Update canonical URL
 */
export function updateCanonicalUrl(url: string): void {
  if (typeof document === 'undefined') return;
  
  let canonical = document.querySelector('link[rel="canonical"]');
  if (!canonical) {
    canonical = document.createElement('link');
    canonical.setAttribute('rel', 'canonical');
    document.head.appendChild(canonical);
  }
  canonical.setAttribute('href', url);
}

/**
 * Update hreflang tags for all supported languages
 */
export function updateHreflangTags(currentPath: string, currentLang: SupportedLanguage = DEFAULT_LANGUAGE): void {
  if (typeof document === 'undefined') return;
  
  // Remove existing hreflang tags
  const existingHreflangs = document.querySelectorAll('link[rel="alternate"][hreflang]');
  existingHreflangs.forEach(tag => tag.remove());
  
  // Add x-default
  addHreflangTag('x-default', getUrlWithLang(currentPath, DEFAULT_LANGUAGE));
  
  // Add all supported languages
  for (const lang of Object.keys(SUPPORTED_LANGUAGES) as SupportedLanguage[]) {
    const hreflang = HREFLANG_MAP[lang];
    addHreflangTag(hreflang, getUrlWithLang(currentPath, lang));
  }
}

/**
 * Add a single hreflang tag
 */
function addHreflangTag(hreflang: string, href: string): void {
  const link = document.createElement('link');
  link.setAttribute('rel', 'alternate');
  link.setAttribute('hreflang', hreflang);
  link.setAttribute('href', href);
  document.head.appendChild(link);
}

/**
 * Update alternate locale tags for Open Graph
 */
function updateAlternateLocaleTags(): void {
  if (typeof document === 'undefined') return;
  
  // Remove existing alternate locale tags
  const existingAlts = document.querySelectorAll('meta[property="og:locale:alternate"]');
  existingAlts.forEach(tag => tag.remove());
  
  // Add alternate locales
  for (const lang of Object.keys(SUPPORTED_LANGUAGES) as SupportedLanguage[]) {
    const meta = document.createElement('meta');
    meta.setAttribute('property', 'og:locale:alternate');
    meta.setAttribute('content', lang.replace('-', '_'));
    document.head.appendChild(meta);
  }
}

/**
 * Get URL with language parameter
 */
export function getUrlWithLang(path: string, lang: SupportedLanguage): string {
  // Remove leading slash if present
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  
  // For the default language, we don't add a lang parameter
  if (lang === DEFAULT_LANGUAGE) {
    return `${SITE_URL}${cleanPath}`;
  }
  
  // For other languages, add lang query parameter
  return `${SITE_URL}${cleanPath}?lang=${lang}`;
}

/**
 * Update robots meta tag
 */
export function updateRobotsMeta(noIndex: boolean = false): void {
  if (typeof document === 'undefined') return;
  
  let robotsMeta = document.querySelector('meta[name="robots"]');
  if (!robotsMeta) {
    robotsMeta = document.createElement('meta');
    robotsMeta.setAttribute('name', 'robots');
    document.head.appendChild(robotsMeta);
  }
  robotsMeta.setAttribute('content', noIndex ? 'noindex, nofollow' : 'index, follow');
}

/**
 * Update html lang attribute
 */
export function updateHtmlLang(lang: SupportedLanguage): void {
  if (typeof document === 'undefined') return;
  
  const html = document.documentElement;
  html.setAttribute('lang', lang);
  
  // Also set the dir attribute for RTL languages (not needed for our supported languages)
  // html.setAttribute('dir', 'ltr');
}

/**
 * Update all SEO meta tags at once
 */
export function updateSEOMeta(meta: SEOMeta, lang: SupportedLanguage = DEFAULT_LANGUAGE, currentPath: string = ''): void {
  // Update basic meta tags
  updateDocumentTitle(meta.title, lang);
  updateMetaDescription(meta.description);
  
  if (meta.keywords) {
    updateMetaKeywords(meta.keywords);
  }
  
  // Update Open Graph and Twitter tags
  updateOpenGraphTags(meta, lang);
  updateTwitterTags(meta);
  
  // Update canonical URL
  if (meta.canonicalUrl) {
    updateCanonicalUrl(meta.canonicalUrl);
  } else if (currentPath) {
    updateCanonicalUrl(getUrlWithLang(currentPath, lang));
  }
  
  // Update hreflang tags
  if (currentPath) {
    updateHreflangTags(currentPath, lang);
  }
  
  // Update robots meta
  updateRobotsMeta(meta.noIndex);
  
  // Update html lang attribute
  updateHtmlLang(lang);
}

/**
 * Generate JSON-LD structured data for the website
 */
export function generateWebsiteStructuredData(lang: SupportedLanguage = DEFAULT_LANGUAGE): object {
  const langInfo = SUPPORTED_LANGUAGES[lang];
  
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'AlphaArena',
    url: SITE_URL,
    description: lang === 'zh-CN' 
      ? '专业级算法交易平台，AI 驱动的智能策略，无风险模拟交易环境'
      : lang === 'en-US'
        ? 'Professional algorithmic trading platform with AI-powered strategies and risk-free simulation'
        : lang === 'ja-JP'
          ? 'AI駆動のスマート戦略とリスクフリーのシミュレーション環境を備えたプロフェッショナルアルゴリズム取引プラットフォーム'
          : 'AI 기반 스마트 전략과 리스크 프리 시뮬레이션 환경을 갖춘 전문 알고리즘 트레이딩 플랫폼',
    inLanguage: langInfo.nativeName,
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${SITE_URL}/search?q={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
  };
}

/**
 * Update or add JSON-LD structured data
 */
export function updateStructuredData(data: object, id: string = 'website-schema'): void {
  if (typeof document === 'undefined') return;
  
  // Remove existing script with same id
  const existing = document.getElementById(id);
  if (existing) {
    existing.remove();
  }
  
  // Create new script tag
  const script = document.createElement('script');
  script.type = 'application/ld+json';
  script.id = id;
  script.textContent = JSON.stringify(data);
  document.head.appendChild(script);
}

/**
 * Legacy updateSEO function for backward compatibility
 * Simplified version that updates basic SEO tags
 */
export interface LegacySEOMeta {
  title?: string;
  description?: string;
  keywords?: string | string[];
  ogType?: 'website' | 'article' | 'product';
  ogImage?: string;
  twitterCard?: 'summary' | 'summary_large_image';
  canonicalUrl?: string;
}

export function updateSEO(meta: LegacySEOMeta): void {
  if (typeof document === 'undefined') return;
  
  // Update title
  if (meta.title) {
    document.title = meta.title;
    let metaTitle = document.querySelector('meta[name="title"]');
    if (!metaTitle) {
      metaTitle = document.createElement('meta');
      metaTitle.setAttribute('name', 'title');
      document.head.appendChild(metaTitle);
    }
    metaTitle.setAttribute('content', meta.title);
  }
  
  // Update description
  if (meta.description) {
    let metaDesc = document.querySelector('meta[name="description"]');
    if (!metaDesc) {
      metaDesc = document.createElement('meta');
      metaDesc.setAttribute('name', 'description');
      document.head.appendChild(metaDesc);
    }
    metaDesc.setAttribute('content', meta.description);
  }
  
  // Update keywords
  if (meta.keywords) {
    const keywordsStr = Array.isArray(meta.keywords) ? meta.keywords.join(', ') : meta.keywords;
    let metaKeywords = document.querySelector('meta[name="keywords"]');
    if (!metaKeywords) {
      metaKeywords = document.createElement('meta');
      metaKeywords.setAttribute('name', 'keywords');
      document.head.appendChild(metaKeywords);
    }
    metaKeywords.setAttribute('content', keywordsStr);
  }
  
  // Update OG tags
  if (meta.title) {
    let ogTitle = document.querySelector('meta[property="og:title"]');
    if (!ogTitle) {
      ogTitle = document.createElement('meta');
      ogTitle.setAttribute('property', 'og:title');
      document.head.appendChild(ogTitle);
    }
    ogTitle.setAttribute('content', meta.title);
  }
  
  if (meta.ogType) {
    let ogType = document.querySelector('meta[property="og:type"]');
    if (!ogType) {
      ogType = document.createElement('meta');
      ogType.setAttribute('property', 'og:type');
      document.head.appendChild(ogType);
    }
    ogType.setAttribute('content', meta.ogType);
  }
  
  // Update Twitter tags
  if (meta.twitterCard) {
    let twitterCard = document.querySelector('meta[name="twitter:card"]');
    if (!twitterCard) {
      twitterCard = document.createElement('meta');
      twitterCard.setAttribute('name', 'twitter:card');
      document.head.appendChild(twitterCard);
    }
    twitterCard.setAttribute('content', meta.twitterCard);
  }
  
  if (meta.title) {
    let twitterTitle = document.querySelector('meta[name="twitter:title"]');
    if (!twitterTitle) {
      twitterTitle = document.createElement('meta');
      twitterTitle.setAttribute('name', 'twitter:title');
      document.head.appendChild(twitterTitle);
    }
    twitterTitle.setAttribute('content', meta.title);
  }
  
  // Update canonical URL
  if (meta.canonicalUrl) {
    updateCanonicalUrl(meta.canonicalUrl);
  }
}

/**
 * Generate share URL with UTM parameters
 */
export function generateShareUrl(
  source: string,
  medium: string = 'share',
  campaign: string = 'landing'
): string {
  const url = new URL(SITE_URL);
  url.searchParams.set('utm_source', source);
  url.searchParams.set('utm_medium', medium);
  url.searchParams.set('utm_campaign', campaign);
  return url.toString();
}

/**
 * Copy share URL to clipboard
 */
export async function copyShareUrl(
  source: string,
  medium: string = 'share',
  campaign: string = 'landing'
): Promise<boolean> {
  try {
    const url = generateShareUrl(source, medium, campaign);
    await navigator.clipboard.writeText(url);
    return true;
  } catch (error) {
    console.error('Failed to copy URL:', error);
    return false;
  }
}

/**
 * Generate JSON-LD structured data for SoftwareApplication
 */
export function generateSoftwareStructuredData(): object {
  return {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'AlphaArena',
    applicationCategory: 'FinanceApplication',
    operatingSystem: 'Web Browser',
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD',
    },
    aggregateRating: {
      '@type': 'AggregateRating',
      ratingValue: '4.8',
      ratingCount: '1000',
    },
    description: 'AlphaArena 是一个专业的算法交易平台，提供 AI 驱动的智能策略、无风险的模拟交易环境、实时市场数据和竞技排名系统。',
  };
}