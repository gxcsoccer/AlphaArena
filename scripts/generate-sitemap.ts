/**
 * Sitemap Generator Script
 * Generates sitemap.xml and robots.txt for SEO with i18n support
 * Run during build: npm run generate:sitemap
 * 
 * Issue #617: International SEO Optimization
 */

import * as fs from 'fs';
import * as path from 'path';

// Site configuration
const SITE_URL = process.env.SITE_URL || 'https://alphaarena.app';
const BUILD_DATE = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format

// Supported languages for i18n (must match src/client/i18n/index.ts)
const SUPPORTED_LANGUAGES = ['zh-CN', 'en-US', 'ja-JP', 'ko-KR'] as const;
const DEFAULT_LANGUAGE = 'zh-CN';

// Language alternates for hreflang
const HREFLANG_MAP: Record<string, string> = {
  'zh-CN': 'zh-CN',
  'en-US': 'en-US',
  'ja-JP': 'ja-JP',
  'ko-KR': 'ko-KR',
  'x-default': 'zh-CN', // Default language for unknown regions
};

// Public routes (from App.tsx)
// These are the routes that should be indexed by search engines
const PUBLIC_ROUTES = [
  { path: '/', priority: 1.0, changefreq: 'daily' },
  { path: '/landing', priority: 1.0, changefreq: 'weekly' },
  { path: '/register', priority: 0.9, changefreq: 'monthly' },
  { path: '/login', priority: 0.9, changefreq: 'monthly' },
  { path: '/leaderboard', priority: 0.8, changefreq: 'hourly' },
  { path: '/subscription', priority: 0.8, changefreq: 'weekly' },
  { path: '/docs/api', priority: 0.7, changefreq: 'monthly' },
  { path: '/marketplace', priority: 0.7, changefreq: 'daily' },
];

// Private routes (should NOT be indexed)
const PRIVATE_ROUTES = [
  '/dashboard',
  '/strategies',
  '/trades',
  '/holdings',
  '/performance',
  '/risk',
  '/settings',
  '/user-dashboard',
  '/admin/',
  '/subscription/success',
  '/subscription/cancel',
  '/notification-preferences',
  '/notifications',
  '/data-source',
  '/virtual-account',
  '/exchange-accounts',
  '/strategy-portfolio',
  '/backtest',
  '/journal',
  '/sentiment',
  '/attribution',
  '/rebalance',
  '/scheduler',
  '/advanced-orders',
  '/strategy-comparison',
  '/copy-trading',
  '/user-analytics',
  '/user/',  // User profile pages
];

interface SitemapUrl {
  loc: string;
  lastmod: string;
  changefreq: 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never';
  priority: number;
  // Alternate language versions
  alternates?: Array<{
    hreflang: string;
    href: string;
  }>;
}

/**
 * Generate URL with language parameter
 */
function getUrlWithLang(path: string, lang: string): string {
  // For the default language, we don't add a lang parameter
  // The app will use browser detection or localStorage
  if (lang === DEFAULT_LANGUAGE) {
    return `${SITE_URL}${path}`;
  }
  // For other languages, add lang query parameter
  return `${SITE_URL}${path}?lang=${lang}`;
}

/**
 * Generate hreflang alternates for a URL
 */
function generateAlternates(path: string): Array<{ hreflang: string; href: string }> {
  const alternates: Array<{ hreflang: string; href: string }> = [];
  
  // Add x-default pointing to default language
  alternates.push({
    hreflang: 'x-default',
    href: getUrlWithLang(path, DEFAULT_LANGUAGE),
  });
  
  // Add each supported language
  for (const lang of SUPPORTED_LANGUAGES) {
    alternates.push({
      hreflang: HREFLANG_MAP[lang],
      href: getUrlWithLang(path, lang),
    });
  }
  
  return alternates;
}

/**
 * Generate sitemap XML content with hreflang support
 */
function generateSitemapXml(urls: SitemapUrl[]): string {
  const urlElements = urls.map(url => {
    let urlElement = `  <url>
    <loc>${url.loc}</loc>
    <lastmod>${url.lastmod}</lastmod>
    <changefreq>${url.changefreq}</changefreq>
    <priority>${url.priority.toFixed(1)}</priority>`;
    
    // Add hreflang alternates
    if (url.alternates && url.alternates.length > 0) {
      for (const alt of url.alternates) {
        urlElement += `
    <xhtml:link rel="alternate" hreflang="${alt.hreflang}" href="${alt.href}"/>`;
      }
    }
    
    urlElement += `
  </url>`;
    
    return urlElement;
  }).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
${urlElements}
</urlset>
`;
}

/**
 * Generate robots.txt content
 */
function generateRobotsTxt(): string {
  const disallowRules = PRIVATE_ROUTES.map(route => `Disallow: ${route}`).join('\n');
  
  // Sitemap entries for all languages
  const sitemapEntries = SUPPORTED_LANGUAGES.map(lang => 
    `Sitemap: ${SITE_URL}/sitemap-${lang.toLowerCase()}.xml`
  ).join('\n');
  
  return `# https://www.robotstxt.org/robotstxt.html
User-agent: *
Allow: /

# Sitemaps for all languages
Sitemap: ${SITE_URL}/sitemap.xml
${sitemapEntries}

# Disallow private pages
${disallowRules}

# Allow public pages
Allow: /
Allow: /landing
Allow: /register
Allow: /login
Allow: /leaderboard
Allow: /docs/api
Allow: /marketplace
Allow: /subscription
`;
}

/**
 * Generate language-specific sitemap XML
 */
function generateLanguageSitemap(lang: string, urls: SitemapUrl[]): string {
  const urlElements = urls.map(url => {
    // For language-specific sitemap, use the URL with lang parameter
    const localizedUrl = getUrlWithLang(
      url.loc.replace(SITE_URL, ''),
      lang
    );
    
    return `  <url>
    <loc>${localizedUrl}</loc>
    <lastmod>${url.lastmod}</lastmod>
    <changefreq>${url.changefreq}</changefreq>
    <priority>${url.priority.toFixed(1)}</priority>
  </url>`;
  }).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urlElements}
</urlset>
`;
}

/**
 * Main function to generate sitemap and robots.txt
 */
function main() {
  console.log('🔍 Generating SEO files with i18n support...');
  console.log(`📅 Build date: ${BUILD_DATE}`);
  console.log(`🌐 Site URL: ${SITE_URL}`);
  console.log(`🗣️  Supported languages: ${SUPPORTED_LANGUAGES.join(', ')}`);

  // Generate sitemap URLs with hreflang alternates
  const sitemapUrls: SitemapUrl[] = PUBLIC_ROUTES.map(route => ({
    loc: `${SITE_URL}${route.path}`,
    lastmod: BUILD_DATE,
    changefreq: route.changefreq as SitemapUrl['changefreq'],
    priority: route.priority,
    alternates: generateAlternates(route.path),
  }));

  // Generate main sitemap.xml with hreflang support
  const sitemapXml = generateSitemapXml(sitemapUrls);
  const sitemapPath = path.join(__dirname, '../public/sitemap.xml');
  fs.writeFileSync(sitemapPath, sitemapXml, 'utf-8');
  console.log(`✅ Generated sitemap.xml at ${sitemapPath}`);

  // Generate language-specific sitemaps
  for (const lang of SUPPORTED_LANGUAGES) {
    const langSitemapXml = generateLanguageSitemap(lang, sitemapUrls);
    const langSitemapPath = path.join(__dirname, `../public/sitemap-${lang.toLowerCase()}.xml`);
    fs.writeFileSync(langSitemapPath, langSitemapXml, 'utf-8');
    console.log(`✅ Generated sitemap-${lang.toLowerCase()}.xml at ${langSitemapPath}`);
  }

  // Generate robots.txt
  const robotsTxt = generateRobotsTxt();
  const robotsPath = path.join(__dirname, '../public/robots.txt');
  fs.writeFileSync(robotsPath, robotsTxt, 'utf-8');
  console.log(`✅ Generated robots.txt at ${robotsPath}`);

  // Output summary
  console.log('\n📊 Summary:');
  console.log(`   - ${sitemapUrls.length} URLs in main sitemap`);
  console.log(`   - ${SUPPORTED_LANGUAGES.length} language-specific sitemaps`);
  console.log(`   - ${PRIVATE_ROUTES.length} private routes blocked`);
  console.log('\n🎉 SEO files generated successfully!');
}

// Run the script
main();