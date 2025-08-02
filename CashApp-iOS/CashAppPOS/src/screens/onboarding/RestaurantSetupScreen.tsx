import React, { useState } from 'react';

import {
  StyleSheet,
  Text,
  View,
  StatusBar,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';

import { useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialIcons';

import { useRestaurantConfig } from '../../hooks/useRestaurantConfig';

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

interface RestaurantFormData {
  restaurantName: string;
  displayName: string;
  businessType: string;
  phone: string;
  email: string;
  street: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
}

const RestaurantSetupScreen: React.FC = () => {
  const navigation = useNavigation();
  const { updateConfig, completeSetupStep } = useRestaurantConfig();

  const [formData, setFormData] = useState<RestaurantFormData>({
    restaurantName: '',
    displayName: '',
    businessType: 'Restaurant',
    phone: '',
    email: '',
    street: '',
    city: '',
    state: '',
    zipCode: '',
    country: 'United Kingdom',
  });

  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);

  const businessTypes = [
    'Restaurant',
    'Fast Food',
    'Cafe',
    'Bar & Pub',
    'Food Truck',
    'Bakery',
    'Pizzeria',
    'Bistro',
    'Fine Dining',
    'Other',
  ];

  const updateField = (field: keyof RestaurantFormData, value: string) => {
    setFormData((prev) => {
      const updated = { ...prev, [field]: value };

      // Auto-generate display name from restaurant name if not manually set
      if (field === 'restaurantName' && !prev.displayName) {
        updated.displayName = value;
      }

      return updated;
    });
  };

  const validateStep = (step: number): boolean => {
    switch (step) {
      case 1:
        return !!(formData.restaurantName && formData.displayName && formData.businessType);
      case 2:
        return !!(formData.phone && formData.email);
      case 3:
        return !!(formData.street && formData.city && formData.zipCode);
      default:
        return true;
    }
  };

  const nextStep = () => {
    if (!validateStep(currentStep)) {
      Alert.alert('Missing Information', 'Please fill in all required fields before continuing.');
      return;
    }

    if (currentStep < 3) {
      setCurrentStep(currentStep + 1);
    } else {
      saveRestaurantInfo();
    }
  };

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const saveRestaurantInfo = async () => {
    try {
      setLoading(true);

      await updateConfig({
        restaurantName: formData.restaurantName,
        displayName: formData.displayName,
        businessType: formData.businessType,
        phone: formData.phone,
        email: formData.email,
        address: {
          street: formData.street,
          city: formData.city,
          state: formData.state,
          zipCode: formData.zipCode,
          country: formData.country,
        },
      });

      await completeSetupStep('restaurantInfo');

      Alert.alert(
        'Setup Complete!',
        'Your restaurant information has been saved successfully. Your restaurant name will now appear throughout the app.',
        [
          {
            text: 'Configure Menu',
            onPress: () => navigation.navigate('SettingsMenuManagement' as never),
          },
          {
            text: 'Back to Settings',
            onPress: () => navigation.navigate('SettingsMain' as never),
          },
        ]
      );
    } catch (error) {
      Alert.alert('Error', 'Failed to save restaurant information. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const renderStepIndicator = () => (
    <View style={styles.stepIndicator}>
      {[1, 2, 3].map((step) => (
        <View key={step} style={styles.stepIndicatorItem}>
          <View
            style={[
              styles.stepCircle,
              currentStep >= step && styles.stepCircleActive,
              currentStep > step && styles.stepCircleCompleted,
            ]}
          >
            {currentStep > step ? (
              <Icon name="check" size={16} color={Colors.white} />
            ) : (
              <Text style={[styles.stepNumber, currentStep >= step && styles.stepNumberActive]}>
                {step}
              </Text>
            )}
          </View>
          {step < 3 && (
            <View style={[styles.stepLine, currentStep > step && styles.stepLineCompleted]} />
          )}
        </View>
      ))}
    </View>
  );

  const renderStep1 = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Restaurant Information</Text>
      <Text style={styles.stepDescription}>
        Let's start with basic information about your restaurant
      </Text>

      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Restaurant Name *</Text>
        <TextInput
          style={styles.textInput}
          value={formData.restaurantName}
          onChangeText={(value) => updateField('restaurantName', value)}
          placeholder="e.g., Maria's Mexican Kitchen"
          placeholderTextColor={Colors.mediumGray}
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Display Name *</Text>
        <Text style={styles.inputHint}>This is what appears in your POS headers</Text>
        <TextInput
          style={styles.textInput}
          value={formData.displayName}
          onChangeText={(value) => updateField('displayName', value)}
          placeholder="e.g., Maria's Kitchen"
          placeholderTextColor={Colors.mediumGray}
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Business Type *</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.businessTypeScroll}
        >
          {businessTypes.map((type) => (
            <TouchableOpacity
              key={type}
              style={[
                styles.businessTypeButton,
                formData.businessType === type && styles.businessTypeButtonActive,
              ]}
              onPress={() => updateField('businessType', type)}
            >
              <Text
                style={[
                  styles.businessTypeText,
                  formData.businessType === type && styles.businessTypeTextActive,
                ]}
              >
                {type}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    </View>
  );

  const renderStep2 = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Contact Information</Text>
      <Text style={styles.stepDescription}>How can customers and Fynlo support reach you?</Text>

      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Phone Number *</Text>
        <TextInput
          style={styles.textInput}
          value={formData.phone}
          onChangeText={(value) => updateField('phone', value)}
          placeholder="+44 20 1234 5678"
          placeholderTextColor={Colors.mediumGray}
          keyboardType="phone-pad"
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Email Address *</Text>
        <TextInput
          style={styles.textInput}
          value={formData.email}
          onChangeText={(value) => updateField('email', value)}
          placeholder="owner@mariaskitchen.co.uk"
          placeholderTextColor={Colors.mediumGray}
          keyboardType="email-address"
          autoCapitalize="none"
        />
      </View>
    </View>
  );

  const renderStep3 = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Restaurant Location</Text>
      <Text style={styles.stepDescription}>
        Your restaurant's physical address for deliveries and customers
      </Text>

      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Street Address *</Text>
        <TextInput
          style={styles.textInput}
          value={formData.street}
          onChangeText={(value) => updateField('street', value)}
          placeholder="123 High Street"
          placeholderTextColor={Colors.mediumGray}
        />
      </View>

      <View style={styles.inputRow}>
        <View style={[styles.inputGroup, { flex: 2 }]}>
          <Text style={styles.inputLabel}>City *</Text>
          <TextInput
            style={styles.textInput}
            value={formData.city}
            onChangeText={(value) => updateField('city', value)}
            placeholder="London"
            placeholderTextColor={Colors.mediumGray}
          />
        </View>

        <View style={[styles.inputGroup, { flex: 1, marginLeft: 12 }]}>
          <Text style={styles.inputLabel}>Postcode *</Text>
          <TextInput
            style={styles.textInput}
            value={formData.zipCode}
            onChangeText={(value) => updateField('zipCode', value)}
            placeholder="SW1A 1AA"
            placeholderTextColor={Colors.mediumGray}
            autoCapitalize="characters"
          />
        </View>
      </View>

      <View style={styles.inputRow}>
        <View style={[styles.inputGroup, { flex: 1 }]}>
          <Text style={styles.inputLabel}>County/State</Text>
          <TextInput
            style={styles.textInput}
            value={formData.state}
            onChangeText={(value) => updateField('state', value)}
            placeholder="Greater London"
            placeholderTextColor={Colors.mediumGray}
          />
        </View>

        <View style={[styles.inputGroup, { flex: 1, marginLeft: 12 }]}>
          <Text style={styles.inputLabel}>Country</Text>
          <TextInput
            style={[styles.textInput, styles.textInputDisabled]}
            value={formData.country}
            editable={false}
            placeholder="United Kingdom"
            placeholderTextColor={Colors.mediumGray}
          />
        </View>
      </View>
    </View>
  );

  const renderCurrentStep = () => {
    switch (currentStep) {
      case 1:
        return renderStep1();
      case 2:
        return renderStep2();
      case 3:
        return renderStep3();
      default:
        return renderStep1();
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar backgroundColor={Colors.primary} barStyle="light-content" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          testID="back-button"
        >
          <Icon name="arrow-back" size={24} color={Colors.white} />
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Restaurant Setup</Text>
          <Text style={styles.headerSubtitle}>Step {currentStep} of 3</Text>
        </View>

        <View style={styles.headerSpacer} />
      </View>

      <KeyboardAvoidingView
        style={styles.content}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {renderStepIndicator()}

        <ScrollView
          style={styles.scrollContainer}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {renderCurrentStep()}
        </ScrollView>

        {/* Navigation Buttons */}
        <View style={styles.navigationBar}>
          {currentStep > 1 && (
            <TouchableOpacity style={styles.prevButton} onPress={prevStep}>
              <Icon name="arrow-back" size={20} color={Colors.darkGray} />
              <Text style={styles.prevButtonText}>Previous</Text>
            </TouchableOpacity>
          )}

          <View style={styles.navigationSpacer} />

          <TouchableOpacity
            style={[styles.nextButton, !validateStep(currentStep) && styles.nextButtonDisabled]}
            onPress={nextStep}
            disabled={loading || !validateStep(currentStep)}
          >
            <Text style={styles.nextButtonText}>
              {loading ? 'Saving...' : currentStep === 3 ? 'Complete Setup' : 'Next'}
            </Text>
            {!loading && (
              <Icon
                name={currentStep === 3 ? 'check' : 'arrow-forward'}
                size={20}
                color={Colors.white}
              />
            )}
          </TouchableOpacity>
        </View>
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
  headerSpacer: {
    width: 40,
  },
  content: {
    flex: 1,
  },
  stepIndicator: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 24,
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  stepIndicatorItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stepCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.lightGray,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: Colors.mediumGray,
  },
  stepCircleActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  stepCircleCompleted: {
    backgroundColor: Colors.success,
    borderColor: Colors.success,
  },
  stepNumber: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.mediumGray,
  },
  stepNumberActive: {
    color: Colors.white,
  },
  stepLine: {
    width: 40,
    height: 2,
    backgroundColor: Colors.lightGray,
    marginHorizontal: 8,
  },
  stepLineCompleted: {
    backgroundColor: Colors.success,
  },
  scrollContainer: {
    flex: 1,
  },
  stepContent: {
    padding: 24,
  },
  stepTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 8,
  },
  stepDescription: {
    fontSize: 16,
    color: Colors.darkGray,
    marginBottom: 32,
    lineHeight: 22,
  },
  inputGroup: {
    marginBottom: 24,
  },
  inputRow: {
    flexDirection: 'row',
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 8,
  },
  inputHint: {
    fontSize: 12,
    color: Colors.mediumGray,
    marginBottom: 8,
    fontStyle: 'italic',
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
  textInputDisabled: {
    backgroundColor: Colors.lightGray,
    color: Colors.mediumGray,
  },
  businessTypeScroll: {
    marginTop: 8,
  },
  businessTypeButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: Colors.lightGray,
    marginRight: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  businessTypeButtonActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  businessTypeText: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.darkGray,
  },
  businessTypeTextActive: {
    color: Colors.white,
  },
  navigationBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 16,
    backgroundColor: Colors.white,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  prevButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: Colors.lightGray,
  },
  prevButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: Colors.darkGray,
    marginLeft: 8,
  },
  navigationSpacer: {
    flex: 1,
  },
  nextButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: Colors.primary,
  },
  nextButtonDisabled: {
    backgroundColor: Colors.mediumGray,
  },
  nextButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.white,
    marginRight: 8,
  },
});

export default RestaurantSetupScreen;
