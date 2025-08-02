import React, { useState, useEffect } from 'react';

import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  _TextInput,
  Modal,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';

import { useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialIcons';

import DecimalInput from '../../components/inputs/DecimalInput';
import SimpleDecimalInput from '../../components/inputs/SimpleDecimalInput';
import SimpleTextInput from '../../components/inputs/SimpleTextInput';
import { useAuth } from '../../contexts/AuthContext';
import OrderService from '../../services/OrderService';
import SharedDataStore from '../../services/SharedDataStore';
import useAppStore from '../../store/useAppStore';
import useSettingsStore from '../../store/useSettingsStore';

// Clover POS Color Scheme
const Colors = {
  primary: '#00A651',
  secondary: '#0066CC',
  success: '#00A651',
  warning: '#FF6B35',
  danger: '#E74C3C',
  background: '#F5F5F5',
  white: '#FFFFFF',
  lightGray: '#E5E5E5',
  mediumGray: '#999999',
  darkGray: '#666666',
  text: '#333333',
  lightText: '#666666',
  border: '#DDDDDD',
};

interface PaymentMethod {
  id: string;
  name: string;
  icon: string;
  color: string;
  enabled: boolean;
  requiresAuth: boolean;
}

// Tip percentage presets
const tipPresets = [10, 15, 18, 20, 25];

const EnhancedPaymentScreen: React.FC = () => {
  const navigation = useNavigation();
  const { user } = useAuth();
  const {
    cart,
    clearCart,
    _cartTotal,
    serviceChargePercentage,
    addTransactionFee,
    calculateServiceCharge,
    calculateTransactionFee,
    _calculateOrderTotal,
  } = useAppStore();
  const { paymentMethods, taxConfiguration } = useSettingsStore();

  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string>('');
  const [tipAmount, setTipAmount] = useState(0);
  const [tipPercentage, setTipPercentage] = useState(0);
  const [customTipInput, setCustomTipInput] = useState(0);
  const [showCustomTip, setShowCustomTip] = useState(false);
  const [splitPayment, setSplitPayment] = useState(false);
  const [splitAmounts, setSplitAmounts] = useState<{ method: string; amount: number }[]>([]);
  const [cashReceived, setCashReceived] = useState('');
  const [showCashModal, setShowCashModal] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [processing, setProcessing] = useState(false);

  // Email validation regex
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  // Validation state
  const isNameValid = customerName.trim().length > 0 && customerName.length <= 60;
  const isEmailValid = emailRegex.test(customerEmail);
  const isFormValid = isNameValid && isEmailValid;

  // Platform service charge configuration (real-time from platform owner)
  const [platformServiceCharge, setPlatformServiceCharge] = useState({
    enabled: false,
    rate: 0,
    description: 'Loading platform service charge...',
  });

  // Calculate totals
  const calculateSubtotal = () => {
    return cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  };

  const calculateTax = (subtotal: number) => {
    if (!taxConfiguration.vatEnabled) return 0;
    return subtotal * (taxConfiguration.vatRate / 100);
  };

  const _calculatePlatformServiceCharge = (subtotal: number) => {
    // Use PLATFORM service charge settings, not restaurant settings (legacy)
    if (!platformServiceCharge.enabled) return 0;
    return subtotal * (platformServiceCharge.rate / 100);
  };

  // Load platform service charge configuration on component mount
  useEffect(() => {
    const loadPlatformServiceCharge = async () => {
      try {
        logger.info('💰 EnhancedPaymentScreen - Loading platform service charge...');
        const dataStore = SharedDataStore.getInstance();
        const config = await dataStore.getServiceChargeConfig();

        if (config) {
          setPlatformServiceCharge({
            enabled: config.enabled,
            rate: config.rate,
            description: config.description || 'Platform service charge',
          });
          logger.info('✅ Platform service charge loaded:', config);
        } else {
          logger.info('⚠️ No platform service charge config found');
        }
      } catch (error) {
        logger.error('❌ Failed to load platform service charge:', error);
      }
    };

    loadPlatformServiceCharge();

    // Subscribe to real-time updates
    const dataStore = SharedDataStore.getInstance();
    const unsubscribe = dataStore.subscribe('serviceCharge', (updatedConfig) => {
      logger.info('🔄 Platform service charge updated in real-time:', updatedConfig);
      setPlatformServiceCharge({
        enabled: updatedConfig.enabled,
        rate: updatedConfig.rate,
        description: updatedConfig.description || 'Platform service charge',
      });
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const calculateGrandTotal = () => {
    const subtotal = calculateSubtotal();
    const tax = calculateTax(subtotal);
    const serviceCharge = calculateServiceCharge(); // Uses app store calculation
    const transactionFee = calculateTransactionFee(); // Uses app store calculation
    return subtotal + tax + serviceCharge + transactionFee + tipAmount;
  };

  // QR Code Payment State
  const [showQRModal, setShowQRModal] = useState(false);
  const [qrPaymentStatus, setQRPaymentStatus] = useState<
    'generating' | 'waiting' | 'completed' | 'expired'
  >('generating');
  const [qrCode, setQRCode] = useState('');

  // Generate QR Code for payment with error handling
  const generateQRCode = () => {
    try {
      setQRPaymentStatus('generating');

      const paymentData = {
        amount: calculateGrandTotal(),
        currency: 'GBP',
        merchantId: 'fynlo-pos-001',
        orderId: `ORDER-${Date.now()}`,
        timestamp: Date.now(),
      };

      // Create a simple, safe QR string without complex JSON encoding
      const qrString = `FYNLO-PAY:${paymentData.orderId}:${paymentData.amount}:${paymentData.currency}:${paymentData.timestamp}`;
      setQRCode(qrString);
      setQRPaymentStatus('waiting');

      // Simulate QR code expiration after 5 minutes with safer state checking
      setTimeout(() => {
        setQRPaymentStatus((current) => {
          logger.info('⏰ QR Code expiration check - current status:', current);
          return current === 'waiting' ? 'expired' : current;
        });
      }, 300000); // 5 minutes

      logger.info('✅ QR Code generated successfully:', qrString.substring(0, 50) + '...');
    } catch (error) {
      logger.error('❌ Failed to generate QR code:', error);
      setQRPaymentStatus('expired');
      Alert.alert('Error', 'Failed to generate QR code. Please try again.');
    }
  };

  // Payment methods configuration
  const availablePaymentMethods: PaymentMethod[] = [
    {
      id: 'qrCode',
      name: 'QR Payment',
      icon: 'qr-code-scanner',
      color: Colors.primary,
      enabled: paymentMethods?.qrCode?.enabled ?? true,
      requiresAuth: paymentMethods?.qrCode?.requiresAuth ?? false,
    },
    {
      id: 'cash',
      name: 'Cash',
      icon: 'payments',
      color: Colors.success,
      enabled: paymentMethods?.cash?.enabled ?? true,
      requiresAuth: paymentMethods?.cash?.requiresAuth ?? false,
    },
    {
      id: 'card',
      name: 'Card',
      icon: 'credit-card',
      color: Colors.secondary,
      enabled: paymentMethods?.card?.enabled ?? true,
      requiresAuth: paymentMethods?.card?.requiresAuth ?? false,
    },
    {
      id: 'applePay',
      name: 'Apple Pay',
      icon: 'contactless-payment',
      color: Colors.text,
      enabled: paymentMethods?.applePay?.enabled ?? true,
      requiresAuth: paymentMethods?.applePay?.requiresAuth ?? false,
    },
    {
      id: 'googlePay',
      name: 'Google Pay',
      icon: 'contactless-payment',
      color: Colors.warning,
      enabled: paymentMethods?.googlePay?.enabled ?? false,
      requiresAuth: paymentMethods?.googlePay?.requiresAuth ?? false,
    },
  ];

  const enabledPaymentMethods = availablePaymentMethods.filter((m) => m.enabled);

  useEffect(() => {
    // Auto-select payment method if only one is enabled
    if (enabledPaymentMethods.length === 1) {
      setSelectedPaymentMethod(enabledPaymentMethods[0].id);
    } else if (enabledPaymentMethods.length > 1 && !selectedPaymentMethod) {
      // Default to QR code if available, otherwise first available method
      const qrMethod = enabledPaymentMethods.find((m) => m.id === 'qrCode');
      setSelectedPaymentMethod(qrMethod ? qrMethod.id : enabledPaymentMethods[0].id);
    }
  }, [enabledPaymentMethods, selectedPaymentMethod]);

  const handleTipPreset = (percentage: number) => {
    const subtotal = calculateSubtotal();
    const tip = subtotal * (percentage / 100);
    setTipAmount(tip);
    setTipPercentage(percentage);
    setShowCustomTip(false);
    setCustomTipInput('');
  };

  const _handleCustomTip = () => {
    const amount = parseFloat(customTipInput) || 0;
    setTipAmount(amount);
    const subtotal = calculateSubtotal();
    setTipPercentage(subtotal > 0 ? Math.round((amount / subtotal) * 100) : 0);
  };

  const handleNoTip = () => {
    setTipAmount(0);
    setTipPercentage(0);
    setShowCustomTip(false);
    setCustomTipInput('');
  };

  const handlePaymentMethodSelect = (methodId: string) => {
    const method = availablePaymentMethods.find((m) => m.id === methodId);
    if (method?.requiresAuth) {
      Alert.alert(
        'Authorization Required',
        'Manager authorization is required for this payment method.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Authorize',
            onPress: () => {
              // In a real app, this would prompt for manager PIN
              setSelectedPaymentMethod(methodId);
              if (methodId === 'cash') {
                setShowCashModal(true);
              } else if (methodId === 'qrCode') {
                setShowQRModal(true);
                generateQRCode();
              } else if (methodId === 'card') {
                Alert.alert(
                  'Card Payment',
                  'Insert or swipe card, or tap for contactless payment.'
                );
              } else if (methodId === 'applePay') {
                Alert.alert('Apple Pay', 'Hold near reader and confirm with Touch ID or Face ID.');
              } else if (methodId === 'googlePay') {
                Alert.alert('Google Pay', 'Hold near reader and confirm payment.');
              }
            },
          },
        ]
      );
    } else {
      setSelectedPaymentMethod(methodId);
      if (methodId === 'cash') {
        setShowCashModal(true);
      } else if (methodId === 'qrCode') {
        setShowQRModal(true);
        generateQRCode();
      } else if (methodId === 'card') {
        // Card payment handling - could show card reader interface
        Alert.alert('Card Payment', 'Insert or swipe card, or tap for contactless payment.');
      } else if (methodId === 'applePay') {
        // Apple Pay handling
        Alert.alert('Apple Pay', 'Hold near reader and confirm with Touch ID or Face ID.');
      } else if (methodId === 'googlePay') {
        // Google Pay handling
        Alert.alert('Google Pay', 'Hold near reader and confirm payment.');
      }
    }
  };

  const handleSplitPayment = () => {
    if (user?.subscription_plan === 'alpha') {
      Alert.alert(
        'Upgrade Required',
        'Split payment is available with Beta and Omega plans. Upgrade your subscription to unlock this feature.',
        [{ text: 'OK' }]
      );
      return;
    }
    setSplitPayment(true);
    setSplitAmounts([
      { method: 'card', amount: calculateGrandTotal() / 2 },
      { method: 'cash', amount: calculateGrandTotal() / 2 },
    ]);
  };

  const handleProcessPayment = async () => {
    if (!selectedPaymentMethod && !splitPayment) {
      Alert.alert('Select Payment Method', 'Please select a payment method to continue.');
      return;
    }

    if (!isFormValid) {
      Alert.alert('Required Information', 'Please enter valid customer name and email address.');
      return;
    }

    setProcessing(true);

    try {
      const orderService = OrderService.getInstance();
      const subtotal = calculateSubtotal();
      const tax = calculateTax(subtotal);
      const serviceCharge = calculateServiceCharge();
      const transactionFee = calculateTransactionFee();
      const total = calculateGrandTotal();

      const orderData = {
        items: cart,
        subtotal,
        tax,
        total,
        serviceCharge,
        transactionFee,
        tipAmount,
        customerMetadata: {
          name: customerName.trim(),
          email: customerEmail.trim().toLowerCase(),
        },
        paymentMethod: selectedPaymentMethod,
        notes: undefined,
      };

      logger.info('💳 Processing payment and saving order...', {
        total,
        customer: customerEmail,
        method: selectedPaymentMethod,
      });

      const _savedOrder = await orderService.saveOrder(orderData);

      setProcessing(false);

      Alert.alert(
        'Payment Successful',
        `Payment of £${total.toFixed(
          2
        )} processed successfully!\n\nReceipt will be sent to ${customerEmail}`,
        [
          {
            text: 'OK',
            onPress: () => {
              clearCart();
              navigation.goBack();
            },
          },
        ]
      );
    } catch (error) {
      setProcessing(false);
      logger.error('❌ Payment processing failed:', error);

      Alert.alert(
        'Payment Failed',
        'Unable to process payment. Please try again or contact support.',
        [{ text: 'OK' }]
      );
    }
  };

  const calculateChange = () => {
    const received = cashReceived === '' ? 0 : parseFloat(cashReceived) || 0;
    const total = calculateGrandTotal();
    const change = received - total;
    return Math.max(0, isNaN(change) ? 0 : change);
  };

  const CashPaymentModal = () => (
    <Modal
      visible={showCashModal}
      transparent
      animationType="slide"
      onRequestClose={() => setShowCashModal(false)}
    >
      <KeyboardAvoidingView
        style={styles.modalOverlay}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.cashModalContent}>
          <View style={styles.cashModalHeader}>
            <Text style={styles.cashModalTitle}>Cash Payment</Text>
            <TouchableOpacity onPress={() => setShowCashModal(false)}>
              <Icon name="close" size={24} color={Colors.darkGray} />
            </TouchableOpacity>
          </View>

          <View style={styles.cashModalBody}>
            <View style={styles.amountDue}>
              <Text style={styles.amountDueLabel}>Amount Due</Text>
              <Text style={styles.amountDueValue}>£{calculateGrandTotal().toFixed(2)}</Text>
            </View>

            <View style={styles.cashInputSection}>
              <SimpleDecimalInput
                label="Cash Received"
                value={parseFloat(cashReceived) || 0}
                onValueChange={(value) => setCashReceived(value.toString())}
                placeholder="0.00"
                suffix="£"
                maxValue={9999.99}
                style={styles.cashInput}
              />
            </View>

            <View style={styles.quickCashButtons}>
              {[20, 50, 100, 200].map((amount) => (
                <TouchableOpacity
                  key={amount}
                  style={styles.quickCashButton}
                  onPress={() => setCashReceived(amount.toString())}
                >
                  <Text style={styles.quickCashButtonText}>£{amount}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.changeSection}>
              <Text style={styles.changeLabel}>Change Due</Text>
              <Text
                style={[styles.changeValue, calculateChange() > 0 && styles.changeValuePositive]}
              >
                £{calculateChange().toFixed(2)}
              </Text>
            </View>
          </View>

          <TouchableOpacity
            style={[
              styles.cashConfirmButton,
              (!cashReceived || parseFloat(cashReceived) < calculateGrandTotal()) &&
                styles.disabledButton,
            ]}
            onPress={() => {
              if (parseFloat(cashReceived) >= calculateGrandTotal()) {
                setShowCashModal(false);
                handleProcessPayment();
              }
            }}
            disabled={!cashReceived || parseFloat(cashReceived) < calculateGrandTotal()}
          >
            <Text style={styles.cashConfirmButtonText}>Confirm Payment</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );

  const QRPaymentModal = () => (
    <Modal
      visible={showQRModal}
      transparent
      animationType="slide"
      onRequestClose={() => setShowQRModal(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.qrModalContent}>
          <View style={styles.qrModalHeader}>
            <Text style={styles.qrModalTitle}>QR Code Payment</Text>
            <TouchableOpacity onPress={() => setShowQRModal(false)}>
              <Icon name="close" size={24} color={Colors.darkGray} />
            </TouchableOpacity>
          </View>

          <View style={styles.qrModalBody}>
            <View style={styles.amountDue}>
              <Text style={styles.amountDueLabel}>Amount Due</Text>
              <Text style={styles.amountDueValue}>£{calculateGrandTotal().toFixed(2)}</Text>
            </View>

            {qrPaymentStatus === 'generating' && (
              <View style={styles.qrSection}>
                <View style={styles.qrLoadingContainer}>
                  <Icon name="hourglass-empty" size={48} color={Colors.lightText} />
                  <Text style={styles.qrStatusText}>Generating QR Code...</Text>
                </View>
              </View>
            )}

            {qrPaymentStatus === 'waiting' && (
              <View style={styles.qrSection}>
                <View style={styles.qrCodeContainer}>
                  {/* QR Code with Error Boundary */}
                  <View style={styles.qrCodePlaceholder}>
                    {qrCode ? (
                      <Icon name="qr-code" size={120} color={Colors.primary} />
                    ) : (
                      <Icon name="error" size={120} color={Colors.danger} />
                    )}
                  </View>
                  <Text style={styles.qrCodeText}>
                    {qrCode
                      ? 'Scan this QR code with your banking app'
                      : 'QR Code generation failed'}
                  </Text>
                  <Text style={styles.qrOrderId}>
                    Order ID: {qrCode ? qrCode.slice(-12) : 'N/A'}
                  </Text>
                </View>

                <View style={styles.qrInstructions}>
                  <Text style={styles.instructionTitle}>How to pay:</Text>
                  <Text style={styles.instructionText}>1. Open your banking app</Text>
                  <Text style={styles.instructionText}>2. Select "Pay by QR" or "Scan to Pay"</Text>
                  <Text style={styles.instructionText}>3. Scan this QR code</Text>
                  <Text style={styles.instructionText}>4. Confirm the payment</Text>
                </View>

                <View style={styles.paymentBenefits}>
                  <Text style={styles.benefitsTitle}>Why QR Payment?</Text>
                  <View style={styles.benefitRow}>
                    <Icon name="security" size={16} color={Colors.success} />
                    <Text style={styles.benefitText}>Secure & Safe</Text>
                  </View>
                  <View style={styles.benefitRow}>
                    <Icon name="speed" size={16} color={Colors.success} />
                    <Text style={styles.benefitText}>Instant Payment</Text>
                  </View>
                  <View style={styles.benefitRow}>
                    <Icon name="money-off" size={16} color={Colors.success} />
                    <Text style={styles.benefitText}>Lowest Fees (1.2%)</Text>
                  </View>
                </View>
              </View>
            )}

            {qrPaymentStatus === 'expired' && (
              <View style={styles.qrSection}>
                <View style={styles.qrErrorContainer}>
                  <Icon name="access-time" size={48} color={Colors.warning} />
                  <Text style={styles.qrStatusText}>QR Code Expired</Text>
                  <Text style={styles.qrSubText}>Please generate a new QR code</Text>
                  <TouchableOpacity style={styles.regenerateButton} onPress={generateQRCode}>
                    <Text style={styles.regenerateButtonText}>Generate New QR</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {qrPaymentStatus === 'completed' && (
              <View style={styles.qrSection}>
                <View style={styles.qrSuccessContainer}>
                  <Icon name="check-circle" size={48} color={Colors.success} />
                  <Text style={styles.qrStatusText}>Payment Received!</Text>
                  <Text style={styles.qrSubText}>Processing your order...</Text>
                </View>
              </View>
            )}
          </View>

          <View style={styles.qrModalFooter}>
            <TouchableOpacity style={styles.qrCancelButton} onPress={() => setShowQRModal(false)}>
              <Text style={styles.qrCancelButtonText}>Cancel</Text>
            </TouchableOpacity>

            {qrPaymentStatus === 'waiting' && (
              <TouchableOpacity
                style={styles.qrTestButton}
                onPress={() => {
                  // Simulate successful payment for demo
                  setQRPaymentStatus('completed');
                  setTimeout(() => {
                    setShowQRModal(false);
                    handleProcessPayment();
                  }, 2000);
                }}
              >
                <Text style={styles.qrTestButtonText}>Simulate Payment</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Icon name="arrow-back" size={24} color={Colors.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Payment</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Order Summary */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Order Summary</Text>
          <View style={styles.summaryCard}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Subtotal ({cart.length} items)</Text>
              <Text style={styles.summaryValue}>£{calculateSubtotal().toFixed(2)}</Text>
            </View>

            {taxConfiguration.vatEnabled && (
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>VAT ({taxConfiguration.vatRate}%)</Text>
                <Text style={styles.summaryValue}>
                  £{calculateTax(calculateSubtotal()).toFixed(2)}
                </Text>
              </View>
            )}

            {serviceChargePercentage > 0 && (
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Service Charge ({serviceChargePercentage}%)</Text>
                <Text style={styles.summaryValue}>£{calculateServiceCharge().toFixed(2)}</Text>
              </View>
            )}

            {addTransactionFee && (
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Processing Fee (2.9%)</Text>
                <Text style={styles.summaryValue}>£{calculateTransactionFee().toFixed(2)}</Text>
              </View>
            )}

            {tipAmount > 0 && (
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Tip ({tipPercentage}%)</Text>
                <Text style={styles.summaryValue}>£{tipAmount.toFixed(2)}</Text>
              </View>
            )}

            <View style={[styles.summaryRow, styles.totalRow]}>
              <Text style={styles.totalLabel}>Total</Text>
              <Text style={styles.totalValue}>£{calculateGrandTotal().toFixed(2)}</Text>
            </View>
          </View>
        </View>

        {/* Tip Selection */}
        {paymentMethods?.card?.tipEnabled && selectedPaymentMethod === 'card' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Add Tip</Text>
            <View style={styles.tipButtons}>
              {tipPresets.map((percentage) => (
                <TouchableOpacity
                  key={percentage}
                  style={[styles.tipButton, tipPercentage === percentage && styles.tipButtonActive]}
                  onPress={() => handleTipPreset(percentage)}
                >
                  <Text
                    style={[
                      styles.tipButtonText,
                      tipPercentage === percentage && styles.tipButtonTextActive,
                    ]}
                  >
                    {percentage}%
                  </Text>
                  <Text
                    style={[
                      styles.tipButtonAmount,
                      tipPercentage === percentage && styles.tipButtonAmountActive,
                    ]}
                  >
                    £{((calculateSubtotal() * percentage) / 100).toFixed(2)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.tipActions}>
              <TouchableOpacity
                style={styles.customTipButton}
                onPress={() => setShowCustomTip(!showCustomTip)}
              >
                <Icon name="edit" size={20} color={Colors.primary} />
                <Text style={styles.customTipButtonText}>Custom Amount</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.noTipButton} onPress={handleNoTip}>
                <Text style={styles.noTipButtonText}>No Tip</Text>
              </TouchableOpacity>
            </View>

            {showCustomTip && (
              <View style={styles.customTipInput}>
                <DecimalInput
                  label="Custom Tip Amount"
                  value={customTipInput}
                  onValueChange={(value) => {
                    setCustomTipInput(value);
                    setTipAmount(value);
                    setTipPercentage(0); // Clear percentage when using custom amount
                  }}
                  suffix="£"
                  maxValue={1000}
                  minValue={0}
                  decimalPlaces={2}
                  placeholder="5.00"
                  style={styles.tipInput}
                />
              </View>
            )}
          </View>
        )}

        {/* Payment Methods */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Payment Method</Text>
            {enabledPaymentMethods.length > 1 && user?.subscription_plan !== 'alpha' && (
              <TouchableOpacity style={styles.splitPaymentButton} onPress={handleSplitPayment}>
                <Icon name="call-split" size={20} color={Colors.secondary} />
                <Text style={styles.splitPaymentText}>Split Payment</Text>
              </TouchableOpacity>
            )}
          </View>

          {!splitPayment ? (
            <View style={styles.paymentMethods}>
              {enabledPaymentMethods.map((method) => (
                <TouchableOpacity
                  key={method.id}
                  style={[
                    styles.paymentMethod,
                    selectedPaymentMethod === method.id && styles.paymentMethodActive,
                  ]}
                  onPress={() => handlePaymentMethodSelect(method.id)}
                >
                  <Icon
                    name={method.icon}
                    size={32}
                    color={selectedPaymentMethod === method.id ? Colors.white : method.color}
                  />
                  <Text
                    style={[
                      styles.paymentMethodName,
                      selectedPaymentMethod === method.id && styles.paymentMethodNameActive,
                    ]}
                  >
                    {method.name}
                  </Text>
                  {method.requiresAuth && (
                    <Icon
                      name="lock"
                      size={16}
                      color={selectedPaymentMethod === method.id ? Colors.white : Colors.warning}
                      style={styles.authIcon}
                    />
                  )}
                </TouchableOpacity>
              ))}
            </View>
          ) : (
            <View style={styles.splitPaymentSection}>
              <Text style={styles.splitPaymentInfo}>
                Split total of £{calculateGrandTotal().toFixed(2)} between methods:
              </Text>
              {splitAmounts.map((split, index) => (
                <View key={index} style={styles.splitAmountRow}>
                  <DecimalInput
                    label={`${
                      availablePaymentMethods.find((m) => m.id === split.method)?.name || 'Payment'
                    } Amount`}
                    value={split.amount}
                    onValueChange={(value) => {
                      const newSplits = [...splitAmounts];
                      newSplits[index].amount = value;
                      setSplitAmounts(newSplits);
                    }}
                    suffix="£"
                    maxValue={10000}
                    minValue={0}
                    decimalPlaces={2}
                    placeholder="0.00"
                    style={styles.splitAmountInput}
                  />
                </View>
              ))}
              <TouchableOpacity
                style={styles.cancelSplitButton}
                onPress={() => {
                  setSplitPayment(false);
                  setSplitAmounts([]);
                }}
              >
                <Text style={styles.cancelSplitText}>Cancel Split</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Customer Information - Required for Email Receipt */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Customer Information</Text>
          <View style={styles.customerForm}>
            <View style={styles.customerField}>
              <SimpleTextInput
                value={customerName}
                onValueChange={setCustomerName}
                placeholder="Customer Name (required)"
                maxLength={60}
                style={[
                  styles.customerInput,
                  customerName.length > 0 && !isNameValid && styles.inputError,
                ]}
                clearButtonMode="while-editing"
                autoCapitalize="words"
              />
              {customerName.length > 0 && !isNameValid && (
                <Text style={styles.validationError}>
                  {customerName.length > 60
                    ? 'Name too long (max 60 characters)'
                    : 'Name is required'}
                </Text>
              )}
            </View>

            <View style={styles.customerField}>
              <SimpleTextInput
                value={customerEmail}
                onValueChange={setCustomerEmail}
                placeholder="Email Address (required for receipt)"
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                style={[
                  styles.customerInput,
                  customerEmail.length > 0 && !isEmailValid && styles.inputError,
                ]}
                clearButtonMode="while-editing"
              />
              {customerEmail.length > 0 && !isEmailValid && (
                <Text style={styles.validationError}>Please enter a valid email address</Text>
              )}
            </View>

            <View style={styles.receiptNote}>
              <Icon name="mail" size={16} color={Colors.lightText} />
              <Text style={styles.receiptNoteText}>Receipt will be sent via email only</Text>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Process Payment Button */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.processButton, processing && styles.processingButton]}
          onPress={handleProcessPayment}
          disabled={processing || (!selectedPaymentMethod && !splitPayment) || !isFormValid}
        >
          {processing ? (
            <>
              <Icon name="hourglass-empty" size={24} color={Colors.white} />
              <Text style={styles.processButtonText}>Processing...</Text>
            </>
          ) : (
            <>
              <Icon name="payment" size={24} color={Colors.white} />
              <Text style={styles.processButtonText}>
                Process Payment - £{calculateGrandTotal().toFixed(2)}
              </Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* Cash Payment Modal */}
      <CashPaymentModal />

      {/* QR Payment Modal */}
      <QRPaymentModal />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    backgroundColor: Colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingTop: 48,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.white,
  },
  headerSpacer: {
    width: 40,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 140, // Add bottom padding to account for absolute positioned footer (16+16+32+padding)
  },
  section: {
    backgroundColor: Colors.white,
    marginVertical: 8,
    paddingVertical: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text,
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  summaryCard: {
    paddingHorizontal: 16,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  summaryLabel: {
    fontSize: 14,
    color: Colors.lightText,
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.text,
  },
  totalRow: {
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: 8,
    marginTop: 4,
  },
  totalLabel: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text,
  },
  totalValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.primary,
  },
  tipInput: {
    marginVertical: 8,
  },
  tipButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    gap: 12,
  },
  tipButton: {
    flex: 1,
    minWidth: 80,
    backgroundColor: Colors.background,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  tipButtonActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  tipButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
  },
  tipButtonTextActive: {
    color: Colors.white,
  },
  tipButtonAmount: {
    fontSize: 12,
    color: Colors.lightText,
    marginTop: 2,
  },
  tipButtonAmountActive: {
    color: Colors.white,
  },
  tipActions: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginTop: 16,
    gap: 12,
  },
  customTipButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  customTipButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.primary,
  },
  noTipButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  noTipButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.darkGray,
  },
  customTipInput: {
    paddingHorizontal: 16,
    marginTop: 16,
  },
  customTipLabel: {
    fontSize: 14,
    color: Colors.lightText,
    marginBottom: 8,
  },
  customTipRow: {
    flexDirection: 'row',
    gap: 12,
  },
  customTipField: {
    flex: 1,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: Colors.text,
  },
  customTipApply: {
    backgroundColor: Colors.primary,
    borderRadius: 8,
    paddingHorizontal: 24,
    justifyContent: 'center',
  },
  customTipApplyText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.white,
  },
  splitPaymentButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  splitPaymentText: {
    fontSize: 14,
    color: Colors.secondary,
    fontWeight: '500',
  },
  paymentMethods: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    gap: 12,
  },
  paymentMethod: {
    flex: 1,
    minWidth: 100,
    backgroundColor: Colors.background,
    borderRadius: 12,
    paddingVertical: 20,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: Colors.border,
    position: 'relative',
  },
  paymentMethodActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  paymentMethodName: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.text,
    marginTop: 8,
  },
  paymentMethodNameActive: {
    color: Colors.white,
  },
  authIcon: {
    position: 'absolute',
    top: 8,
    right: 8,
  },
  splitPaymentSection: {
    paddingHorizontal: 16,
  },
  splitPaymentInfo: {
    fontSize: 14,
    color: Colors.lightText,
    marginBottom: 16,
  },
  splitAmountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  splitMethodName: {
    fontSize: 16,
    fontWeight: '500',
    color: Colors.text,
  },
  splitAmountInput: {
    width: 120,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 16,
    color: Colors.text,
    textAlign: 'right',
  },
  cancelSplitButton: {
    alignSelf: 'center',
    marginTop: 8,
  },
  cancelSplitText: {
    fontSize: 14,
    color: Colors.danger,
    fontWeight: '500',
  },
  receiptOptions: {
    paddingHorizontal: 16,
  },
  receiptOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
  },
  receiptOptionActive: {
    // Optional active state styling
  },
  receiptOptionText: {
    fontSize: 16,
    color: Colors.text,
  },
  emailReceiptSection: {
    marginTop: 8,
  },
  emailInput: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: Colors.text,
    marginTop: 8,
    marginLeft: 36,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: Colors.white,
    paddingHorizontal: 16,
    paddingVertical: 16,
    paddingBottom: 32,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  processButton: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  processingButton: {
    backgroundColor: Colors.mediumGray,
  },
  processButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.white,
  },
  disabledButton: {
    opacity: 0.5,
  },
  // Cash Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cashModalContent: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    width: '90%',
    maxWidth: 400,
  },
  cashModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  cashModalTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: Colors.text,
  },
  cashModalBody: {
    padding: 20,
  },
  amountDue: {
    alignItems: 'center',
    marginBottom: 24,
  },
  amountDueLabel: {
    fontSize: 16,
    color: Colors.lightText,
    marginBottom: 8,
  },
  amountDueValue: {
    fontSize: 32,
    fontWeight: 'bold',
    color: Colors.primary,
  },
  cashInputSection: {
    marginBottom: 20,
  },
  cashInputLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: Colors.text,
    marginBottom: 8,
    textAlign: 'center',
  },
  cashInput: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 24,
    fontWeight: '600',
    color: Colors.text,
    textAlign: 'center',
  },
  quickCashButtons: {
    flexDirection: 'row',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 24,
  },
  quickCashButton: {
    backgroundColor: Colors.background,
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  quickCashButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: Colors.text,
  },
  changeSection: {
    alignItems: 'center',
    paddingVertical: 16,
    backgroundColor: Colors.background,
    borderRadius: 8,
  },
  changeLabel: {
    fontSize: 16,
    color: Colors.lightText,
    marginBottom: 8,
  },
  changeValue: {
    fontSize: 28,
    fontWeight: 'bold',
    color: Colors.text,
  },
  changeValuePositive: {
    color: Colors.success,
  },
  cashConfirmButton: {
    backgroundColor: Colors.primary,
    borderRadius: 8,
    paddingVertical: 16,
    margin: 20,
    marginTop: 0,
    alignItems: 'center',
  },
  cashConfirmButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.white,
  },

  // QR Modal Styles
  qrModalContent: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    width: '95%',
    maxWidth: 450,
    maxHeight: '85%',
  },
  qrModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  qrModalTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: Colors.text,
  },
  qrModalBody: {
    padding: 20,
    maxHeight: 500,
  },
  qrSection: {
    alignItems: 'center',
    marginBottom: 24,
  },
  qrLoadingContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  qrCodeContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  qrCodePlaceholder: {
    width: 180,
    height: 180,
    backgroundColor: Colors.background,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    borderWidth: 2,
    borderColor: Colors.primary,
  },
  qrCodeText: {
    fontSize: 16,
    color: Colors.text,
    textAlign: 'center',
    marginBottom: 8,
  },
  qrOrderId: {
    fontSize: 14,
    color: Colors.lightText,
    fontFamily: 'monospace',
  },
  qrStatusText: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text,
    textAlign: 'center',
    marginTop: 16,
  },
  qrSubText: {
    fontSize: 14,
    color: Colors.lightText,
    textAlign: 'center',
    marginTop: 8,
  },
  qrInstructions: {
    backgroundColor: Colors.background,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    width: '100%',
  },
  instructionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 12,
  },
  instructionText: {
    fontSize: 14,
    color: Colors.lightText,
    marginBottom: 6,
    paddingLeft: 8,
  },
  paymentBenefits: {
    backgroundColor: Colors.background,
    borderRadius: 12,
    padding: 16,
    width: '100%',
  },
  benefitsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 12,
  },
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  benefitText: {
    fontSize: 14,
    color: Colors.text,
    marginLeft: 8,
  },
  qrErrorContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  qrSuccessContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  regenerateButton: {
    backgroundColor: Colors.primary,
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 24,
    marginTop: 16,
  },
  regenerateButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.white,
  },
  qrModalFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  qrCancelButton: {
    flex: 1,
    backgroundColor: Colors.background,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    marginRight: 8,
  },
  qrCancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
  },
  qrTestButton: {
    flex: 1,
    backgroundColor: Colors.primary,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    marginLeft: 8,
  },
  qrTestButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.white,
  },
  // Customer form styles
  customerForm: {
    paddingHorizontal: 16,
  },
  customerField: {
    marginBottom: 16,
  },
  customerInput: {
    fontSize: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: Colors.white,
  },
  inputError: {
    borderColor: Colors.danger,
    borderWidth: 2,
  },
  validationError: {
    fontSize: 12,
    color: Colors.danger,
    marginTop: 4,
    marginLeft: 4,
  },
  receiptNote: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginTop: 8,
  },
  receiptNoteText: {
    fontSize: 14,
    color: Colors.lightText,
    marginLeft: 8,
  },
  customTipInput: {
    marginVertical: 8,
  },
  splitAmountInput: {
    marginVertical: 4,
    flex: 1,
  },
});

export default EnhancedPaymentScreen;
