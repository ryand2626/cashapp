# Code Cleanup TODO for PR #467

## Current Progress
- [x] Analyzed ESLint issues (2,312 total)
- [x] Created cleanup plan and tracking documents
- [x] Removed 11 unused styles from LoginScreen.tsx
- [x] Removed unused imports from LoginScreen.tsx (Image, Dimensions)
- [ ] Continue with other files

## Key Findings
- Many ESLint "unused styles" warnings appear to be false positives
- Styles created with themed functions are not properly detected by ESLint
- Multiple data services exist that could be consolidated (DataService, DatabaseService, RestaurantDataService, SharedDataStore)
- Multiple payment services exist (PaymentService, PlatformPaymentService, 2 SumUp services, 2 Square services)

## Phase 1: Remove Unused Styles (862 issues)
### Completed
- [x] LoginScreen.tsx - Removed 11 unused styles (textInput, demoSection, demoTitle, demoText, quickSignInSection, quickSignInTitle, quickButtonsGrid, quickButton, quickButtonTitle, quickButtonSubtitle, simpleInput)

### TODO - Priority Files
- [ ] ReceiptScanModal.tsx - 20+ unused styles
- [ ] PaymentMethodSelector.tsx - 30+ unused styles  
- [ ] SignUpScreen.tsx - 9 unused styles
- [ ] CustomerScreen.tsx - Multiple unused styles
- [ ] InventoryScreen.tsx - Multiple unused styles

## Phase 2: Remove Unused Variables (308 issues)
### TODO
- [ ] Remove unused imports from LoginScreen.tsx (Image, Dimensions are unused)
- [ ] Clean up unused imports in test files
- [ ] Remove unused function parameters
- [ ] Clean up unused error variables in catch blocks

## Phase 3: Fix TypeScript 'any' Types (427 issues)
### TODO
- [ ] Replace `any` types with proper interfaces
- [ ] Create shared type definitions
- [ ] Fix error handling types
- [ ] Update API response types

## Phase 4: Fix Undefined Variables (95 issues)
### TODO
- [ ] Add jest globals declaration for test files
- [ ] Fix missing imports
- [ ] Add proper type definitions

## Safe Cleanup Strategy
1. Work on one file at a time
2. Run tests after each change
3. Commit frequently with descriptive messages
4. Focus on 100% safe removals only
5. If unsure, leave it and mark for manual review

## Next Steps
1. Remove unused imports from LoginScreen.tsx (Image, Dimensions)
2. Clean up ReceiptScanModal.tsx styles
3. Move to SignUpScreen.tsx
4. Continue with other high-priority files

## Metrics
- Files cleaned: 1/50+
- Styles removed: 11/862
- Unused imports removed: 2
- Time estimate: ~4-6 hours for full cleanup

## High-Impact Consolidation Opportunities
1. Data Services (3,388 lines across 4 files)
   - DataService.ts (1,414 lines)
   - DatabaseService.ts (1,146 lines)
   - RestaurantDataService.ts (471 lines)
   - SharedDataStore.ts (357 lines)

2. Payment Services (multiple implementations)
   - PaymentService.ts
   - PlatformPaymentService.ts
   - SumUpService.ts + SumUpNativeService.ts
   - SquareService.ts + SquareInitService.ts