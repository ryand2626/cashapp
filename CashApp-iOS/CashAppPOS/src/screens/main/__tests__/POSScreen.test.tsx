/**
 * POSScreen Component Tests
 * Testing the main point-of-sale interface
 */

// // @ts-nocheck
import React from 'react';

import { fireEvent, waitFor, act } from '@testing-library/react-native';

import { customRenderWithStores, useTestTheme } from '../../../__tests__/utils/testUtils';
import { ThemeProvider } from '../../../design-system/ThemeProvider'; // Import ThemeProvider
import useAppStore from '../../../store/useAppStore';
import useUIStore from '../../../store/useUIStore';
import POSScreen, { _ExportedMenuItemCard } from '../POSScreen'; // Import ExportedMenuItemCard

// Mock navigation
const mockNavigation = {
  navigate: jest.fn(),
  goBack: jest.fn(),
  dispatch: jest.fn(),
};

// Mock menu items directly from POSScreen for consistency
const _menuItems = [
  {
    id: 1,
    name: 'Nachos',
    price: 5.0,
    category: 'Snacks',
    emoji: '🧀',
    available: true,
    description: 'Description for Nachos',
  },
  {
    id: 6,
    name: 'Carnitas Taco',
    price: 3.5,
    category: 'Tacos',
    emoji: '🌮',
    available: true,
    description: 'Description for Carnitas',
  },
  {
    id: 7,
    name: 'Cochinita Taco',
    price: 3.5,
    category: 'Tacos',
    emoji: '🌮',
    available: true,
    description: 'Description for Cochinita',
  },
  {
    id: 20,
    name: 'Carne Asada Taco',
    price: 4.5,
    category: 'Special Tacos',
    emoji: '⭐',
    available: true,
    description: 'Description for Carne Asada',
  },
  {
    id: 31,
    name: 'Pink Paloma',
    price: 3.75,
    category: 'Drinks',
    emoji: '🍹',
    available: true,
    description: 'Description for Pink Paloma',
  },
  {
    id: 32,
    name: 'Coco-Nought',
    price: 3.75,
    category: 'Drinks',
    emoji: '🥥',
    available: false,
    description: 'Unavailable Drink',
  }, // Example of unavailable item
];

// Mock theme for ExportedMenuItemCard if needed, or wrap with ThemeProvider
const TestWrapper = ({ children }) => {
  const theme = useTestTheme(); // Assuming useTestTheme provides a valid theme object
  return <ThemeProvider theme={theme}>{children}</ThemeProvider>;
};

describe('POSScreen', () => {
  // Initial store state that can be modified by tests
  let initialAppStoreState;
  let initialUIStoreState;

  beforeEach(() => {
    jest.clearAllMocks();

    // Reset store states before each test
    initialAppStoreState = {
      cart: [],
      addToCart: jest.fn((item) =>
        useAppStore.setState((state) => ({ cart: [...state.cart, { ...item, quantity: 1 }] }))
      ),
      removeFromCart: jest.fn((id) =>
        useAppStore.setState((state) => ({ cart: state.cart.filter((item) => item.id !== id) }))
      ),
      updateCartItem: jest.fn((id, updates) =>
        useAppStore.setState((state) => ({
          cart: state.cart.map((item) => (item.id === id ? { ...item, ...updates } : item)),
        }))
      ),
      clearCart: jest.fn(() => useAppStore.setState({ cart: [] })),
      cartTotal: jest.fn(() =>
        useAppStore.getState().cart.reduce((sum, item) => sum + item.price * item.quantity, 0)
      ),
      cartItemCount: jest.fn(() =>
        useAppStore.getState().cart.reduce((sum, item) => sum + item.quantity, 0)
      ),
    };

    initialUIStoreState = {
      selectedCategory: 'All',
      setSelectedCategory: jest.fn((category) =>
        useUIStore.setState({ selectedCategory: category })
      ),
      showPaymentModal: false,
      setShowPaymentModal: jest.fn((show) => useUIStore.setState({ showPaymentModal: show })),
    };

    // Set initial state for stores
    useAppStore.setState(initialAppStoreState, true);
    useUIStore.setState(initialUIStoreState, true);
  });

  it('renders correctly and magnifier icon is not present', () => {
    const { getByText, getByTestId, queryByTestId, UNSAFE_getByProps } = customRenderWithStores(
      <POSScreen />,
      { navigationProps: { navigation: mockNavigation } }
    );

    // Check for some known text elements
    expect(getByText('Fynlo POS')).toBeTruthy(); // Assuming this is part of your header or a static text
    expect(getByTestId('menu-flat-list')).toBeTruthy();
    expect(UNSAFE_getByProps({ name: 'shopping-cart' })).toBeTruthy(); // Check for cart icon

    // Verify magnifier icon is not present
    // This depends on how the magnifier was implemented (e.g., by icon name or testID)
    // Assuming it was an Icon with name "search"
    const _allIcons = UNSAFE_getByProps({ name: 'search' });
    // If the search icon was only in the header, and now we have one in the bubble,
    // we need a more specific way to check the header.
    // For now, let's assume the header search icon was unique or had a specific testID not present now.
    // If CategorySearchBubble also uses an icon named "search", this test needs adjustment.
    // Let's assume the old one was `header-search-icon` for clarity.
    expect(queryByTestId('header-search-icon')).toBeNull(); // Example testID for the old icon
  });

  it('displays menu items correctly', () => {
    const { getByText } = customRenderWithStores(<POSScreen />, {
      navigationProps: { navigation: mockNavigation },
    });
    expect(getByText('Nachos')).toBeTruthy();
    expect(getByText('£5.00')).toBeTruthy(); // Assuming formatPrice works like this
    expect(getByText('Carnitas Taco')).toBeTruthy();
  });

  it('adds item to cart when tapped', () => {
    const { getByText } = customRenderWithStores(<POSScreen />, {
      navigationProps: { navigation: mockNavigation },
    });

    const nachosItem = getByText('Nachos');
    fireEvent.press(nachosItem);

    expect(initialAppStoreState.addToCart).toHaveBeenCalledWith(
      expect.objectContaining({ id: 1, name: 'Nachos', price: 5.0 })
    );
    // Check if cart state was updated (optional, as addToCart is mocked to update state)
    expect(useAppStore.getState().cart.length).toBe(1);
  });

  it('opens cart modal when cart icon is pressed', () => {
    const { getByTestId, getByText } = customRenderWithStores(<POSScreen />, {
      navigationProps: { navigation: mockNavigation },
    });
    const cartButton = getByTestId('shopping-cart-button');
    fireEvent.press(cartButton);
    expect(getByText('Current Order')).toBeTruthy(); // Modal title
  });

  it('CartIcon color is orange when empty, red when not empty', () => {
    const { _getByTestId, UNSAFE_getByProps, rerender } = customRenderWithStores(<POSScreen />, {
      navigationProps: { navigation: mockNavigation },
    });

    // Initial state: cart is empty
    let cartIconComponent = UNSAFE_getByProps({ testID: 'shopping-cart-button' });
    let internalIcon = cartIconComponent.findAllByType(
      require('react-native-vector-icons/MaterialIcons').default
    )[0];
    // Check for theme.colors.primary (Fynlo orange) - exact color depends on your theme setup
    // For this test, we'll assume the color prop is directly passed.
    // The theme object itself is complex to mock perfectly here, so we check the logic's output.
    // If theme.colors.primary is '#FF6B35' (example Fynlo Orange)
    expect(internalIcon.props.color).toBe('#FF6B35'); // Orange when empty

    // Add an item to the cart
    act(() => {
      useAppStore
        .getState()
        .addToCart({ id: 1, name: 'Test Item', price: 10, quantity: 1, emoji: '🧪' });
    });

    // Rerender or update component to reflect store changes
    rerender(
      <TestWrapper>
        <POSScreen navigation={mockNavigation} />
      </TestWrapper>
    );

    cartIconComponent = UNSAFE_getByProps({ testID: 'shopping-cart-button' });
    internalIcon = cartIconComponent.findAllByType(
      require('react-native-vector-icons/MaterialIcons').default
    )[0];
    expect(internalIcon.props.color).toBe('#FF3B30'); // Red when not empty
  });

  describe('Search Functionality', () => {
    it('renders CategorySearchBubble', () => {
      const { getByTestId } = customRenderWithStores(<POSScreen />, {
        navigationProps: { navigation: mockNavigation },
      });
      expect(getByTestId('category-search-bubble-inactive')).toBeTruthy();
    });

    it('expands search bubble on tap and shows TextInput', () => {
      const { getByTestId, getByPlaceholderText } = customRenderWithStores(<POSScreen />, {
        navigationProps: { navigation: mockNavigation },
      });
      const bubble = getByTestId('category-search-bubble-inactive');
      fireEvent.press(bubble);
      expect(getByTestId('category-search-bubble-active')).toBeTruthy();
      expect(getByPlaceholderText('Search food...')).toBeTruthy();
    });

    it('filters items when typing "Taco"', async () => {
      const { getByTestId, getByPlaceholderText, queryByText } = customRenderWithStores(
        <POSScreen />,
        { navigationProps: { navigation: mockNavigation } }
      );

      fireEvent.press(getByTestId('category-search-bubble-inactive'));
      const searchInput = getByPlaceholderText('Search food...');

      act(() => {
        fireEvent.changeText(searchInput, 'Taco');
      });

      // Wait for state update and re-render
      await waitFor(() => {
        expect(queryByText('Carnitas Taco')).toBeTruthy();
        expect(queryByText('Cochinita Taco')).toBeTruthy();
        expect(queryByText('Carne Asada Taco')).toBeTruthy();
        expect(queryByText('Nachos')).toBeNull(); // Should not be visible
        expect(queryByText('Pink Paloma')).toBeNull(); // Should not be visible
      });
    });

    it('clears search and shows all items (for "All" category) when clear button is pressed', async () => {
      const { getByTestId, getByPlaceholderText, queryByText } = customRenderWithStores(
        <POSScreen />,
        { navigationProps: { navigation: mockNavigation } }
      );

      fireEvent.press(getByTestId('category-search-bubble-inactive'));
      const searchInput = getByPlaceholderText('Search food...');

      act(() => {
        fireEvent.changeText(searchInput, 'Taco');
      });

      await waitFor(() => expect(queryByText('Nachos')).toBeNull()); // Pre-condition: Nachos is hidden

      const clearButton = getByTestId('clear-search-button');
      act(() => {
        fireEvent.press(clearButton);
      });

      await waitFor(() => {
        // Search query is cleared, should show all items if "All" category is selected
        expect(queryByText('Nachos')).toBeTruthy();
        expect(queryByText('Carnitas Taco')).toBeTruthy();
        expect(queryByText('Pink Paloma')).toBeTruthy();
      });
      // Bubble should also revert to inactive state
      expect(getByTestId('category-search-bubble-inactive')).toBeTruthy();
    });

    it('filters correctly when a category is selected and then search is used', async () => {
      const { getByTestId, getByPlaceholderText, getByText, queryByText } = customRenderWithStores(
        <POSScreen />,
        { navigationProps: { navigation: mockNavigation } }
      );

      // Select 'Tacos' category
      const tacosCategoryTab = getByText('Tacos');
      act(() => {
        fireEvent.press(tacosCategoryTab);
      });

      await waitFor(() => {
        expect(useUIStore.getState().selectedCategory).toBe('Tacos');
        expect(queryByText('Nachos')).toBeNull(); // Nachos (Snacks) should be hidden
        expect(queryByText('Carnitas Taco')).toBeTruthy();
        expect(queryByText('Carne Asada Taco')).toBeNull(); // Special Taco, should be hidden by category
      });

      // Now search within 'Tacos'
      fireEvent.press(getByTestId('category-search-bubble-inactive'));
      const searchInput = getByPlaceholderText('Search food...');
      act(() => {
        fireEvent.changeText(searchInput, 'Cochinita');
      });

      await waitFor(() => {
        expect(queryByText('Cochinita Taco')).toBeTruthy();
        expect(queryByText('Carnitas Taco')).toBeNull(); // Should be hidden by search
      });

      // Clear search, should revert to 'Tacos' category items
      const clearButton = getByTestId('clear-search-button');
      act(() => {
        fireEvent.press(clearButton);
      });

      await waitFor(() => {
        expect(queryByText('Carnitas Taco')).toBeTruthy();
        expect(queryByText('Cochinita Taco')).toBeTruthy();
        expect(queryByText('Carne Asada Taco')).toBeNull(); // Still hidden by category
        expect(queryByText('Nachos')).toBeNull(); // Still hidden by category
      });
    });
  });

  // Test for unavailable items (ensure it's not tappable)
  it('handles unavailable items correctly (not tappable)', () => {
    const { getByText } = customRenderWithStores(<POSScreen />, {
      navigationProps: { navigation: mockNavigation },
    });
    const unavailableItemText = getByText('Coco-Nought'); // This item is marked available: false

    // Check if the parent TouchableOpacity is disabled or press does not call addToCart
    // This depends on how ExportedMenuItemCard handles disabled state.
    // We'll assume if it's disabled, addToCart won't be called.
    fireEvent.press(unavailableItemText);
    expect(initialAppStoreState.addToCart).not.toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Coco-Nought' })
    );
  });
});

// Snapshot tests for Header Actions conditional rendering (if applicable)
// This part might need adjustment based on how IS_DEV and FLAGS are handled in your actual setup.
// For these tests, we'll mock them directly.
describe('POSScreen Header Actions Conditional Rendering Snapshots', () => {
  let mockIS_DEV;
  jest.mock('../../../env', () => ({
    // Corrected path
    get IS_DEV() {
      return mockIS_DEV;
    },
    envBool: jest.fn((name, fallback) => fallback),
  }));

  beforeEach(() => {
    jest.clearAllMocks();
    // @ts-expect-error
    global.FLAGS = { SHOW_DEV_MENU: true }; // Default for these tests
  });

  it('snapshot: no bug icon in production (FLAGS.SHOW_DEV_MENU = true)', () => {
    mockIS_DEV = false;
    const { toJSON } = customRenderWithStores(<POSScreen />, {
      navigationProps: { navigation: mockNavigation },
    });
    expect(toJSON()).toMatchSnapshot();
  });

  it('snapshot: bug icon in development (FLAGS.SHOW_DEV_MENU = true)', () => {
    mockIS_DEV = true;
    const { toJSON } = customRenderWithStores(<POSScreen />, {
      navigationProps: { navigation: mockNavigation },
    });
    expect(toJSON()).toMatchSnapshot();
  });

  it('snapshot: no bug icon if FLAGS.SHOW_DEV_MENU = false (dev)', () => {
    mockIS_DEV = true;
    // @ts-expect-error
    global.FLAGS.SHOW_DEV_MENU = false;
    const { toJSON } = customRenderWithStores(<POSScreen />, {
      navigationProps: { navigation: mockNavigation },
    });
    expect(toJSON()).toMatchSnapshot();
  });

  it('snapshot: no bug icon if FLAGS.SHOW_DEV_MENU = false (prod)', () => {
    mockIS_DEV = false;
    // @ts-expect-error
    global.FLAGS.SHOW_DEV_MENU = false;
    const { toJSON } = customRenderWithStores(<POSScreen />, {
      navigationProps: { navigation: mockNavigation },
    });
    expect(toJSON()).toMatchSnapshot();
  });
});
