import React, { useState } from 'react';

import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  TextInput,
  Modal,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';

import Icon from 'react-native-vector-icons/MaterialIcons';

import useAppStore from '../../store/useAppStore';
import SimpleDecimalInput from '../inputs/SimpleDecimalInput';
import SimpleTextInput from '../inputs/SimpleTextInput';

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

interface CustomItemEntryProps {
  visible: boolean;
  onClose: () => void;
}

// Quick access preset amounts
const presetAmounts = [5, 10, 15, 20, 25, 50];

// Common custom items
const commonItems = [
  { name: 'Open Food', emoji: '🍽️' },
  { name: 'Open Drink', emoji: '🥤' },
  { name: 'Discount', emoji: '💷' },
  { name: 'Delivery Fee', emoji: '🚚' },
  { name: 'Service Charge', emoji: '💳' },
  { name: 'Miscellaneous', emoji: '📦' },
];

const CustomItemEntry: React.FC<CustomItemEntryProps> = ({ visible, onClose }) => {
  const { addToCart } = useAppStore();

  const [itemName, setItemName] = useState('');
  const [price, setPrice] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [selectedEmoji, setSelectedEmoji] = useState('🍽️');
  const [notes, setNotes] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  const emojis = [
    '🍽️',
    '🥤',
    '🍺',
    '☕',
    '🍷',
    '🥃',
    '🍹',
    '🧃',
    '🍕',
    '🍔',
    '🌮',
    '🌯',
    '🥗',
    '🥙',
    '🍜',
    '🍲',
    '🍰',
    '🧁',
    '🍪',
    '🍩',
    '🍨',
    '🍮',
    '🎂',
    '🍫',
    '🍟',
    '🥨',
    '🥖',
    '🧀',
    '🥓',
    '🥚',
    '🥞',
    '🧇',
    '💳',
    '💷',
    '🎁',
    '📦',
    '🚚',
    '⭐',
    '❤️',
    '👍',
  ];

  const handleAddItem = () => {
    if (!itemName.trim()) {
      alert('Please enter an item name');
      return;
    }

    if (price <= 0) {
      alert('Please enter a valid price');
      return;
    }

    const customItem: OrderItem = {
      id: Date.now(), // Generate unique ID
      name: itemName,
      price,
      quantity,
      emoji: selectedEmoji,
      notes: notes || undefined,
    };

    addToCart(customItem);
    handleReset();
    onClose();
  };

  const handleReset = () => {
    setItemName('');
    setPrice(0);
    setQuantity(1);
    setSelectedEmoji('🍽️');
    setNotes('');
  };

  const handlePresetAmount = (amount: number) => {
    setPrice(amount);
  };

  const handleCommonItem = (item: { name: string; emoji: string }) => {
    setItemName(item.name);
    setSelectedEmoji(item.emoji);
  };

  // formatPrice function removed - DecimalInput handles validation internally

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.modalOverlay}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.modalContent}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Add Custom Item</Text>
            <TouchableOpacity onPress={onClose}>
              <Icon name="close" size={24} color={Colors.darkGray} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
            {/* Common Items */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Common Items</Text>
              <View style={styles.commonItemsGrid}>
                {commonItems.map((item, index) => (
                  <TouchableOpacity
                    key={index}
                    style={[styles.commonItem, itemName === item.name && styles.commonItemSelected]}
                    onPress={() => handleCommonItem(item)}
                  >
                    <Text style={styles.commonItemEmoji}>{item.emoji}</Text>
                    <Text style={styles.commonItemName}>{item.name}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Item Details */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Item Details</Text>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Item Name</Text>
                <View style={styles.nameInputContainer}>
                  <TouchableOpacity
                    style={styles.emojiButton}
                    onPress={() => setShowEmojiPicker(!showEmojiPicker)}
                  >
                    <Text style={styles.selectedEmoji}>{selectedEmoji}</Text>
                  </TouchableOpacity>
                  <SimpleTextInput
                    value={itemName}
                    onValueChange={setItemName}
                    placeholder="Enter item name..."
                    style={styles.nameInput}
                    clearButtonMode="while-editing"
                  />
                </View>
              </View>

              {/* Emoji Picker */}
              {showEmojiPicker && (
                <View style={styles.emojiPicker}>
                  {emojis.map((emoji, index) => (
                    <TouchableOpacity
                      key={index}
                      style={styles.emojiOption}
                      onPress={() => {
                        setSelectedEmoji(emoji);
                        setShowEmojiPicker(false);
                      }}
                    >
                      <Text style={styles.emojiText}>{emoji}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              <View style={styles.inputGroup}>
                <SimpleDecimalInput
                  label="Price"
                  value={price}
                  onValueChange={setPrice}
                  suffix="£"
                  maxValue={999.99}
                  minValue={0.01}
                  decimalPlaces={2}
                  placeholder="5.00"
                  style={{ marginVertical: 8 }}
                />
              </View>

              {/* Preset Amounts */}
              <View style={styles.presetAmounts}>
                {presetAmounts.map((amount) => (
                  <TouchableOpacity
                    key={amount}
                    style={styles.presetButton}
                    onPress={() => handlePresetAmount(amount)}
                  >
                    <Text style={styles.presetButtonText}>£{amount}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Quantity */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Quantity</Text>
                <View style={styles.quantityControls}>
                  <TouchableOpacity
                    style={styles.quantityButton}
                    onPress={() => setQuantity(Math.max(1, quantity - 1))}
                  >
                    <Icon name="remove" size={24} color={Colors.primary} />
                  </TouchableOpacity>
                  <Text style={styles.quantityText}>{quantity}</Text>
                  <TouchableOpacity
                    style={styles.quantityButton}
                    onPress={() => setQuantity(quantity + 1)}
                  >
                    <Icon name="add" size={24} color={Colors.primary} />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Notes */}
              <View style={styles.inputGroup}>
                <SimpleTextInput
                  label="Notes (Optional)"
                  value={notes}
                  onValueChange={setNotes}
                  placeholder="Add any special notes..."
                  multiline={true}
                  numberOfLines={3}
                  style={styles.notesInput}
                  clearButtonMode="while-editing"
                />
              </View>
            </View>

            {/* Total */}
            <View style={styles.totalSection}>
              <Text style={styles.totalLabel}>Total Amount:</Text>
              <Text style={styles.totalAmount}>
                £{((parseFloat(price) || 0) * quantity).toFixed(2)}
              </Text>
            </View>
          </ScrollView>

          {/* Actions */}
          <View style={styles.actions}>
            <TouchableOpacity style={[styles.actionButton, styles.cancelButton]} onPress={onClose}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionButton, styles.clearButton]}
              onPress={handleReset}
            >
              <Icon name="refresh" size={20} color={Colors.warning} />
              <Text style={styles.clearButtonText}>Clear</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionButton, styles.addButton]}
              onPress={handleAddItem}
              disabled={!itemName.trim() || !price || parseFloat(price) <= 0}
            >
              <Icon name="add" size={20} color={Colors.white} />
              <Text style={styles.addButtonText}>Add Item</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.text,
  },
  body: {
    maxHeight: 500,
  },
  section: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 12,
  },
  commonItemsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  commonItem: {
    backgroundColor: Colors.background,
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    minWidth: 100,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  commonItemSelected: {
    backgroundColor: Colors.primary + '20',
    borderColor: Colors.primary,
  },
  commonItemEmoji: {
    fontSize: 24,
    marginBottom: 4,
  },
  commonItemName: {
    fontSize: 12,
    color: Colors.text,
    textAlign: 'center',
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.text,
    marginBottom: 8,
  },
  nameInputContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  emojiButton: {
    width: 48,
    height: 48,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
  },
  selectedEmoji: {
    fontSize: 24,
  },
  nameInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: Colors.text,
  },
  emojiPicker: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    padding: 12,
    backgroundColor: Colors.background,
    borderRadius: 8,
    marginBottom: 16,
  },
  emojiOption: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
    backgroundColor: Colors.white,
  },
  emojiText: {
    fontSize: 20,
  },
  priceInput: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 24,
    fontWeight: '600',
    color: Colors.primary,
    textAlign: 'center',
  },
  presetAmounts: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  presetButton: {
    backgroundColor: Colors.background,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  presetButtonText: {
    fontSize: 14,
    color: Colors.text,
    fontWeight: '500',
  },
  quantityControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
  },
  quantityButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quantityText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.text,
    minWidth: 40,
    textAlign: 'center',
  },
  notesInput: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 14,
    color: Colors.text,
    textAlignVertical: 'top',
  },
  totalSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    backgroundColor: Colors.background,
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: Colors.text,
  },
  totalAmount: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.primary,
  },
  actions: {
    flexDirection: 'row',
    padding: 20,
    paddingBottom: 34,
    gap: 12,
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
  cancelButton: {
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.darkGray,
  },
  clearButton: {
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.warning,
  },
  clearButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.warning,
  },
  addButton: {
    backgroundColor: Colors.primary,
  },
  addButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.white,
  },
});

export default CustomItemEntry;
