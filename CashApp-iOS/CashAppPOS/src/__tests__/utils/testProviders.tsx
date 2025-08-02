// @ts-nocheck
import React from 'react';

import { NavigationContainer } from '@react-navigation/native';
import { render } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import type { RenderOptions } from '@testing-library/react-native';

// Lazy-import stores to avoid circular deps in Jest
const appStoreModule = jest.requireActual('../../store/useAppStore');
const uiStoreModule = jest.requireActual('../../store/useUIStore');

export interface StoreOverrides {
  appState?: Record<string, unknown>;
  uiState?: Record<string, unknown>;
}

export const createTestWrapper = ({ appState = {}, uiState = {} }: StoreOverrides = {}) => {
  // Spy on the default exports (which are the hooks)
  const appHookSpy = jest.spyOn(appStoreModule, 'default');
  const uiHookSpy = jest.spyOn(uiStoreModule, 'default');

  // Provide deterministic mock implementations for this test run
  appHookSpy.mockImplementation(() => ({
    cart: [],
    menuItems: [],
    addToCart: jest.fn(),
    removeFromCart: jest.fn(),
    updateQuantity: jest.fn(),
    clearCart: jest.fn(),
    cartTotal: jest.fn(() => 0),
    cartItemCount: jest.fn(() => 0),
    selectedCategory: 'All',
    setSelectedCategory: jest.fn(),
    getFilteredItems: jest.fn(() => []),
    ...appState,
  }));

  uiHookSpy.mockImplementation(() => ({
    selectedCategory: 'All',
    showPaymentModal: false,
    showOfflineIndicator: false,
    theme: 'light',
    setSelectedCategory: jest.fn(),
    setShowPaymentModal: jest.fn(),
    setShowOfflineIndicator: jest.fn(),
    setTheme: jest.fn(),
    toggleTheme: jest.fn(),
    ...uiState,
  }));

  // Return a wrapper component for @testing-library/react-native
  return ({ children }: { children: React.ReactNode }) => (
    <SafeAreaProvider>
      <NavigationContainer>{children}</NavigationContainer>
    </SafeAreaProvider>
  );
};

export const customRenderWithStores = (
  ui: React.ReactElement,
  { appState, uiState, ...options }: StoreOverrides & RenderOptions = {}
) => {
  const Wrapper = createTestWrapper({ appState, uiState });
  return render(ui, { wrapper: Wrapper, ...options });
};
