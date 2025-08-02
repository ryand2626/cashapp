import React from 'react';

import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import Icon from 'react-native-vector-icons/MaterialIcons';

import { useTheme } from '../design-system/ThemeProvider';
import CustomersScreen from '../screens/customers/CustomersScreen';
import EmployeesScreen from '../screens/employees/EmployeesScreen';
import EnhancedEmployeeScheduleScreen from '../screens/employees/EnhancedEmployeeScheduleScreen';
import InventoryScreen from '../screens/inventory/InventoryScreen';
import DashboardScreen from '../screens/main/DashboardScreen';
import HomeHubScreen from '../screens/main/HomeHubScreen';
import POSScreen from '../screens/main/POSScreen';
import ProfileScreen from '../screens/main/ProfileScreen';
import { TableSelectionScreen } from '../screens/main/TableSelectionScreen';
import OrdersScreen from '../screens/orders/OrdersScreen';
import EnhancedPaymentScreen from '../screens/payment/EnhancedPaymentScreen';
import ServiceChargeSelectionScreen from '../screens/payment/ServiceChargeSelectionScreen';
import QRCodePaymentScreen from '../screens/payments/QRCodePaymentScreen';
import SquareCardPaymentScreen from '../screens/payments/SquareCardPaymentScreen';
import SquareContactlessPaymentScreen from '../screens/payments/SquareContactlessPaymentScreen';
import CostAnalysisReportDetailScreen from '../screens/reports/CostAnalysisReportDetailScreen';
import FinancialReportDetailScreen from '../screens/reports/FinancialReportDetailScreen';
import InventoryReportDetailScreen from '../screens/reports/InventoryReportDetailScreen';
import LaborReportDetailScreen from '../screens/reports/LaborReportDetailScreen';
import ReportsScreen from '../screens/reports/ReportsScreenSimple';
import SalesReportDetailScreen from '../screens/reports/SalesReportDetailScreen';
import StaffReportDetailScreen from '../screens/reports/StaffReportDetailScreen';
import QRScannerScreen from '../screens/scanner/QRScannerScreen';
import MenuManagementScreen from '../screens/settings/app/MenuManagementScreen';
import HelpScreen from '../screens/support/HelpScreen';
import TableManagementScreen from '../screens/table/TableManagementScreen';

import SettingsNavigator from './SettingsNavigator';

import type { MainTabParamList, MainStackParamList } from '../types';

const Tab = createBottomTabNavigator<MainTabParamList>();
const Stack = createStackNavigator<MainStackParamList>();

const MainTabNavigator: React.FC = () => {
  const { theme } = useTheme();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: string;

          switch (route.name) {
            case 'Home':
              iconName = 'dashboard';
              break;
            default:
              iconName = 'dashboard';
          }

          return <Icon name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.textSecondary,
        tabBarStyle: {
          backgroundColor: theme.colors.background,
          borderTopWidth: 1,
          borderTopColor: theme.colors.border,
          paddingTop: 8,
          paddingBottom: 8,
          height: 80,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '600',
          marginTop: 4,
        },
        headerShown: false,
      })}
    >
      <Tab.Screen
        name="Home"
        component={HomeHubScreen}
        options={{
          tabBarLabel: 'Hub',
        }}
      />
    </Tab.Navigator>
  );
};

const MainNavigator: React.FC = () => {
  const { theme } = useTheme();

  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        cardStyle: { backgroundColor: theme.colors.background },
      }}
    >
      <Stack.Screen name="MainTabs" component={MainTabNavigator} />
      <Stack.Screen
        name="TableSelection"
        component={TableSelectionScreen}
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="POS"
        component={POSScreen}
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="Orders"
        component={OrdersScreen}
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="Reports"
        component={ReportsScreen}
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="SalesReport"
        component={SalesReportDetailScreen}
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="InventoryReport"
        component={InventoryReportDetailScreen}
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="StaffReport"
        component={StaffReportDetailScreen}
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="FinancialReport"
        component={FinancialReportDetailScreen}
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="LaborReport"
        component={LaborReportDetailScreen}
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="CostAnalysisReport"
        component={CostAnalysisReportDetailScreen}
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="Employees"
        component={EmployeesScreen}
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="EmployeeSchedule"
        component={EnhancedEmployeeScheduleScreen}
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="QRScanner"
        component={QRScannerScreen}
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="Customers"
        component={CustomersScreen}
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="Inventory"
        component={InventoryScreen}
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="TableManagement"
        component={TableManagementScreen}
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="MenuManagement"
        component={MenuManagementScreen}
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="Help"
        component={HelpScreen}
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="Settings"
        component={SettingsNavigator}
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="ServiceChargeSelection"
        component={ServiceChargeSelectionScreen}
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="EnhancedPayment"
        component={EnhancedPaymentScreen}
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="QRCodePayment"
        component={QRCodePaymentScreen}
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="SquareCardPayment"
        component={SquareCardPaymentScreen}
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="SquareContactlessPayment"
        component={SquareContactlessPaymentScreen}
        options={{
          headerShown: false,
        }}
      />
    </Stack.Navigator>
  );
};

export default MainNavigator;
