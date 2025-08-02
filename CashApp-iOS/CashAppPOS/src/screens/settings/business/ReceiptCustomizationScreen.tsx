import React, { useState } from 'react';

import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  Image,
} from 'react-native';

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

const ReceiptCustomizationScreen: React.FC = () => {
  const { receiptSettings, updateReceiptSettings, businessInfo, isLoading } = useSettingsStore();
  const [formData, setFormData] = useState(receiptSettings);
  const [hasChanges, setHasChanges] = useState(false);
  const [logoUri, setLogoUri] = useState<string | null>(receiptSettings.logoUri || null);

  const handleFieldChange = (field: string, value: unknown) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setHasChanges(true);
  };

  const handleSave = async () => {
    try {
      updateReceiptSettings(formData);
      setHasChanges(false);
      Alert.alert('Success', 'Receipt customization has been saved successfully.', [
        { text: 'OK' },
      ]);
    } catch (_error) {
      Alert.alert('Error', 'Failed to save receipt customization. Please try again.', [
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
          setFormData(receiptSettings);
          setHasChanges(false);
        },
      },
    ]);
  };

  const handleLogoUpload = () => {
    Alert.alert('Select Logo Source', 'Choose how you would like to add your restaurant logo', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Camera',
        onPress: () => simulateImageCapture('camera'),
      },
      {
        text: 'Photo Library',
        onPress: () => simulateImageCapture('library'),
      },
    ]);
  };

  const simulateImageCapture = (source: 'camera' | 'library') => {
    // Simulate image picker result with a sample logo
    const sampleLogos = [
      'https://via.placeholder.com/200x80/00A651/FFFFFF?text=FYNLO+POS',
      'https://via.placeholder.com/200x80/0066CC/FFFFFF?text=RESTAURANT',
      'https://via.placeholder.com/200x80/FF6B35/FFFFFF?text=CAFE+LOGO',
    ];

    const selectedLogo = sampleLogos[Math.floor(Math.random() * sampleLogos.length)];

    Alert.alert(
      'Logo Selected',
      `Logo selected from ${source}. This is a demo - in production, this would use react-native-image-picker.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Use This Logo',
          onPress: () => {
            setLogoUri(selectedLogo);
            handleFieldChange('logoUri', selectedLogo);
            Alert.alert('Success', "Logo has been updated! Don't forget to save your changes.");
          },
        },
      ]
    );
  };

  const handleRemoveLogo = () => {
    Alert.alert('Remove Logo', 'Are you sure you want to remove the current logo?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => {
          setLogoUri(null);
          handleFieldChange('logoUri', null);
        },
      },
    ]);
  };

  // Sample receipt preview data
  const sampleReceiptData = {
    orderNumber: 'ORD-2024-001',
    date: new Date().toLocaleDateString('en-GB'),
    time: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
    items: [
      { name: 'Carnitas Taco', qty: 2, price: 7.0 },
      { name: 'Nachos', qty: 1, price: 5.0 },
      { name: 'Corona Beer', qty: 1, price: 3.8 },
    ],
    subtotal: 15.8,
    vat: 3.16,
    total: 18.96,
  };

  const renderReceiptPreview = () => (
    <View style={styles.receiptPreview}>
      <View style={styles.receiptHeader}>
        {formData.showLogo && (
          <View style={styles.logoPlaceholder}>
            {logoUri ? (
              <Image
                source={{ uri: logoUri }}
                style={styles.receiptLogoImage}
                resizeMode="contain"
              />
            ) : (
              <>
                <Icon name="business" size={40} color={Colors.primary} />
                <Text style={styles.logoText}>LOGO</Text>
              </>
            )}
          </View>
        )}

        <Text style={styles.receiptCompanyName}>{businessInfo.companyName}</Text>
        <Text style={styles.receiptAddress}>{businessInfo.address}</Text>
        <Text style={styles.receiptAddress}>
          {businessInfo.city}, {businessInfo.postalCode}
        </Text>
        <Text style={styles.receiptPhone}>Tel: {businessInfo.phone}</Text>

        {formData.showVatNumber && businessInfo.vatNumber && (
          <Text style={styles.receiptVat}>VAT: {businessInfo.vatNumber}</Text>
        )}

        {formData.headerText && <Text style={styles.receiptHeaderText}>{formData.headerText}</Text>}
      </View>

      <View style={styles.receiptDivider} />

      <View style={styles.receiptBody}>
        <View style={styles.receiptOrderInfo}>
          <Text style={styles.receiptOrderNumber}>Order: {sampleReceiptData.orderNumber}</Text>
          <Text style={styles.receiptDateTime}>
            {sampleReceiptData.date} {sampleReceiptData.time}
          </Text>
        </View>

        <View style={styles.receiptItems}>
          {sampleReceiptData.items.map((item, index) => (
            <View key={index} style={styles.receiptItem}>
              <Text style={styles.receiptItemName}>{item.name}</Text>
              <Text style={styles.receiptItemQty}>x{item.qty}</Text>
              <Text style={styles.receiptItemPrice}>£{item.price.toFixed(2)}</Text>
            </View>
          ))}
        </View>

        <View style={styles.receiptDivider} />

        <View style={styles.receiptTotals}>
          <View style={styles.receiptTotalLine}>
            <Text style={styles.receiptTotalLabel}>Subtotal:</Text>
            <Text style={styles.receiptTotalValue}>£{sampleReceiptData.subtotal.toFixed(2)}</Text>
          </View>
          <View style={styles.receiptTotalLine}>
            <Text style={styles.receiptTotalLabel}>VAT (20%):</Text>
            <Text style={styles.receiptTotalValue}>£{sampleReceiptData.vat.toFixed(2)}</Text>
          </View>
          <View style={[styles.receiptTotalLine, styles.receiptGrandTotal]}>
            <Text style={styles.receiptGrandTotalLabel}>TOTAL:</Text>
            <Text style={styles.receiptGrandTotalValue}>£{sampleReceiptData.total.toFixed(2)}</Text>
          </View>
        </View>
      </View>

      <View style={styles.receiptDivider} />

      <View style={styles.receiptFooter}>
        {formData.footerText && <Text style={styles.receiptFooterText}>{formData.footerText}</Text>}

        {formData.showQrCode && (
          <View style={styles.qrCodePlaceholder}>
            <Icon name="qr-code" size={60} color={Colors.mediumGray} />
            <Text style={styles.qrCodeText}>QR Code</Text>
          </View>
        )}
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <SettingsHeader
        title="Receipt Customization"
        subtitle="Customize your receipt appearance"
        rightAction={{
          icon: 'save',
          onPress: handleSave,
          color: hasChanges ? Colors.white : 'rgba(255, 255, 255, 0.5)',
        }}
      />

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Receipt Format */}
        <SettingsSection
          title="Receipt Format"
          subtitle="Choose how receipts are printed and delivered"
        >
          <SettingsCard
            title="Print Receipts"
            description="Automatically print receipts for customers"
            icon="print"
            iconColor={Colors.primary}
          >
            <ToggleSwitch
              value={formData.printReceipts}
              onValueChange={(value) => handleFieldChange('printReceipts', value)}
            />
          </SettingsCard>

          <SettingsCard
            title="Email Receipts"
            description="Send digital receipts to customer email"
            icon="email"
            iconColor={Colors.secondary}
          >
            <ToggleSwitch
              value={formData.emailReceipts}
              onValueChange={(value) => handleFieldChange('emailReceipts', value)}
            />
          </SettingsCard>

          <SettingsCard
            title="Receipt Format"
            description="Choose receipt paper format"
            icon="receipt"
            iconColor={Colors.warning}
            value={formData.receiptFormat === 'thermal' ? 'Thermal (80mm)' : 'A4 Paper'}
            onPress={() => {
              const newFormat = formData.receiptFormat === 'thermal' ? 'a4' : 'thermal';
              handleFieldChange('receiptFormat', newFormat);
            }}
          />
        </SettingsSection>

        {/* Branding */}
        <SettingsSection title="Branding" subtitle="Add your logo and company branding">
          <SettingsCard
            title="Show Logo"
            description="Display company logo on receipts"
            icon="image"
            iconColor={Colors.primary}
          >
            <ToggleSwitch
              value={formData.showLogo}
              onValueChange={(value) => handleFieldChange('showLogo', value)}
            />
          </SettingsCard>

          {formData.showLogo && (
            <View style={styles.logoSection}>
              {logoUri ? (
                <View style={styles.logoContainer}>
                  <Text style={styles.logoSectionTitle}>Current Logo</Text>
                  <View style={styles.logoPreview}>
                    <Image
                      source={{ uri: logoUri }}
                      style={styles.logoImage}
                      resizeMode="contain"
                    />
                  </View>
                  <View style={styles.logoActions}>
                    <TouchableOpacity
                      style={[styles.logoButton, styles.changeLogo]}
                      onPress={handleLogoUpload}
                    >
                      <Icon name="edit" size={20} color={Colors.white} />
                      <Text style={styles.logoButtonText}>Change Logo</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.logoButton, styles.removeLogo]}
                      onPress={handleRemoveLogo}
                    >
                      <Icon name="delete" size={20} color={Colors.white} />
                      <Text style={styles.logoButtonText}>Remove</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <SettingsCard
                  title="Upload Logo"
                  description="Select your company logo image"
                  icon="cloud-upload"
                  iconColor={Colors.secondary}
                  onPress={handleLogoUpload}
                />
              )}
            </View>
          )}
        </SettingsSection>

        {/* Content Customization */}
        <SettingsSection
          title="Content Customization"
          subtitle="Customize text that appears on receipts"
        >
          <View style={styles.textInputContainer}>
            <Text style={styles.inputLabel}>Header Text</Text>
            <TextInput
              style={styles.textInput}
              value={formData.headerText}
              onChangeText={(value) => handleFieldChange('headerText', value)}
              placeholder="Thank you for dining with us!"
              multiline
              numberOfLines={2}
            />
          </View>

          <View style={styles.textInputContainer}>
            <Text style={styles.inputLabel}>Footer Text</Text>
            <TextInput
              style={styles.textInput}
              value={formData.footerText}
              onChangeText={(value) => handleFieldChange('footerText', value)}
              placeholder="Visit us again soon!"
              multiline
              numberOfLines={2}
            />
          </View>
        </SettingsSection>

        {/* Additional Options */}
        <SettingsSection title="Additional Options" subtitle="Extra features for your receipts">
          <SettingsCard
            title="Show VAT Number"
            description="Display VAT registration number"
            icon="receipt-long"
            iconColor={Colors.success}
          >
            <ToggleSwitch
              value={formData.showVatNumber}
              onValueChange={(value) => handleFieldChange('showVatNumber', value)}
            />
          </SettingsCard>

          <SettingsCard
            title="QR Code"
            description="Add QR code for digital menu or feedback"
            icon="qr-code"
            iconColor={Colors.darkGray}
          >
            <ToggleSwitch
              value={formData.showQrCode}
              onValueChange={(value) => handleFieldChange('showQrCode', value)}
            />
          </SettingsCard>
        </SettingsSection>

        {/* Receipt Preview */}
        <SettingsSection title="Receipt Preview" subtitle="Preview how your receipt will look">
          <View style={styles.previewContainer}>{renderReceiptPreview()}</View>
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
  textInputContainer: {
    padding: 16,
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: Colors.text,
    marginBottom: 8,
  },
  textInput: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 16,
    color: Colors.text,
    backgroundColor: Colors.background,
    textAlignVertical: 'top',
  },
  previewContainer: {
    padding: 16,
    backgroundColor: Colors.background,
  },
  receiptPreview: {
    backgroundColor: Colors.white,
    borderRadius: 8,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    maxWidth: 300,
    alignSelf: 'center',
  },
  receiptHeader: {
    alignItems: 'center',
    marginBottom: 12,
  },
  logoPlaceholder: {
    alignItems: 'center',
    marginBottom: 8,
  },
  logoText: {
    fontSize: 10,
    color: Colors.mediumGray,
    marginTop: 4,
  },
  receiptCompanyName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text,
    textAlign: 'center',
    marginBottom: 4,
  },
  receiptAddress: {
    fontSize: 12,
    color: Colors.lightText,
    textAlign: 'center',
  },
  receiptPhone: {
    fontSize: 12,
    color: Colors.lightText,
    textAlign: 'center',
  },
  receiptVat: {
    fontSize: 12,
    color: Colors.lightText,
    textAlign: 'center',
    marginTop: 4,
  },
  receiptHeaderText: {
    fontSize: 14,
    color: Colors.primary,
    textAlign: 'center',
    marginTop: 8,
    fontStyle: 'italic',
  },
  receiptBody: {
    marginVertical: 12,
  },
  receiptOrderInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  receiptOrderNumber: {
    fontSize: 12,
    color: Colors.text,
    fontWeight: '500',
  },
  receiptDateTime: {
    fontSize: 12,
    color: Colors.lightText,
  },
  receiptItems: {
    marginBottom: 12,
  },
  receiptItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  receiptItemName: {
    fontSize: 12,
    color: Colors.text,
    flex: 1,
  },
  receiptItemQty: {
    fontSize: 12,
    color: Colors.lightText,
    marginHorizontal: 8,
  },
  receiptItemPrice: {
    fontSize: 12,
    color: Colors.text,
    fontWeight: '500',
  },
  receiptTotals: {
    marginTop: 8,
  },
  receiptTotalLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  receiptTotalLabel: {
    fontSize: 12,
    color: Colors.lightText,
  },
  receiptTotalValue: {
    fontSize: 12,
    color: Colors.text,
    fontWeight: '500',
  },
  receiptGrandTotal: {
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: 8,
    marginTop: 4,
  },
  receiptGrandTotalLabel: {
    fontSize: 14,
    color: Colors.text,
    fontWeight: 'bold',
  },
  receiptGrandTotalValue: {
    fontSize: 14,
    color: Colors.primary,
    fontWeight: 'bold',
  },
  receiptDivider: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: 8,
  },
  receiptFooter: {
    alignItems: 'center',
    marginTop: 12,
  },
  receiptFooterText: {
    fontSize: 12,
    color: Colors.primary,
    textAlign: 'center',
    fontStyle: 'italic',
    marginBottom: 8,
  },
  qrCodePlaceholder: {
    alignItems: 'center',
  },
  qrCodeText: {
    fontSize: 10,
    color: Colors.mediumGray,
    marginTop: 4,
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
  // Logo Upload Styles
  logoSection: {
    marginBottom: 1,
  },
  logoContainer: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  logoSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 12,
  },
  logoPreview: {
    alignItems: 'center',
    backgroundColor: Colors.background,
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
  },
  logoImage: {
    width: 200,
    height: 80,
  },
  logoActions: {
    flexDirection: 'row',
    gap: 12,
  },
  logoButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
  },
  changeLogo: {
    backgroundColor: Colors.secondary,
  },
  removeLogo: {
    backgroundColor: Colors.danger,
  },
  logoButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.white,
  },
  receiptLogoImage: {
    width: 60,
    height: 24,
  },
});

export default ReceiptCustomizationScreen;
