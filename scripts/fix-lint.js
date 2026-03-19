#!/usr/bin/env node
/**
 * Script to fix common ESLint issues:
 * 1. Remove unused imports
 * 2. Add underscore prefix to unused catch variables
 * 3. Add underscore prefix to unused function parameters
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Get lint output in JSON format
const lintCmd = 'npx eslint . --ext .ts,.tsx --format json';
let lintResult;
try {
  lintResult = execSync(lintCmd, { encoding: 'utf-8', maxBuffer: 100 * 1024 * 1024 });
} catch (e) {
  lintResult = e.stdout;
}

const results = JSON.parse(lintResult);

let fixedImports = 0;
let fixedUnusedVars = 0;
let fixedParams = 0;

for (const file of results) {
  if (!file.filePath.includes('/src/') && !file.filePath.includes('/tests/') && !file.filePath.includes('/scripts/')) {
    continue;
  }

  const filePath = file.filePath;
  let content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');

  // Collect all unused import issues
  const unusedImports = new Map(); // Map of import name -> [{line, isTypeOnly}]
  const otherIssues = [];

  for (const msg of file.messages) {
    if (msg.ruleId !== '@typescript-eslint/no-unused-vars') continue;
    
    const match = msg.message.match(/'(\w+)'/);
    if (!match) continue;
    const varName = match[1];
    
    const line = lines[msg.line - 1];
    
    // Check if this is an import statement
    if (line && (line.trim().startsWith('import ') || line.includes(' from '))) {
      // This is an import line
      if (!unusedImports.has(msg.line)) {
        unusedImports.set(msg.line, []);
      }
      unusedImports.get(msg.line).push({
        name: varName,
        column: msg.column,
        isTypeOnly: line.includes('import type'),
        line: msg.line
      });
    } else {
      otherIssues.push({
        line: msg.line,
        column: msg.column,
        message: msg.message,
        rule: msg.ruleId
      });
    }
  }

  // Process unused imports - remove them from import statements
  const linesToRemove = new Set();
  for (const [lineNum, imports] of unusedImports) {
    const lineIndex = lineNum - 1;
    let line = lines[lineIndex];
    
    // Get all import names from this line
    for (const imp of imports) {
      const varName = imp.name;
      
      // Handle different import patterns
      // Pattern 1: import { A, B, C } from 'module'
      if (line.includes('{') && line.includes('}')) {
        // Multiple imports - try to remove just this one
        let newLine = line;
        
        // Try to remove the import name with different patterns
        // Pattern: , A or A, or { A }
        newLine = newLine.replace(new RegExp(`,\\s*${varName}\\b`), '');
        newLine = newLine.replace(new RegExp(`\\{\\s*${varName}\\s*,`), '{ ');
        newLine = newLine.replace(new RegExp(`,\\s*${varName}\\s*\\}`), ' }');
        newLine = newLine.replace(new RegExp(`\\{\\s*${varName}\\s*\\}`), '{}');
        
        if (newLine !== line) {
          // Check if all imports were removed
          if (newLine.match(/\{\s*\}/)) {
            // Remove the whole import
            linesToRemove.add(lineIndex);
          } else {
            lines[lineIndex] = newLine;
          }
          fixedImports++;
        }
      } else {
        // Single import or default import
        // Check if it's the only import on this line
        if (line.match(new RegExp(`import\\s+${varName}\\s+from`))) {
          linesToRemove.add(lineIndex);
          fixedImports++;
        } else if (line.match(new RegExp(`import\\s+type\\s+${varName}\\s+from`))) {
          linesToRemove.add(lineIndex);
          fixedImports++;
        }
      }
    }
  }

  // Remove empty import lines (in reverse order)
  const indicesToRemove = Array.from(linesToRemove).sort((a, b) => b - a);
  for (const idx of indicesToRemove) {
    lines.splice(idx, 1);
  }

  // Now process other unused variables (need to adjust line numbers)
  // Re-read the lines since we may have removed some
  content = lines.join('\n');
  const updatedLines = content.split('\n');

  // Get updated lint errors
  try {
    const updatedLint = execSync(`npx eslint "${filePath}" --format json`, { encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024 });
    const updatedResults = JSON.parse(updatedLint);
    const updatedMessages = updatedResults[0]?.messages || [];
    
    const remainingIssues = updatedMessages.filter(m => m.ruleId === '@typescript-eslint/no-unused-vars');
    const sortedIssues = remainingIssues.sort((a, b) => b.line - a.line);
    
    for (const issue of sortedIssues) {
      const match = issue.message.match(/'(\w+)'/);
      if (!match) continue;
      const varName = match[1];
      
      if (varName.startsWith('_')) continue;
      
      const lineIndex = issue.line - 1;
      let line = updatedLines[lineIndex];
      if (!line) continue;
      
      // Handle catch block
      if (line.includes('catch') && line.includes(varName)) {
        const newLine = line.replace(
          new RegExp(`catch\\s*\\(\\s*${varName}\\s*\\)`),
          `catch (_${varName})`
        );
        if (newLine !== line) {
          updatedLines[lineIndex] = newLine;
          fixedUnusedVars++;
          continue;
        }
      }
      
      // Handle function parameters
      if (line.match(new RegExp(`[,(]\\s*${varName}\\s*[,)]`))) {
        if (line.trim().startsWith('import ') || line.includes(' from ')) {
          continue;
        }
        
        const newLine = line.replace(
          new RegExp(`([,(]\\s*)${varName}(\\s*[,)])`),
          `$1_${varName}$2`
        );
        if (newLine !== line) {
          updatedLines[lineIndex] = newLine;
          fixedParams++;
          continue;
        }
      }
      
      // Handle destructured variables
      const destructureMatch = line.match(new RegExp(`\\b(\\w+)\\s*:\\s*${varName}\\b`));
      if (destructureMatch) {
        const newLine = line.replace(
          new RegExp(`(\\w+)\\s*:\\s*${varName}\\b`),
          `$1: _${varName}`
        );
        if (newLine !== line) {
          updatedLines[lineIndex] = newLine;
          fixedUnusedVars++;
          continue;
        }
      }
      
      // Handle simple const/let/var declarations
      const constMatch = line.match(new RegExp(`(const|let|var)\\s+(\\w+)\\s*=`));
      if (constMatch && constMatch[2] === varName) {
        const newLine = line.replace(
          new RegExp(`(const|let|var)\\s+${varName}\\s*=`),
          `$1 _${varName} =`
        );
        if (newLine !== line) {
          updatedLines[lineIndex] = newLine;
          fixedUnusedVars++;
          continue;
        }
      }
    }
  } catch (e) {
    // Continue with what we have
  }

  // Write back if changed
  const newContent = updatedLines.join('\n');
  if (newContent !== fs.readFileSync(filePath, 'utf-8')) {
    fs.writeFileSync(filePath, newContent);
    console.log(`Fixed: ${path.relative(process.cwd(), filePath)}`);
  }
}

console.log(`\nSummary:`);
console.log(`  Fixed ${fixedImports} unused import issues`);
console.log(`  Fixed ${fixedUnusedVars} unused variable issues`);
console.log(`  Fixed ${fixedParams} unused parameter issues`);