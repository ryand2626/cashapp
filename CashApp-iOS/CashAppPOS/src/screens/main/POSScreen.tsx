import React, { useState, useEffect } from 'react';

import {
  StyleSheet,
  Text,
  View,
  StatusBar,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
  FlatList,
  Modal,
  _TextInput,
  Alert,
  Dimensions,
  Platform,
  _Image,
  Animated,
} from 'react-native';

import { useNavigation } from '@react-navigation/native';
import { Swipeable } from 'react-native-gesture-handler';
import Icon from 'react-native-vector-icons/MaterialIcons';

import CartIcon from '../../components/cart/CartIcon';
import { QuantityPill } from '../../components/inputs';
import SimpleTextInput from '../../components/inputs/SimpleTextInput';
import HeaderWithBackButton from '../../components/navigation/HeaderWithBackButton';
import SumUpPaymentComponent from '../../components/payment/SumUpPaymentComponent';
import SumUpTestComponent from '../../components/payment/SumUpTestComponent';
import CategorySearchBubble from '../../components/search/CategorySearchBubble';
import { useTheme, useThemedStyles } from '../../design-system/ThemeProvider';
import { IS_DEV } from '../../env';
import { useRestaurantDisplayName } from '../../hooks/useRestaurantConfig';
import CustomersService from '../../services/CustomersService';
import DatabaseService from '../../services/DatabaseService';
import DataService from '../../services/DataService';
import ErrorTrackingService from '../../services/ErrorTrackingService';
import PlatformService from '../../services/PlatformService';
import SharedDataStore from '../../services/SharedDataStore';
import SumUpCompatibilityService from '../../services/SumUpCompatibilityService';
import useAppStore from '../../store/useAppStore';
import useSettingsStore from '../../store/useSettingsStore';
import useUIStore from '../../store/useUIStore';
import { logger } from '../../utils/logger';
import {
  validatePrice,
  calculatePercentageFee,
  validateCartCalculation,
  formatPrice,
} from '../../utils/priceValidation';

import type { MenuItem, OrderItem } from '../../types';

// Get screen dimensions
const { width: screenWidth } = Dimensions.get('window');
const isTablet = screenWidth > 768;

// NOTE: Mexican menu items are now loaded dynamically from backend
// See DatabaseService.getMexicanMenuFallback() for the data structure

// Define ExportedMenuItemCard outside of POSScreen for export
const ExportedMenuItemCard = ({
  item,
  theme,
  styles: propStyles,
  cart,
  handleAddToCart,
  handleUpdateQuantity,
}: {
  item: MenuItem;
  theme: unknown;
  styles: unknown;
  cart: OrderItem[];
  handleAddToCart: (item: MenuItem) => void;
  handleUpdateQuantity: (id: number, quantity: number) => void;
}) => {
  const existingItem = cart.find((cartItem) => cartItem.id === item.id);

  return (
    <View style={[propStyles.menuCard, !item.available && propStyles.menuCardDisabled]}>
      <TouchableOpacity
        style={propStyles.menuCardContent}
        onPress={() => item.available && handleAddToCart(item)}
        activeOpacity={0.7}
        disabled={!item.available}
      >
        <Icon
          name={item.icon || 'restaurant'}
          size={32}
          color={theme.colors.primary}
          style={propStyles.menuItemIcon}
        />
        <Text style={propStyles.menuItemName} numberOfLines={2}>
          {item.name}
        </Text>
        <Text style={propStyles.menuItemPrice}>
          {formatPrice(item.price, '£', {
            screenName: 'POSScreen',
            operation: 'menu_item_price_display',
            inputValues: { itemId: item.id, itemName: item.name },
          })}
        </Text>
      </TouchableOpacity>

      {existingItem && (
        <View style={propStyles.quantityPillContainer}>
          <QuantityPill
            quantity={existingItem.quantity}
            onIncrease={() => handleUpdateQuantity(item.id, existingItem.quantity + 1)}
            onDecrease={() => handleUpdateQuantity(item.id, existingItem.quantity - 1)}
            size="medium"
            colorScheme="accent"
            minValue={0}
            maxValue={99}
          />
        </View>
      )}
    </View>
  );
};

// Export for testing
export { ExportedMenuItemCard };

type POSScreenNavigationProp = any; // TODO: restore original DrawerNavigationProp typing

const POSScreen: React.FC = () => {
  const navigation = useNavigation<POSScreenNavigationProp>();
  const restaurantDisplayName = useRestaurantDisplayName();
  const { theme } = useTheme();
  const styles = useThemedStyles(createStyles);

  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [showCartModal, setShowCartModal] = useState(false);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState('sumup');
  const [serviceChargeConfig, setServiceChargeConfig] = useState({
    enabled: false,
    rate: 0,
    description: 'Loading...',
  });
  const [showSumUpPayment, setShowSumUpPayment] = useState(false);
  const [showSumUpTest, setShowSumUpTest] = useState(false);
  const [serviceChargeDebugInfo, setServiceChargeDebugInfo] = useState('');
  const [searchQuery, setSearchQuery] = useState(''); // State for search query

  // Dynamic styles that depend on state
  const dynamicStyles = createDynamicStyles(theme, serviceChargeConfig);

  // Dynamic menu state
  const [dynamicMenuItems, setDynamicMenuItems] = useState<MenuItem[]>([]);
  const [dynamicCategories, setDynamicCategories] = useState<string[]>([]);
  const [menuLoading, setMenuLoading] = useState(true);

  // Debug showSumUpPayment state changes
  useEffect(() => {
    logger.info('🔄 showSumUpPayment state changed to:', showSumUpPayment);
  }, [showSumUpPayment]);

  // Create themed styles

  // Zustand stores
  const { cart, addToCart, removeFromCart, updateCartItem, clearCart, cartTotal, cartItemCount } =
    useAppStore();

  const { selectedCategory, setSelectedCategory, showPaymentModal, setShowPaymentModal } =
    useUIStore();

  const { taxConfiguration } = useSettingsStore();

  // Load platform service charge configuration with real-time updates
  useEffect(() => {
    const dataStore = SharedDataStore.getInstance();

    const loadServiceChargeConfig = async () => {
      try {
        const config = await dataStore.getServiceChargeConfig();
        setServiceChargeConfig(config);
        // Sensitive data removed - do not log service charge config
      } catch (error) {
        logger.error('❌ Failed to load service charge config:', error);
      }
    };

    // Initial load
    loadServiceChargeConfig();

    // Subscribe to real-time updates
    const unsubscribe = dataStore.subscribe('serviceCharge', (updatedConfig) => {
      logger.info('🔄 Service charge config updated in real-time:', updatedConfig);
      const debugInfo = `SYNC: ${
        updatedConfig.enabled ? updatedConfig.rate + '%' : 'OFF'
      } @ ${new Date().toLocaleTimeString()}`;
      logger.info('📊 Service charge debug:', debugInfo);
      setServiceChargeConfig(updatedConfig);
      setServiceChargeDebugInfo(debugInfo);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  // Load dynamic menu data with optimized performance
  useEffect(() => {
    const loadMenuData = async () => {
      try {
        setMenuLoading(true);
        const dataService = DataService.getInstance();

        // Increase timeout to 15 seconds to allow for slower API responses and retries
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Menu loading timeout')), 15000)
        );

        // Load menu items and categories with timeout
        const [menuItems, categories] = (await Promise.race([
          Promise.all([dataService.getMenuItems(), dataService.getMenuCategories()]),
          timeoutPromise,
        ])) as [any[], any[]];

        setDynamicMenuItems(menuItems);

        // Extract category names for the UI
        const categoryNames = [
          'All',
          ...categories.map((cat) => cat.name).filter((name) => name !== 'All'),
        ];
        setDynamicCategories(categoryNames);

        logger.info('✅ Dynamic menu loaded:', {
          itemCount: menuItems.length,
          categories: categoryNames,
        });
      } catch (error) {
        logger.error('❌ Failed to load dynamic menu:', error);

        // Log detailed error information
        logger.info(`
📱 ======== MENU LOADING ERROR ========
🕐 Time: ${new Date().toISOString()}
📍 Component: POSScreen
🔍 Error Type: ${error.constructor.name}
💬 Message: ${error.message}
📊 Error Details: ${JSON.stringify(error, null, 2)}
=====================================
        `);

        // Determine the type of error for better user feedback
        let errorMessage = 'Failed to load menu';
        if (error.message === 'Menu loading timeout') {
          errorMessage = 'Menu loading timed out. The server might be slow.';
          logger.warn('⏱️ Menu loading timeout - server may be experiencing high load');
        } else if (error.message?.includes('API Timeout')) {
          errorMessage = 'Unable to connect to server after multiple attempts.';
          logger.warn('🔄 Multiple retry attempts failed');
        } else if (error.message?.includes('Network request failed')) {
          errorMessage = 'No internet connection. Using offline menu.';
          logger.warn('📡 Network connection issue detected');
        }

        // Show user-friendly error message
        if (Platform.OS === 'ios' || Platform.OS === 'android') {
          Alert.alert('Menu Loading Issue', `${errorMessage}\n\nUsing cached menu data.`, [
            { text: 'OK' },
          ]);
        }

        // Use local Chucho menu data as fallback
        try {
          // Import the local menu data directly to avoid API calls
          const { CHUCHO_MENU_ITEMS, CHUCHO_CATEGORIES } = await import('../../data/chuchoMenu');

          logger.info('🍮 Using local Chucho menu data as fallback');

          // Transform menu items to match expected format
          const fallbackItems = CHUCHO_MENU_ITEMS.map((item) => ({
            ...item,
            emoji: item.image, // Map image to emoji field for compatibility
          }));

          setDynamicMenuItems(fallbackItems);

          // Set categories
          const categoryNames = [
            'All',
            ...CHUCHO_CATEGORIES.map((cat) => cat.name).filter((name) => name !== 'All'),
          ];
          setDynamicCategories(categoryNames);

          logger.info('✅ Loaded fallback menu:', {
            itemCount: fallbackItems.length,
            categories: categoryNames,
          });
        } catch (fallbackError) {
          logger.error('❌ Fallback import failed:', fallbackError);
          setDynamicMenuItems([]);
          setDynamicCategories(['All']);
        }
      } finally {
        setMenuLoading(false);
      }
    };

    loadMenuData();
  }, []);

  // Calculate taxes and fees with error tracking
  const calculateVAT = (subtotal: number) => {
    if (!taxConfiguration.vatEnabled) return 0;

    const vatCalculation = calculatePercentageFee(subtotal, taxConfiguration.vatRate, {
      operation: 'vat_calculation',
      screenName: 'POSScreen',
      inputValues: {
        subtotal,
        vatRate: taxConfiguration.vatRate,
        vatEnabled: taxConfiguration.vatEnabled,
      },
    });

    if (!vatCalculation.isValid) {
      const errorTrackingService = ErrorTrackingService.getInstance();
      errorTrackingService.trackPricingError(
        new Error(`VAT calculation failed: ${vatCalculation.error}`),
        { subtotal, vatRate: taxConfiguration.vatRate },
        { screenName: 'POSScreen', action: 'vat_calculation' }
      );
      return 0;
    }

    return vatCalculation.value;
  };

  const calculateServiceFee = (subtotal: number) => {
    if (!serviceChargeConfig.enabled) return 0;

    const serviceFeeCalculation = calculatePercentageFee(subtotal, serviceChargeConfig.rate, {
      operation: 'service_fee_calculation',
      screenName: 'POSScreen',
      inputValues: {
        subtotal,
        serviceChargeRate: serviceChargeConfig.rate,
        serviceChargeEnabled: serviceChargeConfig.enabled,
      },
    });

    if (!serviceFeeCalculation.isValid) {
      const errorTrackingService = ErrorTrackingService.getInstance();
      errorTrackingService.trackPricingError(
        new Error(`Service fee calculation failed: ${serviceFeeCalculation.error}`),
        { subtotal, serviceChargeRate: serviceChargeConfig.rate },
        { screenName: 'POSScreen', action: 'service_fee_calculation' }
      );
      return 0;
    }

    return serviceFeeCalculation.value;
  };

  const calculateCartTotal = () => {
    try {
      const cartCalculation = validateCartCalculation(
        cart,
        taxConfiguration.vatEnabled ? taxConfiguration.vatRate : undefined,
        serviceChargeConfig.enabled ? serviceChargeConfig.rate : undefined,
        {
          operation: 'cart_total_calculation',
          screenName: 'POSScreen',
          inputValues: {
            cartItems: cart.length,
            vatEnabled: taxConfiguration.vatEnabled,
            vatRate: taxConfiguration.vatRate,
            serviceChargeEnabled: serviceChargeConfig.enabled,
            serviceChargeRate: serviceChargeConfig.rate,
          },
        }
      );

      if (cartCalculation.hasErrors) {
        const errorTrackingService = ErrorTrackingService.getInstance();
        errorTrackingService.trackPricingError(
          new Error('Cart total calculation has errors'),
          {
            subtotalValid: cartCalculation.subtotal.isValid,
            taxValid: cartCalculation.tax.isValid,
            serviceChargeValid: cartCalculation.serviceCharge.isValid,
            totalValid: cartCalculation.total.isValid,
            cart: cart.map((item) => ({
              id: item.id,
              name: item.name,
              price: item.price,
              quantity: item.quantity,
            })),
          },
          { screenName: 'POSScreen', action: 'cart_total_calculation' }
        );
      }

      return cartCalculation.total.value;
    } catch (error) {
      const errorTrackingService = ErrorTrackingService.getInstance();
      errorTrackingService.trackPricingError(
        error instanceof Error ? error : new Error(`Cart total calculation error: ${error}`),
        { cart },
        { screenName: 'POSScreen', action: 'cart_total_calculation' }
      );
      return 0;
    }
  };

  const filteredItems = dynamicMenuItems
    .filter((item) => selectedCategory === 'All' || item.category === selectedCategory)
    .filter((item) =>
      searchQuery ? item.name.toLowerCase().includes(searchQuery.toLowerCase()) : true
    );

  const handleAddToCart = (item: MenuItem) => {
    const orderItem: OrderItem = {
      id: item.id,
      name: item.name,
      price: item.price,
      quantity: 1,
      emoji: item.emoji,
    };
    addToCart(orderItem);
  };

  const handleUpdateQuantity = (id: number, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(id);
    } else {
      updateCartItem(id, { quantity });
    }
  };

  const processPayment = async () => {
    // Upsert customer before payment if we have both name & valid email
    const emailRegex = /^\S+@\S+\.[A-Za-z]{2,}$/;
    if (customerEmail && emailRegex.test(customerEmail)) {
      try {
        await CustomersService.saveCustomer({
          name: customerName?.trim() || undefined,
          email: customerEmail.trim(),
        });
      } catch (err) {
        logger.warn('Could not save customer info', err);
      }
    }

    const totalAmount = calculateCartTotal();

    // Close payment modal first
    setShowPaymentModal(false);

    switch (selectedPaymentMethod) {
      case 'sumup':
        // Check SumUp compatibility before attempting payment
        logger.info('🏦 Starting SumUp payment for amount:', totalAmount);
        const checkSumUpCompatibility = async () => {
          const compatibilityService = SumUpCompatibilityService.getInstance();
          const shouldAttempt = await compatibilityService.shouldAttemptSumUp();

          if (shouldAttempt) {
            logger.info('🏦 SumUp compatible, showing payment modal');
            setShowSumUpPayment(true);
          } else {
            logger.warn('⚠️ SumUp not compatible, showing alternatives');
            const _fallbackMethods = compatibilityService.getFallbackPaymentMethods();

            Alert.alert(
              'Tap to Pay Unavailable',
              'Tap to Pay on iPhone requires Apple approval. Choose an alternative payment method:',
              [
                {
                  text: 'QR Code Payment (1.2%)',
                  onPress: () => {
                    navigation.navigate('QRCodePayment', {
                      amount: totalAmount,
                      orderItems: cart,
                      customerName: customerName || 'Customer',
                      onPaymentComplete: handlePaymentComplete,
                    });
                  },
                },
                {
                  text: 'Cash Payment (Free)',
                  onPress: () => {
                    handlePaymentComplete({
                      success: true,
                      paymentMethod: 'cash',
                      amount: totalAmount,
                      currency: 'GBP',
                    });
                  },
                },
                {
                  text: 'Cancel',
                  style: 'cancel',
                  onPress: () => setShowPaymentModal(true),
                },
              ]
            );
          }
        };
        checkSumUpCompatibility();
        break;

      case 'square':
        // Navigate to Square payment selection screen
        Alert.alert('Square Payment', 'Choose your Square payment method:', [
          {
            text: 'Card Payment',
            onPress: () =>
              navigation.navigate('SquareCardPayment', {
                amount: totalAmount,
                currency: 'GBP',
                description: `Order for ${customerName || 'Customer'}`,
                onPaymentComplete: handlePaymentComplete,
                onPaymentCancelled: () => setShowPaymentModal(true),
              }),
          },
          {
            text: 'Contactless (Apple/Google Pay)',
            onPress: () =>
              navigation.navigate('SquareContactlessPayment', {
                amount: totalAmount,
                currency: 'GBP',
                description: `Order for ${customerName || 'Customer'}`,
                onPaymentComplete: handlePaymentComplete,
                onPaymentCancelled: () => setShowPaymentModal(true),
              }),
          },
          {
            text: 'Cancel',
            style: 'cancel',
            onPress: () => setShowPaymentModal(true),
          },
        ]);
        break;

      case 'qr':
        // Navigate to QR payment screen
        navigation.navigate('QRCodePayment', {
          amount: totalAmount,
          orderItems: cart,
          customerName: customerName || 'Customer',
          onPaymentComplete: handlePaymentComplete,
        });
        break;

      case 'cash':
        // Handle cash payment directly
        handlePaymentComplete({
          success: true,
          paymentMethod: 'cash',
          amount: totalAmount,
          currency: 'GBP',
        });
        break;

      case 'stripe':
        // Handle Stripe payment (fallback option)
        Alert.alert(
          'Stripe Payment',
          'Stripe payment integration coming soon. Please use another payment method.',
          [{ text: 'OK', onPress: () => setShowPaymentModal(true) }]
        );
        break;

      default:
        Alert.alert('Payment Error', 'Please select a payment method.', [
          { text: 'OK', onPress: () => setShowPaymentModal(true) },
        ]);
    }
  };

  const handlePaymentComplete = (result: unknown) => {
    if (result.success) {
      Alert.alert(
        'Payment Successful',
        `Order for ${
          customerName || 'Customer'
        } has been processed successfully!\nPayment Method: ${
          result.paymentMethod
        }\nAmount: ${formatPrice(result.amount, '£', {
          screenName: 'POSScreen',
          operation: 'payment_success_display',
        })}\n\nThank you for your business!`,
        [
          {
            text: 'OK',
            onPress: () => {
              clearCart();
              setCustomerName('');
              setShowCartModal(false);
            },
          },
        ]
      );
    } else {
      Alert.alert(
        'Payment Failed',
        result.error || 'Payment could not be processed. Please try again.',
        [{ text: 'OK', onPress: () => setShowPaymentModal(true) }]
      );
    }
  };

  // SumUp payment completion handlers
  const handleSumUpPaymentComplete = (
    success: boolean,
    transactionCode?: string,
    error?: string
  ) => {
    setShowSumUpPayment(false);

    if (success && transactionCode) {
      logger.info('🎉 SumUp payment completed successfully!', transactionCode);
      Alert.alert(
        'Payment Successful!',
        `Your payment has been processed successfully.\n\nTransaction Code: ${transactionCode}\nAmount: ${formatPrice(
          calculateCartTotal(),
          '£',
          { screenName: 'POSScreen', operation: 'payment_success_display' }
        )}`,
        [
          {
            text: 'OK',
            onPress: () => {
              clearCart();
              setCustomerName('');
            },
          },
        ]
      );
    } else {
      logger.error('❌ SumUp payment failed:', error);
      Alert.alert(
        'Payment Failed',
        error || 'The payment could not be processed. Please try again.',
        [
          {
            text: 'Retry',
            onPress: () => setShowPaymentModal(true),
          },
          {
            text: 'Cancel',
            style: 'cancel',
          },
        ]
      );
    }
  };

  const handleSumUpPaymentCancel = () => {
    setShowSumUpPayment(false);
    logger.info('❌ SumUp payment cancelled by user');
    // Show the payment modal again for user to try again
    setShowPaymentModal(true);
  };

  const MenuItemCard = ({ item }: { item: MenuItem }) => {
    const existingItem = cart.find((cartItem) => cartItem.id === item.id);

    return (
      <View style={[styles.menuCard, !item.available && styles.menuCardDisabled]}>
        <TouchableOpacity
          style={styles.menuCardContent}
          onPress={() => item.available && handleAddToCart(item)}
          activeOpacity={0.7}
          disabled={!item.available}
        >
          <Icon
            name={item.icon || 'restaurant'}
            size={32}
            color={theme.colors.primary}
            style={styles.menuItemIcon}
          />
          <Text style={styles.menuItemName} numberOfLines={2}>
            {item.name}
          </Text>
          <Text style={styles.menuItemPrice}>
            {formatPrice(item.price, '£', {
              screenName: 'POSScreen',
              operation: 'menu_item_price_display',
              inputValues: { itemId: item.id, itemName: item.name },
            })}
          </Text>
        </TouchableOpacity>

        {/* Quick Quantity Controls */}
        {existingItem && (
          <View style={styles.menuItemQuantityControls}>
            <TouchableOpacity
              style={styles.menuQuantityButton}
              onPress={() => handleUpdateQuantity(item.id, existingItem.quantity - 1)}
            >
              <Icon name="remove" size={20} color={theme.colors.white} />
            </TouchableOpacity>
            <Text style={styles.menuQuantityText}>{existingItem.quantity}</Text>
            <TouchableOpacity
              style={styles.menuQuantityButton}
              onPress={() => handleUpdateQuantity(item.id, existingItem.quantity + 1)}
            >
              <Icon name="add" size={20} color={theme.colors.white} />
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  const CartItem = ({ item }: { item: OrderItem }) => {
    const menuItem = dynamicMenuItems.find((mi) => mi.id === item.id);

    const renderRightActions = (
      progress: Animated.AnimatedInterpolation<number>,
      dragX: Animated.AnimatedValue
    ) => {
      const scale = dragX.interpolate({
        inputRange: [-100, 0],
        outputRange: [1, 0],
        extrapolate: 'clamp',
      });

      return (
        <TouchableOpacity style={styles.deleteButton} onPress={() => removeFromCart(item.id)}>
          <Animated.View style={[dynamicStyles.animatedScale, { transform: [{ scale }] }]}>
            <Icon name="delete" size={24} color={theme.colors.white} />
            <Text style={styles.deleteButtonText}>Delete</Text>
          </Animated.View>
        </TouchableOpacity>
      );
    };

    return (
      <Swipeable renderRightActions={renderRightActions} overshootRight={false} friction={2}>
        <View style={styles.cartItem}>
          <View style={styles.cartItemInfo}>
            <View style={styles.cartItemHeader}>
              <Text style={styles.cartItemEmoji}>{item.emoji}</Text>
              <View style={styles.cartItemDetails}>
                <Text style={styles.cartItemName}>{item.name}</Text>
                <Text style={styles.cartItemPrice}>
                  {formatPrice(item.price, '£', {
                    screenName: 'POSScreen',
                    operation: 'cart_item_price_display',
                    inputValues: { itemId: item.id },
                  })}{' '}
                  each
                </Text>
              </View>
            </View>
            {menuItem?.description && (
              <Text style={styles.cartItemDescription} numberOfLines={2}>
                {menuItem.description}
              </Text>
            )}
          </View>
          <View style={styles.cartItemActions}>
            <View style={styles.cartItemQuantity}>
              <TouchableOpacity
                style={styles.quantityButton}
                onPress={() => handleUpdateQuantity(item.id, item.quantity - 1)}
              >
                <Icon name="remove" size={20} color={theme.colors.text} />
              </TouchableOpacity>
              <Text style={styles.quantityText}>{item.quantity}</Text>
              <TouchableOpacity
                style={styles.quantityButton}
                onPress={() => handleUpdateQuantity(item.id, item.quantity + 1)}
              >
                <Icon name="add" size={20} color={theme.colors.text} />
              </TouchableOpacity>
            </View>
            <Text style={styles.cartItemTotal}>
              {formatPrice(item.price * item.quantity, '£', {
                screenName: 'POSScreen',
                operation: 'cart_item_total_display',
                inputValues: { itemId: item.id, price: item.price, quantity: item.quantity },
              })}
            </Text>
          </View>
        </View>
      </Swipeable>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar backgroundColor={theme.colors.primary} barStyle="light-content" />

      {/* Header with Back Button */}
      <HeaderWithBackButton
        title={restaurantDisplayName}
        backgroundColor={theme.colors.primary}
        textColor={theme.colors.white}
        rightComponent={
          <View style={styles.headerActions}>
            {IS_DEV && (
              <TouchableOpacity
                testID="dev-mode-toggle-button"
                style={dynamicStyles.devButtonWithMargin}
                onPress={() => {
                  setShowSumUpTest(!showSumUpTest);
                  logger.info('🧪 SumUp Test toggled:', !showSumUpTest);
                }}
              >
                <Icon name="bug-report" size={20} color={theme.colors.white} />
              </TouchableOpacity>
            )}

            <CartIcon
              count={cartItemCount()}
              onPress={() => setShowCartModal(true)}
              testID="shopping-cart-button"
            />
          </View>
        }
      />

      {/* Full Width Menu */}
      <View style={styles.fullWidthPanel}>
        {/* Quick Stats Bar */}
        <View style={styles.statsBar}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{cartItemCount()}</Text>
            <Text style={styles.statLabel}>Items</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>
              {formatPrice(cartTotal(), '£', {
                screenName: 'POSScreen',
                operation: 'cart_total_stats_display',
              })}
            </Text>
            <Text style={styles.statLabel}>Subtotal</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>
              #
              {Math.floor(Math.random() * 1000)
                .toString()
                .padStart(3, '0')}
            </Text>
            <Text style={styles.statLabel}>Order</Text>
          </View>
          {/* Service Charge Sync Indicator */}
          <View style={[styles.statItem, styles.serviceChargeIndicator]}>
            <Text style={[styles.statValue, dynamicStyles.serviceChargeValue]}>
              {serviceChargeConfig.enabled ? `${serviceChargeConfig.rate}%` : 'OFF'}
            </Text>
            <Text style={styles.statLabel}>Service</Text>
            {serviceChargeDebugInfo && (
              <Text style={styles.syncIndicator}>{serviceChargeDebugInfo}</Text>
            )}
          </View>
        </View>

        {/* Category Tabs */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.categoryTabs}
          contentContainerStyle={styles.categoryTabsContent}
        >
          <CategorySearchBubble
            onSearchChange={setSearchQuery}
            style={styles.searchBubbleStyle} // Added style for potential adjustments
          />
          {dynamicCategories.map((category) => (
            <TouchableOpacity
              key={category}
              style={[
                styles.categoryTab,
                selectedCategory === category && styles.categoryTabActive,
              ]}
              onPress={() => setSelectedCategory(category)}
            >
              <Text
                style={[
                  styles.categoryTabText,
                  selectedCategory === category && styles.categoryTabTextActive,
                ]}
              >
                {category}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Menu Grid */}
        {menuLoading ? (
          <View style={styles.loadingContainer}>
            <Icon
              name="restaurant-menu"
              size={48}
              color={theme.colors.primary}
              style={dynamicStyles.categorySearchWrapper}
            />
            <Text style={styles.loadingText}>Loading menu...</Text>
            <Text style={[styles.loadingText, dynamicStyles.loadingTextSmall]}>
              Connecting to backend...
            </Text>
          </View>
        ) : dynamicMenuItems.length === 0 ? (
          <View style={styles.loadingContainer}>
            <Icon
              name="restaurant-menu"
              size={48}
              color={theme.colors.mediumGray}
              style={dynamicStyles.categorySearchWrapper}
            />
            <Text style={[styles.loadingText, dynamicStyles.loadingTextColored]}>
              No menu items available
            </Text>
            <Text style={[styles.loadingText, styles.loadingSubtext]}>
              Please contact support to set up your menu
            </Text>
            <TouchableOpacity
              style={[styles.retryButton, dynamicStyles.retryButtonPrimary]}
              onPress={async () => {
                setMenuLoading(true);
                // Reset states to ensure clean retry
                setDynamicMenuItems([]);
                setDynamicCategories(['All']);

                try {
                  const dataService = DataService.getInstance();
                  const [menuItems, categories] = await Promise.all([
                    dataService.getMenuItems(),
                    dataService.getMenuCategories(),
                  ]);

                  setDynamicMenuItems(menuItems || []);
                  const categoryNames = [
                    'All',
                    ...(categories || []).map((cat) => cat.name).filter((name) => name !== 'All'),
                  ];
                  setDynamicCategories(categoryNames);
                } catch (error) {
                  logger.error('Failed to reload menu:', error);
                  // Set empty arrays on error to ensure consistent state
                  setDynamicMenuItems([]);
                  setDynamicCategories(['All']);

                  // Show error to user
                  Alert.alert(
                    'Failed to Load Menu',
                    'Unable to connect to the server. Please check your internet connection and try again.',
                    [{ text: 'OK' }]
                  );
                } finally {
                  setMenuLoading(false);
                }
              }}
            >
              <Text style={dynamicStyles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : filteredItems.length === 0 ? (
          <View style={styles.loadingContainer}>
            <Icon
              name="search-off"
              size={48}
              color={theme.colors.mediumGray}
              style={dynamicStyles.categorySearchWrapper}
            />
            <Text style={[styles.loadingText, dynamicStyles.loadingTextColored]}>
              No items found
            </Text>
            <Text style={styles.loadingSubtext}>Try a different search or category</Text>
          </View>
        ) : (
          <FlatList
            data={filteredItems}
            renderItem={({ item }) => <MenuItemCard item={item} />}
            keyExtractor={(item) => item.id.toString()}
            numColumns={isTablet ? 4 : 3}
            columnWrapperStyle={styles.menuRow}
            contentContainerStyle={styles.menuGrid}
            showsVerticalScrollIndicator={false}
            testID="menu-flat-list" // Added testID
          />
        )}
      </View>

      {/* Cart Modal */}
      <Modal
        visible={showCartModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowCartModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.cartModal}>
            <View style={styles.cartModalHeader}>
              <View style={styles.cartTitleSection}>
                <Text style={styles.cartTitle}>Current Order</Text>
                <Text style={styles.cartSubtitle}>
                  Order #
                  {Math.floor(Math.random() * 1000)
                    .toString()
                    .padStart(3, '0')}{' '}
                  • {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </Text>
              </View>
              <View style={styles.cartModalButtons}>
                {cart.length > 0 && (
                  <TouchableOpacity style={styles.clearButton} onPress={clearCart}>
                    <Text style={styles.clearButtonText}>Clear All</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={styles.modalCloseButton}
                  onPress={() => setShowCartModal(false)}
                >
                  <Icon name="close" size={30} color={theme.colors.error || '#FF0000'} />
                </TouchableOpacity>
              </View>
            </View>

            {cart.length === 0 ? (
              <View style={styles.emptyCart}>
                <Icon name="shopping-cart" size={64} color={theme.colors.lightGray} />
                <Text style={styles.emptyCartText}>Cart is empty</Text>
                <Text style={styles.emptyCartSubtext}>Add items to get started</Text>
              </View>
            ) : (
              <>
                <FlatList
                  style={styles.cartList}
                  data={cart}
                  renderItem={({ item }) => <CartItem item={item} />}
                  keyExtractor={(item) => item.id.toString()}
                  contentContainerStyle={styles.menuListContent} // Added padding for fixed footer
                />

                {/* Fixed Footer */}
                <View style={styles.cartFooterFixed}>
                  <View style={styles.cartSummary}>
                    <View style={styles.summarySection}>
                      <Text style={styles.summarySectionTitle}>Order Summary</Text>
                      <View style={styles.summaryRow}>
                        <Text style={styles.summaryLabel}>Items ({cartItemCount()})</Text>
                        <Text style={styles.summaryValue}>
                          {formatPrice(cartTotal(), '£', {
                            screenName: 'POSScreen',
                            operation: 'cart_modal_subtotal_display',
                          })}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.summarySection}>
                      <Text style={styles.summarySectionTitle}>Taxes & Fees</Text>
                      {taxConfiguration.vatEnabled && (
                        <View style={styles.summaryRow}>
                          <Text style={styles.summaryLabel}>VAT ({taxConfiguration.vatRate}%)</Text>
                          <Text style={styles.summaryValue}>
                            {formatPrice(calculateVAT(cartTotal()), '£', {
                              screenName: 'POSScreen',
                              operation: 'cart_modal_vat_display',
                            })}
                          </Text>
                        </View>
                      )}
                      {serviceChargeConfig.enabled && (
                        <View style={styles.summaryRow}>
                          <Text style={styles.summaryLabel}>
                            Service Fee ({serviceChargeConfig.rate}%)
                          </Text>
                          <Text style={styles.summaryValue}>
                            {formatPrice(calculateServiceFee(cartTotal()), '£', {
                              screenName: 'POSScreen',
                              operation: 'cart_modal_service_fee_display',
                            })}
                          </Text>
                        </View>
                      )}
                    </View>

                    <View style={[styles.summaryRow, styles.totalRow]}>
                      <Text style={styles.totalLabel}>Total</Text>
                      <Text style={styles.totalAmount}>
                        {formatPrice(calculateCartTotal(), '£', {
                          screenName: 'POSScreen',
                          operation: 'cart_modal_total_display',
                        })}
                      </Text>
                    </View>
                  </View>

                  <TouchableOpacity
                    style={styles.chargeButton}
                    onPress={() => {
                      setShowCartModal(false);
                      // @ts-expect-error
                      navigation.navigate('ServiceChargeSelection');
                    }}
                    testID="charge-button" // Added testID
                  >
                    <Text style={styles.chargeButtonText}>
                      Charge{' '}
                      {formatPrice(calculateCartTotal(), '£', {
                        screenName: 'POSScreen',
                        operation: 'payment_button_amount_display',
                      })}
                    </Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* Payment Modal */}
      <Modal
        visible={showPaymentModal}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setShowPaymentModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.paymentModal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Payment</Text>
              <TouchableOpacity
                onPress={() => setShowPaymentModal(false)}
                style={styles.modalCloseButton}
              >
                <Icon name="close" size={24} color={theme.colors.text} />
              </TouchableOpacity>
            </View>

            <View style={styles.modalContent}>
              <SimpleTextInput
                value={customerName}
                onValueChange={setCustomerName}
                placeholder="Customer name (optional)"
                style={styles.input}
                clearButtonMode="while-editing"
                autoCapitalize="words"
              />

              <SimpleTextInput
                value={customerEmail}
                onValueChange={setCustomerEmail}
                placeholder="Customer e-mail (optional)"
                keyboardType="email-address"
                autoCapitalize="none"
                style={styles.input}
                clearButtonMode="while-editing"
              />

              {/* Order Summary */}
              <View style={styles.orderSummary}>
                <Text style={styles.orderSummaryTitle}>Order Summary</Text>
                {cart.map((item) => {
                  const menuItem = dynamicMenuItems.find((mi) => mi.id === item.id);
                  return (
                    <View key={item.id} style={styles.orderSummaryItem}>
                      <View style={styles.orderSummaryItemHeader}>
                        <Text style={styles.orderSummaryEmoji}>{item.emoji}</Text>
                        <Text style={styles.orderSummaryItemName}>{item.name}</Text>
                        <Text style={styles.orderSummaryQuantity}>x{item.quantity}</Text>
                        <Text style={styles.orderSummaryPrice}>
                          {formatPrice(item.price * item.quantity, '£', {
                            screenName: 'POSScreen',
                            operation: 'order_summary_item_total_display',
                            inputValues: { itemId: item.id },
                          })}
                        </Text>
                      </View>
                      {menuItem?.description && (
                        <Text style={styles.orderSummaryDescription} numberOfLines={1}>
                          {menuItem.description}
                        </Text>
                      )}
                    </View>
                  );
                })}
              </View>

              <View style={styles.paymentMethodsSection}>
                <Text style={styles.paymentMethodsTitle}>Payment Method</Text>
                <View style={styles.paymentMethods}>
                  <TouchableOpacity
                    style={[
                      styles.paymentMethod,
                      selectedPaymentMethod === 'sumup' && styles.paymentMethodSelected,
                      styles.recommendedPaymentMethod,
                    ]}
                    onPress={() => setSelectedPaymentMethod('sumup')}
                  >
                    <View style={styles.recommendedBadge}>
                      <Text style={styles.recommendedText}>RECOMMENDED</Text>
                    </View>
                    <Icon name="credit-card" size={24} color="#00D4AA" />
                    <Text style={styles.paymentMethodText}>SumUp</Text>
                    <Text style={styles.paymentMethodSubtext}>0.69% • Cards & Mobile Pay</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.paymentMethod,
                      selectedPaymentMethod === 'square' && styles.paymentMethodSelected,
                    ]}
                    onPress={() => setSelectedPaymentMethod('square')}
                  >
                    <Icon name="credit-card" size={24} color="#3E4348" />
                    <Text style={styles.paymentMethodText}>Square</Text>
                    <Text style={styles.paymentMethodSubtext}>1.75% • Cards & Digital Wallets</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.paymentMethod,
                      selectedPaymentMethod === 'qr' && styles.paymentMethodSelected,
                    ]}
                    onPress={() => setSelectedPaymentMethod('qr')}
                  >
                    <Icon name="qr-code-scanner" size={24} color={theme.colors.primary} />
                    <Text style={styles.paymentMethodText}>QR Payment</Text>
                    <Text style={styles.paymentMethodSubtext}>1.2% • Customer mobile app</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.paymentMethod,
                      selectedPaymentMethod === 'cash' && styles.paymentMethodSelected,
                    ]}
                    onPress={() => setSelectedPaymentMethod('cash')}
                  >
                    <Icon name="attach-money" size={24} color={theme.colors.success} />
                    <Text style={styles.paymentMethodText}>Cash</Text>
                    <Text style={styles.paymentMethodSubtext}>No processing fee</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.paymentMethod,
                      selectedPaymentMethod === 'stripe' && styles.paymentMethodSelected,
                    ]}
                    onPress={() => setSelectedPaymentMethod('stripe')}
                  >
                    <Icon name="credit-card" size={24} color="#635BFF" />
                    <Text style={styles.paymentMethodText}>Stripe</Text>
                    <Text style={styles.paymentMethodSubtext}>1.4% + 20p • Backup option</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.modalTotal}>
                <Text style={styles.modalTotalLabel}>Total to Pay</Text>
                <Text style={styles.modalTotalAmount}>
                  {formatPrice(calculateCartTotal(), '£', {
                    screenName: 'POSScreen',
                    operation: 'payment_modal_total_display',
                  })}
                </Text>
              </View>

              <TouchableOpacity style={styles.confirmButton} onPress={processPayment}>
                <Text style={styles.confirmButtonText}>Confirm Payment</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* SumUp Payment Component */}
      {showSumUpPayment && (
        <>
          {logger.info(
            '🔄 Rendering SumUpPaymentComponent with showSumUpPayment:',
            showSumUpPayment
          )}
          <SumUpPaymentComponent
            amount={calculateCartTotal()}
            currency="GBP"
            title={`Order for ${customerName || 'Customer'}`}
            onPaymentComplete={handleSumUpPaymentComplete}
            onPaymentCancel={handleSumUpPaymentCancel}
          />
        </>
      )}
    </SafeAreaView>
  );
};

// Dynamic styles creator for conditional styling
const createDynamicStyles = (theme: unknown, serviceChargeConfig: { enabled: boolean }) =>
  StyleSheet.create({
    serviceChargeValue: {
      color: serviceChargeConfig.enabled ? '#00D4AA' : '#999',
      fontSize: 14,
      fontWeight: '600',
    },
    devButtonWithMargin: {
      padding: 8,
      borderRadius: 8,
      backgroundColor: 'rgba(255, 255, 255, 0.1)',
      marginRight: 8,
    },
    animatedScale: {
      justifyContent: 'center',
      alignItems: 'center',
    },
    categorySearchWrapper: {
      marginBottom: 16,
    },
    loadingTextSmall: {
      fontSize: 14,
      opacity: 0.7,
      marginTop: 8,
    },
    loadingTextColored: {
      color: theme.colors.text,
    },
    retryButtonPrimary: {
      backgroundColor: theme.colors.primary,
    },
    retryButtonText: {
      color: theme.colors.white,
      fontWeight: '600',
    },
  });

const createStyles = (theme: unknown) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    fullWidthPanel: {
      flex: 1,
      backgroundColor: theme.colors.white,
    },
    statsBar: {
      flexDirection: 'row',
      backgroundColor: theme.colors.white,
      paddingVertical: 12,
      paddingHorizontal: 20,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
      justifyContent: 'space-around',
    },
    statItem: {
      alignItems: 'center',
    },
    statValue: {
      fontSize: 20,
      fontWeight: 'bold',
      color: theme.colors.primary,
    },
    statLabel: {
      fontSize: 12,
      color: theme.colors.darkGray,
      marginTop: 2,
    },
    serviceChargeIndicator: {
      borderLeftWidth: 1,
      borderLeftColor: theme.colors.border,
      paddingLeft: 16,
      marginLeft: 16,
    },
    syncIndicator: {
      fontSize: 8,
      color: '#666',
      textAlign: 'center',
      marginTop: 2,
      fontWeight: '500',
    },
    categoryTabs: {
      backgroundColor: theme.colors.white,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    categoryTabsContent: {
      paddingHorizontal: 16,
      paddingVertical: 16,
      alignItems: 'center',
    },
    categoryTab: {
      paddingHorizontal: 16,
      paddingVertical: 12,
      marginRight: 8,
      borderRadius: 24,
      backgroundColor: theme.colors.surface,
      minHeight: 44,
      justifyContent: 'center',
      alignItems: 'center',
    },
    categoryTabActive: {
      backgroundColor: theme.colors.accent,
    },
    categoryTabText: {
      fontSize: 16,
      fontWeight: '500',
      color: theme.colors.text,
      textAlign: 'center',
    },
    categoryTabTextActive: {
      color: theme.colors.white,
    },
    menuGrid: {
      paddingHorizontal: 16,
      paddingVertical: 16,
      paddingBottom: 120,
    },
    menuRow: {
      justifyContent: 'space-between',
      paddingHorizontal: 0,
    },
    menuCard: {
      backgroundColor: theme.colors.cardBg,
      borderRadius: 16,
      padding: 16,
      marginHorizontal: 4,
      marginVertical: 8,
      flex: 1,
      minHeight: 140,
      maxWidth: (screenWidth - 56) / 3, // 16*2 (outer padding) + 8*2 (inner margins) + 8*2 (card margins)
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08,
      shadowRadius: 4,
      elevation: 3,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    menuCardDisabled: {
      opacity: 0.6,
    },
    menuCardContent: {
      alignItems: 'center',
      justifyContent: 'space-between',
      flex: 1,
    },
    menuItemIcon: {
      fontSize: 32,
      marginBottom: 8,
    },
    menuItemName: {
      fontSize: 13,
      fontWeight: '600',
      color: theme.colors.text,
      textAlign: 'center',
      marginBottom: 6,
      lineHeight: 16,
      minHeight: 32,
      flexWrap: 'wrap',
    },
    menuItemPrice: {
      fontSize: 15,
      fontWeight: '700',
      color: theme.colors.primary,
      textAlign: 'center',
      backgroundColor: 'rgba(0, 166, 81, 0.1)',
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 8,
      overflow: 'hidden',
    },
    quantityPillContainer: {
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 8,
    },
    menuItemQuantityControls: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 8,
    },
    menuQuantityButton: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: theme.colors.primary,
      justifyContent: 'center',
      alignItems: 'center',
      marginHorizontal: 4,
    },
    menuQuantityText: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.colors.text,
      marginHorizontal: 8,
      minWidth: 20,
      textAlign: 'center',
    },
    cartTitleSection: {
      flex: 1,
    },
    cartTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: theme.colors.text,
    },
    cartSubtitle: {
      fontSize: 12,
      color: theme.colors.darkGray,
      marginTop: 2,
    },
    clearButton: {
      padding: 8,
    },
    clearButtonText: {
      color: theme.colors.warning,
      fontSize: 14,
      fontWeight: '500',
    },
    emptyCart: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 40,
    },
    emptyCartText: {
      fontSize: 18,
      fontWeight: '500',
      color: theme.colors.text,
      marginTop: 16,
    },
    emptyCartSubtext: {
      fontSize: 14,
      color: theme.colors.darkGray,
      marginTop: 8,
      textAlign: 'center',
    },
    cartList: {
      flex: 1,
    },
    cartItem: {
      padding: 16,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    cartItemInfo: {
      flex: 1,
      marginBottom: 12,
    },
    cartItemHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 8,
    },
    cartItemEmoji: {
      fontSize: 24,
      marginRight: 12,
    },
    cartItemDetails: {
      flex: 1,
    },
    cartItemName: {
      fontSize: 16,
      fontWeight: '500',
      color: theme.colors.text,
      marginBottom: 2,
    },
    cartItemPrice: {
      fontSize: 12,
      color: theme.colors.darkGray,
    },
    cartItemDescription: {
      fontSize: 12,
      color: theme.colors.lightText,
      lineHeight: 16,
      marginLeft: 36,
    },
    cartItemActions: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    cartItemQuantity: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    quantityButton: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: theme.colors.background,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    quantityText: {
      fontSize: 14,
      fontWeight: '500',
      color: theme.colors.text,
      marginHorizontal: 12,
    },
    cartItemTotal: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.colors.text,
    },
    deleteButton: {
      backgroundColor: theme.colors.danger,
      justifyContent: 'center',
      alignItems: 'center',
      width: 80,
      height: '100%',
    },
    deleteButtonText: {
      color: theme.colors.white,
      fontSize: 12,
      fontWeight: '600',
      marginTop: 4,
    },
    cartFooterFixed: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      borderTopWidth: 1,
      borderTopColor: theme.colors.border,
      backgroundColor: theme.colors.white,
      padding: 20,
      paddingBottom: Platform.OS === 'ios' ? 30 : 20, // Adjust padding for safe area on iOS
      shadowColor: '#000',
      shadowOffset: { width: 0, height: -2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 8,
    },
    cartSummary: {
      marginBottom: 20,
    },
    summarySection: {
      marginBottom: 16,
    },
    summarySectionTitle: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.colors.text,
      marginBottom: 8,
    },
    summaryRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 8,
    },
    summaryLabel: {
      fontSize: 14,
      color: theme.colors.darkGray,
    },
    summaryValue: {
      fontSize: 14,
      color: theme.colors.text,
    },
    totalRow: {
      marginTop: 8,
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: theme.colors.border,
    },
    totalLabel: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.colors.text,
    },
    totalAmount: {
      fontSize: 20,
      fontWeight: '700',
      color: theme.colors.text,
    },
    chargeButton: {
      backgroundColor: theme.colors.primary,
      borderRadius: 12,
      paddingVertical: 18,
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.2,
      shadowRadius: 8,
      elevation: 6,
    },
    chargeButtonText: {
      color: theme.colors.white,
      fontSize: 17,
      fontWeight: 'bold',
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    cartModal: {
      backgroundColor: theme.colors.white,
      borderRadius: 16,
      width: '90%',
      maxWidth: 500,
      maxHeight: '80%',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.1,
      shadowRadius: 20,
      elevation: 10,
    },
    cartModalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: 20,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    cartModalButtons: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    paymentModal: {
      backgroundColor: theme.colors.white,
      borderRadius: 16,
      width: '90%',
      maxWidth: 400,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.1,
      shadowRadius: 20,
      elevation: 10,
    },
    modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: 20,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    modalTitle: {
      fontSize: 20,
      fontWeight: '600',
      color: theme.colors.text,
    },
    modalCloseButton: {
      padding: 10,
      position: 'absolute',
      top: 10,
      right: 10,
      backgroundColor: theme.colors.surface,
      borderRadius: 20,
      zIndex: 1,
    },
    modalContent: {
      padding: 20,
    },
    input: {
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: 8,
      paddingHorizontal: 16,
      paddingVertical: 12,
      fontSize: 16,
      color: theme.colors.text,
      marginBottom: 20,
    },
    orderSummary: {
      marginBottom: 20,
      backgroundColor: theme.colors.background,
      borderRadius: 8,
      padding: 16,
    },
    orderSummaryTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.colors.text,
      marginBottom: 12,
    },
    orderSummaryItem: {
      marginBottom: 12,
    },
    orderSummaryItemHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 4,
    },
    orderSummaryEmoji: {
      fontSize: 16,
      marginRight: 8,
    },
    orderSummaryItemName: {
      fontSize: 14,
      fontWeight: '500',
      color: theme.colors.text,
      flex: 1,
    },
    orderSummaryQuantity: {
      fontSize: 14,
      color: theme.colors.darkGray,
      marginRight: 12,
    },
    orderSummaryPrice: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.colors.text,
    },
    orderSummaryDescription: {
      fontSize: 12,
      color: theme.colors.lightText,
      marginLeft: 24,
      fontStyle: 'italic',
    },
    paymentMethodsSection: {
      marginBottom: 30,
    },
    paymentMethodsTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.colors.text,
      marginBottom: 16,
    },
    paymentMethods: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
    },
    paymentMethod: {
      alignItems: 'center',
      padding: 16,
      borderRadius: 12,
      borderWidth: 2,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.white,
      width: '48%',
      marginBottom: 12,
      position: 'relative',
    },
    paymentMethodSelected: {
      borderColor: theme.colors.accent,
      backgroundColor: 'rgba(76, 110, 245, 0.05)',
    },
    recommendedPaymentMethod: {
      borderColor: '#00D4AA',
      backgroundColor: 'rgba(0, 212, 170, 0.1)',
    },
    loadingSubtext: {
      fontSize: 14,
      opacity: 0.7,
      marginTop: 8,
      color: theme.colors.lightGray,
      textAlign: 'center',
    },
    loadingTextDark: {
      fontSize: 16,
      color: theme.colors.text,
      textAlign: 'center',
    },
    menuListContent: {
      paddingBottom: 120,
    },
    retryButtonPrimary: {
      marginTop: 20,
      paddingHorizontal: 24,
      paddingVertical: 12,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.primary,
    },
    recommendedBadge: {
      position: 'absolute',
      top: -8,
      left: -8,
      backgroundColor: '#00D4AA',
      borderRadius: 8,
      paddingHorizontal: 6,
      paddingVertical: 2,
      zIndex: 1,
    },
    recommendedText: {
      fontSize: 9,
      fontWeight: '700',
      color: theme.colors.white,
      letterSpacing: 0.5,
    },
    paymentMethodText: {
      fontSize: 14,
      fontWeight: '500',
      color: theme.colors.text,
      marginTop: 8,
    },
    paymentMethodSubtext: {
      fontSize: 11,
      color: theme.colors.darkGray,
      marginTop: 2,
      textAlign: 'center',
    },
    modalTotal: {
      alignItems: 'center',
      marginBottom: 20,
    },
    modalTotalLabel: {
      fontSize: 14,
      color: theme.colors.darkGray,
      marginBottom: 4,
    },
    modalTotalAmount: {
      fontSize: 28,
      fontWeight: '700',
      color: theme.colors.text,
    },
    confirmButton: {
      backgroundColor: theme.colors.success,
      borderRadius: 8,
      paddingVertical: 16,
      alignItems: 'center',
    },
    confirmButtonText: {
      color: theme.colors.white,
      fontSize: 16,
      fontWeight: '600',
    },
    searchBubbleStyle: {
      marginRight: 8,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 20,
    },
    loadingText: {
      fontSize: 16,
      color: theme.colors.lightGray,
      textAlign: 'center',
    },
    retryButton: {
      marginTop: 20,
      paddingHorizontal: 24,
      paddingVertical: 12,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
    },
    animatedDeleteView: {
      // Base style for animated delete view
    },
    menuIcon: {
      marginBottom: 16,
    },
    retryButtonText: {
      color: theme.colors.white,
      fontWeight: '600',
    },
  });

export default POSScreen;
