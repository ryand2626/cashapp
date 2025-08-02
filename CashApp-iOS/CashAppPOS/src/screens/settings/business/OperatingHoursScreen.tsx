import React, { useState } from 'react';

import { StyleSheet, Text, View, ScrollView, TouchableOpacity, Alert, Modal } from 'react-native';

import Icon from 'react-native-vector-icons/MaterialIcons';

import {
  SettingsHeader,
  SettingsSection,
  SettingsCard,
  ToggleSwitch,
} from '../../../components/settings';
import useSettingsStore from '../../../store/useSettingsStore';

// Clover POS Color Scheme
const Colors = {
  primary: '#00A651',
  secondary: '#0066CC',
  success: '#00A651',
  warning: '#FF6B35',
  danger: '#E74C3C',
  background: '#F5F5F5',
  white: '#FFFFFF',
  lightGray: '#E5E5E5',
  mediumGray: '#999999',
  darkGray: '#666666',
  text: '#333333',
  lightText: '#666666',
  border: '#DDDDDD',
};

interface TimePickerModalProps {
  visible: boolean;
  onClose: () => void;
  onTimeSelect: (time: string) => void;
  currentTime: string;
  title: string;
}

const TimePickerModal: React.FC<TimePickerModalProps> = ({
  visible,
  onClose,
  onTimeSelect,
  currentTime,
  title,
}) => {
  const [selectedHour, setSelectedHour] = useState(
    currentTime ? parseInt(currentTime.split(':')[0]) : 9
  );
  const [selectedMinute, setSelectedMinute] = useState(
    currentTime ? parseInt(currentTime.split(':')[1]) : 0
  );

  const hours = Array.from({ length: 24 }, (_, i) => i);
  const minutes = [0, 15, 30, 45];

  const handleConfirm = () => {
    const timeString = `${selectedHour.toString().padStart(2, '0')}:${selectedMinute
      .toString()
      .padStart(2, '0')}`;
    onTimeSelect(timeString);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{title}</Text>
            <TouchableOpacity onPress={onClose}>
              <Icon name="close" size={24} color={Colors.darkGray} />
            </TouchableOpacity>
          </View>

          <View style={styles.timePickerContainer}>
            <View style={styles.timePicker}>
              <Text style={styles.timePickerLabel}>Hour</Text>
              <ScrollView style={styles.timePickerScroll} showsVerticalScrollIndicator={false}>
                {hours.map((hour) => (
                  <TouchableOpacity
                    key={hour}
                    style={[
                      styles.timePickerItem,
                      selectedHour === hour && styles.timePickerItemSelected,
                    ]}
                    onPress={() => setSelectedHour(hour)}
                  >
                    <Text
                      style={[
                        styles.timePickerItemText,
                        selectedHour === hour && styles.timePickerItemTextSelected,
                      ]}
                    >
                      {hour.toString().padStart(2, '0')}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            <Text style={styles.timeSeparator}>:</Text>

            <View style={styles.timePicker}>
              <Text style={styles.timePickerLabel}>Minute</Text>
              <ScrollView style={styles.timePickerScroll} showsVerticalScrollIndicator={false}>
                {minutes.map((minute) => (
                  <TouchableOpacity
                    key={minute}
                    style={[
                      styles.timePickerItem,
                      selectedMinute === minute && styles.timePickerItemSelected,
                    ]}
                    onPress={() => setSelectedMinute(minute)}
                  >
                    <Text
                      style={[
                        styles.timePickerItemText,
                        selectedMinute === minute && styles.timePickerItemTextSelected,
                      ]}
                    >
                      {minute.toString().padStart(2, '0')}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </View>

          <View style={styles.modalActions}>
            <TouchableOpacity style={styles.modalButton} onPress={onClose}>
              <Text style={styles.modalButtonTextSecondary}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalButton, styles.modalButtonPrimary]}
              onPress={handleConfirm}
            >
              <Text style={styles.modalButtonTextPrimary}>Confirm</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const OperatingHoursScreen: React.FC = () => {
  const { operatingHours, updateOperatingHours, isLoading } = useSettingsStore();
  const [formData, setFormData] = useState(operatingHours);
  const [hasChanges, setHasChanges] = useState(false);
  const [timePickerVisible, setTimePickerVisible] = useState(false);
  const [timePickerConfig, setTimePickerConfig] = useState<{
    day: string;
    type: 'open' | 'close';
    title: string;
    currentTime: string;
  } | null>(null);

  const daysOfWeek = [
    { key: 'monday', label: 'Monday' },
    { key: 'tuesday', label: 'Tuesday' },
    { key: 'wednesday', label: 'Wednesday' },
    { key: 'thursday', label: 'Thursday' },
    { key: 'friday', label: 'Friday' },
    { key: 'saturday', label: 'Saturday' },
    { key: 'sunday', label: 'Sunday' },
  ];

  const handleDayToggle = (day: string, closed: boolean) => {
    setFormData((prev) => ({
      ...prev,
      [day]: {
        ...prev[day as keyof typeof prev],
        closed,
      },
    }));
    setHasChanges(true);
  };

  const handleTimePress = (day: string, type: 'open' | 'close') => {
    const dayData = formData[day as keyof typeof formData] as {
      open: string;
      close: string;
      closed: boolean;
    };
    setTimePickerConfig({
      day,
      type,
      title: `${type === 'open' ? 'Opening' : 'Closing'} Time - ${
        daysOfWeek.find((d) => d.key === day)?.label
      }`,
      currentTime: dayData[type],
    });
    setTimePickerVisible(true);
  };

  const handleTimeSelect = (time: string) => {
    if (timePickerConfig) {
      setFormData((prev) => ({
        ...prev,
        [timePickerConfig.day]: {
          ...prev[timePickerConfig.day as keyof typeof prev],
          [timePickerConfig.type]: time,
        },
      }));
      setHasChanges(true);
    }
  };

  const formatTime = (time: string): string => {
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  const copyToAllDays = (sourceDay: string) => {
    const sourceDayData = formData[sourceDay as keyof typeof formData] as {
      open: string;
      close: string;
      closed: boolean;
    };
    Alert.alert(
      'Copy Hours',
      `Copy ${daysOfWeek.find((d) => d.key === sourceDay)?.label} hours to all other days?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Copy',
          onPress: () => {
            const updatedData = { ...formData };
            daysOfWeek.forEach((day) => {
              if (day.key !== sourceDay) {
                updatedData[day.key as keyof typeof updatedData] = {
                  ...sourceDayData,
                };
              }
            });
            setFormData(updatedData);
            setHasChanges(true);
          },
        },
      ]
    );
  };

  const handleSave = async () => {
    try {
      updateOperatingHours(formData);
      setHasChanges(false);
      Alert.alert('Success', 'Operating hours have been saved successfully.', [{ text: 'OK' }]);
    } catch (_error) {
      Alert.alert('Error', 'Failed to save operating hours. Please try again.', [{ text: 'OK' }]);
    }
  };

  const handleReset = () => {
    Alert.alert('Reset Changes', 'Are you sure you want to discard all unsaved changes?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Reset',
        style: 'destructive',
        onPress: () => {
          setFormData(operatingHours);
          setHasChanges(false);
        },
      },
    ]);
  };

  const renderDayCard = (day: { key: string; label: string }) => {
    const dayData = formData[day.key as keyof typeof formData] as {
      open: string;
      close: string;
      closed: boolean;
    };
    const isToday =
      new Date().toLocaleDateString('en', { weekday: 'long' }).toLowerCase() === day.key;

    return (
      <View key={day.key} style={[styles.dayCard, isToday && styles.todayCard]}>
        <View style={styles.dayHeader}>
          <View style={styles.dayInfo}>
            <Text style={[styles.dayLabel, isToday && styles.todayLabel]}>
              {day.label}
              {isToday && <Text style={styles.todayIndicator}> (Today)</Text>}
            </Text>
            <Text style={styles.dayStatus}>
              {dayData.closed
                ? 'Closed'
                : `${formatTime(dayData.open)} - ${formatTime(dayData.close)}`}
            </Text>
          </View>

          <ToggleSwitch
            value={!dayData.closed}
            onValueChange={(open) => handleDayToggle(day.key, !open)}
          />
        </View>

        {!dayData.closed && (
          <View style={styles.timeControls}>
            <TouchableOpacity
              style={styles.timeButton}
              onPress={() => handleTimePress(day.key, 'open')}
            >
              <Icon name="schedule" size={20} color={Colors.primary} />
              <Text style={styles.timeButtonText}>Open: {formatTime(dayData.open)}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.timeButton}
              onPress={() => handleTimePress(day.key, 'close')}
            >
              <Icon name="schedule" size={20} color={Colors.danger} />
              <Text style={styles.timeButtonText}>Close: {formatTime(dayData.close)}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.copyButton} onPress={() => copyToAllDays(day.key)}>
              <Icon name="content-copy" size={16} color={Colors.secondary} />
              <Text style={styles.copyButtonText}>Copy to all</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  const getOpenDaysCount = () => {
    return daysOfWeek.filter((day) => !formData[day.key as keyof typeof formData].closed).length;
  };

  return (
    <View style={styles.container}>
      <SettingsHeader
        title="Operating Hours"
        subtitle="Set your business hours"
        rightAction={{
          icon: 'save',
          onPress: handleSave,
          color: hasChanges ? Colors.white : 'rgba(255, 255, 255, 0.5)',
        }}
      />

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Summary */}
        <SettingsSection
          title="Hours Summary"
          subtitle={`Open ${getOpenDaysCount()} days per week`}
        >
          <View style={styles.summaryContainer}>
            <View style={styles.summaryCard}>
              <Icon name="access-time" size={32} color={Colors.primary} />
              <Text style={styles.summaryTitle}>Open Days</Text>
              <Text style={styles.summaryValue}>{getOpenDaysCount()}/7</Text>
            </View>

            <View style={styles.summaryCard}>
              <Icon name="today" size={32} color={Colors.secondary} />
              <Text style={styles.summaryTitle}>Today Status</Text>
              <Text
                style={[
                  styles.summaryValue,
                  styles.statusText,
                  {
                    color: formData[
                      new Date()
                        .toLocaleDateString('en', { weekday: 'long' })
                        .toLowerCase() as keyof typeof formData
                    ]?.closed
                      ? Colors.danger
                      : Colors.success,
                  },
                ]}
              >
                {formData[
                  new Date()
                    .toLocaleDateString('en', { weekday: 'long' })
                    .toLowerCase() as keyof typeof formData
                ]?.closed
                  ? 'Closed'
                  : 'Open'}
              </Text>
            </View>
          </View>
        </SettingsSection>

        {/* Weekly Schedule */}
        <SettingsSection
          title="Weekly Schedule"
          subtitle="Set opening and closing times for each day"
        >
          <View style={styles.scheduleContainer}>{daysOfWeek.map(renderDayCard)}</View>
        </SettingsSection>

        {/* Quick Actions */}
        <SettingsSection title="Quick Actions" subtitle="Common schedule adjustments">
          <SettingsCard
            title="Open All Days"
            description="Set all days to open with standard hours"
            icon="schedule"
            iconColor={Colors.success}
            onPress={() => {
              const standardHours = { open: '09:00', close: '22:00', closed: false };
              const updatedData = { ...formData };
              daysOfWeek.forEach((day) => {
                updatedData[day.key as keyof typeof updatedData] = standardHours;
              });
              setFormData(updatedData);
              setHasChanges(true);
            }}
          />

          <SettingsCard
            title="Standard Business Hours"
            description="Mon-Fri 9AM-6PM, Sat-Sun 10AM-4PM"
            icon="business-center"
            iconColor={Colors.secondary}
            onPress={() => {
              const weekdayHours = { open: '09:00', close: '18:00', closed: false };
              const weekendHours = { open: '10:00', close: '16:00', closed: false };
              setFormData({
                ...formData,
                monday: weekdayHours,
                tuesday: weekdayHours,
                wednesday: weekdayHours,
                thursday: weekdayHours,
                friday: weekdayHours,
                saturday: weekendHours,
                sunday: weekendHours,
              });
              setHasChanges(true);
            }}
          />

          <SettingsCard
            title="Restaurant Hours"
            description="Open 7 days, 9AM-11PM"
            icon="restaurant"
            iconColor={Colors.warning}
            onPress={() => {
              const restaurantHours = { open: '09:00', close: '23:00', closed: false };
              const updatedData = { ...formData };
              daysOfWeek.forEach((day) => {
                updatedData[day.key as keyof typeof updatedData] = restaurantHours;
              });
              setFormData(updatedData);
              setHasChanges(true);
            }}
          />
        </SettingsSection>

        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={[styles.button, styles.saveButton]}
            onPress={handleSave}
            disabled={!hasChanges || isLoading}
          >
            <Icon name="save" size={20} color={Colors.white} />
            <Text style={styles.saveButtonText}>Save Changes</Text>
          </TouchableOpacity>

          {hasChanges && (
            <TouchableOpacity style={[styles.button, styles.resetButton]} onPress={handleReset}>
              <Icon name="refresh" size={20} color={Colors.danger} />
              <Text style={styles.resetButtonText}>Reset</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>

      <TimePickerModal
        visible={timePickerVisible}
        onClose={() => setTimePickerVisible(false)}
        onTimeSelect={handleTimeSelect}
        currentTime={timePickerConfig?.currentTime || '09:00'}
        title={timePickerConfig?.title || 'Select Time'}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    flex: 1,
  },
  summaryContainer: {
    flexDirection: 'row',
    padding: 16,
    gap: 16,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  summaryTitle: {
    fontSize: 14,
    color: Colors.lightText,
    marginTop: 8,
    textAlign: 'center',
  },
  summaryValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.text,
    marginTop: 4,
  },
  statusText: {
    fontSize: 16,
  },
  scheduleContainer: {
    padding: 16,
    gap: 16,
  },
  dayCard: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  todayCard: {
    borderWidth: 2,
    borderColor: Colors.primary,
  },
  dayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dayInfo: {
    flex: 1,
  },
  dayLabel: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text,
  },
  todayLabel: {
    color: Colors.primary,
  },
  todayIndicator: {
    fontSize: 14,
    fontWeight: '400',
  },
  dayStatus: {
    fontSize: 14,
    color: Colors.lightText,
    marginTop: 2,
  },
  timeControls: {
    marginTop: 16,
    gap: 8,
  },
  timeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background,
    borderRadius: 8,
    padding: 12,
    gap: 8,
  },
  timeButtonText: {
    fontSize: 16,
    color: Colors.text,
    fontWeight: '500',
  },
  copyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.background,
    borderRadius: 8,
    padding: 8,
    gap: 4,
    borderWidth: 1,
    borderColor: Colors.border,
    borderStyle: 'dashed',
  },
  copyButtonText: {
    fontSize: 14,
    color: Colors.secondary,
    fontWeight: '500',
  },
  actionButtons: {
    padding: 16,
    gap: 12,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  saveButton: {
    backgroundColor: Colors.primary,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.white,
  },
  resetButton: {
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.danger,
  },
  resetButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.danger,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 24,
    width: '80%',
    maxWidth: 400,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text,
  },
  timePickerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  timePicker: {
    alignItems: 'center',
  },
  timePickerLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: Colors.text,
    marginBottom: 8,
  },
  timePickerScroll: {
    height: 150,
    width: 80,
  },
  timePickerItem: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginVertical: 2,
  },
  timePickerItemSelected: {
    backgroundColor: Colors.primary,
  },
  timePickerItemText: {
    fontSize: 18,
    fontWeight: '500',
    color: Colors.text,
    textAlign: 'center',
  },
  timePickerItemTextSelected: {
    color: Colors.white,
  },
  timeSeparator: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.text,
    marginHorizontal: 16,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalButtonPrimary: {
    backgroundColor: Colors.primary,
  },
  modalButtonTextPrimary: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.white,
  },
  modalButtonTextSecondary: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.darkGray,
  },
});

export default OperatingHoursScreen;
