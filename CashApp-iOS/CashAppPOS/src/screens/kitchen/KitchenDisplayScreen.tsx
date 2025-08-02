import React, { useState, useEffect } from 'react';

import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  FlatList,
  Alert,
  Modal,
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

interface KitchenOrderItem {
  id: string;
  name: string;
  quantity: number;
  modifiers: string[];
  specialInstructions?: string;
  station: 'grill' | 'cold' | 'fryer' | 'prep';
  estimatedTime: number; // minutes
  status: 'pending' | 'in_progress' | 'ready' | 'served';
}

interface KitchenOrder {
  id: string;
  orderNumber: string;
  orderType: 'dine_in' | 'takeout' | 'pickup' | 'delivery';
  tableName?: string;
  customerName?: string;
  items: KitchenOrderItem[];
  totalItems: number;
  orderTime: Date;
  estimatedCompletionTime: Date;
  priority: 'normal' | 'urgent' | 'rush';
  status: 'received' | 'preparing' | 'ready' | 'served' | 'delayed';
  server?: string;
  notes?: string;
}

const KitchenDisplayScreen: React.FC = () => {
  const navigation = useNavigation();

  const [orders, setOrders] = useState<KitchenOrder[]>([]);
  const [selectedStation, setSelectedStation] = useState<string>('all');
  const [selectedOrder, setSelectedOrder] = useState<KitchenOrder | null>(null);
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Sample kitchen orders
  const sampleOrders: KitchenOrder[] = [
    {
      id: 'order1',
      orderNumber: '#001',
      orderType: 'dine_in',
      tableName: 'Table 5',
      customerName: 'John D.',
      items: [
        {
          id: 'item1',
          name: 'Beef Tacos',
          quantity: 2,
          modifiers: ['Extra Cheese', 'No Onions'],
          specialInstructions: 'Make it spicy',
          station: 'grill',
          estimatedTime: 8,
          status: 'in_progress',
        },
        {
          id: 'item2',
          name: 'Nachos',
          quantity: 1,
          modifiers: ['Extra Guacamole'],
          station: 'prep',
          estimatedTime: 5,
          status: 'ready',
        },
      ],
      totalItems: 3,
      orderTime: new Date(Date.now() - 8 * 60 * 1000), // 8 minutes ago
      estimatedCompletionTime: new Date(Date.now() + 2 * 60 * 1000), // 2 minutes from now
      priority: 'normal',
      status: 'preparing',
      server: 'Sarah M.',
    },
    {
      id: 'order2',
      orderNumber: '#002',
      orderType: 'takeout',
      customerName: 'Emma Wilson',
      items: [
        {
          id: 'item3',
          name: 'Quesadillas',
          quantity: 3,
          modifiers: ['Chicken', 'Extra Cheese'],
          station: 'grill',
          estimatedTime: 10,
          status: 'pending',
        },
        {
          id: 'item4',
          name: 'Churros',
          quantity: 2,
          modifiers: [],
          station: 'fryer',
          estimatedTime: 6,
          status: 'pending',
        },
      ],
      totalItems: 5,
      orderTime: new Date(Date.now() - 3 * 60 * 1000), // 3 minutes ago
      estimatedCompletionTime: new Date(Date.now() + 7 * 60 * 1000), // 7 minutes from now
      priority: 'normal',
      status: 'received',
    },
    {
      id: 'order3',
      orderNumber: '#003',
      orderType: 'dine_in',
      tableName: 'Table 12',
      customerName: 'Mike Johnson',
      items: [
        {
          id: 'item5',
          name: 'Fish Tacos',
          quantity: 4,
          modifiers: ['Light Mayo', 'Extra Lime'],
          station: 'grill',
          estimatedTime: 12,
          status: 'pending',
        },
      ],
      totalItems: 4,
      orderTime: new Date(Date.now() - 15 * 60 * 1000), // 15 minutes ago - delayed!
      estimatedCompletionTime: new Date(Date.now() - 3 * 60 * 1000), // Should have been ready 3 minutes ago
      priority: 'urgent',
      status: 'delayed',
      server: 'Tom R.',
      notes: 'Customer is asking about their order',
    },
  ];

  useEffect(() => {
    setOrders(sampleOrders);

    // Update current time every minute
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000);

    return () => clearInterval(timer);
  }, []);

  const getTimeSinceOrder = (orderTime: Date) => {
    const diffMs = currentTime.getTime() - orderTime.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'Just now';
    if (diffMins === 1) return '1 min ago';
    return `${diffMins} mins ago`;
  };

  const getTimeUntilReady = (completionTime: Date) => {
    const diffMs = completionTime.getTime() - currentTime.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins <= 0) return 'Overdue';
    if (diffMins === 1) return '1 min';
    return `${diffMins} mins`;
  };

  const getOrderStatusColor = (status: string) => {
    switch (status) {
      case 'received':
        return Colors.secondary;
      case 'preparing':
        return Colors.warning;
      case 'ready':
        return Colors.success;
      case 'served':
        return Colors.mediumGray;
      case 'delayed':
        return Colors.danger;
      default:
        return Colors.lightText;
    }
  };

  const getOrderPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return Colors.danger;
      case 'rush':
        return Colors.warning;
      default:
        return Colors.primary;
    }
  };

  const getItemStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return 'radio-button-unchecked';
      case 'in_progress':
        return 'sync';
      case 'ready':
        return 'check-circle';
      case 'served':
        return 'check-circle-outline';
      default:
        return 'help';
    }
  };

  const updateItemStatus = (
    orderId: string,
    itemId: string,
    newStatus: KitchenOrderItem['status']
  ) => {
    setOrders((prev) =>
      prev.map((order) => {
        if (order.id === orderId) {
          const updatedItems = order.items.map((item) =>
            item.id === itemId ? { ...item, status: newStatus } : item
          );

          // Update order status based on item statuses
          let orderStatus: KitchenOrder['status'] = 'received';
          const allReady = updatedItems.every(
            (item) => item.status === 'ready' || item.status === 'served'
          );
          const anyInProgress = updatedItems.some((item) => item.status === 'in_progress');

          if (allReady) {
            orderStatus = 'ready';
          } else if (anyInProgress) {
            orderStatus = 'preparing';
          }

          return { ...order, items: updatedItems, status: orderStatus };
        }
        return order;
      })
    );
  };

  const markOrderComplete = (orderId: string) => {
    setOrders((prev) =>
      prev.map((order) =>
        order.id === orderId
          ? {
              ...order,
              status: 'served',
              items: order.items.map((item) => ({ ...item, status: 'served' })),
            }
          : order
      )
    );

    Alert.alert('Order Complete', 'Order has been marked as served!');
  };

  const stations = [
    { id: 'all', name: 'All Stations', icon: 'restaurant' },
    { id: 'grill', name: 'Grill', icon: 'outdoor-grill' },
    { id: 'cold', name: 'Cold', icon: 'ac-unit' },
    { id: 'fryer', name: 'Fryer', icon: 'local-fire-department' },
    { id: 'prep', name: 'Prep', icon: 'food-bank' },
  ];

  const getFilteredOrders = () => {
    if (selectedStation === 'all') {
      return orders.filter((order) => order.status !== 'served');
    }

    return orders.filter(
      (order) =>
        order.status !== 'served' && order.items.some((item) => item.station === selectedStation)
    );
  };

  const OrderCard = ({ order }: { order: KitchenOrder }) => {
    const isOverdue = order.estimatedCompletionTime.getTime() < currentTime.getTime();

    return (
      <TouchableOpacity
        style={[
          styles.orderCard,
          { borderLeftColor: getOrderStatusColor(order.status) },
          order.priority === 'urgent' && styles.urgentOrder,
        ]}
        onPress={() => {
          setSelectedOrder(order);
          setShowOrderModal(true);
        }}
      >
        <View style={styles.orderHeader}>
          <View style={styles.orderInfo}>
            <Text style={styles.orderNumber}>{order.orderNumber}</Text>
            <Text style={styles.orderType}>
              {order.orderType.replace('_', ' ').toUpperCase()}
              {order.tableName && ` • ${order.tableName}`}
            </Text>
          </View>

          <View style={styles.orderTiming}>
            <Text style={[styles.timeText, isOverdue && styles.overdueText]}>
              {isOverdue ? 'OVERDUE' : getTimeUntilReady(order.estimatedCompletionTime)}
            </Text>
            <Text style={styles.orderAge}>{getTimeSinceOrder(order.orderTime)}</Text>
          </View>
        </View>

        <View style={styles.orderContent}>
          {order.customerName && (
            <Text style={styles.customerName}>Customer: {order.customerName}</Text>
          )}

          <View style={styles.itemsList}>
            {order.items.slice(0, 3).map((item) => (
              <View key={item.id} style={styles.itemRow}>
                <TouchableOpacity
                  onPress={() => {
                    const statuses: KitchenOrderItem['status'][] = [
                      'pending',
                      'in_progress',
                      'ready',
                    ];
                    const currentIndex = statuses.indexOf(item.status);
                    const nextStatus = statuses[(currentIndex + 1) % statuses.length];
                    updateItemStatus(order.id, item.id, nextStatus);
                  }}
                >
                  <Icon
                    name={getItemStatusIcon(item.status)}
                    size={20}
                    color={getOrderStatusColor(item.status)}
                  />
                </TouchableOpacity>

                <View style={styles.itemDetails}>
                  <Text style={styles.itemName}>
                    {item.quantity}x {item.name}
                  </Text>
                  {item.modifiers.length > 0 && (
                    <Text style={styles.itemModifiers}>{item.modifiers.join(', ')}</Text>
                  )}
                </View>

                <View style={styles.itemStation}>
                  <Text style={styles.stationText}>{item.station.toUpperCase()}</Text>
                </View>
              </View>
            ))}

            {order.items.length > 3 && (
              <Text style={styles.moreItems}>+{order.items.length - 3} more items</Text>
            )}
          </View>
        </View>

        <View style={styles.orderFooter}>
          <View style={styles.orderMeta}>
            {order.server && <Text style={styles.serverText}>Server: {order.server}</Text>}
            <Text style={styles.totalItems}>{order.totalItems} items total</Text>
          </View>

          <TouchableOpacity
            style={[styles.completeButton, { backgroundColor: getOrderStatusColor(order.status) }]}
            onPress={() => markOrderComplete(order.id)}
            disabled={order.status !== 'ready'}
          >
            <Icon name="check" size={20} color={Colors.white} />
            <Text style={styles.completeButtonText}>
              {order.status === 'ready' ? 'Serve' : order.status.toUpperCase()}
            </Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Icon name="arrow-back" size={24} color={Colors.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Kitchen Display</Text>
        <View style={styles.headerRight}>
          <Text style={styles.currentTime}>
            {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Text>
        </View>
      </View>

      {/* Station Filter */}
      <View style={styles.stationFilter}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {stations.map((station) => (
            <TouchableOpacity
              key={station.id}
              style={[
                styles.stationButton,
                selectedStation === station.id && styles.stationButtonActive,
              ]}
              onPress={() => setSelectedStation(station.id)}
            >
              <Icon
                name={station.icon}
                size={20}
                color={selectedStation === station.id ? Colors.white : Colors.primary}
              />
              <Text
                style={[
                  styles.stationButtonText,
                  selectedStation === station.id && styles.stationButtonTextActive,
                ]}
              >
                {station.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Orders List */}
      <FlatList
        data={getFilteredOrders()}
        renderItem={({ item }) => <OrderCard order={item} />}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.ordersList}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Icon name="restaurant" size={64} color={Colors.lightGray} />
            <Text style={styles.emptyStateText}>No orders for this station</Text>
            <Text style={styles.emptyStateSubtext}>New orders will appear here</Text>
          </View>
        }
      />

      {/* Order Detail Modal */}
      <Modal
        visible={showOrderModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowOrderModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {selectedOrder && (
              <>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Order {selectedOrder.orderNumber} Details</Text>
                  <TouchableOpacity onPress={() => setShowOrderModal(false)}>
                    <Icon name="close" size={24} color={Colors.text} />
                  </TouchableOpacity>
                </View>

                <ScrollView style={styles.modalBody}>
                  <View style={styles.orderDetailsSection}>
                    <Text style={styles.sectionTitle}>Order Information</Text>
                    <Text style={styles.detailText}>
                      Type: {selectedOrder.orderType.replace('_', ' ')}
                    </Text>
                    {selectedOrder.tableName && (
                      <Text style={styles.detailText}>Table: {selectedOrder.tableName}</Text>
                    )}
                    {selectedOrder.customerName && (
                      <Text style={styles.detailText}>Customer: {selectedOrder.customerName}</Text>
                    )}
                    {selectedOrder.server && (
                      <Text style={styles.detailText}>Server: {selectedOrder.server}</Text>
                    )}
                    <Text style={styles.detailText}>
                      Order Time: {selectedOrder.orderTime.toLocaleTimeString()}
                    </Text>
                  </View>

                  <View style={styles.orderDetailsSection}>
                    <Text style={styles.sectionTitle}>Items</Text>
                    {selectedOrder.items.map((item) => (
                      <View key={item.id} style={styles.modalItemRow}>
                        <TouchableOpacity
                          style={styles.modalItemStatus}
                          onPress={() => {
                            const statuses: KitchenOrderItem['status'][] = [
                              'pending',
                              'in_progress',
                              'ready',
                            ];
                            const currentIndex = statuses.indexOf(item.status);
                            const nextStatus = statuses[(currentIndex + 1) % statuses.length];
                            updateItemStatus(selectedOrder.id, item.id, nextStatus);
                          }}
                        >
                          <Icon
                            name={getItemStatusIcon(item.status)}
                            size={24}
                            color={getOrderStatusColor(item.status)}
                          />
                        </TouchableOpacity>

                        <View style={styles.modalItemDetails}>
                          <Text style={styles.modalItemName}>
                            {item.quantity}x {item.name}
                          </Text>
                          {item.modifiers.length > 0 && (
                            <Text style={styles.modalItemModifiers}>
                              Modifiers: {item.modifiers.join(', ')}
                            </Text>
                          )}
                          {item.specialInstructions && (
                            <Text style={styles.modalItemInstructions}>
                              Instructions: {item.specialInstructions}
                            </Text>
                          )}
                          <Text style={styles.modalItemStation}>
                            Station: {item.station.toUpperCase()} • Est. {item.estimatedTime} mins
                          </Text>
                        </View>
                      </View>
                    ))}
                  </View>

                  {selectedOrder.notes && (
                    <View style={styles.orderDetailsSection}>
                      <Text style={styles.sectionTitle}>Notes</Text>
                      <Text style={styles.notesText}>{selectedOrder.notes}</Text>
                    </View>
                  )}
                </ScrollView>

                <View style={styles.modalActions}>
                  <TouchableOpacity
                    style={[styles.modalButton, styles.completeOrderButton]}
                    onPress={() => {
                      markOrderComplete(selectedOrder.id);
                      setShowOrderModal(false);
                    }}
                    disabled={selectedOrder.status !== 'ready'}
                  >
                    <Icon name="check" size={20} color={Colors.white} />
                    <Text style={styles.modalButtonText}>Mark as Served</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
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
  headerRight: {
    alignItems: 'flex-end',
  },
  currentTime: {
    fontSize: 16,
    fontWeight: '500',
    color: Colors.white,
  },
  stationFilter: {
    backgroundColor: Colors.white,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  stationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginHorizontal: 4,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.primary,
    backgroundColor: Colors.white,
  },
  stationButtonActive: {
    backgroundColor: Colors.primary,
  },
  stationButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.primary,
    marginLeft: 4,
  },
  stationButtonTextActive: {
    color: Colors.white,
  },
  ordersList: {
    padding: 16,
  },
  orderCard: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  urgentOrder: {
    borderWidth: 2,
    borderColor: Colors.danger,
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  orderInfo: {
    flex: 1,
  },
  orderNumber: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 4,
  },
  orderType: {
    fontSize: 14,
    color: Colors.lightText,
    fontWeight: '500',
  },
  orderTiming: {
    alignItems: 'flex-end',
  },
  timeText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.primary,
  },
  overdueText: {
    color: Colors.danger,
  },
  orderAge: {
    fontSize: 12,
    color: Colors.lightText,
    marginTop: 2,
  },
  orderContent: {
    marginBottom: 12,
  },
  customerName: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.text,
    marginBottom: 8,
  },
  itemsList: {
    gap: 8,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
  },
  itemDetails: {
    flex: 1,
    marginLeft: 12,
  },
  itemName: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.text,
  },
  itemModifiers: {
    fontSize: 12,
    color: Colors.lightText,
    marginTop: 2,
  },
  itemStation: {
    backgroundColor: Colors.background,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  stationText: {
    fontSize: 10,
    fontWeight: '600',
    color: Colors.darkGray,
  },
  moreItems: {
    fontSize: 12,
    color: Colors.secondary,
    fontStyle: 'italic',
    marginTop: 4,
  },
  orderFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.lightGray,
  },
  orderMeta: {
    flex: 1,
  },
  serverText: {
    fontSize: 12,
    color: Colors.lightText,
    marginBottom: 2,
  },
  totalItems: {
    fontSize: 12,
    color: Colors.darkGray,
    fontWeight: '500',
  },
  completeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    gap: 4,
  },
  completeButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.white,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: '500',
    color: Colors.lightText,
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: Colors.mediumGray,
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
    borderBottomColor: Colors.border,
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
  orderDetailsSection: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 8,
  },
  detailText: {
    fontSize: 14,
    color: Colors.darkGray,
    marginBottom: 4,
  },
  modalItemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.lightGray,
  },
  modalItemStatus: {
    padding: 4,
  },
  modalItemDetails: {
    flex: 1,
    marginLeft: 12,
  },
  modalItemName: {
    fontSize: 16,
    fontWeight: '500',
    color: Colors.text,
    marginBottom: 4,
  },
  modalItemModifiers: {
    fontSize: 14,
    color: Colors.lightText,
    marginBottom: 2,
  },
  modalItemInstructions: {
    fontSize: 14,
    color: Colors.warning,
    fontStyle: 'italic',
    marginBottom: 2,
  },
  modalItemStation: {
    fontSize: 12,
    color: Colors.mediumGray,
  },
  notesText: {
    fontSize: 14,
    color: Colors.text,
    fontStyle: 'italic',
    backgroundColor: Colors.background,
    padding: 12,
    borderRadius: 8,
  },
  modalActions: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  modalButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
  },
  completeOrderButton: {
    backgroundColor: Colors.success,
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.white,
  },
});

export default KitchenDisplayScreen;
