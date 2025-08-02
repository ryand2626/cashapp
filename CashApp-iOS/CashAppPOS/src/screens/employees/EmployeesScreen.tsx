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
  TextInput,
  Modal,
  Alert,
  ActivityIndicator,
} from 'react-native';

import { useNavigation } from '@react-navigation/native';
import { CalendarClock } from 'lucide-react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';

// import { generateEmployees, EmployeeData } from '../../utils/mockDataGenerator'; // Removed
import Colors from '../../constants/Colors';
import { useTheme } from '../../design-system/ThemeProvider';
import DataService from '../../services/DataService'; // Added

import type { EmployeeData } from '../../types'; // Updated import path

const EmployeesScreen: React.FC = () => {
  const navigation = useNavigation();
  const { _theme } = useTheme();
  const [employees, setEmployees] = useState<EmployeeData[]>([]);
  const [filteredEmployees, setFilteredEmployees] = useState<EmployeeData[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRole, setSelectedRole] = useState<string>('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<EmployeeData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true); // Added
  const [error, setError] = useState<string | null>(null); // Added

  // Add Employee Form State
  const [newEmployee, setNewEmployee] = useState({
    name: '',
    email: '',
    phone: '',
    role: 'Cashier',
    hourlyRate: '12.00',
  });

  useEffect(() => {
    loadEmployees();
  }, []);

  useEffect(() => {
    // Only filter if not loading and no error
    if (!isLoading && !error) {
      filterEmployees();
    } else {
      // If loading or error, ensure filtered list is empty or reflects state
      setFilteredEmployees([]);
    }
  }, [employees, searchQuery, selectedRole, isLoading, error]);

  const loadEmployees = async () => {
    // Modified
    setIsLoading(true);
    setError(null);
    try {
      const dataService = DataService.getInstance();
      // Assuming a getEmployees method will be added to DataService
      const employeeData = await dataService.getEmployees();
      setEmployees(employeeData || []);
    } catch (e: unknown) {
      setError(e.message || 'Failed to load employees.');
      setEmployees([]); // Clear employees on error
    } finally {
      setIsLoading(false);
    }
  };

  const filterEmployees = () => {
    let filtered = employees;

    // Apply role filter
    if (selectedRole !== 'all') {
      filtered = filtered.filter((employee) => employee.role === selectedRole);
    }

    // Apply search query
    if (searchQuery) {
      filtered = filtered.filter(
        (employee) =>
          employee.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          employee.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
          employee.role.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    setFilteredEmployees(filtered);
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'Manager':
        return Colors.primary;
      case 'Cashier':
        return Colors.secondary;
      case 'Server':
        return Colors.warning;
      case 'Cook':
        return Colors.danger;
      default:
        return Colors.darkGray;
    }
  };

  const getPerformanceColor = (score: number) => {
    if (score >= 90) return Colors.success;
    if (score >= 80) return Colors.warning;
    return Colors.danger;
  };

  const formatHireDate = (date: Date | string) => {
    const dateObj = date instanceof Date ? date : new Date(date);
    const months = Math.floor((Date.now() - dateObj.getTime()) / (1000 * 60 * 60 * 24 * 30));
    if (months < 1) return 'New hire';
    if (months < 12) return `${months} months`;
    const years = Math.floor(months / 12);
    return `${years} year${years > 1 ? 's' : ''}`;
  };

  const handleEmployeePress = (employee: EmployeeData) => {
    setSelectedEmployee(employee);
  };

  const handleAddEmployee = async () => {
    // Validate required fields
    if (!newEmployee.name.trim() || !newEmployee.email.trim()) {
      Alert.alert('Error', 'Please fill in all required fields (Name and Email)');
      return;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newEmployee.email.trim())) {
      Alert.alert('Error', 'Please enter a valid email address');
      return;
    }

    // Check if email already exists
    const emailExists = employees.some(
      (emp) => emp.email.toLowerCase() === newEmployee.email.trim().toLowerCase()
    );
    if (emailExists) {
      Alert.alert('Error', 'An employee with this email already exists');
      return;
    }

    try {
      // Show loading indicator
      setShowAddModal(false);
      setIsLoading(true);

      // Parse name into first and last name
      const nameParts = newEmployee.name.trim().split(' ');
      const firstName = nameParts[0];
      const lastName = nameParts.slice(1).join(' ') || nameParts[0]; // Use first name as last name if only one name provided

      // Create employee via API
      const dataService = DataService.getInstance();
      const createdEmployee = await dataService.createEmployee({
        firstName,
        lastName,
        email: newEmployee.email.trim(),
        phone: newEmployee.phone.trim() || undefined,
        role: newEmployee.role.toLowerCase(), // API expects lowercase roles
        hourlyRate: parseFloat(newEmployee.hourlyRate) || 12.0,
        startDate: new Date().toISOString(),
      });

      // Transform API response to match EmployeeData interface
      const employeeData: EmployeeData = {
        id: createdEmployee.id || Date.now(),
        name: `${createdEmployee.first_name} ${createdEmployee.last_name}`,
        email: createdEmployee.email,
        phone: createdEmployee.phone || `+44 ${Math.floor(Math.random() * 900000000) + 100000000}`,
        role: (createdEmployee.role.charAt(0).toUpperCase() + createdEmployee.role.slice(1)) as
          | 'Manager'
          | 'Cashier'
          | 'Server'
          | 'Cook',
        hireDate: new Date(createdEmployee.start_date || createdEmployee.created_at),
        hourlyRate: createdEmployee.hourly_rate || 12.0,
        totalSales: 0,
        averageSalesPerDay: 0,
        performanceScore: 85 + Math.random() * 10, // Initial score between 85-95
        punctualityScore: 90 + Math.random() * 8, // Initial score between 90-98
        scheduledHours: 160,
        actualHours: 160,
        weeksSinceLastReview: 0,
      };

      // Add to local state
      setEmployees([...employees, employeeData]);

      // Reset form
      setNewEmployee({
        name: '',
        email: '',
        phone: '',
        role: 'Cashier',
        hourlyRate: '12.00',
      });

      // Show success message
      Alert.alert(
        'Success',
        `${employeeData.name} has been added to your team and saved to the system!`
      );
    } catch (error: unknown) {
      logger.error('Failed to create employee:', error);
      Alert.alert(
        'Error',
        error.message || 'Failed to add employee. Please check your connection and try again.'
      );

      // Reopen modal on error
      setShowAddModal(true);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancelAdd = () => {
    setNewEmployee({
      name: '',
      email: '',
      phone: '',
      role: 'Cashier',
      hourlyRate: '12.00',
    });
    setShowAddModal(false);
  };

  const handleDeleteEmployee = async (employee: EmployeeData) => {
    Alert.alert(
      'Delete Employee',
      `Are you sure you want to remove ${employee.name} from your team?`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              // Close modal first
              setSelectedEmployee(null);
              setIsLoading(true);

              // Delete from backend
              const dataService = DataService.getInstance();
              await dataService.deleteEmployee(employee.id);

              // Remove from local state
              setEmployees(employees.filter((emp) => emp.id !== employee.id));

              // Show success message
              Alert.alert('Success', `${employee.name} has been removed from your team.`);
            } catch (error: unknown) {
              logger.error('Failed to delete employee:', error);
              Alert.alert('Error', error.message || 'Failed to delete employee. Please try again.');
              // Reopen modal on error
              setSelectedEmployee(employee);
            } finally {
              setIsLoading(false);
            }
          },
        },
      ],
      { cancelable: true }
    );
  };

  const renderEmployee = ({ item }: { item: EmployeeData }) => (
    <TouchableOpacity
      style={styles.employeeCard}
      onPress={() => handleEmployeePress(item)}
      activeOpacity={0.7}
    >
      <View style={styles.employeeHeader}>
        <View style={styles.employeeAvatar}>
          <Icon name="account-circle" size={50} color={Colors.primary} />
        </View>
        <View style={styles.employeeInfo}>
          <Text style={styles.employeeName}>{item.name}</Text>
          <View style={[styles.roleBadge, { backgroundColor: `${getRoleColor(item.role)}20` }]}>
            <Text style={[styles.roleText, { color: getRoleColor(item.role) }]}>{item.role}</Text>
          </View>
          <Text style={styles.employeeEmail}>{item.email}</Text>
        </View>
        <View style={styles.employeeStats}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>£{item.totalSales.toFixed(0)}</Text>
            <Text style={styles.statLabel}>Total Sales</Text>
          </View>
        </View>
      </View>

      <View style={styles.employeeMetrics}>
        <View style={styles.metricItem}>
          <Icon name="schedule" size={16} color={Colors.darkGray} />
          <Text style={styles.metricText}>{formatHireDate(item.hireDate)}</Text>
        </View>
        <View style={styles.metricItem}>
          <Icon name="attach-money" size={16} color={Colors.darkGray} />
          <Text style={styles.metricText}>£{item.hourlyRate.toFixed(2)}/hr</Text>
        </View>
        <View style={styles.metricItem}>
          <Icon name="star" size={16} color={getPerformanceColor(item.performanceScore)} />
          <Text style={[styles.metricText, { color: getPerformanceColor(item.performanceScore) }]}>
            {item.performanceScore.toFixed(1)}%
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  const stats = {
    total: employees.length,
    active: employees.filter((e) => e.actualHours >= e.scheduledHours * 0.9).length,
    managers: employees.filter((e) => e.role === 'Manager').length,
    avgPerformance:
      employees.length > 0
        ? employees.reduce((sum, e) => sum + e.performanceScore, 0) / employees.length
        : 0,
  };

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Loading Employees...</Text>
      </SafeAreaView>
    );
  }

  const renderEmptyListComponent = () => {
    if (error) {
      return (
        <View style={styles.emptyState}>
          <Icon name="error-outline" size={64} color={Colors.danger} />
          <Text style={styles.emptyStateText}>Error Loading Employees</Text>
          <Text style={styles.emptyStateSubtext}>{error}</Text>
          <TouchableOpacity onPress={loadEmployees} style={styles.retryButton}>
            <Text style={styles.retryButtonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return (
      <View style={styles.emptyState}>
        <Icon name="people" size={64} color={Colors.lightGray} />
        <Text style={styles.emptyStateText}>No employees found</Text>
        <Text style={styles.emptyStateSubtext}>
          {searchQuery ? 'Try adjusting your search' : 'Add your first employee or pull to refresh'}
        </Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar backgroundColor={Colors.primary} barStyle="light-content" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
        >
          <Icon name="arrow-back" size={24} color={Colors.white} />
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Employees</Text>
          <Text style={styles.headerSubtitle}>{filteredEmployees.length} staff members</Text>
        </View>

        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.scheduleButton}
            onPress={() => navigation.navigate('EmployeeSchedule')}
          >
            <CalendarClock size={28} color={Colors.primary} />
            <Text style={styles.scheduleLabel}>Schedule</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.addButton} onPress={() => setShowAddModal(true)}>
            <Icon name="add" size={24} color={Colors.white} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Stats Bar */}
      <View style={styles.statsBar}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{stats.total}</Text>
          <Text style={styles.statLabel}>Total Staff</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[styles.statValue, { color: Colors.success }]}>{stats.active}</Text>
          <Text style={styles.statLabel}>Active</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[styles.statValue, { color: Colors.secondary }]}>{stats.managers}</Text>
          <Text style={styles.statLabel}>Managers</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[styles.statValue, { color: Colors.warning }]}>
            {stats.avgPerformance.toFixed(1)}%
          </Text>
          <Text style={styles.statLabel}>Avg Score</Text>
        </View>
      </View>

      {/* Search and Filter */}
      <View style={styles.searchSection}>
        <View style={styles.searchContainer}>
          <Icon name="search" size={20} color={Colors.darkGray} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search employees..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholderTextColor={Colors.darkGray}
          />
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.roleFilters}>
          {['all', 'Manager', 'Cashier', 'Server', 'Cook'].map((role) => (
            <TouchableOpacity
              key={role}
              style={[styles.roleFilter, selectedRole === role && styles.roleFilterActive]}
              onPress={() => setSelectedRole(role)}
            >
              <Text
                style={[
                  styles.roleFilterText,
                  selectedRole === role && styles.roleFilterTextActive,
                ]}
              >
                {role === 'all' ? 'All Roles' : role}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Employees List */}
      <FlatList
        data={filteredEmployees}
        renderItem={renderEmployee}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={styles.employeesList}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={renderEmptyListComponent}
        onRefresh={loadEmployees} // Added
        refreshing={isLoading} // Added
      />

      {/* Employee Detail Modal */}
      <Modal
        visible={!!selectedEmployee}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setSelectedEmployee(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.employeeModal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Employee Details</Text>
              <TouchableOpacity onPress={() => setSelectedEmployee(null)}>
                <Icon name="close" size={24} color={Colors.text} />
              </TouchableOpacity>
            </View>

            {selectedEmployee && (
              <ScrollView style={styles.modalContent}>
                <View style={styles.employeeProfile}>
                  <View style={styles.profileAvatar}>
                    <Icon name="account-circle" size={80} color={Colors.primary} />
                  </View>
                  <Text style={styles.profileName}>{selectedEmployee.name}</Text>
                  <View
                    style={[
                      styles.profileRole,
                      { backgroundColor: `${getRoleColor(selectedEmployee.role)}20` },
                    ]}
                  >
                    <Text
                      style={[
                        styles.profileRoleText,
                        { color: getRoleColor(selectedEmployee.role) },
                      ]}
                    >
                      {selectedEmployee.role}
                    </Text>
                  </View>
                </View>

                <View style={styles.detailsSection}>
                  <Text style={styles.sectionTitle}>Contact Information</Text>
                  <View style={styles.detailRow}>
                    <Icon name="email" size={20} color={Colors.darkGray} />
                    <Text style={styles.detailText}>{selectedEmployee.email}</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Icon name="phone" size={20} color={Colors.darkGray} />
                    <Text style={styles.detailText}>{selectedEmployee.phone}</Text>
                  </View>
                </View>

                <View style={styles.detailsSection}>
                  <Text style={styles.sectionTitle}>Employment Details</Text>
                  <View style={styles.detailRow}>
                    <Icon name="calendar-today" size={20} color={Colors.darkGray} />
                    <Text style={styles.detailText}>
                      Hired {selectedEmployee.hireDate.toLocaleDateString('en-GB')}
                    </Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Icon name="attach-money" size={20} color={Colors.darkGray} />
                    <Text style={styles.detailText}>
                      £{selectedEmployee.hourlyRate.toFixed(2)} per hour
                    </Text>
                  </View>
                </View>

                <View style={styles.detailsSection}>
                  <Text style={styles.sectionTitle}>Performance Metrics</Text>
                  <View style={styles.performanceGrid}>
                    <View style={styles.performanceCard}>
                      <Text style={styles.performanceValue}>
                        £{selectedEmployee.totalSales.toFixed(0)}
                      </Text>
                      <Text style={styles.performanceLabel}>Total Sales</Text>
                    </View>
                    <View style={styles.performanceCard}>
                      <Text style={styles.performanceValue}>
                        £{selectedEmployee.averageSalesPerDay.toFixed(0)}
                      </Text>
                      <Text style={styles.performanceLabel}>Daily Avg</Text>
                    </View>
                    <View style={styles.performanceCard}>
                      <Text
                        style={[
                          styles.performanceValue,
                          { color: getPerformanceColor(selectedEmployee.performanceScore) },
                        ]}
                      >
                        {selectedEmployee.performanceScore.toFixed(1)}%
                      </Text>
                      <Text style={styles.performanceLabel}>Performance</Text>
                    </View>
                    <View style={styles.performanceCard}>
                      <Text
                        style={[
                          styles.performanceValue,
                          { color: getPerformanceColor(selectedEmployee.punctualityScore) },
                        ]}
                      >
                        {selectedEmployee.punctualityScore.toFixed(1)}%
                      </Text>
                      <Text style={styles.performanceLabel}>Punctuality</Text>
                    </View>
                  </View>
                </View>

                <View style={styles.actionButtons}>
                  <TouchableOpacity style={[styles.actionButton, styles.editButton]}>
                    <Icon name="edit" size={20} color={Colors.white} />
                    <Text style={styles.actionButtonText}>Edit</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.actionButton, styles.scheduleButton]}>
                    <Icon name="schedule" size={20} color={Colors.white} />
                    <Text style={styles.actionButtonText}>Schedule</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionButton, styles.deleteButton]}
                    onPress={() => handleDeleteEmployee(selectedEmployee)}
                  >
                    <Icon name="delete" size={20} color={Colors.white} />
                    <Text style={styles.actionButtonText}>Delete</Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* Add Employee Modal */}
      <Modal
        visible={showAddModal}
        animationType="slide"
        transparent={true}
        onRequestClose={handleCancelAdd}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.addEmployeeModal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add New Employee</Text>
              <TouchableOpacity onPress={handleCancelAdd}>
                <Icon name="close" size={24} color={Colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.addEmployeeForm}>
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Full Name *</Text>
                <TextInput
                  style={styles.formInput}
                  placeholder="Enter employee's full name"
                  value={newEmployee.name}
                  onChangeText={(text) => setNewEmployee({ ...newEmployee, name: text })}
                  placeholderTextColor={Colors.darkGray}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Email Address *</Text>
                <TextInput
                  style={styles.formInput}
                  placeholder="employee@restaurant.com"
                  value={newEmployee.email}
                  onChangeText={(text) => setNewEmployee({ ...newEmployee, email: text })}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  placeholderTextColor={Colors.darkGray}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Phone Number</Text>
                <TextInput
                  style={styles.formInput}
                  placeholder="+44 7700 900123"
                  value={newEmployee.phone}
                  onChangeText={(text) => setNewEmployee({ ...newEmployee, phone: text })}
                  keyboardType="phone-pad"
                  placeholderTextColor={Colors.darkGray}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Role</Text>
                <View style={styles.roleSelector}>
                  {['Manager', 'Cashier', 'Server', 'Cook'].map((role) => (
                    <TouchableOpacity
                      key={role}
                      style={[
                        styles.roleOption,
                        newEmployee.role === role && styles.roleOptionSelected,
                      ]}
                      onPress={() => setNewEmployee({ ...newEmployee, role })}
                    >
                      <Text
                        style={[
                          styles.roleOptionText,
                          newEmployee.role === role && styles.roleOptionTextSelected,
                        ]}
                      >
                        {role}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Hourly Rate (£)</Text>
                <TextInput
                  style={styles.formInput}
                  placeholder="12.00"
                  value={newEmployee.hourlyRate}
                  onChangeText={(text) => {
                    // Only allow numbers and decimal point
                    const cleanText = text.replace(/[^0-9.]/g, '');
                    setNewEmployee({ ...newEmployee, hourlyRate: cleanText });
                  }}
                  keyboardType="decimal-pad"
                  placeholderTextColor={Colors.darkGray}
                />
              </View>

              <View style={styles.formActions}>
                <TouchableOpacity
                  style={[styles.formButton, styles.cancelButton]}
                  onPress={handleCancelAdd}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.formButton, styles.addButton]}
                  onPress={handleAddEmployee}
                >
                  <Icon name="person-add" size={20} color={Colors.white} />
                  <Text style={styles.addButtonText}>Add Employee</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
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
    padding: 12,
    marginRight: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.white,
  },
  headerSubtitle: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  scheduleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12, // Increased padding
    paddingVertical: 8, // Increased padding
    minHeight: 44, // Ensure min tap target height
    minWidth: 44, // Ensure min tap target width
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 8, // Slightly larger radius
  },
  scheduleLabel: {
    marginLeft: 6,
    color: Colors.white, // Assuming theme.colors.action is white, adjust if needed
    // ...theme.typography.button, // This needs to be translated to React Native styles
    fontSize: 14, // Example, adjust as per theme.typography.button
    fontWeight: '600', // Example, adjust as per theme.typography.button
  },
  scheduleButtonText: {
    color: Colors.white,
    fontSize: 14,
    fontWeight: '600', // Semibold
    marginLeft: 8, // Space between icon and text
    numberOfLines: 1, // Ensure text ellipsizes if too long
  },
  addButton: {
    padding: 8,
  },
  statsBar: {
    flexDirection: 'row',
    backgroundColor: Colors.white,
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: 12,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.primary,
  },
  statLabel: {
    fontSize: 12,
    color: Colors.darkGray,
    marginTop: 4,
  },
  searchSection: {
    backgroundColor: Colors.white,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginHorizontal: 16,
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: Colors.text,
    marginLeft: 12,
  },
  roleFilters: {
    paddingHorizontal: 16,
  },
  roleFilter: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 8,
    borderRadius: 20,
    backgroundColor: Colors.background,
  },
  roleFilterActive: {
    backgroundColor: Colors.primary,
  },
  roleFilterText: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.text,
  },
  roleFilterTextActive: {
    color: Colors.white,
  },
  employeesList: {
    padding: 16,
  },
  employeeCard: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  employeeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  employeeAvatar: {
    marginRight: 12,
  },
  employeeInfo: {
    flex: 1,
  },
  employeeName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 4,
  },
  roleBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    marginBottom: 4,
  },
  roleText: {
    fontSize: 12,
    fontWeight: '600',
  },
  employeeEmail: {
    fontSize: 12,
    color: Colors.darkGray,
  },
  employeeStats: {
    alignItems: 'flex-end',
  },
  statItem: {
    alignItems: 'center',
  },
  employeeMetrics: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  metricItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metricText: {
    fontSize: 12,
    color: Colors.darkGray,
    marginLeft: 4,
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
    color: Colors.text,
    marginTop: 16,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: Colors.darkGray,
    marginTop: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  employeeModal: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    width: '90%',
    maxHeight: '80%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: Colors.text,
  },
  modalContent: {
    padding: 20,
  },
  employeeProfile: {
    alignItems: 'center',
    marginBottom: 24,
  },
  profileAvatar: {
    marginBottom: 12,
  },
  profileName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 8,
  },
  profileRole: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  profileRoleText: {
    fontSize: 14,
    fontWeight: '600',
  },
  detailsSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  detailText: {
    fontSize: 14,
    color: Colors.text,
    marginLeft: 12,
  },
  performanceGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  performanceCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: Colors.background,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  performanceValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.primary,
  },
  performanceLabel: {
    fontSize: 12,
    color: Colors.darkGray,
    marginTop: 4,
    textAlign: 'center',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
  },
  editButton: {
    backgroundColor: Colors.secondary,
  },
  scheduleButton: {
    backgroundColor: Colors.warning,
  },
  deleteButton: {
    backgroundColor: Colors.danger,
  },
  actionButtonText: {
    color: Colors.white,
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
  // Add Employee Modal Styles
  addEmployeeModal: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    width: '90%',
    maxHeight: '85%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 10,
  },
  addEmployeeForm: {
    padding: 20,
  },
  formGroup: {
    marginBottom: 20,
  },
  formLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 8,
  },
  formInput: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: Colors.text,
    backgroundColor: Colors.white,
  },
  roleSelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  roleOption: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.background,
  },
  roleOptionSelected: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  roleOptionText: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.text,
  },
  roleOptionTextSelected: {
    color: Colors.white,
  },
  formActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
    paddingBottom: 20,
  },
  formButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 8,
  },
  cancelButton: {
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  addButton: {
    backgroundColor: Colors.primary,
  },
  cancelButtonText: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: '600',
  },
  addButtonText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  centered: {
    // Added
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    // Added
    marginTop: 10,
    fontSize: 16,
    color: Colors.darkGray,
  },
  retryButton: {
    // Added
    marginTop: 20,
    backgroundColor: Colors.primary,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  retryButtonText: {
    // Added
    color: Colors.white,
    fontSize: 16,
    fontWeight: '600',
  },
});

export default EmployeesScreen;
