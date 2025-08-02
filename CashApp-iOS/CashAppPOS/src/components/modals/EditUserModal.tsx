import React, { useState, useEffect } from 'react';

import {
  StyleSheet,
  Text,
  View,
  Modal,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';

import Icon from 'react-native-vector-icons/MaterialIcons';

import { UserManagementService } from '../../services/UserManagementService';
import { SimpleTextInput } from '../inputs'; // Corrected import

import type {
  User,
  UpdateUserRequest,
  UserRole,
  Permission,
  PermissionTemplate,
} from '../../services/UserManagementService';

// Fynlo POS Color Scheme
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

interface EditUserModalProps {
  visible: boolean;
  user: User | null;
  onClose: () => void;
  onUserUpdated: () => void;
}

const EditUserModal: React.FC<EditUserModalProps> = ({ visible, user, onClose, onUserUpdated }) => {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<UpdateUserRequest>({});
  const [permissionTemplates, setPermissionTemplates] = useState<PermissionTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  const [_showPermissions, setShowPermissions] = useState(false);
  const [activeTab, setActiveTab] = useState<'basic' | 'permissions' | 'security'>('basic');

  const userManagementService = UserManagementService.getInstance();

  const userRoles: UserRole[] = [
    'Platform Admin',
    'Restaurant Owner',
    'Restaurant Manager',
    'Restaurant Employee',
    'Kitchen Staff',
    'Cashier',
    'Support Agent',
  ];

  const allPermissions: Permission[] = [
    'view_analytics',
    'manage_users',
    'manage_restaurants',
    'process_payments',
    'manage_inventory',
    'view_reports',
    'manage_menu',
    'manage_orders',
    'access_pos',
    'manage_settings',
    'view_logs',
    'export_data',
    'manage_tables',
    'view_kitchen_orders',
    'manage_staff_schedules',
  ];

  const permissionDescriptions: { [key in Permission]: string } = {
    view_analytics: 'View business analytics and insights',
    manage_users: 'Create, edit, and manage users',
    manage_restaurants: 'Manage restaurant settings and configuration',
    process_payments: 'Process customer payments',
    manage_inventory: 'Manage inventory and stock levels',
    view_reports: 'View and generate reports',
    manage_menu: 'Edit menu items and pricing',
    manage_orders: 'View and manage customer orders',
    access_pos: 'Access point of sale system',
    manage_settings: 'Modify system settings',
    view_logs: 'View system and access logs',
    export_data: 'Export data and reports',
    manage_tables: 'Manage restaurant tables and seating',
    view_kitchen_orders: 'View orders in kitchen display',
    manage_staff_schedules: 'Create and manage staff schedules',
  };

  useEffect(() => {
    if (visible && user) {
      setFormData({
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status,
        restaurantId: user.restaurantId,
        permissions: [...user.permissions],
        phoneNumber: user.phoneNumber,
        address: user.address,
        emergencyContact: user.emergencyContact,
      });
      loadPermissionTemplates();
    }
  }, [visible, user]);

  const loadPermissionTemplates = async () => {
    try {
      const templates = await userManagementService.getPermissionTemplates();
      setPermissionTemplates(templates);
    } catch (error) {
      logger.error('Failed to load permission templates:', error);
    }
  };

  const handleSubmit = async () => {
    if (!user || !formData.name?.trim() || !formData.email?.trim()) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    if (!formData.email.includes('@')) {
      Alert.alert('Error', 'Please enter a valid email address');
      return;
    }

    if (!formData.permissions?.length) {
      Alert.alert('Error', 'Please select at least one permission');
      return;
    }

    try {
      setLoading(true);
      await userManagementService.updateUser(user.id, formData);
      Alert.alert('Success', 'User updated successfully');
      onUserUpdated();
      handleClose();
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to update user');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setFormData({});
    setSelectedTemplate('');
    setShowPermissions(false);
    setActiveTab('basic');
    onClose();
  };

  const handleSuspendUser = async () => {
    if (!user) return;

    Alert.alert(
      'Suspend User',
      'Are you sure you want to suspend this user? They will not be able to access the system.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Suspend',
          style: 'destructive',
          onPress: async () => {
            try {
              setLoading(true);
              await userManagementService.suspendUser(user.id, 'Suspended via admin panel');
              Alert.alert('Success', 'User suspended successfully');
              onUserUpdated();
              handleClose();
            } catch (_error) {
              Alert.alert('Error', 'Failed to suspend user');
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleActivateUser = async () => {
    if (!user) return;

    try {
      setLoading(true);
      await userManagementService.activateUser(user.id);
      Alert.alert('Success', 'User activated successfully');
      onUserUpdated();
      handleClose();
    } catch (_error) {
      Alert.alert('Error', 'Failed to activate user');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!user) return;

    Alert.alert(
      'Delete User',
      'Are you sure you want to delete this user? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              setLoading(true);
              await userManagementService.deleteUser(user.id);
              Alert.alert('Success', 'User deleted successfully');
              onUserUpdated();
              handleClose();
            } catch (_error) {
              Alert.alert('Error', 'Failed to delete user');
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  const togglePermission = (permission: Permission) => {
    setFormData((prev) => ({
      ...prev,
      permissions: prev.permissions?.includes(permission)
        ? prev.permissions.filter((p) => p !== permission)
        : [...(prev.permissions || []), permission],
    }));
  };

  const applyTemplate = (templateId: string) => {
    const template = permissionTemplates.find((t) => t.id === templateId);
    if (template) {
      setFormData((prev) => ({ ...prev, permissions: template.permissions }));
      setSelectedTemplate(templateId);
    }
  };

  const applicableTemplates = permissionTemplates.filter(
    (template) => formData.role && template.applicableRoles.includes(formData.role)
  );

  if (!user) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <SafeAreaView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
            <Icon name="close" size={24} color={Colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Edit User</Text>
          <TouchableOpacity
            onPress={handleSubmit}
            style={[styles.saveButton, loading && styles.saveButtonDisabled]}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator size="small" color={Colors.white} />
            ) : (
              <Text style={styles.saveButtonText}>Save</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Tab Navigation */}
        <View style={styles.tabNavigation}>
          {[
            { key: 'basic', label: 'Basic Info', icon: 'person' },
            { key: 'permissions', label: 'Permissions', icon: 'security' },
            { key: 'security', label: 'Security', icon: 'shield' },
          ].map((tab) => (
            <TouchableOpacity
              key={tab.key}
              style={[styles.tabButton, activeTab === tab.key && styles.tabButtonActive]}
              onPress={() => setActiveTab(tab.key as unknown)}
            >
              <Icon
                name={tab.icon}
                size={20}
                color={activeTab === tab.key ? Colors.primary : Colors.mediumGray}
              />
              <Text
                style={[styles.tabButtonText, activeTab === tab.key && styles.tabButtonTextActive]}
              >
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {activeTab === 'basic' && (
            <>
              {/* Basic Information */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Basic Information</Text>

                <View style={styles.inputGroup}>
                  <SimpleTextInput
                    label="Full Name *"
                    value={formData.name || ''}
                    onValueChange={(text) => setFormData((prev) => ({ ...prev, name: text }))}
                    placeholder="Enter full name"
                    autoCapitalize="words"
                  />
                </View>

                <View style={styles.inputGroup}>
                  <SimpleTextInput
                    label="Email Address *"
                    value={formData.email || ''}
                    onValueChange={(text) => setFormData((prev) => ({ ...prev, email: text }))}
                    placeholder="Enter email address"
                    keyboardType="email-address"
                    autoCapitalize="none"
                  />
                </View>

                <View style={styles.inputGroup}>
                  <SimpleTextInput
                    label="Phone Number"
                    value={formData.phoneNumber || ''}
                    onValueChange={(text) =>
                      setFormData((prev) => ({ ...prev, phoneNumber: text }))
                    }
                    placeholder="Enter phone number"
                    keyboardType="phone-pad"
                  />
                </View>

                <View style={styles.inputGroup}>
                  <SimpleTextInput
                    label="Address"
                    value={formData.address || ''}
                    onValueChange={(text) => setFormData((prev) => ({ ...prev, address: text }))}
                    placeholder="Enter address"
                    multiline
                    numberOfLines={3} // This is a valid TextInput prop
                  />
                </View>
              </View>

              {/* Role and Status */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Role & Status</Text>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>User Role *</Text>
                  <View style={styles.roleGrid}>
                    {userRoles.map((role) => (
                      <TouchableOpacity
                        key={role}
                        style={[
                          styles.roleOption,
                          formData.role === role && styles.roleOptionSelected,
                        ]}
                        onPress={() => setFormData((prev) => ({ ...prev, role }))}
                      >
                        <Text
                          style={[
                            styles.roleOptionText,
                            formData.role === role && styles.roleOptionTextSelected,
                          ]}
                        >
                          {role}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Status</Text>
                  <View style={styles.statusGrid}>
                    {['active', 'inactive', 'suspended'].map((status) => (
                      <TouchableOpacity
                        key={status}
                        style={[
                          styles.statusOption,
                          formData.status === status && styles.statusOptionSelected,
                        ]}
                        onPress={() =>
                          setFormData((prev) => ({ ...prev, status: status as unknown }))
                        }
                      >
                        <Text
                          style={[
                            styles.statusOptionText,
                            formData.status === status && styles.statusOptionTextSelected,
                          ]}
                        >
                          {status.charAt(0).toUpperCase() + status.slice(1)}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              </View>
            </>
          )}

          {activeTab === 'permissions' && (
            <>
              {/* Permission Templates */}
              {applicableTemplates.length > 0 && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Permission Templates</Text>
                  <Text style={styles.sectionSubtitle}>
                    Quick setup with predefined permissions
                  </Text>

                  <View style={styles.templateGrid}>
                    {applicableTemplates.map((template) => (
                      <TouchableOpacity
                        key={template.id}
                        style={[
                          styles.templateOption,
                          selectedTemplate === template.id && styles.templateOptionSelected,
                        ]}
                        onPress={() => applyTemplate(template.id)}
                      >
                        <Text
                          style={[
                            styles.templateOptionTitle,
                            selectedTemplate === template.id && styles.templateOptionTitleSelected,
                          ]}
                        >
                          {template.name}
                        </Text>
                        <Text
                          style={[
                            styles.templateOptionDescription,
                            selectedTemplate === template.id &&
                              styles.templateOptionDescriptionSelected,
                          ]}
                        >
                          {template.description}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}

              {/* Individual Permissions */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>
                  Individual Permissions ({formData.permissions?.length || 0} selected)
                </Text>

                <View style={styles.permissionsList}>
                  {allPermissions.map((permission) => (
                    <TouchableOpacity
                      key={permission}
                      style={styles.permissionItem}
                      onPress={() => togglePermission(permission)}
                    >
                      <View style={styles.permissionInfo}>
                        <Text style={styles.permissionName}>
                          {permission.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
                        </Text>
                        <Text style={styles.permissionDescription}>
                          {permissionDescriptions[permission]}
                        </Text>
                      </View>
                      <View
                        style={[
                          styles.checkbox,
                          formData.permissions?.includes(permission) && styles.checkboxSelected,
                        ]}
                      >
                        {formData.permissions?.includes(permission) && (
                          <Icon name="check" size={16} color={Colors.white} />
                        )}
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </>
          )}

          {activeTab === 'security' && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Security Actions</Text>
              <Text style={styles.sectionSubtitle}>Manage user access and security</Text>

              <View style={styles.actionsList}>
                {user.status === 'suspended' ? (
                  <TouchableOpacity
                    style={[styles.actionButton, styles.actionButtonSuccess]}
                    onPress={handleActivateUser}
                  >
                    <Icon name="check-circle" size={24} color={Colors.white} />
                    <View style={styles.actionButtonContent}>
                      <Text style={styles.actionButtonTitle}>Activate User</Text>
                      <Text style={styles.actionButtonDescription}>Restore user access</Text>
                    </View>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    style={[styles.actionButton, styles.actionButtonWarning]}
                    onPress={handleSuspendUser}
                  >
                    <Icon name="block" size={24} color={Colors.white} />
                    <View style={styles.actionButtonContent}>
                      <Text style={styles.actionButtonTitle}>Suspend User</Text>
                      <Text style={styles.actionButtonDescription}>Temporarily disable access</Text>
                    </View>
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  style={[styles.actionButton, styles.actionButtonDanger]}
                  onPress={handleDeleteUser}
                >
                  <Icon name="delete" size={24} color={Colors.white} />
                  <View style={styles.actionButtonContent}>
                    <Text style={styles.actionButtonTitle}>Delete User</Text>
                    <Text style={styles.actionButtonDescription}>Permanently remove user</Text>
                  </View>
                </TouchableOpacity>
              </View>

              {/* User Stats */}
              <View style={styles.userStats}>
                <Text style={styles.statsTitle}>User Statistics</Text>
                <View style={styles.statsGrid}>
                  <View style={styles.statItem}>
                    <Text style={styles.statValue}>{user.loginAttempts}</Text>
                    <Text style={styles.statLabel}>Failed Logins</Text>
                  </View>
                  <View style={styles.statItem}>
                    <Text style={styles.statValue}>
                      {user.lastLogin ? new Date(user.lastLogin).toLocaleDateString() : 'Never'}
                    </Text>
                    <Text style={styles.statLabel}>Last Login</Text>
                  </View>
                  <View style={styles.statItem}>
                    <Text style={styles.statValue}>
                      {Math.floor((Date.now() - user.createdAt.getTime()) / (1000 * 60 * 60 * 24))}
                    </Text>
                    <Text style={styles.statLabel}>Days Active</Text>
                  </View>
                </View>
              </View>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  closeButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text,
  },
  saveButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    minWidth: 70,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: Colors.white,
    fontSize: 14,
    fontWeight: '600',
  },
  tabNavigation: {
    flexDirection: 'row',
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 8,
  },
  tabButtonActive: {
    borderBottomWidth: 2,
    borderBottomColor: Colors.primary,
  },
  tabButtonText: {
    fontSize: 14,
    color: Colors.mediumGray,
    fontWeight: '500',
  },
  tabButtonTextActive: {
    color: Colors.primary,
  },
  content: {
    flex: 1,
  },
  section: {
    backgroundColor: Colors.white,
    marginBottom: 12,
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: Colors.lightText,
    marginBottom: 16,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.text,
    marginBottom: 8,
  },
  textInput: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    backgroundColor: Colors.white,
  },
  textInputMultiline: {
    height: 80,
    textAlignVertical: 'top',
  },
  roleGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  roleOption: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.background,
  },
  roleOptionSelected: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  roleOptionText: {
    fontSize: 12,
    color: Colors.text,
    fontWeight: '500',
  },
  roleOptionTextSelected: {
    color: Colors.white,
  },
  statusGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  statusOption: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.background,
  },
  statusOptionSelected: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  statusOptionText: {
    fontSize: 14,
    color: Colors.text,
    fontWeight: '500',
  },
  statusOptionTextSelected: {
    color: Colors.white,
  },
  templateGrid: {
    gap: 12,
  },
  templateOption: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.background,
  },
  templateOptionSelected: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  templateOptionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 4,
  },
  templateOptionTitleSelected: {
    color: Colors.white,
  },
  templateOptionDescription: {
    fontSize: 14,
    color: Colors.lightText,
  },
  templateOptionDescriptionSelected: {
    color: Colors.white,
    opacity: 0.9,
  },
  permissionsList: {
    marginTop: 8,
  },
  permissionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.lightGray,
  },
  permissionInfo: {
    flex: 1,
    marginRight: 12,
  },
  permissionName: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.text,
    marginBottom: 2,
  },
  permissionDescription: {
    fontSize: 12,
    color: Colors.lightText,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.white,
  },
  checkboxSelected: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  actionsList: {
    gap: 12,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    gap: 12,
  },
  actionButtonSuccess: {
    backgroundColor: Colors.success,
  },
  actionButtonWarning: {
    backgroundColor: Colors.warning,
  },
  actionButtonDanger: {
    backgroundColor: Colors.danger,
  },
  actionButtonContent: {
    flex: 1,
  },
  actionButtonTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.white,
    marginBottom: 2,
  },
  actionButtonDescription: {
    fontSize: 14,
    color: Colors.white,
    opacity: 0.9,
  },
  userStats: {
    marginTop: 24,
  },
  statsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 16,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.primary,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: Colors.lightText,
  },
});

export default EditUserModal;
