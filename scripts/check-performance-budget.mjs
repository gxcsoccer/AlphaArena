#!/usr/bin/env node

/**
 * Performance Budget Checker
 * Validates bundle sizes against defined performance budgets
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { join, extname } from 'path';

// Performance budget configuration
const BUDGETS = {
  // Bundle size limits (in bytes)
  total: 2 * 1024 * 1024, // 2MB total
  scripts: 500 * 1024, // 500KB for JS
  styles: 100 * 1024,  // 100KB for CSS
  images: 500 * 1024,  // 500KB for images
  fonts: 100 * 1024,   // 100KB for fonts
  
  // Individual chunk limits
  chunkLimit: 500 * 1024, // 500KB per chunk
  
  // Timing budgets (in ms, for reference)
  timings: {
    fcp: 1800,
    lcp: 2500,
    tbt: 200,
    cls: 0.1,
    si: 3000,
  },
};

// File type categories
const FILE_TYPES = {
  scripts: ['.js', '.mjs'],
  styles: ['.css'],
  images: ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.ico'],
  fonts: ['.woff', '.woff2', '.ttf', '.eot'],
};

// Color codes for terminal output
const COLORS = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m',
};

/**
 * Format bytes to human readable string
 */
function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  
  return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${units[i]}`;
}

/**
 * Get file type category
 */
function getFileType(ext) {
  for (const [type, extensions] of Object.entries(FILE_TYPES)) {
    if (extensions.includes(ext)) {
      return type;
    }
  }
  return 'other';
}

/**
 * Analyze bundle sizes
 */
function analyzeBundleSizes(distPath) {
  const sizes = {
    total: 0,
    scripts: 0,
    styles: 0,
    images: 0,
    fonts: 0,
    other: 0,
    chunks: [],
  };

  function walkDirectory(dir) {
    const files = readdirSync(dir);
    
    for (const file of files) {
      const filePath = join(dir, file);
      const stat = statSync(filePath);
      
      if (stat.isDirectory()) {
        walkDirectory(filePath);
        continue;
      }
      
      const ext = extname(file);
      const type = getFileType(ext);
      const size = stat.size;
      
      sizes.total += size;
      sizes[type] += size;
      
      // Track individual chunks over limit
      if (type === 'scripts' && size > BUDGETS.chunkLimit) {
        sizes.chunks.push({
          name: file,
          size,
          type,
        });
      }
    }
  }

  try {
    walkDirectory(distPath);
  } catch (error) {
    console.error(`${COLORS.red}Error analyzing bundle: ${error.message}${COLORS.reset}`);
    return null;
  }

  return sizes;
}

/**
 * Check budget compliance
 */
function checkBudget(sizes) {
  const results = {
    passed: true,
    warnings: [],
    errors: [],
  };

  // Check total size
  if (sizes.total > BUDGETS.total) {
    results.errors.push({
      type: 'total',
      actual: sizes.total,
      budget: BUDGETS.total,
      message: `Total size ${formatBytes(sizes.total)} exceeds budget of ${formatBytes(BUDGETS.total)}`,
    });
    results.passed = false;
  }

  // Check individual categories
  for (const [type, budget] of Object.entries(BUDGETS)) {
    if (type === 'total' || type === 'chunkLimit' || type === 'timings') continue;
    
    if (sizes[type] > budget) {
      results.warnings.push({
        type,
        actual: sizes[type],
        budget,
        message: `${type} size ${formatBytes(sizes[type])} exceeds budget of ${formatBytes(budget)}`,
      });
    }
  }

  // Check large chunks
  for (const chunk of sizes.chunks) {
    results.warnings.push({
      type: 'chunk',
      name: chunk.name,
      actual: chunk.size,
      budget: BUDGETS.chunkLimit,
      message: `Large chunk ${chunk.name} (${formatBytes(chunk.size)}) exceeds ${formatBytes(BUDGETS.chunkLimit)}`,
    });
  }

  return results;
}

/**
 * Print results
 */
function printResults(sizes, results) {
  console.log(`\n${COLORS.bold}📊 Performance Budget Report${COLORS.reset}\n`);
  
  // Size summary
  console.log(`${COLORS.cyan}Bundle Sizes:${COLORS.reset}`);
  console.log(`  Total:    ${formatBytes(sizes.total)}`);
  console.log(`  Scripts:  ${formatBytes(sizes.scripts)}`);
  console.log(`  Styles:   ${formatBytes(sizes.styles)}`);
  console.log(`  Images:   ${formatBytes(sizes.images)}`);
  console.log(`  Fonts:    ${formatBytes(sizes.fonts)}`);
  console.log(`  Other:    ${formatBytes(sizes.other)}`);
  
  // Large chunks
  if (sizes.chunks.length > 0) {
    console.log(`\n${COLORS.yellow}⚠️  Large Chunks:${COLORS.reset}`);
    for (const chunk of sizes.chunks) {
      console.log(`  ${chunk.name}: ${formatBytes(chunk.size)}`);
    }
  }
  
  // Errors
  if (results.errors.length > 0) {
    console.log(`\n${COLORS.red}❌ Budget Violations:${COLORS.reset}`);
    for (const error of results.errors) {
      console.log(`  ${error.message}`);
    }
  }
  
  // Warnings
  if (results.warnings.length > 0) {
    console.log(`\n${COLORS.yellow}⚠️  Warnings:${COLORS.reset}`);
    for (const warning of results.warnings) {
      console.log(`  ${warning.message}`);
    }
  }
  
  // Result
  console.log('\n' + '='.repeat(50));
  if (results.passed) {
    console.log(`${COLORS.green}✅ Performance budget check passed!${COLORS.reset}`);
  } else {
    console.log(`${COLORS.red}❌ Performance budget check failed!${COLORS.reset}`);
  }
  console.log('='.repeat(50) + '\n');
}

// Main execution
const distPath = process.argv[2] || './dist/client';

console.log(`${COLORS.cyan}Analyzing bundle at: ${distPath}${COLORS.reset}`);

const sizes = analyzeBundleSizes(distPath);

if (!sizes) {
  console.error(`${COLORS.red}Failed to analyze bundle sizes${COLORS.reset}`);
  process.exit(1);
}

const results = checkBudget(sizes);
printResults(sizes, results);

// Exit with appropriate code
process.exit(results.passed ? 0 : 1);