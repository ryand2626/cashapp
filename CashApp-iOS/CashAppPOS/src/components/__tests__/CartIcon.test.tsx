import React from 'react';

import { StyleSheet } from 'react-native';

import { render, screen, fireEvent } from '@testing-library/react-native';

import { Colors } from '../../constants/Colors';
import { ThemeProvider, _defaultTheme } from '../../design-system/ThemeProvider'; // Assuming ThemeProvider is needed
import CartIcon from '../cart/CartIcon';

// Mock react-native-vector-icons/MaterialIcons
jest.mock('react-native-vector-icons/MaterialIcons', () => {
  const RealIcon = jest.requireActual('react-native-vector-icons/MaterialIcons');
  // Mock the specific icon being used in CartIcon
  return (props: unknown) => (
    <RealIcon name={props.name} size={props.size} color={props.color} testID="mock-icon" />
  );
});

const mockTheme = {
  colors: {
    white: Colors.white,
    primary: Colors.primary,
    secondary: Colors.secondary,
    background: Colors.background,
    text: Colors.text,
    border: Colors.border,
    // Add other colors from defaultTheme if needed
  },
};

// Helper to render with ThemeProvider if your component uses useTheme
const renderWithProviders = (ui: React.ReactElement) => {
  return render(<ThemeProvider theme={mockTheme}>{ui}</ThemeProvider>);
};

describe('CartIcon', () => {
  it('renders with correct color and no badge when itemCount is 0', () => {
    renderWithProviders(<CartIcon count={0} onPress={() => {}} testID="cart-icon" />);

    const icon = screen.getByTestId('mock-icon'); // Using the mock icon's testID
    expect(icon.props.color).toBe(Colors.onPrimary);

    // Badge should not be present
    const badge = screen.queryByText(/\d+/); // Query for any digit representing the count
    expect(badge).toBeNull();
  });

  it('renders with alertSoft color and badge when itemCount is greater than 0', () => {
    const itemCount = 5;
    renderWithProviders(<CartIcon count={itemCount} onPress={() => {}} testID="cart-icon" />);

    const icon = screen.getByTestId('mock-icon');
    expect(icon.props.color).toBe(Colors.alertSoft);

    // Badge should be visible with the correct count
    const badgeText = screen.getByText(itemCount.toString());
    expect(badgeText).toBeDefined();

    // Check badge background color by inspecting its parent style
    const badgeView = screen.getByTestId('cart-badge');
    // Note: Accessing style like this can be brittle if styles are deeply nested or computed.
    // However, for a direct style like backgroundColor, it's often acceptable.
    // We need to find the correct property in the flattened style object.
    // React Native Testing Library might flatten styles, so direct access might work.
    // If StyleSheet.flatten was used internally by the testing library or component:
    const flattenedStyle = StyleSheet.flatten(badgeView.props.style);
    expect(flattenedStyle.backgroundColor).toBe(Colors.alertStrong);
  });

  it('displays "99+" in badge when itemCount is greater than 99', () => {
    renderWithProviders(<CartIcon count={150} onPress={() => {}} testID="cart-icon" />);

    const badgeText = screen.getByText('99+');
    expect(badgeText).toBeDefined();
  });

  it('calls onPress when pressed', () => {
    const mockOnPress = jest.fn();
    renderWithProviders(<CartIcon count={0} onPress={mockOnPress} testID="cart-icon-press" />);

    const touchable = screen.getByTestId('cart-icon-press');
    fireEvent.press(touchable);
    expect(mockOnPress).toHaveBeenCalledTimes(1);
  });
});
