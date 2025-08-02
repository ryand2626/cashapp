import React, { useState, useEffect, useCallback } from 'react';

import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  RefreshControl,
  SegmentedControl,
} from 'react-native';

import { useNavigation, useRoute } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DatabaseService } from '../../services/DatabaseService';
import useAppStore from '../../store/useAppStore';

import type { MainStackParamList } from '../../navigation/MainNavigator';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

type NavigationProp = NativeStackNavigationProp<MainStackParamList, 'TableSelection'>;

interface Table {
  id: string;
  name: string;
  display_name: string;
  capacity: number;
  status: 'available' | 'occupied' | 'reserved' | 'cleaning' | 'blocked';
  section: {
    id: string;
    name: string;
    color: string;
  };
  current_order?: {
    id: string;
    name: string;
    amount: number;
  };
  server?: {
    id: string;
    name: string;
  };
  occupied_since?: string;
  stats?: {
    orders_today: number;
    revenue_today: number;
  };
}

interface Section {
  id: string;
  name: string;
  color: string;
  table_count: number;
  total_capacity: number;
}

const OrderTypeSegment = ['Dine In', 'Takeout', 'Pickup', 'Delivery'];

export const TableSelectionScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute();
  const { user } = useAppStore();
  const [tables, setTables] = useState<Table[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [selectedSection, setSelectedSection] = useState<string | null>(null);
  const [orderType, setOrderType] = useState(0); // 0 = Dine In
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchFloorPlan = useCallback(async () => {
    try {
      const response = await DatabaseService.getRestaurantFloorPlan(selectedSection);
      if (response.tables) {
        setTables(response.tables);
        setSections(response.sections || []);
      }
    } catch (error) {
      console.error('Error fetching floor plan:', error);
      Alert.alert('Error', 'Failed to load tables');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedSection]);

  useEffect(() => {
    fetchFloorPlan();
  }, [fetchFloorPlan]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchFloorPlan();
  };

  const getTableStatusColor = (status: string) => {
    switch (status) {
      case 'available':
        return '#27ae60';
      case 'occupied':
        return '#e74c3c';
      case 'reserved':
        return '#f39c12';
      case 'cleaning':
        return '#3498db';
      case 'blocked':
        return '#95a5a6';
      default:
        return '#7f8c8d';
    }
  };

  const handleTableSelect = async (table: Table) => {
    const orderTypeMap = ['dine_in', 'takeout', 'pickup', 'delivery'];
    const selectedOrderType = orderTypeMap[orderType];

    if (selectedOrderType === 'dine_in') {
      if (table.status !== 'available') {
        Alert.alert(
          'Table Unavailable',
          `This table is currently ${table.status}. Would you like to select a different table?`,
          [{ text: 'OK', style: 'default' }]
        );
        return;
      }

      // Navigate to POS screen with table info
      navigation.navigate('POS', {
        tableId: table.id,
        tableName: table.display_name,
        orderType: selectedOrderType,
      });
    } else {
      // For takeout/pickup/delivery, no table needed
      navigation.navigate('POS', {
        orderType: selectedOrderType,
      });
    }
  };

  const renderTable = ({ item }: { item: Table }) => {
    const statusColor = getTableStatusColor(item.status);
    const isOccupied = item.status === 'occupied';

    return (
      <TouchableOpacity
        style={[styles.tableCard, { borderColor: statusColor }]}
        onPress={() => handleTableSelect(item)}
        disabled={orderType !== 0 && item.status !== 'available'}
      >
        <View style={[styles.tableHeader, { backgroundColor: statusColor }]}>
          <Text style={styles.tableName}>{item.name}</Text>
          <Text style={styles.tableCapacity}>{item.capacity} seats</Text>
        </View>

        <View style={styles.tableBody}>
          <Text style={styles.tableSection}>{item.section.name}</Text>
          <Text style={[styles.tableStatus, { color: statusColor }]}>
            {item.status.toUpperCase()}
          </Text>

          {isOccupied && item.current_order && (
            <View style={styles.orderInfo}>
              <Text style={styles.orderText}>Order: {item.current_order.name}</Text>
              <Text style={styles.orderAmount}>£{item.current_order.amount.toFixed(2)}</Text>
            </View>
          )}

          {item.server && <Text style={styles.serverText}>Server: {item.server.name}</Text>}

          {item.stats && (
            <View style={styles.statsRow}>
              <Text style={styles.statText}>Today: {item.stats.orders_today} orders</Text>
              <Text style={styles.statText}>£{item.stats.revenue_today.toFixed(2)}</Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const renderSection = ({ item }: { item: Section }) => (
    <TouchableOpacity
      style={[
        styles.sectionChip,
        { backgroundColor: selectedSection === item.id ? item.color : '#ecf0f1' },
      ]}
      onPress={() => setSelectedSection(item.id === selectedSection ? null : item.id)}
    >
      <Text
        style={[styles.sectionText, { color: selectedSection === item.id ? '#fff' : '#2c3e50' }]}
      >
        {item.name} ({item.table_count})
      </Text>
    </TouchableOpacity>
  );

  const filteredTables = selectedSection
    ? tables.filter((table) => table.section.id === selectedSection)
    : tables;

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2563eb" />
          <Text style={styles.loadingText}>Loading tables...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Select Table</Text>

        <SegmentedControl
          values={OrderTypeSegment}
          selectedIndex={orderType}
          onChange={(event) => setOrderType(event.nativeEvent.selectedSegmentIndex)}
          style={styles.segmentControl}
        />
      </View>

      {orderType === 0 && sections.length > 0 && (
        <FlatList
          data={sections}
          renderItem={renderSection}
          keyExtractor={(item) => item.id}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.sectionList}
        />
      )}

      {orderType === 0 ? (
        <FlatList
          data={filteredTables}
          renderItem={renderTable}
          keyExtractor={(item) => item.id}
          numColumns={2}
          contentContainerStyle={styles.tableList}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No tables available</Text>
            </View>
          }
        />
      ) : (
        <View style={styles.takeoutContainer}>
          <Text style={styles.takeoutTitle}>{OrderTypeSegment[orderType]} Order</Text>
          <Text style={styles.takeoutDescription}>
            No table selection required for {OrderTypeSegment[orderType].toLowerCase()} orders.
          </Text>
          <TouchableOpacity
            style={styles.continueButton}
            onPress={() => handleTableSelect({} as Table)}
          >
            <Text style={styles.continueButtonText}>Continue to Order</Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    padding: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginBottom: 15,
  },
  segmentControl: {
    height: 40,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  sectionList: {
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  sectionChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 10,
  },
  sectionText: {
    fontSize: 14,
    fontWeight: '600',
  },
  tableList: {
    padding: 10,
  },
  tableCard: {
    flex: 1,
    margin: 10,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 2,
    overflow: 'hidden',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  tableHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
  },
  tableName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  tableCapacity: {
    fontSize: 14,
    color: '#fff',
    opacity: 0.9,
  },
  tableBody: {
    padding: 12,
  },
  tableSection: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  tableStatus: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 8,
  },
  orderInfo: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  orderText: {
    fontSize: 14,
    color: '#333',
  },
  orderAmount: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2563eb',
    marginTop: 4,
  },
  serverText: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  statText: {
    fontSize: 12,
    color: '#666',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 50,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
  },
  takeoutContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  takeoutTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginBottom: 10,
  },
  takeoutDescription: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 30,
  },
  continueButton: {
    backgroundColor: '#2563eb',
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 8,
  },
  continueButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
});
