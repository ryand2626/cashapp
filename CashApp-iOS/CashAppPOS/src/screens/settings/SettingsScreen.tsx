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
  FlatList,
} from 'react-native';

import { useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialIcons';

import { SubscriptionStatusCard } from '../../components/subscription/SubscriptionStatusBadge';
import Colors from '../../constants/Colors';
import { useRestaurantDisplayName } from '../../hooks/useRestaurantConfig';

interface SettingsCategory {
  id: string;
  title: string;
  description: string;
  icon: string;
  route: string;
  color: string;
  badge?: number;
  settings: SettingsItem[];
}

interface SettingsItem {
  id: string;
  title: string;
  description: string;
  icon: string;
  route: string;
}

const SettingsScreen: React.FC = () => {
  const navigation = useNavigation();
  const restaurantDisplayName = useRestaurantDisplayName();
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredCategories, setFilteredCategories] = useState<SettingsCategory[]>([]);

  const settingsCategories: SettingsCategory[] = [
    {
      id: 'business',
      title: 'Business Settings',
      description: 'Company information, taxes, and receipts',
      icon: 'business',
      route: 'BusinessSettings',
      color: Colors.primary,
      settings: [
        {
          id: 'business-info',
          title: 'Business Information',
          description: 'Company name, address, and contact details',
          icon: 'business-center',
          route: 'BusinessInformation',
        },
        {
          id: 'tax-config',
          title: 'Tax Configuration',
          description: 'VAT rates, tax exemptions, and reporting',
          icon: 'receipt-long',
          route: 'TaxConfiguration',
        },
        {
          id: 'payment-methods',
          title: 'Payment Methods',
          description: 'Enable payment options and processing fees',
          icon: 'payment',
          route: 'PaymentMethods',
        },
        {
          id: 'receipt-custom',
          title: 'Receipt Customization',
          description: 'Logo, footer text, and contact information',
          icon: 'receipt',
          route: 'ReceiptCustomization',
        },
        {
          id: 'operating-hours',
          title: 'Operating Hours',
          description: 'Business hours, holidays, and special events',
          icon: 'schedule',
          route: 'OperatingHours',
        },
      ],
    },
    {
      id: 'platform',
      title: 'Platform Settings',
      description: 'View platform-controlled settings and request overrides',
      icon: 'admin-panel-settings',
      route: 'RestaurantPlatformOverrides',
      color: '#6B73FF',
      settings: [
        {
          id: 'platform-overrides',
          title: 'Platform Overrides',
          description: 'View and request changes to platform settings',
          icon: 'settings-applications',
          route: 'RestaurantPlatformOverrides',
        },
      ],
    },
    {
      id: 'hardware',
      title: 'Hardware Configuration',
      description: 'Printers, cash drawers, and connected devices',
      icon: 'devices',
      route: 'HardwareSettings',
      color: Colors.secondary,
      settings: [
        {
          id: 'printer-setup',
          title: 'Printer Setup',
          description: 'Receipt and kitchen printer configuration',
          icon: 'print',
          route: 'PrinterSetup',
        },
        {
          id: 'cash-drawer',
          title: 'Cash Drawer',
          description: 'Drawer kick settings and security',
          icon: 'inventory-2',
          route: 'CashDrawer',
        },
        {
          id: 'barcode-scanner',
          title: 'Barcode Scanner',
          description: 'Scanner configuration and test scans',
          icon: 'qr-code-scanner',
          route: 'BarcodeScanner',
        },
        {
          id: 'card-reader',
          title: 'Card Reader',
          description: 'Payment terminal setup and testing',
          icon: 'credit-card',
          route: 'CardReader',
        },
        {
          id: 'hardware-diagnostics',
          title: 'Hardware Diagnostics',
          description: 'Device connectivity and status monitoring',
          icon: 'computer',
          route: 'HardwareDiagnostics',
        },
      ],
    },
    {
      id: 'user',
      title: 'User Preferences',
      description: 'Personal settings and accessibility options',
      icon: 'person',
      route: 'UserSettings',
      color: Colors.warning,
      settings: [
        {
          id: 'user-profile',
          title: 'User Profile',
          description: 'Personal information and PIN settings',
          icon: 'account-circle',
          route: 'UserProfile',
        },
        {
          id: 'notifications',
          title: 'Notification Settings',
          description: 'Sound alerts and popup preferences',
          icon: 'notifications',
          route: 'NotificationSettings',
        },
        {
          id: 'theme-options',
          title: 'Theme & Display',
          description: 'Dark mode, colors, and visual preferences',
          icon: 'palette',
          route: 'ThemeOptions',
        },
        {
          id: 'localization',
          title: 'Language & Region',
          description: 'Language, currency, and date formats',
          icon: 'language',
          route: 'Localization',
        },
        {
          id: 'accessibility',
          title: 'Accessibility',
          description: 'Font sizes, contrast, and screen reader',
          icon: 'accessibility',
          route: 'Accessibility',
        },
      ],
    },
    {
      id: 'app',
      title: 'App Configuration',
      description: 'Menu management, backups, and system tools',
      icon: 'settings',
      route: 'AppSettings',
      color: Colors.darkGray,
      settings: [
        {
          id: 'menu-management',
          title: 'Menu Management',
          description: 'Categories, items, and modifiers',
          icon: 'restaurant-menu',
          route: 'SettingsMenuManagement',
        },
        {
          id: 'recipes-management', // New ID for recipe settings
          title: 'Recipe Management',
          description: 'Create and manage recipes for menu items',
          icon: 'menu-book', // Or a more suitable icon like 'blender', 'restaurant'
          route: 'RecipesScreen', // Route to the new RecipesScreen
        },
        {
          id: 'pricing-discounts',
          title: 'Pricing & Discounts',
          description: 'Price rules and promotional codes',
          icon: 'local-offer',
          route: 'PricingDiscounts',
        },
        {
          id: 'backup-restore',
          title: 'Backup & Restore',
          description: 'Cloud sync and local backups',
          icon: 'backup',
          route: 'BackupRestore',
        },
        {
          id: 'data-export',
          title: 'Data Export',
          description: 'Export reports and transaction history',
          icon: 'file-download',
          route: 'DataExport',
        },
        {
          id: 'system-diagnostics',
          title: 'System Diagnostics',
          description: 'App health and performance metrics',
          icon: 'bug-report',
          route: 'SystemDiagnostics',
        },
        ...(__DEV__
          ? [
              {
                id: 'developer-settings',
                title: 'Developer Settings',
                description: 'Mock data, API toggles, and debug options',
                icon: 'developer-mode',
                route: 'DeveloperSettings',
              },
            ]
          : []),
      ],
    },
    {
      id: 'integrations',
      title: 'Integrations',
      description: 'Connect with accounting and business tools',
      icon: 'integration-instructions',
      route: 'XeroSettings',
      color: '#1271FF',
      settings: [
        {
          id: 'xero-integration',
          title: 'Xero Accounting',
          description: 'Sync sales, customers, and products with Xero',
          icon: 'account-balance',
          route: 'XeroSettings',
        },
      ],
    },
  ];

  React.useEffect(() => {
    setFilteredCategories(settingsCategories);
  }, []);

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    if (query.trim() === '') {
      setFilteredCategories(settingsCategories);
    } else {
      const filtered = settingsCategories.filter(
        (category) =>
          category.title.toLowerCase().includes(query.toLowerCase()) ||
          category.description.toLowerCase().includes(query.toLowerCase()) ||
          category.settings.some(
            (setting) =>
              setting.title.toLowerCase().includes(query.toLowerCase()) ||
              setting.description.toLowerCase().includes(query.toLowerCase())
          )
      );
      setFilteredCategories(filtered);
    }
  };

  const handleCategoryPress = (category: SettingsCategory) => {
    navigation.navigate(category.route as never);
  };

  const renderSettingsCategory = ({ item }: { item: SettingsCategory }) => (
    <TouchableOpacity
      style={styles.categoryCard}
      onPress={() => handleCategoryPress(item)}
      activeOpacity={0.7}
    >
      <View style={[styles.categoryIcon, { backgroundColor: `${item.color}15` }]}>
        <Icon name={item.icon} size={32} color={item.color} />
      </View>

      <View style={styles.categoryContent}>
        <View style={styles.categoryHeader}>
          <Text style={styles.categoryTitle}>{item.title}</Text>
          {item.badge && (
            <View style={styles.categoryBadge}>
              <Text style={styles.categoryBadgeText}>{item.badge}</Text>
            </View>
          )}
        </View>
        <Text style={styles.categoryDescription}>{item.description}</Text>
        <Text style={styles.categoryItemCount}>{item.settings.length} settings</Text>
      </View>

      <Icon name="chevron-right" size={24} color={Colors.lightGray} />
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar backgroundColor={Colors.primary} barStyle="light-content" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
        >
          <Icon name="arrow-back" size={24} color={Colors.white} />
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>{restaurantDisplayName} Settings</Text>
          <Text style={styles.headerSubtitle}>Configure your POS system</Text>
        </View>

        <TouchableOpacity style={styles.helpButton}>
          <Icon name="help-outline" size={24} color={Colors.white} />
        </TouchableOpacity>
      </View>

      {/* Search Bar */}
      <View style={styles.searchSection}>
        <View style={styles.searchContainer}>
          <Icon name="search" size={20} color={Colors.darkGray} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search settings..."
            value={searchQuery}
            onChangeText={handleSearch}
            placeholderTextColor={Colors.darkGray}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => handleSearch('')}>
              <Icon name="clear" size={20} color={Colors.darkGray} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Settings Categories */}
      <FlatList
        data={filteredCategories}
        renderItem={renderSettingsCategory}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.categoriesList}
        showsVerticalScrollIndicator={false}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListHeaderComponent={() => (
          <View style={styles.subscriptionSection}>
            <SubscriptionStatusCard />
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Icon name="search-off" size={64} color={Colors.lightGray} />
            <Text style={styles.emptyStateText}>No settings found</Text>
            <Text style={styles.emptyStateSubtext}>Try adjusting your search terms</Text>
          </View>
        }
      />

      {/* Quick Actions */}
      <View style={styles.quickActions}>
        <TouchableOpacity style={styles.quickActionButton}>
          <Icon name="backup" size={20} color={Colors.primary} />
          <Text style={styles.quickActionText}>Backup Now</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.quickActionButton}>
          <Icon name="bug-report" size={20} color={Colors.warning} />
          <Text style={styles.quickActionText}>System Check</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.quickActionButton}>
          <Icon name="help" size={20} color={Colors.secondary} />
          <Text style={styles.quickActionText}>Get Help</Text>
        </TouchableOpacity>
      </View>
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
    padding: 12,
    marginRight: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
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
  helpButton: {
    padding: 8,
  },
  searchSection: {
    backgroundColor: Colors.white,
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: Colors.text,
    marginLeft: 12,
  },
  categoriesList: {
    padding: 16,
  },
  categoryCard: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  categoryIcon: {
    width: 64,
    height: 64,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  categoryContent: {
    flex: 1,
  },
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  categoryTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text,
  },
  categoryBadge: {
    backgroundColor: Colors.danger,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  categoryBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.white,
  },
  categoryDescription: {
    fontSize: 14,
    color: Colors.darkGray,
    marginBottom: 4,
  },
  categoryItemCount: {
    fontSize: 12,
    color: Colors.lightText,
  },
  separator: {
    height: 12,
  },
  subscriptionSection: {
    paddingBottom: 20,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: '500',
    color: Colors.text,
    marginTop: 16,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: Colors.darkGray,
    marginTop: 8,
  },
  quickActions: {
    flexDirection: 'row',
    backgroundColor: Colors.white,
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  quickActionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    marginHorizontal: 4,
    backgroundColor: Colors.background,
    borderRadius: 12,
  },
  quickActionText: {
    fontSize: 12,
    fontWeight: '500',
    color: Colors.text,
    marginLeft: 6,
  },
});

export default SettingsScreen;
