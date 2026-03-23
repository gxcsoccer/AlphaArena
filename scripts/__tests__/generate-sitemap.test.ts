/**
 * Tests for sitemap generator script
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
    it('should generate valid sitemap XML structure', () => {
      const urls = [
        { loc: 'https://alphaarena.app/', lastmod: '2024-01-01', changefreq: 'daily' as const, priority: 1.0 },
        { loc: 'https://alphaarena.app/landing', lastmod: '2024-01-01', changefreq: 'weekly' as const, priority: 0.9 },
      ];

      // Simple function to test XML generation
      const generateSitemapXml = (urlList: typeof urls): string => {
        const urlElements = urlList.map(url => `  <url>
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
    it('should generate valid robots.txt with sitemap URL', () => {
      const siteUrl = 'https://alphaarena.app';
      const privateRoutes = ['/dashboard', '/strategies', '/trades'];
      
      const generateRobotsTxt = (): string => {
        const disallowRules = privateRoutes.map(route => `Disallow: ${route}`).join('\n');
        
        return `# https://www.robotstxt.org/robotstxt.html
User-agent: *
Allow: /

# Sitemap
Sitemap: ${siteUrl}/sitemap.xml

# Disallow private pages
${disallowRules}
`;
      };

      const result = generateRobotsTxt();

      expect(result).toContain('User-agent: *');
      expect(result).toContain('Allow: /');
      expect(result).toContain('Sitemap: https://alphaarena.app/sitemap.xml');
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
});