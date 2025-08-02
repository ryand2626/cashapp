import React, { useState, useEffect } from 'react';

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
  Switch,
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

const RestaurantProfileScreen: React.FC = () => {
  const navigation = useNavigation();
  const { config, updateConfig, loading, error } = useRestaurantConfig();

  const [formData, setFormData] = useState({
    restaurantName: '',
    displayName: '',
    businessType: 'Restaurant',
    phone: '',
    email: '',
    website: '',
    street: '',
    city: '',
    state: '',
    zipCode: '',
    country: 'United Kingdom',
    currency: 'GBP',
    taxRate: 0.2,
    timezone: 'Europe/London',
  });

  const [hasChanges, setHasChanges] = useState(false);
  const [saving, setSaving] = useState(false);

  // Load config data
  useEffect(() => {
    if (config) {
      setFormData({
        restaurantName: config.restaurantName || '',
        displayName: config.displayName || '',
        businessType: config.businessType || 'Restaurant',
        phone: config.phone || '',
        email: config.email || '',
        website: config.website || '',
        street: config.address?.street || '',
        city: config.address?.city || '',
        state: config.address?.state || '',
        zipCode: config.address?.zipCode || '',
        country: config.address?.country || 'United Kingdom',
        currency: config.currency || 'GBP',
        taxRate: config.taxRate || 0.2,
        timezone: config.timezone || 'Europe/London',
      });
    }
  }, [config]);

  const updateField = (field: string, value: string | number) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setHasChanges(true);
  };

  const handleSave = async () => {
    try {
      setSaving(true);

      await updateConfig({
        restaurantName: formData.restaurantName,
        displayName: formData.displayName,
        businessType: formData.businessType,
        phone: formData.phone,
        email: formData.email,
        website: formData.website,
        address: {
          street: formData.street,
          city: formData.city,
          state: formData.state,
          zipCode: formData.zipCode,
          country: formData.country,
        },
        currency: formData.currency,
        taxRate: formData.taxRate,
        timezone: formData.timezone,
      });

      setHasChanges(false);
      Alert.alert('Success', 'Restaurant profile updated successfully!');
    } catch (error) {
      Alert.alert('Error', 'Failed to update restaurant profile. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    if (!hasChanges) return;

    Alert.alert('Discard Changes', 'Are you sure you want to discard all unsaved changes?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Discard',
        style: 'destructive',
        onPress: () => {
          if (config) {
            setFormData({
              restaurantName: config.restaurantName || '',
              displayName: config.displayName || '',
              businessType: config.businessType || 'Restaurant',
              phone: config.phone || '',
              email: config.email || '',
              website: config.website || '',
              street: config.address?.street || '',
              city: config.address?.city || '',
              state: config.address?.state || '',
              zipCode: config.address?.zipCode || '',
              country: config.address?.country || 'United Kingdom',
              currency: config.currency || 'GBP',
              taxRate: config.taxRate || 0.2,
              timezone: config.timezone || 'Europe/London',
            });
            setHasChanges(false);
          }
        },
      },
    ]);
  };

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

  const currencies = [
    { code: 'GBP', name: 'British Pound', symbol: '£' },
    { code: 'USD', name: 'US Dollar', symbol: '$' },
    { code: 'EUR', name: 'Euro', symbol: '€' },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar backgroundColor={Colors.primary} barStyle="light-content" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Icon name="arrow-back" size={24} color={Colors.white} />
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Restaurant Profile</Text>
          <Text style={styles.headerSubtitle}>Manage your restaurant details</Text>
        </View>

        <TouchableOpacity style={styles.resetButton} onPress={handleReset} disabled={!hasChanges}>
          <Icon
            name="refresh"
            size={24}
            color={hasChanges ? Colors.white : 'rgba(255,255,255,0.5)'}
          />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Basic Information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Basic Information</Text>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Restaurant Name *</Text>
            <TextInput
              style={styles.textInput}
              value={formData.restaurantName}
              onChangeText={(value) => updateField('restaurantName', value)}
              placeholder="Enter restaurant name"
              placeholderTextColor={Colors.mediumGray}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Display Name *</Text>
            <Text style={styles.inputHint}>This appears in headers and throughout the app</Text>
            <TextInput
              style={styles.textInput}
              value={formData.displayName}
              onChangeText={(value) => updateField('displayName', value)}
              placeholder="Enter display name"
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

        {/* Contact Information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Contact Information</Text>

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
              placeholder="restaurant@example.com"
              placeholderTextColor={Colors.mediumGray}
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Website (Optional)</Text>
            <TextInput
              style={styles.textInput}
              value={formData.website}
              onChangeText={(value) => updateField('website', value)}
              placeholder="https://restaurant.com"
              placeholderTextColor={Colors.mediumGray}
              keyboardType="url"
              autoCapitalize="none"
            />
          </View>
        </View>

        {/* Address */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Location</Text>

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
        </View>

        {/* Business Settings */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Business Settings</Text>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Currency</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.currencyScroll}
            >
              {currencies.map((currency) => (
                <TouchableOpacity
                  key={currency.code}
                  style={[
                    styles.currencyButton,
                    formData.currency === currency.code && styles.currencyButtonActive,
                  ]}
                  onPress={() => updateField('currency', currency.code)}
                >
                  <Text
                    style={[
                      styles.currencyText,
                      formData.currency === currency.code && styles.currencyTextActive,
                    ]}
                  >
                    {currency.symbol} {currency.code}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Tax Rate (%)</Text>
            <TextInput
              style={styles.textInput}
              value={(formData.taxRate * 100).toString()}
              onChangeText={(value) => updateField('taxRate', parseFloat(value) / 100 || 0)}
              placeholder="20"
              placeholderTextColor={Colors.mediumGray}
              keyboardType="numeric"
            />
          </View>
        </View>
      </ScrollView>

      {/* Save Button */}
      {hasChanges && (
        <View style={styles.saveBar}>
          <TouchableOpacity
            style={[styles.saveButton, saving && styles.saveButtonDisabled]}
            onPress={handleSave}
            disabled={saving}
          >
            <Icon name="save" size={20} color={Colors.white} />
            <Text style={styles.saveButtonText}>{saving ? 'Saving...' : 'Save Changes'}</Text>
          </TouchableOpacity>
        </View>
      )}
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
  resetButton: {
    padding: 8,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 16,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputRow: {
    flexDirection: 'row',
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 6,
  },
  inputHint: {
    fontSize: 12,
    color: Colors.mediumGray,
    marginBottom: 6,
    fontStyle: 'italic',
  },
  textInput: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: Colors.text,
    backgroundColor: Colors.white,
  },
  businessTypeScroll: {
    marginTop: 8,
  },
  businessTypeButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
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
    fontSize: 12,
    fontWeight: '500',
    color: Colors.darkGray,
  },
  businessTypeTextActive: {
    color: Colors.white,
  },
  currencyScroll: {
    marginTop: 8,
  },
  currencyButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: Colors.lightGray,
    marginRight: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  currencyButtonActive: {
    backgroundColor: Colors.secondary,
    borderColor: Colors.secondary,
  },
  currencyText: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.darkGray,
  },
  currencyTextActive: {
    color: Colors.white,
  },
  saveBar: {
    backgroundColor: Colors.white,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  saveButton: {
    backgroundColor: Colors.primary,
    borderRadius: 8,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  saveButtonDisabled: {
    backgroundColor: Colors.mediumGray,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.white,
  },
});

export default RestaurantProfileScreen;
