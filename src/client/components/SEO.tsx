/**
 * SEO Component
 * Declarative SEO management for React pages
 * 
 * Issue #617: International SEO Optimization
 */

import React from 'react';
import { useSEO, SEOConfig } from '../hooks/useSEO';
import { SITE_URL } from '../utils/seo';

/**
 * Props for the SEO component
 */
export interface SEOProps extends SEOConfig {
  /** Page key for automatic SEO from translations */
  pageKey?: string;
}

/**
 * SEO component for declarative meta tag management
 * 
 * @example
 * ```tsx
 * // Using page key (gets translations from seo.json)
 * <SEO pageKey="home" />
 * 
 * // Using custom config
 * <SEO 
 *   title="Strategy Performance" 
 *   description="View your strategy performance"
 *   keywords={['trading', 'performance']}
 * />
 * ```
 */
export function SEO({ 
  pageKey,
  title, 
  description, 
  keywords, 
  canonicalUrl,
  ogType,
  ogImage,
  ogImageAlt,
  twitterCard,
  structuredData,
  noIndex,
}: SEOProps) {
  useSEO(pageKey as any, {
    title,
    description,
    keywords,
    canonicalUrl,
    ogType,
    ogImage,
    ogImageAlt,
    twitterCard,
    structuredData,
    noIndex,
  });

  // This component doesn't render anything
  return null;
}

/**
 * Breadcrumb structured data generator
 */
export function generateBreadcrumbStructuredData(items: { name: string; url: string }[]): object {
  const baseUrl = SITE_URL || window.location.origin;
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: `${baseUrl}${item.url}`,
    })),
  };
}

/**
 * FAQ structured data generator
 */
export function generateFAQStructuredData(items: { question: string; answer: string }[]): object {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map(item => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.answer,
      },
    })),
  };
}

/**
 * HowTo structured data generator
 */
export function generateHowToStructuredData(data: {
  name: string;
  description: string;
  steps: { name: string; text: string }[];
  totalTime?: string;
}): object {
  return {
    '@context': 'https://schema.org',
    '@type': 'HowTo',
    name: data.name,
    description: data.description,
    totalTime: data.totalTime,
    step: data.steps.map((step, index) => ({
      '@type': 'HowToStep',
      position: index + 1,
      name: step.name,
      text: step.text,
    })),
  };
}

/**
 * Product structured data generator (for marketplace strategies)
 */
export function generateProductStructuredData(data: {
  name: string;
  description: string;
  image?: string;
  price?: number;
  currency?: string;
  rating?: {
    value: number;
    count: number;
  };
}): object {
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: data.name,
    description: data.description,
    image: data.image,
    offers: data.price ? {
      '@type': 'Offer',
      price: data.price.toFixed(2),
      priceCurrency: data.currency || 'USD',
    } : undefined,
    aggregateRating: data.rating ? {
      '@type': 'AggregateRating',
      ratingValue: data.rating.value.toString(),
      reviewCount: data.rating.count.toString(),
    } : undefined,
  };
}

/**
 * Article structured data generator (for blog posts, guides)
 */
export function generateArticleStructuredData(data: {
  headline: string;
  description: string;
  author?: string;
  datePublished?: string;
  dateModified?: string;
  image?: string;
}): object {
  const baseUrl = SITE_URL || window.location.origin;
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: data.headline,
    description: data.description,
    author: data.author ? {
      '@type': 'Person',
      name: data.author,
    } : undefined,
    datePublished: data.datePublished,
    dateModified: data.dateModified || data.datePublished,
    image: data.image,
    publisher: {
      '@type': 'Organization',
      name: 'AlphaArena',
      url: baseUrl,
    },
  };
}

export default SEO;