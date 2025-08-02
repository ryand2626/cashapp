import React, { useState, useEffect } from 'react';

import {
  StyleSheet,
  Text,
  View,
  StatusBar,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
  FlatList,
  _TextInput,
  Modal,
  RefreshControl,
  _ActivityIndicator, // Will be replaced by LoadingView
} from 'react-native';

import { useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialIcons';

import ComingSoon from '../../components/feedback/ComingSoon'; // Added
import LoadingView from '../../components/feedback/LoadingView'; // Added
import SimpleTextInput from '../../components/inputs/SimpleTextInput';
import { useTheme, useThemedStyles } from '../../design-system/ThemeProvider';
// import { generateSalesHistory } from '../../utils/mockDataGenerator'; // Removed
import DataService from '../../services/DataService'; // Added

// Mock ENV flag
const ENV = {
  FEATURE_ORDERS_HISTORY: true, // Set to true to enable, false to show ComingSoon
};

interface CustomerInfo {
  id: string;
  name: string;
  email?: string;
}

interface Order {
  id: string;
  date: Date;
  customer?: CustomerInfo; // Changed from customerName?: string
  total: number;
  items: number;
  status: 'completed' | 'pending' | 'refunded' | 'cancelled';
  paymentMethod: 'card' | 'cash' | 'mobile' | 'qrCode';
  employee: string;
}

const OrdersScreen: React.FC = () => {
  const navigation = useNavigation();
  const { theme } = useTheme();
  const styles = useThemedStyles(createStyles);

  const [orders, setOrders] = useState<Order[]>([]);
  const [filteredOrders, setFilteredOrders] = useState<Order[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState('all');
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [refreshing, setRefreshing] = useState(false); // Keep for pull-to-refresh
  const [isLoading, setIsLoading] = useState<boolean>(true); // Added
  const [error, setError] = useState<string | null>(null); // Added
  const [dateRange, setDateRange] = useState('today');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [showOrderDetails, setShowOrderDetails] = useState(false);

  useEffect(() => {
    if (ENV.FEATURE_ORDERS_HISTORY) {
      loadOrders();
    } else {
      setIsLoading(false);
    }
  }, [dateRange]);

  useEffect(() => {
    if (ENV.FEATURE_ORDERS_HISTORY && !isLoading && !error) {
      filterOrders();
    } else {
      setFilteredOrders([]);
    }
  }, [orders, searchQuery, selectedFilter, isLoading, error]);

  const loadOrders = async () => {
    // Modified
    setIsLoading(true);
    setError(null);
    setRefreshing(true);
    try {
      const dataService = DataService.getInstance();
      // Assuming a getOrders method will be added to DataService, taking dateRange
      const fetchedOrders = await dataService.getOrders(dateRange);
      setOrders(fetchedOrders || []);
    } catch (e: unknown) {
      setError(e.message || 'Failed to load orders.');
      setOrders([]);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  const filterOrders = () => {
    let filtered = orders;

    // Apply status filter
    if (selectedFilter !== 'all') {
      filtered = filtered.filter((order) => order.status === selectedFilter);
    }

    // Apply search query
    if (searchQuery) {
      const lowercasedQuery = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (order) =>
          order.id.toLowerCase().includes(lowercasedQuery) ||
          (order.customer?.name && order.customer.name.toLowerCase().includes(lowercasedQuery)) ||
          (order.customer?.email && order.customer.email.toLowerCase().includes(lowercasedQuery)) || // Also search by email
          order.employee.toLowerCase().includes(lowercasedQuery)
      );
    }

    setFilteredOrders(filtered);
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadOrders();
    setTimeout(() => setRefreshing(false), 1000);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return theme.colors.success;
      case 'pending':
        return theme.colors.warning;
      case 'refunded':
        return theme.colors.secondary;
      case 'cancelled':
        return theme.colors.danger;
      default:
        return theme.colors.darkGray;
    }
  };

  const getPaymentIcon = (method: string) => {
    switch (method) {
      case 'card':
        return 'credit-card';
      case 'cash':
        return 'attach-money';
      case 'mobile':
        return 'phone-iphone';
      case 'qrCode':
        return 'qr-code-scanner';
      default:
        return 'payment';
    }
  };

  const formatDate = (date: Date) => {
    const today = new Date();
    const isToday = date.toDateString() === today.toDateString();

    if (isToday) {
      return date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handleOrderPress = (order: Order) => {
    setSelectedOrder(order);
    setShowOrderDetails(true);
  };

  const renderOrder = ({ item }: { item: Order }) => (
    <TouchableOpacity style={styles.orderCard} onPress={() => handleOrderPress(item)}>
      <View style={styles.orderHeader}>
        <View>
          <Text style={styles.orderId}>{item.id}</Text>
          <Text style={styles.orderDate}>{formatDate(item.date)}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}>
          <Text style={styles.statusText}>{item.status}</Text>
        </View>
      </View>

      <View style={styles.orderBody}>
        <View style={styles.orderInfo}>
          <Icon name="person" size={16} color={theme.colors.darkGray} />
          <Text style={styles.orderInfoText}>{item.customer?.name || 'Walk-in Customer'}</Text>
        </View>

        <View style={styles.orderInfo}>
          <Icon name="badge" size={16} color={theme.colors.darkGray} />
          <Text style={styles.orderInfoText}>{item.employee}</Text>
        </View>
      </View>

      <View style={styles.orderFooter}>
        <View style={styles.orderStats}>
          <Icon name={getPaymentIcon(item.paymentMethod)} size={20} color={theme.colors.darkGray} />
          <Text style={styles.orderItems}>{item.items} items</Text>
        </View>
        <Text style={styles.orderTotal}>£{item.total.toFixed(2)}</Text>
      </View>
    </TouchableOpacity>
  );

  const getOrderStats = () => {
    const completed = orders.filter((o) => o.status === 'completed').length;
    const pending = orders.filter((o) => o.status === 'pending').length;
    const refunded = orders.filter((o) => o.status === 'refunded').length;
    const totalRevenue = orders
      .filter((o) => o.status === 'completed')
      .reduce((sum, o) => sum + o.total, 0);

    return { completed, pending, refunded, totalRevenue };
  };

  const stats = getOrderStats();

  if (!ENV.FEATURE_ORDERS_HISTORY) {
    return <ComingSoon />;
  }

  if (isLoading) {
    return <LoadingView message="Loading Orders..." />;
  }

  const renderEmptyListComponent = () => {
    if (error) {
      return (
        <View style={styles.emptyState}>
          <Icon name="error-outline" size={64} color={theme.colors.danger} />
          <Text style={[styles.emptyStateText, { color: theme.colors.text }]}>
            Error Loading Orders
          </Text>
          <Text style={[styles.emptyStateSubtext, { color: theme.colors.text }]}>{error}</Text>
          <TouchableOpacity
            onPress={loadOrders}
            style={[styles.retryButton, { backgroundColor: theme.colors.primary }]}
          >
            <Text style={[styles.retryButtonText, { color: theme.colors.white }]}>Try Again</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return (
      <View style={styles.emptyState}>
        <Icon name="receipt" size={64} color={theme.colors.lightGray} />
        <Text style={[styles.emptyStateText, { color: theme.colors.text }]}>No orders found</Text>
        <Text style={[styles.emptyStateSubtext, { color: theme.colors.text }]}>
          {searchQuery
            ? 'Try adjusting your search'
            : `No orders for selected period. Pull to refresh.`}
        </Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar backgroundColor={theme.colors.primary} barStyle="light-content" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.menuButton} onPress={() => navigation.goBack()}>
          <Icon name="arrow-back" size={24} color={theme.colors.white} />
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Orders</Text>
          <Text style={styles.headerSubtitle}>{filteredOrders.length} orders</Text>
        </View>

        <TouchableOpacity style={styles.headerButton} onPress={() => setShowFilterModal(true)}>
          <Icon name="filter-list" size={24} color={theme.colors.white} />
        </TouchableOpacity>
      </View>

      {/* Stats Bar */}
      <View style={styles.statsBar}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{stats.completed}</Text>
          <Text style={styles.statLabel}>Completed</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>£{stats.totalRevenue.toFixed(2)}</Text>
          <Text style={styles.statLabel}>Revenue</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: theme.colors.warning }]}>{stats.pending}</Text>
          <Text style={styles.statLabel}>Pending</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: theme.colors.danger }]}>{stats.refunded}</Text>
          <Text style={styles.statLabel}>Refunded</Text>
        </View>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Icon name="search" size={20} color={theme.colors.darkGray} style={styles.searchIcon} />
        <SimpleTextInput
          value={searchQuery}
          onValueChange={setSearchQuery}
          placeholder="Search orders, customers, or staff..."
          style={styles.searchInput}
          clearButtonMode="while-editing"
          returnKeyType="search"
        />
      </View>

      {/* Date Range Selector */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.dateRangeContainer}
      >
        {['today', 'week', 'month', 'year'].map((range) => (
          <TouchableOpacity
            key={range}
            style={[styles.dateRangeButton, dateRange === range && styles.dateRangeButtonActive]}
            onPress={() => setDateRange(range)}
          >
            <Text style={[styles.dateRangeText, dateRange === range && styles.dateRangeTextActive]}>
              {range.charAt(0).toUpperCase() + range.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Orders List */}
      <FlatList
        data={filteredOrders}
        renderItem={renderOrder}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.ordersList}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[theme.colors.primary]}
            tintColor={theme.colors.primary} // For iOS
          />
        }
        ListEmptyComponent={renderEmptyListComponent} // Updated
      />

      {/* Filter Modal */}
      <Modal
        visible={showFilterModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowFilterModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.filterModal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Filter Orders</Text>
              <TouchableOpacity onPress={() => setShowFilterModal(false)}>
                <Icon name="close" size={24} color={theme.colors.text} />
              </TouchableOpacity>
            </View>

            <View style={styles.filterOptions}>
              <Text style={styles.filterSectionTitle}>Order Status</Text>
              {['all', 'completed', 'pending', 'refunded', 'cancelled'].map((filter) => (
                <TouchableOpacity
                  key={filter}
                  style={[
                    styles.filterOption,
                    selectedFilter === filter && styles.filterOptionActive,
                  ]}
                  onPress={() => {
                    setSelectedFilter(filter);
                    setShowFilterModal(false);
                  }}
                >
                  <Text
                    style={[
                      styles.filterOptionText,
                      selectedFilter === filter && styles.filterOptionTextActive,
                    ]}
                  >
                    {filter.charAt(0).toUpperCase() + filter.slice(1)}
                  </Text>
                  {selectedFilter === filter && (
                    <Icon name="check" size={20} color={theme.colors.primary} />
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      </Modal>

      {/* Order Details Modal */}
      <Modal visible={showOrderDetails} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowOrderDetails(false)}>
              <Icon name="close" size={24} color={theme.colors.text} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Order Details</Text>
            <View style={{ width: 24 }} />
          </View>

          {selectedOrder && (
            <ScrollView style={styles.orderDetailsContent}>
              <View style={styles.orderDetailsHeader}>
                <Text style={styles.orderDetailsId}>{selectedOrder.id}</Text>
                <View
                  style={[
                    styles.statusBadge,
                    { backgroundColor: getStatusColor(selectedOrder.status) },
                  ]}
                >
                  <Text style={styles.statusText}>{selectedOrder.status.toUpperCase()}</Text>
                </View>
              </View>

              <View style={styles.orderDetailsSection}>
                <Text style={styles.sectionTitle}>Customer Information</Text>
                <Text style={styles.detailText}>
                  Name: {selectedOrder.customerName || 'Walk-in Customer'}
                </Text>
                <Text style={styles.detailText}>Date: {formatDate(selectedOrder.date)}</Text>
                <Text style={styles.detailText}>Served by: {selectedOrder.employee}</Text>
              </View>

              <View style={styles.orderDetailsSection}>
                <Text style={styles.sectionTitle}>Payment Information</Text>
                <View style={styles.paymentRow}>
                  <Icon
                    name={getPaymentIcon(selectedOrder.paymentMethod)}
                    size={20}
                    color={theme.colors.darkGray}
                  />
                  <Text style={styles.detailText}>{selectedOrder.paymentMethod.toUpperCase()}</Text>
                </View>
                <Text style={styles.totalText}>Total: £{selectedOrder.total.toFixed(2)}</Text>
              </View>

              <View style={styles.orderDetailsSection}>
                <Text style={styles.sectionTitle}>Order Items ({selectedOrder.items})</Text>
                <Text style={styles.detailText}>• Fish & Chips - £12.99</Text>
                <Text style={styles.detailText}>• Mushy Peas - £3.50</Text>
                <Text style={styles.detailText}>• Soft Drink - £2.50</Text>
                <View style={styles.divider} />
                <Text style={styles.detailText}>
                  Subtotal: £{(selectedOrder.total * 0.8).toFixed(2)}
                </Text>
                <Text style={styles.detailText}>
                  VAT (20%): £{(selectedOrder.total * 0.2).toFixed(2)}
                </Text>
                <Text style={styles.totalText}>Total: £{selectedOrder.total.toFixed(2)}</Text>
              </View>
            </ScrollView>
          )}
        </View>
      </Modal>
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
      backgroundColor: theme.colors.primary,
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 12,
      height: 60,
    },
    menuButton: {
      padding: 8,
    },
    headerCenter: {
      flex: 1,
      alignItems: 'center',
    },
    headerTitle: {
      fontSize: 20,
      fontWeight: 'bold',
      color: theme.colors.white,
    },
    headerSubtitle: {
      fontSize: 12,
      color: 'rgba(255, 255, 255, 0.8)',
    },
    headerButton: {
      padding: 8,
    },
    statsBar: {
      flexDirection: 'row',
      backgroundColor: theme.colors.white,
      paddingVertical: 16,
      paddingHorizontal: 20,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    statItem: {
      flex: 1,
      alignItems: 'center',
    },
    statValue: {
      fontSize: 20,
      fontWeight: 'bold',
      color: theme.colors.primary,
    },
    statLabel: {
      fontSize: 12,
      color: theme.colors.darkGray,
      marginTop: 4,
    },
    searchContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.colors.white,
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    searchIcon: {
      marginRight: 12,
    },
    searchInput: {
      flex: 1,
      fontSize: 16,
      color: theme.colors.text,
    },
    dateRangeContainer: {
      backgroundColor: theme.colors.white,
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    dateRangeButton: {
      paddingHorizontal: 20,
      paddingVertical: 8,
      marginRight: 12,
      borderRadius: 20,
      backgroundColor: theme.colors.background,
    },
    dateRangeButtonActive: {
      backgroundColor: theme.colors.primary,
    },
    dateRangeText: {
      fontSize: 14,
      fontWeight: '500',
      color: theme.colors.text,
    },
    dateRangeTextActive: {
      color: theme.colors.white,
    },
    ordersList: {
      padding: 16,
    },
    orderCard: {
      backgroundColor: theme.colors.white,
      borderRadius: 12,
      padding: 16,
      marginBottom: 12,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.05,
      shadowRadius: 4,
      elevation: 2,
    },
    orderHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: 12,
    },
    orderId: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.colors.text,
    },
    orderDate: {
      fontSize: 12,
      color: theme.colors.darkGray,
      marginTop: 2,
    },
    statusBadge: {
      paddingHorizontal: 12,
      paddingVertical: 4,
      borderRadius: 12,
    },
    statusText: {
      fontSize: 12,
      fontWeight: '600',
      color: theme.colors.white,
      textTransform: 'capitalize',
    },
    orderBody: {
      marginBottom: 12,
    },
    orderInfo: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 6,
    },
    orderInfoText: {
      fontSize: 14,
      color: theme.colors.text,
      marginLeft: 8,
    },
    orderFooter: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: theme.colors.border,
    },
    orderStats: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    orderItems: {
      fontSize: 14,
      color: theme.colors.darkGray,
      marginLeft: 8,
    },
    orderTotal: {
      fontSize: 18,
      fontWeight: 'bold',
      color: theme.colors.primary,
    },
    emptyState: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 100,
    },
    emptyStateText: {
      fontSize: 18,
      fontWeight: '500',
      color: theme.colors.text,
      marginTop: 16,
    },
    emptyStateSubtext: {
      fontSize: 14,
      color: theme.colors.darkGray,
      marginTop: 8,
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'flex-end',
    },
    filterModal: {
      backgroundColor: theme.colors.white,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      paddingTop: 20,
      paddingBottom: 40,
    },
    modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 20,
      marginBottom: 20,
    },
    modalTitle: {
      fontSize: 20,
      fontWeight: '600',
      color: theme.colors.text,
    },
    filterOptions: {
      paddingHorizontal: 20,
    },
    filterSectionTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.colors.text,
      marginBottom: 16,
    },
    filterOption: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 16,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    filterOptionActive: {
      backgroundColor: 'rgba(0, 166, 81, 0.05)',
    },
    filterOptionText: {
      fontSize: 16,
      color: theme.colors.text,
    },
    filterOptionTextActive: {
      color: theme.colors.primary,
      fontWeight: '600',
    },
    modalContainer: {
      flex: 1,
      backgroundColor: theme.colors.white,
    },
    orderDetailsContent: {
      flex: 1,
      padding: 16,
    },
    orderDetailsHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 24,
    },
    orderDetailsId: {
      fontSize: 24,
      fontWeight: 'bold',
      color: theme.colors.text,
    },
    orderDetailsSection: {
      marginBottom: 24,
      backgroundColor: theme.colors.background,
      borderRadius: 8,
      padding: 16,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: theme.colors.text,
      marginBottom: 12,
    },
    detailText: {
      fontSize: 16,
      color: theme.colors.text,
      marginBottom: 8,
    },
    paymentRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 8,
    },
    totalText: {
      fontSize: 18,
      fontWeight: 'bold',
      color: theme.colors.primary,
      marginTop: 8,
    },
    divider: {
      height: 1,
      backgroundColor: theme.colors.border,
      marginVertical: 12,
    },
    // Styles for LoadingView and Error/Retry will be implicitly handled by LoadingView component
    // but ensure emptyState styles are robust.
    // Centered style for the LoadingView/ErrorView wrapper if not using Fullscreen component
    centered: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    // Specific retry button style if not part of a generic ErrorDisplayComponent
    retryButton: {
      marginTop: 20,
      // backgroundColor: theme.colors.primary, // Applied inline
      paddingVertical: 10,
      paddingHorizontal: 20,
      borderRadius: 8,
    },
    retryButtonText: {
      // color: theme.colors.white, // Applied inline
      fontSize: 16,
      fontWeight: '600',
    },
  });

export default OrdersScreen;
