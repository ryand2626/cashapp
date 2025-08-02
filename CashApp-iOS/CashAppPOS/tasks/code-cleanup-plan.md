# Code Cleanup Plan for PR #467

## Overview
We have 2,312 ESLint issues to clean up. This plan organizes the cleanup into safe, systematic steps.

## Phase 1: Remove Unused Styles (862 issues)
- [ ] Analyze StyleSheet.create() calls in each component
- [ ] Identify which styles are actually used in the render
- [ ] Remove unused style definitions
- [ ] Priority files with most unused styles

## Phase 2: Remove Unused Variables and Imports (308+ issues)
- [ ] Remove unused imports from each file
- [ ] Remove unused variable declarations
- [ ] Clean up unused function parameters
- [ ] Organize imports properly

## Phase 3: Fix TypeScript 'any' Types (427 issues)
- [ ] Identify all 'any' type usages
- [ ] Replace with proper interfaces/types
- [ ] Create shared type definitions where needed
- [ ] Update function signatures

## Phase 4: Fix Undefined Variables (95 issues)
- [ ] Fix missing imports
- [ ] Add proper global declarations for jest, etc.
- [ ] Fix no-undef errors in test files

## Phase 5: Remove Dead Code
- [ ] Remove commented-out code blocks
- [ ] Remove unused components
- [ ] Remove duplicate implementations
- [ ] Consolidate similar utilities

## Safety Measures
1. Work on one file at a time
2. Run tests after each change
3. Verify app still builds and runs
4. Create atomic commits for easy rollback
5. Focus on 100% safe removals only

## Priority Order
1. Start with test files (safer to modify)
2. Move to utility files
3. Then component files
4. Finally, main screens

## Tools to Use
- ESLint to identify issues
- TypeScript compiler for type checking
- Jest for running tests
- Metro bundler for build verification