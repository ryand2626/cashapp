import React from 'react';

import { StyleSheet, Text, View, ScrollView, TouchableOpacity } from 'react-native';

import Icon from 'react-native-vector-icons/MaterialIcons';

import { SettingsHeader, SettingsSection } from '../../../components/settings';

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

const PaymentMethodsInfoScreen: React.FC = () => {
  const platformControlledMethods = [
    {
      id: 'cash',
      name: 'Cash',
      description: 'Accept cash payments',
      icon: 'payments',
      iconColor: Colors.success,
      enabled: true,
    },
    {
      id: 'card',
      name: 'Card Payments',
      description: 'Credit and debit cards',
      icon: 'credit-card',
      iconColor: Colors.secondary,
      enabled: true,
    },
    {
      id: 'qrCode',
      name: 'QR Code Payment',
      description: 'Mobile payments via QR code (1.2% fees)',
      icon: 'qr-code-scanner',
      iconColor: Colors.primary,
      enabled: true,
    },
    {
      id: 'applePay',
      name: 'Apple Pay',
      description: 'Contactless Apple Pay',
      icon: 'phone-android',
      iconColor: Colors.text,
      enabled: false,
    },
    {
      id: 'googlePay',
      name: 'Google Pay',
      description: 'Contactless Google Pay',
      icon: 'phone-android',
      iconColor: Colors.warning,
      enabled: false,
    },
  ];

  const renderPaymentMethod = (method: any) => (
    <View key={method.id} style={styles.methodCard}>
      <View style={styles.methodHeader}>
        <Icon
          name={method.icon}
          size={32}
          color={method.enabled ? method.iconColor : Colors.lightGray}
        />
        <View style={styles.methodInfo}>
          <Text style={styles.methodName}>{method.name}</Text>
          <Text style={styles.methodDescription}>{method.description}</Text>
        </View>
        <View style={styles.statusContainer}>
          <Icon
            name={method.enabled ? 'check-circle' : 'radio-button-unchecked'}
            size={24}
            color={method.enabled ? Colors.success : Colors.lightGray}
          />
          <Text
            style={[
              styles.statusText,
              { color: method.enabled ? Colors.success : Colors.lightGray },
            ]}
          >
            {method.enabled ? 'Enabled' : 'Disabled'}
          </Text>
        </View>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <SettingsHeader title="Payment Methods" subtitle="Platform-managed payment configuration" />

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Platform Control Notice */}
        <SettingsSection
          title="Platform Management"
          subtitle="Payment methods are configured by the platform owner"
        >
          <View style={styles.noticeContainer}>
            <View style={styles.noticeCard}>
              <Icon name="lock" size={48} color={Colors.primary} />
              <Text style={styles.noticeTitle}>Platform Controlled</Text>
              <Text style={styles.noticeText}>
                Payment methods and processing fees are managed centrally by the platform owner.
                This ensures consistent rates and compliance across all restaurants.
              </Text>
            </View>
          </View>
        </SettingsSection>

        {/* Current Payment Methods */}
        <SettingsSection
          title="Available Payment Methods"
          subtitle="Payment options enabled for your restaurant"
        >
          <View style={styles.methodsContainer}>
            {platformControlledMethods.map(renderPaymentMethod)}
          </View>
        </SettingsSection>

        {/* Processing Information */}
        <SettingsSection
          title="Processing Information"
          subtitle="Important details about payment processing"
        >
          <View style={styles.infoContainer}>
            <View style={styles.infoCard}>
              <Icon name="trending-down" size={24} color={Colors.success} />
              <View style={styles.infoContent}>
                <Text style={styles.infoTitle}>Low Processing Fees</Text>
                <Text style={styles.infoText}>
                  QR code payments: 1.2% • Card payments: Standard rates
                </Text>
              </View>
            </View>

            <View style={styles.infoCard}>
              <Icon name="security" size={24} color={Colors.secondary} />
              <View style={styles.infoContent}>
                <Text style={styles.infoTitle}>Secure & Compliant</Text>
                <Text style={styles.infoText}>
                  All payments are PCI DSS compliant with end-to-end encryption
                </Text>
              </View>
            </View>

            <View style={styles.infoCard}>
              <Icon name="schedule" size={24} color={Colors.warning} />
              <View style={styles.infoContent}>
                <Text style={styles.infoTitle}>Settlement Times</Text>
                <Text style={styles.infoText}>
                  Funds are typically available within 1-2 business days
                </Text>
              </View>
            </View>
          </View>
        </SettingsSection>

        {/* Contact Support */}
        <SettingsSection
          title="Need Changes?"
          subtitle="Contact platform support for payment method modifications"
        >
          <View style={styles.supportContainer}>
            <TouchableOpacity style={styles.supportButton}>
              <Icon name="support" size={24} color={Colors.white} />
              <Text style={styles.supportButtonText}>Contact Platform Support</Text>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.supportButton, styles.secondaryButton]}>
              <Icon name="help-outline" size={24} color={Colors.primary} />
              <Text style={[styles.supportButtonText, styles.secondaryButtonText]}>
                Payment Processing FAQ
              </Text>
            </TouchableOpacity>
          </View>
        </SettingsSection>
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
  noticeContainer: {
    padding: 16,
  },
  noticeCard: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  noticeTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.text,
    marginTop: 16,
    marginBottom: 8,
  },
  noticeText: {
    fontSize: 16,
    color: Colors.lightText,
    textAlign: 'center',
    lineHeight: 24,
  },
  methodsContainer: {
    padding: 16,
    gap: 12,
  },
  methodCard: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  methodHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  methodInfo: {
    flex: 1,
    marginLeft: 16,
  },
  methodName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 4,
  },
  methodDescription: {
    fontSize: 14,
    color: Colors.lightText,
  },
  statusContainer: {
    alignItems: 'center',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 4,
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
  supportContainer: {
    padding: 16,
    gap: 12,
  },
  supportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 24,
    gap: 8,
  },
  secondaryButton: {
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  supportButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.white,
  },
  secondaryButtonText: {
    color: Colors.primary,
  },
});

export default PaymentMethodsInfoScreen;
