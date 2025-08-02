#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

function findUnusedStyles(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');

  // Find all style definitions in StyleSheet.create()
  const styleSheetMatch = content.match(/StyleSheet\.create\(\{[\s\S]*?\}\)/);
  if (!styleSheetMatch) return [];

  const styleSheet = styleSheetMatch[0];
  const styleNames = [];

  // Extract style names from the stylesheet
  const stylePattern = /(\w+):\s*\{/g;
  let match;
  while ((match = stylePattern.exec(styleSheet)) !== null) {
    styleNames.push(match[1]);
  }

  // Check which styles are used in the component
  const unusedStyles = [];
  for (const styleName of styleNames) {
    // Look for usage patterns like styles.styleName, [styles.styleName], style={styles.styleName}
    const usagePatterns = [
      new RegExp(`styles\\.${styleName}(?![\\w])`, 'g'),
      new RegExp(`\\[.*styles\\.${styleName}.*\\]`, 'g'),
      new RegExp(`style=\\{.*styles\\.${styleName}.*\\}`, 'g'),
    ];

    let isUsed = false;
    for (const pattern of usagePatterns) {
      if (pattern.test(content.replace(styleSheet, ''))) {
        isUsed = true;
        break;
      }
    }

    if (!isUsed) {
      unusedStyles.push(styleName);
    }
  }

  return unusedStyles;
}

// Process file passed as argument
const filePath = process.argv[2];
if (!filePath) {
  console.error('Usage: node find-unused-styles.js <file-path>');
  process.exit(1);
}

const unusedStyles = findUnusedStyles(filePath);
if (unusedStyles.length > 0) {
  console.log(`Unused styles in ${path.basename(filePath)}:`);
  unusedStyles.forEach((style) => console.log(`  - ${style}`));
} else {
  console.log(`No unused styles found in ${path.basename(filePath)}`);
}
