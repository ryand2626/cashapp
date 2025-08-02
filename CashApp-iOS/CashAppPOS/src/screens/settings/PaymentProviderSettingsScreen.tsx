import React, { useState, useEffect } from 'react';

import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  Switch,
} from 'react-native';

import { useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialIcons';

import { logger } from '../../utils/logger';

import PaymentService from '../../services/PaymentService';

import type { PaymentProviderConfig } from '../../services/PaymentService';

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

const PaymentProviderSettingsScreen: React.FC = () => {
  const navigation = useNavigation();
  const [config, setConfig] = useState<PaymentProviderConfig>({
    stripe: {
      publishableKey: '',
      merchantId: 'merchant.fynlo.pos',
    },
    square: {
      applicationId: '',
      locationId: '',
    },
    sumup: {
      affiliateKey: '',
    },
    backend: {
      baseUrl: 'http://localhost:8000',
      apiKey: '',
    },
  });
  const [enabledProviders, setEnabledProviders] = useState({
    stripe: true,
    square: false,
    sumup: true, // ENABLED for staging testing
    qrCode: true,
    cash: true,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadConfiguration();
  }, []);

  const loadConfiguration = async () => {
    try {
      const savedConfig = await PaymentService.loadConfig();
      if (savedConfig) {
        setConfig(savedConfig);
      }
    } catch (error) {
      logger.error('Failed to load payment configuration:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveConfiguration = async () => {
    try {
      await PaymentService.saveConfig(config);
      Alert.alert('Success', 'Payment provider configuration saved successfully');
    } catch (error) {
      Alert.alert('Error', 'Failed to save configuration');
      logger.error('Failed to save payment configuration:', error);
    }
  };

  const testConnection = async (provider: string) => {
    try {
      // Test the connection based on provider
      switch (provider) {
        case 'stripe':
          if (!config.stripe.publishableKey) {
            Alert.alert('Error', 'Please enter Stripe publishable key');
            return;
          }
          // TODO: Test Stripe connection
          Alert.alert('Test Result', 'Stripe connection test would be performed here');
          break;

        case 'backend':
          if (!config.backend.baseUrl || !config.backend.apiKey) {
            Alert.alert('Error', 'Please enter backend URL and API key');
            return;
          }
          // Test backend connection
          const response = await fetch(`${config.backend.baseUrl}/api/v1/health`, {
            headers: { Authorization: `Bearer ${config.backend.apiKey}` },
          });

          if (response.ok) {
            Alert.alert('Success', 'Backend connection successful');
          } else {
            Alert.alert('Error', 'Backend connection failed');
          }
          break;

        default:
          Alert.alert('Info', `${provider} connection test not implemented`);
      }
    } catch (error) {
      Alert.alert('Error', `Failed to test ${provider} connection`);
      logger.error(`${provider} connection test failed:`, error);
    }
  };

  const renderProviderCard = (
    title: string,
    provider: keyof typeof enabledProviders,
    icon: string,
    children: React.ReactNode
  ) => (
    <View style={styles.providerCard}>
      <View style={styles.providerHeader}>
        <View style={styles.providerTitleContainer}>
          <Icon name={icon} size={24} color={Colors.primary} />
          <Text style={styles.providerTitle}>{title}</Text>
        </View>
        <Switch
          value={enabledProviders[provider]}
          onValueChange={(value) => setEnabledProviders((prev) => ({ ...prev, [provider]: value }))}
          trackColor={{ false: Colors.lightGray, true: Colors.primary }}
          thumbColor={enabledProviders[provider] ? Colors.white : Colors.mediumGray}
        />
      </View>
      {enabledProviders[provider] && <View style={styles.providerContent}>{children}</View>}
    </View>
  );

  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Text>Loading configuration...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Icon name="arrow-back" size={24} color={Colors.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Payment Providers</Text>
        <TouchableOpacity onPress={saveConfiguration} style={styles.saveButton}>
          <Icon name="save" size={24} color={Colors.white} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Backend Configuration */}
        {renderProviderCard(
          'Backend API',
          'qrCode',
          'api',
          <>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Backend URL</Text>
              <TextInput
                style={styles.input}
                value={config.backend.baseUrl}
                onChangeText={(text) =>
                  setConfig((prev) => ({ ...prev, backend: { ...prev.backend, baseUrl: text } }))
                }
                placeholder="http://localhost:8000"
                autoCapitalize="none"
              />
            </View>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>API Key</Text>
              <TextInput
                style={styles.input}
                value={config.backend.apiKey}
                onChangeText={(text) =>
                  setConfig((prev) => ({ ...prev, backend: { ...prev.backend, apiKey: text } }))
                }
                placeholder="Enter your API key"
                secureTextEntry
                autoCapitalize="none"
              />
            </View>
            <TouchableOpacity style={styles.testButton} onPress={() => testConnection('backend')}>
              <Icon name="wifi" size={20} color={Colors.white} />
              <Text style={styles.testButtonText}>Test Connection</Text>
            </TouchableOpacity>
          </>
        )}

        {/* Stripe Configuration */}
        {renderProviderCard(
          'Stripe',
          'stripe',
          'credit-card',
          <>
            <View style={styles.feeInfo}>
              <Text style={styles.feeText}>Fee: 1.4% + 20p per transaction</Text>
            </View>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Publishable Key</Text>
              <TextInput
                style={styles.input}
                value={config.stripe.publishableKey}
                onChangeText={(text) =>
                  setConfig((prev) => ({
                    ...prev,
                    stripe: { ...prev.stripe, publishableKey: text },
                  }))
                }
                placeholder="pk_test_..."
                autoCapitalize="none"
              />
            </View>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Merchant ID</Text>
              <TextInput
                style={styles.input}
                value={config.stripe.merchantId}
                onChangeText={(text) =>
                  setConfig((prev) => ({ ...prev, stripe: { ...prev.stripe, merchantId: text } }))
                }
                placeholder="merchant.your.app"
                autoCapitalize="none"
              />
            </View>
            <TouchableOpacity style={styles.testButton} onPress={() => testConnection('stripe')}>
              <Icon name="payment" size={20} color={Colors.white} />
              <Text style={styles.testButtonText}>Test Stripe</Text>
            </TouchableOpacity>
          </>
        )}

        {/* Square Configuration */}
        {renderProviderCard(
          'Square',
          'square',
          'contactless-payment',
          <>
            <View style={styles.feeInfo}>
              <Text style={styles.feeText}>Fee: 1.75% per transaction</Text>
            </View>
            <View style={styles.sdkWarning}>
              <Icon name="warning" size={20} color={Colors.warning} />
              <Text style={styles.warningText}>Square SDK not available in current build</Text>
            </View>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Application ID</Text>
              <TextInput
                style={styles.input}
                value={config.square.applicationId}
                onChangeText={(text) =>
                  setConfig((prev) => ({
                    ...prev,
                    square: { ...prev.square, applicationId: text },
                  }))
                }
                placeholder="sandbox-sq0idb-..."
                autoCapitalize="none"
              />
            </View>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Location ID</Text>
              <TextInput
                style={styles.input}
                value={config.square.locationId}
                onChangeText={(text) =>
                  setConfig((prev) => ({ ...prev, square: { ...prev.square, locationId: text } }))
                }
                placeholder="Location ID"
                autoCapitalize="none"
              />
            </View>
          </>
        )}

        {/* SumUp Configuration */}
        {renderProviderCard(
          'SumUp',
          'sumup',
          'point-of-sale',
          <>
            <View style={styles.feeInfo}>
              <Text style={styles.feeText}>Fee: 0.69% + £19/month (high volume)</Text>
              <Text style={styles.feeSubtext}>Optimal for £2,714+/month volume</Text>
            </View>
            <View style={styles.sdkWarning}>
              <Icon name="warning" size={20} color={Colors.warning} />
              <Text style={styles.warningText}>
                SumUp SDK requires direct integration with SumUp
              </Text>
            </View>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Affiliate Key</Text>
              <TextInput
                style={styles.input}
                value={config.sumup.affiliateKey}
                onChangeText={(text) =>
                  setConfig((prev) => ({ ...prev, sumup: { ...prev.sumup, affiliateKey: text } }))
                }
                placeholder="Your SumUp affiliate key"
                autoCapitalize="none"
              />
            </View>
          </>
        )}

        {/* QR Code Payments */}
        {renderProviderCard(
          'QR Code Payments',
          'qrCode',
          'qr-code',
          <View style={styles.feeInfo}>
            <Text style={styles.feeText}>Fee: 1.2% per transaction</Text>
            <Text style={styles.feeSubtext}>Lowest fees, processed via backend</Text>
          </View>
        )}

        {/* Cash Payments */}
        {renderProviderCard(
          'Cash Payments',
          'cash',
          'payments',
          <View style={styles.feeInfo}>
            <Text style={styles.feeText}>No processing fees</Text>
            <Text style={styles.feeSubtext}>Manual cash handling required</Text>
          </View>
        )}

        {/* Cost Optimization Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Smart Routing</Text>
          <Text style={styles.sectionText}>
            The system automatically selects the most cost-effective payment provider based on
            transaction amount and your monthly volume:
          </Text>
          <View style={styles.optimizationList}>
            <Text style={styles.optimizationItem}>
              • SumUp: Best for high volume (£2,714+/month)
            </Text>
            <Text style={styles.optimizationItem}>• QR Payments: Good balance at 1.2%</Text>
            <Text style={styles.optimizationItem}>• Stripe: Reliable with 1.4% + 20p</Text>
            <Text style={styles.optimizationItem}>• Square: Standard 1.75% rate</Text>
          </View>
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
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
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
  saveButton: {
    padding: 8,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  providerCard: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    marginBottom: 16,
    overflow: 'hidden',
  },
  providerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.lightGray,
  },
  providerTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  providerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text,
    marginLeft: 12,
  },
  providerContent: {
    padding: 16,
  },
  feeInfo: {
    backgroundColor: Colors.background,
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  feeText: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.primary,
  },
  feeSubtext: {
    fontSize: 12,
    color: Colors.lightText,
    marginTop: 4,
  },
  sdkWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF3E0',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  warningText: {
    fontSize: 14,
    color: Colors.warning,
    marginLeft: 8,
    flex: 1,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.text,
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    color: Colors.text,
    backgroundColor: Colors.white,
  },
  testButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.secondary,
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginTop: 8,
  },
  testButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.white,
    marginLeft: 8,
  },
  section: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 12,
  },
  sectionText: {
    fontSize: 14,
    color: Colors.lightText,
    lineHeight: 20,
    marginBottom: 12,
  },
  optimizationList: {
    paddingLeft: 8,
  },
  optimizationItem: {
    fontSize: 14,
    color: Colors.text,
    marginBottom: 6,
  },
});

export default PaymentProviderSettingsScreen;
