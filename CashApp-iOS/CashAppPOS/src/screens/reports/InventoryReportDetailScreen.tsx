// TODO: Unused import - import React, { useState, useEffect } from 'react';

import {
  StyleSheet,
  Text,
  View,
  SafeAreaView,
  StatusBar,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';

import { useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialIcons';

import DataService from '../../services/DataService';
import { logger } from '../../utils/logger';

const Colors = {
  primary: '#00A651',
  secondary: '#0066CC',
  success: '#27AE60',
  warning: '#F39C12',
  danger: '#E74C3C',
  background: '#F8F9FA',
  white: '#FFFFFF',
  lightGray: '#ECF0F1',
  mediumGray: '#BDC3C7',
  text: '#2C3E50',
  lightText: '#95A5A6',
};

interface InventoryItem {
  id: string;
  name: string;
  category: string;
  currentStock: number;
  reorderLevel: number;
  unitCost: number;
  totalValue: number;
  supplier: string;
  lastUpdated: Date;
  status: 'in_stock' | 'low_stock' | 'out_of_stock';
}

const InventoryReportDetailScreen = () => {
  const navigation = useNavigation();
  const [inventoryData, setInventoryData] = useState<InventoryItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadInventoryData();
  }, []);

  const loadInventoryData = async () => {
    try {
      setLoading(true);
      setError(null);

      const dataService = DataService.getInstance();
      const inventory = await dataService.getInventoryReport();

      // Transform API data to match InventoryItem interface if needed
      const transformedData: InventoryItem[] = inventory.map((item: unknown) => ({
        id: item.id || item.sku,
        name: item.name || item.product_name,
        category: item.category || 'Other',
        currentStock: item.current_stock || item.quantity || 0,
        reorderLevel: item.reorder_level || item.minimum_stock || 10,
        unitCost: item.unit_cost || item.cost || 0,
        totalValue: (item.current_stock || item.quantity || 0) * (item.unit_cost || item.cost || 0),
        supplier: item.supplier || item.supplier_name || 'Unknown Supplier',
        lastUpdated: item.last_updated ? new Date(item.last_updated) : new Date(),
        status: determineStockStatus(
          item.current_stock || item.quantity || 0,
          item.reorder_level || item.minimum_stock || 10
        ),
      }));

      setInventoryData(transformedData);
    } catch (error) {
      logger.error('Failed to load inventory data:', error);
      setError('Failed to load inventory data. Please try again.');
      Alert.alert(
        'Error',
        'Unable to load inventory data. Please check your connection and try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setLoading(false);
    }
  };

  const determineStockStatus = (
    currentStock: number,
    reorderLevel: number
  ): 'in_stock' | 'low_stock' | 'out_of_stock' => {
    if (currentStock === 0) return 'out_of_stock';
    if (currentStock <= reorderLevel) return 'low_stock';
    return 'in_stock';
  };

  const getFilteredData = () => {
    if (selectedCategory === 'all') return inventoryData;
    return inventoryData.filter((item) => item.category === selectedCategory);
  };

  const getInventoryStats = () => {
    const totalItems = inventoryData.length;
    const totalValue = inventoryData.reduce((sum, item) => sum + item.totalValue, 0);
    const lowStockItems = inventoryData.filter((item) => item.status === 'low_stock').length;
    const outOfStockItems = inventoryData.filter((item) => item.status === 'out_of_stock').length;

    return { totalItems, totalValue, lowStockItems, outOfStockItems };
  };

  const getCategories = () => {
    const categories = ['all', ...new Set(inventoryData.map((item) => item.category))];
    return categories;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'in_stock':
        return Colors.success;
      case 'low_stock':
        return Colors.warning;
      case 'out_of_stock':
        return Colors.danger;
      default:
        return Colors.lightText;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'in_stock':
        return 'check-circle';
      case 'low_stock':
        return 'warning';
      case 'out_of_stock':
        return 'error';
      default:
        return 'help';
    }
  };

  const formatCurrency = (amount: number) => {
    return `£${amount.toLocaleString('en-GB', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const stats = getInventoryStats();
  const filteredData = getFilteredData();
  const categories = getCategories();

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.primary} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Icon name="arrow-back" size={24} color={Colors.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Inventory Report</Text>
        <TouchableOpacity
          style={styles.headerAction}
          onPress={loadInventoryData}
          disabled={loading}
        >
          <Icon name="refresh" size={24} color={Colors.white} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Loading inventory data...</Text>
        </View>
      ) : error ? (
        <View style={styles.errorContainer}>
          <Icon name="error-outline" size={48} color={Colors.danger} />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={loadInventoryData}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView style={styles.content}>
          {/* Summary Cards */}
          <View style={styles.summaryContainer}>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryValue}>{stats.totalItems}</Text>
              <Text style={styles.summaryLabel}>Total Items</Text>
            </View>

            <View style={styles.summaryCard}>
              <Text style={styles.summaryValue}>{formatCurrency(stats.totalValue)}</Text>
              <Text style={styles.summaryLabel}>Total Value</Text>
            </View>

            <View style={styles.summaryCard}>
              <Text style={[styles.summaryValue, { color: Colors.warning }]}>
                {stats.lowStockItems}
              </Text>
              <Text style={styles.summaryLabel}>Low Stock</Text>
            </View>

            <View style={styles.summaryCard}>
              <Text style={[styles.summaryValue, { color: Colors.danger }]}>
                {stats.outOfStockItems}
              </Text>
              <Text style={styles.summaryLabel}>Out of Stock</Text>
            </View>
          </View>

          {/* Category Filter */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Filter by Category</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.categoryContainer}
            >
              {categories.map((category) => (
                <TouchableOpacity
                  key={category}
                  style={[
                    styles.categoryButton,
                    selectedCategory === category && styles.categoryButtonActive,
                  ]}
                  onPress={() => setSelectedCategory(category)}
                >
                  <Text
                    style={[
                      styles.categoryText,
                      selectedCategory === category && styles.categoryTextActive,
                    ]}
                  >
                    {category.charAt(0).toUpperCase() + category.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* Inventory Items */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Inventory Items ({filteredData.length})</Text>

            {filteredData.map((item, _index) => (
              <View key={item.id} style={styles.itemCard}>
                <View style={styles.itemHeader}>
                  <View style={styles.itemInfo}>
                    <Text style={styles.itemName}>{item.name}</Text>
                    <Text style={styles.itemCategory}>{item.category}</Text>
                  </View>
                  <View style={styles.statusContainer}>
                    <Icon
                      name={getStatusIcon(item.status)}
                      size={20}
                      color={getStatusColor(item.status)}
                    />
                    <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>
                      {item.status.replace('_', ' ').toUpperCase()}
                    </Text>
                  </View>
                </View>

                <View style={styles.itemDetails}>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Current Stock:</Text>
                    <Text style={styles.detailValue}>{item.currentStock} units</Text>
                  </View>

                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Reorder Level:</Text>
                    <Text style={styles.detailValue}>{item.reorderLevel} units</Text>
                  </View>

                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Unit Cost:</Text>
                    <Text style={styles.detailValue}>{formatCurrency(item.unitCost)}</Text>
                  </View>

                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Total Value:</Text>
                    <Text
                      style={[styles.detailValue, { fontWeight: 'bold', color: Colors.primary }]}
                    >
                      {formatCurrency(item.totalValue)}
                    </Text>
                  </View>

                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Supplier:</Text>
                    <Text style={styles.detailValue}>{item.supplier}</Text>
                  </View>

                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Last Updated:</Text>
                    <Text style={styles.detailValue}>{formatDate(item.lastUpdated)}</Text>
                  </View>
                </View>

                {/* Stock Level Bar */}
                <View style={styles.stockLevelContainer}>
                  <Text style={styles.stockLevelLabel}>Stock Level</Text>
                  <View style={styles.stockLevelBar}>
                    <View
                      style={[
                        styles.stockLevelFill,
                        {
                          width: `${Math.min(
                            (item.currentStock / (item.reorderLevel * 3)) * 100,
                            100
                          )}%`,
                          backgroundColor: getStatusColor(item.status),
                        },
                      ]}
                    />
                  </View>
                  <Text style={styles.stockLevelText}>
                    {item.currentStock} / {item.reorderLevel * 3} units
                  </Text>
                </View>

                {(item.status === 'low_stock' || item.status === 'out_of_stock') && (
                  <TouchableOpacity style={styles.reorderButton}>
                    <Icon name="shopping-cart" size={16} color={Colors.white} />
                    <Text style={styles.reorderButtonText}>Reorder Now</Text>
                  </TouchableOpacity>
                )}
              </View>
            ))}
          </View>

          <View style={styles.spacer} />
        </ScrollView>
      )}
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
    height: 60,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    flex: 1,
    color: Colors.white,
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  headerAction: {
    padding: 8,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  summaryContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 12,
    marginHorizontal: 2,
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  summaryValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 4,
  },
  summaryLabel: {
    fontSize: 11,
    color: Colors.lightText,
    textAlign: 'center',
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 12,
  },
  categoryContainer: {
    flexDirection: 'row',
  },
  categoryButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 8,
    borderRadius: 20,
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.lightGray,
  },
  categoryButtonActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  categoryText: {
    fontSize: 14,
    color: Colors.text,
    fontWeight: '500',
  },
  categoryTextActive: {
    color: Colors.white,
  },
  itemCard: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
  },
  itemCategory: {
    fontSize: 14,
    color: Colors.lightText,
    marginTop: 2,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  itemDetails: {
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  detailLabel: {
    fontSize: 14,
    color: Colors.lightText,
  },
  detailValue: {
    fontSize: 14,
    color: Colors.text,
    fontWeight: '500',
  },
  stockLevelContainer: {
    marginBottom: 12,
  },
  stockLevelLabel: {
    fontSize: 14,
    color: Colors.text,
    marginBottom: 6,
    fontWeight: '500',
  },
  stockLevelBar: {
    height: 8,
    backgroundColor: Colors.lightGray,
    borderRadius: 4,
    marginBottom: 4,
  },
  stockLevelFill: {
    height: '100%',
    borderRadius: 4,
  },
  stockLevelText: {
    fontSize: 12,
    color: Colors.lightText,
    textAlign: 'center',
  },
  reorderButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.warning,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  reorderButtonText: {
    color: Colors.white,
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
  spacer: {
    height: 40,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: Colors.lightText,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    marginTop: 16,
    fontSize: 16,
    color: Colors.danger,
    textAlign: 'center',
    marginBottom: 24,
  },
  retryButton: {
    backgroundColor: Colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  retryButtonText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: '600',
  },
});

export default InventoryReportDetailScreen;
