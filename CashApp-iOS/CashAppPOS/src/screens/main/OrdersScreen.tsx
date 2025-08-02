import React, { useState, useEffect } from 'react';

import {
  StyleSheet,
  Text,
  View,
  FlatList,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  RefreshControl,
} from 'react-native';

import { useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialIcons';

import EmptyState from '../../components/common/EmptyState';
import HeaderWithBackButton from '../../components/navigation/HeaderWithBackButton';
import { useTheme, useThemedStyles } from '../../design-system/ThemeProvider';
import OrderService from '../../services/OrderService';
import { logger } from '../../utils/logger';

import type { Order } from '../../types';

const OrdersScreen: React.FC = () => {
  const navigation = useNavigation();
  const { theme } = useTheme();
  const styles = useThemedStyles(createStyles);
  const [orders, setOrders] = useState<Order[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'preparing' | 'ready' | 'completed'>('all');
  const orderService = OrderService.getInstance();

  const statusColors = {
    draft: theme.colors.lightText,
    confirmed: theme.colors.warning,
    preparing: theme.colors.warning,
    ready: theme.colors.success,
    completed: theme.colors.lightText,
    cancelled: theme.colors.danger,
  };

  const dynamicStyles = createDynamicStyles(theme, statusColors);

  const statusIcons = {
    draft: 'edit',
    confirmed: 'check-circle-outline',
    preparing: 'access-time',
    ready: 'done',
    completed: 'check-circle',
    cancelled: 'cancel',
  };

  const filteredOrders =
    filter === 'all' ? orders : orders.filter((order) => order.status === filter);

  const loadOrders = async () => {
    try {
      logger.info('📋 Loading orders from OrderService...');
      const fetchedOrders = await orderService.getOrders({
        limit: 50,
        offset: 0,
      });
      setOrders(fetchedOrders);
      logger.info(`✅ Loaded ${fetchedOrders.length} orders`);
    } catch (error) {
      logger.error('❌ Failed to load orders:', error);
      // Keep existing orders on error
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadOrders();
    setRefreshing(false);
  };

  // Load orders on component mount
  useEffect(() => {
    const initializeOrders = async () => {
      setLoading(true);
      await loadOrders();
      setLoading(false);
    };

    initializeOrders();

    // Subscribe to real-time order updates
    const unsubscribe = orderService.subscribeToOrderEvents((event, data) => {
      logger.info('🔄 Real-time order event:', event, data);

      if (event === 'order_created') {
        setOrders((prevOrders) => [data, ...prevOrders]);
      } else if (event === 'order_updated') {
        setOrders((prevOrders) =>
          prevOrders.map((order) => (order.id === data.id ? { ...order, ...data } : order))
        );
      }
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getTimeSince = (date: Date) => {
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));

    if (diffInMinutes < 60) {
      return `${diffInMinutes}m ago`;
    } else {
      const hours = Math.floor(diffInMinutes / 60);
      return `${hours}h ago`;
    }
  };

  const handleOrderPress = (order: Order) => {
    navigation.navigate('OrderDetails', { orderId: order.id! });
  };

  const OrderCard = ({ order }: { order: Order }) => (
    <TouchableOpacity
      style={styles.orderCard}
      onPress={() => handleOrderPress(order)}
      activeOpacity={0.7}
    >
      <View style={styles.orderHeader}>
        <View style={styles.orderInfo}>
          <Text style={styles.orderNumber}>Order #{order.id}</Text>
          <Text style={styles.orderTime}>
            {formatTime(order.createdAt)} • {getTimeSince(order.createdAt)}
          </Text>
        </View>
        <View style={[styles.statusBadge, dynamicStyles.statusBadge(order.status)]}>
          <Icon name={statusIcons[order.status]} size={16} color={theme.colors.white} />
          <Text style={styles.statusText}>{order.status.toUpperCase()}</Text>
        </View>
      </View>

      <View style={styles.orderDetails}>
        <View style={styles.customerInfo}>
          <Icon name="person" size={16} color={theme.colors.lightText} />
          <Text style={styles.customerText}>{order.customerName || 'Walk-in'}</Text>
          {order.tableNumber && (
            <>
              <Icon
                name="table-restaurant"
                size={16}
                color={theme.colors.lightText}
                style={styles.tableIcon}
              />
              <Text style={styles.tableText}>Table {order.tableNumber}</Text>
            </>
          )}
        </View>

        <View style={styles.itemsPreview}>
          <Text style={styles.itemsText}>
            {order.items.length} item{order.items.length !== 1 ? 's' : ''}
          </Text>
          <Text style={styles.itemsList}>
            {order.items.map((item) => `${item.emoji} ${item.name}`).join(', ')}
          </Text>
        </View>

        <View style={styles.orderFooter}>
          <View style={styles.paymentMethod}>
            <Icon
              name={
                order.paymentMethod === 'cash'
                  ? 'money'
                  : order.paymentMethod === 'card'
                  ? 'credit-card'
                  : 'phone-android'
              }
              size={16}
              color={theme.colors.lightText}
            />
            <Text style={styles.paymentText}>
              {order.paymentMethod?.replace('_', ' ').toUpperCase()}
            </Text>
          </View>
          <Text style={styles.totalAmount}>£{order.total.toFixed(2)}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  const FilterButton = ({
    title,
    value,
    count,
  }: {
    title: string;
    value: typeof filter;
    count: number;
  }) => (
    <TouchableOpacity
      style={[styles.filterButton, filter === value && styles.filterButtonActive]}
      onPress={() => setFilter(value)}
    >
      <Text style={[styles.filterButtonText, filter === value && styles.filterButtonTextActive]}>
        {title}
      </Text>
      {count > 0 && (
        <View style={styles.filterBadge}>
          <Text style={styles.filterBadgeText}>{count}</Text>
        </View>
      )}
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={theme.colors.primary} />

      {/* Header with Back Button */}
      <HeaderWithBackButton
        title="Orders"
        backgroundColor={theme.colors.primary}
        textColor={theme.colors.white}
        rightComponent={
          <TouchableOpacity style={styles.searchButton}>
            <Icon name="search" size={24} color={theme.colors.white} />
          </TouchableOpacity>
        }
      />

      {/* Filters */}
      <View style={styles.filtersContainer}>
        <FilterButton title="All" value="all" count={orders.length} />
        <FilterButton
          title="Preparing"
          value="preparing"
          count={orders.filter((o) => o.status === 'preparing').length}
        />
        <FilterButton
          title="Ready"
          value="ready"
          count={orders.filter((o) => o.status === 'ready').length}
        />
        <FilterButton
          title="Completed"
          value="completed"
          count={orders.filter((o) => o.status === 'completed').length}
        />
      </View>

      {/* Orders List */}
      <FlatList
        data={filteredOrders}
        keyExtractor={(item) => item.id!.toString()}
        renderItem={({ item }) => <OrderCard order={item} />}
        contentContainerStyle={styles.ordersList}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={() => (
          <EmptyState
            icon="📋"
            title={loading ? 'Loading orders...' : 'No orders found'}
            message={
              loading
                ? 'Please wait while we fetch your orders'
                : 'Orders will appear here when customers place them'
            }
            testID="orders-empty-state"
          />
        )}
      />
    </SafeAreaView>
  );
};

// Dynamic styles creator for conditional styling
const createDynamicStyles = (theme: unknown, statusColors: Record<string, string>) => ({
  statusBadge: (status: string) => ({
    backgroundColor: statusColors[status] || theme.colors.lightText,
  }),
});

const createStyles = (theme: unknown) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    searchButton: {
      padding: 8,
    },
    filtersContainer: {
      flexDirection: 'row',
      paddingHorizontal: 20,
      paddingVertical: 15,
      backgroundColor: theme.colors.white,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.lightGray,
    },
    filterButton: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 20,
      marginRight: 12,
      backgroundColor: theme.colors.lightGray,
    },
    filterButtonActive: {
      backgroundColor: theme.colors.secondary,
    },
    filterButtonText: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.colors.text,
    },
    filterButtonTextActive: {
      color: theme.colors.white,
    },
    filterBadge: {
      backgroundColor: theme.colors.danger,
      borderRadius: 10,
      paddingHorizontal: 6,
      paddingVertical: 2,
      marginLeft: 6,
      minWidth: 20,
      alignItems: 'center',
    },
    filterBadgeText: {
      fontSize: 12,
      fontWeight: 'bold',
      color: theme.colors.white,
    },
    ordersList: {
      padding: 20,
    },
    orderCard: {
      backgroundColor: theme.colors.white,
      borderRadius: 12,
      marginBottom: 15,
      elevation: 2,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.1,
      shadowRadius: 2,
    },
    orderHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: 16,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.lightGray,
    },
    orderInfo: {
      flex: 1,
    },
    orderNumber: {
      fontSize: 18,
      fontWeight: 'bold',
      color: theme.colors.text,
    },
    orderTime: {
      fontSize: 14,
      color: theme.colors.lightText,
      marginTop: 2,
    },
    statusBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 16,
    },
    statusText: {
      fontSize: 12,
      fontWeight: 'bold',
      color: theme.colors.white,
      marginLeft: 4,
    },
    orderDetails: {
      padding: 16,
    },
    customerInfo: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 12,
    },
    customerText: {
      fontSize: 14,
      color: theme.colors.text,
      marginLeft: 6,
      fontWeight: '600',
    },
    tableIcon: {
      marginLeft: 12,
    },
    tableText: {
      fontSize: 14,
      color: theme.colors.text,
      marginLeft: 6,
    },
    itemsPreview: {
      marginBottom: 12,
    },
    itemsText: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.colors.text,
      marginBottom: 4,
    },
    itemsList: {
      fontSize: 14,
      color: theme.colors.lightText,
      lineHeight: 20,
    },
    orderFooter: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    paymentMethod: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    paymentText: {
      fontSize: 12,
      color: theme.colors.lightText,
      marginLeft: 6,
      fontWeight: '600',
    },
    totalAmount: {
      fontSize: 18,
      fontWeight: 'bold',
      color: theme.colors.secondary,
    },
  });

export default OrdersScreen;
