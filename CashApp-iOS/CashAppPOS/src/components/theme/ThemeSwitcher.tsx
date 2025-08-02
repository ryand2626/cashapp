import React, { useState, useCallback, useMemo } from 'react';

import type { ViewStyle } from 'react-native';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

import Icon from 'react-native-vector-icons/MaterialIcons';

import { useTheme, _ColorTheme, colorThemeOptions } from '../../design-system/ThemeProvider';
import { logger } from '../../utils/logger';

import type { Theme } from '../../design-system/theme';
import type { ThemeMode, ColorThemeOption } from '../../design-system/ThemeProvider';

// Remove duplicate interface since it's imported from ThemeProvider

// Theme option interface
interface ThemeOption {
  mode: ThemeMode;
  label: string;
  icon: string;
  description: string;
}

// Theme switcher props
export interface ThemeSwitcherProps {
  variant?: 'compact' | 'expanded' | 'list' | 'colors';
  showLabels?: boolean;
  style?: ViewStyle;
  testID?: string;
}

const ThemeSwitcher: React.FC<ThemeSwitcherProps> = ({
  variant = 'compact',
  showLabels = true,
  style,
  testID,
}) => {
  const { theme, themeMode, colorTheme, setThemeMode, setColorTheme, isDark } = useTheme();
  const [isAnimating, setIsAnimating] = useState(false);

  const themeOptions: ThemeOption[] = [
    {
      mode: 'light',
      label: 'Light',
      icon: 'light-mode',
      description: 'Light theme with bright backgrounds',
    },
    {
      mode: 'dark',
      label: 'Dark',
      icon: 'dark-mode',
      description: 'Dark theme with dark backgrounds',
    },
    {
      mode: 'auto',
      label: 'Auto',
      icon: 'brightness-auto',
      description: 'Follow system theme preference',
    },
  ];

  // colorThemeOptions is now imported from ThemeProvider

  // Safe theme switching with error handling
  const handleThemeToggle = useCallback(async () => {
    if (isAnimating) return;

    try {
      setIsAnimating(true);
      const newTheme = isDark ? 'light' : 'dark';

      // Add animation delay for smooth transition
      await new Promise((resolve) => setTimeout(resolve, 100));

      await setThemeMode(newTheme);

      // Additional delay to ensure theme is fully applied
      await new Promise((resolve) => setTimeout(resolve, 200));
    } catch (error) {
      logger.error('Theme switching error:', error);
      // Fallback to default theme if switching fails
      try {
        await setThemeMode('light');
      } catch (fallbackError) {
        logger.error('Fallback theme setting failed:', fallbackError);
      }
    } finally {
      setIsAnimating(false);
    }
  }, [isDark, setThemeMode, isAnimating]);

  // Safe theme access with fallbacks
  const safeTheme = useMemo(() => {
    if (!theme || !theme.colors) {
      // Return default light theme if theme is corrupted
      return {
        colors: {
          primary: '#00A651',
          neutral: {
            50: '#F9F9F9',
            100: '#F5F5F5',
            200: '#E5E5E5',
            400: '#A3A3A3',
            600: '#525252',
          },
          white: '#FFFFFF',
          text: '#000000',
          background: '#FFFFFF',
        },
        spacing: { 1: 4, 2: 8, 3: 12, 4: 16 },
        borderRadius: { sm: 4, md: 8, lg: 12, xl: 16 },
        typography: {
          fontSize: { xs: 10, sm: 12, base: 14, lg: 16 },
          fontWeight: { medium: '500', semibold: '600' },
        },
        isDark: false,
      };
    }
    return theme;
  }, [theme]);

  const styles = createStyles(safeTheme);

  const handleColorThemeChange = useCallback(
    async (colorThemeOption: ColorThemeOption) => {
      if (isAnimating) return;

      try {
        setIsAnimating(true);
        await setColorTheme(colorThemeOption.id);

        // Add animation delay for smooth transition
        await new Promise((resolve) => setTimeout(resolve, 200));
      } catch (error) {
        logger.error('Color theme switching error:', error);
      } finally {
        setIsAnimating(false);
      }
    },
    [setColorTheme, isAnimating]
  );

  // Colors variant - color theme grid
  if (variant === 'colors') {
    return (
      <View style={[styles.colorsContainer, style]} testID={testID}>
        <View style={styles.colorsGrid}>
          {colorThemeOptions.map((colorThemeOption) => (
            <TouchableOpacity
              key={colorThemeOption.id}
              style={[
                styles.colorCard,
                colorTheme === colorThemeOption.id && styles.colorCardActive,
              ]}
              onPress={() => handleColorThemeChange(colorThemeOption)}
              accessibilityRole="button"
              accessibilityLabel={colorThemeOption.label}
              accessibilityHint={colorThemeOption.description}
              accessibilityState={{ selected: colorTheme === colorThemeOption.id }}
            >
              <View style={styles.colorPreview}>
                <View style={[styles.colorSwatch, { backgroundColor: colorThemeOption.primary }]} />
                <View
                  style={[styles.colorSwatch, { backgroundColor: colorThemeOption.secondary }]}
                />
                <View style={[styles.colorSwatch, { backgroundColor: colorThemeOption.accent }]} />
              </View>
              {showLabels && (
                <>
                  <Text
                    style={[
                      styles.colorLabel,
                      colorTheme === colorThemeOption.id && styles.colorLabelActive,
                    ]}
                  >
                    {colorThemeOption.label}
                  </Text>
                  <Text style={styles.colorDescription}>{colorThemeOption.description}</Text>
                </>
              )}
              {colorTheme === colorThemeOption.id && (
                <View style={styles.colorCheckmark}>
                  <Icon name="check-circle" size={16} color={safeTheme.colors.primary} />
                </View>
              )}
            </TouchableOpacity>
          ))}
        </View>
      </View>
    );
  }

  // Compact variant - horizontal buttons
  if (variant === 'compact') {
    return (
      <View style={[styles.compactContainer, style]} testID={testID}>
        {themeOptions.map((option) => (
          <TouchableOpacity
            key={option.mode}
            style={[styles.compactButton, themeMode === option.mode && styles.compactButtonActive]}
            onPress={() => handleThemeToggle()}
            accessibilityRole="button"
            accessibilityLabel={option.label}
            accessibilityHint={option.description}
            accessibilityState={{ selected: themeMode === option.mode }}
          >
            <Icon
              name={option.icon}
              size={20}
              color={
                themeMode === option.mode ? safeTheme.colors.white : safeTheme.colors.neutral[600]
              }
            />
            {showLabels && (
              <Text
                style={[
                  styles.compactLabel,
                  themeMode === option.mode && styles.compactLabelActive,
                ]}
              >
                {option.label}
              </Text>
            )}
          </TouchableOpacity>
        ))}
      </View>
    );
  }

  // Expanded variant - card-like options
  if (variant === 'expanded') {
    return (
      <View style={[styles.expandedContainer, style]} testID={testID}>
        {themeOptions.map((option) => (
          <TouchableOpacity
            key={option.mode}
            style={[styles.expandedCard, themeMode === option.mode && styles.expandedCardActive]}
            onPress={() => handleThemeToggle()}
            accessibilityRole="button"
            accessibilityLabel={option.label}
            accessibilityHint={option.description}
            accessibilityState={{ selected: themeMode === option.mode }}
          >
            <View style={styles.expandedIconContainer}>
              <Icon
                name={option.icon}
                size={32}
                color={
                  themeMode === option.mode
                    ? safeTheme.colors.primary
                    : safeTheme.colors.neutral[600]
                }
              />
            </View>
            <Text
              style={[
                styles.expandedTitle,
                themeMode === option.mode && styles.expandedTitleActive,
              ]}
            >
              {option.label}
            </Text>
            <Text style={styles.expandedDescription}>{option.description}</Text>
            {themeMode === option.mode && (
              <View style={styles.expandedCheckmark}>
                <Icon name="check-circle" size={20} color={safeTheme.colors.primary} />
              </View>
            )}
          </TouchableOpacity>
        ))}
      </View>
    );
  }

  // List variant - menu-style options
  return (
    <View style={[styles.listContainer, style]} testID={testID}>
      {themeOptions.map((option) => (
        <TouchableOpacity
          key={option.mode}
          style={[styles.listItem, themeMode === option.mode && styles.listItemActive]}
          onPress={() => handleThemeToggle()}
          accessibilityRole="button"
          accessibilityLabel={option.label}
          accessibilityHint={option.description}
          accessibilityState={{ selected: themeMode === option.mode }}
        >
          <View style={styles.listIconContainer}>
            <Icon
              name={option.icon}
              size={24}
              color={
                themeMode === option.mode ? safeTheme.colors.primary : safeTheme.colors.neutral[600]
              }
            />
          </View>
          <View style={styles.listContent}>
            <Text style={[styles.listTitle, themeMode === option.mode && styles.listTitleActive]}>
              {option.label}
            </Text>
            <Text style={styles.listDescription}>{option.description}</Text>
          </View>
          <View style={styles.listTrailing}>
            {themeMode === option.mode && (
              <Icon name="radio-button-checked" size={20} color={safeTheme.colors.primary} />
            )}
            {themeMode !== option.mode && (
              <Icon name="radio-button-unchecked" size={20} color={safeTheme.colors.neutral[400]} />
            )}
          </View>
        </TouchableOpacity>
      ))}
    </View>
  );
};

// Simple toggle switch for light/dark mode
export interface ThemeToggleProps {
  size?: 'sm' | 'md' | 'lg';
  showLabels?: boolean;
  style?: ViewStyle;
  testID?: string;
}

export const ThemeToggle: React.FC<ThemeToggleProps> = ({
  size = 'md',
  showLabels = false,
  style,
  testID,
}) => {
  const { theme, isDark, toggleTheme } = useTheme();
  const styles = createStyles(theme);

  const getSizeStyles = () => {
    switch (size) {
      case 'sm':
        return { iconSize: 18, padding: theme.spacing[2] };
      case 'lg':
        return { iconSize: 28, padding: theme.spacing[4] };
      default:
        return { iconSize: 24, padding: theme.spacing[3] };
    }
  };

  const { iconSize, padding } = getSizeStyles();

  return (
    <TouchableOpacity
      style={[styles.toggleButton, { padding }, isDark && styles.toggleButtonDark, style]}
      onPress={toggleTheme}
      accessibilityRole="switch"
      accessibilityLabel={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      accessibilityState={{ checked: isDark }}
      testID={testID}
    >
      <Icon
        name={isDark ? 'light-mode' : 'dark-mode'}
        size={iconSize}
        color={isDark ? theme.colors.warning[500] : theme.colors.neutral[600]}
      />
      {showLabels && <Text style={styles.toggleLabel}>{isDark ? 'Light' : 'Dark'}</Text>}
    </TouchableOpacity>
  );
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    // Compact variant styles
    compactContainer: {
      flexDirection: 'row',
      backgroundColor: theme.colors.neutral[100],
      borderRadius: theme.borderRadius.lg,
      padding: theme.spacing[1],
    },
    compactButton: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: theme.spacing[2],
      paddingHorizontal: theme.spacing[3],
      borderRadius: theme.borderRadius.md,
      gap: theme.spacing[2],
    },
    compactButtonActive: {
      backgroundColor: theme.colors.primary,
    },
    compactLabel: {
      fontSize: theme.typography.fontSize.sm,
      fontWeight: theme.typography.fontWeight.medium,
      color: theme.colors.neutral[600],
    },
    compactLabelActive: {
      color: theme.colors.white,
    },

    // Expanded variant styles
    expandedContainer: {
      gap: theme.spacing[3],
    },
    expandedCard: {
      backgroundColor: theme.colors.white,
      borderRadius: theme.borderRadius.xl,
      padding: theme.spacing[4],
      borderWidth: 2,
      borderColor: theme.colors.neutral[200],
      alignItems: 'center',
      position: 'relative',
    },
    expandedCardActive: {
      borderColor: theme.colors.primary,
      backgroundColor: theme.colors.primary[50] || theme.colors.neutral[50],
    },
    expandedIconContainer: {
      marginBottom: theme.spacing[3],
    },
    expandedTitle: {
      fontSize: theme.typography.fontSize.lg,
      fontWeight: theme.typography.fontWeight.semibold,
      color: theme.colors.text,
      marginBottom: theme.spacing[1],
    },
    expandedTitleActive: {
      color: theme.colors.primary,
    },
    expandedDescription: {
      fontSize: theme.typography.fontSize.sm,
      color: theme.colors.neutral[600],
      textAlign: 'center',
    },
    expandedCheckmark: {
      position: 'absolute',
      top: theme.spacing[2],
      right: theme.spacing[2],
    },

    // List variant styles
    listContainer: {
      backgroundColor: theme.colors.white,
      borderRadius: theme.borderRadius.xl,
      overflow: 'hidden',
    },
    listItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: theme.spacing[4],
      paddingVertical: theme.spacing[3],
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.neutral[100],
    },
    listItemActive: {
      backgroundColor: theme.colors.primary[50] || theme.colors.neutral[50],
    },
    listIconContainer: {
      marginRight: theme.spacing[3],
      width: 32,
      alignItems: 'center',
    },
    listContent: {
      flex: 1,
    },
    listTitle: {
      fontSize: theme.typography.fontSize.base,
      fontWeight: theme.typography.fontWeight.medium,
      color: theme.colors.text,
      marginBottom: theme.spacing[1],
    },
    listTitleActive: {
      color: theme.colors.primary,
    },
    listDescription: {
      fontSize: theme.typography.fontSize.sm,
      color: theme.colors.neutral[600],
    },
    listTrailing: {
      marginLeft: theme.spacing[3],
    },

    // Toggle styles
    toggleButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.neutral[100],
      borderRadius: theme.borderRadius.full,
      gap: theme.spacing[2],
    },
    toggleButtonDark: {
      backgroundColor: theme.colors.neutral[800],
    },
    toggleLabel: {
      fontSize: theme.typography.fontSize.sm,
      fontWeight: theme.typography.fontWeight.medium,
      color: theme.colors.text,
    },

    // Colors variant styles
    colorsContainer: {
      backgroundColor: theme.colors.white,
      borderRadius: theme.borderRadius.xl,
      padding: theme.spacing[4],
    },
    colorsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: theme.spacing[3],
      justifyContent: 'space-between',
    },
    colorCard: {
      width: '48%',
      backgroundColor: theme.colors.neutral[50],
      borderRadius: theme.borderRadius.lg,
      padding: theme.spacing[3],
      borderWidth: 2,
      borderColor: theme.colors.neutral[200],
      alignItems: 'center',
      position: 'relative',
      minHeight: 120,
    },
    colorCardActive: {
      borderColor: theme.colors.primary,
      backgroundColor: theme.colors.primary[50] || theme.colors.neutral[50],
    },
    colorPreview: {
      flexDirection: 'row',
      marginBottom: theme.spacing[2],
      gap: theme.spacing[1],
    },
    colorSwatch: {
      width: 16,
      height: 16,
      borderRadius: theme.borderRadius.sm,
      borderWidth: 1,
      borderColor: theme.colors.neutral[200],
    },
    colorLabel: {
      fontSize: theme.typography.fontSize.sm,
      fontWeight: theme.typography.fontWeight.semibold,
      color: theme.colors.text,
      textAlign: 'center',
      marginBottom: theme.spacing[1],
    },
    colorLabelActive: {
      color: theme.colors.primary,
    },
    colorDescription: {
      fontSize: theme.typography.fontSize.xs,
      color: theme.colors.neutral[600],
      textAlign: 'center',
      lineHeight: 16,
    },
    colorCheckmark: {
      position: 'absolute',
      top: theme.spacing[2],
      right: theme.spacing[2],
    },
  });

export default ThemeSwitcher;
