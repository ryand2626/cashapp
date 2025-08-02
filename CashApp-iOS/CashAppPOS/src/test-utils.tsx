/**
 * Test utilities for React Native Testing Library
 * Provides helpers for rendering components with all necessary providers
 */

import type { ReactElement } from 'react';
import React from 'react';

import { NavigationContainer } from '@react-navigation/native';
import { render } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthProvider } from './contexts/AuthContext';
import { ThemeProvider } from './design-system/ThemeProvider';

import type { RenderOptions } from '@testing-library/react-native';

// Mock navigation
export const createMockNavigation = () => ({
  navigate: jest.fn(),
  goBack: jest.fn(),
  setOptions: jest.fn(),
  setParams: jest.fn(),
  dispatch: jest.fn(),
  reset: jest.fn(),
  replace: jest.fn(),
  push: jest.fn(),
  pop: jest.fn(),
  popToTop: jest.fn(),
  canGoBack: jest.fn(() => false),
  isFocused: jest.fn(() => true),
  addListener: jest.fn(() => ({ remove: jest.fn() })),
  removeListener: jest.fn(),
});

// Mock route
export const createMockRoute = (params = {}) => ({
  key: 'test-route',
  name: 'TestScreen',
  params,
});

// Mock auth store
export const createMockUseAuthStore = (overrides = {}) => ({
  user: null,
  isAuthenticated: false,
  login: jest.fn(),
  logout: jest.fn(),
  updateUser: jest.fn(),
  ...overrides,
});

// Mock data service
export const createMockDataService = () => ({
  validateBusinessEmail: jest.fn().mockResolvedValue({ isValid: true }),
  completeOnboarding: jest.fn().mockResolvedValue({ success: true }),
  getRestaurantConfig: jest.fn().mockResolvedValue(null),
  updateRestaurantConfig: jest.fn().mockResolvedValue({ success: true }),
  createRestaurant: jest.fn().mockResolvedValue({ id: '123' }),
  updateRestaurant: jest.fn().mockResolvedValue({ success: true }),
  getMenu: jest.fn().mockResolvedValue([]),
  createMenuItem: jest.fn().mockResolvedValue({ id: '456' }),
  updateMenuItem: jest.fn().mockResolvedValue({ success: true }),
  deleteMenuItem: jest.fn().mockResolvedValue({ success: true }),
});

// Custom render options
interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  navigationProps?: {
    navigation?: unknown;
    route?: unknown;
  };
}

// All providers wrapper
const AllTheProviders = ({ children, navigationProps = {} }: unknown) => {
  const mockNavigation = navigationProps.navigation || createMockNavigation();
  const mockRoute = navigationProps.route || createMockRoute();

  // Create navigation state
  const navigationRef = React.createRef<unknown>();

  return (
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 375, height: 812 },
        insets: { top: 44, left: 0, right: 0, bottom: 34 },
      }}
    >
      <ThemeProvider>
        <AuthProvider>
          <NavigationContainer ref={navigationRef}>
            {React.cloneElement(children, {
              navigation: mockNavigation,
              route: mockRoute,
            })}
          </NavigationContainer>
        </AuthProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
};

// Custom render function
export const renderWithProviders = (ui: ReactElement, options: CustomRenderOptions = {}) => {
  const { navigationProps, ...renderOptions } = options;

  return render(ui, {
    wrapper: (props) => <AllTheProviders {...props} navigationProps={navigationProps} />,
    ...renderOptions,
  });
};

// Re-export everything from React Native Testing Library
export * from '@testing-library/react-native';
