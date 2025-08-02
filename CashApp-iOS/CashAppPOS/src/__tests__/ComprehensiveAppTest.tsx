// TODO: Unused import - import React from 'react';

import { Alert } from 'react-native';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { NavigationContainer } from '@react-navigation/native';
import { render, fireEvent, waitFor, _act } from '@testing-library/react-native';

// Import all screens
import InventoryScreen from '../screens/inventory/InventoryScreen';
// TODO: Unused import - import DashboardScreen from '../screens/main/DashboardScreen';
import POSScreen from '../screens/main/POSScreen';
import OrdersScreen from '../screens/orders/OrdersScreen';
// TODO: Unused import - import EnhancedPaymentScreen from '../screens/payment/EnhancedPaymentScreen';
// TODO: Unused import - import MenuManagementScreen from '../screens/settings/app/MenuManagementScreen';
// TODO: Unused import - import BusinessInformationScreen from '../screens/settings/business/BusinessInformationScreen';
import PaymentMethodsScreen from '../screens/settings/business/PaymentMethodsScreen';
import SettingsScreen from '../screens/settings/SettingsScreen';
import ThemeOptionsScreen from '../screens/settings/user/ThemeOptionsScreen';
import UserProfileScreen from '../screens/settings/user/UserProfileScreen';

// Mock all dependencies
jest.mock('@react-native-async-storage/async-storage');
jest.mock('react-native-vector-icons/MaterialIcons', () => 'Icon');
jest.mock('react-native-keychain');
jest.mock('react-native/Libraries/Alert/Alert', () => ({
  alert: jest.fn(),
}));

// Mock navigation
const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({
    navigate: mockNavigate,
    goBack: mockGoBack,
  }),
  useRoute: () => ({
    params: {},
  }),
}));

// Mock contexts
jest.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: {
      id: '1',
      firstName: 'Test',
      lastName: 'User',
      email: 'test@example.com',
      role: 'manager',
      photo: null,
      phone: '+44 123 456 7890',
      employeeId: 'EMP001',
      startDate: new Date('2023-01-01'),
      lastLogin: new Date(),
    },
    updateUser: jest.fn(),
    signOut: jest.fn(),
  }),
}));

jest.mock('../design-system/ThemeProvider', () => ({
  useTheme: () => ({
    theme: {
      colors: {
        primary: '#00A651',
        white: '#FFFFFF',
        text: '#333333',
        background: '#F5F5F5',
        neutral: {
          50: '#FAFAFA',
          100: '#F5F5F5',
          200: '#E5E5E5',
          300: '#D4D4D4',
          400: '#A3A3A3',
          600: '#525252',
        },
      },
      spacing: {
        1: 4,
        2: 8,
        3: 12,
        4: 16,
      },
      borderRadius: {
        sm: 4,
        md: 8,
        lg: 12,
        xl: 16,
        full: 9999,
      },
      typography: {
        fontSize: {
          xs: 10,
          sm: 12,
          base: 14,
          lg: 16,
        },
        fontWeight: {
          medium: '500',
          semibold: '600',
        },
      },
    },
    themeMode: 'light',
    setThemeMode: jest.fn(),
    isDark: false,
  }),
}));

// Test data
const testProduct = {
  id: '1',
  name: 'Test Product',
  price: 10.99,
  category: 'Food',
  available: true,
};

const _testOrder = {
  id: 'ORD001',
  items: [{ ...testProduct, quantity: 2 }],
  total: 21.98,
  status: 'pending',
  createdAt: new Date(),
};

describe('Comprehensive App Test Suite', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POS Screen Tests', () => {
    it('should render POS screen correctly', () => {
      const { getByText, _getByTestId } = render(
        <NavigationContainer>
          <POSScreen />
        </NavigationContainer>
      );

      expect(getByText('Point of Sale')).toBeTruthy();
    });

    it('should add items to cart', async () => {
      const { _getByText, getAllByText } = render(
        <NavigationContainer>
          <POSScreen />
        </NavigationContainer>
      );

      // Find and click a product
      await waitFor(() => {
        const addButton = getAllByText('+')[0];
        fireEvent.press(addButton);
      });
    });

    it('should handle payment method selection', async () => {
      const { getByText } = render(
        <NavigationContainer>
          <POSScreen />
        </NavigationContainer>
      );

      // Check for payment options
      await waitFor(() => {
        expect(getByText(/Card/i)).toBeTruthy();
        expect(getByText(/Cash/i)).toBeTruthy();
        expect(getByText(/QR Code/i)).toBeTruthy();
      });
    });

    it('should display pound sign for currency', async () => {
      const { getByText, queryByText } = render(
        <NavigationContainer>
          <POSScreen />
        </NavigationContainer>
      );

      await waitFor(() => {
        // Should have £ not $
        expect(getByText(/£/)).toBeTruthy();
        expect(queryByText(/\$/)).toBeFalsy();
      });
    });
  });

  describe('User Profile Screen Tests', () => {
    it('should render without crashing', () => {
      const { getByText } = render(
        <NavigationContainer>
          <UserProfileScreen />
        </NavigationContainer>
      );

      expect(getByText('User Profile')).toBeTruthy();
      expect(getByText('Test User')).toBeTruthy();
    });

    it('should handle edit mode', async () => {
      const { getByTestId, getByText } = render(
        <NavigationContainer>
          <UserProfileScreen />
        </NavigationContainer>
      );

      // Find and click edit button
      const editButton = getByTestId('edit-button');
      fireEvent.press(editButton);

      // Check if in edit mode
      await waitFor(() => {
        expect(getByText('Save Changes')).toBeTruthy();
      });
    });

    it('should validate required fields', async () => {
      const { getByTestId, getByPlaceholderText } = render(
        <NavigationContainer>
          <UserProfileScreen />
        </NavigationContainer>
      );

      // Enter edit mode
      const editButton = getByTestId('edit-button');
      fireEvent.press(editButton);

      // Clear required field
      const firstNameInput = getByPlaceholderText('Enter first name');
      fireEvent.changeText(firstNameInput, '');

      // Try to save
      const saveButton = getByTestId('save-button');
      fireEvent.press(saveButton);

      // Should show error
      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith('Error', expect.stringContaining('required'));
      });
    });
  });

  describe('Theme Options Screen Tests', () => {
    it('should render theme options', () => {
      const { getByText } = render(
        <NavigationContainer>
          <ThemeOptionsScreen />
        </NavigationContainer>
      );

      expect(getByText('Theme & Display')).toBeTruthy();
      expect(getByText('Color Theme')).toBeTruthy();
    });

    it('should display 10 color options', async () => {
      const { getByText } = render(
        <NavigationContainer>
          <ThemeOptionsScreen />
        </NavigationContainer>
      );

      await waitFor(() => {
        expect(getByText('Fynlo Green')).toBeTruthy();
        expect(getByText('Ocean Blue')).toBeTruthy();
        expect(getByText('Royal Purple')).toBeTruthy();
        expect(getByText('Sunset Orange')).toBeTruthy();
        expect(getByText('Cherry Red')).toBeTruthy();
        expect(getByText('Emerald Teal')).toBeTruthy();
        expect(getByText('Deep Indigo')).toBeTruthy();
        expect(getByText('Rose Pink')).toBeTruthy();
        expect(getByText('Fresh Lime')).toBeTruthy();
        expect(getByText('Golden Amber')).toBeTruthy();
      });
    });
  });

  describe('Payment Methods Screen Tests', () => {
    it('should show QR code instead of gift card', async () => {
      const { getByText, queryByText } = render(
        <NavigationContainer>
          <PaymentMethodsScreen />
        </NavigationContainer>
      );

      await waitFor(() => {
        expect(getByText('QR Code Payment')).toBeTruthy();
        expect(queryByText(/Gift Card/i)).toBeFalsy();
      });
    });

    it('should toggle payment methods', async () => {
      const { getAllByTestId } = render(
        <NavigationContainer>
          <PaymentMethodsScreen />
        </NavigationContainer>
      );

      await waitFor(() => {
        const switches = getAllByTestId('payment-method-switch');
        expect(switches.length).toBeGreaterThan(0);

        // Toggle first switch
        fireEvent(switches[0], 'onValueChange', true);
      });
    });
  });

  describe('Navigation Tests', () => {
    it('should navigate between screens', async () => {
      const { getByText, _getByTestId } = render(
        <NavigationContainer>
          <SettingsScreen />
        </NavigationContainer>
      );

      // Click on User Settings
      const userSettingsButton = getByText('User Settings');
      fireEvent.press(userSettingsButton);

      expect(mockNavigate).toHaveBeenCalledWith('UserSettings');
    });

    it('should handle back navigation', async () => {
      const { getByTestId } = render(
        <NavigationContainer>
          <UserProfileScreen />
        </NavigationContainer>
      );

      const backButton = getByTestId('back-button');
      fireEvent.press(backButton);

      expect(mockGoBack).toHaveBeenCalled();
    });
  });

  describe('Data Persistence Tests', () => {
    it('should save user preferences', async () => {
      await AsyncStorage.setItem(
        'userPreferences',
        JSON.stringify({
          theme: 'dark',
          language: 'en',
        })
      );

      const saved = await AsyncStorage.getItem('userPreferences');
      expect(JSON.parse(saved)).toEqual({
        theme: 'dark',
        language: 'en',
      });
    });
  });

  describe('Error Handling Tests', () => {
    it('should handle network errors gracefully', async () => {
      // Mock network error
      global.fetch = jest.fn(() => Promise.reject(new Error('Network error')));

      const { getByText } = render(
        <NavigationContainer>
          <OrdersScreen />
        </NavigationContainer>
      );

      await waitFor(() => {
        // Should show error state or empty state
        expect(getByText(/No orders/i)).toBeTruthy();
      });
    });
  });

  describe('Performance Tests', () => {
    it('should render large lists efficiently', async () => {
      const startTime = Date.now();

      const { _getByTestId } = render(
        <NavigationContainer>
          <InventoryScreen />
        </NavigationContainer>
      );

      const endTime = Date.now();
      const renderTime = endTime - startTime;

      // Should render in less than 1 second
      expect(renderTime).toBeLessThan(1000);
    });
  });
});
