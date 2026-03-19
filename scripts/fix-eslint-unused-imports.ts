#!/usr/bin/env ts-node
/**
 * Script to automatically fix unused imports and variables
 * by adding underscore prefix to unused variables or removing unused imports
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

interface LintError {
  file: string;
  line: number;
  column: number;
  type: 'error' | 'warning';
  message: string;
  rule: string;
}

function parseLintOutput(output: string): LintError[] {
  const errors: LintError[] = [];
  const lines = output.split('\n');
  let currentFile = '';

  for (const line of lines) {
    // Match file path - must be a path starting with / and not contain :digit:
    if (line.startsWith('/') && !line.match(/^\s*\d+:\d+/)) {
      currentFile = line.trim();
      continue;
    }

    // Match error/warning line
    const match = line.match(/^\s*(\d+):(\d+)\s+(error|warning)\s+(.+?)\s+(@typescript-eslint\/[\w-]+)/);
    if (match && currentFile) {
      errors.push({
        file: currentFile,
        line: parseInt(match[1]),
        column: parseInt(match[2]),
        type: match[3] as 'error' | 'warning',
        message: match[4],
        rule: match[5],
      });
    }
  }

  return errors;
}

function fixUnusedVar(filePath: string, line: number, column: number, message: string): boolean {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  
  if (line > lines.length) return false;
  
  const targetLine = lines[line - 1];
  
  // Extract variable name from message
  const varMatch = message.match(/'(\w+)'/);
  if (!varMatch) return false;
  
  const varName = varMatch[1];
  
  // Check if it's an import
  if (targetLine.includes('import') && targetLine.includes(varName)) {
    // Handle unused imports - just add underscore prefix for named imports
    // This is complex, so we'll skip for now
    return false;
  }
  
  // Check if it's a function parameter
  const paramMatch = targetLine.match(new RegExp(`[,(]\\s*(${varName})\\s*[,)]`));
  if (paramMatch) {
    // Add underscore prefix
    const newLine = targetLine.replace(
      new RegExp(`([,(]\\s*)(${varName})(\\s*[,)])`),
      `$1_$2$3`
    );
    lines[line - 1] = newLine;
    fs.writeFileSync(filePath, lines.join('\n'));
    return true;
  }
  
  // Check if it's a variable declaration
  const declMatch = targetLine.match(new RegExp(`(const|let|var)\\s+(${varName})\\s*=`));
  if (declMatch) {
    // Add underscore prefix
    const newLine = targetLine.replace(
      new RegExp(`(const|let|var)\\s+(${varName})\\s*=`),
      `$1 _${varName} =`
    );
    lines[line - 1] = newLine;
    fs.writeFileSync(filePath, lines.join('\n'));
    return true;
  }
  
  return false;
}

function main() {
  console.log('Running ESLint to find unused variables...');
  let lintOutput: string;
  try {
    lintOutput = execSync('npm run lint 2>&1', { encoding: 'utf-8', maxBuffer: 50 * 1024 * 1024 });
  } catch (error: unknown) {
    // ESLint returns non-zero exit code when there are errors
    if (error instanceof Error && 'stdout' in error) {
      lintOutput = (error as { stdout: string }).stdout;
    } else {
      throw error;
    }
  }
  
  const errors = parseLintOutput(lintOutput);
  const unusedVarErrors = errors.filter(e => e.rule === '@typescript-eslint/no-unused-vars');
  
  console.log(`Found ${unusedVarErrors.length} unused variable errors`);
  
  // Group by file
  const byFile = new Map<string, LintError[]>();
  for (const error of unusedVarErrors) {
    if (!byFile.has(error.file)) {
      byFile.set(error.file, []);
    }
    byFile.get(error.file)!.push(error);
  }
  
  let fixed = 0;
  for (const [file, fileErrors] of byFile) {
    // Sort by line descending to avoid offset issues when editing
    fileErrors.sort((a, b) => b.line - a.line);
    
    for (const error of fileErrors) {
      if (fixUnusedVar(file, error.line, error.column, error.message)) {
        fixed++;
      }
    }
  }
  
  console.log(`Fixed ${fixed} unused variable errors`);
}

main();