import React, { useState, useEffect } from 'react';

import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';

import Icon from 'react-native-vector-icons/MaterialIcons';

import { useTheme } from '../../design-system/ThemeProvider';

interface TableRevenueData {
  table_id: string;
  table_name: string;
  section_name: string;
  total_revenue: number;
  order_count: number;
  average_order_value: number;
}

interface TableRevenueWidgetProps {
  onPress?: () => void;
  compact?: boolean;
}

const TableRevenueWidget: React.FC<TableRevenueWidgetProps> = ({ onPress, compact = false }) => {
  const { theme } = useTheme();
  const [data, setData] = useState<TableRevenueData[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState<'today' | 'week' | 'month'>('today');

  const fetchTableRevenue = async () => {
    try {
      setLoading(true);
      setError(null);

      // Mock data for demo - in real app, call API
      const mockData: TableRevenueData[] = [
        {
          table_id: 'table1',
          table_name: 'T1',
          section_name: 'Main Dining',
          total_revenue: 245.75,
          order_count: 8,
          average_order_value: 30.72,
        },
        {
          table_id: 'table4',
          table_name: 'T4',
          section_name: 'Main Dining',
          total_revenue: 189.5,
          order_count: 5,
          average_order_value: 37.9,
        },
        {
          table_id: 'table3',
          table_name: 'T3',
          section_name: 'Main Dining',
          total_revenue: 156.25,
          order_count: 4,
          average_order_value: 39.06,
        },
        {
          table_id: 'table5',
          table_name: 'P1',
          section_name: 'Patio',
          total_revenue: 98.75,
          order_count: 3,
          average_order_value: 32.92,
        },
        {
          table_id: 'table6',
          table_name: 'B1',
          section_name: 'Bar Area',
          total_revenue: 67.5,
          order_count: 6,
          average_order_value: 11.25,
        },
      ];

      // Simulate API delay
      await new Promise((resolve) => setTimeout(resolve, 500));

      setData(mockData);
    } catch (err) {
      setError('Failed to load table revenue data');
      logger.error('Error fetching table revenue:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchTableRevenue();
  }, [selectedPeriod]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchTableRevenue();
  };

  const totalRevenue = data.reduce((sum, table) => sum + table.total_revenue, 0);
  const totalOrders = data.reduce((sum, table) => sum + table.order_count, 0);

  const renderTableRow = (table: TableRevenueData, _index: number) => (
    <View
      key={table.table_id}
      style={[styles.tableRow, { borderBottomColor: theme.colors.border }]}
    >
      <View style={styles.tableInfo}>
        <Text style={[styles.tableName, { color: theme.colors.text }]}>{table.table_name}</Text>
        <Text style={[styles.sectionName, { color: theme.colors.textSecondary }]}>
          {table.section_name}
        </Text>
      </View>
      <View style={styles.revenueInfo}>
        <Text style={[styles.revenue, { color: theme.colors.success }]}>
          £{table.total_revenue.toFixed(2)}
        </Text>
        <Text style={[styles.orderCount, { color: theme.colors.textSecondary }]}>
          {table.order_count} orders
        </Text>
      </View>
      <View style={styles.avgInfo}>
        <Text style={[styles.avgOrder, { color: theme.colors.text }]}>
          £{table.average_order_value.toFixed(2)}
        </Text>
        <Text style={[styles.avgLabel, { color: theme.colors.textSecondary }]}>avg</Text>
      </View>
    </View>
  );

  if (loading && !refreshing) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.white }]}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: theme.colors.text }]}>Revenue by Table</Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={[styles.loadingText, { color: theme.colors.textSecondary }]}>
            Loading...
          </Text>
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.white }]}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: theme.colors.text }]}>Revenue by Table</Text>
        </View>
        <View style={styles.errorContainer}>
          <Icon name="error" size={24} color={theme.colors.danger} />
          <Text style={[styles.errorText, { color: theme.colors.danger }]}>{error}</Text>
          <TouchableOpacity
            style={[styles.retryButton, { backgroundColor: theme.colors.primary }]}
            onPress={fetchTableRevenue}
          >
            <Text style={[styles.retryText, { color: theme.colors.white }]}>Retry</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <TouchableOpacity
      style={[styles.container, { backgroundColor: theme.colors.white }]}
      onPress={onPress}
      activeOpacity={onPress ? 0.7 : 1}
    >
      <View style={styles.header}>
        <View>
          <Text style={[styles.title, { color: theme.colors.text }]}>Revenue by Table</Text>
          <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>
            {selectedPeriod === 'today'
              ? 'Today'
              : selectedPeriod === 'week'
              ? 'This Week'
              : 'This Month'}
          </Text>
        </View>
        {onPress && <Icon name="chevron-right" size={24} color={theme.colors.textSecondary} />}
      </View>

      <View style={styles.periodSelector}>
        {(['today', 'week', 'month'] as const).map((period) => (
          <TouchableOpacity
            key={period}
            style={[
              styles.periodButton,
              { borderColor: theme.colors.border },
              selectedPeriod === period && {
                backgroundColor: theme.colors.primary,
                borderColor: theme.colors.primary,
              },
            ]}
            onPress={() => setSelectedPeriod(period)}
          >
            <Text
              style={[
                styles.periodButtonText,
                { color: theme.colors.text },
                selectedPeriod === period && { color: theme.colors.white },
              ]}
            >
              {period === 'today' ? 'Today' : period === 'week' ? 'Week' : 'Month'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={[styles.summaryRow, { borderBottomColor: theme.colors.border }]}>
        <View style={styles.summaryItem}>
          <Text style={[styles.summaryValue, { color: theme.colors.primary }]}>
            £{totalRevenue.toFixed(2)}
          </Text>
          <Text style={[styles.summaryLabel, { color: theme.colors.textSecondary }]}>
            Total Revenue
          </Text>
        </View>
        <View style={styles.summaryItem}>
          <Text style={[styles.summaryValue, { color: theme.colors.secondary }]}>
            {totalOrders}
          </Text>
          <Text style={[styles.summaryLabel, { color: theme.colors.textSecondary }]}>
            Total Orders
          </Text>
        </View>
        <View style={styles.summaryItem}>
          <Text style={[styles.summaryValue, { color: theme.colors.warning }]}>{data.length}</Text>
          <Text style={[styles.summaryLabel, { color: theme.colors.textSecondary }]}>
            Active Tables
          </Text>
        </View>
      </View>

      <ScrollView
        style={styles.tableList}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[theme.colors.primary]}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {data.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Icon name="restaurant" size={48} color={theme.colors.lightGray} />
            <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>
              No table revenue data available
            </Text>
          </View>
        ) : (
          <>
            <View style={[styles.headerRow, { borderBottomColor: theme.colors.border }]}>
              <Text style={[styles.headerText, { color: theme.colors.textSecondary }]}>Table</Text>
              <Text style={[styles.headerText, { color: theme.colors.textSecondary }]}>
                Revenue
              </Text>
              <Text style={[styles.headerText, { color: theme.colors.textSecondary }]}>
                Avg Order
              </Text>
            </View>
            {data.slice(0, compact ? 3 : data.length).map(renderTableRow)}
            {compact && data.length > 3 && (
              <TouchableOpacity style={styles.viewMoreButton} onPress={onPress}>
                <Text style={[styles.viewMoreText, { color: theme.colors.primary }]}>
                  View all {data.length} tables
                </Text>
                <Icon name="arrow-forward" size={16} color={theme.colors.primary} />
              </TouchableOpacity>
            )}
          </>
        )}
      </ScrollView>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    margin: 8,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  subtitle: {
    fontSize: 14,
    marginTop: 2,
  },
  periodSelector: {
    flexDirection: 'row',
    marginBottom: 16,
    gap: 8,
  },
  periodButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
  },
  periodButtonText: {
    fontSize: 12,
    fontWeight: '500',
  },
  summaryRow: {
    flexDirection: 'row',
    paddingBottom: 16,
    marginBottom: 16,
    borderBottomWidth: 1,
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
  },
  summaryValue: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  summaryLabel: {
    fontSize: 12,
    marginTop: 4,
  },
  tableList: {
    maxHeight: 200,
  },
  headerRow: {
    flexDirection: 'row',
    paddingBottom: 8,
    marginBottom: 8,
    borderBottomWidth: 1,
  },
  headerText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  tableInfo: {
    flex: 1,
  },
  tableName: {
    fontSize: 14,
    fontWeight: '600',
  },
  sectionName: {
    fontSize: 12,
    marginTop: 2,
  },
  revenueInfo: {
    flex: 1,
    alignItems: 'center',
  },
  revenue: {
    fontSize: 14,
    fontWeight: '600',
  },
  orderCount: {
    fontSize: 12,
    marginTop: 2,
  },
  avgInfo: {
    flex: 1,
    alignItems: 'center',
  },
  avgOrder: {
    fontSize: 14,
    fontWeight: '600',
  },
  avgLabel: {
    fontSize: 12,
    marginTop: 2,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    marginTop: 8,
    fontSize: 14,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  errorText: {
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 16,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  retryText: {
    fontSize: 14,
    fontWeight: '600',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 14,
    marginTop: 12,
    textAlign: 'center',
  },
  viewMoreButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 4,
  },
  viewMoreText: {
    fontSize: 14,
    fontWeight: '500',
  },
});

export default TableRevenueWidget;
