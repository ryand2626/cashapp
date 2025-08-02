#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Get all console.log warnings from ESLint
const eslintOutput = execSync('cd CashApp-iOS/CashAppPOS && npm run lint 2>&1 || true', { 
  encoding: 'utf8',
  maxBuffer: 10 * 1024 * 1024 // 10MB buffer
});

// Parse ESLint output for console warnings
const consoleWarnings = eslintOutput
  .split('\n')
  .filter(line => line.includes('no-console'))
  .map(line => {
    const match = line.match(/^(.+):(\d+):(\d+)\s+warning\s+Unexpected console statement/);
    if (match) {
      return {
        file: match[1],
        line: parseInt(match[2]),
        column: parseInt(match[3])
      };
    }
    return null;
  })
  .filter(Boolean);

// Group by file
const fileGroups = {};
consoleWarnings.forEach(warning => {
  if (!fileGroups[warning.file]) {
    fileGroups[warning.file] = [];
  }
  fileGroups[warning.file].push(warning);
});

// Check which files already have logger import
const filesNeedingLogger = [];
const filesWithLogger = [];

Object.keys(fileGroups).forEach(file => {
  try {
    const content = fs.readFileSync(file, 'utf8');
    const hasLoggerImport = content.includes("import { logger }") || content.includes("import logger");
    
    if (hasLoggerImport) {
      filesWithLogger.push(file);
    } else {
      filesNeedingLogger.push(file);
    }
  } catch (e) {
    // File might not exist
  }
});

console.log('=== Console.log Analysis Report ===\n');
console.log(`Total files with console statements: ${Object.keys(fileGroups).length}`);
console.log(`Total console warnings: ${consoleWarnings.length}\n`);

console.log('=== Files Already Having Logger ===');
filesWithLogger.forEach(file => {
  console.log(`✓ ${file} (${fileGroups[file].length} console statements)`);
});

console.log('\n=== Files Needing Logger Import ===');
filesNeedingLogger.forEach(file => {
  console.log(`✗ ${file} (${fileGroups[file].length} console statements)`);
});

// Identify file types
const categories = {
  tests: [],
  scripts: [],
  components: [],
  services: [],
  screens: [],
  utils: [],
  other: []
};

Object.keys(fileGroups).forEach(file => {
  const warnings = fileGroups[file].length;
  const entry = { file, warnings };
  
  if (file.includes('__tests__') || file.includes('.test.')) {
    categories.tests.push(entry);
  } else if (file.includes('/scripts/') || file.endsWith('.js')) {
    categories.scripts.push(entry);
  } else if (file.includes('/components/')) {
    categories.components.push(entry);
  } else if (file.includes('/services/')) {
    categories.services.push(entry);
  } else if (file.includes('/screens/')) {
    categories.screens.push(entry);
  } else if (file.includes('/utils/')) {
    categories.utils.push(entry);
  } else {
    categories.other.push(entry);
  }
});

console.log('\n=== By Category ===');
Object.entries(categories).forEach(([cat, files]) => {
  if (files.length > 0) {
    const total = files.reduce((sum, f) => sum + f.warnings, 0);
    console.log(`\n${cat.toUpperCase()}: ${files.length} files, ${total} warnings`);
    files.forEach(f => console.log(`  ${f.file} (${f.warnings})`));
  }
});

console.log('\n=== Recommendation ===');
console.log('1. Start with test files and scripts (less critical)');
console.log('2. Then handle service and utility files');
console.log('3. Finally update components and screens');
console.log(`\nTotal console statements to fix: ${consoleWarnings.length}`);