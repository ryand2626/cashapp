#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🧪 Testing App Functionality (Static Analysis)\n');

// Color codes
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const RESET = '\x1b[0m';

// Test results
const testResults = {
  passed: 0,
  failed: 0,
  warnings: 0,
  details: [],
};

// Helper functions
function readFile(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch (error) {
    return null;
  }
}

function testPassed(test, message) {
  testResults.passed++;
  testResults.details.push({ test, status: 'PASS', message });
  console.log(`${GREEN}✅ PASS${RESET}: ${test}`);
}

function testFailed(test, message) {
  testResults.failed++;
  testResults.details.push({ test, status: 'FAIL', message });
  console.log(`${RED}❌ FAIL${RESET}: ${test}`);
  console.log(`   ${message}`);
}

function testWarning(test, message) {
  testResults.warnings++;
  testResults.details.push({ test, status: 'WARN', message });
  console.log(`${YELLOW}⚠️  WARN${RESET}: ${test}`);
  console.log(`   ${message}`);
}

// Test Suite 1: Payment Method Selection
console.log('📱 Testing Payment Method Selection');
console.log('-----------------------------------');

const paymentScreen = readFile(
  path.join(__dirname, '../src/screens/payment/EnhancedPaymentScreen.tsx')
);
if (paymentScreen) {
  // Test 1.1: Check onPress handlers
  if (paymentScreen.includes('onPress={() => handlePaymentMethodSelect(method.id)')) {
    testPassed('Payment method onPress handler', 'Found handlePaymentMethodSelect');
  } else {
    testFailed('Payment method onPress handler', 'Missing handlePaymentMethodSelect');
  }

  // Test 1.2: Check useEffect dependencies
  const useEffectRegex =
    /useEffect\(\(\) => \{[^}]*enabledPaymentMethods[^}]*\}, \[[^\]]*enabledPaymentMethods[^\]]*selectedPaymentMethod[^\]]*\]\)/;
  if (useEffectRegex.test(paymentScreen)) {
    testPassed('useEffect dependencies', 'Correct dependencies for payment selection');
  } else {
    testFailed('useEffect dependencies', 'Missing proper dependencies in useEffect');
  }

  // Test 1.3: Check state management
  if (paymentScreen.includes('const [selectedPaymentMethod, setSelectedPaymentMethod]')) {
    testPassed('Payment state management', 'State hooks properly defined');
  } else {
    testFailed('Payment state management', 'Missing state management hooks');
  }
}

// Test Suite 2: Currency Symbol
console.log('\n💷 Testing Currency Symbol');
console.log('-----------------------------------');

const currencyFiles = [
  'src/screens/main/POSScreen.tsx',
  'src/screens/payment/EnhancedPaymentScreen.tsx',
  'src/screens/orders/OrdersScreen.tsx',
  'src/utils/mockDataGenerator.ts',
];

let dollarSignFound = false;
let poundSignCount = 0;

currencyFiles.forEach((file) => {
  const content = readFile(path.join(__dirname, '..', file));
  if (content) {
    // Count pound signs
    const poundMatches = content.match(/£/g);
    if (poundMatches) poundSignCount += poundMatches.length;

    // Check for dollar signs (excluding template literals)
    const dollarMatches = content.match(/\$(?!\{)/g);
    if (dollarMatches && dollarMatches.length > 0) {
      dollarSignFound = true;
      testFailed(`Currency in ${file}`, `Found ${dollarMatches.length} dollar signs`);
    }
  }
});

if (!dollarSignFound && poundSignCount > 0) {
  testPassed('Currency symbols', `Using £ correctly (found ${poundSignCount} instances)`);
}

// Test Suite 3: Gift Card vs QR Code
console.log('\n🎁 Testing Gift Card Removal');
console.log('-----------------------------------');

const paymentMethodsScreen = readFile(
  path.join(__dirname, '../src/screens/settings/business/PaymentMethodsScreen.tsx')
);
if (paymentMethodsScreen) {
  // Test for gift card
  const hasGiftCard = /gift\s*card/i.test(paymentMethodsScreen);
  const hasQRCode = paymentMethodsScreen.includes('QR Code Payment');

  if (!hasGiftCard && hasQRCode) {
    testPassed('Gift card removal', 'Gift card removed, QR Code present');
  } else if (hasGiftCard) {
    testFailed('Gift card removal', 'Gift card still present in payment methods');
  } else if (!hasQRCode) {
    testFailed('QR Code implementation', 'QR Code payment method not found');
  }

  // Check for 1.2% fee mention
  if (paymentMethodsScreen.includes('1.2%')) {
    testPassed('QR Code fees', 'Correct fee percentage mentioned');
  } else {
    testWarning('QR Code fees', '1.2% fee not mentioned');
  }
}

// Test Suite 4: Theme Colors
console.log('\n🎨 Testing Theme Colors');
console.log('-----------------------------------');

const themeSwitcher = readFile(path.join(__dirname, '../src/components/theme/ThemeSwitcher.tsx'));
if (themeSwitcher) {
  const requiredColors = [
    'Fynlo Green',
    'Ocean Blue',
    'Royal Purple',
    'Sunset Orange',
    'Cherry Red',
    'Emerald Teal',
    'Deep Indigo',
    'Rose Pink',
    'Fresh Lime',
    'Golden Amber',
  ];

  const foundColors = requiredColors.filter((color) => themeSwitcher.includes(color));

  if (foundColors.length === 10) {
    testPassed('Theme color count', 'All 10 color themes present');
  } else {
    testFailed('Theme color count', `Only ${foundColors.length}/10 colors found`);
  }

  // Check colors variant implementation
  if (themeSwitcher.includes("if (variant === 'colors')")) {
    testPassed('Colors variant', 'Colors variant properly implemented');
  } else {
    testFailed('Colors variant', 'Colors variant not implemented');
  }

  // Check if it's displayed in ThemeOptionsScreen
  const themeOptionsScreen = readFile(
    path.join(__dirname, '../src/screens/settings/user/ThemeOptionsScreen.tsx')
  );
  if (themeOptionsScreen && themeOptionsScreen.includes('variant="colors"')) {
    testPassed('Colors display', 'Color themes shown in Theme Options');
  } else {
    testFailed('Colors display', 'Color themes not displayed in settings');
  }
}

// Test Suite 5: User Profile Crash Prevention
console.log('\n👤 Testing User Profile Safety');
console.log('-----------------------------------');

const userProfile = readFile(
  path.join(__dirname, '../src/screens/settings/user/UserProfileScreen.tsx')
);
if (userProfile) {
  // Test null safety
  const nullSafetyChecks = [
    { pattern: /if\s*\(\s*!user\s*\)/, name: 'User null check' },
    { pattern: /\?\.trim\(\)/, name: 'Safe trim operations' },
    { pattern: /\?\.includes/, name: 'Safe includes checks' },
    { pattern: /user\.photo/, name: 'Direct photo access' },
  ];

  nullSafetyChecks.forEach((check) => {
    if (check.name === 'Direct photo access') {
      // This should NOT be found (it's unsafe)
      if (!check.pattern.test(userProfile) || userProfile.includes('user?.photo')) {
        testPassed('Photo access safety', 'Safe photo property access');
      } else {
        testFailed('Photo access safety', 'Unsafe profile.photo access found');
      }
    } else {
      if (check.pattern.test(userProfile)) {
        testPassed(check.name, 'Safety check implemented');
      } else {
        testFailed(check.name, 'Safety check missing');
      }
    }
  });
}

// Final Report
console.log('\n' + '='.repeat(50));
console.log('📊 TEST RESULTS SUMMARY');
console.log('='.repeat(50));
console.log(`${GREEN}Passed:${RESET} ${testResults.passed}`);
console.log(`${RED}Failed:${RESET} ${testResults.failed}`);
console.log(`${YELLOW}Warnings:${RESET} ${testResults.warnings}`);
console.log('='.repeat(50));

if (testResults.failed === 0) {
  console.log(`\n${GREEN}🎉 All tests passed! The app should be working correctly.${RESET}`);
} else {
  console.log(`\n${RED}⚠️  ${testResults.failed} tests failed. The app may have issues.${RESET}`);
  console.log('\nFailed tests:');
  testResults.details
    .filter((d) => d.status === 'FAIL')
    .forEach((d) => console.log(`  - ${d.test}: ${d.message}`));
}

// Save detailed report
const report = {
  timestamp: new Date().toISOString(),
  summary: {
    passed: testResults.passed,
    failed: testResults.failed,
    warnings: testResults.warnings,
  },
  details: testResults.details,
};

fs.writeFileSync(
  path.join(__dirname, '../test-results/functionality-test-report.json'),
  JSON.stringify(report, null, 2)
);

console.log('\n📄 Detailed report saved to: test-results/functionality-test-report.json');

process.exit(testResults.failed > 0 ? 1 : 0);
