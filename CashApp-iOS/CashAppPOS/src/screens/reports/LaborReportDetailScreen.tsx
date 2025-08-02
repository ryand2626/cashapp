// TODO: Unused import - import React, { useState, useEffect } from 'react';

import {
  StyleSheet,
  Text,
  View,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';

import { useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialIcons';

import { useTheme } from '../../design-system/ThemeProvider';
import DataService from '../../services/DataService';
import { logger } from '../../utils/logger';

const Colors = {
  primary: '#00A651',
  white: '#FFFFFF',
  success: '#27AE60',
  warning: '#F39C12',
  danger: '#E74C3C',
  lightGray: '#ECF0F1',
  darkGray: '#7F8C8D',
  background: '#F8F9FA',
  text: '#2C3E50',
  lightText: '#95A5A6',
};

interface LaborData {
  employeeId: string;
  employeeName: string;
  role: string;
  scheduledHours: number;
  actualHours: number;
  overtimeHours: number;
  regularRate: number;
  overtimeRate: number;
  regularCost: number;
  overtimeCost: number;
  totalCost: number;
  efficiency: number;
  shifts: {
    date: string;
    scheduledStart: string;
    scheduledEnd: string;
    actualStart: string;
    actualEnd: string;
    hoursWorked: number;
  }[];
}

interface LaborSummary {
  totalScheduledHours: number;
  totalActualHours: number;
  totalOvertimeHours: number;
  totalLaborCost: number;
  averageEfficiency: number;
  laborCostPercentage: number;
  totalRevenue: number;
}

const LaborReportDetailScreen = () => {
  const navigation = useNavigation();
  const { theme } = useTheme();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [laborData, setLaborData] = useState<LaborData[]>([]);
  const [summary, setSummary] = useState<LaborSummary | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState('week');

  useEffect(() => {
    loadLaborData();
  }, [selectedPeriod]);

  const loadLaborData = async () => {
    try {
      setLoading(true);
      setError(null);

      const dataService = DataService.getInstance();
      const data = await dataService.getLaborReport(selectedPeriod);

      // Process the data
      const processedData: LaborData[] =
        data.employees?.map((emp: unknown) => ({
          employeeId: emp.id,
          employeeName: emp.name || `${emp.first_name} ${emp.last_name}`,
          role: emp.role,
          scheduledHours: emp.scheduled_hours || 0,
          actualHours: emp.actual_hours || 0,
          overtimeHours: emp.overtime_hours || 0,
          regularRate: emp.hourly_rate || 0,
          overtimeRate: (emp.hourly_rate || 0) * 1.5,
          regularCost: (emp.actual_hours || 0) * (emp.hourly_rate || 0),
          overtimeCost: (emp.overtime_hours || 0) * ((emp.hourly_rate || 0) * 1.5),
          totalCost:
            (emp.actual_hours || 0) * (emp.hourly_rate || 0) +
            (emp.overtime_hours || 0) * ((emp.hourly_rate || 0) * 1.5),
          efficiency: emp.scheduled_hours > 0 ? (emp.actual_hours / emp.scheduled_hours) * 100 : 0,
          shifts: emp.shifts || [],
        })) || [];

      // Calculate summary
      const summaryData: LaborSummary = {
        totalScheduledHours: processedData.reduce((sum, emp) => sum + emp.scheduledHours, 0),
        totalActualHours: processedData.reduce((sum, emp) => sum + emp.actualHours, 0),
        totalOvertimeHours: processedData.reduce((sum, emp) => sum + emp.overtimeHours, 0),
        totalLaborCost: processedData.reduce((sum, emp) => sum + emp.totalCost, 0),
        averageEfficiency:
          processedData.length > 0
            ? processedData.reduce((sum, emp) => sum + emp.efficiency, 0) / processedData.length
            : 0,
        laborCostPercentage: data.labor_cost_percentage || 0,
        totalRevenue: data.total_revenue || 0,
      };

      setLaborData(processedData);
      setSummary(summaryData);
    } catch (error) {
      logger.error('Failed to load labor data:', error);
      setError('Failed to load labor data. Please try again.');
      Alert.alert(
        'Error',
        'Unable to load labor data. Please check your connection and try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setLoading(false);
    }
  };

  const _handleExportReport = () => {
    Alert.alert('Export Labor Report', 'Export functionality will be available soon');
  };

  const formatCurrency = (amount: number) => {
    return `£${amount.toLocaleString('en-GB', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  const formatHours = (hours: number) => {
    return `${hours.toFixed(1)}h`;
  };

  const getEfficiencyColor = (efficiency: number) => {
    if (efficiency >= 95) return Colors.success;
    if (efficiency >= 85) return Colors.warning;
    return Colors.danger;
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Icon name="arrow-back" size={24} color={Colors.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Labor Report</Text>
        <TouchableOpacity style={styles.headerAction} onPress={loadLaborData} disabled={loading}>
          <Icon name="refresh" size={24} color={Colors.white} />
        </TouchableOpacity>
      </View>

      {/* Period Selector */}
      <View style={styles.periodSelector}>
        {['day', 'week', 'month'].map((period) => (
          <TouchableOpacity
            key={period}
            style={[styles.periodButton, selectedPeriod === period && styles.periodButtonActive]}
            onPress={() => setSelectedPeriod(period)}
          >
            <Text
              style={[
                styles.periodButtonText,
                selectedPeriod === period && styles.periodButtonTextActive,
              ]}
            >
              {period.charAt(0).toUpperCase() + period.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Loading labor data...</Text>
        </View>
      ) : error ? (
        <View style={styles.errorContainer}>
          <Icon name="error-outline" size={48} color={Colors.danger} />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={loadLaborData}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView style={styles.content}>
          {/* Summary Cards */}
          {summary && (
            <View style={styles.summaryContainer}>
              <View style={[styles.summaryCard, { backgroundColor: theme.colors.white }]}>
                <Icon name="schedule" size={32} color={Colors.primary} />
                <Text style={[styles.summaryValue, { color: theme.colors.text }]}>
                  {formatHours(summary.totalScheduledHours)}
                </Text>
                <Text style={[styles.summaryLabel, { color: Colors.darkGray }]}>Scheduled</Text>
              </View>

              <View style={[styles.summaryCard, { backgroundColor: theme.colors.white }]}>
                <Icon name="access-time" size={32} color={Colors.success} />
                <Text style={[styles.summaryValue, { color: theme.colors.text }]}>
                  {formatHours(summary.totalActualHours)}
                </Text>
                <Text style={[styles.summaryLabel, { color: Colors.darkGray }]}>Actual</Text>
              </View>

              <View style={[styles.summaryCard, { backgroundColor: theme.colors.white }]}>
                <Icon
                  name="trending-up"
                  size={32}
                  color={getEfficiencyColor(summary.averageEfficiency)}
                />
                <Text style={[styles.summaryValue, { color: theme.colors.text }]}>
                  {summary.averageEfficiency.toFixed(0)}%
                </Text>
                <Text style={[styles.summaryLabel, { color: Colors.darkGray }]}>Efficiency</Text>
              </View>

              <View style={[styles.summaryCard, { backgroundColor: theme.colors.white }]}>
                <Icon name="attach-money" size={32} color={Colors.warning} />
                <Text style={[styles.summaryValue, { color: theme.colors.text }]}>
                  {formatCurrency(summary.totalLaborCost)}
                </Text>
                <Text style={[styles.summaryLabel, { color: Colors.darkGray }]}>Labor Cost</Text>
              </View>
            </View>
          )}

          {/* Labor Cost Percentage */}
          {summary && (
            <View style={styles.costPercentageCard}>
              <Text style={styles.costPercentageTitle}>Labor Cost as % of Revenue</Text>
              <View style={styles.costPercentageBar}>
                <View
                  style={[
                    styles.costPercentageFill,
                    {
                      width: `${Math.min(summary.laborCostPercentage, 100)}%`,
                      backgroundColor:
                        summary.laborCostPercentage > 30 ? Colors.danger : Colors.success,
                    },
                  ]}
                />
              </View>
              <View style={styles.costPercentageInfo}>
                <Text style={styles.costPercentageValue}>
                  {summary.laborCostPercentage.toFixed(1)}%
                </Text>
                <Text style={styles.costPercentageTarget}>Target: {'<'} 30%</Text>
              </View>
            </View>
          )}

          {/* Employee Details */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Employee Details</Text>
            {laborData.map((employee) => (
              <View key={employee.employeeId} style={styles.employeeCard}>
                <View style={styles.employeeHeader}>
                  <View>
                    <Text style={styles.employeeName}>{employee.employeeName}</Text>
                    <Text style={styles.employeeRole}>{employee.role}</Text>
                  </View>
                  <View style={styles.employeeEfficiency}>
                    <Text
                      style={[
                        styles.efficiencyValue,
                        { color: getEfficiencyColor(employee.efficiency) },
                      ]}
                    >
                      {employee.efficiency.toFixed(0)}%
                    </Text>
                    <Text style={styles.efficiencyLabel}>Efficiency</Text>
                  </View>
                </View>

                <View style={styles.employeeStats}>
                  <View style={styles.statRow}>
                    <Text style={styles.statLabel}>Scheduled:</Text>
                    <Text style={styles.statValue}>{formatHours(employee.scheduledHours)}</Text>
                  </View>
                  <View style={styles.statRow}>
                    <Text style={styles.statLabel}>Actual:</Text>
                    <Text style={styles.statValue}>{formatHours(employee.actualHours)}</Text>
                  </View>
                  <View style={styles.statRow}>
                    <Text style={styles.statLabel}>Overtime:</Text>
                    <Text
                      style={[
                        styles.statValue,
                        employee.overtimeHours > 0 && { color: Colors.warning },
                      ]}
                    >
                      {formatHours(employee.overtimeHours)}
                    </Text>
                  </View>
                </View>

                <View style={styles.employeeCosts}>
                  <View style={styles.costRow}>
                    <Text style={styles.costLabel}>
                      Regular ({formatCurrency(employee.regularRate)}/h):
                    </Text>
                    <Text style={styles.costValue}>{formatCurrency(employee.regularCost)}</Text>
                  </View>
                  <View style={styles.costRow}>
                    <Text style={styles.costLabel}>
                      Overtime ({formatCurrency(employee.overtimeRate)}/h):
                    </Text>
                    <Text style={styles.costValue}>{formatCurrency(employee.overtimeCost)}</Text>
                  </View>
                  <View style={[styles.costRow, styles.totalRow]}>
                    <Text style={styles.totalLabel}>Total Cost:</Text>
                    <Text style={styles.totalValue}>{formatCurrency(employee.totalCost)}</Text>
                  </View>
                </View>
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
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.white,
  },
  headerAction: {
    padding: 4,
  },
  periodSelector: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.lightGray,
  },
  periodButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
    marginHorizontal: 4,
    backgroundColor: Colors.lightGray,
  },
  periodButtonActive: {
    backgroundColor: Colors.primary,
  },
  periodButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.darkGray,
  },
  periodButtonTextActive: {
    color: Colors.white,
  },
  content: {
    flex: 1,
  },
  summaryContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 16,
    justifyContent: 'space-between',
  },
  summaryCard: {
    width: '48%',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  summaryValue: {
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 8,
  },
  summaryLabel: {
    fontSize: 14,
    marginTop: 4,
  },
  costPercentageCard: {
    backgroundColor: Colors.white,
    margin: 16,
    padding: 16,
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  costPercentageTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 12,
  },
  costPercentageBar: {
    height: 20,
    backgroundColor: Colors.lightGray,
    borderRadius: 10,
    overflow: 'hidden',
  },
  costPercentageFill: {
    height: '100%',
    borderRadius: 10,
  },
  costPercentageInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  costPercentageValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text,
  },
  costPercentageTarget: {
    fontSize: 14,
    color: Colors.lightText,
  },
  section: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 16,
  },
  employeeCard: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  employeeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  employeeName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
  },
  employeeRole: {
    fontSize: 14,
    color: Colors.lightText,
    marginTop: 2,
  },
  employeeEfficiency: {
    alignItems: 'center',
  },
  efficiencyValue: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  efficiencyLabel: {
    fontSize: 12,
    color: Colors.lightText,
    marginTop: 2,
  },
  employeeStats: {
    borderTopWidth: 1,
    borderTopColor: Colors.lightGray,
    paddingTop: 12,
    marginBottom: 12,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  statLabel: {
    fontSize: 14,
    color: Colors.lightText,
  },
  statValue: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.text,
  },
  employeeCosts: {
    borderTopWidth: 1,
    borderTopColor: Colors.lightGray,
    paddingTop: 12,
  },
  costRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  costLabel: {
    fontSize: 14,
    color: Colors.lightText,
  },
  costValue: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.text,
  },
  totalRow: {
    borderTopWidth: 1,
    borderTopColor: Colors.lightGray,
    paddingTop: 8,
    marginTop: 8,
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
  },
  totalValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.primary,
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
  spacer: {
    height: 40,
  },
});

export default LaborReportDetailScreen;
