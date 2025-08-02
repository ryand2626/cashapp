import React, { useState } from 'react';

import { StyleSheet, Text, View, ScrollView, TouchableOpacity, Alert } from 'react-native';

import Icon from 'react-native-vector-icons/MaterialIcons';

import {
  SettingsHeader,
  SettingsSection,
  SettingsCard,
  ToggleSwitch,
} from '../../../components/settings';
import useSettingsStore from '../../../store/useSettingsStore';

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

interface PaymentMethodInfo {
  id: string;
  name: string;
  description: string;
  icon: string;
  iconColor: string;
  popular?: boolean;
  comingSoon?: boolean;
}

const PaymentMethodsScreen: React.FC = () => {
  const { paymentMethods, updatePaymentMethods, isLoading } = useSettingsStore();
  const [formData, setFormData] = useState(paymentMethods);
  const [hasChanges, setHasChanges] = useState(false);

  const paymentMethodsInfo: PaymentMethodInfo[] = [
    {
      id: 'cash',
      name: 'Cash',
      description: 'Accept cash payments with change calculation',
      icon: 'payments',
      iconColor: Colors.success,
      popular: true,
    },
    {
      id: 'card',
      name: 'Card Payments',
      description: 'Credit and debit cards via card reader',
      icon: 'credit-card',
      iconColor: Colors.secondary,
      popular: true,
    },
    {
      id: 'applePay',
      name: 'Apple Pay',
      description: 'Contactless payments using Apple Pay',
      icon: 'phone-android',
      iconColor: Colors.text,
      popular: true,
    },
    {
      id: 'googlePay',
      name: 'Google Pay',
      description: 'Contactless payments using Google Pay',
      icon: 'phone-android',
      iconColor: Colors.warning,
    },
    {
      id: 'qrCode',
      name: 'QR Code Payment',
      description: 'Generate QR codes for customer mobile payments (1.2% fees)',
      icon: 'qr-code-scanner',
      iconColor: Colors.primary,
    },
    {
      id: 'customerAccount',
      name: 'Customer Account',
      description: 'Allow customers to pay using store credit',
      icon: 'account-balance-wallet',
      iconColor: Colors.darkGray,
      comingSoon: true,
    },
  ];

  const handlePaymentMethodToggle = (methodId: keyof typeof paymentMethods, enabled: boolean) => {
    setFormData((prev) => ({
      ...prev,
      [methodId]: {
        ...prev[methodId],
        enabled,
      },
    }));
    setHasChanges(true);
  };

  const handleRequiresAuthToggle = (
    methodId: keyof typeof paymentMethods,
    requiresAuth: boolean
  ) => {
    setFormData((prev) => ({
      ...prev,
      [methodId]: {
        ...prev[methodId],
        requiresAuth,
      },
    }));
    setHasChanges(true);
  };

  const handleTipEnabledToggle = (enabled: boolean) => {
    setFormData((prev) => ({
      ...prev,
      card: {
        ...prev.card,
        tipEnabled: enabled,
      },
    }));
    setHasChanges(true);
  };

  const handleSave = async () => {
    try {
      updatePaymentMethods(formData);
      setHasChanges(false);
      Alert.alert('Success', 'Payment methods configuration has been saved successfully.', [
        { text: 'OK' },
      ]);
    } catch (_error) {
      Alert.alert('Error', 'Failed to save payment methods configuration. Please try again.', [
        { text: 'OK' },
      ]);
    }
  };

  const handleReset = () => {
    Alert.alert('Reset Changes', 'Are you sure you want to discard all unsaved changes?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Reset',
        style: 'destructive',
        onPress: () => {
          setFormData(paymentMethods);
          setHasChanges(false);
        },
      },
    ]);
  };

  const getEnabledMethodsCount = () => {
    return Object.values(formData).filter((method) => method.enabled).length;
  };

  const renderPaymentMethodCard = (methodInfo: PaymentMethodInfo) => {
    const methodData = formData[methodInfo.id];
    const isEnabled = methodData.enabled;

    return (
      <View key={methodInfo.id} style={styles.paymentMethodContainer}>
        <SettingsCard
          title={methodInfo.name}
          description={methodInfo.description}
          icon={methodInfo.icon}
          iconColor={isEnabled ? methodInfo.iconColor : Colors.lightGray}
          badge={methodInfo.popular ? 'Popular' : methodInfo.comingSoon ? 'Coming Soon' : undefined}
          disabled={methodInfo.comingSoon}
        >
          <ToggleSwitch
            value={isEnabled}
            onValueChange={(enabled) => handlePaymentMethodToggle(methodInfo.id, enabled)}
            disabled={methodInfo.comingSoon}
          />
        </SettingsCard>

        {/* Additional settings for enabled methods */}
        {isEnabled && !methodInfo.comingSoon && (
          <View style={styles.subSettingsContainer}>
            <SettingsCard
              title="Require Authorization"
              description="Manager authorization required for this payment method"
              icon="security"
              iconColor={Colors.warning}
              showChevron={false}
            >
              <ToggleSwitch
                value={methodData.requiresAuth}
                onValueChange={(requiresAuth) =>
                  handleRequiresAuthToggle(methodInfo.id, requiresAuth)
                }
                size="small"
              />
            </SettingsCard>

            {/* Card-specific settings */}
            {methodInfo.id === 'card' && (
              <SettingsCard
                title="Enable Tip Prompts"
                description="Show tip options during card transactions"
                icon="thumb-up"
                iconColor={Colors.primary}
                showChevron={false}
              >
                <ToggleSwitch
                  value={formData.card.tipEnabled}
                  onValueChange={handleTipEnabledToggle}
                  size="small"
                />
              </SettingsCard>
            )}
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <SettingsHeader
        title="Payment Methods"
        subtitle="Configure accepted payment options"
        rightAction={{
          icon: 'save',
          onPress: handleSave,
          color: hasChanges ? Colors.white : 'rgba(255, 255, 255, 0.5)',
        }}
      />

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Summary */}
        <SettingsSection
          title="Payment Methods Summary"
          subtitle={`${getEnabledMethodsCount()} payment methods enabled`}
        >
          <View style={styles.summaryContainer}>
            <View style={styles.summaryCard}>
              <Icon name="payment" size={32} color={Colors.primary} />
              <Text style={styles.summaryTitle}>Active Methods</Text>
              <Text style={styles.summaryValue}>{getEnabledMethodsCount()}</Text>
            </View>

            <View style={styles.summaryCard}>
              <Icon name="security" size={32} color={Colors.warning} />
              <Text style={styles.summaryTitle}>Secure Methods</Text>
              <Text style={styles.summaryValue}>
                {
                  Object.values(formData).filter((method) => method.enabled && method.requiresAuth)
                    .length
                }
              </Text>
            </View>
          </View>
        </SettingsSection>

        {/* Popular Payment Methods */}
        <SettingsSection
          title="Popular Payment Methods"
          subtitle="Most commonly used payment options"
        >
          {paymentMethodsInfo.filter((method) => method.popular).map(renderPaymentMethodCard)}
        </SettingsSection>

        {/* Additional Payment Methods */}
        <SettingsSection
          title="Additional Payment Methods"
          subtitle="Other payment options for your business"
        >
          {paymentMethodsInfo.filter((method) => !method.popular).map(renderPaymentMethodCard)}
        </SettingsSection>

        {/* Payment Processing Info */}
        <SettingsSection
          title="Payment Processing"
          subtitle="Important information about payment handling"
        >
          <View style={styles.infoContainer}>
            <View style={styles.infoCard}>
              <Icon name="info-outline" size={24} color={Colors.secondary} />
              <View style={styles.infoContent}>
                <Text style={styles.infoTitle}>Card Processing</Text>
                <Text style={styles.infoText}>
                  Card payments require a compatible card reader. Contact support for setup
                  assistance.
                </Text>
              </View>
            </View>

            <View style={styles.infoCard}>
              <Icon name="security" size={24} color={Colors.primary} />
              <View style={styles.infoContent}>
                <Text style={styles.infoTitle}>Security & Compliance</Text>
                <Text style={styles.infoText}>
                  All payment methods are PCI DSS compliant and use end-to-end encryption.
                </Text>
              </View>
            </View>

            <View style={styles.infoCard}>
              <Icon name="trending-up" size={24} color={Colors.warning} />
              <View style={styles.infoContent}>
                <Text style={styles.infoTitle}>Processing Fees</Text>
                <Text style={styles.infoText}>
                  Different payment methods may have varying processing fees. Check with your
                  payment processor.
                </Text>
              </View>
            </View>
          </View>
        </SettingsSection>

        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={[styles.button, styles.saveButton]}
            onPress={handleSave}
            disabled={!hasChanges || isLoading}
          >
            <Icon name="save" size={20} color={Colors.white} />
            <Text style={styles.saveButtonText}>Save Changes</Text>
          </TouchableOpacity>

          {hasChanges && (
            <TouchableOpacity style={[styles.button, styles.resetButton]} onPress={handleReset}>
              <Icon name="refresh" size={20} color={Colors.danger} />
              <Text style={styles.resetButtonText}>Reset</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    flex: 1,
  },
  summaryContainer: {
    flexDirection: 'row',
    padding: 16,
    gap: 16,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  summaryTitle: {
    fontSize: 14,
    color: Colors.lightText,
    marginTop: 8,
    textAlign: 'center',
  },
  summaryValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.text,
    marginTop: 4,
  },
  paymentMethodContainer: {
    marginBottom: 1,
  },
  subSettingsContainer: {
    marginLeft: 16,
    borderLeftWidth: 2,
    borderLeftColor: Colors.lightGray,
    paddingLeft: 16,
  },
  infoContainer: {
    padding: 16,
    gap: 12,
  },
  infoCard: {
    flexDirection: 'row',
    backgroundColor: Colors.white,
    borderRadius: 8,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  infoContent: {
    flex: 1,
    marginLeft: 12,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 4,
  },
  infoText: {
    fontSize: 14,
    color: Colors.lightText,
    lineHeight: 20,
  },
  actionButtons: {
    padding: 16,
    gap: 12,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  saveButton: {
    backgroundColor: Colors.primary,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.white,
  },
  resetButton: {
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.danger,
  },
  resetButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.danger,
  },
});

export default PaymentMethodsScreen;
