#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

function findUnusedStyles(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');

  // Extract style definitions from StyleSheet.create
  const styleSheetMatch = content.match(/StyleSheet\.create\(\{[\s\S]*?\}\);/);
  if (!styleSheetMatch) {
    console.log('No StyleSheet.create found');
    return;
  }

  const styleSheet = styleSheetMatch[0];
  const styleNames = [];

  // Extract style names
  const styleRegex = /^\s*(\w+):\s*\{/gm;
  let match;
  while ((match = styleRegex.exec(styleSheet)) !== null) {
    styleNames.push(match[1]);
  }

  console.log(`Found ${styleNames.length} style definitions`);

  // Check usage of each style
  const unusedStyles = [];
  styleNames.forEach((styleName) => {
    // Look for styles.styleName or propStyles.styleName
    const usageRegex = new RegExp(`(styles|propStyles)\\.${styleName}(?!\\w)`, 'g');
    const matches = content.match(usageRegex);

    // Count matches excluding the definition itself
    const usageCount = matches ? matches.length : 0;

    if (usageCount === 0) {
      unusedStyles.push(styleName);
    }
  });

  return unusedStyles;
}

// Run the script
const filePath = process.argv[2] || 'src/screens/main/POSScreen.tsx';
console.log(`Analyzing: ${filePath}\n`);

const unusedStyles = findUnusedStyles(filePath);

if (unusedStyles && unusedStyles.length > 0) {
  console.log(`\nFound ${unusedStyles.length} unused styles:`);
  unusedStyles.forEach((style) => {
    console.log(`  - ${style}`);
  });
} else {
  console.log('\nNo unused styles found!');
}
