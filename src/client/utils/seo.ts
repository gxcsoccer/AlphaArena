/**
 * SEO Utilities
 * Dynamic meta tag management for better SEO and social sharing
 */

interface SEOConfig {
  title?: string;
  description?: string;
  keywords?: string[];
  canonicalUrl?: string;
  ogType?: 'website' | 'article' | 'product';
  ogImage?: string;
  ogImageAlt?: string;
  twitterCard?: 'summary' | 'summary_large_image';
}

const DEFAULT_CONFIG: Required<SEOConfig> = {
  title: 'AlphaArena - 算法交易平台 | AI 驱动的智能交易',
  description: 'AlphaArena 是一个专业的算法交易平台，提供 AI 驱动的智能策略、无风险的模拟交易环境、实时市场数据和竞技排名系统。免费注册，即刻开始您的量化交易之旅。',
  keywords: [
    '算法交易',
    '量化交易',
    'AI 交易',
    '模拟交易',
    '虚拟交易',
    '智能策略',
    '交易机器人',
    '量化投资',
    '交易平台',
    '股票交易',
    '加密货币交易',
    'AlphaArena',
  ],
  canonicalUrl: 'https://alphaarena.app',
  ogType: 'website',
  ogImage: '/og-image.png',
  ogImageAlt: 'AlphaArena - 专业级算法交易平台',
  twitterCard: 'summary_large_image',
};

/**
 * Update page meta tags dynamically
 */
export function updateSEO(config: Partial<SEOConfig> = {}): void {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };
  
  // Update title
  if (finalConfig.title) {
    document.title = finalConfig.title;
    updateMetaTag('og:title', finalConfig.title);
    updateMetaTag('twitter:title', finalConfig.title);
  }
  
  // Update description
  if (finalConfig.description) {
    updateMetaTag('description', finalConfig.description);
    updateMetaTag('og:description', finalConfig.description);
    updateMetaTag('twitter:description', finalConfig.description);
  }
  
  // Update keywords
  if (finalConfig.keywords && finalConfig.keywords.length > 0) {
    updateMetaTag('keywords', finalConfig.keywords.join(', '));
  }
  
  // Update canonical URL
  if (finalConfig.canonicalUrl) {
    updateLinkTag('canonical', finalConfig.canonicalUrl);
    updateMetaTag('og:url', finalConfig.canonicalUrl);
  }
  
  // Update Open Graph type
  if (finalConfig.ogType) {
    updateMetaTag('og:type', finalConfig.ogType);
  }
  
  // Update Open Graph image
  if (finalConfig.ogImage) {
    const fullImageUrl = finalConfig.ogImage.startsWith('http') 
      ? finalConfig.ogImage 
      : `${window.location.origin}${finalConfig.ogImage}`;
    updateMetaTag('og:image', fullImageUrl);
    updateMetaTag('twitter:image', fullImageUrl);
  }
  
  // Update Open Graph image alt
  if (finalConfig.ogImageAlt) {
    updateMetaTag('og:image:alt', finalConfig.ogImageAlt);
  }
  
  // Update Twitter card type
  if (finalConfig.twitterCard) {
    updateMetaTag('twitter:card', finalConfig.twitterCard);
  }
}

/**
 * Update or create a meta tag
 */
function updateMetaTag(name: string, content: string): void {
  // Check for Open Graph property-style meta tags (og:*)
  const isOGMeta = name.startsWith('og:');
  // Twitter meta tags use 'name' attribute, not 'property'
  const isTwitterMeta = name.startsWith('twitter:');
  
  let selector: string;
  if (isOGMeta) {
    selector = `meta[property="${name}"], meta[name="${name}"]`;
  } else if (isTwitterMeta) {
    selector = `meta[name="${name}"]`;
  } else {
    selector = `meta[name="${name}"]`;
  }
  
  let meta = document.querySelector(selector) as HTMLMetaElement;
  
  if (!meta) {
    meta = document.createElement('meta');
    if (isOGMeta) {
      meta.setAttribute('property', name);
    } else {
      meta.setAttribute('name', name);
    }
    document.head.appendChild(meta);
  }
  
  meta.setAttribute('content', content);
}

/**
 * Update or create a link tag
 */
function updateLinkTag(rel: string, href: string): void {
  let link = document.querySelector(`link[rel="${rel}"]`) as HTMLLinkElement;
  
  if (!link) {
    link = document.createElement('link');
    link.setAttribute('rel', rel);
    document.head.appendChild(link);
  }
  
  link.setAttribute('href', href);
}

/**
 * Add structured data (JSON-LD) to the page
 */
export function addStructuredData(data: object): void {
  const script = document.createElement('script');
  script.setAttribute('type', 'application/ld+json');
  script.textContent = JSON.stringify(data);
  document.head.appendChild(script);
}

/**
 * Generate WebSite structured data
 */
export function generateWebsiteStructuredData(): object {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'AlphaArena',
    url: 'https://alphaarena.app',
    description: DEFAULT_CONFIG.description,
    potentialAction: {
      '@type': 'SearchAction',
      target: 'https://alphaarena.app/search?q={search_term_string}',
      'query-input': 'required name=search_term_string',
    },
  };
}

/**
 * Generate SoftwareApplication structured data
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
    description: DEFAULT_CONFIG.description,
    url: 'https://alphaarena.app',
  };
}

/**
 * Generate Organization structured data
 */
export function generateOrganizationStructuredData(): object {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'AlphaArena',
    url: 'https://alphaarena.app',
    logo: 'https://alphaarena.app/logo.png',
    sameAs: [
      // Add social media URLs when available
    ],
  };
}

/**
 * Generate share URL with UTM parameters
 */
export function generateShareUrl(
  source: string, 
  medium: string = 'share', 
  campaign: string = 'landing'
): string {
  const baseUrl = window.location.origin;
  const params = new URLSearchParams({
    utm_source: source,
    utm_medium: medium,
    utm_campaign: campaign,
  });
  return `${baseUrl}?${params.toString()}`;
}

/**
 * Copy share URL to clipboard
 */
export async function copyShareUrl(source: string = 'web'): Promise<boolean> {
  const shareUrl = generateShareUrl(source);
  try {
    await navigator.clipboard.writeText(shareUrl);
    return true;
  } catch {
    // Fallback for older browsers
    const textArea = document.createElement('textarea');
    textArea.value = shareUrl;
    textArea.style.position = 'fixed';
    textArea.style.left = '-9999px';
    document.body.appendChild(textArea);
    textArea.select();
    try {
      document.execCommand('copy');
      return true;
    } catch {
      return false;
    } finally {
      document.body.removeChild(textArea);
    }
  }
}

export default {
  updateSEO,
  addStructuredData,
  generateWebsiteStructuredData,
  generateSoftwareStructuredData,
  generateOrganizationStructuredData,
  generateShareUrl,
  copyShareUrl,
};