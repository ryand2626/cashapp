// TODO: Unused import - import React, { useState, useEffect } from 'react';

import {
  StyleSheet,
  Text,
  View,
  SafeAreaView,
  StatusBar,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  Alert,
} from 'react-native';

import { useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialIcons';

import ComingSoon from '../../components/feedback/ComingSoon';
import LoadingView from '../../components/feedback/LoadingView';
import { useTheme } from '../../design-system/ThemeProvider';
import DataService from '../../services/DataService';

// Mock ENV flag
const ENV = {
  FEATURE_REPORTS: true, // Set to true to enable, false to show ComingSoon
};

const { width: screenWidth, height: _screenHeight } = Dimensions.get('window');
const isTablet = screenWidth > 768;
const isSmallDevice = screenWidth < 380;

// Responsive font sizes
const getFontSize = (base: number) => {
  if (isTablet) return base * 1.2;
  if (isSmallDevice) return base * 0.9;
  return base;
};

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
  darkGray: '#7F8C8D',
  text: '#2C3E50',
  lightText: '#95A5A6',
};

interface SalesData {
  date: Date;
  dailySales: number;
  transactions: number;
  averageOrder: number;
  topItems: Array<{
    name: string;
    sold: number;
    revenue: number;
  }>;
  paymentMethods: {
    card: number;
    cash: number;
    mobile: number;
    qrCode: number;
  };
}

const SalesReportDetailScreen = () => {
  const navigation = useNavigation();
  const { theme } = useTheme();
  const [salesData, setSalesData] = useState<SalesData[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState('today');
  const [totalSales, setTotalSales] = useState(0);
  const [totalTransactions, setTotalTransactions] = useState(0);

  const periods = [
    { id: 'today', label: 'Today', icon: 'today' },
    { id: 'week', label: 'This Week', icon: 'date-range' },
    { id: 'month', label: 'This Month', icon: 'calendar-today' },
    { id: 'quarter', label: 'Quarter', icon: 'event' },
  ];

  useEffect(() => {
    if (ENV.FEATURE_REPORTS) {
      loadSalesData();
    } else {
      setIsLoading(false);
    }
  }, [selectedPeriod]);

  const loadSalesData = async () => {
    // Modified
    setIsLoading(true);
    setError(null);
    try {
      const dataService = DataService.getInstance();
      // Assuming getSalesReportDetail returns data in SalesData[] shape for the selectedPeriod
      // Or an object containing SalesData[] and pre-calculated totals.
      // For now, assume it returns SalesData[] and we recalculate totals.
      const data = await dataService.getSalesReportDetail(selectedPeriod);
      setSalesData(data || []);

      // Recalculate totals if service returns raw data
      if (data) {
        const total = data.reduce((sum, day) => sum + day.dailySales, 0);
        const totalTrans = data.reduce((sum, day) => sum + day.transactions, 0);
        setTotalSales(total);
        setTotalTransactions(totalTrans);
      } else {
        setTotalSales(0);
        setTotalTransactions(0);
      }
    } catch (e: unknown) {
      setError(e.message || 'Failed to load sales report.');
      setSalesData([]);
      setTotalSales(0);
      setTotalTransactions(0);
    } finally {
      setIsLoading(false);
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
      weekday: 'short',
      day: '2-digit',
      month: 'short',
    });
  };

  const getTopSellingItems = () => {
    const itemMap: { [key: string]: { sold: number; revenue: number } } = {};

    salesData.forEach((day) => {
      day.topItems.forEach((item) => {
        if (itemMap[item.name]) {
          itemMap[item.name].sold += item.sold;
          itemMap[item.name].revenue += item.revenue;
        } else {
          itemMap[item.name] = { sold: item.sold, revenue: item.revenue };
        }
      });
    });

    return Object.entries(itemMap)
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.sold - a.sold)
      .slice(0, 5);
  };

  const handleExportReport = () => {
    Alert.alert('Export Sales Report', 'Choose export format', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'PDF',
        onPress: () => Alert.alert('PDF Export', 'PDF export functionality coming soon'),
      },
      {
        text: 'CSV',
        onPress: () => Alert.alert('CSV Export', 'CSV export functionality coming soon'),
      },
      {
        text: 'Email',
        onPress: () => Alert.alert('Email Report', 'Email functionality coming soon'),
      },
    ]);
  };

  const getPaymentMethodTotals = () => {
    const totals = { card: 0, cash: 0, mobile: 0, qrCode: 0 };

    salesData.forEach((day) => {
      totals.card += day.paymentMethods.card;
      totals.cash += day.paymentMethods.cash;
      totals.mobile += day.paymentMethods.mobile;
      totals.qrCode += day.paymentMethods.qrCode;
    });

    return totals;
  };

  const topItems = salesData.length > 0 ? getTopSellingItems() : [];
  const paymentTotals =
    salesData.length > 0 ? getPaymentMethodTotals() : { card: 0, cash: 0, mobile: 0, qrCode: 0 };

  if (!ENV.FEATURE_REPORTS) {
    return <ComingSoon />;
  }

  if (isLoading) {
    return <LoadingView message="Loading Sales Report..." />;
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Icon name="arrow-back" size={24} color={Colors.white} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Sales Report</Text>
          <View style={{ width: 24 }} />
          {/* Placeholder for balance */}
        </View>
        <View style={styles.centeredError}>
          <Icon name="error-outline" size={64} color={Colors.danger} />
          <Text style={styles.errorTextHeader}>Error Loading Report</Text>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={loadSalesData} style={styles.retryButton}>
            <Text style={styles.retryButtonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // Handling for when salesData is empty after loading (no error)
  if (salesData.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Icon name="arrow-back" size={24} color={Colors.white} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Sales Report</Text>
          <TouchableOpacity
            style={styles.headerAction}
            onPress={() => {
              /* Share action */
            }}
          >
            <Icon name="share" size={24} color={Colors.white} />
          </TouchableOpacity>
        </View>
        <View style={styles.periodSelector}>
          {['today', 'week', 'month', 'year'].map((period) => (
            <TouchableOpacity
              key={period}
              style={[styles.periodButton, selectedPeriod === period && styles.periodButtonActive]}
              onPress={() => setSelectedPeriod(period)}
            >
              <Text
                style={[styles.periodText, selectedPeriod === period && styles.periodTextActive]}
              >
                {period.charAt(0).toUpperCase() + period.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <View style={styles.centeredError}>
          <Icon name="receipt-long" size={64} color={Colors.mediumGray} />
          <Text style={styles.errorTextHeader}>No Sales Data</Text>
          <Text style={styles.errorText}>
            There is no sales data available for the selected period.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.primary} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Icon name="arrow-back" size={24} color={Colors.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Sales Report</Text>
        <TouchableOpacity style={styles.headerAction} onPress={handleExportReport}>
          <Icon name="file-download" size={24} color={Colors.white} />
        </TouchableOpacity>
      </View>

      {/* Enhanced Period Selector */}
      <View style={[styles.periodSelector, { backgroundColor: theme.colors.white }]}>
        {periods.map((period) => (
          <TouchableOpacity
            key={period.id}
            style={[
              styles.periodButton,
              selectedPeriod === period.id && styles.periodButtonActive,
              { backgroundColor: selectedPeriod === period.id ? Colors.primary : 'transparent' },
            ]}
            onPress={() => setSelectedPeriod(period.id)}
          >
            <Icon
              name={period.icon}
              size={16}
              color={selectedPeriod === period.id ? Colors.white : Colors.darkGray}
              style={styles.periodIcon}
            />
            <Text
              style={[
                styles.periodText,
                selectedPeriod === period.id && styles.periodTextActive,
                { color: selectedPeriod === period.id ? Colors.white : theme.colors.text },
              ]}
            >
              {period.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView style={styles.content}>
        {/* Summary Cards */}
        <View style={styles.summaryContainer}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryValue}>{formatCurrency(totalSales)}</Text>
            <Text style={styles.summaryLabel}>Total Sales</Text>
            <View style={[styles.trendIndicator, { backgroundColor: Colors.success }]}>
              <Icon name="trending-up" size={16} color={Colors.white} />
              <Text style={styles.trendText}>+12.5%</Text>
            </View>
          </View>

          <View style={styles.summaryCard}>
            <Text style={styles.summaryValue}>{totalTransactions.toLocaleString()}</Text>
            <Text style={styles.summaryLabel}>Transactions</Text>
            <View style={[styles.trendIndicator, { backgroundColor: Colors.success }]}>
              <Icon name="trending-up" size={16} color={Colors.white} />
              <Text style={styles.trendText}>+8.3%</Text>
            </View>
          </View>

          <View style={styles.summaryCard}>
            <Text style={styles.summaryValue}>
              {formatCurrency(totalTransactions > 0 ? totalSales / totalTransactions : 0)}
            </Text>
            <Text style={styles.summaryLabel}>Avg Order</Text>
            <View style={[styles.trendIndicator, { backgroundColor: Colors.warning }]}>
              <Icon name="trending-flat" size={16} color={Colors.white} />
              <Text style={styles.trendText}>+2.1%</Text>
            </View>
          </View>
        </View>

        {/* Daily Sales Chart */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Daily Sales Trend</Text>
          <View style={styles.chartContainer}>
            <View style={styles.chartArea}>
              {salesData.slice(-7).map((day, index) => {
                const maxSales = Math.max(...salesData.slice(-7).map((d) => d.dailySales));
                const height = (day.dailySales / maxSales) * 120;

                return (
                  <View key={index} style={styles.chartBar}>
                    <View
                      style={[
                        styles.bar,
                        {
                          height,
                          backgroundColor: Colors.primary,
                          opacity: 0.7 + (0.3 * day.dailySales) / maxSales,
                        },
                      ]}
                    />
                    <Text style={styles.chartLabel}>{formatDate(day.date)}</Text>
                    <Text style={styles.chartValue}>{formatCurrency(day.dailySales)}</Text>
                  </View>
                );
              })}
            </View>
          </View>
        </View>

        {/* Top Selling Items */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Top Selling Items</Text>
          <View style={styles.card}>
            {topItems.map((item, index) => (
              <View key={index} style={styles.itemRow}>
                <View style={styles.itemRank}>
                  <Text style={styles.rankText}>{index + 1}</Text>
                </View>
                <View style={styles.itemInfo}>
                  <Text style={styles.itemName}>{item.name}</Text>
                  <Text style={styles.itemStats}>
                    {item.sold} sold • {formatCurrency(item.revenue)}
                  </Text>
                </View>
                <View style={styles.itemProgress}>
                  <View
                    style={[
                      styles.progressBar,
                      {
                        width: `${(item.sold / topItems[0].sold) * 100}%`,
                        backgroundColor: Colors.primary,
                      },
                    ]}
                  />
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* Payment Methods Breakdown */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Payment Methods</Text>
          <View style={styles.card}>
            <View style={styles.paymentRow}>
              <Icon name="credit-card" size={24} color={Colors.secondary} />
              <Text style={styles.paymentMethod}>Card Payments</Text>
              <Text style={styles.paymentAmount}>{formatCurrency(paymentTotals.card)}</Text>
            </View>
            <View style={styles.paymentRow}>
              <Icon name="attach-money" size={24} color={Colors.success} />
              <Text style={styles.paymentMethod}>Cash Payments</Text>
              <Text style={styles.paymentAmount}>{formatCurrency(paymentTotals.cash)}</Text>
            </View>
            <View style={styles.paymentRow}>
              <Icon name="phone-iphone" size={24} color={Colors.warning} />
              <Text style={styles.paymentMethod}>Mobile Payments</Text>
              <Text style={styles.paymentAmount}>{formatCurrency(paymentTotals.mobile)}</Text>
            </View>
            <View style={styles.paymentRow}>
              <Icon name="qr-code-scanner" size={24} color={Colors.primary} />
              <Text style={styles.paymentMethod}>QR Payments</Text>
              <Text style={styles.paymentAmount}>{formatCurrency(paymentTotals.qrCode)}</Text>
            </View>
          </View>
        </View>

        <View style={styles.spacer} />
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
    fontSize: getFontSize(20),
    fontWeight: 'bold',
    textAlign: 'center',
  },
  headerAction: {
    padding: 8,
  },
  periodSelector: {
    flexDirection: 'row',
    backgroundColor: Colors.white,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.lightGray,
  },
  periodButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginHorizontal: 4,
    borderRadius: 20,
    backgroundColor: Colors.lightGray,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  periodButtonActive: {
    backgroundColor: Colors.primary,
  },
  periodIcon: {
    marginRight: 6,
  },
  periodText: {
    fontSize: getFontSize(12),
    fontWeight: '500',
    color: Colors.text,
  },
  periodTextActive: {
    color: Colors.white,
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
    padding: 16,
    marginHorizontal: 4,
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  summaryValue: {
    fontSize: getFontSize(20),
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 4,
  },
  summaryLabel: {
    fontSize: getFontSize(12),
    color: Colors.lightText,
    marginBottom: 8,
  },
  trendIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  trendText: {
    fontSize: getFontSize(12),
    color: Colors.white,
    marginLeft: 4,
    fontWeight: '500',
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: getFontSize(18),
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 12,
  },
  card: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  chartContainer: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  chartArea: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    height: 160,
  },
  chartBar: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  bar: {
    width: 24,
    borderRadius: 4,
    marginBottom: 8,
  },
  chartLabel: {
    fontSize: getFontSize(10),
    color: Colors.lightText,
    textAlign: 'center',
    marginBottom: 4,
  },
  chartValue: {
    fontSize: getFontSize(10),
    color: Colors.text,
    fontWeight: '500',
    textAlign: 'center',
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.lightGray,
  },
  itemRank: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  rankText: {
    fontSize: getFontSize(14),
    fontWeight: 'bold',
    color: Colors.white,
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: getFontSize(16),
    fontWeight: '600',
    color: Colors.text,
  },
  itemStats: {
    fontSize: getFontSize(14),
    color: Colors.lightText,
    marginTop: 2,
  },
  itemProgress: {
    width: 60,
    height: 4,
    backgroundColor: Colors.lightGray,
    borderRadius: 2,
    marginLeft: 12,
  },
  progressBar: {
    height: '100%',
    borderRadius: 2,
  },
  paymentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.lightGray,
  },
  paymentMethod: {
    flex: 1,
    fontSize: getFontSize(16),
    color: Colors.text,
    marginLeft: 12,
  },
  paymentAmount: {
    fontSize: getFontSize(16),
    fontWeight: '600',
    color: Colors.primary,
  },
  spacer: {
    height: 40,
  },
  centeredError: {
    // Added
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: Colors.background, // Ensure background color
  },
  errorTextHeader: {
    // Added
    fontSize: getFontSize(18),
    fontWeight: 'bold',
    color: Colors.danger,
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  errorText: {
    // Added
    fontSize: getFontSize(14),
    color: Colors.text,
    textAlign: 'center',
    marginBottom: 20,
  },
  retryButton: {
    // Added
    backgroundColor: Colors.primary,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  retryButtonText: {
    // Added
    color: Colors.white,
    fontSize: getFontSize(16),
    fontWeight: '600',
  },
});

export default SalesReportDetailScreen;
