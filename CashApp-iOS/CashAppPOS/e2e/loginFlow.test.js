/**
 * E2E Tests for Login Flow
 * Testing complete user authentication workflow
 */

// Import global test helpers
/* global logout */

describe('Login Flow', () => {
  beforeEach(async () => {
    await device.reloadReactNative();
  });

  it('should display login screen on app launch', async () => {
    await expect(element(by.text('Welcome Back'))).toBeVisible();
    await expect(element(by.text('Sign in to continue'))).toBeVisible();
    await expect(element(by.id('username-input'))).toBeVisible();
    await expect(element(by.id('password-input'))).toBeVisible();
    await expect(element(by.id('login-button'))).toBeVisible();
  });

  it('should show error for empty credentials', async () => {
    await element(by.id('login-button')).tap();

    await waitFor(element(by.text('Please enter both username and password')))
      .toBeVisible()
      .withTimeout(5000);

    await element(by.text('OK')).tap();
  });

  it('should show error for invalid credentials', async () => {
    await element(by.id('username-input')).typeText('wrong@example.com');
    await element(by.id('password-input')).typeText('wrongpassword');
    await element(by.id('login-button')).tap();

    await waitFor(element(by.text('Invalid username or password')))
      .toBeVisible()
      .withTimeout(10000);

    await element(by.text('OK')).tap();
  });

  it('should login successfully with valid credentials', async () => {
    await element(by.id('username-input')).typeText('demo');
    await element(by.id('password-input')).typeText('demo123');
    await element(by.id('login-button')).tap();

    // Should navigate to POS screen
    await waitFor(element(by.id('pos-screen')))
      .toBeVisible()
      .withTimeout(10000);

    await expect(element(by.text('Fynlo POS'))).toBeVisible();
    await expect(element(by.text('Current Order'))).toBeVisible();
  });

  it('should show loading state during login', async () => {
    await element(by.id('username-input')).typeText('demo');
    await element(by.id('password-input')).typeText('demo123');
    await element(by.id('login-button')).tap();

    // Should show loading text briefly
    await expect(element(by.text('Signing In...'))).toBeVisible();
  });

  it('should toggle password visibility', async () => {
    await element(by.id('password-input')).typeText('testpassword');

    // Password should be hidden initially
    await expect(element(by.id('password-toggle'))).toBeVisible();

    // Tap to show password
    await element(by.id('password-toggle')).tap();

    // Tap to hide password again
    await element(by.id('password-toggle')).tap();
  });

  it('should navigate to forgot password screen', async () => {
    await element(by.text('Forgot Password?')).tap();

    await waitFor(element(by.text('Forgot Password?')))
      .toBeVisible()
      .withTimeout(5000);

    await expect(element(by.text('Enter your email address'))).toBeVisible();

    // Navigate back
    await element(by.id('back-button')).tap();
    await expect(element(by.text('Welcome Back'))).toBeVisible();
  });

  it('should maintain form state during app backgrounding', async () => {
    await element(by.id('username-input')).typeText('test@example.com');
    await element(by.id('password-input')).typeText('password123');

    // Background and foreground app
    await device.sendToHome();
    await device.launchApp({ newInstance: false });

    // Form should maintain state
    await expect(element(by.id('username-input'))).toHaveText('test@example.com');
    await expect(element(by.id('password-input'))).toHaveText('password123');
  });

  it('should clear form on successful login and logout', async () => {
    // Login
    await element(by.id('username-input')).typeText('demo');
    await element(by.id('password-input')).typeText('demo123');
    await element(by.id('login-button')).tap();

    await waitFor(element(by.id('pos-screen')))
      .toBeVisible()
      .withTimeout(10000);

    // Logout
    await logout();

    // Form should be cleared
    await expect(element(by.id('username-input'))).toHaveText('');
    await expect(element(by.id('password-input'))).toHaveText('');
  });

  it('should handle keyboard properly', async () => {
    await element(by.id('username-input')).tap();

    // Username field should be focused
    await expect(element(by.id('username-input'))).toBeFocused();

    await element(by.id('username-input')).typeText('test@example.com');

    // Tap next should move to password
    await element(by.id('username-input')).tapReturnKey();
    await expect(element(by.id('password-input'))).toBeFocused();

    await element(by.id('password-input')).typeText('password123');

    // Done should trigger login
    await element(by.id('password-input')).tapReturnKey();

    // Should attempt login
    await waitFor(element(by.text('Invalid username or password')))
      .toBeVisible()
      .withTimeout(10000);
  });
});
