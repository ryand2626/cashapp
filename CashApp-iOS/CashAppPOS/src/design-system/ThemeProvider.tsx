import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Appearance, ColorSchemeName } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Theme, lightTheme, darkThemeConfig } from './theme';

// Theme mode types
export type ThemeMode = 'light' | 'dark' | 'auto';
export type ColorTheme = 'default' | 'blue' | 'purple' | 'orange' | 'red' | 'teal' | 'indigo' | 'pink' | 'lime' | 'amber';

// Color theme options interface
export interface ColorThemeOption {
  id: ColorTheme;
  label: string;
  primary: string;
  secondary: string;
  accent: string;
  description: string;
}

// Theme context interface
interface ThemeContextType {
  theme: Theme;
  themeMode: ThemeMode;
  colorTheme: ColorTheme;
  isDark: boolean;
  setThemeMode: (mode: ThemeMode) => void;
  setColorTheme: (colorTheme: ColorTheme) => void;
  toggleTheme: () => void;
}

// Create context
const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

// Storage keys for theme preferences
const THEME_STORAGE_KEY = 'fynlo_theme_mode';
const COLOR_THEME_STORAGE_KEY = 'fynlo_color_theme';

// Color theme definitions
const colorThemeOptions: ColorThemeOption[] = [
  {
    id: 'default',
    label: 'Fynlo Green',
    primary: '#00A651',
    secondary: '#0066CC',
    accent: '#22C55E',
    description: 'Classic Fynlo brand colors',
  },
  {
    id: 'blue',
    label: 'Ocean Blue',
    primary: '#0EA5E9',
    secondary: '#1E40AF',
    accent: '#3B82F6',
    description: 'Calming ocean blue theme',
  },
  {
    id: 'purple',
    label: 'Royal Purple',
    primary: '#8B5CF6',
    secondary: '#7C3AED',
    accent: '#A855F7',
    description: 'Elegant purple theme',
  },
  {
    id: 'orange',
    label: 'Fynlo Orange',
    primary: '#FF6D00',
    secondary: '#121212',
    accent: '#FF8F00',
    description: 'Official Fynlo brand colours',
  },
  {
    id: 'red',
    label: 'Cherry Red',
    primary: '#EF4444',
    secondary: '#DC2626',
    accent: '#F87171',
    description: 'Bold cherry red theme',
  },
  {
    id: 'teal',
    label: 'Emerald Teal',
    primary: '#14B8A6',
    secondary: '#0F766E',
    accent: '#2DD4BF',
    description: 'Fresh emerald teal',
  },
  {
    id: 'indigo',
    label: 'Deep Indigo',
    primary: '#6366F1',
    secondary: '#4F46E5',
    accent: '#818CF8',
    description: 'Deep indigo blue',
  },
  {
    id: 'pink',
    label: 'Rose Pink',
    primary: '#EC4899',
    secondary: '#DB2777',
    accent: '#F472B6',
    description: 'Elegant rose pink',
  },
  {
    id: 'lime',
    label: 'Fresh Lime',
    primary: '#84CC16',
    secondary: '#65A30D',
    accent: '#A3E635',
    description: 'Fresh lime green',
  },
  {
    id: 'amber',
    label: 'Golden Amber',
    primary: '#F59E0B',
    secondary: '#D97706',
    accent: '#FBBF24',
    description: 'Warm golden amber',
  },
];

// Theme provider props
interface ThemeProviderProps {
  children: ReactNode;
  defaultTheme?: ThemeMode;
  defaultColorTheme?: ColorTheme;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({
  children,
  defaultTheme = 'light',
  defaultColorTheme = 'default'
}) => {
  const [themeMode, setThemeModeState] = useState<ThemeMode>(defaultTheme);
  const [colorTheme, setColorThemeState] = useState<ColorTheme>(defaultColorTheme);
  const [systemColorScheme, setSystemColorScheme] = useState<ColorSchemeName>(
    Appearance.getColorScheme()
  );

  // Apply color theme to base theme
  const applyColorTheme = (baseTheme: Theme, colorThemeId: ColorTheme): Theme => {
    const colorOption = colorThemeOptions.find(option => option.id === colorThemeId);
    if (!colorOption) return baseTheme;

    return {
      ...baseTheme,
      colors: {
        ...baseTheme.colors,
        primary: colorOption.primary,
        secondary: colorOption.secondary,
        accent: colorOption.accent,
      }
    };
  };

  // Calculate current theme based on mode, system preference, and color theme
  const calculateCurrentTheme = (mode: ThemeMode, systemScheme: ColorSchemeName, colorThemeId: ColorTheme): Theme => {
    let baseTheme: Theme;
    if (mode === 'auto') {
      baseTheme = systemScheme === 'dark' ? darkThemeConfig : lightTheme;
    } else {
      baseTheme = mode === 'dark' ? darkThemeConfig : lightTheme;
    }
    
    return applyColorTheme(baseTheme, colorThemeId);
  };

  const [currentTheme, setCurrentTheme] = useState<Theme>(
    calculateCurrentTheme(themeMode, systemColorScheme, colorTheme)
  );

  // Load theme preferences from storage
  useEffect(() => {
    const loadThemePreferences = async () => {
      try {
        const [savedTheme, savedColorTheme] = await Promise.all([
          AsyncStorage.getItem(THEME_STORAGE_KEY),
          AsyncStorage.getItem(COLOR_THEME_STORAGE_KEY)
        ]);
        
        if (savedTheme && ['light', 'dark', 'auto'].includes(savedTheme)) {
          setThemeModeState(savedTheme as ThemeMode);
        }
        
        if (savedColorTheme && colorThemeOptions.find(option => option.id === savedColorTheme)) {
          // If orange theme is stored, reset to default green theme
          if (savedColorTheme === 'orange') {
            setColorThemeState('default');
            await AsyncStorage.setItem(COLOR_THEME_STORAGE_KEY, 'default');
          } else {
            setColorThemeState(savedColorTheme as ColorTheme);
          }
        }
      } catch (error) {
        console.warn('Failed to load theme preferences:', error);
      }
    };

    loadThemePreferences();
  }, []);

  // Listen to system color scheme changes
  useEffect(() => {
    const subscription = Appearance.addChangeListener(({ colorScheme }) => {
      setSystemColorScheme(colorScheme);
    });

    return () => subscription?.remove();
  }, []);

  // Update current theme when mode, color theme, or system scheme changes
  useEffect(() => {
    const newTheme = calculateCurrentTheme(themeMode, systemColorScheme, colorTheme);
    setCurrentTheme(newTheme);
  }, [themeMode, systemColorScheme, colorTheme]);

  // Set theme mode and persist to storage
  const setThemeMode = async (mode: ThemeMode) => {
    try {
      setThemeModeState(mode);
      await AsyncStorage.setItem(THEME_STORAGE_KEY, mode);
    } catch (error) {
      console.warn('Failed to save theme preference:', error);
    }
  };

  // Set color theme and persist to storage
  const setColorTheme = async (colorThemeId: ColorTheme) => {
    try {
      setColorThemeState(colorThemeId);
      await AsyncStorage.setItem(COLOR_THEME_STORAGE_KEY, colorThemeId);
    } catch (error) {
      console.warn('Failed to save color theme preference:', error);
    }
  };

  // Toggle between light and dark mode
  const toggleTheme = () => {
    const newMode = currentTheme.isDark ? 'light' : 'dark';
    setThemeMode(newMode);
  };

  const contextValue: ThemeContextType = {
    theme: currentTheme,
    themeMode,
    colorTheme,
    isDark: currentTheme.isDark,
    setThemeMode,
    setColorTheme,
    toggleTheme,
  };

  return (
    <ThemeContext.Provider value={contextValue}>
      {children}
    </ThemeContext.Provider>
  );
};

// Hook to use theme context
export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

// HOC for components that need theme
export function withTheme<P extends object>(
  Component: React.ComponentType<P & { theme: Theme }>
) {
  return function ThemedComponent(props: P) {
    const { theme } = useTheme();
    return <Component {...props} theme={theme} />;
  };
}

// Utility hook for creating themed styles
export const useThemedStyles = <T>(
  createStyles: (theme: Theme) => T
): T => {
  const { theme } = useTheme();
  return React.useMemo(() => createStyles(theme), [theme, createStyles]);
};

// Style factory helper
export const createThemedStyles = <T>(
  styleFactory: (theme: Theme) => T
) => {
  return (theme: Theme): T => styleFactory(theme);
};

// Export color theme options for use in components
export { colorThemeOptions };

export default ThemeProvider;