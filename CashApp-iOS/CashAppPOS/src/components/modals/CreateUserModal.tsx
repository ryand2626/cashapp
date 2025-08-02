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
  CreateUserRequest,
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

interface CreateUserModalProps {
  visible: boolean;
  onClose: () => void;
  onUserCreated: () => void;
}

const CreateUserModal: React.FC<CreateUserModalProps> = ({ visible, onClose, onUserCreated }) => {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<CreateUserRequest>({
    name: '',
    email: '',
    role: 'Restaurant Employee',
    permissions: [],
  });
  const [permissionTemplates, setPermissionTemplates] = useState<PermissionTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  const [showPermissions, setShowPermissions] = useState(false);

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
    if (visible) {
      loadPermissionTemplates();
    }
  }, [visible]);

  useEffect(() => {
    if (selectedTemplate) {
      const template = permissionTemplates.find((t) => t.id === selectedTemplate);
      if (template) {
        setFormData((prev) => ({ ...prev, permissions: template.permissions }));
      }
    }
  }, [selectedTemplate, permissionTemplates]);

  const loadPermissionTemplates = async () => {
    try {
      const templates = await userManagementService.getPermissionTemplates();
      setPermissionTemplates(templates);
    } catch (error) {
      console.error('Failed to load permission templates:', error);
    }
  };

  const handleSubmit = async () => {
    if (!formData.name.trim() || !formData.email.trim()) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    if (!formData.email.includes('@')) {
      Alert.alert('Error', 'Please enter a valid email address');
      return;
    }

    if (formData.permissions.length === 0) {
      Alert.alert('Error', 'Please select at least one permission');
      return;
    }

    try {
      setLoading(true);
      await userManagementService.createUser(formData);
      Alert.alert('Success', 'User created successfully');
      onUserCreated();
      handleClose();
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to create user');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setFormData({
      name: '',
      email: '',
      role: 'Restaurant Employee',
      permissions: [],
    });
    setSelectedTemplate('');
    setShowPermissions(false);
    onClose();
  };

  const togglePermission = (permission: Permission) => {
    setFormData((prev) => ({
      ...prev,
      permissions: prev.permissions.includes(permission)
        ? prev.permissions.filter((p) => p !== permission)
        : [...prev.permissions, permission],
    }));
  };

  const applicableTemplates = permissionTemplates.filter((template) =>
    template.applicableRoles.includes(formData.role)
  );

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
          <Text style={styles.headerTitle}>Create New User</Text>
          <TouchableOpacity
            onPress={handleSubmit}
            style={[styles.saveButton, loading && styles.saveButtonDisabled]}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator size="small" color={Colors.white} />
            ) : (
              <Text style={styles.saveButtonText}>Create</Text>
            )}
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Basic Information */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Basic Information</Text>

            <View style={styles.inputGroup}>
              <SimpleTextInput
                label="Full Name *"
                value={formData.name}
                onValueChange={(text) => setFormData((prev) => ({ ...prev, name: text }))}
                placeholder="Enter full name"
                autoCapitalize="words"
              />
            </View>

            <View style={styles.inputGroup}>
              <SimpleTextInput
                label="Email Address *"
                value={formData.email}
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
                onValueChange={(text) => setFormData((prev) => ({ ...prev, phoneNumber: text }))}
                placeholder="Enter phone number"
                keyboardType="phone-pad"
              />
            </View>
          </View>

          {/* Role Selection */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Role & Restaurant</Text>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>User Role *</Text>
              <View style={styles.roleGrid}>
                {userRoles.map((role) => (
                  <TouchableOpacity
                    key={role}
                    style={[styles.roleOption, formData.role === role && styles.roleOptionSelected]}
                    onPress={() => {
                      setFormData((prev) => ({ ...prev, role }));
                      setSelectedTemplate(''); // Reset template when role changes
                    }}
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

            {(formData.role === 'Restaurant Owner' ||
              formData.role === 'Restaurant Manager' ||
              formData.role === 'Restaurant Employee' ||
              formData.role === 'Kitchen Staff') && (
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Restaurant</Text>
                <View style={styles.restaurantGrid}>
                  {['1', '2', '3', '4'].map((id) => {
                    const restaurantNames: { [key: string]: string } = {
                      '1': 'Fynlo Coffee Shop',
                      '2': 'Fynlo Burger Bar',
                      '3': 'Fynlo Pizza Palace',
                      '4': 'Fynlo Taco Stand',
                    };

                    return (
                      <TouchableOpacity
                        key={id}
                        style={[
                          styles.restaurantOption,
                          formData.restaurantId === id && styles.restaurantOptionSelected,
                        ]}
                        onPress={() => setFormData((prev) => ({ ...prev, restaurantId: id }))}
                      >
                        <Text
                          style={[
                            styles.restaurantOptionText,
                            formData.restaurantId === id && styles.restaurantOptionTextSelected,
                          ]}
                        >
                          {restaurantNames[id]}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}
          </View>

          {/* Permission Templates */}
          {applicableTemplates.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Permission Templates</Text>
              <Text style={styles.sectionSubtitle}>Quick setup with predefined permissions</Text>

              <View style={styles.templateGrid}>
                {applicableTemplates.map((template) => (
                  <TouchableOpacity
                    key={template.id}
                    style={[
                      styles.templateOption,
                      selectedTemplate === template.id && styles.templateOptionSelected,
                    ]}
                    onPress={() => setSelectedTemplate(template.id)}
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

          {/* Permissions */}
          <View style={styles.section}>
            <TouchableOpacity
              style={styles.permissionsHeader}
              onPress={() => setShowPermissions(!showPermissions)}
            >
              <Text style={styles.sectionTitle}>
                Permissions ({formData.permissions.length} selected)
              </Text>
              <Icon
                name={showPermissions ? 'expand-less' : 'expand-more'}
                size={24}
                color={Colors.primary}
              />
            </TouchableOpacity>

            {showPermissions && (
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
                        formData.permissions.includes(permission) && styles.checkboxSelected,
                      ]}
                    >
                      {formData.permissions.includes(permission) && (
                        <Icon name="check" size={16} color={Colors.white} />
                      )}
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
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
  restaurantGrid: {
    gap: 8,
  },
  restaurantOption: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.background,
  },
  restaurantOptionSelected: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  restaurantOptionText: {
    fontSize: 14,
    color: Colors.text,
    fontWeight: '500',
  },
  restaurantOptionTextSelected: {
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
  permissionsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  permissionsList: {
    marginTop: 16,
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
});

export default CreateUserModal;
