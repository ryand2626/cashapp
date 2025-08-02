#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('Fixing @typescript-eslint/no-explicit-any issues...');

// Get lint output
let lintOutput;
try {
  lintOutput = execSync('npm run lint --silent', { encoding: 'utf8' });
} catch (error) {
  lintOutput = error.stdout || '';
}

// Parse lint output for no-explicit-any issues
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

  // Check if this is an error/warning line
  const issueMatch = line.match(
    /^\s*(\d+):(\d+)\s+(warning|error)\s+Unexpected any\.\s+Specify a different type\s+@typescript-eslint\/no-explicit-any/
  );
  if (issueMatch && currentFile) {
    const [, lineNum, colNum] = issueMatch;
    if (!fileFixes.has(currentFile)) {
      fileFixes.set(currentFile, []);
    }
    fileFixes.get(currentFile).push({ line: parseInt(lineNum), col: parseInt(colNum) });
  }
});

console.log(`Found ${fileFixes.size} files with no-explicit-any issues`);

// Process each file
fileFixes.forEach((issues, filePath) => {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');

    // Sort issues by line number in reverse order to avoid offset issues
    issues.sort((a, b) => b.line - a.line);

    issues.forEach(({ line }) => {
      const lineIndex = line - 1;
      if (lineIndex < lines.length) {
        const currentLine = lines[lineIndex];

        // Common patterns to fix
        lines[lineIndex] = currentLine
          // Function parameters
          .replace(/\(([^:)]+):\s*any\)/g, '($1: unknown)')
          .replace(/\(([^:)]+):\s*any,/g, '($1: unknown,')
          .replace(/,\s*([^:)]+):\s*any\)/g, ', $1: unknown)')
          .replace(/,\s*([^:)]+):\s*any,/g, ', $1: unknown,')
          // Type annotations
          .replace(/:\s*any\[\]/g, ': unknown[]')
          .replace(/:\s*any\s*$/g, ': unknown')
          .replace(/:\s*any\s*=/g, ': unknown =')
          .replace(/:\s*any;/g, ': unknown;')
          .replace(/:\s*any,/g, ': unknown,')
          .replace(/:\s*any\)/g, ': unknown)')
          .replace(/:\s*Record<string,\s*any>/g, ': Record<string, unknown>')
          // Generic types
          .replace(/<any>/g, '<unknown>')
          .replace(/Promise<any>/g, 'Promise<unknown>')
          .replace(/Array<any>/g, 'Array<unknown>')
          // Type assertions
          .replace(/\s+as\s+any/g, ' as unknown')
          // Catch handlers
          .replace(/catch\s*\(([^:)]+):\s*any\)/g, 'catch ($1: unknown)');
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

console.log('Done fixing no-explicit-any issues!');
