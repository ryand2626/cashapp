import React, { useState, useEffect } from 'react';

import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  Modal,
} from 'react-native';

import Icon from 'react-native-vector-icons/MaterialIcons';

import SharedDataStore from '../../services/SharedDataStore';
import useAppStore from '../../store/useAppStore';
import useSettingsStore from '../../store/useSettingsStore';
import { _Order } from '../../types';

import type { OrderItem } from '../../types';

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

interface OrderManagementProps {
  visible: boolean;
  onClose: () => void;
  onCheckout: () => void;
}

const OrderManagement: React.FC<OrderManagementProps> = ({ visible, onClose, onCheckout }) => {
  const { cart, updateCartItem, removeFromCart, clearCart, _cartTotal, _cartItemCount } =
    useAppStore();

  const { taxConfiguration } = useSettingsStore();

  const [editingItem, setEditingItem] = useState<OrderItem | null>(null);
  const [splitMode, setSplitMode] = useState(false);
  const [selectedItems, setSelectedItems] = useState<number[]>([]);
  const [customerName, setCustomerName] = useState('');
  const [tableNumber, setTableNumber] = useState('');
  const [orderNotes, setOrderNotes] = useState('');

  // Platform service charge configuration (real-time from platform owner)
  const [platformServiceCharge, setPlatformServiceCharge] = useState({
    enabled: false,
    rate: 0,
    description: 'Loading platform service charge...',
  });

  // Calculate totals
  const calculateSubtotal = () => {
    return cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  };

  const calculateTax = (subtotal: number) => {
    if (!taxConfiguration.vatEnabled) return 0;
    return subtotal * (taxConfiguration.vatRate / 100);
  };

  const calculateServiceCharge = (subtotal: number) => {
    // Use PLATFORM service charge settings, not restaurant settings
    if (!platformServiceCharge.enabled) return 0;
    return subtotal * (platformServiceCharge.rate / 100);
  };

  // Load platform service charge configuration on component mount
  useEffect(() => {
    const loadPlatformServiceCharge = async () => {
      try {
        logger.info('💰 OrderManagement - Loading platform service charge...');
        const dataStore = SharedDataStore.getInstance();
        const config = await dataStore.getServiceChargeConfig();

        if (config) {
          setPlatformServiceCharge({
            enabled: config.enabled,
            rate: config.rate,
            description: config.description || 'Platform service charge',
          });
          logger.info('✅ Platform service charge loaded in OrderManagement:', config);
        } else {
          logger.info('⚠️ No platform service charge config found in OrderManagement');
        }
      } catch (error) {
        logger.error('❌ Failed to load platform service charge in OrderManagement:', error);
      }
    };

    loadPlatformServiceCharge();

    // Subscribe to real-time updates
    const dataStore = SharedDataStore.getInstance();
    const unsubscribe = dataStore.subscribe('serviceCharge', (updatedConfig) => {
      logger.info('🔄 Platform service charge updated in OrderManagement:', updatedConfig);
      setPlatformServiceCharge({
        enabled: updatedConfig.enabled,
        rate: updatedConfig.rate,
        description: updatedConfig.description || 'Platform service charge',
      });
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const calculateTotal = () => {
    const subtotal = calculateSubtotal();
    const tax = calculateTax(subtotal);
    const service = calculateServiceCharge(subtotal);
    return subtotal + tax + service;
  };

  const handleQuantityChange = (item: OrderItem, delta: number) => {
    const newQuantity = item.quantity + delta;
    if (newQuantity <= 0) {
      removeFromCart(item.id);
    } else {
      updateCartItem(item.id, { quantity: newQuantity });
    }
  };

  const handleEditItem = (item: OrderItem) => {
    setEditingItem(item);
  };

  const handleSaveEdit = () => {
    if (editingItem) {
      updateCartItem(editingItem.id, editingItem);
      setEditingItem(null);
    }
  };

  const handleSplitOrder = () => {
    if (selectedItems.length === 0) {
      Alert.alert('Select Items', 'Please select items to split into a new order');
      return;
    }

    Alert.alert('Split Order', `Split ${selectedItems.length} items into a new order?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Split',
        onPress: () => {
          // In a real app, this would create a new order
          setSplitMode(false);
          setSelectedItems([]);
          Alert.alert('Success', 'Order split successfully');
        },
      },
    ]);
  };

  const toggleItemSelection = (itemId: number) => {
    setSelectedItems((prev) => {
      if (prev.includes(itemId)) {
        return prev.filter((id) => id !== itemId);
      } else {
        return [...prev, itemId];
      }
    });
  };

  const handleVoidOrder = () => {
    Alert.alert('Void Order', 'Are you sure you want to void this entire order?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Void',
        style: 'destructive',
        onPress: () => {
          clearCart();
          onClose();
        },
      },
    ]);
  };

  const handlePrintOrder = () => {
    Alert.alert('Print Order', 'Order sent to kitchen printer');
  };

  const renderOrderItem = (item: OrderItem) => {
    const isSelected = selectedItems.includes(item.id);

    return (
      <View key={item.id} style={styles.orderItem}>
        {splitMode && (
          <TouchableOpacity
            style={[styles.checkbox, isSelected && styles.checkboxSelected]}
            onPress={() => toggleItemSelection(item.id)}
          >
            {isSelected && <Icon name="check" size={16} color={Colors.white} />}
          </TouchableOpacity>
        )}

        <View style={styles.itemDetails}>
          <Text style={styles.itemName}>{item.name}</Text>
          {item.modifications && item.modifications.length > 0 && (
            <Text style={styles.itemModifications}>{item.modifications.join(', ')}</Text>
          )}
          {item.notes && <Text style={styles.itemNotes}>Note: {item.notes}</Text>}
        </View>

        <View style={styles.itemActions}>
          <View style={styles.quantityControls}>
            <TouchableOpacity
              style={styles.quantityButton}
              onPress={() => handleQuantityChange(item, -1)}
            >
              <Icon name="remove" size={18} color={Colors.primary} />
            </TouchableOpacity>
            <Text style={styles.quantityText}>{item.quantity}</Text>
            <TouchableOpacity
              style={styles.quantityButton}
              onPress={() => handleQuantityChange(item, 1)}
            >
              <Icon name="add" size={18} color={Colors.primary} />
            </TouchableOpacity>
          </View>

          <Text style={styles.itemPrice}>£{(item.price * item.quantity).toFixed(2)}</Text>

          <TouchableOpacity style={styles.editButton} onPress={() => handleEditItem(item)}>
            <Icon name="edit" size={18} color={Colors.secondary} />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderEditModal = () => {
    if (!editingItem) return null;

    return (
      <Modal
        visible={!!editingItem}
        transparent
        animationType="slide"
        onRequestClose={() => setEditingItem(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.editModalContent}>
            <View style={styles.editModalHeader}>
              <Text style={styles.editModalTitle}>Edit Item</Text>
              <TouchableOpacity onPress={() => setEditingItem(null)}>
                <Icon name="close" size={24} color={Colors.darkGray} />
              </TouchableOpacity>
            </View>

            <View style={styles.editModalBody}>
              <Text style={styles.editItemName}>{editingItem.name}</Text>

              <View style={styles.editSection}>
                <Text style={styles.editLabel}>Special Instructions</Text>
                <TextInput
                  style={styles.editInput}
                  value={editingItem.notes || ''}
                  onChangeText={(text) => setEditingItem({ ...editingItem, notes: text })}
                  placeholder="Add special instructions..."
                  multiline
                  numberOfLines={3}
                />
              </View>

              <View style={styles.editSection}>
                <Text style={styles.editLabel}>Quantity</Text>
                <View style={styles.editQuantityControls}>
                  <TouchableOpacity
                    style={styles.editQuantityButton}
                    onPress={() =>
                      setEditingItem({
                        ...editingItem,
                        quantity: Math.max(1, editingItem.quantity - 1),
                      })
                    }
                  >
                    <Icon name="remove" size={24} color={Colors.primary} />
                  </TouchableOpacity>
                  <Text style={styles.editQuantityText}>{editingItem.quantity}</Text>
                  <TouchableOpacity
                    style={styles.editQuantityButton}
                    onPress={() =>
                      setEditingItem({
                        ...editingItem,
                        quantity: editingItem.quantity + 1,
                      })
                    }
                  >
                    <Icon name="add" size={24} color={Colors.primary} />
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            <View style={styles.editModalFooter}>
              <TouchableOpacity
                style={[styles.editButton, styles.deleteButton]}
                onPress={() => {
                  removeFromCart(editingItem.id);
                  setEditingItem(null);
                }}
              >
                <Text style={styles.deleteButtonText}>Remove Item</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.editButton, styles.saveButton]}
                onPress={handleSaveEdit}
              >
                <Text style={styles.saveButtonText}>Save Changes</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Icon name="close" size={24} color={Colors.white} />
          </TouchableOpacity>

          <Text style={styles.headerTitle}>Current Order</Text>

          <View style={styles.headerActions}>
            <TouchableOpacity style={styles.headerButton} onPress={handlePrintOrder}>
              <Icon name="print" size={20} color={Colors.white} />
            </TouchableOpacity>

            <TouchableOpacity style={styles.headerButton} onPress={() => setSplitMode(!splitMode)}>
              <Icon name="call-split" size={20} color={Colors.white} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Order Info */}
        <View style={styles.orderInfo}>
          <View style={styles.infoRow}>
            <TextInput
              style={styles.infoInput}
              placeholder="Customer Name"
              value={customerName}
              onChangeText={setCustomerName}
            />
            <TextInput
              style={[styles.infoInput, styles.tableInput]}
              placeholder="Table #"
              value={tableNumber}
              onChangeText={setTableNumber}
              keyboardType="numeric"
            />
          </View>

          {splitMode && (
            <View style={styles.splitModeBar}>
              <Text style={styles.splitModeText}>
                Select items to split - {selectedItems.length} selected
              </Text>
              <TouchableOpacity
                style={styles.splitButton}
                onPress={handleSplitOrder}
                disabled={selectedItems.length === 0}
              >
                <Text style={styles.splitButtonText}>Split Order</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Order Items */}
        <ScrollView style={styles.itemsList} showsVerticalScrollIndicator={false}>
          {cart.length === 0 ? (
            <View style={styles.emptyCart}>
              <Icon name="shopping-cart" size={64} color={Colors.lightGray} />
              <Text style={styles.emptyCartText}>Your cart is empty</Text>
              <Text style={styles.emptyCartSubtext}>Add items to get started</Text>
            </View>
          ) : (
            cart.map(renderOrderItem)
          )}
        </ScrollView>

        {/* Order Notes */}
        {cart.length > 0 && (
          <View style={styles.notesSection}>
            <Text style={styles.notesLabel}>Order Notes</Text>
            <TextInput
              style={styles.notesInput}
              placeholder="Add notes for kitchen..."
              value={orderNotes}
              onChangeText={setOrderNotes}
              multiline
              numberOfLines={2}
            />
          </View>
        )}

        {/* Order Summary */}
        {cart.length > 0 && (
          <View style={styles.summary}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Subtotal</Text>
              <Text style={styles.summaryValue}>£{calculateSubtotal().toFixed(2)}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>VAT (20%)</Text>
              <Text style={styles.summaryValue}>
                £{calculateTax(calculateSubtotal()).toFixed(2)}
              </Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Service (12.5%)</Text>
              <Text style={styles.summaryValue}>
                £{calculateServiceCharge(calculateSubtotal()).toFixed(2)}
              </Text>
            </View>
            <View style={[styles.summaryRow, styles.totalRow]}>
              <Text style={styles.totalLabel}>Total</Text>
              <Text style={styles.totalValue}>£{calculateTotal().toFixed(2)}</Text>
            </View>
          </View>
        )}

        {/* Actions */}
        {cart.length > 0 && (
          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.actionButton, styles.voidButton]}
              onPress={handleVoidOrder}
            >
              <Icon name="delete" size={20} color={Colors.danger} />
              <Text style={styles.voidButtonText}>Void Order</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionButton, styles.checkoutButton]}
              onPress={onCheckout}
            >
              <Icon name="payment" size={20} color={Colors.white} />
              <Text style={styles.checkoutButtonText}>Checkout</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {renderEditModal()}
    </Modal>
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
  closeButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.white,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 12,
  },
  headerButton: {
    padding: 8,
  },
  orderInfo: {
    backgroundColor: Colors.white,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  infoRow: {
    flexDirection: 'row',
    gap: 12,
  },
  infoInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 16,
  },
  tableInput: {
    flex: 0.3,
  },
  splitModeBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: Colors.warning + '20',
    borderRadius: 8,
  },
  splitModeText: {
    fontSize: 14,
    color: Colors.warning,
    fontWeight: '500',
  },
  splitButton: {
    backgroundColor: Colors.warning,
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 6,
  },
  splitButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.white,
  },
  itemsList: {
    flex: 1,
  },
  orderItem: {
    backgroundColor: Colors.white,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: Colors.border,
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxSelected: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  itemDetails: {
    flex: 1,
  },
  itemName: {
    fontSize: 16,
    fontWeight: '500',
    color: Colors.text,
  },
  itemModifications: {
    fontSize: 14,
    color: Colors.lightText,
    fontStyle: 'italic',
  },
  itemNotes: {
    fontSize: 14,
    color: Colors.warning,
    marginTop: 2,
  },
  itemActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  quantityControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  quantityButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quantityText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    minWidth: 20,
    textAlign: 'center',
  },
  itemPrice: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.primary,
    minWidth: 60,
    textAlign: 'right',
  },
  editButton: {
    padding: 4,
  },
  emptyCart: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
  },
  emptyCartText: {
    fontSize: 18,
    fontWeight: '500',
    color: Colors.text,
    marginTop: 16,
  },
  emptyCartSubtext: {
    fontSize: 14,
    color: Colors.lightText,
    marginTop: 8,
  },
  notesSection: {
    backgroundColor: Colors.white,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  notesLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.text,
    marginBottom: 8,
  },
  notesInput: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    textAlignVertical: 'top',
  },
  summary: {
    backgroundColor: Colors.white,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  summaryLabel: {
    fontSize: 14,
    color: Colors.lightText,
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.text,
  },
  totalRow: {
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: 8,
    marginTop: 4,
    marginBottom: 0,
  },
  totalLabel: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text,
  },
  totalValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.primary,
  },
  actions: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 16,
    paddingBottom: 32,
    gap: 12,
    backgroundColor: Colors.white,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 8,
    gap: 8,
  },
  voidButton: {
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.danger,
  },
  voidButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.danger,
  },
  checkoutButton: {
    backgroundColor: Colors.primary,
  },
  checkoutButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.white,
  },
  // Edit Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  editModalContent: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    width: '90%',
    maxWidth: 400,
  },
  editModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  editModalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text,
  },
  editModalBody: {
    padding: 20,
  },
  editItemName: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 20,
  },
  editSection: {
    marginBottom: 20,
  },
  editLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.text,
    marginBottom: 8,
  },
  editInput: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    textAlignVertical: 'top',
  },
  editQuantityControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
  },
  editQuantityButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  editQuantityText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.text,
    minWidth: 40,
    textAlign: 'center',
  },
  editModalFooter: {
    flexDirection: 'row',
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    gap: 12,
  },
  deleteButton: {
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.danger,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  deleteButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.danger,
  },
  saveButton: {
    backgroundColor: Colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.white,
  },
});

export default OrderManagement;
