/**
 * RestaurantPlatformOverridesScreen - Interface for restaurant owners to view and manage platform setting overrides
 * Shows effective settings and allows requesting overrides where permitted by platform policy
 */

import React, { useState, useEffect } from 'react';

import {
  View,
  ScrollView,
  StyleSheet,
  Alert,
  ActivityIndicator,
  RefreshControl,
  _Switch,
  _TextInput,
  Text,
  TouchableOpacity,
} from 'react-native';

import { useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialIcons';

import { useTheme } from '../../design-system/ThemeProvider';
import PlatformService from '../../services/PlatformService';

interface EffectiveSetting {
  key: string;
  value: unknown;
  source: 'platform' | 'restaurant';
  category: string;
  description: string;
  can_override: boolean;
  override_id?: string;
}

interface OverrideRequest {
  configKey: string;
  currentValue: unknown;
  requestedValue: unknown;
  reason: string;
  requiresApproval: boolean;
}

const RestaurantPlatformOverridesScreen: React.FC = () => {
  const navigation = useNavigation();
  const { theme } = useTheme();
  const styles = createStyles(theme);

  // Mock restaurant ID - in real app, this would come from auth context
  const restaurantId = 'restaurant-123';
  const _userRole = 'restaurant_owner'; // This would come from auth context

  const [effectiveSettings, setEffectiveSettings] = useState<Record<string, EffectiveSetting>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [_pendingOverrides, _setPendingOverrides] = useState<OverrideRequest[]>([]);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

  const platformService = PlatformService.getInstance();

  useEffect(() => {
    loadEffectiveSettings();
  }, []);

  const loadEffectiveSettings = async () => {
    try {
      setError(null);
      const settings = await platformService.getRestaurantEffectiveSettings(restaurantId);

      // Convert to our interface format
      const formattedSettings: Record<string, EffectiveSetting> = {};
      Object.entries(settings).forEach(([key, config]: [string, any]) => {
        formattedSettings[key] = {
          key,
          value: config.value,
          source: config.source,
          category: config.category,
          description: config.description,
          can_override: config.can_override,
          override_id: config.override_id,
        };
      });

      setEffectiveSettings(formattedSettings);
    } catch (err) {
      logger.error('Failed to load effective settings:', err);
      setError('Failed to load settings. Please try again.');
      // Load mock data for demo
      loadMockSettings();
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const loadMockSettings = () => {
    const mockSettings: Record<string, EffectiveSetting> = {
      'business.discount.maximum': {
        key: 'business.discount.maximum',
        value: { percentage: 50.0 },
        source: 'platform',
        category: 'business',
        description: 'Maximum discount percentage allowed',
        can_override: true,
      },
      'payment.markup.qr_code': {
        key: 'payment.markup.qr_code',
        value: { percentage: 0.2 },
        source: 'restaurant',
        category: 'payment_fees',
        description: 'QR Code payment markup',
        can_override: true,
        override_id: 'override-123',
      },
      'ui.theme.primary_color': {
        key: 'ui.theme.primary_color',
        value: '#00A651',
        source: 'platform',
        category: 'ui',
        description: 'Primary brand color',
        can_override: true,
      },
      'security.max_login_attempts': {
        key: 'security.max_login_attempts',
        value: 5,
        source: 'platform',
        category: 'security',
        description: 'Maximum login attempts before lockout',
        can_override: false,
      },
      'payment.fees.stripe': {
        key: 'payment.fees.stripe',
        value: { percentage: 1.4, fixed_fee: 0.2 },
        source: 'platform',
        category: 'payment_fees',
        description: 'Stripe payment processing fee',
        can_override: false,
      },
    };

    setEffectiveSettings(mockSettings);
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadEffectiveSettings();
  };

  const toggleCategoryExpansion = (category: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(category)) {
      newExpanded.delete(category);
    } else {
      newExpanded.add(category);
    }
    setExpandedCategories(newExpanded);
  };

  const requestOverride = async (setting: EffectiveSetting, newValue: unknown, _reason: string) => {
    try {
      const requiresApproval = shouldRequireApproval(setting.key, newValue);

      const success = await platformService.setRestaurantOverride(
        restaurantId,
        setting.key,
        newValue,
        requiresApproval
      );

      if (success) {
        Alert.alert(
          'Override Request Submitted',
          requiresApproval
            ? 'Your override request has been submitted for platform approval.'
            : 'Setting override has been applied successfully.'
        );

        // Reload settings to show updated values
        loadEffectiveSettings();
      } else {
        Alert.alert('Error', 'Failed to submit override request.');
      }
    } catch (error) {
      logger.error('Failed to request override:', error);
      Alert.alert('Error', 'An error occurred while submitting the override request.');
    }
  };

  const shouldRequireApproval = (configKey: string, value: unknown): boolean => {
    // Define rules for when approval is required
    if (configKey.includes('payment.markup') && value.percentage > 0.5) {
      return true;
    }
    if (configKey === 'business.discount.maximum' && value.percentage > 30) {
      return true;
    }
    return false;
  };

  const showOverrideDialog = (setting: EffectiveSetting) => {
    Alert.prompt(
      'Request Setting Override',
      `Current value: ${JSON.stringify(setting.value)}\n\nEnter new value:`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Submit Request',
          onPress: (newValueString) => {
            if (!newValueString) return;

            try {
              // Parse the new value (this is simplified - real implementation would have proper type handling)
              let newValue;
              try {
                newValue = JSON.parse(newValueString);
              } catch {
                // If not valid JSON, treat as string
                newValue = newValueString;
              }

              Alert.prompt(
                'Reason for Override',
                'Please provide a reason for this override request:',
                [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Submit',
                    onPress: (reason) => {
                      if (reason && reason.trim().length > 0) {
                        requestOverride(setting, newValue, reason.trim());
                      }
                    },
                  },
                ]
              );
            } catch (_error) {
              Alert.alert('Error', 'Invalid value format');
            }
          },
        },
      ]
    );
  };

  const getSettingsByCategory = () => {
    const categories: Record<string, EffectiveSetting[]> = {};

    Object.values(effectiveSettings).forEach((setting) => {
      if (!categories[setting.category]) {
        categories[setting.category] = [];
      }
      categories[setting.category].push(setting);
    });

    return categories;
  };

  const getCategoryInfo = (category: string) => {
    const categoryInfo: Record<string, { title: string; icon: string; color: string }> = {
      payment_fees: {
        title: 'Payment Processing',
        icon: 'payment',
        color: theme.colors.primary,
      },
      business: {
        title: 'Business Rules',
        icon: 'business',
        color: '#3498DB',
      },
      ui: {
        title: 'UI Customization',
        icon: 'palette',
        color: '#9B59B6',
      },
      security: {
        title: 'Security Settings',
        icon: 'security',
        color: '#E74C3C',
      },
    };

    return (
      categoryInfo[category] || {
        title: category.charAt(0).toUpperCase() + category.slice(1),
        icon: 'settings',
        color: theme.colors.textLight,
      }
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={styles.loadingText}>Loading platform settings...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const categorizedSettings = getSettingsByCategory();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Icon name="arrow-back" size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Platform Settings</Text>
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {error && (
          <View style={[styles.errorCard, { backgroundColor: theme.colors.surface }]}>
            <View style={styles.errorContent}>
              <Icon name="error" size={24} color={theme.colors.error} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
            <TouchableOpacity
              onPress={loadEffectiveSettings}
              style={[
                styles.retryButton,
                { backgroundColor: theme.colors.primary, padding: 8, borderRadius: 4 },
              ]}
            >
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={[styles.infoCard, { backgroundColor: theme.colors.surface }]}>
          <View style={styles.infoHeader}>
            <Icon name="info" size={24} color={theme.colors.primary} />
            <Text style={styles.infoTitle}>Platform Settings Overview</Text>
          </View>
          <Text style={styles.infoText}>
            These settings are controlled by the platform owner. Some settings can be customized for
            your restaurant within platform-defined limits.
          </Text>
          <View style={styles.statusIndicators}>
            <View style={styles.statusItem}>
              <View style={[styles.statusDot, { backgroundColor: theme.colors.primary }]} />
              <Text style={styles.statusText}>Platform Default</Text>
            </View>
            <View style={styles.statusItem}>
              <View style={[styles.statusDot, { backgroundColor: theme.colors.warning }]} />
              <Text style={styles.statusText}>Restaurant Override</Text>
            </View>
          </View>
        </View>

        {/* Special section for payment fees */}
        {categorizedSettings.payment_fees && (
          <View style={styles.categorySection}>
            <Text style={styles.sectionTitle}>Payment Processing Fees</Text>
            <View style={[{ backgroundColor: theme.colors.surface, padding: 16, borderRadius: 8 }]}>
              <Text style={[{ color: theme.colors.text, fontSize: 14 }]}>
                Payment fees are controlled by the platform and cannot be modified by restaurants.
              </Text>
            </View>
          </View>
        )}

        {/* Other categories */}
        {Object.entries(categorizedSettings).map(([category, settings]) => {
          if (category === 'payment_fees') return null; // Already handled above

          const categoryInfo = getCategoryInfo(category);
          const isExpanded = expandedCategories.has(category);
          const hasOverrides = settings.some((s) => s.source === 'restaurant');

          return (
            <View
              key={category}
              style={[
                styles.categoryCard,
                { backgroundColor: theme.colors.surface, borderRadius: 8 },
              ]}
            >
              <TouchableOpacity
                style={styles.categoryHeader}
                onPress={() => toggleCategoryExpansion(category)}
              >
                <View style={styles.categoryTitleContainer}>
                  <Icon name={categoryInfo.icon} size={24} color={categoryInfo.color} />
                  <View style={styles.categoryTextContainer}>
                    <Text style={styles.categoryTitle}>{categoryInfo.title}</Text>
                    <Text style={styles.categorySubtitle}>
                      {settings.length} setting{settings.length !== 1 ? 's' : ''}
                      {hasOverrides && ' • Has customizations'}
                    </Text>
                  </View>
                </View>
                <Icon
                  name={isExpanded ? 'expand-less' : 'expand-more'}
                  size={24}
                  color={theme.colors.textLight}
                />
              </TouchableOpacity>

              {isExpanded && (
                <View style={styles.settingsContainer}>
                  {settings.map((setting) => (
                    <View key={setting.key} style={styles.settingItem}>
                      <View style={styles.settingHeader}>
                        <View style={styles.settingInfo}>
                          <Text style={styles.settingName}>
                            {setting.key.split('.').pop()?.replace(/_/g, ' ') || setting.key}
                          </Text>
                          <Text style={styles.settingDescription}>{setting.description}</Text>
                        </View>
                        <View style={styles.settingStatus}>
                          <View
                            style={[
                              styles.sourceIndicator,
                              {
                                backgroundColor:
                                  setting.source === 'restaurant'
                                    ? theme.colors.warning
                                    : theme.colors.primary,
                              },
                            ]}
                          />
                        </View>
                      </View>

                      <View style={styles.settingValue}>
                        <Text style={styles.valueText}>
                          {typeof setting.value === 'object'
                            ? JSON.stringify(setting.value)
                            : setting.value.toString()}
                        </Text>
                        <Text style={styles.sourceText}>
                          {setting.source === 'restaurant'
                            ? 'Restaurant Override'
                            : 'Platform Default'}
                        </Text>
                      </View>

                      {setting.can_override && (
                        <View style={styles.actionContainer}>
                          <TouchableOpacity
                            onPress={() => showOverrideDialog(setting)}
                            style={[
                              {
                                backgroundColor:
                                  setting.source === 'restaurant'
                                    ? theme.colors.border
                                    : theme.colors.primary,
                                padding: 8,
                                borderRadius: 4,
                                borderWidth: setting.source === 'restaurant' ? 1 : 0,
                                borderColor: theme.colors.primary,
                              },
                            ]}
                          >
                            <Text
                              style={[
                                styles.overrideButtonText,
                                {
                                  color:
                                    setting.source === 'restaurant'
                                      ? theme.colors.primary
                                      : theme.colors.white,
                                },
                              ]}
                            >
                              {setting.source === 'restaurant'
                                ? 'Modify Override'
                                : 'Request Override'}
                            </Text>
                          </TouchableOpacity>
                        </View>
                      )}

                      {!setting.can_override && (
                        <View style={styles.lockedContainer}>
                          <Icon name="lock" size={16} color={theme.colors.textLight} />
                          <Text style={styles.lockedText}>Platform controlled</Text>
                        </View>
                      )}
                    </View>
                  ))}
                </View>
              )}
            </View>
          );
        })}

        <View style={styles.bottomPadding} />
      </ScrollView>
    </SafeAreaView>
  );
};

const createStyles = (theme: unknown) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 12,
      backgroundColor: theme.colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    backButton: {
      marginRight: 12,
    },
    title: {
      fontSize: 20,
      fontWeight: '600',
      color: theme.colors.text,
    },
    content: {
      flex: 1,
      paddingHorizontal: 16,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 16,
    },
    loadingText: {
      marginTop: 12,
      fontSize: 16,
      color: theme.colors.textLight,
    },
    errorCard: {
      marginTop: 16,
      padding: 16,
    },
    errorContent: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 12,
    },
    errorText: {
      marginLeft: 8,
      fontSize: 16,
      color: theme.colors.error,
      flex: 1,
    },
    retryButton: {
      alignSelf: 'flex-start',
    },
    retryButtonText: {
      color: theme.colors.white,
    },
    overrideButtonText: {
      fontSize: 12,
    },
    infoCard: {
      marginTop: 16,
      padding: 16,
    },
    infoHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 8,
    },
    infoTitle: {
      marginLeft: 8,
      fontSize: 16,
      fontWeight: '600',
      color: theme.colors.text,
    },
    infoText: {
      fontSize: 14,
      color: theme.colors.textLight,
      lineHeight: 20,
      marginBottom: 12,
    },
    statusIndicators: {
      flexDirection: 'row',
      justifyContent: 'space-around',
    },
    statusItem: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    statusDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      marginRight: 4,
    },
    statusText: {
      fontSize: 12,
      color: theme.colors.textLight,
    },
    categorySection: {
      marginTop: 16,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: theme.colors.text,
      marginBottom: 12,
    },
    categoryCard: {
      marginTop: 16,
      overflow: 'hidden',
    },
    categoryHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: 16,
    },
    categoryTitleContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
    },
    categoryTextContainer: {
      marginLeft: 12,
    },
    categoryTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.colors.text,
    },
    categorySubtitle: {
      fontSize: 12,
      color: theme.colors.textLight,
      marginTop: 2,
    },
    settingsContainer: {
      borderTopWidth: 1,
      borderTopColor: theme.colors.border,
    },
    settingItem: {
      padding: 16,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    settingHeader: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      marginBottom: 8,
    },
    settingInfo: {
      flex: 1,
    },
    settingName: {
      fontSize: 14,
      fontWeight: '500',
      color: theme.colors.text,
      textTransform: 'capitalize',
      marginBottom: 2,
    },
    settingDescription: {
      fontSize: 12,
      color: theme.colors.textLight,
    },
    settingStatus: {
      alignItems: 'flex-end',
    },
    sourceIndicator: {
      width: 12,
      height: 12,
      borderRadius: 6,
    },
    settingValue: {
      marginBottom: 8,
    },
    valueText: {
      fontSize: 14,
      color: theme.colors.text,
      fontFamily: 'monospace',
      marginBottom: 2,
    },
    sourceText: {
      fontSize: 12,
      color: theme.colors.textLight,
    },
    actionContainer: {
      alignItems: 'flex-start',
    },
    lockedContainer: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    lockedText: {
      marginLeft: 4,
      fontSize: 12,
      color: theme.colors.textLight,
      fontStyle: 'italic',
    },
    bottomPadding: {
      height: 24,
    },
  });

export default RestaurantPlatformOverridesScreen;
