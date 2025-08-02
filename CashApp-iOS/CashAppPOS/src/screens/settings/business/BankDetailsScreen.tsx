import React, { useState, useEffect } from 'react';

import {
  StyleSheet,
  Text,
  View,
  StatusBar,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';

import { useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialIcons';

import { SimpleTextInput } from '../../../components/inputs'; // Assuming SimpleDecimalInput not needed for now
import Colors from '../../../constants/Colors';
import { useAuth } from '../../../contexts/AuthContext';

interface BankDetails {
  accountHolderName: string;
  bankName: string;
  accountNumber: string;
  sortCode: string;
  iban?: string;
  swiftCode?: string;
  accountType: 'business' | 'personal';
  currency: string;
  primaryAccount: boolean;
}

const BankDetailsScreen: React.FC = () => {
  const navigation = useNavigation();
  const { _user } = useAuth();

  const [bankDetails, setBankDetails] = useState<BankDetails>({
    accountHolderName: '',
    bankName: '',
    accountNumber: '',
    sortCode: '',
    iban: '',
    swiftCode: '',
    accountType: 'business',
    currency: 'GBP',
    primaryAccount: true,
  });

  const [isLoading, setIsLoading] = useState(false);
  const [hasExistingDetails, setHasExistingDetails] = useState(false);

  useEffect(() => {
    loadBankDetails();
  }, []);

  const loadBankDetails = async () => {
    try {
      // In real implementation, this would fetch from API
      // For now, we'll simulate checking if details exist
      const existingDetails = await getMockBankDetails();
      if (existingDetails) {
        setBankDetails(existingDetails);
        setHasExistingDetails(true);
      }
    } catch (error) {
      logger.error('Failed to load bank details:', error);
    }
  };

  const getMockBankDetails = async (): Promise<BankDetails | null> => {
    // Simulate API call - return mock data if restaurant has saved details
    return new Promise((resolve) => {
      setTimeout(() => {
        // Return null for new setup, or mock data for existing
        resolve({
          accountHolderName: 'Taco Libre Ltd',
          bankName: 'Lloyds Bank',
          accountNumber: '12345678',
          sortCode: '30-99-88',
          iban: 'GB29 LOYD 3099 8812 3456 78',
          swiftCode: 'LOYDGB2L',
          accountType: 'business',
          currency: 'GBP',
          primaryAccount: true,
        });
      }, 1000);
    });
  };

  const handleSave = async () => {
    // Validate required fields
    if (
      !bankDetails.accountHolderName.trim() ||
      !bankDetails.bankName.trim() ||
      !bankDetails.accountNumber.trim() ||
      !bankDetails.sortCode.trim()
    ) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    // Validate sort code format (XX-XX-XX)
    const sortCodeRegex = /^\d{2}-\d{2}-\d{2}$/;
    if (!sortCodeRegex.test(bankDetails.sortCode)) {
      Alert.alert('Error', 'Sort code must be in format XX-XX-XX');
      return;
    }

    // Validate account number (8 digits for UK)
    if (bankDetails.accountNumber.length !== 8 || !/^\d+$/.test(bankDetails.accountNumber)) {
      Alert.alert('Error', 'Account number must be 8 digits');
      return;
    }

    setIsLoading(true);

    try {
      // In real implementation, this would save to API
      await saveBankDetails(bankDetails);

      Alert.alert(
        'Success',
        hasExistingDetails
          ? 'Bank details updated successfully'
          : 'Bank details saved successfully',
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    } catch (error) {
      logger.error('Failed to save bank details:', error);
      Alert.alert('Error', 'Failed to save bank details. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const saveBankDetails = async (details: BankDetails): Promise<void> => {
    // Simulate API call
    return new Promise((resolve) => {
      setTimeout(() => {
        logger.info('Bank details saved:', details);
        resolve();
      }, 1500);
    });
  };

  const formatSortCode = (text: string) => {
    // Remove all non-digits
    const digits = text.replace(/\D/g, '');

    // Add hyphens automatically
    if (digits.length <= 2) return digits;
    if (digits.length <= 4) return `${digits.slice(0, 2)}-${digits.slice(2)}`;
    return `${digits.slice(0, 2)}-${digits.slice(2, 4)}-${digits.slice(4, 6)}`;
  };

  const handleSortCodeChange = (text: string) => {
    const formatted = formatSortCode(text);
    setBankDetails({ ...bankDetails, sortCode: formatted });
  };

  const handleAccountNumberChange = (text: string) => {
    // Only allow digits and limit to 8 characters
    const digits = text.replace(/\D/g, '').slice(0, 8);
    setBankDetails({ ...bankDetails, accountNumber: digits });
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar backgroundColor={Colors.primary} barStyle="light-content" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Icon name="arrow-back" size={24} color={Colors.white} />
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Bank Details</Text>
          <Text style={styles.headerSubtitle}>
            {hasExistingDetails ? 'Update payment details' : 'Set up payment receiving'}
          </Text>
        </View>

        <TouchableOpacity style={styles.saveButton} onPress={handleSave} disabled={isLoading}>
          <Text style={styles.saveButtonText}>{isLoading ? 'Saving...' : 'Save'}</Text>
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          style={styles.scrollView}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Security Notice */}
          <View style={styles.securityNotice}>
            <Icon name="security" size={24} color={Colors.secondary} />
            <View style={styles.securityContent}>
              <Text style={styles.securityTitle}>Secure & Encrypted</Text>
              <Text style={styles.securityText}>
                Your banking information is encrypted and stored securely. This information is used
                only for receiving payments from the platform.
              </Text>
            </View>
          </View>

          {/* Account Holder Name */}
          <View style={styles.formGroup}>
            <SimpleTextInput
              label="Account Holder Name *"
              placeholder="Enter the name on the bank account"
              value={bankDetails.accountHolderName}
              onValueChange={(text) => setBankDetails({ ...bankDetails, accountHolderName: text })}
              autoCapitalize="words"
              placeholderTextColor={Colors.darkGray}
              // containerStyle prop can be used for styles.formGroup if needed for spacing only
            />
          </View>

          {/* Bank Name */}
          <View style={styles.formGroup}>
            <SimpleTextInput
              label="Bank Name *"
              placeholder="e.g., Lloyds Bank, Barclays, HSBC"
              value={bankDetails.bankName}
              onValueChange={(text) => setBankDetails({ ...bankDetails, bankName: text })}
              autoCapitalize="words"
              placeholderTextColor={Colors.darkGray}
            />
          </View>

          {/* Account Number */}
          <View style={styles.formGroup}>
            <SimpleTextInput
              label="Account Number *"
              placeholder="8-digit account number"
              value={bankDetails.accountNumber}
              onValueChange={handleAccountNumberChange}
              keyboardType="number-pad"
              maxLength={8}
              placeholderTextColor={Colors.darkGray}
            />
          </View>

          {/* Sort Code */}
          <View style={styles.formGroup}>
            <SimpleTextInput
              label="Sort Code *"
              placeholder="XX-XX-XX"
              value={bankDetails.sortCode}
              onValueChange={handleSortCodeChange}
              keyboardType="number-pad"
              maxLength={8}
              placeholderTextColor={Colors.darkGray}
            />
          </View>

          {/* IBAN (Optional) */}
          <View style={styles.formGroup}>
            <SimpleTextInput
              label="IBAN (Optional)"
              placeholder="GB29 LOYD 3099 8812 3456 78"
              value={bankDetails.iban}
              onValueChange={(text) => setBankDetails({ ...bankDetails, iban: text.toUpperCase() })}
              autoCapitalize="characters"
              placeholderTextColor={Colors.darkGray}
            />
          </View>

          {/* SWIFT Code (Optional) */}
          <View style={styles.formGroup}>
            <SimpleTextInput
              label="SWIFT/BIC Code (Optional)"
              placeholder="e.g., LOYDGB2L"
              value={bankDetails.swiftCode}
              onValueChange={(text) =>
                setBankDetails({ ...bankDetails, swiftCode: text.toUpperCase() })
              }
              autoCapitalize="characters"
              placeholderTextColor={Colors.darkGray}
            />
          </View>

          {/* Account Type */}
          <View style={styles.formGroup}>
            <Text style={styles.formLabel}>Account Type</Text>
            <View style={styles.accountTypeSelector}>
              <TouchableOpacity
                style={[
                  styles.accountTypeOption,
                  bankDetails.accountType === 'business' && styles.accountTypeOptionSelected,
                ]}
                onPress={() => setBankDetails({ ...bankDetails, accountType: 'business' })}
              >
                <Icon
                  name="business"
                  size={20}
                  color={bankDetails.accountType === 'business' ? Colors.white : Colors.primary}
                />
                <Text
                  style={[
                    styles.accountTypeText,
                    bankDetails.accountType === 'business' && styles.accountTypeTextSelected,
                  ]}
                >
                  Business Account
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.accountTypeOption,
                  bankDetails.accountType === 'personal' && styles.accountTypeOptionSelected,
                ]}
                onPress={() => setBankDetails({ ...bankDetails, accountType: 'personal' })}
              >
                <Icon
                  name="person"
                  size={20}
                  color={bankDetails.accountType === 'personal' ? Colors.white : Colors.primary}
                />
                <Text
                  style={[
                    styles.accountTypeText,
                    bankDetails.accountType === 'personal' && styles.accountTypeTextSelected,
                  ]}
                >
                  Personal Account
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Payment Schedule Info */}
          <View style={styles.infoSection}>
            <Text style={styles.infoTitle}>Payment Schedule</Text>
            <View style={styles.infoItem}>
              <Icon name="schedule" size={20} color={Colors.secondary} />
              <Text style={styles.infoText}>Payments are processed weekly on Fridays</Text>
            </View>
            <View style={styles.infoItem}>
              <Icon name="account-balance" size={20} color={Colors.secondary} />
              <Text style={styles.infoText}>Funds typically arrive within 1-2 business days</Text>
            </View>
            <View style={styles.infoItem}>
              <Icon name="receipt" size={20} color={Colors.secondary} />
              <Text style={styles.infoText}>
                Detailed payment reports available in your dashboard
              </Text>
            </View>
          </View>

          {/* Footer Padding */}
          <View style={styles.footerPadding} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
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
    paddingHorizontal: 16,
    paddingVertical: 12,
    height: 70,
  },
  backButton: {
    padding: 8,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.white,
  },
  headerSubtitle: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: 2,
  },
  saveButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.white,
  },
  keyboardView: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
    padding: 16,
  },
  securityNotice: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    flexDirection: 'row',
    alignItems: 'flex-start',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  securityContent: {
    flex: 1,
    marginLeft: 12,
  },
  securityTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 4,
  },
  securityText: {
    fontSize: 14,
    color: Colors.darkGray,
    lineHeight: 20,
  },
  formGroup: {
    marginBottom: 20,
  },
  formLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 8,
  },
  formInput: {
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: Colors.text,
  },
  accountTypeSelector: {
    flexDirection: 'row',
    gap: 12,
  },
  accountTypeOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.white,
    borderWidth: 2,
    borderColor: Colors.primary,
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  accountTypeOptionSelected: {
    backgroundColor: Colors.primary,
  },
  accountTypeText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.primary,
    marginLeft: 8,
  },
  accountTypeTextSelected: {
    color: Colors.white,
  },
  infoSection: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 16,
    marginTop: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 12,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    color: Colors.darkGray,
    marginLeft: 12,
    flex: 1,
  },
  footerPadding: {
    height: 40,
  },
});

export default BankDetailsScreen;
