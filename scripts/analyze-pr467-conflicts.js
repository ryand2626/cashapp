#!/usr/bin/env node

/**
 * Script to analyze PR #467 conflicts and categorize changes
 * This will help us understand what can be cherry-picked safely
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Get list of changed files
const changedFiles = execSync('git diff --name-only main', { encoding: 'utf8' })
  .trim()
  .split('\n')
  .filter(Boolean);

// Get list of conflicted files during merge
const conflictedFiles = new Set();
try {
  // Attempt a dry-run merge to identify conflicts
  execSync('git merge main --no-commit --no-ff 2>&1', { encoding: 'utf8' });
} catch (error) {
  // Parse the error output for conflict files
  const output = error.stdout || error.output?.join('') || '';
  const conflictLines = output.split('\n').filter(line => line.includes('CONFLICT'));
  
  conflictLines.forEach(line => {
    const match = line.match(/CONFLICT.*in (.+)$/);
    if (match && match[1]) {
      conflictedFiles.add(match[1]);
    }
  });
  
  // Abort the merge
  try {
    execSync('git merge --abort 2>&1');
  } catch (e) {
    // Ignore abort errors
  }
}

// Categorize files
const categories = {
  eslintConfig: [],
  testFiles: [],
  componentFiles: [],
  utilityFiles: [],
  serviceFiles: [],
  storeFiles: [],
  screenFiles: [],
  scriptsFiles: [],
  githubWorkflows: [],
  documentation: [],
  other: []
};

// Files that can likely be applied without conflicts
const safeFiles = [];
const conflictFiles = Array.from(conflictedFiles);

changedFiles.forEach(file => {
  const isConflicted = conflictedFiles.has(file);
  
  // Categorize by type
  if (file.includes('.eslintrc') || file.includes('prettier')) {
    categories.eslintConfig.push({ file, isConflicted });
  } else if (file.includes('__tests__') || file.includes('.test.') || file.includes('.spec.')) {
    categories.testFiles.push({ file, isConflicted });
  } else if (file.includes('/components/')) {
    categories.componentFiles.push({ file, isConflicted });
  } else if (file.includes('/utils/')) {
    categories.utilityFiles.push({ file, isConflicted });
  } else if (file.includes('/services/')) {
    categories.serviceFiles.push({ file, isConflicted });
  } else if (file.includes('/store/')) {
    categories.storeFiles.push({ file, isConflicted });
  } else if (file.includes('/screens/')) {
    categories.screenFiles.push({ file, isConflicted });
  } else if (file.includes('/scripts/')) {
    categories.scriptsFiles.push({ file, isConflicted });
  } else if (file.includes('.github/workflows/')) {
    categories.githubWorkflows.push({ file, isConflicted });
  } else if (file.endsWith('.md')) {
    categories.documentation.push({ file, isConflicted });
  } else {
    categories.other.push({ file, isConflicted });
  }
  
  if (!isConflicted) {
    safeFiles.push(file);
  }
});

// Generate report
console.log('=== PR #467 Conflict Analysis Report ===\n');
console.log(`Total files changed: ${changedFiles.length}`);
console.log(`Files with conflicts: ${conflictFiles.length}`);
console.log(`Files without conflicts: ${safeFiles.length}\n`);

console.log('=== Categories Breakdown ===\n');
Object.entries(categories).forEach(([category, files]) => {
  if (files.length > 0) {
    const conflicted = files.filter(f => f.isConflicted).length;
    const safe = files.filter(f => !f.isConflicted).length;
    console.log(`${category}: ${files.length} files (${safe} safe, ${conflicted} conflicted)`);
  }
});

// Analyze change types in a sample of files
console.log('\n=== Common Change Patterns ===\n');
const sampleFiles = changedFiles.slice(0, 10).filter(f => f.endsWith('.ts') || f.endsWith('.tsx'));

sampleFiles.forEach(file => {
  try {
    const diff = execSync(`git diff main -- "${file}" | head -50`, { encoding: 'utf8' });
    
    // Count specific types of changes
    const hasLoggerChanges = diff.includes('logger.') || diff.includes('console.');
    const hasImportChanges = diff.includes('import ');
    const hasTypeChanges = diff.includes(': any') || diff.includes(': unknown');
    
    if (hasLoggerChanges || hasImportChanges || hasTypeChanges) {
      console.log(`${file}:`);
      if (hasLoggerChanges) console.log('  - Console to logger conversions');
      if (hasImportChanges) console.log('  - Import statement changes');
      if (hasTypeChanges) console.log('  - Type annotation changes');
    }
  } catch (e) {
    // Ignore diff errors
  }
});

// Write safe files list for cherry-picking
fs.writeFileSync(
  path.join(__dirname, 'pr467-safe-files.txt'),
  safeFiles.join('\n'),
  'utf8'
);

console.log('\n=== Recommendations ===\n');
console.log('1. Start by applying changes to files without conflicts');
console.log('2. Focus on ESLint config files first to establish rules');
console.log('3. Apply test file changes as they are usually isolated');
console.log('4. Handle component and utility files in batches');
console.log('5. Address conflicted files last with manual resolution\n');
console.log(`Safe files list written to: ${path.join(__dirname, 'pr467-safe-files.txt')}`);