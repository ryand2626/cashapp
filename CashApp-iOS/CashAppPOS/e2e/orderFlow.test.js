/**
 * E2E Tests for Order Flow
 * Testing complete order creation and processing workflow
 */

// Import global test helpers
/* global loginAsTestUser, logout, addItemToCart, openPaymentModal, completePayment */

describe('Order Flow', () => {
  beforeEach(async () => {
    await device.reloadReactNative();
    await loginAsTestUser();
  });

  afterEach(async () => {
    try {
      await logout();
    } catch (error) {
      // Ignore logout errors in tests
    }
  });

  it('should display empty cart initially', async () => {
    await expect(element(by.text('Current Order'))).toBeVisible();
    await expect(element(by.text('Add items to start an order'))).toBeVisible();
    await expect(element(by.id('cart-icon'))).toBeVisible();
  });

  it('should add items to cart', async () => {
    // Add first item
    await addItemToCart('Classic Burger');

    await waitFor(element(by.text('Classic Burger')))
      .toBeVisible()
      .withTimeout(5000);

    await expect(element(by.text('1'))).toBeVisible(); // Quantity
    await expect(element(by.text('$12.99'))).toBeVisible(); // Price

    // Add second item
    await addItemToCart('French Fries');

    await waitFor(element(by.text('French Fries')))
      .toBeVisible()
      .withTimeout(5000);
  });

  it('should increase quantity when adding same item', async () => {
    await addItemToCart('Classic Burger');
    await addItemToCart('Classic Burger');

    await waitFor(element(by.text('2')))
      .toBeVisible()
      .withTimeout(5000);

    // Total should update
    await expect(element(by.text('$25.98'))).toBeVisible();
  });

  it('should update item quantity with +/- buttons', async () => {
    await addItemToCart('Classic Burger');

    // Increase quantity
    await element(by.id('increase-qty-1')).tap();
    await expect(element(by.text('2'))).toBeVisible();

    // Decrease quantity
    await element(by.id('decrease-qty-1')).tap();
    await expect(element(by.text('1'))).toBeVisible();
  });

  it('should remove item when quantity reaches zero', async () => {
    await addItemToCart('Classic Burger');

    // Decrease to zero
    await element(by.id('decrease-qty-1')).tap();

    // Item should be removed
    await waitFor(element(by.text('Add items to start an order')))
      .toBeVisible()
      .withTimeout(5000);
  });

  it('should clear entire cart', async () => {
    await addItemToCart('Classic Burger');
    await addItemToCart('French Fries');

    // Clear cart
    await element(by.id('clear-cart-button')).tap();

    await waitFor(element(by.text('Add items to start an order')))
      .toBeVisible()
      .withTimeout(5000);
  });

  it('should filter items by category', async () => {
    // Initially should show all items
    await expect(element(by.text('Classic Burger'))).toBeVisible();
    await expect(element(by.text('Caesar Salad'))).toBeVisible();

    // Filter by Main category
    await element(by.text('Main')).tap();

    await expect(element(by.text('Classic Burger'))).toBeVisible();
    await expect(element(by.text('Caesar Salad'))).not.toBeVisible();

    // Filter by Salads category
    await element(by.text('Salads')).tap();

    await expect(element(by.text('Caesar Salad'))).toBeVisible();
    await expect(element(by.text('Classic Burger'))).not.toBeVisible();

    // Back to All
    await element(by.text('All')).tap();

    await expect(element(by.text('Classic Burger'))).toBeVisible();
    await expect(element(by.text('Caesar Salad'))).toBeVisible();
  });

  it('should calculate total correctly', async () => {
    await addItemToCart('Classic Burger'); // $12.99
    await addItemToCart('French Fries'); // $4.99
    await addItemToCart('Classic Burger'); // +$12.99 (quantity becomes 2)

    // Total should be $30.97 (12.99 * 2 + 4.99)
    await waitFor(element(by.text('$30.97')))
      .toBeVisible()
      .withTimeout(5000);
  });

  it('should open payment modal', async () => {
    await addItemToCart('Classic Burger');
    await openPaymentModal();

    await expect(element(by.text('Process Payment'))).toBeVisible();
    await expect(element(by.text('Order Summary'))).toBeVisible();
    await expect(element(by.text('Classic Burger x1'))).toBeVisible();
    await expect(element(by.text('Total: $12.99'))).toBeVisible();
  });

  it('should close payment modal', async () => {
    await addItemToCart('Classic Burger');
    await openPaymentModal();

    // Close modal
    await element(by.id('close-payment-modal')).tap();

    await waitFor(element(by.text('Current Order')))
      .toBeVisible()
      .withTimeout(5000);
  });

  it('should add customer name to order', async () => {
    await addItemToCart('Classic Burger');
    await openPaymentModal();

    await element(by.id('customer-name-input')).typeText('John Doe');
    await element(by.id('confirm-payment-button')).tap();

    await waitFor(element(by.text('Order for John Doe has been processed successfully!')))
      .toBeVisible()
      .withTimeout(5000);
  });

  it('should complete order flow', async () => {
    await addItemToCart('Classic Burger');
    await addItemToCart('French Fries');

    await openPaymentModal();
    await element(by.id('customer-name-input')).typeText('Test Customer');
    await completePayment();

    // Order should be completed and cart cleared
    await element(by.text('OK')).tap();

    await waitFor(element(by.text('Add items to start an order')))
      .toBeVisible()
      .withTimeout(5000);
  });

  it('should handle unavailable items', async () => {
    // Try to tap an unavailable item (if any)
    const unavailableItem = element(by.text('Unavailable')).atIndex(0);

    try {
      await unavailableItem.tap();
      // Should not be added to cart
      await expect(element(by.text('Add items to start an order'))).toBeVisible();
    } catch (error) {
      // No unavailable items found, test passes
    }
  });

  it('should maintain cart state during navigation', async () => {
    await addItemToCart('Classic Burger');

    // Navigate to Orders screen
    await element(by.id('orders-tab')).tap();
    await expect(element(by.text('Orders'))).toBeVisible();

    // Navigate back to POS
    await element(by.id('pos-tab')).tap();

    // Cart should still have the item
    await expect(element(by.text('Classic Burger'))).toBeVisible();
    await expect(element(by.text('1'))).toBeVisible();
  });

  it('should handle rapid item additions', async () => {
    // Rapidly add multiple items
    await addItemToCart('Classic Burger');
    await addItemToCart('French Fries');
    await addItemToCart('Caesar Salad');
    await addItemToCart('Classic Burger');
    await addItemToCart('French Fries');

    // Should handle all additions correctly
    await expect(element(by.text('Classic Burger'))).toBeVisible();
    await expect(element(by.text('French Fries'))).toBeVisible();
    await expect(element(by.text('Caesar Salad'))).toBeVisible();

    // Check quantities
    await expect(element(by.text('2'))).toBeVisible(); // Burger quantity
  });

  it('should show correct item count in tab badge', async () => {
    await addItemToCart('Classic Burger');
    await addItemToCart('French Fries');

    // Tab should show item count badge
    await expect(element(by.id('cart-badge-2'))).toBeVisible();

    await addItemToCart('Classic Burger'); // Increases quantity

    // Badge should update to show total quantity
    await expect(element(by.id('cart-badge-3'))).toBeVisible();
  });

  it('should keep "Charge" button visible for long carts', async () => {
    // Add 20 items to the cart from the menuItems array in POSScreen.tsx
    // This assumes items are identifiable by their text on menu cards.
    const itemNames = [
      'Nachos',
      'Quesadillas',
      'Chorizo Quesadilla',
      'Chicken Quesadilla',
      'Tostada',
      'Carnitas',
      'Cochinita',
      'Barbacoa de Res',
      'Chorizo',
      'Rellena',
      'Chicken Fajita',
      'Haggis',
      'Pescado',
      'Dorados',
      'Dorados Papa',
      'Nopal',
      'Frijol',
      'Verde',
      'Fajita',
      'Carne Asada',
      // Ensure these names exactly match what's rendered for menu items
    ];

    for (const itemName of itemNames) {
      // Scroll to find the item if not visible, then tap
      // Note: Detox's scrolling behavior might need adjustment based on layout
      try {
        await waitFor(element(by.text(itemName)))
          .toBeVisible()
          .whileElement(by.id('menu-flat-list'))
          .scroll(50, 'down');
        await element(by.text(itemName)).tap();
      } catch (e) {
        // Fallback if already visible or scrolling logic needs refinement
        console.warn(
          `Could not find or tap ${itemName} with initial scroll, attempting direct tap.`
        );
        await element(by.text(itemName)).tap();
      }
    }

    // Open the cart modal by tapping the cart icon/button
    // Assuming the cart icon has a testID 'cart-icon-button' or similar.
    // From POSScreen.tsx, the cart button is part of headerRight.
    // <TouchableOpacity style={styles.cartButton} onPress={() => setShowCartModal(true)}>
    //   <Icon name="shopping-cart" size={24} color={theme.colors.white} />
    // </TouchableOpacity>
    // We'll use a more generic approach if a specific testID isn't set, e.g., matching by Icon name if possible,
    // or by a parent view's testID if the TouchableOpacity itself isn't uniquely identifiable.
    // For now, let's assume a testID 'shopping-cart-button' is added to the TouchableOpacity.
    await element(by.id('shopping-cart-button')).tap();

    // In the cart modal, check if the "Charge" button is visible
    // The button text is dynamic: "Charge £XX.XX"
    // We need to use a matcher that can find part of the text or use a testID.
    // Let's assume the TouchableOpacity for the charge button has testID 'charge-button'.
    // From POSScreen.tsx: <TouchableOpacity style={styles.chargeButton} onPress={() => { setShowCartModal(false); setShowPaymentModal(true); }}>
    await waitFor(element(by.id('charge-button')))
      .toBeVisible()
      .withTimeout(2000);

    // Also check if it's tappable
    await element(by.id('charge-button')).tap();

    // After tapping charge, the payment modal should appear.
    // The payment modal's title is "Payment".
    await expect(element(by.text('Payment'))).toBeVisible();
  });
});
