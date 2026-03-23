#!/usr/bin/env node
/**
 * Bundle Analysis Script
 * Analyzes the production build and reports bundle sizes
 * 
 * Usage: node scripts/bundle-analysis.mjs
 */

import { readdir, stat, readFile } from 'fs/promises';
import { join, extname } from 'path';
import { existsSync } from 'fs';

const DIST_DIR = 'dist/client';

async function getFiles(dir, baseDir = dir) {
  const files = [];
  const entries = await readdir(dir, { withFileTypes: true });
  
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...await getFiles(fullPath, baseDir));
    } else {
      const stats = await stat(fullPath);
      files.push({
        path: fullPath.replace(baseDir, ''),
        size: stats.size,
        extension: extname(entry.name),
      });
    }
  }
  
  return files;
}

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} kB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function estimateGzip(bytes) {
  // Rough estimate: gzip typically compresses JS to ~30% of original
  return bytes * 0.3;
}

async function main() {
  console.log('📦 Bundle Analysis Report\n');
  console.log('=' .repeat(60));
  
  if (!existsSync(DIST_DIR)) {
    console.error('❌ Build output not found. Run `npm run build:client` first.');
    process.exit(1);
  }
  
  const files = await getFiles(DIST_DIR);
  
  // Group by type
  const jsFiles = files.filter(f => f.extension === '.js');
  const cssFiles = files.filter(f => f.extension === '.css');
  const otherFiles = files.filter(f => !['.js', '.css', '.html', '.map'].includes(f.extension));
  
  // Sort by size
  jsFiles.sort((a, b) => b.size - a.size);
  cssFiles.sort((a, b) => b.size - a.size);
  
  // Calculate totals
  const totalJs = jsFiles.reduce((sum, f) => sum + f.size, 0);
  const totalCss = cssFiles.reduce((sum, f) => sum + f.size, 0);
  
  console.log('\n📊 JavaScript Chunks (sorted by size):\n');
  console.log('File'.padEnd(55) + 'Size'.padStart(10) + 'Gzip Est.'.padStart(12));
  console.log('-'.repeat(77));
  
  for (const file of jsFiles) {
    const gzipEst = estimateGzip(file.size);
    console.log(
      file.path.padEnd(55) + 
      formatSize(file.size).padStart(10) + 
      formatSize(gzipEst).padStart(12)
    );
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('\n🎨 CSS Files:\n');
  console.log('File'.padEnd(55) + 'Size'.padStart(10));
  console.log('-'.repeat(65));
  
  for (const file of cssFiles) {
    console.log(file.path.padEnd(55) + formatSize(file.size).padStart(10));
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('\n📈 Summary:\n');
  console.log(`Total JavaScript: ${formatSize(totalJs)} (estimated gzip: ${formatSize(estimateGzip(totalJs))})`);
  console.log(`Total CSS:        ${formatSize(totalCss)}`);
  console.log(`Total Assets:     ${formatSize(totalJs + totalCss)}`);
  
  // Identify large chunks
  const largeChunks = jsFiles.filter(f => f.size > 500 * 1024);
  if (largeChunks.length > 0) {
    console.log('\n⚠️  Large chunks (>500KB) that may need optimization:');
    for (const chunk of largeChunks) {
      console.log(`  - ${chunk.path} (${formatSize(chunk.size)})`);
    }
  }
  
  // Identify potential issues
  console.log('\n🔍 Optimization Suggestions:\n');
  
  // Check for swagger-ui
  const swaggerChunk = jsFiles.find(f => f.path.includes('swagger'));
  if (swaggerChunk && swaggerChunk.size > 500 * 1024) {
    console.log('✓ swagger-ui is large but already code-split.');
    console.log('  Consider lazy loading it only on the API docs page.');
  }
  
  // Check for arco-design
  const arcoChunk = jsFiles.find(f => f.path.includes('arco'));
  if (arcoChunk && arcoChunk.size > 500 * 1024) {
    console.log('\n⚠️  arco-design chunk is large (' + formatSize(arcoChunk.size) + ').');
    console.log('  Consider:');
    console.log('  - Using vite-plugin-style-import for more granular imports');
    console.log('  - Replacing unused components with lighter alternatives');
    console.log('  - Checking if all imported components are actually used');
  }
  
  // Check index chunk
  const indexChunk = jsFiles.find(f => f.path.includes('index'));
  if (indexChunk && indexChunk.size > 200 * 1024) {
    console.log('\n⚠️  Main index chunk is large (' + formatSize(indexChunk.size) + ').');
    console.log('  Consider:');
    console.log('  - Lazy loading non-critical components');
    console.log('  - Extracting large dependencies into separate chunks');
  }
  
  // Check for recharts
  const rechartsChunk = jsFiles.find(f => f.path.includes('recharts'));
  if (rechartsChunk) {
    console.log('\n✓ recharts is code-split into a separate chunk.');
  }
  
  // Check for lightweight-charts
  const chartsChunk = jsFiles.find(f => f.path.includes('lightweight-charts'));
  if (chartsChunk) {
    console.log('✓ lightweight-charts is code-split into a separate chunk.');
  }
  
  console.log('\n' + '='.repeat(60));
  
  // Homepage load analysis
  console.log('\n🏠 Homepage Load Analysis (authenticated user):\n');
  const homePageChunk = jsFiles.find(f => f.path.includes('HomePage'));
  const reactVendorChunk = jsFiles.find(f => f.path.includes('react-vendor'));
  const reactRouterChunk = jsFiles.find(f => f.path.includes('react-router'));
  const klineChartChunk = jsFiles.find(f => f.path.includes('KLineChart'));
  const arcoIconsChunk = jsFiles.find(f => f.path.includes('arco-icons'));
  
  // Core files that are always loaded
  const coreLoadFiles = [
    { name: 'index.js', file: indexChunk },
    { name: 'react-vendor.js', file: reactVendorChunk },
    { name: 'react-router.js', file: reactRouterChunk },
    { name: 'arco-design.js', file: arcoChunk },
    { name: 'HomePage.js', file: homePageChunk },
  ].filter(f => f.file);
  
  // Secondary files (likely loaded for full functionality)
  const secondaryFiles = [
    { name: 'arco-icons.js', file: arcoIconsChunk },
  ].filter(f => f.file);
  
  // Lazy-loaded files (only loaded when user interacts with chart)
  const lazyLoadFiles = [
    { name: 'lightweight-charts.js', file: chartsChunk },
    { name: 'KLineChart.js', file: klineChartChunk },
  ].filter(f => f.file);
  
  const coreLoadTotal = coreLoadFiles.reduce((sum, f) => sum + f.file.size, 0);
  const secondaryTotal = secondaryFiles.reduce((sum, f) => sum + f.file.size, 0);
  const lazyLoadTotal = lazyLoadFiles.reduce((sum, f) => sum + f.file.size, 0);
  
  console.log('Core files (loaded immediately):');
  for (const f of coreLoadFiles) {
    console.log(`  - ${f.name.padEnd(25)} ${formatSize(f.file.size).padStart(10)} (gzip: ${formatSize(estimateGzip(f.file.size))})`);
  }
  console.log('\n' + '-'.repeat(60));
  console.log(`Core total: ${formatSize(coreLoadTotal)} (estimated gzip: ${formatSize(estimateGzip(coreLoadTotal))})`);
  
  console.log('\n\nSecondary files (loaded with navigation):');
  for (const f of secondaryFiles) {
    console.log(`  - ${f.name.padEnd(25)} ${formatSize(f.file.size).padStart(10)} (gzip: ${formatSize(estimateGzip(f.file.size))})`);
  }
  
  console.log('\n\nLazy-loaded files (loaded when chart is viewed):');
  for (const f of lazyLoadFiles) {
    console.log(`  - ${f.name.padEnd(25)} ${formatSize(f.file.size).padStart(10)} (gzip: ${formatSize(estimateGzip(f.file.size))})`);
  }
  console.log('\n' + '-'.repeat(60));
  console.log(`Lazy total: ${formatSize(lazyLoadTotal)} (estimated gzip: ${formatSize(estimateGzip(lazyLoadTotal))})`);
  
  // Check against target
  const coreGzipEst = estimateGzip(coreLoadTotal);
  const targetGzip = 200 * 1024;
  
  console.log(`\n🎯 Target: < 200KB gzip for initial page load`);
  if (coreGzipEst <= targetGzip) {
    console.log(`✅ PASS: Core JS is ${formatSize(coreGzipEst)} gzip`);
  } else {
    console.log(`❌ FAIL: Core JS is ${formatSize(coreGzipEst)} gzip (${formatSize(coreGzipEst - targetGzip)} over target)`);
  }
  
  const totalWithSecondary = estimateGzip(coreLoadTotal + secondaryTotal);
  const totalWithLazy = estimateGzip(coreLoadTotal + secondaryTotal + lazyLoadTotal);
  
  console.log(`\n📊 With icons: ${formatSize(totalWithSecondary)} gzip`);
  console.log(`📊 Full experience (after lazy loading): ${formatSize(totalWithLazy)} gzip`);
  
  console.log('\n');
}

main().catch(console.error);