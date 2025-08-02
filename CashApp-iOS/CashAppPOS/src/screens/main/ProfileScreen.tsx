import React, { useState } from 'react';

import {
  StyleSheet,
  Text,
  View,
  SafeAreaView,
  StatusBar,
  ScrollView,
  TouchableOpacity,
  Alert,
  Modal,
  TextInput,
} from 'react-native';

import { useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialIcons';

import ErrorBoundary from '../../components/ErrorBoundary';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme, useThemedStyles } from '../../design-system/ThemeProvider';
import useAppStore from '../../store/useAppStore';

const ProfileScreenContent: React.FC = () => {
  const navigation = useNavigation();
  const { theme } = useTheme();
  const styles = useThemedStyles(createStyles);
  const dynamicStyles = useThemedStyles(createDynamicStyles);
  const { user, session } = useAppStore();
  const { updateUser } = useAuth();

  // Modal states
  const [showEditModal, setShowEditModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);

  // Edit form state
  const [editForm, setEditForm] = useState({
    firstName: user?.firstName || '',
    lastName: user?.lastName || '',
    email: user?.email || '',
    phone: user?.phone || '',
  });

  // Password form state
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  const handleEditProfile = () => {
    setEditForm({
      firstName: user?.firstName || '',
      lastName: user?.lastName || '',
      email: user?.email || '',
      phone: user?.phone || '',
    });
    setShowEditModal(true);
  };

  const handleSaveProfile = async () => {
    // Validate required fields
    if (!editForm.firstName.trim() || !editForm.lastName.trim() || !editForm.email.trim()) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(editForm.email.trim())) {
      Alert.alert('Error', 'Please enter a valid email address');
      return;
    }

    try {
      await updateUser({
        firstName: editForm.firstName.trim(),
        lastName: editForm.lastName.trim(),
        email: editForm.email.trim(),
        phone: editForm.phone.trim(),
      });

      setShowEditModal(false);
      Alert.alert('Success', 'Profile updated successfully!');
    } catch (_error) {
      Alert.alert('Error', 'Failed to update profile. Please try again.');
    }
  };

  const handleChangePassword = () => {
    setPasswordForm({
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    });
    setShowPasswordModal(true);
  };

  const handleSavePassword = async () => {
    // Validate required fields
    if (
      !passwordForm.currentPassword ||
      !passwordForm.newPassword ||
      !passwordForm.confirmPassword
    ) {
      Alert.alert('Error', 'Please fill in all password fields');
      return;
    }

    // Validate new password
    if (passwordForm.newPassword.length < 6) {
      Alert.alert('Error', 'New password must be at least 6 characters long');
      return;
    }

    // Validate password confirmation
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      Alert.alert('Error', 'New passwords do not match');
      return;
    }

    try {
      // In a real app, this would call an API to change password
      Alert.alert('Success', 'Password changed successfully!', [
        { text: 'OK', onPress: () => setShowPasswordModal(false) },
      ]);
    } catch (_error) {
      Alert.alert('Error', 'Failed to change password. Please try again.');
    }
  };

  const InfoCard = ({ title, value, icon }: { title: string; value: string; icon: string }) => (
    <View style={styles.infoCard}>
      <View style={styles.infoIcon}>
        <Icon name={icon} size={24} color={theme.colors.secondary} />
      </View>
      <View style={styles.infoContent}>
        <Text style={styles.infoTitle}>{title}</Text>
        <Text style={styles.infoValue}>{value}</Text>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={theme.colors.primary} />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity style={styles.headerButton} onPress={() => navigation.goBack()}>
            <Icon name="arrow-back" size={24} color={theme.colors.white} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Profile</Text>
        </View>
        <TouchableOpacity
          style={styles.headerButton}
          onPress={() => navigation.navigate('POS' as never)}
        >
          <Icon name="home" size={24} color={theme.colors.white} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Profile Header */}
        <View style={styles.profileHeader}>
          <View style={styles.avatar}>
            <Icon name="person" size={48} color={theme.colors.white} />
          </View>
          <Text style={styles.userName}>{user?.name || 'User'}</Text>
          <Text style={styles.userRole}>{user?.role?.toUpperCase() || 'STAFF'}</Text>
        </View>

        {/* User Information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Information</Text>
          <View style={styles.infoContainer}>
            <InfoCard title="Email" value={user?.email || 'No email set'} icon="email" />
            <InfoCard title="User ID" value={user?.id?.toString() || 'N/A'} icon="badge" />
            <InfoCard title="Role" value={user?.role || 'Staff'} icon="work" />
            <InfoCard title="Status" value={user?.isActive ? 'Active' : 'Inactive'} icon="circle" />
          </View>
        </View>

        {/* Current Session */}
        {session && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Current Session</Text>
            <View style={styles.sessionCard}>
              <View style={styles.sessionHeader}>
                <Icon name="access-time" size={24} color={theme.colors.success[500]} />
                <Text style={styles.sessionTitle}>Active Session</Text>
              </View>
              <View style={styles.sessionInfo}>
                <View style={styles.sessionItem}>
                  <Text style={styles.sessionLabel}>Started</Text>
                  <Text style={styles.sessionValue}>
                    {session.startTime instanceof Date
                      ? session.startTime.toLocaleTimeString()
                      : new Date(session.startTime).toLocaleTimeString()}
                  </Text>
                </View>
                <View style={styles.sessionItem}>
                  <Text style={styles.sessionLabel}>Orders</Text>
                  <Text style={styles.sessionValue}>{session.ordersCount || 0}</Text>
                </View>
                <View style={styles.sessionItem}>
                  <Text style={styles.sessionLabel}>Total Sales</Text>
                  <Text style={styles.sessionValue}>£{(session.totalSales || 0).toFixed(2)}</Text>
                </View>
              </View>
            </View>
          </View>
        )}

        {/* Actions */}
        <View style={styles.section}>
          <TouchableOpacity style={styles.actionButton} onPress={handleEditProfile}>
            <Icon name="edit" size={24} color={theme.colors.secondary} />
            <Text style={styles.actionButtonText}>Edit Profile</Text>
            <Icon name="chevron-right" size={24} color={theme.colors.lightText} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionButton} onPress={handleChangePassword}>
            <Icon name="lock" size={24} color={theme.colors.secondary} />
            <Text style={styles.actionButtonText}>Change Password</Text>
            <Icon name="chevron-right" size={24} color={theme.colors.lightText} />
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Edit Profile Modal */}
      <Modal
        visible={showEditModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowEditModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Profile</Text>
              <TouchableOpacity onPress={() => setShowEditModal(false)}>
                <Icon name="close" size={24} color={theme.colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalContent}>
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>First Name *</Text>
                <TextInput
                  style={styles.formInput}
                  value={editForm.firstName}
                  onChangeText={(text) => setEditForm({ ...editForm, firstName: text })}
                  placeholder="Enter first name"
                  placeholderTextColor={theme.colors.lightText}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Last Name *</Text>
                <TextInput
                  style={styles.formInput}
                  value={editForm.lastName}
                  onChangeText={(text) => setEditForm({ ...editForm, lastName: text })}
                  placeholder="Enter last name"
                  placeholderTextColor={theme.colors.lightText}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Email *</Text>
                <TextInput
                  style={styles.formInput}
                  value={editForm.email}
                  onChangeText={(text) => setEditForm({ ...editForm, email: text })}
                  placeholder="Enter email address"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  placeholderTextColor={theme.colors.lightText}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Phone</Text>
                <TextInput
                  style={styles.formInput}
                  value={editForm.phone}
                  onChangeText={(text) => setEditForm({ ...editForm, phone: text })}
                  placeholder="Enter phone number"
                  keyboardType="phone-pad"
                  placeholderTextColor={theme.colors.lightText}
                />
              </View>

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={dynamicStyles.modalCancelButton}
                  onPress={() => setShowEditModal(false)}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity style={dynamicStyles.modalSaveButton} onPress={handleSaveProfile}>
                  <Text style={styles.saveButtonText}>Save Changes</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Change Password Modal */}
      <Modal
        visible={showPasswordModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowPasswordModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Change Password</Text>
              <TouchableOpacity onPress={() => setShowPasswordModal(false)}>
                <Icon name="close" size={24} color={theme.colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalContent}>
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Current Password *</Text>
                <TextInput
                  style={styles.formInput}
                  value={passwordForm.currentPassword}
                  onChangeText={(text) =>
                    setPasswordForm({ ...passwordForm, currentPassword: text })
                  }
                  placeholder="Enter current password"
                  secureTextEntry={true}
                  placeholderTextColor={theme.colors.lightText}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>New Password *</Text>
                <TextInput
                  style={styles.formInput}
                  value={passwordForm.newPassword}
                  onChangeText={(text) => setPasswordForm({ ...passwordForm, newPassword: text })}
                  placeholder="Enter new password (min 6 characters)"
                  secureTextEntry={true}
                  placeholderTextColor={theme.colors.lightText}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Confirm New Password *</Text>
                <TextInput
                  style={styles.formInput}
                  value={passwordForm.confirmPassword}
                  onChangeText={(text) =>
                    setPasswordForm({ ...passwordForm, confirmPassword: text })
                  }
                  placeholder="Confirm new password"
                  secureTextEntry={true}
                  placeholderTextColor={theme.colors.lightText}
                />
              </View>

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={dynamicStyles.modalCancelButton}
                  onPress={() => setShowPasswordModal(false)}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={dynamicStyles.modalSaveButton}
                  onPress={handleSavePassword}
                >
                  <Text style={styles.saveButtonText}>Change Password</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

// Dynamic styles creator for button combinations
const createDynamicStyles = (theme: unknown) =>
  StyleSheet.create({
    modalCancelButton: {
      flex: 1,
      marginRight: 8,
      backgroundColor: theme.colors.white,
      borderRadius: 8,
      paddingVertical: 12,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    modalSaveButton: {
      flex: 1,
      marginLeft: 8,
      backgroundColor: theme.colors.primary,
      borderRadius: 8,
      paddingVertical: 12,
      alignItems: 'center',
    },
  });

const createStyles = (theme: unknown) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    header: {
      backgroundColor: theme.colors.primary,
      paddingHorizontal: 20,
      paddingVertical: 15,
      elevation: 4,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    headerLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
    },
    headerButton: {
      padding: 8,
      marginRight: 12,
    },
    headerTitle: {
      color: theme.colors.white,
      fontSize: 20,
      fontWeight: 'bold',
    },
    content: {
      flex: 1,
      padding: 20,
    },
    profileHeader: {
      alignItems: 'center',
      paddingVertical: 30,
    },
    avatar: {
      width: 100,
      height: 100,
      borderRadius: 50,
      backgroundColor: theme.colors.secondary,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 15,
    },
    userName: {
      fontSize: 24,
      fontWeight: 'bold',
      color: theme.colors.text,
      marginBottom: 5,
    },
    userRole: {
      fontSize: 14,
      color: theme.colors.lightText,
      fontWeight: '600',
    },
    section: {
      marginBottom: 30,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: 'bold',
      color: theme.colors.text,
      marginBottom: 15,
    },
    infoContainer: {
      backgroundColor: theme.colors.white,
      borderRadius: 12,
      elevation: 2,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.1,
      shadowRadius: 2,
    },
    infoCard: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 20,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.lightGray,
    },
    infoIcon: {
      marginRight: 15,
    },
    infoContent: {
      flex: 1,
    },
    infoTitle: {
      fontSize: 14,
      color: theme.colors.lightText,
      marginBottom: 4,
    },
    infoValue: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.colors.text,
    },
    sessionCard: {
      backgroundColor: theme.colors.white,
      borderRadius: 12,
      padding: 20,
      elevation: 2,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.1,
      shadowRadius: 2,
    },
    sessionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 15,
    },
    sessionTitle: {
      fontSize: 18,
      fontWeight: 'bold',
      color: theme.colors.text,
      marginLeft: 10,
    },
    sessionInfo: {
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    sessionItem: {
      alignItems: 'center',
    },
    sessionLabel: {
      fontSize: 14,
      color: theme.colors.lightText,
      marginBottom: 4,
    },
    sessionValue: {
      fontSize: 16,
      fontWeight: 'bold',
      color: theme.colors.text,
    },
    actionButton: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.colors.white,
      borderRadius: 12,
      padding: 20,
      marginBottom: 15,
      elevation: 2,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.1,
      shadowRadius: 2,
    },
    actionButtonText: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.colors.text,
      marginLeft: 15,
      flex: 1,
    },
    // Modal Styles
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    modal: {
      backgroundColor: theme.colors.white,
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
      borderBottomColor: theme.colors.lightGray,
    },
    modalTitle: {
      fontSize: 20,
      fontWeight: '600',
      color: theme.colors.text,
    },
    modalContent: {
      padding: 20,
    },
    formGroup: {
      marginBottom: 20,
    },
    formLabel: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.colors.text,
      marginBottom: 8,
    },
    formInput: {
      borderWidth: 1,
      borderColor: theme.colors.lightGray,
      borderRadius: 8,
      paddingHorizontal: 16,
      paddingVertical: 12,
      fontSize: 16,
      color: theme.colors.text,
      backgroundColor: theme.colors.white,
    },
    modalActions: {
      flexDirection: 'row',
      gap: 12,
      marginTop: 24,
      paddingBottom: 20,
    },
    cancelButtonText: {
      color: theme.colors.text,
      fontSize: 16,
      fontWeight: '600',
    },
    saveButtonText: {
      color: theme.colors.white,
      fontSize: 16,
      fontWeight: '600',
    },
  });

const ProfileScreen: React.FC = () => {
  return (
    <ErrorBoundary>
      <ProfileScreenContent />
    </ErrorBoundary>
  );
};

export default ProfileScreen;
