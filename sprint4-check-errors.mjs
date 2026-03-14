import puppeteer from 'puppeteer';

const TARGET_URL = 'https://alphaarena-eight.vercel.app';

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function checkErrors() {
  const browser = await puppeteer.launch({ 
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });
  
  const consoleErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
  });
  
  page.on('pageerror', err => {
    consoleErrors.push(`Page Error: ${err.message}`);
  });
  
  // Check Trades page
  console.log('=== Trades Page ===');
  consoleErrors.length = 0;
  await page.goto(`${TARGET_URL}/trades`, { waitUntil: 'networkidle0', timeout: 30000 });
  await sleep(5000);
  
  const tradesContent = await page.evaluate(() => {
    return document.body.innerText;
  });
  console.log('Body text:', tradesContent.substring(0, 500));
  console.log('Console errors:', consoleErrors.slice(0, 10));
  
  // Check Holdings page
  console.log('\n=== Holdings Page ===');
  consoleErrors.length = 0;
  await page.goto(`${TARGET_URL}/holdings`, { waitUntil: 'networkidle0', timeout: 30000 });
  await sleep(5000);
  
  const holdingsContent = await page.evaluate(() => {
    return document.body.innerText;
  });
  console.log('Body text:', holdingsContent.substring(0, 500));
  console.log('Console errors:', consoleErrors.slice(0, 10));
  
  await browser.close();
}

checkErrors().catch(console.error);
