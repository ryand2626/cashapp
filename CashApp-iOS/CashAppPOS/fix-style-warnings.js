#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Read the style warnings file
const warningsFile = path.join(__dirname, 'style-warnings.txt');
const warningsContent = fs.readFileSync(warningsFile, 'utf8');

// Parse warnings to get file paths and issues
const warnings = [];
const lines = warningsContent.split('\n');

lines.forEach((line) => {
  // Match pattern: filepath:line:col warning message
  const match = line.match(/^(.+):(\d+):(\d+)\s+warning\s+(.+)/);
  if (match) {
    warnings.push({
      file: match[1],
      line: parseInt(match[2]),
      col: parseInt(match[3]),
      message: match[4],
    });
  }
});

// Group warnings by file
const warningsByFile = {};
warnings.forEach((warning) => {
  if (!warningsByFile[warning.file]) {
    warningsByFile[warning.file] = [];
  }
  warningsByFile[warning.file].push(warning);
});

// Sort files by number of warnings (fix most problematic files first)
const sortedFiles = Object.entries(warningsByFile)
  .sort((a, b) => b[1].length - a[1].length)
  .map(([file, warnings]) => ({
    file,
    warnings,
    count: warnings.length,
  }));

console.log('\n=== React Native Style Warnings Summary ===\n');
console.log(`Total warnings: ${warnings.length}`);
console.log(`Files with warnings: ${sortedFiles.length}\n`);

// Show top 10 files with most warnings
console.log('Top 10 files with most warnings:');
sortedFiles.slice(0, 10).forEach(({ file, count }) => {
  const relPath = file.replace(/^.*\/CashApp-iOS\/CashAppPOS\//, '');
  console.log(`  ${count.toString().padStart(3)} - ${relPath}`);
});

// Count warning types
const warningTypes = {};
warnings.forEach((warning) => {
  const type = warning.message.includes('Unused style')
    ? 'unused-styles'
    : warning.message.includes('Inline style')
    ? 'inline-styles'
    : 'other';
  warningTypes[type] = (warningTypes[type] || 0) + 1;
});

console.log('\nWarning types:');
Object.entries(warningTypes).forEach(([type, count]) => {
  console.log(`  ${type}: ${count}`);
});

// Export data for processing
const outputFile = path.join(__dirname, 'warnings-analysis.json');
fs.writeFileSync(
  outputFile,
  JSON.stringify(
    {
      summary: {
        total: warnings.length,
        files: sortedFiles.length,
        types: warningTypes,
      },
      fileList: sortedFiles,
    },
    null,
    2
  )
);

console.log(`\nAnalysis saved to: warnings-analysis.json`);
