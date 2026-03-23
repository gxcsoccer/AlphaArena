/**
 * Sitemap Generator Script
 * Generates sitemap.xml and robots.txt for SEO
 * Run during build: npm run generate:sitemap
 */

import * as fs from 'fs';
import * as path from 'path';

// Site configuration
const SITE_URL = process.env.SITE_URL || 'https://alphaarena.app';
const BUILD_DATE = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format

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
}

/**
 * Generate sitemap XML content
 */
function generateSitemapXml(urls: SitemapUrl[]): string {
  const urlElements = urls.map(url => `  <url>
    <loc>${url.loc}</loc>
    <lastmod>${url.lastmod}</lastmod>
    <changefreq>${url.changefreq}</changefreq>
    <priority>${url.priority.toFixed(1)}</priority>
  </url>`).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urlElements}
</urlset>
`;
}

/**
 * Generate robots.txt content
 */
function generateRobotsTxt(): string {
  const disallowRules = PRIVATE_ROUTES.map(route => `Disallow: ${route}`).join('\n');
  
  return `# https://www.robotstxt.org/robotstxt.html
User-agent: *
Allow: /

# Sitemap
Sitemap: ${SITE_URL}/sitemap.xml

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
 * Main function to generate sitemap and robots.txt
 */
function main() {
  console.log('🔍 Generating SEO files...');
  console.log(`📅 Build date: ${BUILD_DATE}`);
  console.log(`🌐 Site URL: ${SITE_URL}`);

  // Generate sitemap URLs
  const sitemapUrls: SitemapUrl[] = PUBLIC_ROUTES.map(route => ({
    loc: `${SITE_URL}${route.path}`,
    lastmod: BUILD_DATE,
    changefreq: route.changefreq as SitemapUrl['changefreq'],
    priority: route.priority,
  }));

  // Generate sitemap.xml
  const sitemapXml = generateSitemapXml(sitemapUrls);
  const sitemapPath = path.join(__dirname, '../public/sitemap.xml');
  fs.writeFileSync(sitemapPath, sitemapXml, 'utf-8');
  console.log(`✅ Generated sitemap.xml at ${sitemapPath}`);

  // Generate robots.txt
  const robotsTxt = generateRobotsTxt();
  const robotsPath = path.join(__dirname, '../public/robots.txt');
  fs.writeFileSync(robotsPath, robotsTxt, 'utf-8');
  console.log(`✅ Generated robots.txt at ${robotsPath}`);

  // Output summary
  console.log('\n📊 Summary:');
  console.log(`   - ${sitemapUrls.length} URLs in sitemap`);
  console.log(`   - ${PRIVATE_ROUTES.length} private routes blocked`);
  console.log('\n🎉 SEO files generated successfully!');
}

// Run the script
main();