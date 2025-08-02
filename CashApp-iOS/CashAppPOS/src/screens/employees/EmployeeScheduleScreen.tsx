import React, { useState, useEffect } from 'react';

import {
  StyleSheet,
  Text,
  View,
  SafeAreaView,
  StatusBar,
  ScrollView,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
  Dimensions,
  ActivityIndicator,
} from 'react-native';

import { useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialIcons';

// import { generateEmployees, EmployeeData } from '../../utils/mockDataGenerator'; // Removed
import DataService from '../../services/DataService'; // Added

import type { EmployeeData } from '../../types'; // Updated import path

// Get screen dimensions for responsive design
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
  darkGray: '#34495E',
  text: '#2C3E50',
  lightText: '#95A5A6',
  border: '#DDDDDD',
};

interface Shift {
  id: string;
  employeeId: string;
  employeeName: string;
  date: string;
  startTime: string;
  endTime: string;
  role: string;
  status: 'scheduled' | 'confirmed' | 'completed' | 'absent';
  duration: number; // in hours
  notes?: string;
}

interface WeekSchedule {
  weekStart: Date;
  shifts: Shift[];
}

const EmployeeScheduleScreen: React.FC = () => {
  const navigation = useNavigation();
  const [employees, setEmployees] = useState<EmployeeData[]>([]);
  const [currentWeek, setCurrentWeek] = useState(new Date());
  const [weekSchedule, setWeekSchedule] = useState<WeekSchedule | null>(null);
  const [showAddShiftModal, setShowAddShiftModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string>('');
  // const [selectedEmployee, setSelectedEmployee] = useState<EmployeeData | null>(null); // Likely managed by newShift.employeeId
  const [_viewMode, _setViewMode] = useState<'week' | 'month'>('week');
  const [isLoadingEmployees, setIsLoadingEmployees] = useState<boolean>(true);
  const [isLoadingSchedule, setIsLoadingSchedule] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Add Shift Form State
  const [newShift, setNewShift] = useState({
    employeeId: '',
    date: '',
    startTime: '09:00',
    endTime: '17:00',
    role: 'Cashier',
    notes: '',
  });

  useEffect(() => {
    loadData();
  }, [currentWeek]);

  const loadData = async () => {
    setIsLoadingEmployees(true);
    setIsLoadingSchedule(true);
    setError(null);
    const dataService = DataService.getInstance();

    try {
      // Fetch employees first
      const employeeData = await dataService.getEmployees(); // Assuming this method will be added
      setEmployees(employeeData || []);
      setIsLoadingEmployees(false);

      // Then fetch schedule (which might depend on employees or be standalone)
      const weekStart = getWeekStart(currentWeek);
      // Assuming getWeekSchedule takes weekStart and possibly employee list or fetches all
      const scheduleData = await dataService.getWeekSchedule(weekStart, employeeData || []);
      setWeekSchedule(scheduleData || { weekStart, shifts: [] });
    } catch (e: unknown) {
      setError(e.message || 'Failed to load schedule data.');
      setEmployees([]);
      setWeekSchedule({ weekStart: getWeekStart(currentWeek), shifts: [] });
    } finally {
      setIsLoadingEmployees(false);
      setIsLoadingSchedule(false);
    }
  };

  // const loadEmployees = () => { // Replaced by loadData
  //   const employeeData = generateEmployees();
  //   setEmployees(employeeData);
  // };

  // const loadWeekSchedule = () => { // Replaced by loadData
  //   // Generate mock schedule data
  //   const weekStart = getWeekStart(currentWeek);
  //   const shifts = generateMockShifts(weekStart);
  //   setWeekSchedule({ weekStart, shifts });
  // };

  const getWeekStart = (date: Date): Date => {
    const weekStart = new Date(date);
    const day = weekStart.getDay();
    const diff = weekStart.getDate() - day + (day === 0 ? -6 : 1); // Monday start
    weekStart.setDate(diff);
    weekStart.setHours(0, 0, 0, 0);
    return weekStart;
  };

  // const generateMockShifts = (weekStart: Date): Shift[] => { // Removed
  //   const shifts: Shift[] = [];
  //   const employeeIds = employees.map(emp => emp.id);

  //   // Generate shifts for each day of the week
  //   for (let day = 0; day < 7; day++) {
  //     const currentDate = new Date(weekStart);
  //     currentDate.setDate(weekStart.getDate() + day);
  //     const dateStr = currentDate.toISOString().split('T')[0];

  //     // Add morning shifts
  //     if (day < 6) { // Monday to Saturday
  //       shifts.push({
  //         id: `morning-${day}-1`,
  //         employeeId: employeeIds[0] || 'emp1',
  //         employeeName: employees[0]?.name || 'Maria Rodriguez',
  //         date: dateStr,
  //         startTime: '08:00',
  //         endTime: '16:00',
  //         role: 'Manager',
  //         status: day < 2 ? 'completed' : 'scheduled',
  //         duration: 8,
  //         notes: 'Opening shift'
  //       });

  //       shifts.push({
  //         id: `morning-${day}-2`,
  //         employeeId: employeeIds[1] || 'emp2',
  //         employeeName: employees[1]?.name || 'Carlos Martinez',
  //         date: dateStr,
  //         startTime: '09:00',
  //         endTime: '17:00',
  //         role: 'Cashier',
  //         status: day < 2 ? 'completed' : 'confirmed',
  //         duration: 8,
  //       });

  //       // Evening shifts
  //       shifts.push({
  //         id: `evening-${day}-1`,
  //         employeeId: employeeIds[2] || 'emp3',
  //         employeeName: employees[2]?.name || 'Sofia Hernandez',
  //         date: dateStr,
  //         startTime: '14:00',
  //         endTime: '22:00',
  //         role: 'Server',
  //         status: day < 2 ? 'completed' : 'scheduled',
  //         duration: 8,
  //         notes: 'Closing shift'
  //       });
  //     } else if (day === 6) { // Sunday - reduced hours
  //       shifts.push({
  //         id: `sunday-${day}-1`,
  //         employeeId: employeeIds[0] || 'emp1',
  //         employeeName: employees[0]?.name || 'Maria Rodriguez',
  //         date: dateStr,
  //         startTime: '10:00',
  //         endTime: '18:00',
  //         role: 'Manager',
  //         status: 'scheduled',
  //         duration: 8,
  //         notes: 'Sunday shift'
  //       });
  //     }
  //   }

  //   return shifts;
  // };

  const getWeekDays = (): string[] => {
    if (!weekSchedule) return [];

    const days = [];
    for (let i = 0; i < 7; i++) {
      const day = new Date(weekSchedule.weekStart);
      day.setDate(weekSchedule.weekStart.getDate() + i);
      days.push(day.toISOString().split('T')[0]);
    }
    return days;
  };

  const getDayName = (dateStr: string): string => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { weekday: 'short' });
  };

  const getDayNumber = (dateStr: string): string => {
    const date = new Date(dateStr);
    return date.getDate().toString();
  };

  const getShiftsForDay = (dateStr: string): Shift[] => {
    if (!weekSchedule) return [];
    return weekSchedule.shifts.filter((shift) => shift.date === dateStr);
  };

  const navigateWeek = (direction: 'prev' | 'next') => {
    const newWeek = new Date(currentWeek);
    newWeek.setDate(currentWeek.getDate() + (direction === 'next' ? 7 : -7));
    setCurrentWeek(newWeek);
  };

  const formatWeekRange = (): string => {
    if (!weekSchedule) return '';

    const weekEnd = new Date(weekSchedule.weekStart);
    weekEnd.setDate(weekSchedule.weekStart.getDate() + 6);

    const start = weekSchedule.weekStart.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
    const end = weekEnd.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });

    return `${start} - ${end}`;
  };

  const handleAddShift = (date: string) => {
    setSelectedDate(date);
    setNewShift({ ...newShift, date });
    setShowAddShiftModal(true);
  };

  const saveShift = () => {
    if (!newShift.employeeId || !newShift.date || !newShift.startTime || !newShift.endTime) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    const employee = employees.find((emp) => emp.id === newShift.employeeId);
    if (!employee) return;

    const startTime = new Date(`2000-01-01T${newShift.startTime}:00`);
    const endTime = new Date(`2000-01-01T${newShift.endTime}:00`);
    const duration = (endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60);

    const shift: Shift = {
      id: `shift-${Date.now()}`,
      employeeId: employee.id,
      employeeName: employee.name,
      date: newShift.date,
      startTime: newShift.startTime,
      endTime: newShift.endTime,
      role: newShift.role,
      status: 'scheduled',
      duration,
      notes: newShift.notes,
    };

    if (weekSchedule) {
      setWeekSchedule({
        ...weekSchedule,
        shifts: [...weekSchedule.shifts, shift],
      });
    }

    setShowAddShiftModal(false);
    setNewShift({
      employeeId: '',
      date: '',
      startTime: '09:00',
      endTime: '17:00',
      role: 'Cashier',
      notes: '',
    });

    Alert.alert('Success', 'Shift added successfully');
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return Colors.success;
      case 'confirmed':
        return Colors.primary;
      case 'scheduled':
        return Colors.warning;
      case 'absent':
        return Colors.danger;
      default:
        return Colors.mediumGray;
    }
  };

  const _getStatusText = (status: string) => {
    switch (status) {
      case 'completed':
        return 'Completed';
      case 'confirmed':
        return 'Confirmed';
      case 'scheduled':
        return 'Scheduled';
      case 'absent':
        return 'Absent';
      default:
        return status;
    }
  };

  const getTotalHours = (): number => {
    if (!weekSchedule) return 0;
    return weekSchedule.shifts.reduce((total, shift) => total + shift.duration, 0);
  };

  const getEmployeeHours = (employeeId: string): number => {
    if (!weekSchedule) return 0;
    return weekSchedule.shifts
      .filter((shift) => shift.employeeId === employeeId)
      .reduce((total, shift) => total + shift.duration, 0);
  };

  if (isLoadingEmployees || isLoadingSchedule) {
    return (
      <SafeAreaView style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>
          {isLoadingEmployees ? 'Loading Employees...' : 'Loading Schedule...'}
        </Text>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={[styles.container, styles.centered]}>
        <Icon name="error-outline" size={64} color={Colors.danger} />
        <Text style={styles.errorTextHeader}>Error Loading Data</Text>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity onPress={loadData} style={styles.retryButton}>
          <Text style={styles.retryButtonText}>Try Again</Text>
        </TouchableOpacity>
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
        <Text style={styles.headerTitle}>Employee Schedule</Text>
        <TouchableOpacity style={styles.headerAction}>
          <Icon name="today" size={24} color={Colors.white} />
        </TouchableOpacity>
      </View>

      {/* Week Navigation */}
      <View style={styles.weekNavigation}>
        <TouchableOpacity style={styles.navButton} onPress={() => navigateWeek('prev')}>
          <Icon name="chevron-left" size={24} color={Colors.primary} />
        </TouchableOpacity>

        <View style={styles.weekInfo}>
          <Text style={styles.weekRange}>{formatWeekRange()}</Text>
          <Text style={styles.weekStats}>{getTotalHours()} total hours</Text>
        </View>

        <TouchableOpacity style={styles.navButton} onPress={() => navigateWeek('next')}>
          <Icon name="chevron-right" size={24} color={Colors.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        {/* Week Grid */}
        <View style={styles.weekGrid}>
          {getWeekDays().map((date, _index) => {
            const dayShifts = getShiftsForDay(date);
            const isToday = date === new Date().toISOString().split('T')[0];

            return (
              <View key={date} style={styles.dayColumn}>
                <View style={[styles.dayHeader, isToday && styles.todayHeader]}>
                  <Text style={[styles.dayName, isToday && styles.todayText]}>
                    {getDayName(date)}
                  </Text>
                  <Text style={[styles.dayNumber, isToday && styles.todayText]}>
                    {getDayNumber(date)}
                  </Text>
                </View>

                <View style={styles.dayContent}>
                  {dayShifts.length === 0 ? (
                    <TouchableOpacity style={styles.emptyDay} onPress={() => handleAddShift(date)}>
                      <Icon name="add" size={20} color={Colors.lightText} />
                      <Text style={styles.emptyDayText}>Add Shift</Text>
                    </TouchableOpacity>
                  ) : (
                    dayShifts.map((shift) => (
                      <TouchableOpacity key={shift.id} style={styles.shiftCard}>
                        <View
                          style={[
                            styles.shiftStatus,
                            { backgroundColor: getStatusColor(shift.status) },
                          ]}
                        />
                        <View style={styles.shiftInfo}>
                          <Text style={styles.shiftEmployee}>{shift.employeeName}</Text>
                          <Text style={styles.shiftTime}>
                            {shift.startTime} - {shift.endTime}
                          </Text>
                          <Text style={styles.shiftRole}>{shift.role}</Text>
                          {shift.notes && <Text style={styles.shiftNotes}>{shift.notes}</Text>}
                        </View>
                      </TouchableOpacity>
                    ))
                  )}

                  {dayShifts.length > 0 && (
                    <TouchableOpacity
                      style={styles.addShiftButton}
                      onPress={() => handleAddShift(date)}
                    >
                      <Icon name="add" size={16} color={Colors.primary} />
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            );
          })}
        </View>

        {/* Employee Summary */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Employee Hours Summary</Text>
          <View style={styles.summaryContainer}>
            {employees.slice(0, 5).map((employee) => {
              const hours = getEmployeeHours(employee.id);
              return (
                <View key={employee.id} style={styles.employeeSummary}>
                  <View style={styles.employeeInfo}>
                    <Text style={styles.employeeName}>{employee.name}</Text>
                    <Text style={styles.employeeRole}>{employee.role}</Text>
                  </View>
                  <View style={styles.hoursInfo}>
                    <Text style={styles.hoursText}>{hours}h</Text>
                    <Text style={styles.hoursLabel}>this week</Text>
                  </View>
                </View>
              );
            })}
          </View>
        </View>

        {/* Quick Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.actionButtons}>
            <TouchableOpacity style={styles.actionButton}>
              <Icon name="content-copy" size={24} color={Colors.primary} />
              <Text style={styles.actionButtonText}>Copy Last Week</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionButton}>
              <Icon name="publish" size={24} color={Colors.success} />
              <Text style={styles.actionButtonText}>Publish Schedule</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionButton}>
              <Icon name="share" size={24} color={Colors.secondary} />
              <Text style={styles.actionButtonText}>Share Schedule</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.spacer} />
      </ScrollView>

      {/* Add Shift Modal */}
      <Modal
        visible={showAddShiftModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowAddShiftModal(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity
              style={styles.modalBackButton}
              onPress={() => setShowAddShiftModal(false)}
            >
              <Icon name="close" size={24} color={Colors.text} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Add New Shift</Text>
            <TouchableOpacity style={styles.modalSaveButton} onPress={saveShift}>
              <Text style={styles.modalSaveText}>Save</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            <View style={styles.formSection}>
              <Text style={styles.formLabel}>Employee</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.employeeSelection}
              >
                {employees.map((employee) => (
                  <TouchableOpacity
                    key={employee.id}
                    style={[
                      styles.employeeCard,
                      newShift.employeeId === employee.id && styles.selectedEmployeeCard,
                    ]}
                    onPress={() => setNewShift({ ...newShift, employeeId: employee.id })}
                  >
                    <Text
                      style={[
                        styles.employeeCardName,
                        newShift.employeeId === employee.id && styles.selectedEmployeeCardText,
                      ]}
                    >
                      {employee.name}
                    </Text>
                    <Text
                      style={[
                        styles.employeeCardRole,
                        newShift.employeeId === employee.id && styles.selectedEmployeeCardText,
                      ]}
                    >
                      {employee.role}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            <View style={styles.formSection}>
              <Text style={styles.formLabel}>Date</Text>
              <Text style={styles.selectedDate}>
                {selectedDate
                  ? new Date(selectedDate).toLocaleDateString('en-US', {
                      weekday: 'long',
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })
                  : 'No date selected'}
              </Text>
            </View>

            <View style={styles.timeRow}>
              <View style={styles.timeSection}>
                <Text style={styles.formLabel}>Start Time</Text>
                <TextInput
                  style={styles.timeInput}
                  value={newShift.startTime}
                  onChangeText={(text) => setNewShift({ ...newShift, startTime: text })}
                  placeholder="09:00"
                  keyboardType="numeric"
                />
              </View>

              <View style={styles.timeSection}>
                <Text style={styles.formLabel}>End Time</Text>
                <TextInput
                  style={styles.timeInput}
                  value={newShift.endTime}
                  onChangeText={(text) => setNewShift({ ...newShift, endTime: text })}
                  placeholder="17:00"
                  keyboardType="numeric"
                />
              </View>
            </View>

            <View style={styles.formSection}>
              <Text style={styles.formLabel}>Role</Text>
              <View style={styles.roleSelection}>
                {['Manager', 'Cashier', 'Server', 'Kitchen', 'Cleaner'].map((role) => (
                  <TouchableOpacity
                    key={role}
                    style={[styles.roleButton, newShift.role === role && styles.selectedRoleButton]}
                    onPress={() => setNewShift({ ...newShift, role })}
                  >
                    <Text
                      style={[
                        styles.roleButtonText,
                        newShift.role === role && styles.selectedRoleButtonText,
                      ]}
                    >
                      {role}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.formSection}>
              <Text style={styles.formLabel}>Notes (Optional)</Text>
              <TextInput
                style={styles.notesInput}
                value={newShift.notes}
                onChangeText={(text) => setNewShift({ ...newShift, notes: text })}
                placeholder="Add any notes for this shift..."
                multiline
                numberOfLines={3}
              />
            </View>
          </ScrollView>
        </SafeAreaView>
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
  weekNavigation: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  navButton: {
    padding: 8,
  },
  weekInfo: {
    flex: 1,
    alignItems: 'center',
  },
  weekRange: {
    fontSize: getFontSize(18),
    fontWeight: 'bold',
    color: Colors.text,
  },
  weekStats: {
    fontSize: getFontSize(14),
    color: Colors.lightText,
    marginTop: 2,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  weekGrid: {
    flexDirection: 'row',
    backgroundColor: Colors.white,
    borderRadius: 12,
    marginBottom: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  dayColumn: {
    flex: 1,
    borderRightWidth: 1,
    borderRightColor: Colors.border,
  },
  dayHeader: {
    padding: 8,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  todayHeader: {
    backgroundColor: Colors.primary,
  },
  dayName: {
    fontSize: getFontSize(12),
    fontWeight: '600',
    color: Colors.text,
  },
  dayNumber: {
    fontSize: getFontSize(16),
    fontWeight: 'bold',
    color: Colors.text,
    marginTop: 2,
  },
  todayText: {
    color: Colors.white,
  },
  dayContent: {
    padding: 4,
    minHeight: 200,
  },
  emptyDay: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
  },
  emptyDayText: {
    fontSize: getFontSize(12),
    color: Colors.lightText,
    marginTop: 4,
  },
  shiftCard: {
    backgroundColor: Colors.lightGray,
    borderRadius: 6,
    marginBottom: 4,
    padding: 8,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  shiftStatus: {
    width: 3,
    height: '100%',
    borderRadius: 2,
    marginRight: 8,
  },
  shiftInfo: {
    flex: 1,
  },
  shiftEmployee: {
    fontSize: getFontSize(12),
    fontWeight: '600',
    color: Colors.text,
  },
  shiftTime: {
    fontSize: getFontSize(10),
    color: Colors.lightText,
    marginTop: 2,
  },
  shiftRole: {
    fontSize: getFontSize(10),
    color: Colors.primary,
    marginTop: 1,
  },
  shiftNotes: {
    fontSize: getFontSize(9),
    color: Colors.lightText,
    marginTop: 2,
    fontStyle: 'italic',
  },
  addShiftButton: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
    borderWidth: 1,
    borderColor: Colors.primary,
    borderStyle: 'dashed',
    borderRadius: 6,
    marginTop: 4,
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
  summaryContainer: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  employeeSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  employeeInfo: {
    flex: 1,
  },
  employeeName: {
    fontSize: getFontSize(16),
    fontWeight: '600',
    color: Colors.text,
  },
  employeeRole: {
    fontSize: getFontSize(14),
    color: Colors.lightText,
    marginTop: 2,
  },
  hoursInfo: {
    alignItems: 'flex-end',
  },
  hoursText: {
    fontSize: getFontSize(18),
    fontWeight: 'bold',
    color: Colors.primary,
  },
  hoursLabel: {
    fontSize: getFontSize(12),
    color: Colors.lightText,
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  actionButton: {
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 16,
    flex: 1,
    marginHorizontal: 4,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  actionButtonText: {
    fontSize: getFontSize(12),
    color: Colors.text,
    marginTop: 8,
    textAlign: 'center',
    fontWeight: '500',
  },
  spacer: {
    height: 40,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  modalBackButton: {
    padding: 8,
  },
  modalTitle: {
    flex: 1,
    fontSize: getFontSize(18),
    fontWeight: 'bold',
    color: Colors.text,
    textAlign: 'center',
  },
  modalSaveButton: {
    padding: 8,
  },
  modalSaveText: {
    fontSize: getFontSize(16),
    fontWeight: '600',
    color: Colors.primary,
  },
  modalContent: {
    flex: 1,
    padding: 16,
  },
  formSection: {
    marginBottom: 24,
  },
  formLabel: {
    fontSize: getFontSize(16),
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 8,
  },
  employeeSelection: {
    maxHeight: 120,
  },
  employeeCard: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 12,
    marginRight: 12,
    minWidth: 100,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: Colors.border,
  },
  selectedEmployeeCard: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primary,
  },
  employeeCardName: {
    fontSize: getFontSize(14),
    fontWeight: '600',
    color: Colors.text,
    textAlign: 'center',
  },
  employeeCardRole: {
    fontSize: getFontSize(12),
    color: Colors.lightText,
    marginTop: 4,
    textAlign: 'center',
  },
  selectedEmployeeCardText: {
    color: Colors.white,
  },
  selectedDate: {
    fontSize: getFontSize(16),
    color: Colors.text,
    backgroundColor: Colors.white,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 16,
  },
  timeSection: {
    flex: 1,
  },
  timeInput: {
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    padding: 12,
    fontSize: getFontSize(16),
    color: Colors.text,
  },
  roleSelection: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  roleButton: {
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  selectedRoleButton: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  roleButtonText: {
    fontSize: getFontSize(14),
    color: Colors.text,
    fontWeight: '500',
  },
  selectedRoleButtonText: {
    color: Colors.white,
  },
  notesInput: {
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    padding: 12,
    fontSize: getFontSize(16),
    color: Colors.text,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  centered: {
    // Added
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    // Added
    marginTop: 10,
    fontSize: getFontSize(16),
    color: Colors.darkGray,
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
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 8,
  },
  retryButtonText: {
    // Added
    color: Colors.white,
    fontSize: getFontSize(16),
    fontWeight: '600',
  },
});

export default EmployeeScheduleScreen;
