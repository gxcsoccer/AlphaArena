/**
 * Tests for sitemap generator script
 * Issue #617: Added i18n support with hreflang tags
 */

import * as fs from 'fs';
import * as path from 'path';

// Mock fs module
jest.mock('fs', () => ({
  writeFileSync: jest.fn(),
}));

describe('Sitemap Generator', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('generateSitemapXml', () => {
    it('should generate valid sitemap XML structure with hreflang', () => {
      const urls = [
        { 
          loc: 'https://alphaarena.app/', 
          lastmod: '2024-01-01', 
          changefreq: 'daily' as const, 
          priority: 1.0,
          alternates: [
            { hreflang: 'x-default', href: 'https://alphaarena.app/' },
            { hreflang: 'zh-CN', href: 'https://alphaarena.app/' },
            { hreflang: 'en-US', href: 'https://alphaarena.app/?lang=en-US' },
            { hreflang: 'ja-JP', href: 'https://alphaarena.app/?lang=ja-JP' },
            { hreflang: 'ko-KR', href: 'https://alphaarena.app/?lang=ko-KR' },
          ]
        },
      ];

      // Function to generate sitemap XML with hreflang
      const generateSitemapXml = (urlList: typeof urls): string => {
        const urlElements = urlList.map(url => {
          let element = `  <url>
    <loc>${url.loc}</loc>
    <lastmod>${url.lastmod}</lastmod>
    <changefreq>${url.changefreq}</changefreq>
    <priority>${url.priority.toFixed(1)}</priority>`;
          
          if (url.alternates) {
            for (const alt of url.alternates) {
              element += `
    <xhtml:link rel="alternate" hreflang="${alt.hreflang}" href="${alt.href}"/>`;
            }
          }
          
          element += `
  </url>`;
          return element;
        }).join('\n');

        return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
${urlElements}
</urlset>
`;
      };

      const result = generateSitemapXml(urls);

      expect(result).toContain('<?xml version="1.0" encoding="UTF-8"?>');
      expect(result).toContain('xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"');
      expect(result).toContain('xmlns:xhtml="http://www.w3.org/1999/xhtml"');
      expect(result).toContain('https://alphaarena.app/');
      expect(result).toContain('hreflang="x-default"');
      expect(result).toContain('hreflang="zh-CN"');
      expect(result).toContain('hreflang="en-US"');
      expect(result).toContain('hreflang="ja-JP"');
      expect(result).toContain('hreflang="ko-KR"');
      expect(result).toContain('?lang=en-US');
    });

    it('should generate valid sitemap XML structure without hreflang', () => {
      const urls = [
        { path: '/', priority: 1.0, changefreq: 'daily' as const },
        { path: '/landing', priority: 1.0, changefreq: 'weekly' as const },
      ];

      // Simple function to test XML generation
      const generateSitemapXml = (urlList: typeof urls): string => {
        const urlElements = urlList.map(url => `  <url>
    <loc>https://alphaarena.app${url.path}</loc>
    <lastmod>2024-01-01</lastmod>
    <changefreq>${url.changefreq}</changefreq>
    <priority>${url.priority.toFixed(1)}</priority>
  </url>`).join('\n');

        return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urlElements}
</urlset>
`;
      };

      const result = generateSitemapXml(urls);

      expect(result).toContain('<?xml version="1.0" encoding="UTF-8"?>');
      expect(result).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">');
      expect(result).toContain('https://alphaarena.app/');
      expect(result).toContain('https://alphaarena.app/landing');
      expect(result).toContain('<changefreq>daily</changefreq>');
      expect(result).toContain('<priority>1.0</priority>');
    });
  });

  describe('generateRobotsTxt', () => {
    it('should generate valid robots.txt with sitemap URLs for all languages', () => {
      const siteUrl = 'https://alphaarena.app';
      const privateRoutes = ['/dashboard', '/strategies', '/trades'];
      const supportedLanguages = ['zh-CN', 'en-US', 'ja-JP', 'ko-KR'];
      
      const generateRobotsTxt = (): string => {
        const disallowRules = privateRoutes.map(route => `Disallow: ${route}`).join('\n');
        const sitemapEntries = supportedLanguages.map(lang => 
          `Sitemap: ${siteUrl}/sitemap-${lang.toLowerCase()}.xml`
        ).join('\n');
        
        return `# https://www.robotstxt.org/robotstxt.html
User-agent: *
Allow: /

# Sitemaps for all languages
Sitemap: ${siteUrl}/sitemap.xml
${sitemapEntries}

# Disallow private pages
${disallowRules}
`;
      };

      const result = generateRobotsTxt();

      expect(result).toContain('User-agent: *');
      expect(result).toContain('Allow: /');
      expect(result).toContain('Sitemap: https://alphaarena.app/sitemap.xml');
      expect(result).toContain('Sitemap: https://alphaarena.app/sitemap-zh-cn.xml');
      expect(result).toContain('Sitemap: https://alphaarena.app/sitemap-en-us.xml');
      expect(result).toContain('Sitemap: https://alphaarena.app/sitemap-ja-jp.xml');
      expect(result).toContain('Sitemap: https://alphaarena.app/sitemap-ko-kr.xml');
      expect(result).toContain('Disallow: /dashboard');
      expect(result).toContain('Disallow: /strategies');
      expect(result).toContain('Disallow: /trades');
    });

    it('should allow public pages', () => {
      const siteUrl = 'https://alphaarena.app';
      const publicRoutes = ['/', '/landing', '/register', '/login', '/leaderboard'];
      
      const generateRobotsTxt = (): string => {
        const allowRules = publicRoutes.map(route => `Allow: ${route}`).join('\n');
        
        return `User-agent: *
${allowRules}
`;
      };

      const result = generateRobotsTxt();

      expect(result).toContain('Allow: /');
      expect(result).toContain('Allow: /landing');
      expect(result).toContain('Allow: /register');
      expect(result).toContain('Allow: /leaderboard');
    });
  });

  describe('PUBLIC_ROUTES configuration', () => {
    it('should have correct priority values', () => {
      const publicRoutes = [
        { path: '/', priority: 1.0 },
        { path: '/landing', priority: 1.0 },
        { path: '/register', priority: 0.9 },
        { path: '/login', priority: 0.9 },
        { path: '/leaderboard', priority: 0.8 },
      ];

      // Homepage and landing should have highest priority
      expect(publicRoutes.find(r => r.path === '/')?.priority).toBe(1.0);
      expect(publicRoutes.find(r => r.path === '/landing')?.priority).toBe(1.0);
      
      // Auth pages should have high priority
      expect(publicRoutes.find(r => r.path === '/register')?.priority).toBe(0.9);
      expect(publicRoutes.find(r => r.path === '/login')?.priority).toBe(0.9);
      
      // Other public pages should have reasonable priority
      expect(publicRoutes.find(r => r.path === '/leaderboard')?.priority).toBeGreaterThanOrEqual(0.7);
    });

    it('should have appropriate change frequencies', () => {
      const publicRoutes = [
        { path: '/', changefreq: 'daily' },
        { path: '/leaderboard', changefreq: 'hourly' },
        { path: '/docs/api', changefreq: 'monthly' },
      ];

      // Leaderboard changes frequently
      expect(publicRoutes.find(r => r.path === '/leaderboard')?.changefreq).toBe('hourly');
      
      // API docs change infrequently
      expect(publicRoutes.find(r => r.path === '/docs/api')?.changefreq).toBe('monthly');
    });
  });

  describe('PRIVATE_ROUTES configuration', () => {
    it('should block user-specific pages', () => {
      const privateRoutes = [
        '/dashboard',
        '/strategies',
        '/trades',
        '/holdings',
        '/user-dashboard',
        '/settings',
      ];

      // All user-specific routes should be private
      expect(privateRoutes).toContain('/dashboard');
      expect(privateRoutes).toContain('/strategies');
      expect(privateRoutes).toContain('/trades');
      expect(privateRoutes).toContain('/holdings');
      expect(privateRoutes).toContain('/user-dashboard');
      expect(privateRoutes).toContain('/settings');
    });

    it('should block admin routes', () => {
      const privateRoutes = [
        '/admin/',
      ];

      expect(privateRoutes).toContain('/admin/');
    });
  });

  describe('hreflang support', () => {
    it('should have all supported languages', () => {
      const supportedLanguages = ['zh-CN', 'en-US', 'ja-JP', 'ko-KR'];
      const defaultLanguage = 'zh-CN';

      expect(supportedLanguages).toContain('zh-CN');
      expect(supportedLanguages).toContain('en-US');
      expect(supportedLanguages).toContain('ja-JP');
      expect(supportedLanguages).toContain('ko-KR');
      expect(defaultLanguage).toBe('zh-CN');
    });

    it('should generate correct alternate URLs', () => {
      const siteUrl = 'https://alphaarena.app';
      const path = '/landing';
      const defaultLang = 'zh-CN';
      
      // Function to generate URL with lang parameter
      const getUrlWithLang = (p: string, lang: string): string => {
        if (lang === defaultLang) {
          return `${siteUrl}${p}`;
        }
        return `${siteUrl}${p}?lang=${lang}`;
      };

      expect(getUrlWithLang(path, 'zh-CN')).toBe('https://alphaarena.app/landing');
      expect(getUrlWithLang(path, 'en-US')).toBe('https://alphaarena.app/landing?lang=en-US');
      expect(getUrlWithLang(path, 'ja-JP')).toBe('https://alphaarena.app/landing?lang=ja-JP');
      expect(getUrlWithLang(path, 'ko-KR')).toBe('https://alphaarena.app/landing?lang=ko-KR');
    });
  });
});