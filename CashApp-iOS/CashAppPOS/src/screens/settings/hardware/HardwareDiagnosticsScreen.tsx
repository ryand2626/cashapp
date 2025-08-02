import React, { useState, _useEffect } from 'react';

import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
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

interface DiagnosticTest {
  id: string;
  name: string;
  description: string;
  category: 'hardware' | 'connectivity' | 'software' | 'performance';
  status: 'pending' | 'running' | 'passed' | 'failed' | 'warning';
  lastRun?: Date;
  duration?: number;
  details?: string;
  errorCode?: string;
}

interface DeviceInfo {
  deviceModel: string;
  osVersion: string;
  appVersion: string;
  storage: { total: string; used: string; free: string };
  memory: { total: string; used: string; free: string };
  battery: { level: number; isCharging: boolean };
  network: { type: string; strength: string };
}

const HardwareDiagnosticsScreen: React.FC = () => {
  const navigation = useNavigation();

  const [diagnosticTests, setDiagnosticTests] = useState<DiagnosticTest[]>([
    {
      id: 'printer_test',
      name: 'Printer Connection',
      description: 'Test printer connectivity and print quality',
      category: 'hardware',
      status: 'passed',
      lastRun: new Date(Date.now() - 3600000), // 1 hour ago
      duration: 15,
      details: 'All printers connected and responding',
    },
    {
      id: 'cash_drawer_test',
      name: 'Cash Drawer',
      description: 'Test cash drawer opening mechanism',
      category: 'hardware',
      status: 'passed',
      lastRun: new Date(Date.now() - 3600000),
      duration: 5,
      details: 'Drawer opens and closes properly',
    },
    {
      id: 'scanner_test',
      name: 'Barcode Scanner',
      description: 'Test barcode scanning accuracy',
      category: 'hardware',
      status: 'warning',
      lastRun: new Date(Date.now() - 7200000), // 2 hours ago
      duration: 10,
      details: 'Scanner works but battery low (23%)',
    },
    {
      id: 'card_reader_test',
      name: 'Card Reader',
      description: 'Test card reader functionality',
      category: 'hardware',
      status: 'passed',
      lastRun: new Date(Date.now() - 1800000), // 30 minutes ago
      duration: 20,
      details: 'All payment methods working correctly',
    },
    {
      id: 'network_test',
      name: 'Network Connectivity',
      description: 'Test internet connection and speed',
      category: 'connectivity',
      status: 'passed',
      lastRun: new Date(Date.now() - 600000), // 10 minutes ago
      duration: 8,
      details: 'WiFi: 45 Mbps download, 12 Mbps upload',
    },
    {
      id: 'bluetooth_test',
      name: 'Bluetooth Connectivity',
      description: 'Test Bluetooth device connections',
      category: 'connectivity',
      status: 'failed',
      lastRun: new Date(Date.now() - 3600000),
      duration: 12,
      details: 'Unable to connect to handheld scanner',
      errorCode: 'BT_CONN_TIMEOUT',
    },
    {
      id: 'database_test',
      name: 'Database Integrity',
      description: 'Check local database for corruption',
      category: 'software',
      status: 'passed',
      lastRun: new Date(Date.now() - 10800000), // 3 hours ago
      duration: 35,
      details: 'Database healthy, no corruption detected',
    },
    {
      id: 'performance_test',
      name: 'System Performance',
      description: 'Check CPU, memory, and storage usage',
      category: 'performance',
      status: 'warning',
      lastRun: new Date(Date.now() - 900000), // 15 minutes ago
      duration: 25,
      details: 'Memory usage high (87%), consider restart',
    },
  ]);

  const [deviceInfo] = useState<DeviceInfo>({
    deviceModel: 'iPad Pro 12.9" (6th gen)',
    osVersion: 'iOS 17.2.1',
    appVersion: '2.1.4 (Build 127)',
    storage: { total: '256 GB', used: '128 GB', free: '128 GB' },
    memory: { total: '8 GB', used: '6.9 GB', free: '1.1 GB' },
    battery: { level: 78, isCharging: false },
    network: { type: 'WiFi', strength: 'Excellent' },
  });

  const [runningTests, setRunningTests] = useState<Set<string>>(new Set());
  const [runningFullDiagnostic, setRunningFullDiagnostic] = useState(false);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'passed':
        return Colors.success;
      case 'failed':
        return Colors.danger;
      case 'warning':
        return Colors.warning;
      case 'running':
        return Colors.secondary;
      default:
        return Colors.mediumGray;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'passed':
        return 'check-circle';
      case 'failed':
        return 'error';
      case 'warning':
        return 'warning';
      case 'running':
        return 'sync';
      default:
        return 'radio-button-unchecked';
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'hardware':
        return 'memory';
      case 'connectivity':
        return 'wifi';
      case 'software':
        return 'code';
      case 'performance':
        return 'speed';
      default:
        return 'help';
    }
  };

  const runSingleTest = async (testId: string) => {
    setRunningTests((prev) => new Set(prev).add(testId));

    // Update test status to running
    setDiagnosticTests((prev) =>
      prev.map((test) => (test.id === testId ? { ...test, status: 'running' } : test))
    );

    // Simulate test execution
    const testDuration = Math.random() * 10000 + 2000; // 2-12 seconds

    setTimeout(() => {
      const outcomes = ['passed', 'failed', 'warning'];
      const randomOutcome = outcomes[Math.floor(Math.random() * outcomes.length)] as unknown;

      setDiagnosticTests((prev) =>
        prev.map((test) =>
          test.id === testId
            ? {
                ...test,
                status: randomOutcome,
                lastRun: new Date(),
                duration: Math.floor(testDuration / 1000),
                details:
                  randomOutcome === 'passed'
                    ? 'Test completed successfully'
                    : randomOutcome === 'warning'
                    ? 'Test passed with warnings'
                    : 'Test failed - check configuration',
              }
            : test
        )
      );

      setRunningTests((prev) => {
        const newSet = new Set(prev);
        newSet.delete(testId);
        return newSet;
      });
    }, testDuration);
  };

  const runFullDiagnostic = async () => {
    setRunningFullDiagnostic(true);

    // Run all tests sequentially
    for (const test of diagnosticTests) {
      await new Promise((resolve) => {
        runSingleTest(test.id);
        setTimeout(resolve, 1000); // Small delay between tests
      });
    }

    setTimeout(() => {
      setRunningFullDiagnostic(false);
      Alert.alert(
        'Diagnostic Complete',
        'Full system diagnostic completed. Check individual test results for details.',
        [{ text: 'OK' }]
      );
    }, diagnosticTests.length * 1000 + 5000);
  };

  const exportDiagnosticReport = () => {
    Alert.alert('Export Report', 'Export diagnostic report for technical support?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Export',
        onPress: () => {
          Alert.alert('Success', 'Diagnostic report exported to device storage.');
        },
      },
    ]);
  };

  const getTestsSummary = () => {
    const passed = diagnosticTests.filter((t) => t.status === 'passed').length;
    const failed = diagnosticTests.filter((t) => t.status === 'failed').length;
    const warnings = diagnosticTests.filter((t) => t.status === 'warning').length;
    const pending = diagnosticTests.filter((t) => t.status === 'pending').length;

    return { passed, failed, warnings, pending };
  };

  const summary = getTestsSummary();

  const DiagnosticCard = ({ test }: { test: DiagnosticTest }) => (
    <View style={styles.testCard}>
      <View style={styles.testHeader}>
        <View style={styles.testInfo}>
          <View style={styles.testTitleRow}>
            <Icon name={getCategoryIcon(test.category)} size={20} color={Colors.primary} />
            <Text style={styles.testName}>{test.name}</Text>
          </View>
          <Text style={styles.testDescription}>{test.description}</Text>
          {test.details && <Text style={styles.testDetails}>{test.details}</Text>}
          {test.errorCode && <Text style={styles.errorCode}>Error: {test.errorCode}</Text>}
          <View style={styles.testMeta}>
            {test.lastRun && (
              <Text style={styles.lastRun}>Last run: {test.lastRun.toLocaleTimeString()}</Text>
            )}
            {test.duration && <Text style={styles.duration}>Duration: {test.duration}s</Text>}
          </View>
        </View>

        <View style={styles.testActions}>
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(test.status) }]}>
            {test.status === 'running' || runningTests.has(test.id) ? (
              <ActivityIndicator size="small" color={Colors.white} />
            ) : (
              <Icon name={getStatusIcon(test.status)} size={12} color={Colors.white} />
            )}
            <Text style={styles.statusText}>
              {runningTests.has(test.id) ? 'RUNNING' : test.status.toUpperCase()}
            </Text>
          </View>

          <TouchableOpacity
            style={[styles.runButton, runningTests.has(test.id) && styles.runButtonDisabled]}
            onPress={() => runSingleTest(test.id)}
            disabled={runningTests.has(test.id) || runningFullDiagnostic}
          >
            <Icon
              name={runningTests.has(test.id) ? 'hourglass-empty' : 'play-arrow'}
              size={16}
              color={runningTests.has(test.id) ? Colors.mediumGray : Colors.primary}
            />
            <Text
              style={[
                styles.runButtonText,
                runningTests.has(test.id) && styles.runButtonTextDisabled,
              ]}
            >
              {runningTests.has(test.id) ? 'Running...' : 'Run Test'}
            </Text>
          </TouchableOpacity>
        </View>
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
        <Text style={styles.headerTitle}>Hardware Diagnostics</Text>
        <TouchableOpacity style={styles.exportButton} onPress={exportDiagnosticReport}>
          <Icon name="file-download" size={24} color={Colors.white} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Summary */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>System Status</Text>
          <View style={styles.summaryCard}>
            <View style={styles.summaryRow}>
              <View style={styles.summaryItem}>
                <Icon name="check-circle" size={24} color={Colors.success} />
                <Text style={styles.summaryCount}>{summary.passed}</Text>
                <Text style={styles.summaryLabel}>Passed</Text>
              </View>
              <View style={styles.summaryItem}>
                <Icon name="warning" size={24} color={Colors.warning} />
                <Text style={styles.summaryCount}>{summary.warnings}</Text>
                <Text style={styles.summaryLabel}>Warnings</Text>
              </View>
              <View style={styles.summaryItem}>
                <Icon name="error" size={24} color={Colors.danger} />
                <Text style={styles.summaryCount}>{summary.failed}</Text>
                <Text style={styles.summaryLabel}>Failed</Text>
              </View>
              <View style={styles.summaryItem}>
                <Icon name="radio-button-unchecked" size={24} color={Colors.mediumGray} />
                <Text style={styles.summaryCount}>{summary.pending}</Text>
                <Text style={styles.summaryLabel}>Pending</Text>
              </View>
            </View>

            <TouchableOpacity
              style={[
                styles.fullDiagnosticButton,
                runningFullDiagnostic && styles.fullDiagnosticButtonDisabled,
              ]}
              onPress={runFullDiagnostic}
              disabled={runningFullDiagnostic || runningTests.size > 0}
            >
              {runningFullDiagnostic ? (
                <ActivityIndicator size="small" color={Colors.white} />
              ) : (
                <Icon name="play-circle-filled" size={20} color={Colors.white} />
              )}
              <Text style={styles.fullDiagnosticButtonText}>
                {runningFullDiagnostic ? 'Running Full Diagnostic...' : 'Run Full Diagnostic'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Device Information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Device Information</Text>
          <View style={styles.deviceInfoCard}>
            <View style={styles.deviceInfoRow}>
              <Text style={styles.deviceInfoLabel}>Device:</Text>
              <Text style={styles.deviceInfoValue}>{deviceInfo.deviceModel}</Text>
            </View>
            <View style={styles.deviceInfoRow}>
              <Text style={styles.deviceInfoLabel}>OS Version:</Text>
              <Text style={styles.deviceInfoValue}>{deviceInfo.osVersion}</Text>
            </View>
            <View style={styles.deviceInfoRow}>
              <Text style={styles.deviceInfoLabel}>App Version:</Text>
              <Text style={styles.deviceInfoValue}>{deviceInfo.appVersion}</Text>
            </View>
            <View style={styles.deviceInfoRow}>
              <Text style={styles.deviceInfoLabel}>Storage:</Text>
              <Text style={styles.deviceInfoValue}>
                {deviceInfo.storage.used} / {deviceInfo.storage.total} used
              </Text>
            </View>
            <View style={styles.deviceInfoRow}>
              <Text style={styles.deviceInfoLabel}>Memory:</Text>
              <Text style={styles.deviceInfoValue}>
                {deviceInfo.memory.used} / {deviceInfo.memory.total} used
              </Text>
            </View>
            <View style={styles.deviceInfoRow}>
              <Text style={styles.deviceInfoLabel}>Battery:</Text>
              <Text style={styles.deviceInfoValue}>
                {deviceInfo.battery.level}% {deviceInfo.battery.isCharging ? '(Charging)' : ''}
              </Text>
            </View>
            <View style={styles.deviceInfoRow}>
              <Text style={styles.deviceInfoLabel}>Network:</Text>
              <Text style={styles.deviceInfoValue}>
                {deviceInfo.network.type} - {deviceInfo.network.strength}
              </Text>
            </View>
          </View>
        </View>

        {/* Diagnostic Tests */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Diagnostic Tests</Text>
          {diagnosticTests.map((test) => (
            <DiagnosticCard key={test.id} test={test} />
          ))}
        </View>

        {/* Help Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Diagnostic Help</Text>
          <View style={styles.helpCard}>
            <View style={styles.helpItem}>
              <Icon name="info-outline" size={20} color={Colors.secondary} />
              <Text style={styles.helpText}>
                Run diagnostics regularly to ensure optimal system performance.
              </Text>
            </View>
            <View style={styles.helpItem}>
              <Icon name="warning" size={20} color={Colors.warning} />
              <Text style={styles.helpText}>
                Failed tests may indicate hardware issues requiring technical support.
              </Text>
            </View>
            <View style={styles.helpItem}>
              <Icon name="file-download" size={20} color={Colors.secondary} />
              <Text style={styles.helpText}>
                Export diagnostic reports when contacting support for faster troubleshooting.
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>
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
  exportButton: {
    padding: 8,
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
  summaryCard: {
    paddingHorizontal: 16,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 20,
  },
  summaryItem: {
    alignItems: 'center',
    flex: 1,
  },
  summaryCount: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.text,
    marginTop: 8,
  },
  summaryLabel: {
    fontSize: 12,
    color: Colors.lightText,
    marginTop: 4,
  },
  fullDiagnosticButton: {
    backgroundColor: Colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
  },
  fullDiagnosticButtonDisabled: {
    backgroundColor: Colors.mediumGray,
  },
  fullDiagnosticButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.white,
  },
  deviceInfoCard: {
    paddingHorizontal: 16,
  },
  deviceInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.lightGray,
  },
  deviceInfoLabel: {
    fontSize: 14,
    color: Colors.lightText,
  },
  deviceInfoValue: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.text,
  },
  testCard: {
    backgroundColor: Colors.background,
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  testHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  testInfo: {
    flex: 1,
    marginRight: 16,
  },
  testTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  testName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
  },
  testDescription: {
    fontSize: 14,
    color: Colors.lightText,
    marginBottom: 8,
  },
  testDetails: {
    fontSize: 14,
    color: Colors.text,
    marginBottom: 4,
  },
  errorCode: {
    fontSize: 12,
    color: Colors.danger,
    fontFamily: 'monospace',
    marginBottom: 8,
  },
  testMeta: {
    flexDirection: 'row',
    gap: 16,
  },
  lastRun: {
    fontSize: 12,
    color: Colors.lightText,
  },
  duration: {
    fontSize: 12,
    color: Colors.lightText,
  },
  testActions: {
    alignItems: 'flex-end',
    gap: 8,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '600',
    color: Colors.white,
  },
  runButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: Colors.white,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Colors.primary,
    gap: 4,
  },
  runButtonDisabled: {
    borderColor: Colors.mediumGray,
  },
  runButtonText: {
    fontSize: 12,
    fontWeight: '500',
    color: Colors.primary,
  },
  runButtonTextDisabled: {
    color: Colors.mediumGray,
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
});

export default HardwareDiagnosticsScreen;
