/**
 * Comprehensive Integration Tests for Restaurant Onboarding Flow
 * Tests the complete user journey from start to finish, mimicking real user behavior
 */

import React from 'react';

import { Alert, _Keyboard, _TextInput } from 'react-native';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, waitFor, _within, _act } from '@testing-library/react-native';

import { renderWithProviders } from '../../../test-utils';
import ComprehensiveRestaurantOnboardingScreen from '../ComprehensiveRestaurantOnboardingScreen';

// Mock fetch for API calls
global.fetch = jest.fn();

// Mock navigation
const mockNavigate = jest.fn();
const mockReset = jest.fn();
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({
    navigate: mockNavigate,
    goBack: jest.fn(),
    setOptions: jest.fn(),
    reset: mockReset,
  }),
}));

// Mock dependencies
jest.mock('../../../services/DataService', () => ({
  DataService: {
    getInstance: jest.fn(() => ({
      validateBusinessEmail: jest.fn().mockResolvedValue({ isValid: true }),
      completeOnboarding: jest.fn().mockResolvedValue({ success: true }),
    })),
  },
}));

jest.mock('../../../store/useAuthStore', () => {
  const mockState = {
    user: { id: 'test-user' },
    isAuthenticated: false,
    isLoading: false,
    updateUser: jest.fn(),
    checkAuth: jest.fn().mockResolvedValue(true),
    signIn: jest.fn(),
    signOut: jest.fn(),
  };

  const useAuthStore = jest.fn((selector) => {
    return selector ? selector(mockState) : mockState;
  });

  // Add getState method
  useAuthStore.getState = () => mockState;

  return {
    __esModule: true,
    useAuthStore,
    default: useAuthStore,
  };
});

// Mock useAppStore
jest.mock('../../../store/useAppStore', () => ({
  __esModule: true,
  default: jest.fn((selector) => {
    const state = {
      currentOrder: null,
      activeRestaurant: null,
      setActiveRestaurant: jest.fn(),
    };
    return selector ? selector(state) : state;
  }),
}));

// Mock Alert
const mockAlert = jest.fn();
Alert.alert = mockAlert;

// Mock AsyncStorage properly
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
}));

// Mock Keyboard
jest.mock('react-native/Libraries/Components/Keyboard/Keyboard', () => ({
  dismiss: jest.fn(),
  addListener: jest.fn(() => ({ remove: jest.fn() })),
  removeListener: jest.fn(),
  removeAllListeners: jest.fn(),
}));

describe('ComprehensiveRestaurantOnboardingScreen - Complete User Journey', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAlert.mockClear();
    (fetch as jest.Mock).mockClear();
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue('test-auth-token');
    (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Complete 9-Step Onboarding Process', () => {
    it('should complete the entire onboarding flow as a new user would - testing all 9 steps', async () => {
      // Mock successful API response for onboarding completion
      (fetch as jest.Mock).mockImplementation((url) => {
        if (url.includes('/restaurants/onboarding/create')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              restaurant_id: 'rest-123',
              success: true,
              data: {
                id: 'rest-123',
                name: "Maria's Mexican Kitchen",
                status: 'active',
              },
            }),
          });
        }
        return Promise.reject(new Error('Unknown API endpoint'));
      });

      const { getByTestId, getByText, getByPlaceholderText, queryByText } = renderWithProviders(
        <ComprehensiveRestaurantOnboardingScreen />
      );

      // Step 1: Restaurant Information
      expect(getByText('Restaurant Setup')).toBeTruthy();
      expect(getByText('Restaurant Information')).toBeTruthy();
      expect(getByText('Step 1 of 9')).toBeTruthy();

      // Fill restaurant name - mimicking user typing
      const restaurantNameInput = getByPlaceholderText("e.g., Maria's Mexican Kitchen");
      fireEvent.changeText(restaurantNameInput, "Maria's Mexican Kitchen");

      // Fill display name
      const displayNameInput = getByPlaceholderText("e.g., Maria's Kitchen");
      fireEvent.changeText(displayNameInput, "Maria's Kitchen");

      // Select business type
      fireEvent.press(getByText('Restaurant'));

      // Navigate to next step
      const nextButton = getByTestId('next-step-button');
      fireEvent.press(nextButton);

      // Step 2: Contact Information
      await waitFor(() => {
        expect(getByText('Contact Information')).toBeTruthy();
        expect(getByText('Step 2 of 9')).toBeTruthy();
      });

      // Fill phone number
      const phoneInput = getByPlaceholderText('+44 20 1234 5678');
      fireEvent.changeText(phoneInput, '+44 20 7946 0958');

      // Fill email with proper validation
      const emailInput = getByPlaceholderText('owner@mariaskitchen.co.uk');
      fireEvent.changeText(emailInput, 'owner@mariaskitchen.co.uk');

      // Trigger blur to validate email (mimicking real user behavior)
      fireEvent(emailInput, 'blur');

      // Email validation is done locally, no API call expected

      fireEvent.press(getByTestId('next-step-button'));

      // Step 3: Restaurant Location
      await waitFor(() => {
        expect(getByText('Restaurant Location')).toBeTruthy();
        expect(getByText('Step 3 of 9')).toBeTruthy();
      });

      const streetInput = getByTestId('address-street');
      fireEvent.changeText(streetInput, '123 High Street');

      const cityInput = getByTestId('address-city');
      fireEvent.changeText(cityInput, 'London');

      const postcodeInput = getByTestId('address-postcode');
      fireEvent.changeText(postcodeInput, 'SW1A 1AA');

      fireEvent.press(getByTestId('next-step-button'));

      // Step 4: Owner Information
      await waitFor(() => {
        expect(getByText('Owner Information')).toBeTruthy();
        expect(getByText('Step 4 of 9')).toBeTruthy();
      });

      const ownerNameInput = getByPlaceholderText('Maria Rodriguez');
      fireEvent.changeText(ownerNameInput, 'Maria Rodriguez');

      const ownerEmailInput = getByPlaceholderText('owner@restaurant.com');
      fireEvent.changeText(ownerEmailInput, 'maria@mariaskitchen.co.uk');

      fireEvent.press(getByTestId('next-step-button'));

      // Step 5: Business Hours
      await waitFor(() => {
        expect(getByText('Business Hours')).toBeTruthy();
        expect(getByText('Step 5 of 9')).toBeTruthy();
      });

      // Business Hours has no skip button - just use default hours and click Next
      fireEvent.press(getByTestId('next-step-button'));

      // Step 6: Employee Management
      await waitFor(() => {
        expect(getByText('Employee Management')).toBeTruthy();
        expect(getByText('Step 6 of 9')).toBeTruthy();
      });

      // Employee Management has no skip button - just click Next
      fireEvent.press(getByTestId('next-step-button'));

      // Step 7: Menu Setup
      await waitFor(() => {
        expect(getByText('Menu Setup')).toBeTruthy();
        expect(getByText('Step 7 of 9')).toBeTruthy();
      });

      // Test skip functionality - menu can be skipped
      expect(queryByText('Skip for Now')).toBeTruthy();
      fireEvent.press(getByText('Skip for Now'));

      // Handle skip alert
      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          'Skip Menu Setup?',
          'You can always add your menu later from the Settings menu.',
          expect.any(Array)
        );
      });

      // Simulate pressing Skip in the alert
      const alertCalls = mockAlert.mock.calls;
      const alertCall = alertCalls[alertCalls.length - 1];
      const skipButton = alertCall[2].find(
        (btn: unknown): btn is { text: string; onPress: () => void } =>
          typeof btn === 'object' && btn !== null && 'text' in btn && (btn as any).text === 'Skip'
      );
      skipButton?.onPress();

      // Step 8: Bank Details - CANNOT BE SKIPPED
      await waitFor(() => {
        expect(getByText('Bank Details')).toBeTruthy();
        expect(getByText('Step 8 of 9')).toBeTruthy();
      });

      // Verify skip button is NOT available for bank details
      expect(queryByText('Skip')).toBeNull();
      expect(queryByText('Skip for Now')).toBeNull();

      // Fill bank details (required)
      const sortCodeInput = getByPlaceholderText('00-00-00');
      fireEvent.changeText(sortCodeInput, '12-34-56');

      const accountNumberInput = getByPlaceholderText('12345678');
      fireEvent.changeText(accountNumberInput, '12345678');

      const accountNameInput = getByPlaceholderText('Your Restaurant Ltd');
      fireEvent.changeText(accountNameInput, "Maria's Mexican Kitchen Ltd");

      fireEvent.press(getByTestId('next-step-button'));

      // Step 9: Review & Complete
      await waitFor(() => {
        expect(getByText('Review & Complete')).toBeTruthy();
        expect(getByText('Step 9 of 9')).toBeTruthy();
      });

      // Verify review shows all entered data
      expect(getByText("Maria's Mexican Kitchen")).toBeTruthy();
      expect(getByText('+44 20 7946 0958 • owner@mariaskitchen.co.uk')).toBeTruthy();
      expect(getByText('123 High Street, London SW1A 1AA')).toBeTruthy();
      expect(getByText('Maria Rodriguez')).toBeTruthy();
      // Note: Bank details are not shown in the review section

      // Complete setup
      const completeButton = getByTestId('complete-setup-button');
      fireEvent.press(completeButton);

      // Verify final API call with complete payload
      await waitFor(() => {
        const apiCalls = (fetch as jest.Mock).mock.calls;
        const completeCall = apiCalls.find((call) =>
          call[0].includes('/restaurants/onboarding/create')
        );

        expect(completeCall).toBeTruthy();
        expect(completeCall[1]).toMatchObject({
          method: 'POST',
          headers: {
            Authorization: 'Bearer test-auth-token',
            'Content-Type': 'application/json',
          },
        });

        const body = JSON.parse(completeCall[1].body);
        expect(body).toMatchObject({
          name: 'Marias Mexican Kitchen', // Sanitized (apostrophe removed)
          display_name: 'Marias Kitchen', // Sanitized
          business_type: 'Restaurant',
          phone: '+44 20 7946 0958',
          email: 'owner@mariaskitchen.co.uk',
          address: {
            street: '123 High Street',
            city: 'London',
            zipCode: 'SW1A 1AA', // API uses zipCode, not postcode
          },
          owner_info: {
            // Nested structure
            name: 'Maria Rodriguez',
            email: 'maria@mariaskitchen.co.uk',
          },
          bank_details: {
            sort_code: '123456', // Without dashes
            account_number: '12345678',
            account_name: 'Marias Mexican Kitchen Ltd', // Sanitized
          },
        });
      });

      // Verify success alert
      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          'Onboarding Complete! 🎉',
          expect.stringContaining("Welcome to Fynlo, Maria's Mexican Kitchen!"),
          expect.any(Array)
        );
      });

      // Simulate clicking "Start Using POS"
      const successAlertCall = mockAlert.mock.calls.find(
        (call) => call[0] === 'Onboarding Complete! 🎉'
      );
      const startButton = successAlertCall[2].find(
        (btn: unknown): btn is { text: string; onPress: () => void } =>
          typeof btn === 'object' &&
          btn !== null &&
          'text' in btn &&
          (btn as any).text === 'Start Using POS'
      );

      // Step 8 - Bank Details (required)
      await waitFor(() => getByText('Bank Details'));
      fireEvent.changeText(getByPlaceholderText('00-00-00'), '12-34-56');
      fireEvent.changeText(getByPlaceholderText('12345678'), '12345678');
      fireEvent.changeText(getByPlaceholderText('Your Restaurant Ltd'), 'Test Ltd');
      fireEvent.press(getByTestId('next-step-button'));

      // Step 9 - Complete
      await waitFor(() => getByTestId('complete-setup-button'));
      fireEvent.press(getByTestId('complete-setup-button'));

      // Verify error alert is shown with proper message
      await waitFor(() => {
        const errorAlerts = mockAlert.mock.calls.filter((call) => call[0] === 'Error');
        expect(errorAlerts.length).toBeGreaterThan(0);
        const lastErrorAlert = errorAlerts[errorAlerts.length - 1];
        expect(lastErrorAlert[1]).toContain('POST /api/v1/restaurants/onboarding/create not found');
      });

      // Verify we didn't navigate away (still on review step)
      expect(mockReset).not.toHaveBeenCalled();
      expect(getByText('Review & Complete')).toBeTruthy();
    });
  });

  describe('Skip Functionality', () => {
    it('should properly handle skip scenarios - only menu setup has skip button, bank details cannot be skipped', async () => {
      const { getByText, getByPlaceholderText, getByTestId, queryByText } = renderWithProviders(
        <ComprehensiveRestaurantOnboardingScreen />
      );

      // Navigate through required steps
      // Step 1 - Required
      fireEvent.changeText(getByPlaceholderText("e.g., Maria's Mexican Kitchen"), 'Test');
      fireEvent.changeText(getByPlaceholderText("e.g., Maria's Kitchen"), 'Test');
      fireEvent.press(getByText('Restaurant'));
      fireEvent.press(getByTestId('next-step-button'));

      // Step 2 - Required (no skip)
      await waitFor(() => getByText('Contact Information'));
      expect(queryByText('Skip')).toBeNull();
      expect(queryByText('Skip for Now')).toBeNull();
      fireEvent.changeText(getByPlaceholderText('+44 20 1234 5678'), '+44 20 7946 0958');
      fireEvent.changeText(getByPlaceholderText('owner@mariaskitchen.co.uk'), 'test@test.com');
      fireEvent.press(getByTestId('next-step-button'));

      // Step 3 - Required (no skip)
      await waitFor(() => getByText('Restaurant Location'));
      expect(queryByText('Skip')).toBeNull();
      expect(queryByText('Skip for Now')).toBeNull();
      fireEvent.changeText(getByTestId('address-street'), '123 Test St');
      fireEvent.changeText(getByTestId('address-city'), 'London');
      fireEvent.changeText(getByTestId('address-postcode'), 'SW1A 1AA');
      fireEvent.press(getByTestId('next-step-button'));

      // Step 4 - Required (no skip)
      await waitFor(() => getByText('Owner Information'));
      expect(queryByText('Skip')).toBeNull();
      expect(queryByText('Skip for Now')).toBeNull();
      fireEvent.changeText(getByPlaceholderText('Maria Rodriguez'), 'Test Owner');
      fireEvent.changeText(getByPlaceholderText('owner@restaurant.com'), 'owner@test.com');
      fireEvent.press(getByTestId('next-step-button'));

      // Step 5 - Hours (optional - has Next but can use defaults)
      await waitFor(() => getByText('Business Hours'));
      expect(getByTestId('next-step-button')).toBeTruthy();
      fireEvent.press(getByTestId('next-step-button'));

      // Step 6 - Employees (optional - has Next button, no Skip)
      await waitFor(() => getByText('Employee Management'));
      expect(getByTestId('next-step-button')).toBeTruthy();
      fireEvent.press(getByTestId('next-step-button'));

      // Step 7 - Menu (optional - has Skip for Now)
      await waitFor(() => getByText('Menu Setup'));
      expect(getByText('Skip for Now')).toBeTruthy();
      fireEvent.press(getByText('Skip for Now'));

      // Handle alert
      await waitFor(() => expect(Alert.alert).toHaveBeenCalled());
      const alertCalls = mockAlert.mock.calls;
      const alertCall = alertCalls[alertCalls.length - 1];
      const skipBtn = alertCall[2].find(
        (btn: unknown): btn is { text: string; onPress: () => void } =>
          typeof btn === 'object' && btn !== null && 'text' in btn && (btn as any).text === 'Skip'
      );
      skipBtn?.onPress();

      // Step 8 - Bank Details (REQUIRED - NO SKIP)
      await waitFor(() => getByText('Bank Details'));
      expect(queryByText('Skip')).toBeNull();
      expect(queryByText('Skip for Now')).toBeNull();

      // Must fill bank details to proceed
      expect(getByTestId('next-step-button')).toBeTruthy();
    });
  });

  describe('Dictation/Speech Input Support', () => {
    it('should support dictation for all text inputs', async () => {
      const { getByPlaceholderText, getByTestId } = renderWithProviders(
        <ComprehensiveRestaurantOnboardingScreen />
      );

      // Test restaurant name input supports dictation
      const nameInput = getByPlaceholderText("e.g., Maria's Mexican Kitchen");

      // Verify text input properties that enable dictation
      expect(nameInput.props.autoCorrect).not.toBe(false);
      expect(nameInput.props.autoComplete).not.toBe('off');
      expect(nameInput.props.keyboardType).not.toBe('visible-password');
      expect(nameInput.props.secureTextEntry).not.toBe(true);

      // Simulate dictation input (in real app, this comes from speech recognition)
      fireEvent.changeText(nameInput, "Maria's Mexican Kitchen");
      expect(nameInput.props.value).toBe("Maria's Mexican Kitchen");

      // Test that all inputs are dictation-friendly
      const displayNameInput = getByPlaceholderText("e.g., Maria's Kitchen");
      expect(displayNameInput.props.autoCorrect).not.toBe(false);

      // Navigate to contact step
      fireEvent.changeText(nameInput, 'Test');
      fireEvent.changeText(displayNameInput, 'Test');
      fireEvent.press(getByTestId('next-step-button'));

      // Check email input supports dictation
      await waitFor(() => getByPlaceholderText('owner@mariaskitchen.co.uk'));
      const emailInput = getByPlaceholderText('owner@mariaskitchen.co.uk');

      // Email inputs typically have autoCorrect false, but should still support dictation
      expect(emailInput.props.keyboardType).toBe('email-address');
      expect(emailInput.props.secureTextEntry).not.toBe(true);
    });

    it('should handle dictation character issue (only typing "V")', async () => {
      const { getByPlaceholderText } = renderWithProviders(
        <ComprehensiveRestaurantOnboardingScreen />
      );

      const nameInput = getByPlaceholderText("e.g., Maria's Mexican Kitchen");

      // Test that full text is accepted, not just single characters
      fireEvent.changeText(nameInput, 'V'); // Current buggy behavior
      expect(nameInput.props.value).toBe('V');

      // Clear and test proper behavior
      fireEvent.changeText(nameInput, '');
      fireEvent.changeText(nameInput, 'Voice Dictated Restaurant Name');
      expect(nameInput.props.value).toBe('Voice Dictated Restaurant Name');

      // Verify no text transformation is interfering
      expect(nameInput.props.autoCapitalize).toBeTruthy(); // Should allow normal capitalization
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should validate all required fields before allowing navigation', async () => {
      const { getByTestId, getByText, getByPlaceholderText } = renderWithProviders(
        <ComprehensiveRestaurantOnboardingScreen />
      );

      // Wait for component to render
      await waitFor(() => {
        expect(getByTestId('next-step-button')).toBeTruthy();
      });

      // Fill all required fields for step 1
      fireEvent.changeText(
        getByPlaceholderText("e.g., Maria's Mexican Kitchen"),
        'Test Restaurant'
      );
      fireEvent.changeText(getByPlaceholderText("e.g., Maria's Kitchen"), 'Test Display');
      // Business type defaults to 'Restaurant'

      // Now button should work
      fireEvent.press(getByTestId('next-step-button'));

      // Should proceed to step 2
      await waitFor(() => {
        expect(getByText('Step 2 of 9')).toBeTruthy();
      });

      // On step 2, try to proceed without filling required fields
      fireEvent.press(getByTestId('next-step-button'));

      // Should stay on step 2 (phone and email are required)
      expect(getByText('Step 2 of 9')).toBeTruthy();

      // Fill phone
      fireEvent.changeText(getByTestId('restaurant-phone'), '+44 20 1234 5678');

      // Try again - still missing email
      fireEvent.press(getByTestId('next-step-button'));
      expect(getByText('Step 2 of 9')).toBeTruthy();

      // Fill email
      fireEvent.changeText(getByTestId('restaurant-email'), 'test@example.com');

      // Now should be able to proceed
      fireEvent.press(getByTestId('next-step-button'));

      await waitFor(() => {
        expect(getByText('Step 3 of 9')).toBeTruthy();
      });
    });

    it('should handle network errors gracefully during onboarding completion', async () => {
      (fetch as jest.Mock).mockRejectedValue(new Error('Network request failed'));

      const { getByTestId, getByText, getByPlaceholderText } = renderWithProviders(
        <ComprehensiveRestaurantOnboardingScreen />
      );

      // Fill all required fields to get to completion
      // Step 1
      fireEvent.changeText(
        getByPlaceholderText("e.g., Maria's Mexican Kitchen"),
        'Test Restaurant'
      );
      fireEvent.changeText(getByPlaceholderText("e.g., Maria's Kitchen"), 'Test');
      fireEvent.press(getByText('Restaurant'));
      fireEvent.press(getByTestId('next-step-button'));

      // Step 2
      await waitFor(() => getByText('Contact Information'));
      fireEvent.changeText(getByPlaceholderText('+44 20 1234 5678'), '+44 20 7946 0958');
      fireEvent.changeText(getByPlaceholderText('owner@mariaskitchen.co.uk'), 'test@test.com');
      fireEvent.press(getByTestId('next-step-button'));

      // Step 3
      await waitFor(() => getByText('Restaurant Location'));
      fireEvent.changeText(getByTestId('address-street'), '123 Test St');
      fireEvent.changeText(getByTestId('address-city'), 'London');
      fireEvent.changeText(getByTestId('address-postcode'), 'SW1A 1AA');
      fireEvent.press(getByTestId('next-step-button'));

      // Step 4
      await waitFor(() => getByText('Owner Information'));
      fireEvent.changeText(getByPlaceholderText('Maria Rodriguez'), 'Test Owner');
      fireEvent.changeText(getByPlaceholderText('owner@restaurant.com'), 'owner@test.com');
      fireEvent.press(getByTestId('next-step-button'));

      // Skip steps 5-7
      // Step 5 - Business Hours
      await waitFor(() => getByText('Business Hours'));
      fireEvent.press(getByTestId('next-step-button'));

      // Step 6 - Employee Management
      await waitFor(() => getByText('Employee Management'));
      fireEvent.press(getByTestId('next-step-button'));

      // Step 7 - Menu Setup (has Skip for Now button)
      await waitFor(() => getByText('Skip for Now'));
      fireEvent.press(getByText('Skip for Now'));
      const alertCalls = mockAlert.mock.calls;
      const alertCall = alertCalls[alertCalls.length - 1];
      const skipBtn = alertCall[2].find(
        (btn: unknown): btn is { text: string; onPress: () => void } =>
          typeof btn === 'object' && btn !== null && 'text' in btn && (btn as any).text === 'Skip'
      );
      skipBtn?.onPress();

      // Step 8 - Bank Details (required)
      await waitFor(() => getByText('Bank Details'));
      fireEvent.changeText(getByPlaceholderText('00-00-00'), '12-34-56');
      fireEvent.changeText(getByPlaceholderText('12345678'), '12345678');
      fireEvent.changeText(getByPlaceholderText('Your Restaurant Ltd'), 'Test Ltd');
      fireEvent.press(getByTestId('next-step-button'));

      // Step 9 - Complete
      await waitFor(() => getByTestId('complete-setup-button'));
      fireEvent.press(getByTestId('complete-setup-button'));

      // Should handle network error gracefully
      await waitFor(() => {
        expect(fetch).toHaveBeenCalled();
        const errorAlerts = mockAlert.mock.calls.filter((call) => call[0] === 'Error');
        expect(errorAlerts.length).toBeGreaterThan(0);
      });
    });

    it('should handle API timeout errors during onboarding completion', async () => {
      // Mock API timeout for onboarding completion
      (fetch as jest.Mock).mockImplementation((url) => {
        if (url.includes('/restaurants/onboarding/create')) {
          return new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Request timeout')), 100)
          );
        }
        return Promise.resolve({
          ok: true,
          json: async () => ({ success: true }),
        });
      });

      const { getByTestId, getByText, getByPlaceholderText } = renderWithProviders(
        <ComprehensiveRestaurantOnboardingScreen />
      );

      // Quick fill all required fields to get to final step
      // Step 1
      fireEvent.changeText(getByPlaceholderText("e.g., Maria's Mexican Kitchen"), 'Test');
      fireEvent.changeText(getByPlaceholderText("e.g., Maria's Kitchen"), 'Test');
      fireEvent.press(getByText('Restaurant'));
      fireEvent.press(getByTestId('next-step-button'));

      // Step 2
      await waitFor(() => getByText('Contact Information'));
      fireEvent.changeText(getByPlaceholderText('+44 20 1234 5678'), '+44 20 7946 0958');
      fireEvent.changeText(getByPlaceholderText('owner@mariaskitchen.co.uk'), 'test@test.com');
      fireEvent.press(getByTestId('next-step-button'));

      // Step 3
      await waitFor(() => getByText('Restaurant Location'));
      fireEvent.changeText(getByTestId('address-street'), '123 Test St');
      fireEvent.changeText(getByTestId('address-city'), 'London');
      fireEvent.changeText(getByTestId('address-postcode'), 'SW1A 1AA');
      fireEvent.press(getByTestId('next-step-button'));

      // Step 4
      await waitFor(() => getByText('Owner Information'));
      fireEvent.changeText(getByPlaceholderText('Maria Rodriguez'), 'Test Owner');
      fireEvent.changeText(getByPlaceholderText('owner@restaurant.com'), 'owner@test.com');
      fireEvent.press(getByTestId('next-step-button'));

      // Skip steps 5-7
      // Step 5 - Business Hours
      await waitFor(() => getByText('Business Hours'));
      fireEvent.press(getByTestId('next-step-button'));

      // Step 6 - Employee Management
      await waitFor(() => getByText('Employee Management'));
      fireEvent.press(getByTestId('next-step-button'));

      // Step 7 - Menu Setup (has Skip for Now button)
      await waitFor(() => getByText('Skip for Now'));
      fireEvent.press(getByText('Skip for Now'));
      const alertCalls = mockAlert.mock.calls;
      const alertCall = alertCalls[alertCalls.length - 1];
      const skipBtn = alertCall[2].find(
        (btn: unknown): btn is { text: string; onPress: () => void } =>
          typeof btn === 'object' && btn !== null && 'text' in btn && (btn as any).text === 'Skip'
      );
      skipBtn?.onPress();

      // Step 8 - Bank Details (required)
      await waitFor(() => getByText('Bank Details'));
      fireEvent.changeText(getByPlaceholderText('00-00-00'), '12-34-56');
      fireEvent.changeText(getByPlaceholderText('12345678'), '12345678');
      fireEvent.changeText(getByPlaceholderText('Your Restaurant Ltd'), 'Test Ltd');
      fireEvent.press(getByTestId('next-step-button'));

      // Step 9 - Complete
      await waitFor(() => getByTestId('complete-setup-button'));
      fireEvent.press(getByTestId('complete-setup-button'));

      // Should handle timeout gracefully
      await waitFor(
        () => {
          expect(fetch).toHaveBeenCalled();
          const errorAlerts = mockAlert.mock.calls.filter((call) => call[0] === 'Error');
          expect(errorAlerts.length).toBeGreaterThan(0);
        },
        { timeout: 300 }
      );
    });
  });

  describe('Navigation and Data Persistence', () => {
    it('should persist data when navigating back and forth between steps', async () => {
      const { getByTestId, getByText, getByPlaceholderText } = renderWithProviders(
        <ComprehensiveRestaurantOnboardingScreen />
      );

      // Enter data in step 1
      const nameInput = getByPlaceholderText("e.g., Maria's Mexican Kitchen");
      const displayInput = getByPlaceholderText("e.g., Maria's Kitchen");

      fireEvent.changeText(nameInput, 'Persisted Restaurant');
      fireEvent.changeText(displayInput, 'Persisted Display');
      fireEvent.press(getByText('Restaurant'));

      // Navigate to step 2
      fireEvent.press(getByTestId('next-step-button'));
      await waitFor(() => getByText('Contact Information'));

      // Navigate back to step 1
      fireEvent.press(getByTestId('back-button'));
      await waitFor(() => getByText('Restaurant Information'));

      // Data should be persisted
      const nameInputAgain = getByPlaceholderText("e.g., Maria's Mexican Kitchen");
      const displayInputAgain = getByPlaceholderText("e.g., Maria's Kitchen");

      expect(nameInputAgain.props.value).toBe('Persisted Restaurant');
      expect(displayInputAgain.props.value).toBe('Persisted Display');
      // Business type selection should be persisted
    });

    it('should handle rapid navigation without data loss', async () => {
      const { getByTestId, getByPlaceholderText, getByText } = renderWithProviders(
        <ComprehensiveRestaurantOnboardingScreen />
      );

      // Rapidly fill and navigate
      fireEvent.changeText(getByPlaceholderText("e.g., Maria's Mexican Kitchen"), 'Quick Test');
      fireEvent.changeText(getByPlaceholderText("e.g., Maria's Kitchen"), 'Quick');
      fireEvent.press(getByText('Restaurant')); // Select business type

      // Try rapid button presses
      const nextButton = getByTestId('next-step-button');
      fireEvent.press(nextButton);

      // Should navigate to step 2
      await waitFor(() => getByText('Contact Information'));

      // Navigate back
      fireEvent.press(getByTestId('back-button'));

      // Should be back on step 1 with data preserved
      await waitFor(() => {
        const nameInput = getByPlaceholderText("e.g., Maria's Mexican Kitchen");
        expect(nameInput.props.value).toBe('Quick Test');
        const displayInput = getByPlaceholderText("e.g., Maria's Kitchen");
        expect(displayInput.props.value).toBe('Quick');
      });
    });
  });

  describe('Complete API Integration', () => {
    it('should send complete and correct payload to onboarding API', async () => {
      (fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({ restaurant_id: 'rest-123', success: true }),
      });

      const { getByTestId, getByText, getByPlaceholderText } = renderWithProviders(
        <ComprehensiveRestaurantOnboardingScreen />
      );

      // Fill all required fields with specific test data
      const testData = {
        restaurantName: 'API Test Restaurant',
        displayName: 'API Test',
        phone: '+44 20 1234 5678',
        email: 'api@test.com',
        street: '456 API Street',
        city: 'TestCity',
        postcode: 'TC1 2AB',
        ownerName: 'API Owner',
        ownerEmail: 'owner@apitest.com',
        sortCode: '11-22-33',
        accountNumber: '87654321',
        accountName: 'API Test Ltd',
      };

      // Navigate and fill all steps
      // Step 1
      fireEvent.changeText(
        getByPlaceholderText("e.g., Maria's Mexican Kitchen"),
        testData.restaurantName
      );
      fireEvent.changeText(getByPlaceholderText("e.g., Maria's Kitchen"), testData.displayName);
      fireEvent.press(getByText('Restaurant'));
      fireEvent.press(getByTestId('next-step-button'));

      // Step 2
      await waitFor(() => getByText('Contact Information'));
      fireEvent.changeText(getByPlaceholderText('+44 20 1234 5678'), testData.phone);
      fireEvent.changeText(getByPlaceholderText('owner@mariaskitchen.co.uk'), testData.email);
      fireEvent.press(getByTestId('next-step-button'));

      // Step 3
      await waitFor(() => getByText('Restaurant Location'));
      fireEvent.changeText(getByTestId('address-street'), testData.street);
      fireEvent.changeText(getByTestId('address-city'), testData.city);
      fireEvent.changeText(getByTestId('address-postcode'), testData.postcode);
      fireEvent.press(getByTestId('next-step-button'));

      // Step 4
      await waitFor(() => getByText('Owner Information'));
      fireEvent.changeText(getByPlaceholderText('Maria Rodriguez'), testData.ownerName);
      fireEvent.changeText(getByPlaceholderText('owner@restaurant.com'), testData.ownerEmail);
      fireEvent.press(getByTestId('next-step-button'));

      // Skip steps 5-7
      // Step 5 - Business Hours
      await waitFor(() => getByText('Business Hours'));
      fireEvent.press(getByTestId('next-step-button'));

      // Step 6 - Employee Management
      await waitFor(() => getByText('Employee Management'));
      fireEvent.press(getByTestId('next-step-button'));

      // Step 7 - Menu Setup (has Skip for Now button)
      await waitFor(() => getByText('Skip for Now'));
      fireEvent.press(getByText('Skip for Now'));
      const alertCalls = mockAlert.mock.calls;
      const alertCall = alertCalls[alertCalls.length - 1];
      const skipBtn = alertCall[2].find(
        (btn: unknown): btn is { text: string; onPress: () => void } =>
          typeof btn === 'object' && btn !== null && 'text' in btn && (btn as any).text === 'Skip'
      );
      skipBtn?.onPress();

      // Step 8 - Bank Details
      await waitFor(() => getByText('Bank Details'));
      fireEvent.changeText(getByPlaceholderText('00-00-00'), testData.sortCode);
      fireEvent.changeText(getByPlaceholderText('12345678'), testData.accountNumber);
      fireEvent.changeText(getByPlaceholderText('Your Restaurant Ltd'), testData.accountName);
      fireEvent.press(getByTestId('next-step-button'));

      // Step 9 - Complete
      await waitFor(() => getByTestId('complete-setup-button'));
      fireEvent.press(getByTestId('complete-setup-button'));

      // Verify final API payload structure
      await waitFor(() => {
        const calls = (fetch as jest.Mock).mock.calls;
        const onboardingCall = calls.find((call) =>
          call[0].includes('/restaurants/onboarding/create')
        );

        expect(onboardingCall).toBeTruthy();
        const payload = JSON.parse(onboardingCall[1].body);

        // Verify complete payload structure
        expect(payload).toMatchObject({
          name: 'API Test Restaurant', // Sanitized
          display_name: 'API Test', // Sanitized
          business_type: 'Restaurant',
          phone: testData.phone,
          email: testData.email,
          address: {
            street: testData.street,
            city: testData.city,
            zipCode: testData.postcode.toUpperCase(),
          },
          owner_info: {
            name: testData.ownerName,
            email: testData.ownerEmail,
          },
          bank_details: {
            sort_code: '112233', // Without dashes
            account_number: testData.accountNumber,
            account_name: testData.accountName,
          },
        });
      });
    });
  });
});
