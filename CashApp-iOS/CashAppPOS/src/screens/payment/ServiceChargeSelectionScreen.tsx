import React, { useState, useEffect } from 'react';

import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  Alert,
} from 'react-native';

import { useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialIcons';

import { useTheme } from '../../design-system/ThemeProvider';
import useAppStore from '../../store/useAppStore';
import { formatPrice } from '../../utils/priceValidation';

interface ServiceChargeOption {
  percentage: number;
  label: string;
  description: string;
  coversTransactionFee: string;
  recommended?: boolean;
}

const serviceChargeOptions: ServiceChargeOption[] = [
  {
    percentage: 5,
    label: '5% Service Charge',
    description: 'Helps cover service costs',
    coversTransactionFee: '1.2% transaction fee + support tip',
  },
  {
    percentage: 10,
    label: '10% Service Charge',
    description: 'Supports excellent service',
    coversTransactionFee: '2.9% transaction fee + good tip',
    recommended: true,
  },
  {
    percentage: 15,
    label: '15% Service Charge',
    description: 'Exceptional service appreciation',
    coversTransactionFee: '2.9% transaction fee + generous tip',
  },
  {
    percentage: 0,
    label: 'Skip Service Charge',
    description: 'Continue without service charge',
    coversTransactionFee: 'Option to add transaction fee separately',
  },
];

const ServiceChargeSelectionScreen: React.FC = () => {
  const navigation = useNavigation();
  const { theme } = useTheme();
  const {
    _cart,
    cartTotal,
    setServiceChargePercentage,
    setAddTransactionFee,
    serviceChargePercentage,
    addTransactionFee,
  } = useAppStore();

  const [selectedOption, setSelectedOption] = useState<number>(serviceChargePercentage);
  const [showTransactionFeeToggle, setShowTransactionFeeToggle] = useState(false);
  const [localAddTransactionFee, setLocalAddTransactionFee] = useState(addTransactionFee);

  useEffect(() => {
    setShowTransactionFeeToggle(selectedOption === 0);
  }, [selectedOption]);

  const calculateTotals = (servicePercent: number, includeTransactionFee: boolean = false) => {
    const subtotal = cartTotal();
    const serviceCharge = subtotal * (servicePercent / 100);
    const transactionFee = includeTransactionFee ? subtotal * 0.029 : 0;
    const total = subtotal + serviceCharge + transactionFee;

    return {
      subtotal,
      serviceCharge,
      transactionFee,
      total,
    };
  };

  const handleOptionSelect = (percentage: number) => {
    setSelectedOption(percentage);
    if (percentage === 0) {
      setShowTransactionFeeToggle(true);
    } else {
      setShowTransactionFeeToggle(false);
      setLocalAddTransactionFee(false);
    }
  };

  const handleTransactionFeeToggle = () => {
    setLocalAddTransactionFee(!localAddTransactionFee);
  };

  const handleContinue = () => {
    if (selectedOption === 0 && !localAddTransactionFee) {
      Alert.alert(
        'Processing Costs',
        'Without a service charge or transaction fee, the restaurant will cover all processing costs (2.9%). Continue anyway?',
        [
          { text: 'Go Back', style: 'cancel' },
          {
            text: 'Continue',
            onPress: () => proceedToPayment(),
          },
        ]
      );
    } else {
      proceedToPayment();
    }
  };

  const proceedToPayment = () => {
    // Update global state
    setServiceChargePercentage(selectedOption);
    setAddTransactionFee(localAddTransactionFee);

    // Navigate to payment method selection
    // @ts-expect-error
    navigation.navigate('EnhancedPayment');
  };

  const totals = calculateTotals(
    selectedOption,
    showTransactionFeeToggle ? localAddTransactionFee : false
  );

  const styles = createStyles(theme);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Icon name="arrow-back" size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Service Options</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.explanationSection}>
          <Text style={styles.explanationTitle}>Support Great Service</Text>
          <Text style={styles.explanationText}>
            Service charges help cover processing costs and support the staff who made your
            experience great. Choose what feels right for your visit.
          </Text>
        </View>

        <View style={styles.optionsSection}>
          {serviceChargeOptions.map((option) => (
            <TouchableOpacity
              key={option.percentage}
              style={[
                styles.optionCard,
                selectedOption === option.percentage && styles.optionCardSelected,
              ]}
              onPress={() => handleOptionSelect(option.percentage)}
            >
              {option.recommended && (
                <View style={styles.recommendedBadge}>
                  <Text style={styles.recommendedText}>RECOMMENDED</Text>
                </View>
              )}

              <View style={styles.optionHeader}>
                <View style={styles.optionLeft}>
                  <View
                    style={[
                      styles.radioButton,
                      selectedOption === option.percentage && styles.radioButtonSelected,
                    ]}
                  >
                    {selectedOption === option.percentage && (
                      <Icon name="check" size={16} color={theme.colors.white} />
                    )}
                  </View>
                  <View style={styles.optionInfo}>
                    <Text style={styles.optionLabel}>{option.label}</Text>
                    <Text style={styles.optionDescription}>{option.description}</Text>
                  </View>
                </View>

                <View style={styles.optionRight}>
                  <Text style={styles.optionAmount}>
                    {option.percentage === 0
                      ? '£0.00'
                      : formatPrice(calculateTotals(option.percentage).serviceCharge, '£')}
                  </Text>
                </View>
              </View>

              <Text style={styles.feeExplanation}>{option.coversTransactionFee}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {showTransactionFeeToggle && (
          <View style={styles.transactionFeeSection}>
            <Text style={styles.sectionTitle}>Processing Fees</Text>
            <Text style={styles.feeExplanationText}>
              Payment processing requires a small fee (2.9%). You can choose to add this to your
              bill.
            </Text>

            <TouchableOpacity
              style={[styles.toggleButton, localAddTransactionFee && styles.toggleButtonSelected]}
              onPress={handleTransactionFeeToggle}
            >
              <View
                style={[
                  styles.toggleIndicator,
                  localAddTransactionFee && styles.toggleIndicatorSelected,
                ]}
              >
                {localAddTransactionFee && (
                  <Icon name="check" size={16} color={theme.colors.white} />
                )}
              </View>
              <Text style={styles.toggleText}>
                Add processing fee ({formatPrice(totals.transactionFee, '£')})
              </Text>
            </TouchableOpacity>

            {!localAddTransactionFee && (
              <View style={styles.warningSection}>
                <Icon name="info" size={20} color={theme.colors.warning} />
                <Text style={styles.warningText}>Restaurant will cover processing costs</Text>
              </View>
            )}
          </View>
        )}

        <View style={styles.summarySection}>
          <Text style={styles.summaryTitle}>Order Summary</Text>

          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Subtotal</Text>
            <Text style={styles.summaryValue}>{formatPrice(totals.subtotal, '£')}</Text>
          </View>

          {totals.serviceCharge > 0 && (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Service Charge ({selectedOption}%)</Text>
              <Text style={styles.summaryValue}>{formatPrice(totals.serviceCharge, '£')}</Text>
            </View>
          )}

          {totals.transactionFee > 0 && (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Processing Fee (2.9%)</Text>
              <Text style={styles.summaryValue}>{formatPrice(totals.transactionFee, '£')}</Text>
            </View>
          )}

          <View style={[styles.summaryRow, styles.totalRow]}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalValue}>{formatPrice(totals.total, '£')}</Text>
          </View>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.continueButton} onPress={handleContinue}>
          <Text style={styles.continueButtonText}>
            Continue to Payment • {formatPrice(totals.total, '£')}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const createStyles = (theme: unknown) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 12,
      backgroundColor: theme.colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    backButton: {
      padding: 8,
    },
    headerTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: theme.colors.text,
    },
    placeholder: {
      width: 40,
    },
    content: {
      flex: 1,
      paddingHorizontal: 16,
    },
    explanationSection: {
      paddingVertical: 20,
    },
    explanationTitle: {
      fontSize: 24,
      fontWeight: '700',
      color: theme.colors.text,
      marginBottom: 8,
    },
    explanationText: {
      fontSize: 16,
      color: theme.colors.textSecondary,
      lineHeight: 22,
    },
    optionsSection: {
      marginBottom: 24,
    },
    optionCard: {
      backgroundColor: theme.colors.surface,
      borderRadius: 12,
      padding: 16,
      marginBottom: 12,
      borderWidth: 2,
      borderColor: theme.colors.border,
      position: 'relative',
    },
    optionCardSelected: {
      borderColor: theme.colors.primary,
      backgroundColor: `${theme.colors.primary}08`,
    },
    recommendedBadge: {
      position: 'absolute',
      top: -8,
      right: 12,
      backgroundColor: theme.colors.success,
      paddingHorizontal: 12,
      paddingVertical: 4,
      borderRadius: 12,
    },
    recommendedText: {
      fontSize: 10,
      fontWeight: '700',
      color: theme.colors.white,
      letterSpacing: 0.5,
    },
    optionHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 8,
    },
    optionLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
    },
    radioButton: {
      width: 24,
      height: 24,
      borderRadius: 12,
      borderWidth: 2,
      borderColor: theme.colors.border,
      marginRight: 12,
      justifyContent: 'center',
      alignItems: 'center',
    },
    radioButtonSelected: {
      borderColor: theme.colors.primary,
      backgroundColor: theme.colors.primary,
    },
    optionInfo: {
      flex: 1,
    },
    optionLabel: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.colors.text,
    },
    optionDescription: {
      fontSize: 14,
      color: theme.colors.textSecondary,
      marginTop: 2,
    },
    optionRight: {
      alignItems: 'flex-end',
    },
    optionAmount: {
      fontSize: 18,
      fontWeight: '700',
      color: theme.colors.text,
    },
    feeExplanation: {
      fontSize: 12,
      color: theme.colors.textSecondary,
      fontStyle: 'italic',
    },
    transactionFeeSection: {
      backgroundColor: theme.colors.surface,
      borderRadius: 12,
      padding: 16,
      marginBottom: 24,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: theme.colors.text,
      marginBottom: 8,
    },
    feeExplanationText: {
      fontSize: 14,
      color: theme.colors.textSecondary,
      marginBottom: 16,
      lineHeight: 20,
    },
    toggleButton: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.background,
    },
    toggleButtonSelected: {
      borderColor: theme.colors.primary,
      backgroundColor: `${theme.colors.primary}08`,
    },
    toggleIndicator: {
      width: 20,
      height: 20,
      borderRadius: 10,
      borderWidth: 2,
      borderColor: theme.colors.border,
      marginRight: 12,
      justifyContent: 'center',
      alignItems: 'center',
    },
    toggleIndicatorSelected: {
      borderColor: theme.colors.primary,
      backgroundColor: theme.colors.primary,
    },
    toggleText: {
      fontSize: 16,
      fontWeight: '500',
      color: theme.colors.text,
    },
    warningSection: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 12,
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: theme.colors.border,
    },
    warningText: {
      fontSize: 14,
      color: theme.colors.warning,
      marginLeft: 8,
      fontWeight: '500',
    },
    summarySection: {
      backgroundColor: theme.colors.surface,
      borderRadius: 12,
      padding: 16,
      marginBottom: 24,
    },
    summaryTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: theme.colors.text,
      marginBottom: 12,
    },
    summaryRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 6,
    },
    summaryLabel: {
      fontSize: 16,
      color: theme.colors.textSecondary,
    },
    summaryValue: {
      fontSize: 16,
      fontWeight: '500',
      color: theme.colors.text,
    },
    totalRow: {
      borderTopWidth: 1,
      borderTopColor: theme.colors.border,
      marginTop: 8,
      paddingTop: 12,
    },
    totalLabel: {
      fontSize: 18,
      fontWeight: '700',
      color: theme.colors.text,
    },
    totalValue: {
      fontSize: 20,
      fontWeight: '700',
      color: theme.colors.primary,
    },
    footer: {
      paddingHorizontal: 16,
      paddingVertical: 16,
      backgroundColor: theme.colors.surface,
      borderTopWidth: 1,
      borderTopColor: theme.colors.border,
    },
    continueButton: {
      backgroundColor: theme.colors.primary,
      borderRadius: 12,
      paddingVertical: 16,
      alignItems: 'center',
    },
    continueButtonText: {
      fontSize: 18,
      fontWeight: '600',
      color: theme.colors.white,
    },
  });

export default ServiceChargeSelectionScreen;
