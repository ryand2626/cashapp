import React from 'react';

import {
  StyleSheet,
  Text,
  View,
  SafeAreaView,
  StatusBar,
  ScrollView,
  TouchableOpacity,
  Alert,
  Linking, // Added Linking
} from 'react-native';

import { useNavigation, useRoute } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialIcons';

const Colors = {
  primary: '#2C3E50',
  secondary: '#3498DB',
  success: '#27AE60',
  warning: '#F39C12',
  danger: '#E74C3C',
  background: '#F8F9FA',
  white: '#FFFFFF',
  lightGray: '#ECF0F1',
  text: '#2C3E50',
  lightText: '#95A5A6',
};

// Mock order data - would come from API/store
const mockOrder = {
  id: 1,
  items: [
    { id: 1, name: 'Classic Burger', price: 12.99, quantity: 2, emoji: '🍔' },
    { id: 2, name: 'French Fries', price: 4.99, quantity: 1, emoji: '🍟' },
  ],
  subtotal: 30.97,
  tax: 2.48,
  total: 33.45,
  customer: {
    // Updated to use customer object
    id: 'cust_123',
    name: 'John Doe',
    email: 'john.doe@example.com',
  },
  tableNumber: 5,
  createdAt: new Date(Date.now() - 1000 * 60 * 30),
  status: 'preparing',
  paymentMethod: 'card',
  notes: 'Extra sauce on the burger',
};

const OrderDetailsScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute();
  // const { orderId } = route.params as { orderId: number };

  const statusColors = {
    draft: Colors.lightText,
    confirmed: Colors.warning,
    preparing: Colors.warning,
    ready: Colors.success,
    completed: Colors.lightText,
    cancelled: Colors.danger,
  };

  const handleStatusUpdate = (newStatus: string) => {
    Alert.alert('Update Status', `Change order status to ${newStatus}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Update',
        onPress: () => {
          // Update order status
          Alert.alert('Success', `Order status updated to ${newStatus}`);
        },
      },
    ]);
  };

  const OrderItemCard = ({ item }: { item: any }) => (
    <View style={styles.orderItem}>
      <Text style={styles.itemEmoji}>{item.emoji}</Text>
      <View style={styles.itemDetails}>
        <Text style={styles.itemName}>{item.name}</Text>
        <Text style={styles.itemPrice}>£{item.price.toFixed(2)} each</Text>
      </View>
      <View style={styles.itemQuantity}>
        <Text style={styles.quantityText}>x{item.quantity}</Text>
        <Text style={styles.itemTotal}>£{(item.price * item.quantity).toFixed(2)}</Text>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.primary} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Icon name="arrow-back" size={24} color={Colors.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Order #{mockOrder.id}</Text>
        <TouchableOpacity style={styles.headerButton}>
          <Icon name="more-vert" size={24} color={Colors.white} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Order Status */}
        <View style={styles.statusSection}>
          <View style={styles.statusHeader}>
            <View
              style={[styles.statusIndicator, { backgroundColor: statusColors[mockOrder.status] }]}
            />
            <Text style={styles.statusText}>{mockOrder.status.toUpperCase()}</Text>
          </View>
          <Text style={styles.orderTime}>{mockOrder.createdAt.toLocaleString()}</Text>
        </View>

        {/* Customer Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Customer Information</Text>
          <View style={styles.customerCard}>
            <View style={styles.customerRow}>
              <Icon name="person" size={20} color={Colors.secondary} />
              <Text style={styles.customerText}>
                {mockOrder.customer?.name || 'Walk-in Customer'}
              </Text>
            </View>
            {mockOrder.customer?.email && (
              <TouchableOpacity
                onPress={() => Linking.openURL(`mailto:${mockOrder.customer?.email}`)}
              >
                <View style={styles.customerRow}>
                  <Icon name="email" size={20} color={Colors.secondary} />
                  <Text style={[styles.customerText, styles.emailLink]}>
                    {mockOrder.customer.email}
                  </Text>
                </View>
              </TouchableOpacity>
            )}
            {mockOrder.tableNumber && (
              <View style={styles.customerRow}>
                <Icon name="table-restaurant" size={20} color={Colors.secondary} />
                <Text style={styles.customerText}>Table {mockOrder.tableNumber}</Text>
              </View>
            )}
            <View style={styles.customerRow}>
              <Icon
                name={
                  mockOrder.paymentMethod === 'cash'
                    ? 'money'
                    : mockOrder.paymentMethod === 'card'
                    ? 'credit-card'
                    : 'phone-android'
                }
                size={20}
                color={Colors.secondary}
              />
              <Text style={styles.customerText}>
                {mockOrder.paymentMethod?.replace('_', ' ').toUpperCase()}
              </Text>
            </View>
          </View>
        </View>

        {/* Order Items */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Order Items</Text>
          <View style={styles.itemsContainer}>
            {mockOrder.items.map((item) => (
              <OrderItemCard key={item.id} item={item} />
            ))}
          </View>
        </View>

        {/* Order Notes */}
        {mockOrder.notes && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Notes</Text>
            <View style={styles.notesCard}>
              <Text style={styles.notesText}>{mockOrder.notes}</Text>
            </View>
          </View>
        )}

        {/* Order Summary */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Order Summary</Text>
          <View style={styles.summaryCard}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Subtotal</Text>
              <Text style={styles.summaryValue}>£{mockOrder.subtotal.toFixed(2)}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Tax</Text>
              <Text style={styles.summaryValue}>£{mockOrder.tax.toFixed(2)}</Text>
            </View>
            <View style={[styles.summaryRow, styles.totalRow]}>
              <Text style={styles.totalLabel}>Total</Text>
              <Text style={styles.totalValue}>£{mockOrder.total.toFixed(2)}</Text>
            </View>
          </View>
        </View>

        {/* Status Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Actions</Text>
          <View style={styles.actionsContainer}>
            {mockOrder.status === 'preparing' && (
              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: Colors.success }]}
                onPress={() => handleStatusUpdate('ready')}
              >
                <Icon name="done" size={20} color={Colors.white} />
                <Text style={styles.actionButtonText}>Mark as Ready</Text>
              </TouchableOpacity>
            )}

            {mockOrder.status === 'ready' && (
              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: Colors.secondary }]}
                onPress={() => handleStatusUpdate('completed')}
              >
                <Icon name="check-circle" size={20} color={Colors.white} />
                <Text style={styles.actionButtonText}>Mark as Completed</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: Colors.lightGray }]}
              onPress={() => Alert.alert('Coming Soon', 'Print receipt feature coming soon')}
            >
              <Icon name="print" size={20} color={Colors.text} />
              <Text style={[styles.actionButtonText, { color: Colors.text }]}>Print Receipt</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
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
    paddingHorizontal: 20,
    paddingVertical: 15,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    color: Colors.white,
    fontSize: 20,
    fontWeight: 'bold',
    flex: 1,
    textAlign: 'center',
  },
  headerButton: {
    padding: 8,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  statusSection: {
    alignItems: 'center',
    paddingVertical: 20,
    marginBottom: 20,
  },
  statusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  statusIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
  },
  statusText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text,
  },
  orderTime: {
    fontSize: 14,
    color: Colors.lightText,
  },
  section: {
    marginBottom: 25,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 12,
  },
  customerCard: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  customerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  customerText: {
    fontSize: 16,
    color: Colors.text,
    marginLeft: 12,
    fontWeight: '600',
  },
  emailLink: {
    color: Colors.secondary,
    textDecorationLine: 'underline',
  },
  itemsContainer: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  orderItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: Colors.lightGray,
  },
  itemEmoji: {
    fontSize: 32,
    marginRight: 15,
  },
  itemDetails: {
    flex: 1,
  },
  itemName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 4,
  },
  itemPrice: {
    fontSize: 14,
    color: Colors.lightText,
  },
  itemQuantity: {
    alignItems: 'flex-end',
  },
  quantityText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 4,
  },
  itemTotal: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.secondary,
  },
  notesCard: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  notesText: {
    fontSize: 16,
    color: Colors.text,
    lineHeight: 24,
  },
  summaryCard: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  summaryLabel: {
    fontSize: 16,
    color: Colors.text,
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
  },
  totalRow: {
    borderTopWidth: 1,
    borderTopColor: Colors.lightGray,
    paddingTop: 12,
    marginBottom: 0,
  },
  totalLabel: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text,
  },
  totalValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.secondary,
  },
  actionsContainer: {
    gap: 12,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.white,
    marginLeft: 8,
  },
});

export default OrderDetailsScreen;
