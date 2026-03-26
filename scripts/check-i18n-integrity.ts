#!/usr/bin/env ts-node
/**
 * i18n Translation Integrity Checker
 *
 * This script validates that all language files have consistent translation keys
 * across all namespaces. It ensures no translation keys are missing or extra
 * in any language compared to the base language (en-US).
 *
 * Exit codes:
 *   0 - All translations are complete and consistent
 *   1 - Missing or extra translation keys found
 *   2 - Error reading/parsing files
 */

import * as fs from 'fs';
import * as path from 'path';

// Configuration
const LOCALES_DIR = path.join(__dirname, '../src/client/locales');
const BASE_LANGUAGE = 'en-US';
const SUPPORTED_LANGUAGES = ['en-US', 'zh-CN', 'ja-JP', 'ko-KR'];

interface TranslationReport {
  namespace: string;
  missing: { language: string; keys: string[] }[];
  extra: { language: string; keys: string[] }[];
}

interface FlatKey {
  key: string;
  value: unknown;
}

/**
 * Recursively flatten a nested object into dot-notation keys
 */
function flattenObject(obj: Record<string, unknown>, prefix = ''): FlatKey[] {
  const result: FlatKey[] = [];

  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;

    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      result.push(...flattenObject(value as Record<string, unknown>, fullKey));
    } else {
      result.push({ key: fullKey, value });
    }
  }

  return result;
}

/**
 * Get all keys from a JSON file as a Set
 */
function getKeysFromFile(filePath: string): Set<string> {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const json = JSON.parse(content);
    const flatKeys = flattenObject(json);
    return new Set(flatKeys.map((k) => k.key));
  } catch (error) {
    console.error(`❌ Error reading ${filePath}: ${error}`);
    process.exit(2);
  }
}

/**
 * Get all namespace files for a language
 */
function getNamespaceFiles(language: string): string[] {
  const langDir = path.join(LOCALES_DIR, language);
  try {
    return fs
      .readdirSync(langDir)
      .filter((file) => file.endsWith('.json'))
      .map((file) => file.replace('.json', ''));
  } catch (error) {
    console.error(`❌ Error reading directory for ${language}: ${error}`);
    return [];
  }
}

/**
 * Compare keys between base language and other languages for a namespace
 */
function compareNamespace(namespace: string): TranslationReport {
  const report: TranslationReport = {
    namespace,
    missing: [],
    extra: [],
  };

  const baseFilePath = path.join(LOCALES_DIR, BASE_LANGUAGE, `${namespace}.json`);
  const baseKeys = getKeysFromFile(baseFilePath);

  for (const language of SUPPORTED_LANGUAGES) {
    if (language === BASE_LANGUAGE) continue;

    const filePath = path.join(LOCALES_DIR, language, `${namespace}.json`);
    const langKeys = getKeysFromFile(filePath);

    // Find missing keys (in base but not in this language)
    const missingKeys = [...baseKeys].filter((key) => !langKeys.has(key));
    if (missingKeys.length > 0) {
      report.missing.push({ language, keys: missingKeys });
    }

    // Find extra keys (in this language but not in base)
    const extraKeys = [...langKeys].filter((key) => !baseKeys.has(key));
    if (extraKeys.length > 0) {
      report.extra.push({ language, keys: extraKeys });
    }
  }

  return report;
}

/**
 * Main function
 */
function main(): void {
  console.log('🔍 Checking i18n translation integrity...\n');
  console.log(`📁 Locales directory: ${LOCALES_DIR}`);
  console.log(`🌐 Base language: ${BASE_LANGUAGE}`);
  console.log(`🌍 Supported languages: ${SUPPORTED_LANGUAGES.join(', ')}\n`);

  // Get all namespaces from base language
  const namespaces = getNamespaceFiles(BASE_LANGUAGE);
  console.log(`📋 Found ${namespaces.length} namespaces: ${namespaces.join(', ')}\n`);

  let totalIssues = 0;
  const allReports: TranslationReport[] = [];

  // Check each namespace
  for (const namespace of namespaces) {
    const report = compareNamespace(namespace);
    allReports.push(report);

    const hasIssues = report.missing.length > 0 || report.extra.length > 0;
    if (hasIssues) {
      totalIssues += report.missing.reduce((sum, m) => sum + m.keys.length, 0);
      totalIssues += report.extra.reduce((sum, e) => sum + e.keys.length, 0);
    }
  }

  // Check if all languages have all namespaces
  for (const language of SUPPORTED_LANGUAGES) {
    if (language === BASE_LANGUAGE) continue;

    const langNamespaces = getNamespaceFiles(language);
    const missingNamespaces = namespaces.filter((ns) => !langNamespaces.includes(ns));
    const extraNamespaces = langNamespaces.filter((ns) => !namespaces.includes(ns));

    if (missingNamespaces.length > 0) {
      console.error(`❌ ${language}: Missing namespaces: ${missingNamespaces.join(', ')}`);
      totalIssues += missingNamespaces.length;
    }

    if (extraNamespaces.length > 0) {
      console.error(`⚠️  ${language}: Extra namespaces (not in base): ${extraNamespaces.join(', ')}`);
    }
  }

  // Print detailed report
  console.log('\n' + '='.repeat(60));
  console.log('📊 DETAILED REPORT');
  console.log('='.repeat(60) + '\n');

  for (const report of allReports) {
    const hasIssues = report.missing.length > 0 || report.extra.length > 0;

    if (!hasIssues) {
      console.log(`✅ ${report.namespace}: OK`);
      continue;
    }

    console.log(`\n❌ ${report.namespace}:`);

    if (report.missing.length > 0) {
      console.log('   🚫 Missing keys:');
      for (const { language, keys } of report.missing) {
        console.log(`      ${language}:`);
        for (const key of keys) {
          console.log(`        - ${key}`);
        }
      }
    }

    if (report.extra.length > 0) {
      console.log('   ⚠️  Extra keys (not in base language):');
      for (const { language, keys } of report.extra) {
        console.log(`      ${language}:`);
        for (const key of keys) {
          console.log(`        + ${key}`);
        }
      }
    }
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📈 SUMMARY');
  console.log('='.repeat(60) + '\n');

  if (totalIssues === 0) {
    console.log('✅ All translations are complete and consistent!');
    console.log(`   Checked ${namespaces.length} namespaces across ${SUPPORTED_LANGUAGES.length} languages.\n`);
    process.exit(0);
  } else {
    console.error(`❌ Found ${totalIssues} translation key issues!`);
    console.error('   Please fix the missing or extra keys before merging.\n');

    // Print fix suggestion
    console.log('💡 To fix missing keys:');
    console.log('   1. Copy the key from the base language (en-US)');
    console.log('   2. Add the appropriate translation for the target language');
    console.log('   3. Re-run this script to verify\n');

    process.exit(1);
  }
}

// Run the check
main();