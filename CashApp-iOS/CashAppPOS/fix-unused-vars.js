#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('Fixing @typescript-eslint/no-unused-vars issues...');

// Get lint output
let lintOutput;
try {
  lintOutput = execSync('npm run lint --silent', { encoding: 'utf8' });
} catch (error) {
  lintOutput = error.stdout || '';
}

// Parse lint output for no-unused-vars issues
const lines = lintOutput.split('\n');
const fileFixes = new Map();
let currentFile = null;

lines.forEach((line) => {
  // Check if this is a file path line
  const fileMatch = line.match(/^\/[^\s]+\.(ts|tsx|js|jsx)$/);
  if (fileMatch) {
    currentFile = fileMatch[0];
    return;
  }

  // Check if this is an unused vars warning
  const issueMatch = line.match(
    /^\s*(\d+):(\d+)\s+warning\s+'([^']+)' is (defined but never used|assigned a value but never used)\./
  );
  if (issueMatch && currentFile) {
    const [, lineNum, colNum, varName] = issueMatch;
    if (!fileFixes.has(currentFile)) {
      fileFixes.set(currentFile, []);
    }
    fileFixes.get(currentFile).push({
      line: parseInt(lineNum),
      col: parseInt(colNum),
      varName,
    });
  }
});

console.log(`Found ${fileFixes.size} files with no-unused-vars issues`);

// Process each file
fileFixes.forEach((issues, filePath) => {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');

    // Sort issues by line number in reverse order to avoid offset issues
    issues.sort((a, b) => b.line - a.line);

    issues.forEach(({ line, varName }) => {
      const lineIndex = line - 1;
      if (lineIndex < lines.length) {
        const currentLine = lines[lineIndex];

        // Skip if already prefixed with underscore
        if (varName.startsWith('_')) {
          return;
        }

        // Common patterns to fix
        lines[lineIndex] = currentLine
          // Variable declarations
          .replace(new RegExp(`\\b(const|let|var)\\s+${varName}\\b`, 'g'), `$1 _${varName}`)
          // Function parameters
          .replace(new RegExp(`\\((.*?)\\b${varName}\\b`, 'g'), `($1_${varName}`)
          .replace(new RegExp(`\\b${varName}\\b(.*?)\\)`, 'g'), `_${varName}$1)`)
          // Destructuring
          .replace(new RegExp(`\\{([^}]*?)\\b${varName}\\b`, 'g'), `{$1_${varName}`)
          .replace(new RegExp(`\\b${varName}\\b([^}]*?)\\}`, 'g'), `_${varName}$1}`)
          // Import statements
          .replace(
            new RegExp(`import\\s*\\{([^}]*?)\\b${varName}\\b`, 'g'),
            `import {$1_${varName}`
          )
          // Catch handlers
          .replace(new RegExp(`catch\\s*\\(\\s*${varName}\\s*\\)`, 'g'), `catch (_${varName})`);
      }
    });

    const newContent = lines.join('\n');
    if (newContent !== content) {
      fs.writeFileSync(filePath, newContent);
      console.log(`Fixed ${issues.length} issues in ${path.relative(process.cwd(), filePath)}`);
    }
  } catch (error) {
    console.error(`Error processing ${filePath}:`, error.message);
  }
});

console.log('Done fixing no-unused-vars issues!');
