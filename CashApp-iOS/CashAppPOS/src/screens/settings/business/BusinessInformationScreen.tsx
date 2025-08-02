import React, { useState, useRef, useEffect } from 'react';

import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  _TextInput,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';

import Icon from 'react-native-vector-icons/MaterialIcons';

import SimpleTextInput from '../../../components/inputs/SimpleTextInput';
import { SettingsHeader, SettingsSection, _SettingsCard } from '../../../components/settings';
import { useRestaurantConfig } from '../../../hooks/useRestaurantConfig';
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

interface FormField {
  id: string;
  label: string;
  placeholder: string;
  value: string;
  keyboardType?: 'default' | 'email-address' | 'phone-pad' | 'url';
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  required?: boolean;
  validation?: (value: string) => string | null;
}

const BusinessInformationScreen: React.FC = () => {
  const { businessInfo, updateBusinessInfo, isLoading } = useSettingsStore();
  const { config, updateConfig, completeSetupStep } = useRestaurantConfig();
  const [formData, setFormData] = useState(businessInfo);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [hasChanges, setHasChanges] = useState(false);

  const scrollViewRef = useRef<ScrollView>(null);

  // Load restaurant config data when available
  useEffect(() => {
    if (config && config.restaurantName) {
      // Sync restaurant config with form data if restaurant config exists
      setFormData((prev) => ({
        ...prev,
        companyName: config.restaurantName,
        phone: config.phone || prev.phone,
        email: config.email || prev.email,
        address: config.address?.street || prev.address,
        city: config.address?.city || prev.city,
        postalCode: config.address?.zipCode || prev.postalCode,
        country: config.address?.country || prev.country,
      }));
    }
  }, [config]);

  // Validation functions
  const validateEmail = (email: string): string | null => {
    if (!email) return 'Email is required';
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email) ? null : 'Please enter a valid email address';
  };

  const validatePhone = (phone: string): string | null => {
    if (!phone) return 'Phone number is required';
    const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/;
    return phoneRegex.test(phone.replace(/\s/g, '')) ? null : 'Please enter a valid phone number';
  };

  const validateUrl = (url: string): string | null => {
    if (!url) return null; // Website is optional
    const urlRegex = /^(https?:\/\/)?([\da-z\.-]+)\.([a-z\.]{2,6})([\/\w \.-]*)*\/?$/;
    return urlRegex.test(url) ? null : 'Please enter a valid website URL';
  };

  const validateVatNumber = (vat: string): string | null => {
    if (!vat) return null; // VAT number is optional
    // UK VAT number format: GB followed by 9 or 12 digits
    const ukVatRegex = /^GB[0-9]{9}([0-9]{3})?$/;
    return ukVatRegex.test(vat) ? null : 'Please enter a valid UK VAT number (GB123456789)';
  };

  const validateCompanyNumber = (number: string): string | null => {
    if (!number) return null; // Company number is optional
    // UK Company number: 8 digits
    const ukCompanyRegex = /^[0-9]{8}$/;
    return ukCompanyRegex.test(number) ? null : 'Please enter a valid UK company number (8 digits)';
  };

  const formFields: FormField[] = [
    {
      id: 'companyName',
      label: 'Company Name *',
      placeholder: 'Enter your company name',
      value: formData.companyName,
      autoCapitalize: 'words',
      required: true,
      validation: (value) => (value.trim() ? null : 'Company name is required'),
    },
    {
      id: 'address',
      label: 'Address *',
      placeholder: 'Enter your business address',
      value: formData.address,
      autoCapitalize: 'words',
      required: true,
      validation: (value) => (value.trim() ? null : 'Address is required'),
    },
    {
      id: 'city',
      label: 'City *',
      placeholder: 'Enter your city',
      value: formData.city,
      autoCapitalize: 'words',
      required: true,
      validation: (value) => (value.trim() ? null : 'City is required'),
    },
    {
      id: 'postalCode',
      label: 'Postal Code *',
      placeholder: 'Enter your postal code',
      value: formData.postalCode,
      autoCapitalize: 'characters',
      required: true,
      validation: (value) => (value.trim() ? null : 'Postal code is required'),
    },
    {
      id: 'country',
      label: 'Country *',
      placeholder: 'Enter your country',
      value: formData.country,
      autoCapitalize: 'words',
      required: true,
      validation: (value) => (value.trim() ? null : 'Country is required'),
    },
    {
      id: 'phone',
      label: 'Phone Number *',
      placeholder: '+44 20 7123 4567',
      value: formData.phone,
      keyboardType: 'phone-pad',
      required: true,
      validation: validatePhone,
    },
    {
      id: 'email',
      label: 'Email Address *',
      placeholder: 'info@yourcompany.co.uk',
      value: formData.email,
      keyboardType: 'email-address',
      autoCapitalize: 'none',
      required: true,
      validation: validateEmail,
    },
    {
      id: 'website',
      label: 'Website',
      placeholder: 'www.yourcompany.co.uk',
      value: formData.website,
      keyboardType: 'url',
      autoCapitalize: 'none',
      validation: validateUrl,
    },
    {
      id: 'vatNumber',
      label: 'VAT Number',
      placeholder: 'GB123456789',
      value: formData.vatNumber,
      autoCapitalize: 'characters',
      validation: validateVatNumber,
    },
    {
      id: 'companyNumber',
      label: 'Company Number',
      placeholder: '12345678',
      value: formData.companyNumber,
      validation: validateCompanyNumber,
    },
  ];

  const handleFieldChange = (fieldId: string, value: string) => {
    setFormData((prev) => ({ ...prev, [fieldId]: value }));
    setHasChanges(true);

    // Clear error when user starts typing
    if (errors[fieldId]) {
      setErrors((prev) => ({ ...prev, [fieldId]: '' }));
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    formFields.forEach((field) => {
      if (field.validation) {
        const error = field.validation(formData[field.id as keyof typeof formData] as string);
        if (error) {
          newErrors[field.id] = error;
        }
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validateForm()) {
      Alert.alert('Validation Error', 'Please correct the errors in the form before saving.', [
        { text: 'OK' },
      ]);
      return;
    }

    try {
      // Save to existing settings store
      updateBusinessInfo(formData);

      // Also save to restaurant configuration system
      await updateConfig({
        restaurantName: formData.companyName,
        displayName: formData.companyName, // Use company name as display name
        phone: formData.phone,
        email: formData.email,
        address: {
          street: formData.address,
          city: formData.city,
          state: '', // Not in current form
          zipCode: formData.postalCode,
          country: formData.country,
        },
      });

      // Mark restaurant info setup step as completed
      await completeSetupStep('restaurantInfo');

      setHasChanges(false);
      Alert.alert(
        'Success',
        'Business information has been saved successfully. The restaurant name will now appear in your headers.',
        [{ text: 'OK' }]
      );
    } catch (_error) {
      Alert.alert('Error', 'Failed to save business information. Please try again.', [
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
          setFormData(businessInfo);
          setErrors({});
          setHasChanges(false);
        },
      },
    ]);
  };

  const renderFormField = (field: FormField) => (
    <View key={field.id} style={styles.fieldContainer}>
      <SimpleTextInput
        label={field.label}
        value={field.value}
        onValueChange={(value) => handleFieldChange(field.id, value)}
        placeholder={field.placeholder}
        keyboardType={field.keyboardType || 'default'}
        autoCapitalize={field.autoCapitalize || 'sentences'}
        autoCorrect={false}
        style={[styles.textInput, errors[field.id] && styles.textInputError]}
        clearButtonMode="while-editing"
      />
      {errors[field.id] && (
        <View style={styles.errorContainer}>
          <Icon name="error-outline" size={16} color={Colors.danger} />
          <Text style={styles.errorText}>{errors[field.id]}</Text>
        </View>
      )}
    </View>
  );

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <SettingsHeader
        title="Business Information"
        subtitle="Company details and contact information"
        rightAction={{
          icon: 'save',
          onPress: handleSave,
          color: hasChanges ? Colors.white : 'rgba(255, 255, 255, 0.5)',
        }}
      />

      <ScrollView
        ref={scrollViewRef}
        style={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <SettingsSection title="Company Details" subtitle="Basic information about your business">
          <View style={styles.formContainer}>{formFields.slice(0, 5).map(renderFormField)}</View>
        </SettingsSection>

        <SettingsSection title="Contact Information" subtitle="How customers can reach you">
          <View style={styles.formContainer}>{formFields.slice(5, 8).map(renderFormField)}</View>
        </SettingsSection>

        <SettingsSection title="Legal Information" subtitle="VAT and company registration details">
          <View style={styles.formContainer}>{formFields.slice(8).map(renderFormField)}</View>
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

        {/* Help Text */}
        <View style={styles.helpContainer}>
          <Icon name="info-outline" size={16} color={Colors.mediumGray} />
          <Text style={styles.helpText}>
            This information will appear on receipts and customer communications. Fields marked with
            * are required.
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
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
  formContainer: {
    padding: 16,
  },
  fieldContainer: {
    marginBottom: 20,
  },
  fieldLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: Colors.text,
    marginBottom: 8,
  },
  textInput: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: Colors.text,
    backgroundColor: Colors.white,
  },
  textInputError: {
    borderColor: Colors.danger,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  errorText: {
    fontSize: 14,
    color: Colors.danger,
    marginLeft: 4,
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
  helpContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 16,
    backgroundColor: 'rgba(0, 166, 81, 0.05)',
    marginHorizontal: 16,
    marginBottom: 32,
    borderRadius: 8,
  },
  helpText: {
    fontSize: 14,
    color: Colors.mediumGray,
    marginLeft: 8,
    flex: 1,
    lineHeight: 20,
  },
});

export default BusinessInformationScreen;
