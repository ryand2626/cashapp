import React, { useState } from 'react';

import { StyleSheet, Text, View, ScrollView, TouchableOpacity, Alert, _Switch } from 'react-native';

import Icon from 'react-native-vector-icons/MaterialIcons';

import { SimpleTextInput, SimpleDecimalInput } from '../../../components/inputs';
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

interface TaxExemptItem {
  id: string;
  name: string;
}

const TaxConfigurationScreen: React.FC = () => {
  const { taxConfiguration, updateTaxConfiguration, isLoading } = useSettingsStore();
  const [formData, setFormData] = useState(taxConfiguration);
  const [hasChanges, setHasChanges] = useState(false);
  const [newExemptItem, setNewExemptItem] = useState('');
  const [showAddExemptItem, setShowAddExemptItem] = useState(false);

  // UK VAT rates for reference
  const ukVatRates = [
    { rate: 20, description: 'Standard Rate (20%)', category: 'Most goods and services' },
    {
      rate: 5,
      description: 'Reduced Rate (5%)',
      category: "Children's car seats, home energy, etc.",
    },
    { rate: 0, description: 'Zero Rate (0%)', category: "Books, food, children's clothes, etc." },
  ];

  const handleFieldChange = (field: string, value: unknown) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setHasChanges(true);
  };

  const handleVatRateChange = (rate: string) => {
    const numericRate = parseFloat(rate) || 0;
    if (numericRate >= 0 && numericRate <= 100) {
      handleFieldChange('vatRate', numericRate);
    }
  };

  const addExemptItem = () => {
    if (newExemptItem.trim()) {
      const updatedExemptItems = [...formData.taxExemptItems, newExemptItem.trim()];
      handleFieldChange('taxExemptItems', updatedExemptItems);
      setNewExemptItem('');
      setShowAddExemptItem(false);
    }
  };

  const removeExemptItem = (index: number) => {
    const updatedExemptItems = formData.taxExemptItems.filter((_, i) => i !== index);
    handleFieldChange('taxExemptItems', updatedExemptItems);
  };

  const calculateTaxOnAmount = (amount: number): { net: number; vat: number; gross: number } => {
    if (!formData.vatEnabled) {
      return { net: amount, vat: 0, gross: amount };
    }

    if (formData.vatInclusive) {
      // VAT inclusive calculation
      const gross = amount;
      const net = gross / (1 + formData.vatRate / 100);
      const vat = gross - net;
      return { net, vat, gross };
    } else {
      // VAT exclusive calculation
      const net = amount;
      const vat = net * (formData.vatRate / 100);
      const gross = net + vat;
      return { net, vat, gross };
    }
  };

  const handleSave = async () => {
    try {
      updateTaxConfiguration(formData);
      setHasChanges(false);
      Alert.alert('Success', 'Tax configuration has been saved successfully.', [{ text: 'OK' }]);
    } catch (_error) {
      Alert.alert('Error', 'Failed to save tax configuration. Please try again.', [{ text: 'OK' }]);
    }
  };

  const handleReset = () => {
    Alert.alert('Reset Changes', 'Are you sure you want to discard all unsaved changes?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Reset',
        style: 'destructive',
        onPress: () => {
          setFormData(taxConfiguration);
          setHasChanges(false);
        },
      },
    ]);
  };

  // Example calculation for £100
  const exampleCalculation = calculateTaxOnAmount(100);

  return (
    <View style={styles.container}>
      <SettingsHeader
        title="Tax Configuration"
        subtitle="VAT rates and tax exemptions"
        rightAction={{
          icon: 'save',
          onPress: handleSave,
          color: hasChanges ? Colors.white : 'rgba(255, 255, 255, 0.5)',
        }}
      />

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* VAT Settings */}
        <SettingsSection title="VAT Configuration" subtitle="Configure Value Added Tax settings">
          <SettingsCard
            title="Enable VAT"
            description="Include VAT in all transactions"
            icon="receipt-long"
            iconColor={Colors.primary}
          >
            <ToggleSwitch
              value={formData.vatEnabled}
              onValueChange={(value) => handleFieldChange('vatEnabled', value)}
            />
          </SettingsCard>

          {formData.vatEnabled && (
            <>
              <SettingsCard
                title="VAT Rate"
                description="Standard VAT rate percentage"
                icon="percent"
                iconColor={Colors.secondary}
              >
                <View style={styles.rateInputContainer}>
                  <SimpleDecimalInput
                    // label="VAT Rate" // Label is part of SettingsCard title
                    value={formData.vatRate} // Pass number directly
                    onValueChange={(value) => handleVatRateChange(value.toString())} // onValueChange expects number, handleVatRateChange expects string
                    keyboardType="numeric" // Default for SimpleDecimalInput
                    maxLength={5} // Max length for digits before decimal, or total?
                    placeholder="0.00" // Added placeholder
                    // containerStyle={{ flex: 1 }} // To allow input to take space before %
                    // inputStyle props for text align if supported, e.g. textAlign: 'right'
                  />
                  <Text style={styles.percentSymbol}>%</Text>
                </View>
              </SettingsCard>

              <SettingsCard
                title="VAT Inclusive Pricing"
                description="Prices shown include VAT (tax inclusive)"
                icon="price-check"
                iconColor={Colors.warning}
              >
                <ToggleSwitch
                  value={formData.vatInclusive}
                  onValueChange={(value) => handleFieldChange('vatInclusive', value)}
                />
              </SettingsCard>
            </>
          )}
        </SettingsSection>

        {/* UK VAT Rates Reference */}
        {formData.vatEnabled && (
          <SettingsSection
            title="UK VAT Rates Reference"
            subtitle="Common VAT rates in the United Kingdom"
          >
            <View style={styles.vatRatesContainer}>
              {ukVatRates.map((vatRate, index) => (
                <TouchableOpacity
                  key={index}
                  style={[
                    styles.vatRateCard,
                    formData.vatRate === vatRate.rate && styles.selectedVatRate,
                  ]}
                  onPress={() => handleFieldChange('vatRate', vatRate.rate)}
                >
                  <View style={styles.vatRateHeader}>
                    <Text
                      style={[
                        styles.vatRateTitle,
                        formData.vatRate === vatRate.rate && styles.selectedVatRateText,
                      ]}
                    >
                      {vatRate.description}
                    </Text>
                    {formData.vatRate === vatRate.rate && (
                      <Icon name="check-circle" size={20} color={Colors.primary} />
                    )}
                  </View>
                  <Text style={styles.vatRateCategory}>{vatRate.category}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </SettingsSection>
        )}

        {/* Service Tax - Platform Controlled */}
        <SettingsSection
          title="Service Charge"
          subtitle="Service charges are controlled by the platform"
        >
          <View style={styles.platformControlledCard}>
            <Icon name="lock" size={24} color={Colors.mediumGray} />
            <View style={styles.platformControlledContent}>
              <Text style={styles.platformControlledTitle}>Platform Controlled</Text>
              <Text style={styles.platformControlledDescription}>
                Service charges are set and managed by the platform owner. Contact support if you
                need changes.
              </Text>
              <Text style={styles.platformControlledRate}>
                Current Rate: 12.5% (Platform Standard)
              </Text>
            </View>
          </View>
        </SettingsSection>

        {/* Tax Exempt Items */}
        <SettingsSection title="Tax Exempt Items" subtitle="Items that are exempt from VAT">
          <View style={styles.exemptItemsContainer}>
            {formData.taxExemptItems.map((item, index) => (
              <View key={index} style={styles.exemptItemCard}>
                <Text style={styles.exemptItemText}>{item}</Text>
                <TouchableOpacity
                  onPress={() => removeExemptItem(index)}
                  style={styles.removeButton}
                >
                  <Icon name="close" size={20} color={Colors.danger} />
                </TouchableOpacity>
              </View>
            ))}

            {showAddExemptItem ? (
              <View style={styles.addExemptItemContainer}>
                <SimpleTextInput
                  // No label needed here as it's a direct input field
                  value={newExemptItem}
                  onValueChange={setNewExemptItem}
                  placeholder="Enter item name"
                  autoFocus
                  containerStyle={{ flex: 1 }} // To take available space
                />
                <TouchableOpacity onPress={addExemptItem} style={styles.addButton}>
                  <Icon name="add" size={20} color={Colors.primary} />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => {
                    setShowAddExemptItem(false);
                    setNewExemptItem('');
                  }}
                  style={styles.cancelButton}
                >
                  <Icon name="close" size={20} color={Colors.mediumGray} />
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                style={styles.addExemptItemButton}
                onPress={() => setShowAddExemptItem(true)}
              >
                <Icon name="add" size={20} color={Colors.primary} />
                <Text style={styles.addExemptItemButtonText}>Add Exempt Item</Text>
              </TouchableOpacity>
            )}
          </View>
        </SettingsSection>

        {/* Tax Calculation Preview */}
        {formData.vatEnabled && (
          <SettingsSection
            title="Tax Calculation Preview"
            subtitle="Example calculation for £100.00"
          >
            <View style={styles.calculationPreview}>
              <View style={styles.calculationRow}>
                <Text style={styles.calculationLabel}>
                  {formData.vatInclusive ? 'Gross Amount:' : 'Net Amount:'}
                </Text>
                <Text style={styles.calculationValue}>
                  £
                  {formData.vatInclusive
                    ? exampleCalculation.gross.toFixed(2)
                    : exampleCalculation.net.toFixed(2)}
                </Text>
              </View>

              <View style={styles.calculationRow}>
                <Text style={styles.calculationLabel}>VAT ({formData.vatRate}%):</Text>
                <Text style={styles.calculationValue}>£{exampleCalculation.vat.toFixed(2)}</Text>
              </View>

              <View style={styles.calculationRow}>
                <Text style={styles.calculationLabel}>Service (Platform - 12.5%):</Text>
                <Text style={styles.calculationValue}>
                  £{((exampleCalculation.net * 12.5) / 100).toFixed(2)}
                </Text>
              </View>

              <View style={[styles.calculationRow, styles.calculationTotal]}>
                <Text style={styles.calculationTotalLabel}>Total Amount:</Text>
                <Text style={styles.calculationTotalValue}>
                  £{(exampleCalculation.gross + (exampleCalculation.net * 12.5) / 100).toFixed(2)}
                </Text>
              </View>
            </View>
          </SettingsSection>
        )}

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
  rateInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minWidth: 80,
  },
  rateInput: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    textAlign: 'right',
    minWidth: 40,
  },
  percentSymbol: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.mediumGray,
    marginLeft: 4,
  },
  vatRatesContainer: {
    padding: 16,
    gap: 8,
  },
  vatRateCard: {
    backgroundColor: Colors.white,
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  selectedVatRate: {
    borderColor: Colors.primary,
    backgroundColor: `${Colors.primary}05`,
  },
  vatRateHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  vatRateTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: Colors.text,
  },
  selectedVatRateText: {
    color: Colors.primary,
  },
  vatRateCategory: {
    fontSize: 14,
    color: Colors.lightText,
    marginTop: 4,
  },
  exemptItemsContainer: {
    padding: 16,
  },
  exemptItemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.background,
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  exemptItemText: {
    fontSize: 16,
    color: Colors.text,
    flex: 1,
  },
  removeButton: {
    padding: 4,
  },
  addExemptItemContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  addExemptItemInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 16,
    color: Colors.text,
    backgroundColor: Colors.white,
  },
  addButton: {
    backgroundColor: Colors.primary,
    borderRadius: 8,
    padding: 8,
  },
  cancelButton: {
    padding: 8,
  },
  addExemptItemButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.background,
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    borderStyle: 'dashed',
    gap: 8,
  },
  addExemptItemButtonText: {
    fontSize: 16,
    color: Colors.primary,
    fontWeight: '500',
  },
  calculationPreview: {
    backgroundColor: Colors.white,
    margin: 16,
    borderRadius: 12,
    padding: 16,
  },
  calculationRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  calculationLabel: {
    fontSize: 16,
    color: Colors.text,
  },
  calculationValue: {
    fontSize: 16,
    fontWeight: '500',
    color: Colors.text,
  },
  calculationTotal: {
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    marginTop: 8,
    paddingTop: 12,
  },
  calculationTotalLabel: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text,
  },
  calculationTotalValue: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.primary,
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
  platformControlledCard: {
    flexDirection: 'row',
    backgroundColor: Colors.lightGray,
    borderRadius: 12,
    padding: 16,
    margin: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  platformControlledContent: {
    flex: 1,
    marginLeft: 12,
  },
  platformControlledTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 4,
  },
  platformControlledDescription: {
    fontSize: 14,
    color: Colors.lightText,
    lineHeight: 20,
    marginBottom: 8,
  },
  platformControlledRate: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.secondary,
  },
});

export default TaxConfigurationScreen;
