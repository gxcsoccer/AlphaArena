#!/usr/bin/env node
/**
 * Performance Budget Checker
 * 
 * Issue #559: Image and Static Resource Optimization
 * 
 * This script checks if the build output meets performance budget requirements:
 * - Maximum bundle size limits
 * - Asset count limits
 * - Image size limits
 */

import fs from 'fs';
import path from 'path';

// Performance budget configuration
const PERFORMANCE_BUDGET = {
  // Maximum sizes in KB
  maxSize: {
    javascript: 500, // 500KB per JS chunk
    css: 100,        // 100KB per CSS file
    image: 200,      // 200KB per image
    font: 100,       // 100KB per font file
    total: 2000,     // 2MB total
  },
  // Maximum number of assets
  maxAssets: {
    javascript: 20,
    css: 5,
    image: 50,
    font: 5,
  },
  // Warning threshold (percentage of max)
  warningThreshold: 0.8,
};

// File type patterns
const FILE_PATTERNS = {
  javascript: /\.js$/,
  css: /\.css$/,
  image: /\.(png|jpe?g|gif|webp|avif|svg|ico)$/,
  font: /\.(woff2?|eot|ttf|otf)$/,
};

/**
 * Get file extension type
 */
function getAssetType(filename) {
  for (const [type, pattern] of Object.entries(FILE_PATTERNS)) {
    if (pattern.test(filename)) {
      return type;
    }
  }
  return 'other';
}

/**
 * Format file size in KB
 */
function formatSize(bytes) {
  return (bytes / 1024).toFixed(2);
}

/**
 * Recursively get all files in a directory
 */
function getAllFiles(dirPath, arrayOfFiles = []) {
  const files = fs.readdirSync(dirPath);
  
  for (const file of files) {
    const fullPath = path.join(dirPath, file);
    
    if (fs.statSync(fullPath).isDirectory()) {
      getAllFiles(fullPath, arrayOfFiles);
    } else {
      arrayOfFiles.push(fullPath);
    }
  }
  
  return arrayOfFiles;
}

/**
 * Analyze build output
 */
function analyzeBuild(buildDir) {
  if (!fs.existsSync(buildDir)) {
    console.error(`Build directory not found: ${buildDir}`);
    process.exit(1);
  }
  
  const files = getAllFiles(buildDir);
  const analysis = {
    javascript: [],
    css: [],
    image: [],
    font: [],
    other: [],
    totalSize: 0,
  };
  
  for (const file of files) {
    const stat = fs.statSync(file);
    const relativePath = path.relative(buildDir, file);
    const type = getAssetType(file);
    
    analysis[type].push({
      path: relativePath,
      size: stat.size,
    });
    
    analysis.totalSize += stat.size;
  }
  
  return analysis;
}

/**
 * Check if budget is exceeded
 */
function checkBudget(analysis) {
  const violations = [];
  const warnings = [];
  
  // Check total size
  const totalSizeKB = analysis.totalSize / 1024;
  if (totalSizeKB > PERFORMANCE_BUDGET.maxSize.total) {
    violations.push(`Total size ${formatSize(analysis.totalSize)}KB exceeds budget of ${PERFORMANCE_BUDGET.maxSize.total}KB`);
  } else if (totalSizeKB > PERFORMANCE_BUDGET.maxSize.total * PERFORMANCE_BUDGET.warningThreshold) {
    warnings.push(`Total size ${formatSize(analysis.totalSize)}KB is at ${(totalSizeKB / PERFORMANCE_BUDGET.maxSize.total * 100).toFixed(0)}% of budget`);
  }
  
  // Check individual asset types
  for (const [type, files] of Object.entries(analysis)) {
    if (type === 'totalSize' || type === 'other') continue;
    
    const maxFileSize = PERFORMANCE_BUDGET.maxSize[type];
    const maxCount = PERFORMANCE_BUDGET.maxAssets[type];
    
    // Check file count
    if (files.length > maxCount) {
      violations.push(`${type}: ${files.length} files exceeds maximum of ${maxCount}`);
    }
    
    // Check individual file sizes
    for (const file of files) {
      const sizeKB = file.size / 1024;
      if (sizeKB > maxFileSize) {
        violations.push(`${file.path}: ${formatSize(file.size)}KB exceeds ${maxFileSize}KB limit for ${type}`);
      } else if (sizeKB > maxFileSize * PERFORMANCE_BUDGET.warningThreshold) {
        warnings.push(`${file.path}: ${formatSize(file.size)}KB is at ${(sizeKB / maxFileSize * 100).toFixed(0)}% of ${type} limit`);
      }
    }
  }
  
  return { violations, warnings };
}

/**
 * Print report
 */
function printReport(analysis, results) {
  console.log('\n📊 Performance Budget Report\n');
  console.log('━'.repeat(60));
  
  // Print summary by type
  for (const [type, files] of Object.entries(analysis)) {
    if (type === 'totalSize' || type === 'other') continue;
    
    const totalSize = files.reduce((sum, f) => sum + f.size, 0);
    const count = files.length;
    
    console.log(`\n${type.toUpperCase()}`);
    console.log(`  Files: ${count}`);
    console.log(`  Total: ${formatSize(totalSize)}KB`);
    
    if (count > 0) {
      console.log(`  Largest: ${files.sort((a, b) => b.size - a.size)[0].path} (${formatSize(files.sort((a, b) => b.size - a.size)[0].size)}KB)`);
    }
  }
  
  console.log('\n' + '━'.repeat(60));
  console.log(`\nTOTAL: ${formatSize(analysis.totalSize)}KB`);
  
  // Print warnings
  if (results.warnings.length > 0) {
    console.log('\n⚠️  Warnings:');
    for (const warning of results.warnings) {
      console.log(`   - ${warning}`);
    }
  }
  
  // Print violations
  if (results.violations.length > 0) {
    console.log('\n❌ Violations:');
    for (const violation of results.violations) {
      console.log(`   - ${violation}`);
    }
  }
  
  console.log('\n' + '━'.repeat(60));
  
  if (results.violations.length === 0) {
    console.log('\n✅ Performance budget check passed!\n');
    return 0;
  } else {
    console.log('\n❌ Performance budget check failed!\n');
    return 1;
  }
}

// Main
const buildDir = process.argv[2] || './dist/client';
const analysis = analyzeBuild(buildDir);
const results = checkBudget(analysis);
const exitCode = printReport(analysis, results);
process.exit(exitCode);