import React, { useState } from 'react';

import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  Alert,
  Switch,
  ActivityIndicator,
  Modal,
} from 'react-native';

import { useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialIcons';

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

interface BackupInfo {
  id: string;
  name: string;
  type: 'automatic' | 'manual';
  size: string;
  date: Date;
  status: 'completed' | 'failed' | 'in_progress';
  location: 'local' | 'cloud';
  includes: string[];
}

const BackupRestoreScreen: React.FC = () => {
  const navigation = useNavigation();

  const [backups, setBackups] = useState<BackupInfo[]>([
    {
      id: 'backup1',
      name: 'Daily Backup - Dec 17',
      type: 'automatic',
      size: '45.2 MB',
      date: new Date(),
      status: 'completed',
      location: 'cloud',
      includes: ['transactions', 'menu', 'customers', 'employees', 'settings'],
    },
    {
      id: 'backup2',
      name: 'Manual Backup - Dec 16',
      type: 'manual',
      size: '44.8 MB',
      date: new Date(Date.now() - 24 * 60 * 60 * 1000),
      status: 'completed',
      location: 'local',
      includes: ['transactions', 'menu', 'customers', 'settings'],
    },
    {
      id: 'backup3',
      name: 'Weekly Backup - Dec 15',
      type: 'automatic',
      size: '187.5 MB',
      date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      status: 'completed',
      location: 'cloud',
      includes: ['transactions', 'menu', 'customers', 'employees', 'settings', 'reports'],
    },
  ]);

  // Backup settings
  const [backupSettings, setBackupSettings] = useState({
    autoBackupEnabled: true,
    dailyBackup: true,
    weeklyBackup: true,
    cloudBackupEnabled: true,
    localBackupEnabled: true,
    encryptBackups: true,
    compressBackups: true,
    retainBackups: 30,
  });

  const [isCreatingBackup, setIsCreatingBackup] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [showRestoreModal, setShowRestoreModal] = useState(false);
  const [selectedBackup, setSelectedBackup] = useState<BackupInfo | null>(null);

  const handleCreateBackup = async () => {
    setIsCreatingBackup(true);

    try {
      // Simulate backup creation
      await new Promise((resolve) => setTimeout(resolve, 3000));

      const newBackup: BackupInfo = {
        id: Date.now().toString(),
        name: `Manual Backup - ${new Date().toLocaleDateString()}`,
        type: 'manual',
        size: '45.7 MB',
        date: new Date(),
        status: 'completed',
        location: backupSettings.cloudBackupEnabled ? 'cloud' : 'local',
        includes: ['transactions', 'menu', 'customers', 'employees', 'settings'],
      };

      setBackups((prev) => [newBackup, ...prev]);
      Alert.alert('Success', 'Backup created successfully!');
    } catch (error) {
      Alert.alert('Error', 'Failed to create backup. Please try again.');
    } finally {
      setIsCreatingBackup(false);
    }
  };

  const handleRestoreBackup = async (backup: BackupInfo) => {
    setSelectedBackup(backup);
    setShowRestoreModal(true);
  };

  const confirmRestore = async () => {
    if (!selectedBackup) return;

    setIsRestoring(true);
    setShowRestoreModal(false);

    try {
      // Simulate restore process
      await new Promise((resolve) => setTimeout(resolve, 5000));

      Alert.alert(
        'Restore Complete',
        `Data has been restored from "${selectedBackup.name}". The app will restart to apply changes.`,
        [{ text: 'OK' }]
      );
    } catch (error) {
      Alert.alert('Error', 'Failed to restore backup. Please try again.');
    } finally {
      setIsRestoring(false);
      setSelectedBackup(null);
    }
  };

  const handleDeleteBackup = (backupId: string) => {
    const backup = backups.find((b) => b.id === backupId);
    Alert.alert('Delete Backup', `Delete "${backup?.name}"? This action cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          setBackups((prev) => prev.filter((b) => b.id !== backupId));
        },
      },
    ]);
  };

  const handleImportBackup = () => {
    Alert.alert('Import Backup', 'Select backup file to import:', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'From Device',
        onPress: () => {
          Alert.alert('Info', 'File picker would open here');
        },
      },
      {
        text: 'From Cloud',
        onPress: () => {
          Alert.alert('Info', 'Cloud file browser would open here');
        },
      },
    ]);
  };

  const toggleBackupSetting = (setting: keyof typeof backupSettings) => {
    setBackupSettings((prev) => ({
      ...prev,
      [setting]: !prev[setting],
    }));
  };

  const getBackupStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return Colors.success;
      case 'failed':
        return Colors.danger;
      case 'in_progress':
        return Colors.warning;
      default:
        return Colors.mediumGray;
    }
  };

  const getBackupStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return 'check-circle';
      case 'failed':
        return 'error';
      case 'in_progress':
        return 'sync';
      default:
        return 'help';
    }
  };

  const getLocationIcon = (location: string) => {
    return location === 'cloud' ? 'cloud' : 'phone-android';
  };

  const getTotalBackupSize = () => {
    return backups
      .reduce((total, backup) => {
        const size = parseFloat(backup.size.replace(' MB', ''));
        return total + size;
      }, 0)
      .toFixed(1);
  };

  const BackupCard = ({ backup }: { backup: BackupInfo }) => (
    <View style={styles.backupCard}>
      <View style={styles.backupHeader}>
        <View style={styles.backupInfo}>
          <View style={styles.backupTitleRow}>
            <Icon
              name={backup.type === 'automatic' ? 'schedule' : 'save'}
              size={20}
              color={Colors.primary}
            />
            <Text style={styles.backupName}>{backup.name}</Text>
            <View
              style={[styles.statusBadge, { backgroundColor: getBackupStatusColor(backup.status) }]}
            >
              <Icon name={getBackupStatusIcon(backup.status)} size={12} color={Colors.white} />
            </View>
          </View>

          <View style={styles.backupDetails}>
            <View style={styles.backupDetailRow}>
              <Icon name={getLocationIcon(backup.location)} size={16} color={Colors.lightText} />
              <Text style={styles.backupDetailText}>
                {backup.location === 'cloud' ? 'Cloud Storage' : 'Local Storage'}
              </Text>
            </View>

            <View style={styles.backupDetailRow}>
              <Icon name="storage" size={16} color={Colors.lightText} />
              <Text style={styles.backupDetailText}>{backup.size}</Text>
            </View>

            <View style={styles.backupDetailRow}>
              <Icon name="schedule" size={16} color={Colors.lightText} />
              <Text style={styles.backupDetailText}>
                {backup.date.toLocaleDateString()} at {backup.date.toLocaleTimeString()}
              </Text>
            </View>
          </View>

          <View style={styles.backupIncludes}>
            <Text style={styles.includesLabel}>Includes:</Text>
            <View style={styles.includesTags}>
              {backup.includes.map((item) => (
                <View key={item} style={styles.includeTag}>
                  <Text style={styles.includeTagText}>{item}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>
      </View>

      <View style={styles.backupActions}>
        <TouchableOpacity
          style={[styles.backupButton, styles.restoreButton]}
          onPress={() => handleRestoreBackup(backup)}
          disabled={backup.status !== 'completed' || isRestoring}
        >
          <Icon name="restore" size={16} color={Colors.secondary} />
          <Text style={styles.restoreButtonText}>Restore</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.backupButton}
          onPress={() => Alert.alert('Info', `Download ${backup.name}`)}
        >
          <Icon name="file-download" size={16} color={Colors.success} />
          <Text style={styles.backupButtonText}>Download</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.backupButton, styles.deleteButton]}
          onPress={() => handleDeleteBackup(backup.id)}
        >
          <Icon name="delete" size={16} color={Colors.danger} />
          <Text style={styles.deleteButtonText}>Delete</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Icon name="arrow-back" size={24} color={Colors.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Backup & Restore</Text>
        <TouchableOpacity
          style={styles.createBackupButton}
          onPress={handleCreateBackup}
          disabled={isCreatingBackup}
        >
          <Icon
            name={isCreatingBackup ? 'hourglass-empty' : 'backup'}
            size={24}
            color={Colors.white}
          />
        </TouchableOpacity>
      </View>

      {/* Loading Overlay */}
      {(isCreatingBackup || isRestoring) && (
        <View style={styles.loadingOverlay}>
          <View style={styles.loadingContent}>
            <ActivityIndicator size="large" color={Colors.primary} />
            <Text style={styles.loadingText}>
              {isCreatingBackup ? 'Creating backup...' : 'Restoring data...'}
            </Text>
          </View>
        </View>
      )}

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Quick Stats */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Backup Overview</Text>
          <View style={styles.statsContainer}>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{backups.length}</Text>
              <Text style={styles.statLabel}>Total Backups</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{getTotalBackupSize()} MB</Text>
              <Text style={styles.statLabel}>Storage Used</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>
                {backups
                  .find((b) => b.type === 'automatic' && b.status === 'completed')
                  ?.date.toLocaleDateString() || 'Never'}
              </Text>
              <Text style={styles.statLabel}>Last Auto Backup</Text>
            </View>
          </View>
        </View>

        {/* Quick Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.quickActions}>
            <TouchableOpacity
              style={[
                styles.quickActionButton,
                isCreatingBackup && styles.quickActionButtonDisabled,
              ]}
              onPress={handleCreateBackup}
              disabled={isCreatingBackup}
            >
              <Icon
                name={isCreatingBackup ? 'hourglass-empty' : 'backup'}
                size={32}
                color={isCreatingBackup ? Colors.mediumGray : Colors.primary}
              />
              <Text
                style={[styles.quickActionText, isCreatingBackup && styles.quickActionTextDisabled]}
              >
                {isCreatingBackup ? 'Creating...' : 'Create Backup'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.quickActionButton} onPress={handleImportBackup}>
              <Icon name="file-upload" size={32} color={Colors.secondary} />
              <Text style={styles.quickActionText}>Import Backup</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickActionButton}
              onPress={() => Alert.alert('Info', 'Backup schedule configuration would open here')}
            >
              <Icon name="schedule" size={32} color={Colors.success} />
              <Text style={styles.quickActionText}>Schedule</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Backup List */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Available Backups</Text>
          {backups.map((backup) => (
            <BackupCard key={backup.id} backup={backup} />
          ))}

          {backups.length === 0 && (
            <View style={styles.emptyState}>
              <Icon name="backup" size={48} color={Colors.lightGray} />
              <Text style={styles.emptyStateText}>No backups available</Text>
              <TouchableOpacity style={styles.emptyStateButton} onPress={handleCreateBackup}>
                <Text style={styles.emptyStateButtonText}>Create First Backup</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Backup Settings */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Backup Settings</Text>
          <View style={styles.settingsCard}>
            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingLabel}>Automatic backups</Text>
                <Text style={styles.settingDescription}>
                  Create backups automatically on schedule
                </Text>
              </View>
              <Switch
                value={backupSettings.autoBackupEnabled}
                onValueChange={() => toggleBackupSetting('autoBackupEnabled')}
                trackColor={{ false: Colors.lightGray, true: Colors.primary }}
                thumbColor={Colors.white}
              />
            </View>

            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingLabel}>Daily backups</Text>
                <Text style={styles.settingDescription}>Create backup every day at 3 AM</Text>
              </View>
              <Switch
                value={backupSettings.dailyBackup && backupSettings.autoBackupEnabled}
                onValueChange={() => toggleBackupSetting('dailyBackup')}
                disabled={!backupSettings.autoBackupEnabled}
                trackColor={{ false: Colors.lightGray, true: Colors.primary }}
                thumbColor={Colors.white}
              />
            </View>

            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingLabel}>Weekly backups</Text>
                <Text style={styles.settingDescription}>
                  Create comprehensive backup every Sunday
                </Text>
              </View>
              <Switch
                value={backupSettings.weeklyBackup && backupSettings.autoBackupEnabled}
                onValueChange={() => toggleBackupSetting('weeklyBackup')}
                disabled={!backupSettings.autoBackupEnabled}
                trackColor={{ false: Colors.lightGray, true: Colors.primary }}
                thumbColor={Colors.white}
              />
            </View>

            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingLabel}>Cloud backup</Text>
                <Text style={styles.settingDescription}>Store backups in secure cloud storage</Text>
              </View>
              <Switch
                value={backupSettings.cloudBackupEnabled}
                onValueChange={() => toggleBackupSetting('cloudBackupEnabled')}
                trackColor={{ false: Colors.lightGray, true: Colors.primary }}
                thumbColor={Colors.white}
              />
            </View>

            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingLabel}>Encrypt backups</Text>
                <Text style={styles.settingDescription}>Protect backups with encryption</Text>
              </View>
              <Switch
                value={backupSettings.encryptBackups}
                onValueChange={() => toggleBackupSetting('encryptBackups')}
                trackColor={{ false: Colors.lightGray, true: Colors.primary }}
                thumbColor={Colors.white}
              />
            </View>
          </View>
        </View>

        {/* Help Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Backup Information</Text>
          <View style={styles.helpCard}>
            <View style={styles.helpItem}>
              <Icon name="info-outline" size={20} color={Colors.secondary} />
              <Text style={styles.helpText}>
                Backups include all your business data: transactions, menu items, customer
                information, and settings.
              </Text>
            </View>
            <View style={styles.helpItem}>
              <Icon name="security" size={20} color={Colors.success} />
              <Text style={styles.helpText}>
                All backups are encrypted and stored securely. Your data is always protected.
              </Text>
            </View>
            <View style={styles.helpItem}>
              <Icon name="schedule" size={20} color={Colors.warning} />
              <Text style={styles.helpText}>
                Regular backups ensure you never lose important business data. Enable automatic
                backups for peace of mind.
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Restore Confirmation Modal */}
      <Modal
        visible={showRestoreModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowRestoreModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Icon name="warning" size={32} color={Colors.warning} />
              <Text style={styles.modalTitle}>Restore Data</Text>
            </View>

            <View style={styles.modalBody}>
              <Text style={styles.modalText}>
                This will restore your data from "{selectedBackup?.name}".
              </Text>
              <Text style={styles.modalWarning}>
                ⚠️ Current data will be overwritten and cannot be recovered. Consider creating a
                backup first.
              </Text>
              <Text style={styles.modalSubtext}>
                The app will restart after the restore is complete.
              </Text>
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setShowRestoreModal(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.confirmButton} onPress={confirmRestore}>
                <Text style={styles.confirmButtonText}>Restore</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
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
    paddingVertical: 12,
    paddingTop: 48,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.white,
  },
  createBackupButton: {
    padding: 8,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  loadingContent: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 32,
    alignItems: 'center',
    gap: 16,
  },
  loadingText: {
    fontSize: 16,
    fontWeight: '500',
    color: Colors.text,
  },
  content: {
    flex: 1,
  },
  section: {
    backgroundColor: Colors.white,
    marginVertical: 8,
    paddingVertical: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text,
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  statsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 16,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 16,
    backgroundColor: Colors.background,
    borderRadius: 8,
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.primary,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: Colors.lightText,
    textAlign: 'center',
  },
  quickActions: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 16,
  },
  quickActionButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 20,
    backgroundColor: Colors.background,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  quickActionButtonDisabled: {
    opacity: 0.5,
  },
  quickActionText: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.text,
    marginTop: 8,
    textAlign: 'center',
  },
  quickActionTextDisabled: {
    color: Colors.mediumGray,
  },
  backupCard: {
    backgroundColor: Colors.background,
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  backupHeader: {
    marginBottom: 16,
  },
  backupInfo: {
    flex: 1,
  },
  backupTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  backupName: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text,
    flex: 1,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  backupDetails: {
    gap: 8,
    marginBottom: 12,
  },
  backupDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  backupDetailText: {
    fontSize: 14,
    color: Colors.lightText,
  },
  backupIncludes: {
    marginTop: 8,
  },
  includesLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.text,
    marginBottom: 8,
  },
  includesTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  includeTag: {
    backgroundColor: Colors.primary + '20',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  includeTagText: {
    fontSize: 12,
    fontWeight: '500',
    color: Colors.primary,
  },
  backupActions: {
    flexDirection: 'row',
    gap: 8,
  },
  backupButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: Colors.white,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 4,
  },
  restoreButton: {
    borderColor: Colors.secondary,
  },
  restoreButtonText: {
    fontSize: 12,
    fontWeight: '500',
    color: Colors.secondary,
  },
  backupButtonText: {
    fontSize: 12,
    fontWeight: '500',
    color: Colors.text,
  },
  deleteButton: {
    borderColor: Colors.danger,
  },
  deleteButtonText: {
    fontSize: 12,
    fontWeight: '500',
    color: Colors.danger,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 24,
  },
  emptyStateText: {
    fontSize: 16,
    color: Colors.lightText,
    marginTop: 16,
    marginBottom: 16,
  },
  emptyStateButton: {
    backgroundColor: Colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  emptyStateButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: Colors.white,
  },
  settingsCard: {
    paddingHorizontal: 16,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.lightGray,
  },
  settingInfo: {
    flex: 1,
    marginRight: 16,
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: Colors.text,
    marginBottom: 4,
  },
  settingDescription: {
    fontSize: 14,
    color: Colors.lightText,
  },
  helpCard: {
    paddingHorizontal: 16,
  },
  helpItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 12,
    gap: 12,
  },
  helpText: {
    flex: 1,
    fontSize: 14,
    color: Colors.lightText,
    lineHeight: 20,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 24,
    margin: 24,
    maxWidth: 400,
  },
  modalHeader: {
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.text,
    marginTop: 8,
  },
  modalBody: {
    marginBottom: 24,
  },
  modalText: {
    fontSize: 16,
    color: Colors.text,
    textAlign: 'center',
    marginBottom: 16,
  },
  modalWarning: {
    fontSize: 14,
    color: Colors.danger,
    textAlign: 'center',
    marginBottom: 12,
    lineHeight: 20,
  },
  modalSubtext: {
    fontSize: 14,
    color: Colors.lightText,
    textAlign: 'center',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 12,
    backgroundColor: Colors.background,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: Colors.text,
  },
  confirmButton: {
    flex: 1,
    paddingVertical: 12,
    backgroundColor: Colors.danger,
    borderRadius: 8,
    alignItems: 'center',
  },
  confirmButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: Colors.white,
  },
});

export default BackupRestoreScreen;
