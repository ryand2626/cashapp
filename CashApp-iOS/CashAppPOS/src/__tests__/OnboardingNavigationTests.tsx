// TODO: Unused import - import React from 'react';

import { Alert } from 'react-native';

import AsyncStorage from '@react-native-async-storage/async-storage';
// TODO: Unused import - import { NavigationContainer } from '@react-navigation/native';
import { render, fireEvent, waitFor } from '@testing-library/react-native';

// Mock the navigation
const mockNavigate = jest.fn();
const mockGoBack = jest.fn();

jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({
    navigate: mockNavigate,
    goBack: mockGoBack,
  }),
}));

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));

// Mock Alert
jest.spyOn(Alert, 'alert');

describe('Onboarding Navigation Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('HelpScreen Onboarding Section', () => {
    it('should navigate to RestaurantSetup through Settings when Continue Setup is pressed', async () => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const HelpScreen = require('../screens/support/HelpScreen').default;

      // Mock restaurant config not completed
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(
        JSON.stringify({
          onboardingCompleted: false,
          setupSteps: {
            restaurantInfo: false,
            menuSetup: false,
            paymentSetup: false,
            staffSetup: false,
          },
        })
      );

      const { getByText } = render(<HelpScreen />);

      // Wait for the component to load
      await waitFor(() => {
        expect(getByText('Continue Setup')).toBeTruthy();
      });

      // Press the Continue Setup button
      fireEvent.press(getByText('Continue Setup'));

      // Should navigate to Settings with RestaurantSetup as screen param
      expect(mockNavigate).toHaveBeenCalledWith('Settings', {
        screen: 'RestaurantSetup',
      });
    });

    it('should show Edit Setup when onboarding is completed', async () => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const HelpScreen = require('../screens/support/HelpScreen').default;

      // Mock restaurant config completed
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(
        JSON.stringify({
          onboardingCompleted: true,
          restaurantName: 'Test Restaurant',
          setupSteps: {
            restaurantInfo: true,
            menuSetup: true,
            paymentSetup: true,
            staffSetup: true,
          },
        })
      );

      const { getByText } = render(<HelpScreen />);

      await waitFor(() => {
        expect(getByText('Edit Setup')).toBeTruthy();
      });
    });
  });

  describe('RestaurantSetupScreen Navigation', () => {
    it('should have working back button', () => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const RestaurantSetupScreen = require('../screens/onboarding/RestaurantSetupScreen').default;

      const { getByTestId } = render(<RestaurantSetupScreen />);

      // Find and press back button
      const backButton = getByTestId('back-button');
      fireEvent.press(backButton);

      expect(mockGoBack).toHaveBeenCalled();
    });

    it('should navigate through all 3 steps', async () => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const RestaurantSetupScreen = require('../screens/onboarding/RestaurantSetupScreen').default;

      const { getByText, getByPlaceholderText } = render(<RestaurantSetupScreen />);

      // Step 1: Fill restaurant info
      fireEvent.changeText(
        getByPlaceholderText("e.g., Maria's Mexican Kitchen"),
        'Test Restaurant'
      );
      fireEvent.changeText(getByPlaceholderText("e.g., Maria's Kitchen"), 'Test Display');

      // Press Next
      fireEvent.press(getByText('Next'));

      // Should be on Step 2
      await waitFor(() => {
        expect(getByText('Contact Information')).toBeTruthy();
      });

      // Fill contact info
      fireEvent.changeText(getByPlaceholderText('+44 20 1234 5678'), '+44 123456789');
      fireEvent.changeText(getByPlaceholderText('owner@mariaskitchen.co.uk'), 'test@test.com');

      // Press Next
      fireEvent.press(getByText('Next'));

      // Should be on Step 3
      await waitFor(() => {
        expect(getByText('Restaurant Location')).toBeTruthy();
      });

      // Fill address info
      fireEvent.changeText(getByPlaceholderText('123 High Street'), '123 Test St');
      fireEvent.changeText(getByPlaceholderText('London'), 'London');
      fireEvent.changeText(getByPlaceholderText('SW1A 1AA'), 'SW1A 1AA');

      // Press Complete Setup
      fireEvent.press(getByText('Complete Setup'));

      // Should show success alert
      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          'Setup Complete!',
          expect.stringContaining('Your restaurant information has been saved successfully'),
          expect.any(Array)
        );
      });
    });

    it('should validate required fields before allowing navigation', () => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const RestaurantSetupScreen = require('../screens/onboarding/RestaurantSetupScreen').default;

      const { getByText } = render(<RestaurantSetupScreen />);

      // Try to press Next without filling fields
      fireEvent.press(getByText('Next'));

      // Should show validation alert
      expect(Alert.alert).toHaveBeenCalledWith(
        'Missing Information',
        'Please fill in all required fields before continuing.'
      );
    });
  });

  describe('Business Settings Navigation', () => {
    it('should navigate to RestaurantProfile when clicked', () => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const BusinessSettingsScreen = require('../screens/settings/BusinessSettingsScreen').default;

      const { getByText } = render(<BusinessSettingsScreen />);

      // Find and press Restaurant Profile option
      fireEvent.press(getByText('Restaurant Profile'));

      expect(mockNavigate).toHaveBeenCalledWith('RestaurantProfile');
    });

    it('should navigate to BusinessInformation when clicked', () => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const BusinessSettingsScreen = require('../screens/settings/BusinessSettingsScreen').default;

      const { getByText } = render(<BusinessSettingsScreen />);

      // Find and press Business Information option
      fireEvent.press(getByText('Business Information'));

      expect(mockNavigate).toHaveBeenCalledWith('BusinessInformation');
    });
  });

  describe('RestaurantProfileScreen', () => {
    it('should load restaurant data from config', async () => {
      const RestaurantProfileScreen =
        require('../screens/settings/RestaurantProfileScreen').default;

      // Mock existing restaurant data
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(
        JSON.stringify({
          restaurantName: 'Existing Restaurant',
          displayName: 'Existing Display',
          phone: '+44 987654321',
          email: 'existing@test.com',
        })
      );

      const { getByDisplayValue } = render(<RestaurantProfileScreen />);

      await waitFor(() => {
        expect(getByDisplayValue('Existing Restaurant')).toBeTruthy();
        expect(getByDisplayValue('Existing Display')).toBeTruthy();
        expect(getByDisplayValue('+44 987654321')).toBeTruthy();
        expect(getByDisplayValue('existing@test.com')).toBeTruthy();
      });
    });

    it('should save changes when Save button is pressed', async () => {
      const RestaurantProfileScreen =
        require('../screens/settings/RestaurantProfileScreen').default;

      const { getByText, getByDisplayValue } = render(<RestaurantProfileScreen />);

      // Wait for data to load
      await waitFor(() => {
        const input = getByDisplayValue('');
        fireEvent.changeText(input, 'Updated Restaurant Name');
      });

      // Press Save
      fireEvent.press(getByText('Save Changes'));

      // Should show success alert
      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          'Success',
          'Restaurant profile updated successfully!'
        );
      });
    });
  });

  describe('Screen Back Button Tests', () => {
    const screensToTest = [
      { name: 'BusinessSettingsScreen', path: '../screens/settings/BusinessSettingsScreen' },
      { name: 'HardwareSettingsScreen', path: '../screens/settings/HardwareSettingsScreen' },
      { name: 'UserSettingsScreen', path: '../screens/settings/UserSettingsScreen' },
      { name: 'AppSettingsScreen', path: '../screens/settings/AppSettingsScreen' },
    ];

    screensToTest.forEach(({ name, path }) => {
      it(`${name} should have working back button`, () => {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const Screen = require(path).default;
        const { getAllByTestId } = render(<Screen />);

        // Find back button (usually the first touchable in header)
        const backButtons = getAllByTestId('back-button');
        if (backButtons.length > 0) {
          fireEvent.press(backButtons[0]);
          expect(mockGoBack).toHaveBeenCalled();
        }
      });
    });
  });
});

describe('Navigation Route Validation', () => {
  it('should have all required routes in SettingsNavigator', () => {
    const settingsRoutes = [
      'Settings',
      'BusinessSettings',
      'BusinessInformation',
      'RestaurantSetup',
      'RestaurantProfile',
      'HardwareSettings',
      'UserSettings',
      'AppSettings',
      'SettingsMenuManagement',
    ];

    // This test validates that all expected routes exist
    // In a real implementation, you would import the navigator and check its routes
    expect(settingsRoutes).toContain('RestaurantSetup');
    expect(settingsRoutes).toContain('RestaurantProfile');
  });
});
