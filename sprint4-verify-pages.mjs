import puppeteer from 'puppeteer';

const TARGET_URL = 'https://alphaarena-eight.vercel.app';

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function verifyPages() {
  const browser = await puppeteer.launch({ 
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });
  
  const pages = [
    { name: 'Home', path: '/' },
    { name: 'Dashboard', path: '/dashboard' },
    { name: 'Trades', path: '/trades' },
    { name: 'Holdings', path: '/holdings' },
    { name: 'Leaderboard', path: '/leaderboard' },
    { name: 'Strategies', path: '/strategies' }
  ];
  
  for (const p of pages) {
    console.log(`\n=== ${p.name} (${p.path}) ===`);
    try {
      await page.goto(`${TARGET_URL}${p.path}`, { waitUntil: 'networkidle0', timeout: 30000 });
      await sleep(3000);
      
      const content = await page.evaluate(() => {
        return {
          bodyText: document.body.innerText.length,
          rootHtml: document.getElementById('root')?.innerHTML.length || 0,
          hasError: document.body.innerText.includes('ErrorBoundary') || document.body.innerText.includes('加载失败'),
          title: document.title
        };
      });
      
      console.log(`  Body text: ${content.bodyText} chars`);
      console.log(`  Root HTML: ${content.rootHtml} chars`);
      console.log(`  Has error: ${content.hasError}`);
      console.log(`  Title: ${content.title}`);
      
      // Check for specific content
      const hasContent = await page.evaluate(() => {
        const text = document.body.innerText;
        return {
          hasDashboard: text.includes('Dashboard') || text.includes('仪表') || text.includes('Portfolio'),
          hasTrades: text.includes('Trade') || text.includes('交易'),
          hasHoldings: text.includes('Holding') || text.includes('持仓'),
          hasStrategies: text.includes('Strategy') || text.includes('策略'),
          hasLeaderboard: text.includes('Leaderboard') || text.includes('排行榜')
        };
      });
      
      console.log(`  Content checks:`, hasContent);
      
    } catch (error) {
      console.log(`  ERROR: ${error.message}`);
    }
  }
  
  await browser.close();
}

verifyPages().catch(console.error);
