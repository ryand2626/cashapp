import React, { useState } from 'react';

import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
} from 'react-native';

import { Picker } from '@react-native-picker/picker';
import Icon from 'react-native-vector-icons/MaterialIcons';

import { SimpleTextInput } from '../../components/inputs';
import { useAuth } from '../../contexts/AuthContext';

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

interface SignUpScreenProps {
  onSwitchToSignIn: () => void;
}

const SignUpScreen: React.FC<SignUpScreenProps> = ({ onSwitchToSignIn }) => {
  const { signUp } = useAuth();

  // User data
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pin, setPin] = useState('');

  // Business data
  const [businessName, setBusinessName] = useState('');
  const [businessAddress, setBusinessAddress] = useState('');
  const [businessPhone, setBusinessPhone] = useState('');
  const [businessEmail, setBusinessEmail] = useState('');
  const [businessType, setBusinessType] = useState<'restaurant' | 'retail' | 'service' | 'other'>(
    'retail'
  );
  const [vatNumber, setVatNumber] = useState('');

  const [currentStep, setCurrentStep] = useState(1);
  const [showPassword, _setShowPassword] = useState(false);
  const [showConfirmPassword, _setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  const validateStep1 = () => {
    const newErrors: Record<string, string> = {};

    if (!firstName.trim()) newErrors.firstName = 'First name is required';
    if (!lastName.trim()) newErrors.lastName = 'Last name is required';
    if (!email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!email.includes('@')) {
      newErrors.email = 'Please enter a valid email address';
    }
    if (!phone.trim()) newErrors.phone = 'Phone number is required';
    if (!password.trim()) {
      newErrors.password = 'Password is required';
    } else if (password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters';
    }
    if (password !== confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }
    if (!pin.trim()) {
      newErrors.pin = 'PIN is required';
    } else if (pin.length !== 4 || !/^\d{4}$/.test(pin)) {
      newErrors.pin = 'PIN must be exactly 4 digits';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateStep2 = () => {
    const newErrors: Record<string, string> = {};

    if (!businessName.trim()) newErrors.businessName = 'Business name is required';
    if (!businessAddress.trim()) newErrors.businessAddress = 'Business address is required';
    if (!businessPhone.trim()) newErrors.businessPhone = 'Business phone is required';
    if (!acceptedTerms) newErrors.terms = 'You must accept the terms and conditions';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (currentStep === 1 && validateStep1()) {
      setCurrentStep(2);
      setErrors({});
    }
  };

  const handleBack = () => {
    if (currentStep === 2) {
      setCurrentStep(1);
      setErrors({});
    }
  };

  const handleSignUp = async () => {
    if (!validateStep2()) return;

    setIsLoading(true);
    try {
      const userData = {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim().toLowerCase(),
        phone: phone.trim(),
        pin: pin.trim(),
      };

      const businessData = {
        name: businessName.trim(),
        address: businessAddress.trim(),
        phone: businessPhone.trim(),
        email: businessEmail.trim() || email.trim(),
        type: businessType,
        vatNumber: vatNumber.trim(),
      };

      const success = await signUp(userData, businessData, password);

      if (!success) {
        Alert.alert(
          'Registration Failed',
          'An account with this email already exists. Please use a different email or sign in instead.',
          [{ text: 'OK' }]
        );
      }
    } catch (_error) {
      Alert.alert('Error', 'An unexpected error occurred during registration. Please try again.', [
        { text: 'OK' },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const businessTypes = [
    { label: 'Retail Store', value: 'retail' },
    { label: 'Restaurant/Café', value: 'restaurant' },
    { label: 'Service Business', value: 'service' },
    { label: 'Other', value: 'other' },
  ];

  const renderStep1 = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>Personal Information</Text>
      <Text style={styles.stepDescription}>Tell us about yourself</Text>

      <View style={styles.row}>
        <View style={[styles.inputContainer, { flex: 1, marginRight: 8 }]}>
          {/* The Icon was previously rendered here, SimpleTextInput might handle icons internally or not at all based on new spec */}
          <SimpleTextInput
            label="First Name *"
            value={firstName}
            onValueChange={(text) => {
              setFirstName(text);
              if (errors.firstName) setErrors((prev) => ({ ...prev, firstName: '' }));
            }}
            placeholder="John"
            autoCapitalize="words"
            // Assuming error state is handled internally by SimpleTextInput if errors.firstName is truthy
            // containerStyle={{ marginBottom: 0 }} // Retained if styles.inputContainer provides necessary spacing
          />
          {errors.firstName && <Text style={styles.errorText}>{errors.firstName}</Text>}
        </View>

        <View style={[styles.inputContainer, { flex: 1, marginLeft: 8 }]}>
          {/* The Icon was previously rendered here */}
          <SimpleTextInput
            label="Last Name *"
            value={lastName}
            onValueChange={(text) => {
              setLastName(text);
              if (errors.lastName) setErrors((prev) => ({ ...prev, lastName: '' }));
            }}
            placeholder="Smith"
            autoCapitalize="words"
            // containerStyle={{ marginBottom: 0 }}
          />
          {errors.lastName && <Text style={styles.errorText}>{errors.lastName}</Text>}
        </View>
      </View>

      <View style={styles.inputContainer}>
        <SimpleTextInput
          label="Email Address *"
          value={email}
          onValueChange={(text) => {
            setEmail(text);
            if (errors.email) setErrors((prev) => ({ ...prev, email: '' }));
          }}
          placeholder="john@example.com"
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
        />
        {errors.email && <Text style={styles.errorText}>{errors.email}</Text>}
      </View>

      <View style={styles.inputContainer}>
        <SimpleTextInput
          label="Phone Number *"
          value={phone}
          onValueChange={(text) => {
            setPhone(text);
            if (errors.phone) setErrors((prev) => ({ ...prev, phone: '' }));
          }}
          placeholder="+44 7700 900123"
          keyboardType="phone-pad"
        />
        {errors.phone && <Text style={styles.errorText}>{errors.phone}</Text>}
      </View>

      <View style={styles.inputContainer}>
        <SimpleTextInput
          label="Password *"
          value={password}
          onValueChange={(text) => {
            setPassword(text);
            if (errors.password) setErrors((prev) => ({ ...prev, password: '' }));
          }}
          placeholder="At least 8 characters"
          secure={!showPassword} // Use 'secure' prop
        />
        {/* Note: Password visibility toggle icon is removed as SimpleTextInput spec does not include rightIcon */}
        {/* Consider adding a separate button for visibility if required by UX and not handled by SimpleTextInput */}
        {errors.password && <Text style={styles.errorText}>{errors.password}</Text>}
      </View>

      <View style={styles.inputContainer}>
        <SimpleTextInput
          label="Confirm Password *"
          value={confirmPassword}
          onValueChange={(text) => {
            setConfirmPassword(text);
            if (errors.confirmPassword) setErrors((prev) => ({ ...prev, confirmPassword: '' }));
          }}
          placeholder="Repeat your password"
          secure={!showConfirmPassword} // Use 'secure' prop
        />
        {/* Note: Password visibility toggle icon is removed */}
        {errors.confirmPassword && <Text style={styles.errorText}>{errors.confirmPassword}</Text>}
      </View>

      <View style={styles.inputContainer}>
        <SimpleTextInput
          label="4-Digit PIN *"
          value={pin}
          onValueChange={(text) => {
            setPin(text.replace(/[^0-9]/g, '').slice(0, 4));
            if (errors.pin) setErrors((prev) => ({ ...prev, pin: '' }));
          }}
          placeholder="1234"
          keyboardType="numeric"
          maxLength={4}
          secure // Use 'secure' prop
        />
        {/* helpText was originally a separate Text component, keeping it that way. */}
        <Text style={styles.helpText}>Used for quick access and secure transactions</Text>
        {errors.pin && <Text style={styles.errorText}>{errors.pin}</Text>}
      </View>
    </View>
  );

  const renderStep2 = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>Business Information</Text>
      <Text style={styles.stepDescription}>Set up your business profile</Text>

      <View style={styles.inputContainer}>
        <SimpleTextInput
          label="Business Name *"
          value={businessName}
          onValueChange={(text) => {
            setBusinessName(text);
            if (errors.businessName) setErrors((prev) => ({ ...prev, businessName: '' }));
          }}
          placeholder="Your Business Name"
          autoCapitalize="words"
        />
        {errors.businessName && <Text style={styles.errorText}>{errors.businessName}</Text>}
      </View>

      <View style={styles.inputContainer}>
        <Text style={styles.inputLabel}>Business Type *</Text>
        <View style={styles.pickerWrapper}>
          <Icon name="category" size={20} color={Colors.mediumGray} />
          <Picker
            style={styles.picker}
            selectedValue={businessType}
            onValueChange={(value) => setBusinessType(value)}
          >
            {businessTypes.map((type) => (
              <Picker.Item key={type.value} label={type.label} value={type.value} />
            ))}
          </Picker>
        </View>
      </View>

      <View style={styles.inputContainer}>
        <SimpleTextInput
          label="Business Address *"
          value={businessAddress}
          onValueChange={(text) => {
            setBusinessAddress(text);
            if (errors.businessAddress) setErrors((prev) => ({ ...prev, businessAddress: '' }));
          }}
          placeholder="123 High Street, London, SW1A 1AA"
          multiline
          numberOfLines={2}
        />
        {errors.businessAddress && <Text style={styles.errorText}>{errors.businessAddress}</Text>}
      </View>

      <View style={styles.inputContainer}>
        <SimpleTextInput
          label="Business Phone *"
          value={businessPhone}
          onValueChange={(text) => {
            setBusinessPhone(text);
            if (errors.businessPhone) setErrors((prev) => ({ ...prev, businessPhone: '' }));
          }}
          placeholder="+44 20 7946 0958"
          keyboardType="phone-pad"
        />
        {errors.businessPhone && <Text style={styles.errorText}>{errors.businessPhone}</Text>}
      </View>

      <View style={styles.inputContainer}>
        <SimpleTextInput
          label="Business Email"
          value={businessEmail}
          onValueChange={setBusinessEmail}
          placeholder="contact@yourbusiness.com (optional)"
          keyboardType="email-address"
          autoCapitalize="none"
        />
        {/* helpText was originally a separate Text component, keeping it that way. */}
        <Text style={styles.helpText}>Leave blank to use your personal email</Text>
      </View>

      <View style={styles.inputContainer}>
        <SimpleTextInput
          label="VAT Number"
          value={vatNumber}
          onValueChange={setVatNumber}
          placeholder="GB123456789 (optional)"
          autoCapitalize="characters"
        />
        {/* helpText was originally a separate Text component, keeping it that way. */}
        <Text style={styles.helpText}>Required for VAT-registered businesses</Text>
      </View>

      {/* Terms and Conditions */}
      <TouchableOpacity
        style={styles.termsContainer}
        onPress={() => setAcceptedTerms(!acceptedTerms)}
      >
        <Icon
          name={acceptedTerms ? 'check-box' : 'check-box-outline-blank'}
          size={24}
          color={acceptedTerms ? Colors.primary : Colors.mediumGray}
        />
        <View style={styles.termsTextContainer}>
          <Text style={styles.termsText}>
            I accept the <Text style={styles.termsLink}>Terms and Conditions</Text> and{' '}
            <Text style={styles.termsLink}>Privacy Policy</Text>
          </Text>
          {errors.terms && <Text style={styles.errorText}>{errors.terms}</Text>}
        </View>
      </TouchableOpacity>
    </View>
  );

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Icon name="storefront" size={48} color={Colors.primary} />
          <Text style={styles.title}>Create Account</Text>
          <Text style={styles.subtitle}>Join thousands of businesses using Fynlo POS</Text>
        </View>

        {/* Progress Indicator */}
        <View style={styles.progressContainer}>
          <View style={styles.progressBar}>
            <View style={[styles.progressStep, currentStep >= 1 && styles.progressStepActive]}>
              <Text
                style={[styles.progressStepText, currentStep >= 1 && styles.progressStepTextActive]}
              >
                1
              </Text>
            </View>
            <View style={[styles.progressLine, currentStep >= 2 && styles.progressLineActive]} />
            <View style={[styles.progressStep, currentStep >= 2 && styles.progressStepActive]}>
              <Text
                style={[styles.progressStepText, currentStep >= 2 && styles.progressStepTextActive]}
              >
                2
              </Text>
            </View>
          </View>
          <View style={styles.progressLabels}>
            <Text style={styles.progressLabel}>Personal</Text>
            <Text style={styles.progressLabel}>Business</Text>
          </View>
        </View>

        {/* Form */}
        <View style={styles.formContainer}>
          {currentStep === 1 ? renderStep1() : renderStep2()}

          {/* Navigation Buttons */}
          <View style={styles.navigationContainer}>
            {currentStep === 2 && (
              <TouchableOpacity style={styles.backButton} onPress={handleBack}>
                <Icon name="arrow-back" size={20} color={Colors.secondary} />
                <Text style={styles.backButtonText}>Back</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={[styles.nextButton, isLoading && styles.nextButtonDisabled]}
              onPress={currentStep === 1 ? handleNext : handleSignUp}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color={Colors.white} />
              ) : (
                <>
                  <Text style={styles.nextButtonText}>
                    {currentStep === 1 ? 'Next' : 'Create Account'}
                  </Text>
                  <Icon
                    name={currentStep === 1 ? 'arrow-forward' : 'check'}
                    size={20}
                    color={Colors.white}
                  />
                </>
              )}
            </TouchableOpacity>
          </View>

          {/* Sign In Link */}
          <View style={styles.signInContainer}>
            <Text style={styles.signInText}>Already have an account? </Text>
            <TouchableOpacity onPress={onSwitchToSignIn} disabled={isLoading}>
              <Text style={styles.signInLinkText}>Sign In</Text>
            </TouchableOpacity>
          </View>
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
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 32,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: Colors.primary,
    marginTop: 12,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: Colors.lightText,
    textAlign: 'center',
  },
  progressContainer: {
    marginBottom: 32,
  },
  progressBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  progressStep: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.lightGray,
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressStepActive: {
    backgroundColor: Colors.primary,
  },
  progressStepText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: Colors.mediumGray,
  },
  progressStepTextActive: {
    color: Colors.white,
  },
  progressLine: {
    width: 60,
    height: 2,
    backgroundColor: Colors.lightGray,
    marginHorizontal: 8,
  },
  progressLineActive: {
    backgroundColor: Colors.primary,
  },
  progressLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  progressLabel: {
    fontSize: 12,
    color: Colors.lightText,
  },
  formContainer: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  stepContainer: {
    marginBottom: 24,
  },
  stepTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 8,
    textAlign: 'center',
  },
  stepDescription: {
    fontSize: 16,
    color: Colors.lightText,
    marginBottom: 24,
    textAlign: 'center',
  },
  row: {
    flexDirection: 'row',
  },
  inputContainer: {
    marginBottom: 20,
  },
  textArea: {
    minHeight: 60,
    textAlignVertical: 'top',
  },
  pickerWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background,
    borderRadius: 8,
    paddingLeft: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 12,
  },
  picker: {
    flex: 1,
    height: 48,
  },
  errorText: {
    fontSize: 14,
    color: Colors.danger,
    marginTop: 4,
  },
  helpText: {
    fontSize: 12,
    color: Colors.lightText,
    marginTop: 4,
  },
  termsContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 16,
    gap: 8,
  },
  termsTextContainer: {
    flex: 1,
  },
  termsText: {
    fontSize: 14,
    color: Colors.text,
    lineHeight: 20,
  },
  termsLink: {
    color: Colors.secondary,
    fontWeight: '500',
  },
  navigationContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    gap: 16,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 8,
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: Colors.secondary,
  },
  nextButton: {
    flex: 1,
    backgroundColor: Colors.primary,
    borderRadius: 8,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  nextButtonDisabled: {
    opacity: 0.7,
  },
  nextButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.white,
  },
  signInContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 24,
  },
  signInText: {
    fontSize: 16,
    color: Colors.lightText,
  },
  signInLinkText: {
    fontSize: 16,
    color: Colors.primary,
    fontWeight: '500',
  },
});

export default SignUpScreen;
