// Comprehensive Design System for Fynlo POS
// Clover-style POS theme with professional styling

import { Dimensions, Platform } from 'react-native';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

// Device categories
export const deviceTypes = {
  phone: screenWidth < 768,
  tablet: screenWidth >= 768 && screenWidth < 1024,
  desktop: screenWidth >= 1024,
};

// Breakpoints
export const breakpoints = {
  xs: 0,
  sm: 576,
  md: 768,
  lg: 992,
  xl: 1200,
  xxl: 1400,
};

// Color Palette - Fynlo POS Professional
export const colors = {
  // Primary Colors
  primary: {
    50: '#E8F5E8',
    100: '#C6E6C6',
    200: '#A0D5A0',
    300: '#7AC47A',
    400: '#5CB85C',
    500: '#00A651', // Main Fynlo Green
    600: '#009547',
    700: '#00823C',
    800: '#006F32',
    900: '#005221',
  },

  // Secondary Colors
  secondary: {
    50: '#E6F2FF',
    100: '#B3D9FF',
    200: '#80C0FF',
    300: '#4DA7FF',
    400: '#1A8EFF',
    500: '#0066CC', // Fynlo Blue
    600: '#0052A3',
    700: '#003D7A',
    800: '#002951',
    900: '#001428',
  },

  // Neutral Colors
  neutral: {
    0: '#FFFFFF',
    50: '#F9F9F9',
    100: '#F5F5F5',
    200: '#E5E5E5',
    300: '#D4D4D4',
    400: '#A3A3A3',
    500: '#737373',
    600: '#525252',
    700: '#404040',
    800: '#262626',
    900: '#171717',
    950: '#0A0A0A',
  },

  // Semantic Colors
  success: {
    50: '#F0FDF4',
    100: '#DCFCE7',
    500: '#22C55E',
    600: '#16A34A',
    700: '#15803D',
  },

  warning: {
    50: '#FFFBEB',
    100: '#FEF3C7',
    500: '#F59E0B',
    600: '#D97706',
    700: '#B45309',
  },

  danger: {
    50: '#FEF2F2',
    100: '#FEE2E2',
    500: '#EF4444',
    600: '#DC2626',
    700: '#B91C1C',
  },

  info: {
    50: '#EFF6FF',
    100: '#DBEAFE',
    500: '#3B82F6',
    600: '#2563EB',
    700: '#1D4ED8',
  },

  // Legacy color aliases for backward compatibility
  primaryLegacy: '#00A651',
  secondaryLegacy: '#0066CC',
  successLegacy: '#22C55E',
  warningLegacy: '#F59E0B',
  dangerLegacy: '#EF4444',
  background: '#F5F5F5',
  surface: '#FFFFFF',
  white: '#FFFFFF',
  lightGray: '#E5E5E5',
  mediumGray: '#A3A3A3',
  darkGray: '#525252',
  text: '#171717',
  textSecondary: '#737373',
  lightText: '#737373',
  border: '#D4D4D4',
  error: '#EF4444',
  success: '#22C55E',
  primary: '#00A651',
};

// Typography Scale
export const typography = {
  // Font Families
  fontFamily: {
    sans: Platform.select({
      ios: 'System',
      android: 'Roboto',
      default: 'System',
    }),
    mono: Platform.select({
      ios: 'Menlo',
      android: 'monospace',
      default: 'monospace',
    }),
  },

  // Font Sizes
  fontSize: {
    xs: 12,
    sm: 14,
    base: 16,
    lg: 18,
    xl: 20,
    '2xl': 24,
    '3xl': 30,
    '4xl': 36,
    '5xl': 48,
    '6xl': 60,
    '7xl': 72,
    '8xl': 96,
    '9xl': 128,
  },

  // Font Weights
  fontWeight: {
    thin: '100',
    extralight: '200',
    light: '300',
    normal: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
    extrabold: '800',
    black: '900',
  },

  // Line Heights
  lineHeight: {
    none: 1,
    tight: 1.25,
    snug: 1.375,
    normal: 1.5,
    relaxed: 1.625,
    loose: 2,
  },

  // Letter Spacing
  letterSpacing: {
    tighter: -0.05,
    tight: -0.025,
    normal: 0,
    wide: 0.025,
    wider: 0.05,
    widest: 0.1,
  },
};

// Spacing Scale
export const spacing = {
  0: 0,
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  7: 28,
  8: 32,
  9: 36,
  10: 40,
  11: 44,
  12: 48,
  14: 56,
  16: 64,
  20: 80,
  24: 96,
  28: 112,
  32: 128,
  36: 144,
  40: 160,
  44: 176,
  48: 192,
  52: 208,
  56: 224,
  60: 240,
  64: 256,
  72: 288,
  80: 320,
  96: 384,
};

// Border Radius
export const borderRadius = {
  none: 0,
  sm: 2,
  base: 4,
  md: 6,
  lg: 8,
  xl: 12,
  '2xl': 16,
  '3xl': 24,
  full: 9999,
};

// Shadows
export const shadows = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  base: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 15,
    elevation: 4,
  },
  xl: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.1,
    shadowRadius: 25,
    elevation: 5,
  },
  '2xl': {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 25 },
    shadowOpacity: 0.15,
    shadowRadius: 50,
    elevation: 6,
  },
};

// Z-Index Scale
export const zIndex = {
  hide: -1,
  auto: 'auto',
  base: 0,
  docked: 10,
  dropdown: 1000,
  sticky: 1100,
  banner: 1200,
  overlay: 1300,
  modal: 1400,
  popover: 1500,
  skipLink: 1600,
  toast: 1700,
  tooltip: 1800,
};

// Animation Durations
export const duration = {
  75: 75,
  100: 100,
  150: 150,
  200: 200,
  300: 300,
  500: 500,
  700: 700,
  1000: 1000,
};

// Animation Easing
export const easing = {
  linear: 'linear',
  ease: 'ease',
  easeIn: 'ease-in',
  easeOut: 'ease-out',
  easeInOut: 'ease-in-out',
};

// Component Sizes
export const sizes = {
  xs: { width: 20, height: 20 },
  sm: { width: 24, height: 24 },
  md: { width: 32, height: 32 },
  lg: { width: 40, height: 40 },
  xl: { width: 48, height: 48 },
  '2xl': { width: 56, height: 56 },
  '3xl': { width: 64, height: 64 },
};

// Layout Dimensions
export const layout = {
  header: {
    height: 70,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  footer: {
    height: 80,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  sidebar: {
    width: 280,
    collapsedWidth: 60,
  },
  container: {
    maxWidth: deviceTypes.phone ? '100%' : 1200,
    paddingHorizontal: deviceTypes.phone ? 16 : 24,
  },
};

// Dark Theme Colors
export const darkTheme = {
  // Primary Colors (keep same for brand consistency)
  primary: colors.primary,
  secondary: colors.secondary,

  // Neutral Colors (inverted for dark mode)
  neutral: colors.neutral,

  // Semantic Colors (slightly adjusted for dark mode)
  success: {
    ...colors.success,
    500: '#10B981', // Slightly brighter green for dark backgrounds
  },
  warning: {
    ...colors.warning,
    500: '#F59E0B', // Same warning color
  },
  danger: {
    ...colors.danger,
    500: '#EF4444', // Same danger color
  },
  info: {
    ...colors.info,
    500: '#3B82F6', // Same info color
  },

  // Surface Colors
  background: colors.neutral[950],
  white: colors.neutral[900], // Dark surface instead of white
  lightGray: colors.neutral[800],
  mediumGray: colors.neutral[600],
  darkGray: colors.neutral[400],
  text: colors.neutral[50],
  lightText: colors.neutral[400],
  border: colors.neutral[700],

  // Additional dark theme surfaces
  surface: colors.neutral[900],
  surfaceVariant: colors.neutral[800],
  outline: colors.neutral[600],
  outlineVariant: colors.neutral[700],
  shadow: colors.neutral[950],
};

// Theme Context - Updated to support dynamic colors
export interface Theme {
  colors: {
    primary: string;
    secondary: string;
    accent: string;
    neutral: typeof colors.neutral;
    success: typeof colors.success;
    warning: typeof colors.warning;
    danger: typeof colors.danger;
    info: typeof colors.info;
    background: string;
    surface: string;
    white: string;
    lightGray: string;
    mediumGray: string;
    darkGray: string;
    text: string;
    textSecondary: string;
    lightText: string;
    border: string;
    error: string;
    // Legacy support
    primaryLegacy?: string;
    secondaryLegacy?: string;
    successLegacy?: string;
    warningLegacy?: string;
    dangerLegacy?: string;
  };
  typography: typeof typography;
  spacing: typeof spacing;
  borderRadius: typeof borderRadius;
  shadows: typeof shadows;
  zIndex: typeof zIndex;
  duration: typeof duration;
  easing: typeof easing;
  sizes: typeof sizes;
  layout: typeof layout;
  isDark: boolean;
}

export const lightTheme: Theme = {
  colors: {
    primary: colors.primary[500],
    secondary: colors.secondary[500],
    accent: colors.success[500],
    neutral: colors.neutral,
    success: colors.success,
    warning: colors.warning,
    danger: colors.danger,
    info: colors.info,
    background: colors.background,
    surface: colors.surface,
    white: colors.white,
    lightGray: colors.lightGray,
    mediumGray: colors.mediumGray,
    darkGray: colors.darkGray,
    text: colors.text,
    textSecondary: colors.textSecondary,
    lightText: colors.lightText,
    border: colors.border,
    error: colors.error,
    // Legacy support
    primaryLegacy: colors.primaryLegacy,
    secondaryLegacy: colors.secondaryLegacy,
    successLegacy: colors.successLegacy,
    warningLegacy: colors.warningLegacy,
    dangerLegacy: colors.dangerLegacy,
  },
  typography,
  spacing,
  borderRadius,
  shadows,
  zIndex,
  duration,
  easing,
  sizes,
  layout,
  isDark: false,
};

export const darkThemeConfig: Theme = {
  ...lightTheme,
  colors: {
    primary: colors.primary[500],
    secondary: colors.secondary[500],
    accent: colors.success[500],
    neutral: colors.neutral,
    success: darkTheme.success,
    warning: darkTheme.warning,
    danger: darkTheme.danger,
    info: darkTheme.info,
    background: darkTheme.background,
    surface: darkTheme.surface,
    white: darkTheme.white,
    lightGray: darkTheme.lightGray,
    mediumGray: darkTheme.mediumGray,
    darkGray: darkTheme.darkGray,
    text: darkTheme.text,
    textSecondary: colors.textSecondary,
    lightText: darkTheme.lightText,
    border: darkTheme.border,
    error: colors.error,
  },
  isDark: true,
};

// Utility Functions
export const getResponsiveValue = <T>(
  values: {
    xs?: T;
    sm?: T;
    md?: T;
    lg?: T;
    xl?: T;
  },
  fallback: T
): T => {
  if (screenWidth >= breakpoints.xl && values.xl !== undefined) return values.xl;
  if (screenWidth >= breakpoints.lg && values.lg !== undefined) return values.lg;
  if (screenWidth >= breakpoints.md && values.md !== undefined) return values.md;
  if (screenWidth >= breakpoints.sm && values.sm !== undefined) return values.sm;
  if (values.xs !== undefined) return values.xs;
  return fallback;
};

export const isTablet = () => deviceTypes.tablet || deviceTypes.desktop;
export const isPhone = () => deviceTypes.phone;

// Component Style Presets
export const presets = {
  // Button presets
  button: {
    primary: {
      backgroundColor: colors.primary,
      borderRadius: borderRadius.lg,
      paddingVertical: spacing[3],
      paddingHorizontal: spacing[6],
    },
    secondary: {
      backgroundColor: colors.neutral[0],
      borderWidth: 1,
      borderColor: colors.primary,
      borderRadius: borderRadius.lg,
      paddingVertical: spacing[3],
      paddingHorizontal: spacing[6],
    },
    danger: {
      backgroundColor: colors.danger[500],
      borderRadius: borderRadius.lg,
      paddingVertical: spacing[3],
      paddingHorizontal: spacing[6],
    },
  },

  // Card presets
  card: {
    default: {
      backgroundColor: colors.neutral[0],
      borderRadius: borderRadius.xl,
      padding: spacing[4],
      ...shadows.md,
    },
    elevated: {
      backgroundColor: colors.neutral[0],
      borderRadius: borderRadius.xl,
      padding: spacing[6],
      ...shadows.lg,
    },
  },

  // Input presets
  input: {
    default: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: borderRadius.lg,
      paddingVertical: spacing[3],
      paddingHorizontal: spacing[4],
      fontSize: typography.fontSize.base,
      color: colors.text,
    },
    error: {
      borderColor: colors.danger[500],
    },
    focused: {
      borderColor: colors.primary,
      borderWidth: 2,
    },
  },
};

// Legacy exports for backward compatibility
export const Colors = colors;
export const Typography = typography;
export const Spacing = spacing;
export const BorderRadius = borderRadius;
export const Shadows = shadows;

export default lightTheme;
