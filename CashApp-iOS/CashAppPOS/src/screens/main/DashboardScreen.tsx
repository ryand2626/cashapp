import React from 'react';

import {
  StyleSheet,
  Text,
  View,
  SafeAreaView,
  StatusBar,
  ScrollView,
  TouchableOpacity,
} from 'react-native';

import { useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialIcons';

import { useTheme, useThemedStyles } from '../../design-system/ThemeProvider';
import { useRestaurantDisplayName } from '../../hooks/useRestaurantConfig';

interface KPICardProps {
  title: string;
  value: string;
  change: string;
  changeType: 'positive' | 'negative' | 'neutral';
  icon: string;
  color: string;
}

interface AlertItem {
  id: string;
  type: 'warning' | 'info' | 'success';
  title: string;
  message: string;
  time: string;
}

const DashboardScreen: React.FC = () => {
  const navigation = useNavigation();
  const restaurantDisplayName = useRestaurantDisplayName();
  const { theme } = useTheme();
  const styles = useThemedStyles(createStyles);
  const dynamicStyles = createDynamicStyles(theme);

  // Mock KPI data
  const kpiData: KPICardProps[] = [
    {
      title: "Today's Revenue",
      value: '£1,247.50',
      change: '+12.5%',
      changeType: 'positive',
      icon: 'attach-money',
      color: theme.colors.success,
    },
    {
      title: 'Orders Today',
      value: '23',
      change: '+8.2%',
      changeType: 'positive',
      icon: 'receipt',
      color: theme.colors.secondary,
    },
    {
      title: 'Avg Order Value',
      value: '£54.24',
      change: '-2.1%',
      changeType: 'negative',
      icon: 'trending-up',
      color: theme.colors.warning,
    },
    {
      title: 'Customer Satisfaction',
      value: '4.8',
      change: '+0.2',
      changeType: 'positive',
      icon: 'star',
      color: theme.colors.primary,
    },
  ];

  // Mock goals data
  const goalsData = [
    { label: 'Daily Sales Target', current: 1247.5, target: 1500.0, percentage: 83.2 },
    { label: 'Monthly Revenue', current: 28650.0, target: 35000.0, percentage: 81.9 },
    { label: 'Customer Retention', current: 94.5, target: 95.0, percentage: 99.5 },
  ];

  // Mock alerts data
  const alertsData: AlertItem[] = [
    {
      id: '1',
      type: 'warning',
      title: 'Low Stock Alert',
      message: 'Ground Coffee - House Blend is running low (5 kg remaining)',
      time: '15 min ago',
    },
    {
      id: '2',
      type: 'info',
      title: 'Peak Hour Approaching',
      message: 'Lunch rush expected in 30 minutes',
      time: '30 min ago',
    },
    {
      id: '3',
      type: 'success',
      title: 'Daily Target Achieved',
      message: 'Yesterday exceeded sales target by 15%',
      time: '2 hours ago',
    },
  ];

  const KPICard: React.FC<KPICardProps> = ({ title, value, change, changeType, icon, color }) => (
    <View style={styles.kpiCard}>
      <View style={styles.kpiHeader}>
        <View style={[styles.kpiIcon, dynamicStyles.kpiIcon(color)]}>
          <Icon name={icon} size={24} color={theme.colors.white} />
        </View>
        <View style={styles.kpiContent}>
          <Text style={styles.kpiTitle}>{title}</Text>
          <Text style={styles.kpiValue}>{value}</Text>
        </View>
      </View>
      <View style={styles.kpiChange}>
        <Icon
          name={
            changeType === 'positive'
              ? 'trending-up'
              : changeType === 'negative'
              ? 'trending-down'
              : 'trending-flat'
          }
          size={16}
          color={dynamicStyles.kpiChangeIcon(changeType).color}
        />
        <Text style={[styles.kpiChangeText, dynamicStyles.kpiChangeText(changeType)]}>
          {change}
        </Text>
        <Text style={styles.kpiChangeLabel}>vs yesterday</Text>
      </View>
    </View>
  );

  const GoalCard = ({
    label,
    current,
    target,
    percentage,
  }: {
    label: string;
    current: number;
    target: number;
    percentage: number;
  }) => (
    <View style={styles.goalCard}>
      <View style={styles.goalHeader}>
        <Text style={styles.goalLabel}>{label}</Text>
        <Text style={styles.goalPercentage}>{percentage.toFixed(1)}%</Text>
      </View>
      <View style={styles.goalProgress}>
        <View style={styles.goalProgressTrack}>
          <View style={[styles.goalProgressFill, dynamicStyles.goalProgressFill(percentage)]} />
        </View>
      </View>
      <View style={styles.goalValues}>
        <Text style={styles.goalCurrent}>
          {label.includes('Revenue') || label.includes('Sales')
            ? `£${current.toLocaleString()}`
            : current}
        </Text>
        <Text style={styles.goalTarget}>
          of{' '}
          {label.includes('Revenue') || label.includes('Sales')
            ? `£${target.toLocaleString()}`
            : target}
        </Text>
      </View>
    </View>
  );

  const AlertCard = ({ alert }: { alert: AlertItem }) => (
    <View style={styles.alertCard}>
      <View style={[styles.alertIcon, dynamicStyles.alertIcon(alert.type)]}>
        <Icon
          name={
            alert.type === 'warning'
              ? 'warning'
              : alert.type === 'success'
              ? 'check-circle'
              : 'info'
          }
          size={20}
          color={theme.colors.white}
        />
      </View>
      <View style={styles.alertContent}>
        <View style={styles.alertHeader}>
          <Text style={styles.alertTitle}>{alert.title}</Text>
          <Text style={styles.alertTime}>{alert.time}</Text>
        </View>
        <Text style={styles.alertMessage}>{alert.message}</Text>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={theme.colors.primary} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Icon name="arrow-back" size={24} color={theme.colors.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{restaurantDisplayName} Dashboard</Text>
        <TouchableOpacity style={styles.refreshButton}>
          <Icon name="refresh" size={24} color={theme.colors.white} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* KPI Cards */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Key Performance Indicators</Text>
          <View style={styles.kpiGrid}>
            {kpiData.map((kpi, index) => (
              <KPICard key={index} {...kpi} />
            ))}
          </View>
        </View>

        {/* Goals Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Goals & Targets</Text>
          <View style={styles.goalsContainer}>
            {goalsData.map((goal, index) => (
              <GoalCard key={index} {...goal} />
            ))}
          </View>
        </View>

        {/* Quick Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.quickActions}>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => navigation.navigate('Reports' as never)}
            >
              <Icon name="bar-chart" size={24} color={theme.colors.secondary} />
              <Text style={styles.actionText}>View Reports</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => navigation.navigate('Inventory' as never)}
            >
              <Icon name="inventory" size={24} color={theme.colors.warning} />
              <Text style={styles.actionText}>Check Inventory</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => navigation.navigate('Employees' as never)}
            >
              <Icon name="people" size={24} color={theme.colors.success} />
              <Text style={styles.actionText}>Manage Staff</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => navigation.navigate('Settings' as never)}
            >
              <Icon name="settings" size={24} color={theme.colors.darkGray} />
              <Text style={styles.actionText}>Settings</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Alerts & Notifications */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent Alerts</Text>
          <View style={styles.alertsContainer}>
            {alertsData.map((alert) => (
              <AlertCard key={alert.id} alert={alert} />
            ))}
          </View>
        </View>

        {/* Backend Status */}
        <View style={styles.section}>
          <View style={styles.backendNotice}>
            <Icon name="info" size={24} color={theme.colors.secondary} />
            <View style={styles.backendNoticeContent}>
              <Text style={styles.backendNoticeTitle}>Development Mode</Text>
              <Text style={styles.backendNoticeText}>
                This dashboard shows mock data for testing. Real-time data will be available once
                the backend is connected.
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

// Dynamic styles creator for conditional styling
const createDynamicStyles = (theme: unknown) => ({
  kpiIcon: (color: string) => ({
    backgroundColor: color,
  }),
  kpiChangeText: (changeType: 'positive' | 'negative' | 'neutral') => ({
    color:
      changeType === 'positive'
        ? theme.colors.success
        : changeType === 'negative'
        ? theme.colors.danger
        : theme.colors.lightText,
  }),
  kpiChangeIcon: (changeType: 'positive' | 'negative' | 'neutral') => ({
    color:
      changeType === 'positive'
        ? theme.colors.success
        : changeType === 'negative'
        ? theme.colors.danger
        : theme.colors.lightText,
  }),
  goalProgressFill: (percentage: number) => ({
    width: `${Math.min(percentage, 100)}%`,
  }),
  alertIcon: (type: 'warning' | 'info' | 'success') => ({
    backgroundColor:
      type === 'warning'
        ? theme.colors.warning
        : type === 'success'
        ? theme.colors.success
        : theme.colors.secondary,
  }),
});

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
      color: theme.colors.white,
    },
    refreshButton: {
      padding: 8,
    },
    content: {
      flex: 1,
      padding: 16,
    },
    section: {
      marginBottom: 24,
    },
    sectionTitle: {
      fontSize: 20,
      fontWeight: 'bold',
      color: theme.colors.text,
      marginBottom: 16,
    },
    kpiGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
    },
    kpiCard: {
      backgroundColor: theme.colors.white,
      borderRadius: 12,
      padding: 16,
      width: '48%',
      marginBottom: 12,
      elevation: 2,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.1,
      shadowRadius: 2,
    },
    kpiHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 12,
    },
    kpiIcon: {
      width: 40,
      height: 40,
      borderRadius: 20,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 12,
    },
    kpiContent: {
      flex: 1,
    },
    kpiTitle: {
      fontSize: 12,
      color: theme.colors.lightText,
      marginBottom: 2,
    },
    kpiValue: {
      fontSize: 18,
      fontWeight: 'bold',
      color: theme.colors.text,
    },
    kpiChange: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    kpiChangeText: {
      fontSize: 14,
      fontWeight: '600',
      marginLeft: 4,
    },
    kpiChangeLabel: {
      fontSize: 12,
      color: theme.colors.lightText,
      marginLeft: 4,
    },
    goalsContainer: {
      backgroundColor: theme.colors.white,
      borderRadius: 12,
      padding: 16,
      elevation: 2,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.1,
      shadowRadius: 2,
    },
    goalCard: {
      marginBottom: 20,
    },
    goalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 8,
    },
    goalLabel: {
      fontSize: 14,
      fontWeight: '500',
      color: theme.colors.text,
    },
    goalPercentage: {
      fontSize: 16,
      fontWeight: 'bold',
      color: theme.colors.primary,
    },
    goalProgress: {
      marginBottom: 8,
    },
    goalProgressTrack: {
      height: 8,
      backgroundColor: theme.colors.lightGray,
      borderRadius: 4,
    },
    goalProgressFill: {
      height: 8,
      backgroundColor: theme.colors.primary,
      borderRadius: 4,
    },
    goalValues: {
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    goalCurrent: {
      fontSize: 16,
      fontWeight: 'bold',
      color: theme.colors.text,
    },
    goalTarget: {
      fontSize: 14,
      color: theme.colors.lightText,
    },
    quickActions: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
    },
    actionButton: {
      backgroundColor: theme.colors.white,
      borderRadius: 12,
      padding: 16,
      width: '48%',
      alignItems: 'center',
      marginBottom: 12,
      elevation: 2,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.1,
      shadowRadius: 2,
    },
    actionText: {
      fontSize: 14,
      fontWeight: '500',
      color: theme.colors.text,
      marginTop: 8,
      textAlign: 'center',
    },
    alertsContainer: {
      backgroundColor: theme.colors.white,
      borderRadius: 12,
      padding: 16,
      elevation: 2,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.1,
      shadowRadius: 2,
    },
    alertCard: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.lightGray,
    },
    alertIcon: {
      width: 32,
      height: 32,
      borderRadius: 16,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 12,
    },
    alertContent: {
      flex: 1,
    },
    alertHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 4,
    },
    alertTitle: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.colors.text,
    },
    alertTime: {
      fontSize: 12,
      color: theme.colors.lightText,
    },
    alertMessage: {
      fontSize: 13,
      color: theme.colors.lightText,
      lineHeight: 18,
    },
    backendNotice: {
      backgroundColor: theme.colors.white,
      borderRadius: 12,
      padding: 16,
      flexDirection: 'row',
      alignItems: 'flex-start',
      elevation: 2,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.1,
      shadowRadius: 2,
    },
    backendNoticeContent: {
      flex: 1,
      marginLeft: 12,
    },
    backendNoticeTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.colors.text,
      marginBottom: 4,
    },
    backendNoticeText: {
      fontSize: 14,
      color: theme.colors.lightText,
      lineHeight: 20,
    },
  });

export default DashboardScreen;
