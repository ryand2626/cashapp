import React, { useState } from 'react';

import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  Alert,
  Switch,
  TextInput,
  Modal,
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

interface Discount {
  id: string;
  name: string;
  description: string;
  type: 'percentage' | 'fixed_amount' | 'buy_x_get_y';
  value: number;
  minimumAmount?: number;
  maximumDiscount?: number;
  validFrom: Date;
  validTo: Date;
  isActive: boolean;
  applicableItems: string[];
  timesUsed: number;
  maxUses?: number;
}

interface PricingRule {
  id: string;
  name: string;
  type: 'bulk_discount' | 'happy_hour' | 'loyalty_tier';
  conditions: any;
  discountValue: number;
  isActive: boolean;
}

const PricingDiscountsScreen: React.FC = () => {
  const navigation = useNavigation();

  const [discounts, setDiscounts] = useState<Discount[]>([
    {
      id: 'disc1',
      name: '10% Off Coffee',
      description: 'Get 10% off all coffee drinks',
      type: 'percentage',
      value: 10,
      minimumAmount: 5,
      validFrom: new Date(),
      validTo: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
      isActive: true,
      applicableItems: ['drinks'],
      timesUsed: 45,
      maxUses: 100,
    },
    {
      id: 'disc2',
      name: 'Buy 2 Get 1 Free',
      description: 'Buy 2 pastries, get 1 free',
      type: 'buy_x_get_y',
      value: 1,
      validFrom: new Date(),
      validTo: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      isActive: true,
      applicableItems: ['pastries'],
      timesUsed: 12,
    },
  ]);

  const [pricingRules, setPricingRules] = useState<PricingRule[]>([
    {
      id: 'rule1',
      name: 'Happy Hour',
      type: 'happy_hour',
      conditions: {
        startTime: '15:00',
        endTime: '17:00',
        days: ['Monday', 'Tuesday', 'Wednesday'],
      },
      discountValue: 20,
      isActive: true,
    },
    {
      id: 'rule2',
      name: 'Bulk Coffee Discount',
      type: 'bulk_discount',
      conditions: { minQuantity: 5, category: 'drinks' },
      discountValue: 15,
      isActive: false,
    },
  ]);

  // Settings
  const [discountSettings, setDiscountSettings] = useState({
    allowStackingDiscounts: false,
    requireManagerApproval: true,
    showDiscountOnReceipt: true,
    enableLoyaltyDiscounts: true,
    autoApplyBestDiscount: true,
    enableCoupons: true,
    enableGroupDiscounts: false,
    maxDiscountPercentage: 50,
  });

  const [editingDiscount, setEditingDiscount] = useState<Discount | null>(null);
  const [showDiscountModal, setShowDiscountModal] = useState(false);

  const handleCreateDiscount = () => {
    setEditingDiscount({
      id: '',
      name: '',
      description: '',
      type: 'percentage',
      value: 0,
      validFrom: new Date(),
      validTo: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      isActive: true,
      applicableItems: [],
      timesUsed: 0,
    });
    setShowDiscountModal(true);
  };

  const handleEditDiscount = (discount: Discount) => {
    setEditingDiscount(discount);
    setShowDiscountModal(true);
  };

  const handleSaveDiscount = () => {
    if (!editingDiscount?.name.trim()) {
      Alert.alert('Error', 'Discount name is required.');
      return;
    }

    if (editingDiscount.value <= 0) {
      Alert.alert('Error', 'Discount value must be greater than 0.');
      return;
    }

    if (editingDiscount.id) {
      // Update existing discount
      setDiscounts((prev) => prev.map((d) => (d.id === editingDiscount.id ? editingDiscount : d)));
    } else {
      // Add new discount
      const newDiscount = {
        ...editingDiscount,
        id: Date.now().toString(),
      };
      setDiscounts((prev) => [...prev, newDiscount]);
    }

    setShowDiscountModal(false);
    setEditingDiscount(null);
  };

  const handleDeleteDiscount = (discountId: string) => {
    const discount = discounts.find((d) => d.id === discountId);
    Alert.alert('Delete Discount', `Delete "${discount?.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          setDiscounts((prev) => prev.filter((d) => d.id !== discountId));
        },
      },
    ]);
  };

  const toggleDiscountStatus = (discountId: string) => {
    setDiscounts((prev) =>
      prev.map((discount) =>
        discount.id === discountId ? { ...discount, isActive: !discount.isActive } : discount
      )
    );
  };

  const togglePricingRule = (ruleId: string) => {
    setPricingRules((prev) =>
      prev.map((rule) => (rule.id === ruleId ? { ...rule, isActive: !rule.isActive } : rule))
    );
  };

  const toggleDiscountSetting = (setting: keyof typeof discountSettings) => {
    setDiscountSettings((prev) => ({
      ...prev,
      [setting]: !prev[setting],
    }));
  };

  const getDiscountTypeIcon = (type: string) => {
    switch (type) {
      case 'percentage':
        return 'percent';
      case 'fixed_amount':
        return 'attach-money';
      case 'buy_x_get_y':
        return 'redeem';
      default:
        return 'local-offer';
    }
  };

  const formatDiscountValue = (discount: Discount) => {
    switch (discount.type) {
      case 'percentage':
        return `${discount.value}% off`;
      case 'fixed_amount':
        return `£${discount.value.toFixed(2)} off`;
      case 'buy_x_get_y':
        return `Buy X Get ${discount.value} Free`;
      default:
        return `${discount.value}`;
    }
  };

  const isDiscountExpired = (discount: Discount) => {
    return new Date() > discount.validTo;
  };

  const isDiscountActive = (discount: Discount) => {
    const now = new Date();
    return discount.isActive && now >= discount.validFrom && now <= discount.validTo;
  };

  const DiscountCard = ({ discount }: { discount: Discount }) => (
    <View
      style={[
        styles.discountCard,
        !discount.isActive && styles.inactiveCard,
        isDiscountExpired(discount) && styles.expiredCard,
      ]}
    >
      <View style={styles.discountHeader}>
        <View style={styles.discountInfo}>
          <View style={styles.discountTitleRow}>
            <Icon
              name={getDiscountTypeIcon(discount.type)}
              size={20}
              color={isDiscountActive(discount) ? Colors.primary : Colors.mediumGray}
            />
            <Text style={[styles.discountName, !isDiscountActive(discount) && styles.inactiveText]}>
              {discount.name}
            </Text>
            {isDiscountExpired(discount) && (
              <View style={styles.expiredBadge}>
                <Text style={styles.expiredText}>Expired</Text>
              </View>
            )}
          </View>

          <Text
            style={[styles.discountDescription, !isDiscountActive(discount) && styles.inactiveText]}
          >
            {discount.description}
          </Text>

          <View style={styles.discountDetails}>
            <Text style={styles.discountValue}>{formatDiscountValue(discount)}</Text>
            {discount.minimumAmount && (
              <Text style={styles.discountCondition}>
                Min: £{discount.minimumAmount.toFixed(2)}
              </Text>
            )}
          </View>

          <View style={styles.discountStats}>
            <Text style={styles.discountStat}>
              Used: {discount.timesUsed}
              {discount.maxUses ? `/${discount.maxUses}` : ''}
            </Text>
            <Text style={styles.discountStat}>
              Valid until: {discount.validTo.toLocaleDateString()}
            </Text>
          </View>
        </View>

        <View style={styles.discountActions}>
          <Switch
            value={discount.isActive}
            onValueChange={() => toggleDiscountStatus(discount.id)}
            trackColor={{ false: Colors.lightGray, true: Colors.primary }}
            thumbColor={Colors.white}
            style={styles.discountSwitch}
          />
        </View>
      </View>

      <View style={styles.discountButtons}>
        <TouchableOpacity
          style={styles.discountButton}
          onPress={() => handleEditDiscount(discount)}
        >
          <Icon name="edit" size={16} color={Colors.secondary} />
          <Text style={styles.discountButtonText}>Edit</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.discountButton, styles.deleteButton]}
          onPress={() => handleDeleteDiscount(discount.id)}
        >
          <Icon name="delete" size={16} color={Colors.danger} />
          <Text style={[styles.discountButtonText, styles.deleteButtonText]}>Delete</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.discountButton}
          onPress={() => Alert.alert('Analytics', `View analytics for ${discount.name}`)}
        >
          <Icon name="analytics" size={16} color={Colors.success} />
          <Text style={styles.discountButtonText}>Analytics</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const PricingRuleCard = ({ rule }: { rule: PricingRule }) => (
    <View style={[styles.ruleCard, !rule.isActive && styles.inactiveCard]}>
      <View style={styles.ruleHeader}>
        <View style={styles.ruleInfo}>
          <Text style={[styles.ruleName, !rule.isActive && styles.inactiveText]}>{rule.name}</Text>
          <Text style={styles.ruleType}>{rule.type.replace('_', ' ').toUpperCase()}</Text>
          <Text style={styles.ruleDiscount}>{rule.discountValue}% discount</Text>
        </View>

        <Switch
          value={rule.isActive}
          onValueChange={() => togglePricingRule(rule.id)}
          trackColor={{ false: Colors.lightGray, true: Colors.primary }}
          thumbColor={Colors.white}
        />
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Icon name="arrow-back" size={24} color={Colors.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Pricing & Discounts</Text>
        <TouchableOpacity style={styles.addButton} onPress={handleCreateDiscount}>
          <Icon name="add" size={24} color={Colors.white} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Quick Stats */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Overview</Text>
          <View style={styles.statsContainer}>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{discounts.filter((d) => d.isActive).length}</Text>
              <Text style={styles.statLabel}>Active Discounts</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>
                {discounts.reduce((sum, d) => sum + d.timesUsed, 0)}
              </Text>
              <Text style={styles.statLabel}>Total Uses</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{pricingRules.filter((r) => r.isActive).length}</Text>
              <Text style={styles.statLabel}>Active Rules</Text>
            </View>
          </View>
        </View>

        {/* Active Discounts */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Discounts</Text>
            <TouchableOpacity style={styles.createButton} onPress={handleCreateDiscount}>
              <Icon name="add" size={20} color={Colors.primary} />
              <Text style={styles.createButtonText}>Create</Text>
            </TouchableOpacity>
          </View>

          {discounts.map((discount) => (
            <DiscountCard key={discount.id} discount={discount} />
          ))}

          {discounts.length === 0 && (
            <View style={styles.emptyState}>
              <Icon name="local-offer" size={48} color={Colors.lightGray} />
              <Text style={styles.emptyStateText}>No discounts configured</Text>
              <TouchableOpacity style={styles.emptyStateButton} onPress={handleCreateDiscount}>
                <Text style={styles.emptyStateButtonText}>Create First Discount</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Pricing Rules */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Pricing Rules</Text>
          {pricingRules.map((rule) => (
            <PricingRuleCard key={rule.id} rule={rule} />
          ))}
        </View>

        {/* Discount Settings */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Discount Settings</Text>
          <View style={styles.settingsCard}>
            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingLabel}>Allow stacking discounts</Text>
                <Text style={styles.settingDescription}>
                  Apply multiple discounts to the same order
                </Text>
              </View>
              <Switch
                value={discountSettings.allowStackingDiscounts}
                onValueChange={() => toggleDiscountSetting('allowStackingDiscounts')}
                trackColor={{ false: Colors.lightGray, true: Colors.primary }}
                thumbColor={Colors.white}
              />
            </View>

            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingLabel}>Require manager approval</Text>
                <Text style={styles.settingDescription}>Manager must approve large discounts</Text>
              </View>
              <Switch
                value={discountSettings.requireManagerApproval}
                onValueChange={() => toggleDiscountSetting('requireManagerApproval')}
                trackColor={{ false: Colors.lightGray, true: Colors.primary }}
                thumbColor={Colors.white}
              />
            </View>

            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingLabel}>Show discount on receipt</Text>
                <Text style={styles.settingDescription}>
                  Display discount details on customer receipt
                </Text>
              </View>
              <Switch
                value={discountSettings.showDiscountOnReceipt}
                onValueChange={() => toggleDiscountSetting('showDiscountOnReceipt')}
                trackColor={{ false: Colors.lightGray, true: Colors.primary }}
                thumbColor={Colors.white}
              />
            </View>

            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingLabel}>Auto-apply best discount</Text>
                <Text style={styles.settingDescription}>
                  Automatically apply the best available discount
                </Text>
              </View>
              <Switch
                value={discountSettings.autoApplyBestDiscount}
                onValueChange={() => toggleDiscountSetting('autoApplyBestDiscount')}
                trackColor={{ false: Colors.lightGray, true: Colors.primary }}
                thumbColor={Colors.white}
              />
            </View>
          </View>
        </View>

        {/* Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Actions</Text>
          <View style={styles.actionCard}>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => Alert.alert('Info', 'Import discounts from file')}
            >
              <Icon name="file-upload" size={24} color={Colors.secondary} />
              <Text style={styles.actionButtonText}>Import Discounts</Text>
              <Icon name="chevron-right" size={24} color={Colors.lightText} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => Alert.alert('Info', 'Export current discounts')}
            >
              <Icon name="file-download" size={24} color={Colors.secondary} />
              <Text style={styles.actionButtonText}>Export Discounts</Text>
              <Icon name="chevron-right" size={24} color={Colors.lightText} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => Alert.alert('Info', 'View discount analytics')}
            >
              <Icon name="analytics" size={24} color={Colors.success} />
              <Text style={styles.actionButtonText}>View Analytics</Text>
              <Icon name="chevron-right" size={24} color={Colors.lightText} />
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      {/* Discount Edit Modal */}
      <Modal
        visible={showDiscountModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowDiscountModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingDiscount?.id ? 'Edit Discount' : 'Create Discount'}
              </Text>
              <TouchableOpacity onPress={() => setShowDiscountModal(false)}>
                <Icon name="close" size={24} color={Colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              <Text style={styles.inputLabel}>Discount Name *</Text>
              <TextInput
                style={styles.textInput}
                value={editingDiscount?.name || ''}
                onChangeText={(text) =>
                  setEditingDiscount((prev) => (prev ? { ...prev, name: text } : null))
                }
                placeholder="Enter discount name"
              />

              <Text style={styles.inputLabel}>Description</Text>
              <TextInput
                style={[styles.textInput, styles.textArea]}
                value={editingDiscount?.description || ''}
                onChangeText={(text) =>
                  setEditingDiscount((prev) => (prev ? { ...prev, description: text } : null))
                }
                placeholder="Enter discount description"
                multiline
                numberOfLines={3}
              />

              <Text style={styles.inputLabel}>Discount Value *</Text>
              <TextInput
                style={styles.textInput}
                value={editingDiscount?.value?.toString() || ''}
                onChangeText={(text) =>
                  setEditingDiscount((prev) =>
                    prev ? { ...prev, value: parseFloat(text) || 0 } : null
                  )
                }
                placeholder={editingDiscount?.type === 'percentage' ? '10' : '5.00'}
                keyboardType="decimal-pad"
              />

              <View style={styles.checkboxRow}>
                <TouchableOpacity
                  style={styles.checkbox}
                  onPress={() =>
                    setEditingDiscount((prev) =>
                      prev ? { ...prev, isActive: !prev.isActive } : null
                    )
                  }
                >
                  <Icon
                    name={editingDiscount?.isActive ? 'check-box' : 'check-box-outline-blank'}
                    size={24}
                    color={Colors.primary}
                  />
                  <Text style={styles.checkboxLabel}>Active</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setShowDiscountModal(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveButton} onPress={handleSaveDiscount}>
                <Text style={styles.saveButtonText}>Save</Text>
              </TouchableOpacity>
            </View>
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
  addButton: {
    padding: 8,
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
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: Colors.white,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Colors.primary,
    gap: 4,
  },
  createButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.primary,
  },
  statsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 16,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 16,
    backgroundColor: Colors.background,
    borderRadius: 8,
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.primary,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: Colors.lightText,
  },
  discountCard: {
    backgroundColor: Colors.background,
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  inactiveCard: {
    opacity: 0.6,
  },
  expiredCard: {
    backgroundColor: Colors.lightGray,
  },
  discountHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  discountInfo: {
    flex: 1,
    marginRight: 16,
  },
  discountTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  discountName: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text,
    flex: 1,
  },
  inactiveText: {
    color: Colors.mediumGray,
  },
  expiredBadge: {
    backgroundColor: Colors.danger,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  expiredText: {
    fontSize: 10,
    fontWeight: '500',
    color: Colors.white,
  },
  discountDescription: {
    fontSize: 14,
    color: Colors.lightText,
    marginBottom: 8,
  },
  discountDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 8,
  },
  discountValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.primary,
  },
  discountCondition: {
    fontSize: 12,
    color: Colors.lightText,
  },
  discountStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  discountStat: {
    fontSize: 12,
    color: Colors.lightText,
  },
  discountActions: {
    alignItems: 'flex-end',
  },
  discountSwitch: {
    marginBottom: 8,
  },
  discountButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  discountButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: Colors.white,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 4,
  },
  deleteButton: {
    borderColor: Colors.danger,
  },
  discountButtonText: {
    fontSize: 12,
    fontWeight: '500',
    color: Colors.text,
  },
  deleteButtonText: {
    color: Colors.danger,
  },
  ruleCard: {
    backgroundColor: Colors.background,
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  ruleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  ruleInfo: {
    flex: 1,
  },
  ruleName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 4,
  },
  ruleType: {
    fontSize: 12,
    color: Colors.secondary,
    fontWeight: '500',
    marginBottom: 4,
  },
  ruleDiscount: {
    fontSize: 14,
    color: Colors.primary,
    fontWeight: '500',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 24,
  },
  emptyStateText: {
    fontSize: 16,
    color: Colors.lightText,
    marginTop: 16,
    marginBottom: 16,
  },
  emptyStateButton: {
    backgroundColor: Colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  emptyStateButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: Colors.white,
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
  actionCard: {
    paddingHorizontal: 16,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.lightGray,
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: Colors.text,
    marginLeft: 12,
    flex: 1,
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
  inputLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: Colors.text,
    marginBottom: 8,
    marginTop: 16,
  },
  textInput: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 16,
    color: Colors.text,
    backgroundColor: Colors.white,
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  checkboxRow: {
    flexDirection: 'row',
    marginTop: 16,
    gap: 24,
  },
  checkbox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  checkboxLabel: {
    fontSize: 16,
    color: Colors.text,
  },
  modalActions: {
    flexDirection: 'row',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: Colors.lightGray,
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 12,
    backgroundColor: Colors.background,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: Colors.text,
  },
  saveButton: {
    flex: 1,
    paddingVertical: 12,
    backgroundColor: Colors.primary,
    borderRadius: 8,
    alignItems: 'center',
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: Colors.white,
  },
});

export default PricingDiscountsScreen;
