#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🔍 Analyzing CashApp POS for known issues...\n');

// Issue tracking
const issues = {
  paymentMethodStuck: { found: false, details: [] },
  dollarSign: { found: false, details: [] },
  giftCard: { found: false, details: [] },
  themeColors: { found: false, details: [] },
  profileCrash: { found: false, details: [] },
};

// Helper function to read file
function readFile(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch (error) {
    return null;
  }
}

// 1. Check Payment Method Selection
console.log('1️⃣ Checking Payment Method Selection...');
const paymentScreenPath = path.join(__dirname, '../src/screens/payment/EnhancedPaymentScreen.tsx');
const paymentContent = readFile(paymentScreenPath);

if (paymentContent) {
  // Check if useEffect has proper dependencies
  const useEffectMatch = paymentContent.match(/useEffect\(\(\) => \{[\s\S]*?\}, \[(.*?)\]\)/g);
  if (useEffectMatch) {
    const hasProperDeps = useEffectMatch.some(
      (match) => match.includes('enabledPaymentMethods') && match.includes('selectedPaymentMethod')
    );
    if (!hasProperDeps) {
      issues.paymentMethodStuck.found = true;
      issues.paymentMethodStuck.details.push('useEffect missing proper dependencies');
    }
  }

  // Check if payment methods are selectable
  const hasOnPress = paymentContent.includes('onPress={() => setSelectedPaymentMethod');
  if (!hasOnPress) {
    issues.paymentMethodStuck.found = true;
    issues.paymentMethodStuck.details.push('Payment methods missing onPress handlers');
  }

  console.log(issues.paymentMethodStuck.found ? '❌ Issue found' : '✅ Looks good');
}

// 2. Check for Dollar Signs
console.log('\n2️⃣ Checking Currency Symbols...');
const screenDirs = [
  '../src/screens/main',
  '../src/screens/payment',
  '../src/screens/orders',
  '../src/components',
];

screenDirs.forEach((dir) => {
  const fullPath = path.join(__dirname, dir);
  if (fs.existsSync(fullPath)) {
    const files = fs.readdirSync(fullPath);
    files.forEach((file) => {
      if (file.endsWith('.tsx') || file.endsWith('.ts')) {
        const content = readFile(path.join(fullPath, file));
        if (content && content.includes('$')) {
          // Check if it's actually a currency symbol (not template literal)
          const dollarMatches = content.match(/\$\d|'\$'|"\$"|>\$/g);
          if (dollarMatches) {
            issues.dollarSign.found = true;
            issues.dollarSign.details.push(`${dir}/${file}: Found $ symbol`);
          }
        }
      }
    });
  }
});

console.log(issues.dollarSign.found ? '❌ Dollar signs found' : '✅ Using £ correctly');

// 3. Check for Gift Card
console.log('\n3️⃣ Checking for Gift Card references...');
const paymentMethodsPath = path.join(
  __dirname,
  '../src/screens/settings/business/PaymentMethodsScreen.tsx'
);
const paymentMethodsContent = readFile(paymentMethodsPath);

if (paymentMethodsContent) {
  if (paymentMethodsContent.includes('gift') || paymentMethodsContent.includes('Gift')) {
    issues.giftCard.found = true;
    issues.giftCard.details.push('Gift card still present in PaymentMethodsScreen');
  }

  if (!paymentMethodsContent.includes('QR Code Payment')) {
    issues.giftCard.found = true;
    issues.giftCard.details.push('QR Code Payment not found');
  }

  console.log(issues.giftCard.found ? '❌ Gift card still present' : '✅ QR Code implemented');
}

// 4. Check Theme Colors
console.log('\n4️⃣ Checking Theme Color Options...');
const themeSwitcherPath = path.join(__dirname, '../src/components/theme/ThemeSwitcher.tsx');
const themeContent = readFile(themeSwitcherPath);

if (themeContent) {
  const colorThemes = [
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

  const foundThemes = colorThemes.filter((theme) => themeContent.includes(theme));

  if (foundThemes.length < 10) {
    issues.themeColors.found = true;
    issues.themeColors.details.push(`Only ${foundThemes.length}/10 color themes found`);
  }

  // Check if colors variant is implemented
  if (!themeContent.includes("variant === 'colors'")) {
    issues.themeColors.found = true;
    issues.themeColors.details.push('Colors variant not implemented');
  }

  console.log(issues.themeColors.found ? '❌ Missing color themes' : '✅ All 10 colors present');
}

// 5. Check User Profile Crash
console.log('\n5️⃣ Checking User Profile Screen...');
const profilePath = path.join(__dirname, '../src/screens/settings/user/UserProfileScreen.tsx');
const profileContent = readFile(profilePath);

if (profileContent) {
  // Check for null safety
  if (profileContent.includes('profile.photo') && !profileContent.includes('profile?.photo')) {
    issues.profileCrash.found = true;
    issues.profileCrash.details.push('Unsafe profile.photo access');
  }

  // Check for user null check
  if (!profileContent.includes('if (!user)')) {
    issues.profileCrash.found = true;
    issues.profileCrash.details.push('Missing user null check');
  }

  // Check form validation
  const hasValidation =
    profileContent.includes('?.trim()') || profileContent.includes('?.includes');
  if (!hasValidation) {
    issues.profileCrash.found = true;
    issues.profileCrash.details.push('Missing null-safe form validation');
  }

  console.log(
    issues.profileCrash.found ? '❌ Potential crash issues' : '✅ Null safety implemented'
  );
}

// Summary Report
console.log('\n📊 SUMMARY REPORT');
console.log('=====================================\n');

let totalIssues = 0;

Object.entries(issues).forEach(([key, value]) => {
  if (value.found) {
    totalIssues++;
    console.log(`❌ ${key}:`);
    value.details.forEach((detail) => console.log(`   - ${detail}`));
    console.log('');
  }
});

if (totalIssues === 0) {
  console.log('✅ All issues appear to be fixed!');
} else {
  console.log(`\n⚠️  Found ${totalIssues} issue(s) that need attention.`);
}

console.log('\n=====================================');
console.log('Note: This is a static analysis. Please test in the app to confirm.');
