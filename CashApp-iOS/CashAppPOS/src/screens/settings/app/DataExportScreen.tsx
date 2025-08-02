import React, { useState } from 'react';

import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  Alert,
  Switch,
  Modal,
  ActivityIndicator,
  TextInput,
} from 'react-native';

import { useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialIcons';

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

interface ExportTemplate {
  id: string;
  name: string;
  description: string;
  dataTypes: string[];
  format: 'csv' | 'pdf' | 'excel' | 'json';
  isCustom: boolean;
}

interface ExportHistory {
  id: string;
  name: string;
  type: string;
  format: string;
  size: string;
  date: Date;
  status: 'completed' | 'failed' | 'in_progress';
  downloadUrl?: string;
}

const DataExportScreen: React.FC = () => {
  const navigation = useNavigation();

  const [selectedDataTypes, setSelectedDataTypes] = useState<string[]>([]);
  const [selectedFormat, setSelectedFormat] = useState<'csv' | 'pdf' | 'excel' | 'json'>('csv');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [isExporting, setIsExporting] = useState(false);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);

  const [exportSettings, setExportSettings] = useState({
    includeImages: false,
    compressFiles: true,
    encryptData: true,
    includeMetadata: true,
    anonymizeCustomers: false,
  });

  const dataTypes = [
    {
      id: 'transactions',
      name: 'Transactions',
      description: 'Sales, refunds, and payment data',
      icon: 'receipt',
    },
    {
      id: 'customers',
      name: 'Customers',
      description: 'Customer profiles and contact information',
      icon: 'people',
    },
    {
      id: 'menu',
      name: 'Menu Items',
      description: 'Products, categories, and pricing',
      icon: 'restaurant-menu',
    },
    {
      id: 'employees',
      name: 'Employees',
      description: 'Staff profiles and timeclock data',
      icon: 'group',
    },
    {
      id: 'inventory',
      name: 'Inventory',
      description: 'Stock levels and supplier information',
      icon: 'inventory',
    },
    {
      id: 'reports',
      name: 'Reports',
      description: 'Generated reports and analytics',
      icon: 'assessment',
    },
    {
      id: 'settings',
      name: 'Settings',
      description: 'Business configuration and preferences',
      icon: 'settings',
    },
    {
      id: 'discounts',
      name: 'Discounts',
      description: 'Pricing rules and promotional campaigns',
      icon: 'local-offer',
    },
  ];

  const exportTemplates: ExportTemplate[] = [
    {
      id: 'daily-sales',
      name: 'Daily Sales Report',
      description: 'Transactions and payment summary for daily reporting',
      dataTypes: ['transactions'],
      format: 'pdf',
      isCustom: false,
    },
    {
      id: 'customer-backup',
      name: 'Customer Backup',
      description: 'Complete customer database with purchase history',
      dataTypes: ['customers', 'transactions'],
      format: 'csv',
      isCustom: false,
    },
    {
      id: 'full-backup',
      name: 'Complete Business Backup',
      description: 'All business data for migration or backup purposes',
      dataTypes: ['transactions', 'customers', 'menu', 'employees', 'inventory', 'settings'],
      format: 'json',
      isCustom: false,
    },
    {
      id: 'tax-report',
      name: 'Tax Reporting Data',
      description: 'Financial data formatted for tax preparation',
      dataTypes: ['transactions', 'customers'],
      format: 'excel',
      isCustom: false,
    },
  ];

  const exportHistory: ExportHistory[] = [
    {
      id: 'export1',
      name: 'Daily Sales Report - Dec 17',
      type: 'Daily Sales Report',
      format: 'PDF',
      size: '2.1 MB',
      date: new Date(),
      status: 'completed',
      downloadUrl: 'https://example.com/download/1',
    },
    {
      id: 'export2',
      name: 'Customer Data Export',
      type: 'Custom Export',
      format: 'CSV',
      size: '856 KB',
      date: new Date(Date.now() - 24 * 60 * 60 * 1000),
      status: 'completed',
      downloadUrl: 'https://example.com/download/2',
    },
    {
      id: 'export3',
      name: 'Complete Business Backup',
      type: 'Complete Business Backup',
      format: 'JSON',
      size: '12.5 MB',
      date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      status: 'completed',
      downloadUrl: 'https://example.com/download/3',
    },
  ];

  const handleDataTypeToggle = (dataTypeId: string) => {
    setSelectedDataTypes((prev) =>
      prev.includes(dataTypeId) ? prev.filter((id) => id !== dataTypeId) : [...prev, dataTypeId]
    );
  };

  const handleSelectTemplate = (template: ExportTemplate) => {
    setSelectedDataTypes(template.dataTypes);
    setSelectedFormat(template.format);
    setShowTemplateModal(false);
    Alert.alert(
      'Template Applied',
      `"${template.name}" template has been applied to your export settings.`
    );
  };

  const handleStartExport = async () => {
    if (selectedDataTypes.length === 0) {
      Alert.alert('Error', 'Please select at least one data type to export.');
      return;
    }

    setIsExporting(true);

    try {
      // Simulate export process
      await new Promise((resolve) => setTimeout(resolve, 3000));

      const dataTypeNames = selectedDataTypes
        .map((id) => dataTypes.find((dt) => dt.id === id)?.name)
        .join(', ');

      Alert.alert(
        'Export Complete',
        `Your export (${dataTypeNames}) has been generated successfully. Check your email for the download link.`,
        [{ text: 'OK' }]
      );

      // Reset selections
      setSelectedDataTypes([]);
      setDateRange({ start: '', end: '' });
    } catch (_error) {
      Alert.alert('Error', 'Failed to export data. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleDownload = (exportItem: ExportHistory) => {
    Alert.alert('Download', `Download "${exportItem.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Download',
        onPress: () => {
          Alert.alert('Info', 'File download would start here');
        },
      },
    ]);
  };

  const toggleExportSetting = (setting: keyof typeof exportSettings) => {
    setExportSettings((prev) => ({
      ...prev,
      [setting]: !prev[setting],
    }));
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return 'check-circle';
      case 'failed':
        return 'error';
      case 'in_progress':
        return 'sync';
      default:
        return 'help';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return Colors.success;
      case 'failed':
        return Colors.danger;
      case 'in_progress':
        return Colors.warning;
      default:
        return Colors.mediumGray;
    }
  };

  const getFormatIcon = (format: string) => {
    switch (format.toLowerCase()) {
      case 'pdf':
        return 'picture-as-pdf';
      case 'csv':
        return 'table-chart';
      case 'excel':
        return 'grid-on';
      case 'json':
        return 'code';
      default:
        return 'insert-drive-file';
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Icon name="arrow-back" size={24} color={Colors.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Data Export</Text>
        <TouchableOpacity style={styles.historyButton} onPress={() => setShowHistoryModal(true)}>
          <Icon name="history" size={24} color={Colors.white} />
        </TouchableOpacity>
      </View>

      {/* Loading Overlay */}
      {isExporting && (
        <View style={styles.loadingOverlay}>
          <View style={styles.loadingContent}>
            <ActivityIndicator size="large" color={Colors.primary} />
            <Text style={styles.loadingText}>Exporting data...</Text>
            <Text style={styles.loadingSubtext}>This may take a few moments</Text>
          </View>
        </View>
      )}

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Quick Templates */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Export Templates</Text>
            <TouchableOpacity
              style={styles.viewAllButton}
              onPress={() => setShowTemplateModal(true)}
            >
              <Text style={styles.viewAllText}>View All</Text>
              <Icon name="chevron-right" size={20} color={Colors.primary} />
            </TouchableOpacity>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.templatesScroll}
          >
            {exportTemplates.slice(0, 3).map((template) => (
              <TouchableOpacity
                key={template.id}
                style={styles.templateCard}
                onPress={() => handleSelectTemplate(template)}
              >
                <Icon name={getFormatIcon(template.format)} size={32} color={Colors.primary} />
                <Text style={styles.templateName}>{template.name}</Text>
                <Text style={styles.templateDescription}>{template.description}</Text>
                <View style={styles.templateFormat}>
                  <Text style={styles.templateFormatText}>{template.format.toUpperCase()}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Data Types Selection */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Select Data to Export</Text>
          <View style={styles.dataTypesGrid}>
            {dataTypes.map((dataType) => (
              <TouchableOpacity
                key={dataType.id}
                style={[
                  styles.dataTypeCard,
                  selectedDataTypes.includes(dataType.id) && styles.dataTypeCardSelected,
                ]}
                onPress={() => handleDataTypeToggle(dataType.id)}
              >
                <Icon
                  name={dataType.icon}
                  size={32}
                  color={selectedDataTypes.includes(dataType.id) ? Colors.white : Colors.primary}
                />
                <Text
                  style={[
                    styles.dataTypeName,
                    selectedDataTypes.includes(dataType.id) && styles.dataTypeNameSelected,
                  ]}
                >
                  {dataType.name}
                </Text>
                <Text
                  style={[
                    styles.dataTypeDescription,
                    selectedDataTypes.includes(dataType.id) && styles.dataTypeDescriptionSelected,
                  ]}
                >
                  {dataType.description}
                </Text>
                {selectedDataTypes.includes(dataType.id) && (
                  <View style={styles.selectedBadge}>
                    <Icon name="check" size={16} color={Colors.white} />
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Export Format */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Export Format</Text>
          <View style={styles.formatGrid}>
            {['csv', 'pdf', 'excel', 'json'].map((format) => (
              <TouchableOpacity
                key={format}
                style={[
                  styles.formatButton,
                  selectedFormat === format && styles.formatButtonSelected,
                ]}
                onPress={() => setSelectedFormat(format as unknown)}
              >
                <Icon
                  name={getFormatIcon(format)}
                  size={24}
                  color={selectedFormat === format ? Colors.white : Colors.primary}
                />
                <Text
                  style={[
                    styles.formatText,
                    selectedFormat === format && styles.formatTextSelected,
                  ]}
                >
                  {format.toUpperCase()}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Date Range (Optional) */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Date Range (Optional)</Text>
          <Text style={styles.sectionSubtitle}>Leave blank to export all historical data</Text>
          <View style={styles.dateRangeContainer}>
            <View style={styles.dateInputContainer}>
              <Text style={styles.dateLabel}>From</Text>
              <TextInput
                style={styles.dateInput}
                value={dateRange.start}
                onChangeText={(text) => setDateRange((prev) => ({ ...prev, start: text }))}
                placeholder="DD/MM/YYYY"
              />
            </View>
            <View style={styles.dateInputContainer}>
              <Text style={styles.dateLabel}>To</Text>
              <TextInput
                style={styles.dateInput}
                value={dateRange.end}
                onChangeText={(text) => setDateRange((prev) => ({ ...prev, end: text }))}
                placeholder="DD/MM/YYYY"
              />
            </View>
          </View>
        </View>

        {/* Export Settings */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Export Settings</Text>
          <View style={styles.settingsCard}>
            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingLabel}>Include images</Text>
                <Text style={styles.settingDescription}>
                  Include product images and profile photos
                </Text>
              </View>
              <Switch
                value={exportSettings.includeImages}
                onValueChange={() => toggleExportSetting('includeImages')}
                trackColor={{ false: Colors.lightGray, true: Colors.primary }}
                thumbColor={Colors.white}
              />
            </View>

            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingLabel}>Compress files</Text>
                <Text style={styles.settingDescription}>Reduce file size for faster downloads</Text>
              </View>
              <Switch
                value={exportSettings.compressFiles}
                onValueChange={() => toggleExportSetting('compressFiles')}
                trackColor={{ false: Colors.lightGray, true: Colors.primary }}
                thumbColor={Colors.white}
              />
            </View>

            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingLabel}>Encrypt data</Text>
                <Text style={styles.settingDescription}>
                  Password-protect sensitive information
                </Text>
              </View>
              <Switch
                value={exportSettings.encryptData}
                onValueChange={() => toggleExportSetting('encryptData')}
                trackColor={{ false: Colors.lightGray, true: Colors.primary }}
                thumbColor={Colors.white}
              />
            </View>

            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingLabel}>Include metadata</Text>
                <Text style={styles.settingDescription}>
                  Add creation dates and system information
                </Text>
              </View>
              <Switch
                value={exportSettings.includeMetadata}
                onValueChange={() => toggleExportSetting('includeMetadata')}
                trackColor={{ false: Colors.lightGray, true: Colors.primary }}
                thumbColor={Colors.white}
              />
            </View>

            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingLabel}>Anonymize customer data</Text>
                <Text style={styles.settingDescription}>
                  Remove personally identifiable information
                </Text>
              </View>
              <Switch
                value={exportSettings.anonymizeCustomers}
                onValueChange={() => toggleExportSetting('anonymizeCustomers')}
                trackColor={{ false: Colors.lightGray, true: Colors.primary }}
                thumbColor={Colors.white}
              />
            </View>
          </View>
        </View>

        {/* Export Summary */}
        {selectedDataTypes.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Export Summary</Text>
            <View style={styles.summaryCard}>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Data Types:</Text>
                <Text style={styles.summaryValue}>
                  {selectedDataTypes
                    .map((id) => dataTypes.find((dt) => dt.id === id)?.name)
                    .join(', ')}
                </Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Format:</Text>
                <Text style={styles.summaryValue}>{selectedFormat.toUpperCase()}</Text>
              </View>
              {(dateRange.start || dateRange.end) && (
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Date Range:</Text>
                  <Text style={styles.summaryValue}>
                    {dateRange.start || 'Beginning'} - {dateRange.end || 'Present'}
                  </Text>
                </View>
              )}
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Estimated Size:</Text>
                <Text style={styles.summaryValue}>2.5 - 8.2 MB</Text>
              </View>
            </View>
          </View>
        )}

        {/* Export Button */}
        <View style={styles.section}>
          <TouchableOpacity
            style={[styles.exportButton, isExporting && styles.exportButtonDisabled]}
            onPress={handleStartExport}
            disabled={isExporting || selectedDataTypes.length === 0}
          >
            <Icon
              name={isExporting ? 'hourglass-empty' : 'file-download'}
              size={24}
              color={Colors.white}
            />
            <Text style={styles.exportButtonText}>
              {isExporting ? 'Exporting...' : 'Start Export'}
            </Text>
          </TouchableOpacity>

          <View style={styles.exportNote}>
            <Icon name="info-outline" size={20} color={Colors.secondary} />
            <Text style={styles.exportNoteText}>
              Export files will be sent to your registered email address and available for download
              for 30 days.
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* Template Selection Modal */}
      <Modal
        visible={showTemplateModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowTemplateModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Export Templates</Text>
              <TouchableOpacity onPress={() => setShowTemplateModal(false)}>
                <Icon name="close" size={24} color={Colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              {exportTemplates.map((template) => (
                <TouchableOpacity
                  key={template.id}
                  style={styles.templateListItem}
                  onPress={() => handleSelectTemplate(template)}
                >
                  <View style={styles.templateIcon}>
                    <Icon name={getFormatIcon(template.format)} size={24} color={Colors.primary} />
                  </View>
                  <View style={styles.templateContent}>
                    <Text style={styles.templateListName}>{template.name}</Text>
                    <Text style={styles.templateListDescription}>{template.description}</Text>
                    <Text style={styles.templateDataTypes}>
                      Includes: {template.dataTypes.join(', ')}
                    </Text>
                  </View>
                  <View style={styles.templateFormatBadge}>
                    <Text style={styles.templateFormatBadgeText}>
                      {template.format.toUpperCase()}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Export History Modal */}
      <Modal
        visible={showHistoryModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowHistoryModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Export History</Text>
              <TouchableOpacity onPress={() => setShowHistoryModal(false)}>
                <Icon name="close" size={24} color={Colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              {exportHistory.map((exportItem) => (
                <View key={exportItem.id} style={styles.historyItem}>
                  <View style={styles.historyContent}>
                    <View style={styles.historyHeader}>
                      <Text style={styles.historyName}>{exportItem.name}</Text>
                      <View
                        style={[
                          styles.historyStatus,
                          { backgroundColor: getStatusColor(exportItem.status) },
                        ]}
                      >
                        <Icon
                          name={getStatusIcon(exportItem.status)}
                          size={12}
                          color={Colors.white}
                        />
                      </View>
                    </View>
                    <Text style={styles.historyType}>{exportItem.type}</Text>
                    <View style={styles.historyDetails}>
                      <Text style={styles.historyDetail}>{exportItem.format}</Text>
                      <Text style={styles.historyDetail}>{exportItem.size}</Text>
                      <Text style={styles.historyDetail}>
                        {exportItem.date.toLocaleDateString()}
                      </Text>
                    </View>
                  </View>
                  {exportItem.status === 'completed' && (
                    <TouchableOpacity
                      style={styles.downloadButton}
                      onPress={() => handleDownload(exportItem)}
                    >
                      <Icon name="file-download" size={20} color={Colors.secondary} />
                    </TouchableOpacity>
                  )}
                </View>
              ))}

              {exportHistory.length === 0 && (
                <View style={styles.emptyHistory}>
                  <Icon name="history" size={48} color={Colors.lightGray} />
                  <Text style={styles.emptyHistoryText}>No export history</Text>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
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
  historyButton: {
    padding: 8,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  loadingContent: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 32,
    alignItems: 'center',
    gap: 16,
  },
  loadingText: {
    fontSize: 16,
    fontWeight: '500',
    color: Colors.text,
  },
  loadingSubtext: {
    fontSize: 14,
    color: Colors.lightText,
  },
  content: {
    flex: 1,
  },
  section: {
    backgroundColor: Colors.white,
    marginVertical: 8,
    paddingVertical: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text,
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: Colors.lightText,
    paddingHorizontal: 16,
    marginBottom: 16,
    marginTop: -8,
  },
  viewAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  viewAllText: {
    fontSize: 14,
    color: Colors.primary,
    fontWeight: '500',
  },
  templatesScroll: {
    paddingLeft: 16,
  },
  templateCard: {
    width: 200,
    backgroundColor: Colors.background,
    borderRadius: 12,
    padding: 16,
    marginRight: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
  },
  templateName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    marginTop: 12,
    marginBottom: 8,
    textAlign: 'center',
  },
  templateDescription: {
    fontSize: 12,
    color: Colors.lightText,
    textAlign: 'center',
    marginBottom: 12,
    lineHeight: 16,
  },
  templateFormat: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  templateFormatText: {
    fontSize: 10,
    fontWeight: '600',
    color: Colors.white,
  },
  dataTypesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    gap: 12,
  },
  dataTypeCard: {
    width: '47%',
    backgroundColor: Colors.background,
    borderRadius: 12,
    padding: 16,
    borderWidth: 2,
    borderColor: Colors.border,
    alignItems: 'center',
    position: 'relative',
  },
  dataTypeCardSelected: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  dataTypeName: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
    marginTop: 8,
    marginBottom: 4,
    textAlign: 'center',
  },
  dataTypeNameSelected: {
    color: Colors.white,
  },
  dataTypeDescription: {
    fontSize: 11,
    color: Colors.lightText,
    textAlign: 'center',
    lineHeight: 14,
  },
  dataTypeDescriptionSelected: {
    color: Colors.white,
    opacity: 0.9,
  },
  selectedBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.success,
    justifyContent: 'center',
    alignItems: 'center',
  },
  formatGrid: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 12,
  },
  formatButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    backgroundColor: Colors.background,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: Colors.border,
    gap: 8,
  },
  formatButtonSelected: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  formatText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
  },
  formatTextSelected: {
    color: Colors.white,
  },
  dateRangeContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 16,
  },
  dateInputContainer: {
    flex: 1,
  },
  dateLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.text,
    marginBottom: 8,
  },
  dateInput: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    color: Colors.text,
    backgroundColor: Colors.white,
  },
  settingsCard: {
    paddingHorizontal: 16,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.lightGray,
  },
  settingInfo: {
    flex: 1,
    marginRight: 16,
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: Colors.text,
    marginBottom: 4,
  },
  settingDescription: {
    fontSize: 14,
    color: Colors.lightText,
  },
  summaryCard: {
    backgroundColor: Colors.background,
    marginHorizontal: 16,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  summaryLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.text,
    flex: 1,
  },
  summaryValue: {
    fontSize: 14,
    color: Colors.darkGray,
    flex: 2,
    textAlign: 'right',
  },
  exportButton: {
    backgroundColor: Colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    marginHorizontal: 16,
    borderRadius: 12,
    gap: 8,
    marginBottom: 16,
  },
  exportButtonDisabled: {
    opacity: 0.7,
  },
  exportButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.white,
  },
  exportNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 16,
    gap: 8,
  },
  exportNoteText: {
    flex: 1,
    fontSize: 12,
    color: Colors.lightText,
    lineHeight: 16,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    width: '90%',
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.lightGray,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.text,
  },
  modalBody: {
    padding: 16,
    maxHeight: 400,
  },
  templateListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.lightGray,
  },
  templateIcon: {
    width: 48,
    height: 48,
    backgroundColor: Colors.background,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  templateContent: {
    flex: 1,
  },
  templateListName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 4,
  },
  templateListDescription: {
    fontSize: 14,
    color: Colors.lightText,
    marginBottom: 4,
  },
  templateDataTypes: {
    fontSize: 12,
    color: Colors.mediumGray,
  },
  templateFormatBadge: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  templateFormatBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: Colors.white,
  },
  historyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.lightGray,
  },
  historyContent: {
    flex: 1,
  },
  historyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  historyName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    flex: 1,
  },
  historyStatus: {
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  historyType: {
    fontSize: 14,
    color: Colors.lightText,
    marginBottom: 4,
  },
  historyDetails: {
    flexDirection: 'row',
    gap: 16,
  },
  historyDetail: {
    fontSize: 12,
    color: Colors.mediumGray,
  },
  downloadButton: {
    padding: 8,
    marginLeft: 8,
  },
  emptyHistory: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  emptyHistoryText: {
    fontSize: 16,
    color: Colors.lightText,
    marginTop: 16,
  },
});

export default DataExportScreen;
