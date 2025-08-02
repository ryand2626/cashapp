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
  Alert,
  Dimensions,
  RefreshControl,
  ActivityIndicator, // Added
} from 'react-native';

import DateTimePicker from '@react-native-community/datetimepicker';
import { useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialIcons';

// import { generateEmployees, EmployeeData } from '../../utils/mockDataGenerator'; // Removed
import Colors from '../../constants/Colors';
import { useTheme } from '../../design-system/ThemeProvider';
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

interface Shift {
  id: string;
  employeeId: string;
  employeeName: string;
  date: string;
  startTime: string;
  endTime: string;
  role: string;
  status: 'scheduled' | 'confirmed' | 'completed' | 'absent' | 'break';
  duration: number; // in hours
  notes?: string;
  laborCost?: number;
  breakTime?: number; // in minutes
}

interface WeekSchedule {
  weekStart: Date;
  shifts: Shift[];
}

type ViewMode = 'week' | 'day' | 'list' | 'month';

const ROLE_COLORS = {
  Manager: '#00A651',
  Cashier: '#0066CC',
  Server: '#F39C12',
  Kitchen: '#E74C3C',
  Cleaner: '#9B59B6',
  default: '#95A5A6',
};

const STATUS_COLORS = {
  scheduled: '#F39C12',
  confirmed: '#0066CC',
  completed: '#27AE60',
  absent: '#E74C3C',
  break: '#9B59B6',
};

const EnhancedEmployeeScheduleScreen: React.FC = () => {
  const navigation = useNavigation();
  const { theme } = useTheme();
  const [employees, setEmployees] = useState<EmployeeData[]>([]);
  const [currentWeek, setCurrentWeek] = useState(new Date());
  const [weekSchedule, setWeekSchedule] = useState<WeekSchedule | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('week');
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [refreshing, setRefreshing] = useState(false);
  const [isLoadingEmployees, setIsLoadingEmployees] = useState<boolean>(true); // Added
  const [isLoadingSchedule, setIsLoadingSchedule] = useState<boolean>(true); // Added
  const [error, setError] = useState<string | null>(null); // Added

  // Enhanced Modal States
  const [showAddShiftModal, setShowAddShiftModal] = useState(false);
  const [showEditShiftModal, setShowEditShiftModal] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [selectedTimeType, setSelectedTimeType] = useState<'start' | 'end'>('start');
  const [selectedEmployee, setSelectedEmployee] = useState<EmployeeData | null>(null);
  const [showOptionsMenu, setShowOptionsMenu] = useState(false);

  // Enhanced Form State
  const [newShift, setNewShift] = useState({
    employeeId: '',
    date: '',
    startTime: new Date(),
    endTime: new Date(),
    role: 'Cashier',
    notes: '',
    breakTime: 30, // default 30 min break
  });

  // Edit Shift State
  const [selectedShift, setSelectedShift] = useState<Shift | null>(null);
  const [editShift, setEditShift] = useState({
    employeeId: '',
    date: '',
    startTime: new Date(),
    endTime: new Date(),
    role: 'Cashier',
    notes: '',
    breakTime: 30,
    status: 'scheduled' as const,
  });

  useEffect(() => {
    loadData();
  }, [currentWeek]);

  const loadData = async () => {
    setIsLoadingEmployees(true);
    setIsLoadingSchedule(true);
    setError(null);
    setRefreshing(true); // Also indicate refreshing state
    const dataService = DataService.getInstance();

    try {
      // Fetch employees first
      const employeeData = await dataService.getEmployees(); // Assuming this method will be added
      setEmployees(employeeData || []);
      setIsLoadingEmployees(false);

      // Then fetch schedule
      const weekStart = getWeekStart(currentWeek);
      const scheduleData = await dataService.getWeekSchedule(weekStart, employeeData || []);

      // Ensure weekStart is properly formatted as a Date object
      if (scheduleData && scheduleData.weekStart) {
        // Convert string date to Date object if needed
        const weekStartDate =
          scheduleData.weekStart instanceof Date
            ? scheduleData.weekStart
            : new Date(scheduleData.weekStart);

        setWeekSchedule({
          weekStart: weekStartDate,
          shifts: scheduleData.shifts || [],
        });
      } else {
        setWeekSchedule({ weekStart, shifts: [] });
      }
    } catch (e: unknown) {
      setError(e.message || 'Failed to load schedule data.');
      setEmployees([]);
      setWeekSchedule({ weekStart: getWeekStart(currentWeek), shifts: [] });
    } finally {
      setIsLoadingEmployees(false);
      setIsLoadingSchedule(false);
      setRefreshing(false);
    }
  };

  // const loadEmployees = () => { // Replaced by loadData
  //   const employeeData = generateEmployees();
  //   setEmployees(employeeData);
  // };

  // const loadWeekSchedule = () => { // Replaced by loadData
  //   const weekStart = getWeekStart(currentWeek);
  //   const shifts = generateEnhancedMockShifts(weekStart);
  //   setWeekSchedule({ weekStart, shifts });
  // };

  const onRefresh = async () => {
    // Modified to call loadData
    loadData();
  };

  const getWeekStart = (date: Date): Date => {
    // Ensure date is valid
    if (!date || !(date instanceof Date) || isNaN(date.getTime())) {
      logger.error('Invalid date passed to getWeekStart:', date);
      return new Date(); // Return current date as fallback
    }

    const weekStart = new Date(date);
    const day = weekStart.getDay();
    const diff = weekStart.getDate() - day + (day === 0 ? -6 : 1); // Monday start
    weekStart.setDate(diff);
    weekStart.setHours(0, 0, 0, 0);
    return weekStart;
  };

  // const generateEnhancedMockShifts = (weekStart: Date): Shift[] => { // Removed
  //   const shifts: Shift[] = [];
  //   const employeeIds = employees.map(emp => emp.id);

  //   // Generate more realistic shifts with breaks, costs, and better coverage
  //   for (let day = 0; day < 7; day++) {
  //     const currentDate = new Date(weekStart);
  //     currentDate.setDate(weekStart.getDate() + day);
  //     const dateStr = currentDate.toISOString().split('T')[0];

  //     if (day < 6) { // Monday to Saturday - Full service
  //       // Morning Manager Shift
  //       shifts.push({
  //         id: `manager-${day}-morning`,
  //         employeeId: employeeIds[0] || 'emp1',
  //         employeeName: employees[0]?.name || 'Maria Rodriguez',
  //         date: dateStr,
  //         startTime: '07:00',
  //         endTime: '15:00',
  //         role: 'Manager',
  //         status: day < 2 ? 'completed' : 'confirmed',
  //         duration: 8,
  //         laborCost: 8 * (employees[0]?.hourlyRate || 15),
  //         breakTime: 30,
  //         notes: 'Opening supervisor'
  //       });

  //       // Morning Cashier
  //       shifts.push({
  //         id: `cashier-${day}-morning`,
  //         employeeId: employeeIds[1] || 'emp2',
  //         employeeName: employees[1]?.name || 'Carlos Martinez',
  //         date: dateStr,
  //         startTime: '08:00',
  //         endTime: '16:00',
  //         role: 'Cashier',
  //         status: day < 2 ? 'completed' : 'scheduled',
  //         duration: 8,
  //         laborCost: 8 * (employees[1]?.hourlyRate || 12),
  //         breakTime: 45,
  //       });

  //       // Lunch Rush Server
  //       shifts.push({
  //         id: `server-${day}-lunch`,
  //         employeeId: employeeIds[2] || 'emp3',
  //         employeeName: employees[2]?.name || 'Sofia Hernandez',
  //         date: dateStr,
  //         startTime: '11:00',
  //         endTime: '15:00',
  //         role: 'Server',
  //         status: day < 2 ? 'completed' : 'confirmed',
  //         duration: 4,
  //         laborCost: 4 * (employees[2]?.hourlyRate || 10),
  //         breakTime: 15,
  //         notes: 'Lunch rush coverage'
  //       });

  //       // Evening Manager
  //       shifts.push({
  //         id: `manager-${day}-evening`,
  //         employeeId: employeeIds[3] || 'emp4',
  //         employeeName: employees[3]?.name || 'Ahmed Hassan',
  //         date: dateStr,
  //         startTime: '15:00',
  //         endTime: '23:00',
  //         role: 'Manager',
  //         status: day < 2 ? 'completed' : 'scheduled',
  //         duration: 8,
  //         laborCost: 8 * (employees[3]?.hourlyRate || 15),
  //         breakTime: 30,
  //         notes: 'Closing supervisor'
  //       });

  //       // Evening Server Team
  //       shifts.push({
  //         id: `server-${day}-evening-1`,
  //         employeeId: employeeIds[4] || 'emp5',
  //         employeeName: employees[4]?.name || 'Lucy Chen',
  //         date: dateStr,
  //         startTime: '16:00',
  //         endTime: '22:00',
  //         role: 'Server',
  //         status: day < 2 ? 'completed' : 'confirmed',
  //         duration: 6,
  //         laborCost: 6 * (employees[4]?.hourlyRate || 10),
  //         breakTime: 30,
  //       });

  //       // Kitchen Staff
  //       shifts.push({
  //         id: `kitchen-${day}-1`,
  //         employeeId: employeeIds[5] || 'emp6',
  //         employeeName: employees[5]?.name || 'Roberto Silva',
  //         date: dateStr,
  //         startTime: '10:00',
  //         endTime: '22:00',
  //         role: 'Kitchen',
  //         status: day < 2 ? 'completed' : 'scheduled',
  //         duration: 12,
  //         laborCost: 12 * (employees[5]?.hourlyRate || 13),
  //         breakTime: 60,
  //         notes: 'Full kitchen coverage'
  //       });

  //     } else { // Sunday - Reduced hours
  //       shifts.push({
  //         id: `sunday-manager-${day}`,
  //         employeeId: employeeIds[0] || 'emp1',
  //         employeeName: employees[0]?.name || 'Maria Rodriguez',
  //         date: dateStr,
  //         startTime: '10:00',
  //         endTime: '18:00',
  //         role: 'Manager',
  //         status: 'scheduled',
  //         duration: 8,
  //         laborCost: 8 * (employees[0]?.hourlyRate || 15),
  //         breakTime: 30,
  //         notes: 'Sunday operations'
  //       });

  //       shifts.push({
  //         id: `sunday-server-${day}`,
  //         employeeId: employeeIds[2] || 'emp3',
  //         employeeName: employees[2]?.name || 'Sofia Hernandez',
  //         date: dateStr,
  //         startTime: '11:00',
  //         endTime: '17:00',
  //         role: 'Server',
  //         status: 'scheduled',
  //         duration: 6,
  //         laborCost: 6 * (employees[2]?.hourlyRate || 10),
  //         breakTime: 30,
  //       });
  //     }
  //   }

  //   return shifts;
  // };

  const getWeekDays = (): string[] => {
    if (!weekSchedule || !weekSchedule.weekStart) return [];

    const days = [];
    // Ensure weekStart is a valid Date object
    const startDate =
      weekSchedule.weekStart instanceof Date
        ? weekSchedule.weekStart
        : new Date(weekSchedule.weekStart);

    if (isNaN(startDate.getTime())) {
      logger.error('Invalid weekStart date:', weekSchedule.weekStart);
      return [];
    }

    for (let i = 0; i < 7; i++) {
      const day = new Date(startDate);
      day.setDate(startDate.getDate() + i);
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
    return weekSchedule.shifts
      .filter((shift) => shift.date === dateStr)
      .sort((a, b) => a.startTime.localeCompare(b.startTime));
  };

  const navigateWeek = (direction: 'prev' | 'next') => {
    const newWeek = new Date(currentWeek);
    newWeek.setDate(currentWeek.getDate() + (direction === 'next' ? 7 : -7));
    setCurrentWeek(newWeek);
  };

  const formatWeekRange = (): string => {
    if (!weekSchedule || !weekSchedule.weekStart) return '';

    // Ensure weekStart is a valid Date object
    const startDate =
      weekSchedule.weekStart instanceof Date
        ? weekSchedule.weekStart
        : new Date(weekSchedule.weekStart);

    if (isNaN(startDate.getTime())) {
      logger.error('Invalid weekStart date in formatWeekRange:', weekSchedule.weekStart);
      return 'Invalid Date';
    }

    const weekEnd = new Date(startDate);
    weekEnd.setDate(startDate.getDate() + 6);

    const start = startDate.toLocaleDateString('en-US', {
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

  const calculateWeekSummary = () => {
    if (!weekSchedule) return { totalHours: 0, totalCost: 0, coverage: 0 };

    const totalHours = weekSchedule.shifts.reduce((sum, shift) => sum + shift.duration, 0);
    const totalCost = weekSchedule.shifts.reduce((sum, shift) => sum + (shift.laborCost || 0), 0);

    // Calculate coverage percentage (simplified)
    const expectedHours = 7 * 14; // 14 hours per day for 7 days
    const coverage = Math.min((totalHours / expectedHours) * 100, 100);

    return { totalHours, totalCost, coverage };
  };

  const handleAddShift = (date: string) => {
    setSelectedDate(date);
    setNewShift({
      ...newShift,
      date,
      startTime: new Date(new Date().setHours(9, 0, 0, 0)),
      endTime: new Date(new Date().setHours(17, 0, 0, 0)),
    });
    setShowAddShiftModal(true);
  };

  const handleShiftPress = (shift: Shift) => {
    setSelectedShift(shift);

    // Parse times for editing
    const [startHour, startMin] = shift.startTime.split(':').map(Number);
    const [endHour, endMin] = shift.endTime.split(':').map(Number);

    const startTime = new Date();
    startTime.setHours(startHour, startMin, 0, 0);

    const endTime = new Date();
    endTime.setHours(endHour, endMin, 0, 0);

    setEditShift({
      employeeId: shift.employeeId,
      date: shift.date,
      startTime,
      endTime,
      role: shift.role,
      notes: shift.notes || '',
      breakTime: shift.breakTime || 30,
      status: shift.status,
    });

    // Find and set the selected employee
    const employee = employees.find((emp) => emp.id === shift.employeeId);
    setSelectedEmployee(employee || null);

    setShowEditShiftModal(true);
  };

  const handleTimePress = (type: 'start' | 'end') => {
    setSelectedTimeType(type);
    setShowTimePicker(true);
  };

  const handleTimeChange = (event: unknown, selectedDate?: Date) => {
    setShowTimePicker(false);
    if (selectedDate) {
      if (selectedTimeType === 'start') {
        setNewShift({ ...newShift, startTime: selectedDate });
      } else {
        setNewShift({ ...newShift, endTime: selectedDate });
      }
    }
  };

  const saveShift = () => {
    if (!newShift.employeeId || !newShift.date) {
      Alert.alert('Error', 'Please select an employee and ensure date is set');
      return;
    }

    const employee = employees.find((emp) => emp.id === newShift.employeeId);
    if (!employee) return;

    // Calculate duration
    const duration = (newShift.endTime.getTime() - newShift.startTime.getTime()) / (1000 * 60 * 60);
    const laborCost = duration * employee.hourlyRate;

    const shift: Shift = {
      id: `shift-${Date.now()}`,
      employeeId: employee.id,
      employeeName: employee.name,
      date: newShift.date,
      startTime: newShift.startTime.toTimeString().slice(0, 5),
      endTime: newShift.endTime.toTimeString().slice(0, 5),
      role: newShift.role,
      status: 'scheduled',
      duration,
      laborCost,
      breakTime: newShift.breakTime,
      notes: newShift.notes,
    };

    if (weekSchedule) {
      setWeekSchedule({
        ...weekSchedule,
        shifts: [...weekSchedule.shifts, shift],
      });
    }

    setShowAddShiftModal(false);
    resetForm();
    Alert.alert('Success', 'Shift added successfully');
  };

  const saveEditShift = () => {
    if (!selectedShift || !editShift.employeeId) {
      Alert.alert('Error', 'Please ensure all fields are filled');
      return;
    }

    const employee = employees.find((emp) => emp.id === editShift.employeeId);
    if (!employee) return;

    // Calculate duration
    const duration =
      (editShift.endTime.getTime() - editShift.startTime.getTime()) / (1000 * 60 * 60);
    const laborCost = duration * employee.hourlyRate;

    const updatedShift: Shift = {
      ...selectedShift,
      employeeId: employee.id,
      employeeName: employee.name,
      startTime: editShift.startTime.toTimeString().slice(0, 5),
      endTime: editShift.endTime.toTimeString().slice(0, 5),
      role: editShift.role,
      status: editShift.status,
      duration,
      laborCost,
      breakTime: editShift.breakTime,
      notes: editShift.notes,
    };

    if (weekSchedule) {
      setWeekSchedule({
        ...weekSchedule,
        shifts: weekSchedule.shifts.map((shift) =>
          shift.id === selectedShift.id ? updatedShift : shift
        ),
      });
    }

    setShowEditShiftModal(false);
    setSelectedShift(null);
    Alert.alert('Success', 'Shift updated successfully');
  };

  const deleteShift = () => {
    if (!selectedShift) return;

    Alert.alert('Delete Shift', 'Are you sure you want to delete this shift?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          if (weekSchedule) {
            setWeekSchedule({
              ...weekSchedule,
              shifts: weekSchedule.shifts.filter((shift) => shift.id !== selectedShift.id),
            });
          }
          setShowEditShiftModal(false);
          setSelectedShift(null);
          Alert.alert('Success', 'Shift deleted successfully');
        },
      },
    ]);
  };

  const resetForm = () => {
    setNewShift({
      employeeId: '',
      date: '',
      startTime: new Date(new Date().setHours(9, 0, 0, 0)),
      endTime: new Date(new Date().setHours(17, 0, 0, 0)),
      role: 'Cashier',
      notes: '',
      breakTime: 30,
    });
    setSelectedEmployee(null);
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'Manager':
        return Colors.primary;
      case 'Cashier':
        return Colors.secondary;
      case 'Server':
        return Colors.warning;
      case 'Kitchen':
        return Colors.danger;
      case 'Cleaner':
        return Colors.mediumGray;
      default:
        return Colors.darkGray;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'scheduled':
        return Colors.warning;
      case 'confirmed':
        return Colors.secondary;
      case 'completed':
        return Colors.success;
      case 'absent':
        return Colors.danger;
      case 'break':
        return Colors.mediumGray;
      default:
        return Colors.warning;
    }
  };

  const renderViewModeSelector = () => (
    <View style={styles.viewModeSelector}>
      {(['week', 'day', 'list'] as ViewMode[]).map((mode) => (
        <TouchableOpacity
          key={mode}
          style={[styles.viewModeButton, viewMode === mode && styles.viewModeButtonActive]}
          onPress={() => setViewMode(mode)}
        >
          <Icon
            name={mode === 'week' ? 'view-week' : mode === 'day' ? 'today' : 'list'}
            size={20}
            color={viewMode === mode ? theme.colors.white : theme.colors.primary}
          />
          <Text style={[styles.viewModeText, viewMode === mode && styles.viewModeTextActive]}>
            {mode.charAt(0).toUpperCase() + mode.slice(1)}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  const renderWeekSummary = () => {
    const summary = calculateWeekSummary();

    return (
      <View style={styles.weekSummary}>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryValue}>{summary.totalHours}h</Text>
          <Text style={styles.summaryLabel}>Total Hours</Text>
        </View>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryValue}>£{summary.totalCost.toFixed(0)}</Text>
          <Text style={styles.summaryLabel}>Labor Cost</Text>
        </View>
        <View style={styles.summaryItem}>
          <Text
            style={[
              styles.summaryValue,
              {
                color:
                  summary.coverage >= 80
                    ? '#27AE60'
                    : summary.coverage >= 60
                    ? '#F39C12'
                    : '#E74C3C',
              },
            ]}
          >
            {summary.coverage.toFixed(0)}%
          </Text>
          <Text style={styles.summaryLabel}>Coverage</Text>
        </View>
      </View>
    );
  };

  const renderDayView = () => {
    const selectedDay = selectedDate || new Date().toISOString().split('T')[0];
    const dayShifts = getShiftsForDay(selectedDay);
    const dayName = new Date(selectedDay).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    // Create hourly timeline
    const hours = Array.from({ length: 24 }, (_, i) => i);

    return (
      <ScrollView style={styles.dayViewContainer}>
        <View style={styles.dayViewHeader}>
          <Text style={styles.dayViewTitle}>{dayName}</Text>
          <TouchableOpacity style={styles.addShiftFab} onPress={() => handleAddShift(selectedDay)}>
            <Icon name="add" size={24} color={theme.colors.white} />
          </TouchableOpacity>
        </View>

        <View style={styles.timelineContainer}>
          {hours.map((hour) => {
            const hourShifts = dayShifts.filter((shift) => {
              const startHour = parseInt(shift.startTime.split(':')[0]);
              const endHour = parseInt(shift.endTime.split(':')[0]);
              return hour >= startHour && hour < endHour;
            });

            return (
              <View key={hour} style={styles.timelineHour}>
                <View style={styles.timelineLabel}>
                  <Text style={styles.timelineLabelText}>
                    {hour.toString().padStart(2, '0')}:00
                  </Text>
                </View>
                <View style={styles.timelineContent}>
                  {hourShifts.map((shift) => (
                    <TouchableOpacity
                      key={shift.id}
                      style={[
                        styles.timelineShift,
                        { backgroundColor: getRoleColor(shift.role) + '20' },
                        { borderLeftColor: getRoleColor(shift.role) },
                      ]}
                      onPress={() => handleShiftPress(shift)}
                    >
                      <Text style={styles.timelineShiftEmployee}>{shift.employeeName}</Text>
                      <Text style={styles.timelineShiftDetails}>
                        {shift.startTime} - {shift.endTime} • {shift.role}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            );
          })}
        </View>
      </ScrollView>
    );
  };

  const renderListView = () => {
    const weekDays = getWeekDays();

    return (
      <ScrollView style={styles.listViewContainer}>
        {weekDays.map((date) => {
          const dayShifts = getShiftsForDay(date);
          const dayName = getDayName(date);
          const dayNumber = getDayNumber(date);
          const isToday = date === new Date().toISOString().split('T')[0];
          const isSelected = date === selectedDate;

          if (dayShifts.length === 0) return null;

          return (
            <View key={date} style={styles.listDaySection}>
              <TouchableOpacity
                style={[styles.listDayHeader, (isSelected || isToday) && styles.listTodayHeader]}
                onPress={() => setSelectedDate(date)}
              >
                <Text style={[styles.listDayName, (isSelected || isToday) && styles.listTodayText]}>
                  {dayName}, {dayNumber}
                </Text>
                <Text
                  style={[styles.listDayCount, (isSelected || isToday) && styles.listTodayText]}
                >
                  {dayShifts.length} shifts
                </Text>
              </TouchableOpacity>

              {dayShifts.map((shift) => (
                <TouchableOpacity
                  key={shift.id}
                  style={styles.listShiftCard}
                  onPress={() => handleShiftPress(shift)}
                >
                  <View style={styles.listShiftLeft}>
                    <Text style={styles.listShiftTime}>
                      {shift.startTime} - {shift.endTime}
                    </Text>
                    <Text style={styles.listShiftDuration}>{shift.duration}h</Text>
                  </View>

                  <View style={styles.listShiftCenter}>
                    <Text style={styles.listShiftEmployee}>{shift.employeeName}</Text>
                    <Text style={[styles.listShiftRole, { color: getRoleColor(shift.role) }]}>
                      {shift.role}
                    </Text>
                  </View>

                  <View style={styles.listShiftRight}>
                    <View
                      style={[
                        styles.listShiftStatus,
                        { backgroundColor: getStatusColor(shift.status) },
                      ]}
                    >
                      <Text style={styles.listShiftStatusText}>{shift.status}</Text>
                    </View>
                    {shift.laborCost && (
                      <Text style={styles.listShiftCost}>£{shift.laborCost.toFixed(0)}</Text>
                    )}
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          );
        })}
      </ScrollView>
    );
  };

  const renderEnhancedWeekView = () => (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.weekViewContainer}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {getWeekDays().map((date, _index) => {
        const dayShifts = getShiftsForDay(date);
        const isToday = date === new Date().toISOString().split('T')[0];
        const isSelected = date === selectedDate;
        const totalDayHours = dayShifts.reduce((sum, shift) => sum + shift.duration, 0);

        return (
          <View key={date} style={styles.enhancedDayColumn}>
            <TouchableOpacity
              style={[styles.enhancedDayHeader, (isSelected || isToday) && styles.todayHeader]}
              onPress={() => setSelectedDate(date)}
            >
              <Text style={[styles.dayName, (isSelected || isToday) && styles.todayText]}>
                {getDayName(date)}
              </Text>
              <Text style={[styles.dayNumber, (isSelected || isToday) && styles.todayText]}>
                {getDayNumber(date)}
              </Text>
              <Text style={[styles.dayHours, (isSelected || isToday) && styles.todayText]}>
                {totalDayHours}h
              </Text>
            </TouchableOpacity>

            <ScrollView style={styles.enhancedDayContent} showsVerticalScrollIndicator={false}>
              {dayShifts.length === 0 ? (
                <TouchableOpacity
                  style={styles.enhancedEmptyDay}
                  onPress={() => handleAddShift(date)}
                >
                  <Icon name="add-circle-outline" size={32} color={theme.colors.secondary} />
                  <Text style={styles.emptyDayText}>Add Shift</Text>
                </TouchableOpacity>
              ) : (
                <>
                  {dayShifts.map((shift) => (
                    <TouchableOpacity
                      key={shift.id}
                      style={[
                        styles.enhancedShiftCard,
                        { borderLeftColor: getRoleColor(shift.role) },
                      ]}
                      onPress={() => handleShiftPress(shift)}
                    >
                      <View style={styles.shiftCardHeader}>
                        <Text style={styles.shiftEmployeeName} numberOfLines={1}>
                          {shift.employeeName}
                        </Text>
                        <View
                          style={[
                            styles.shiftStatusBadge,
                            { backgroundColor: getStatusColor(shift.status) },
                          ]}
                        >
                          <Text style={styles.shiftStatusText}>
                            {shift.status.charAt(0).toUpperCase()}
                          </Text>
                        </View>
                      </View>

                      <Text style={styles.shiftTime}>
                        {shift.startTime} - {shift.endTime}
                      </Text>

                      <View style={styles.shiftCardFooter}>
                        <Text style={[styles.shiftRole, { color: getRoleColor(shift.role) }]}>
                          {shift.role}
                        </Text>
                        <Text style={styles.shiftDuration}>{shift.duration}h</Text>
                      </View>

                      {shift.laborCost && (
                        <Text style={styles.shiftCost}>£{shift.laborCost.toFixed(0)}</Text>
                      )}
                    </TouchableOpacity>
                  ))}

                  <TouchableOpacity
                    style={styles.addMoreShiftButton}
                    onPress={() => handleAddShift(date)}
                  >
                    <Icon name="add" size={16} color={theme.colors.primary} />
                    <Text style={styles.addMoreText}>Add Shift</Text>
                  </TouchableOpacity>
                </>
              )}
            </ScrollView>
          </View>
        );
      })}
    </ScrollView>
  );

  const renderAddShiftModal = () => (
    <Modal
      visible={showAddShiftModal}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={() => setShowAddShiftModal(false)}
    >
      <SafeAreaView style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <TouchableOpacity
            onPress={() => setShowAddShiftModal(false)}
            style={styles.modalCloseButton}
          >
            <Icon name="close" size={24} color={theme.colors.text} />
          </TouchableOpacity>
          <Text style={styles.modalTitle}>Add New Shift</Text>
          <TouchableOpacity onPress={saveShift} style={styles.modalSaveButton}>
            <Text style={styles.modalSaveText}>Save</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.modalContent}>
          {/* Employee Selection */}
          <View style={styles.formSection}>
            <Text style={styles.sectionTitle}>Select Employee</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {employees.map((employee) => (
                <TouchableOpacity
                  key={employee.id}
                  style={[
                    styles.employeeSelectionCard,
                    newShift.employeeId === employee.id && styles.selectedEmployeeCard,
                  ]}
                  onPress={() => {
                    setNewShift({ ...newShift, employeeId: employee.id });
                    setSelectedEmployee(employee);
                  }}
                >
                  <Text
                    style={[
                      styles.employeeCardName,
                      newShift.employeeId === employee.id && styles.selectedEmployeeText,
                    ]}
                  >
                    {employee.name}
                  </Text>
                  <Text
                    style={[
                      styles.employeeCardRole,
                      newShift.employeeId === employee.id && styles.selectedEmployeeText,
                    ]}
                  >
                    {employee.role} • £{employee.hourlyRate}/hr
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* Date Display */}
          <View style={styles.formSection}>
            <Text style={styles.sectionTitle}>Date</Text>
            <View style={styles.dateDisplay}>
              <Text style={styles.dateDisplayText}>
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
          </View>

          {/* Time Selection */}
          <View style={styles.formSection}>
            <Text style={styles.sectionTitle}>Shift Times</Text>
            <View style={styles.timeSelectionRow}>
              <TouchableOpacity
                style={styles.timeSelector}
                onPress={() => handleTimePress('start')}
              >
                <Text style={styles.timeSelectorLabel}>Start Time</Text>
                <Text style={styles.timeSelectorValue}>
                  {newShift.startTime.toLocaleTimeString('en-US', {
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: false,
                  })}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.timeSelector} onPress={() => handleTimePress('end')}>
                <Text style={styles.timeSelectorLabel}>End Time</Text>
                <Text style={styles.timeSelectorValue}>
                  {newShift.endTime.toLocaleTimeString('en-US', {
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: false,
                  })}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Duration and Cost Display */}
            {selectedEmployee && (
              <View style={styles.shiftCalculations}>
                <View style={styles.calculationItem}>
                  <Text style={styles.calculationLabel}>Duration</Text>
                  <Text style={styles.calculationValue}>
                    {(
                      (newShift.endTime.getTime() - newShift.startTime.getTime()) /
                      (1000 * 60 * 60)
                    ).toFixed(1)}
                    h
                  </Text>
                </View>
                <View style={styles.calculationItem}>
                  <Text style={styles.calculationLabel}>Labor Cost</Text>
                  <Text style={styles.calculationValue}>
                    £
                    {(
                      ((newShift.endTime.getTime() - newShift.startTime.getTime()) /
                        (1000 * 60 * 60)) *
                      selectedEmployee.hourlyRate
                    ).toFixed(2)}
                  </Text>
                </View>
              </View>
            )}
          </View>

          {/* Role Selection */}
          <View style={styles.formSection}>
            <Text style={styles.sectionTitle}>Role</Text>
            <View style={styles.roleSelection}>
              {Object.keys(ROLE_COLORS)
                .filter((role) => role !== 'default')
                .map((role) => (
                  <TouchableOpacity
                    key={role}
                    style={[
                      styles.roleButton,
                      { borderColor: getRoleColor(role) },
                      newShift.role === role && { backgroundColor: getRoleColor(role) },
                    ]}
                    onPress={() => setNewShift({ ...newShift, role })}
                  >
                    <Text
                      style={[
                        styles.roleButtonText,
                        { color: newShift.role === role ? theme.colors.white : getRoleColor(role) },
                      ]}
                    >
                      {role}
                    </Text>
                  </TouchableOpacity>
                ))}
            </View>
          </View>
        </ScrollView>

        {/* Time Picker Modal */}
        {showTimePicker && (
          <DateTimePicker
            value={selectedTimeType === 'start' ? newShift.startTime : newShift.endTime}
            mode="time"
            is24Hour={true}
            display="spinner"
            onChange={handleTimeChange}
          />
        )}
      </SafeAreaView>
    </Modal>
  );

  const renderEditShiftModal = () => (
    <Modal
      visible={showEditShiftModal}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={() => setShowEditShiftModal(false)}
    >
      <SafeAreaView style={styles.editModalContainer}>
        <View style={styles.editModalHeader}>
          <TouchableOpacity
            onPress={() => setShowEditShiftModal(false)}
            style={styles.modalCloseButton}
          >
            <Icon name="close" size={24} color={theme.colors.text} />
          </TouchableOpacity>
          <Text style={styles.editModalTitle}>Edit Shift</Text>
          <View style={styles.editModalActions}>
            <TouchableOpacity onPress={deleteShift} style={styles.editModalDeleteButton}>
              <Text style={styles.editModalDeleteText}>Delete</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={saveEditShift} style={styles.editModalSaveButton}>
              <Text style={styles.editModalSaveText}>Save</Text>
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView style={styles.modalContent}>
          {/* Employee Selection */}
          <View style={styles.formSection}>
            <Text style={styles.sectionTitle}>Employee</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {employees.map((employee) => (
                <TouchableOpacity
                  key={employee.id}
                  style={[
                    styles.employeeSelectionCard,
                    editShift.employeeId === employee.id && styles.selectedEmployeeCard,
                  ]}
                  onPress={() => {
                    setEditShift({ ...editShift, employeeId: employee.id });
                    setSelectedEmployee(employee);
                  }}
                >
                  <Text
                    style={[
                      styles.employeeCardName,
                      editShift.employeeId === employee.id && styles.selectedEmployeeText,
                    ]}
                  >
                    {employee.name}
                  </Text>
                  <Text
                    style={[
                      styles.employeeCardRole,
                      editShift.employeeId === employee.id && styles.selectedEmployeeText,
                    ]}
                  >
                    {employee.role} • £{employee.hourlyRate}/hr
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* Time Selection */}
          <View style={styles.formSection}>
            <Text style={styles.sectionTitle}>Shift Times</Text>
            <View style={styles.timeSelectionRow}>
              <TouchableOpacity
                style={styles.timeSelector}
                onPress={() => {
                  setSelectedTimeType('start');
                  setShowTimePicker(true);
                }}
              >
                <Text style={styles.timeSelectorLabel}>Start Time</Text>
                <Text style={styles.timeSelectorValue}>
                  {editShift.startTime.toLocaleTimeString('en-US', {
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: false,
                  })}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.timeSelector}
                onPress={() => {
                  setSelectedTimeType('end');
                  setShowTimePicker(true);
                }}
              >
                <Text style={styles.timeSelectorLabel}>End Time</Text>
                <Text style={styles.timeSelectorValue}>
                  {editShift.endTime.toLocaleTimeString('en-US', {
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: false,
                  })}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Duration and Cost Display */}
            {selectedEmployee && (
              <View style={styles.shiftCalculations}>
                <View style={styles.calculationItem}>
                  <Text style={styles.calculationLabel}>Duration</Text>
                  <Text style={styles.calculationValue}>
                    {(
                      (editShift.endTime.getTime() - editShift.startTime.getTime()) /
                      (1000 * 60 * 60)
                    ).toFixed(1)}
                    h
                  </Text>
                </View>
                <View style={styles.calculationItem}>
                  <Text style={styles.calculationLabel}>Labor Cost</Text>
                  <Text style={styles.calculationValue}>
                    £
                    {(
                      ((editShift.endTime.getTime() - editShift.startTime.getTime()) /
                        (1000 * 60 * 60)) *
                      selectedEmployee.hourlyRate
                    ).toFixed(2)}
                  </Text>
                </View>
              </View>
            )}
          </View>

          {/* Role Selection */}
          <View style={styles.formSection}>
            <Text style={styles.sectionTitle}>Role</Text>
            <View style={styles.roleSelection}>
              {Object.keys(ROLE_COLORS)
                .filter((role) => role !== 'default')
                .map((role) => (
                  <TouchableOpacity
                    key={role}
                    style={[
                      styles.roleButton,
                      { borderColor: getRoleColor(role) },
                      editShift.role === role && { backgroundColor: getRoleColor(role) },
                    ]}
                    onPress={() => setEditShift({ ...editShift, role })}
                  >
                    <Text
                      style={[
                        styles.roleButtonText,
                        { color: editShift.role === role ? Colors.white : getRoleColor(role) },
                      ]}
                    >
                      {role}
                    </Text>
                  </TouchableOpacity>
                ))}
            </View>
          </View>

          {/* Status Selection */}
          <View style={styles.formSection}>
            <Text style={styles.sectionTitle}>Status</Text>
            <View style={styles.roleSelection}>
              {Object.keys(STATUS_COLORS).map((status) => (
                <TouchableOpacity
                  key={status}
                  style={[
                    styles.roleButton,
                    { borderColor: getStatusColor(status) },
                    editShift.status === status && { backgroundColor: getStatusColor(status) },
                  ]}
                  onPress={() => setEditShift({ ...editShift, status: status as unknown })}
                >
                  <Text
                    style={[
                      styles.roleButtonText,
                      {
                        color: editShift.status === status ? Colors.white : getStatusColor(status),
                      },
                    ]}
                  >
                    {status.charAt(0).toUpperCase() + status.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </ScrollView>

        {/* Edit Time Picker Modal */}
        {showTimePicker && (
          <DateTimePicker
            value={selectedTimeType === 'start' ? editShift.startTime : editShift.endTime}
            mode="time"
            is24Hour={true}
            display="spinner"
            onChange={(event, selectedDate) => {
              setShowTimePicker(false);
              if (selectedDate) {
                if (selectedTimeType === 'start') {
                  setEditShift({ ...editShift, startTime: selectedDate });
                } else {
                  setEditShift({ ...editShift, endTime: selectedDate });
                }
              }
            }}
          />
        )}
      </SafeAreaView>
    </Modal>
  );

  const renderOptionsMenu = () => (
    <Modal
      visible={showOptionsMenu}
      transparent={true}
      animationType="fade"
      onRequestClose={() => setShowOptionsMenu(false)}
    >
      <TouchableOpacity style={styles.optionsOverlay} onPress={() => setShowOptionsMenu(false)}>
        <View style={styles.optionsMenu}>
          <TouchableOpacity style={styles.optionItem}>
            <Icon name="content-copy" size={20} color={theme.colors.primary} />
            <Text style={[styles.optionText, { color: theme.colors.text }]}>Copy Week</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.optionItem}>
            <Icon name="publish" size={20} color={theme.colors.success} />
            <Text style={[styles.optionText, { color: theme.colors.text }]}>Publish Schedule</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.optionItem}>
            <Icon name="share" size={20} color={theme.colors.secondary} />
            <Text style={[styles.optionText, { color: theme.colors.text }]}>Share Schedule</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.optionItem}>
            <Icon name="today" size={20} color={theme.colors.warning} />
            <Text style={[styles.optionText, { color: theme.colors.text }]}>Go to Today</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );

  if (isLoadingEmployees || isLoadingSchedule) {
    return (
      <SafeAreaView
        style={[styles.container, styles.centered, { backgroundColor: theme.colors.background }]}
      >
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={[styles.loadingText, { color: theme.colors.text }]}>
          {isLoadingEmployees ? 'Loading Employees...' : 'Loading Schedule...'}
        </Text>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView
        style={[styles.container, styles.centered, { backgroundColor: theme.colors.background }]}
      >
        <Icon name="error-outline" size={64} color={theme.colors.danger} />
        <Text style={[styles.errorTextHeader, { color: theme.colors.danger }]}>
          Error Loading Data
        </Text>
        <Text style={[styles.errorText, { color: theme.colors.text }]}>{error}</Text>
        <TouchableOpacity
          onPress={loadData}
          style={[styles.retryButton, { backgroundColor: theme.colors.primary }]}
        >
          <Text style={[styles.retryButtonText, { color: theme.colors.white }]}>Try Again</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <StatusBar barStyle="light-content" backgroundColor={theme.colors.primary} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Icon name="arrow-back" size={24} color={theme.colors.white} />
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <Text style={[styles.headerTitle, { color: theme.colors.white }]}>Employee Schedule</Text>
          <Text style={[styles.headerSubtitle, { color: theme.colors.white }]}>
            {formatWeekRange()}
          </Text>
        </View>

        <TouchableOpacity style={styles.headerAction} onPress={() => setShowOptionsMenu(true)}>
          <Icon name="more-vert" size={24} color={theme.colors.white} />
        </TouchableOpacity>
      </View>

      {/* View Mode Selector */}
      {renderViewModeSelector()}

      {/* Week Navigation */}
      <View style={[styles.weekNavigation, { backgroundColor: theme.colors.white }]}>
        <TouchableOpacity style={styles.navButton} onPress={() => navigateWeek('prev')}>
          <Icon name="chevron-left" size={28} color={theme.colors.primary} />
        </TouchableOpacity>

        <View style={styles.weekInfo}>{renderWeekSummary()}</View>

        <TouchableOpacity style={styles.navButton} onPress={() => navigateWeek('next')}>
          <Icon name="chevron-right" size={28} color={theme.colors.primary} />
        </TouchableOpacity>
      </View>

      {/* Content Views */}
      {viewMode === 'week' && renderEnhancedWeekView()}
      {viewMode === 'day' && renderDayView()}
      {viewMode === 'list' && renderListView()}

      {/* Add Shift Modal */}
      {renderAddShiftModal()}

      {/* Edit Shift Modal */}
      {renderEditShiftModal()}

      {/* Options Menu Modal */}
      {renderOptionsMenu()}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    backgroundColor: Colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    height: 60,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5,
  },
  backButton: {
    padding: 8,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: getFontSize(20),
    fontWeight: 'bold',
  },
  headerSubtitle: {
    fontSize: getFontSize(12),
    opacity: 0.8,
    marginTop: 2,
  },
  headerAction: {
    padding: 8,
  },

  // View Mode Selector
  viewModeSelector: {
    flexDirection: 'row',
    backgroundColor: Colors.background,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  viewModeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 8,
    borderRadius: 20,
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  viewModeButtonActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  viewModeText: {
    marginLeft: 6,
    fontSize: getFontSize(14),
    fontWeight: '500',
    color: Colors.text,
  },
  viewModeTextActive: {
    color: Colors.white,
  },

  // Week Navigation & Summary
  weekNavigation: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  navButton: {
    padding: 8,
  },
  weekInfo: {
    flex: 1,
  },
  weekSummary: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  summaryItem: {
    alignItems: 'center',
  },
  summaryValue: {
    fontSize: getFontSize(18),
    fontWeight: 'bold',
    color: Colors.text,
  },
  summaryLabel: {
    fontSize: getFontSize(12),
    color: Colors.darkGray,
    marginTop: 2,
  },

  // Enhanced Week View
  weekViewContainer: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  enhancedDayColumn: {
    width: screenWidth * 0.4,
    marginRight: 12,
    backgroundColor: Colors.white,
    borderRadius: 12,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  enhancedDayHeader: {
    padding: 16,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
  },
  todayHeader: {
    backgroundColor: Colors.primary,
  },
  dayName: {
    fontSize: getFontSize(14),
    fontWeight: '600',
    color: Colors.text,
  },
  dayNumber: {
    fontSize: getFontSize(24),
    fontWeight: 'bold',
    color: Colors.text,
    marginTop: 4,
  },
  dayHours: {
    fontSize: getFontSize(12),
    color: Colors.darkGray,
    marginTop: 2,
  },
  todayText: {
    color: Colors.white,
  },
  enhancedDayContent: {
    padding: 8,
    paddingBottom: 16,
    maxHeight: 400,
  },
  enhancedEmptyDay: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  emptyDayText: {
    fontSize: getFontSize(14),
    color: Colors.darkGray,
    marginTop: 8,
  },

  // Enhanced Shift Cards
  enhancedShiftCard: {
    backgroundColor: Colors.background,
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderLeftWidth: 4,
  },
  shiftCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  shiftEmployeeName: {
    fontSize: getFontSize(14),
    fontWeight: '600',
    color: Colors.text,
    flex: 1,
  },
  shiftStatusBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shiftStatusText: {
    fontSize: getFontSize(10),
    fontWeight: 'bold',
    color: Colors.white,
  },
  shiftTime: {
    fontSize: getFontSize(13),
    color: Colors.darkGray,
    marginBottom: 6,
  },
  shiftCardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  shiftRole: {
    fontSize: getFontSize(12),
    fontWeight: '500',
  },
  shiftDuration: {
    fontSize: getFontSize(12),
    color: Colors.darkGray,
  },
  shiftCost: {
    fontSize: getFontSize(11),
    color: Colors.success,
    marginTop: 4,
    textAlign: 'right',
  },
  addMoreShiftButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.primary,
    borderStyle: 'dashed',
    borderRadius: 8,
    marginTop: 8,
  },
  addMoreText: {
    fontSize: getFontSize(12),
    color: Colors.primary,
    marginLeft: 4,
    fontWeight: '500',
  },

  // Modal Styles
  modalContainer: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  modalCloseButton: {
    padding: 8,
  },
  modalTitle: {
    fontSize: getFontSize(18),
    fontWeight: 'bold',
    color: Colors.text,
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

  // Form Sections
  formSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: getFontSize(16),
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 12,
  },

  // Employee Selection
  employeeSelectionCard: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 16,
    marginRight: 12,
    minWidth: 120,
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
    color: Colors.darkGray,
    textAlign: 'center',
    marginTop: 4,
  },
  selectedEmployeeText: {
    color: Colors.white,
  },

  // Date Display
  dateDisplay: {
    backgroundColor: Colors.white,
    borderRadius: 8,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  dateDisplayText: {
    fontSize: getFontSize(16),
    color: Colors.text,
    textAlign: 'center',
  },

  // Time Selection
  timeSelectionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  timeSelector: {
    flex: 1,
    backgroundColor: Colors.white,
    borderRadius: 8,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
  },
  timeSelectorLabel: {
    fontSize: getFontSize(12),
    color: Colors.darkGray,
    marginBottom: 4,
  },
  timeSelectorValue: {
    fontSize: getFontSize(18),
    fontWeight: 'bold',
    color: Colors.text,
  },

  // Calculations
  shiftCalculations: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 12,
    padding: 16,
    backgroundColor: Colors.white,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  calculationItem: {
    alignItems: 'center',
  },
  calculationLabel: {
    fontSize: getFontSize(12),
    color: Colors.darkGray,
  },
  calculationValue: {
    fontSize: getFontSize(16),
    fontWeight: 'bold',
    color: Colors.success,
    marginTop: 4,
  },

  // Role Selection
  roleSelection: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  roleButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 2,
    backgroundColor: Colors.white,
  },
  roleButtonText: {
    fontSize: getFontSize(14),
    fontWeight: '500',
  },

  // Day View Styles
  dayViewContainer: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  dayViewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  dayViewTitle: {
    fontSize: getFontSize(18),
    fontWeight: 'bold',
    color: Colors.text,
  },
  addShiftFab: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
  },
  timelineContainer: {
    padding: 16,
  },
  timelineHour: {
    flexDirection: 'row',
    minHeight: 60,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  timelineLabel: {
    width: 60,
    justifyContent: 'center',
    paddingRight: 16,
  },
  timelineLabelText: {
    fontSize: getFontSize(12),
    color: Colors.darkGray,
    fontWeight: '500',
  },
  timelineContent: {
    flex: 1,
    paddingVertical: 8,
  },
  timelineShift: {
    backgroundColor: Colors.white,
    borderRadius: 8,
    padding: 12,
    marginBottom: 4,
    borderLeftWidth: 4,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  timelineShiftEmployee: {
    fontSize: getFontSize(14),
    fontWeight: '600',
    color: Colors.text,
  },
  timelineShiftDetails: {
    fontSize: getFontSize(12),
    color: Colors.darkGray,
    marginTop: 2,
  },

  // List View Styles
  listViewContainer: {
    flex: 1,
    padding: 16,
    backgroundColor: Colors.background,
  },
  listDaySection: {
    marginBottom: 24,
  },
  listDayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: Colors.white,
    borderRadius: 8,
    marginBottom: 8,
    borderLeftWidth: 4,
    borderLeftColor: Colors.primary,
  },
  listTodayHeader: {
    backgroundColor: Colors.primary,
    borderLeftColor: Colors.white,
  },
  listDayName: {
    fontSize: getFontSize(16),
    fontWeight: 'bold',
    color: Colors.text,
  },
  listTodayText: {
    color: Colors.white,
  },
  listDayCount: {
    fontSize: getFontSize(12),
    color: Colors.darkGray,
  },
  listShiftCard: {
    flexDirection: 'row',
    backgroundColor: Colors.white,
    borderRadius: 8,
    padding: 16,
    marginBottom: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  listShiftLeft: {
    alignItems: 'center',
    marginRight: 16,
    minWidth: 80,
  },
  listShiftTime: {
    fontSize: getFontSize(14),
    fontWeight: '600',
    color: Colors.text,
    textAlign: 'center',
  },
  listShiftDuration: {
    fontSize: getFontSize(12),
    color: Colors.darkGray,
    marginTop: 2,
  },
  listShiftCenter: {
    flex: 1,
    justifyContent: 'center',
  },
  listShiftEmployee: {
    fontSize: getFontSize(16),
    fontWeight: '600',
    color: Colors.text,
  },
  listShiftRole: {
    fontSize: getFontSize(14),
    fontWeight: '500',
    marginTop: 2,
  },
  listShiftRight: {
    alignItems: 'flex-end',
    justifyContent: 'center',
    minWidth: 80,
  },
  listShiftStatus: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  listShiftStatusText: {
    fontSize: getFontSize(12),
    fontWeight: '500',
    color: Colors.white,
    textTransform: 'capitalize',
  },
  listShiftCost: {
    fontSize: getFontSize(12),
    color: Colors.success,
    marginTop: 4,
    fontWeight: '500',
  },

  // Options Menu Styles
  optionsOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
    paddingTop: 60,
    paddingRight: 16,
  },
  optionsMenu: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    paddingVertical: 8,
    minWidth: 180,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  optionText: {
    fontSize: 16,
    fontWeight: '500',
    marginLeft: 12,
  },

  // Edit Shift Modal Styles
  editModalContainer: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  editModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  editModalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text,
  },
  editModalActions: {
    flexDirection: 'row',
  },
  editModalDeleteButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: Colors.danger,
    borderRadius: 8,
    marginRight: 8,
  },
  editModalDeleteText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.white,
  },
  editModalSaveButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: Colors.primary,
    borderRadius: 8,
  },
  editModalSaveText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.white,
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
    // color: Colors.darkGray, // Theme controlled
  },
  errorTextHeader: {
    // Added
    fontSize: getFontSize(18),
    fontWeight: 'bold',
    // color: Colors.danger, // Theme controlled
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  errorText: {
    // Added
    fontSize: getFontSize(14),
    // color: Colors.text, // Theme controlled
    textAlign: 'center',
    marginBottom: 20,
  },
  retryButton: {
    // Added
    // backgroundColor: Colors.primary, // Theme controlled
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 8,
  },
  retryButtonText: {
    // Added
    // color: Colors.white, // Theme controlled
    fontSize: getFontSize(16),
    fontWeight: '600',
  },
});

export default EnhancedEmployeeScheduleScreen;
