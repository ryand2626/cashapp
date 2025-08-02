// APITestScreen.tsx - Developer API testing interface
import React, { useState, useEffect } from 'react';

import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';

import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialIcons';

import { Colors, Typography } from '../../design-system/theme';
import APITestingService from '../../services/APITestingService';

import type { APITestResult, APITestSuite } from '../../services/APITestingService';

/**
 * APITestScreen - Developer interface for testing backend APIs
 *
 * Features:
 * - Test individual endpoints
 * - Run comprehensive test suites
 * - View test results and history
 * - Monitor API health status
 * - Export test reports
 */
const APITestScreen: React.FC = () => {
  const [apiTestService] = useState(() => APITestingService.getInstance());
  const [testResults, setTestResults] = useState<APITestResult[]>([]);
  const [testSuites, setTestSuites] = useState<APITestSuite[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedTab, setSelectedTab] = useState<'results' | 'suites' | 'health'>('health');

  useEffect(() => {
    loadTestData();
  }, []);

  const loadTestData = async () => {
    setTestResults(apiTestService.getTestResults());
    setTestSuites(apiTestService.getTestSuites());
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadTestData();
    setRefreshing(false);
  };

  const runFullTestSuite = async () => {
    setIsRunning(true);
    try {
      await apiTestService.runFullAPITestSuite();
      await loadTestData();
      Alert.alert('Test Complete', 'API test suite finished. Check results below.');
    } catch (error) {
      Alert.alert('Test Failed', 'Error running API test suite');
    } finally {
      setIsRunning(false);
    }
  };

  const testIndividualEndpoint = async (endpoint: string, method: string = 'GET') => {
    setIsRunning(true);
    try {
      await apiTestService.testEndpoint(endpoint, method);
      await loadTestData();
    } catch (error) {
      Alert.alert('Test Failed', `Error testing ${endpoint}`);
    } finally {
      setIsRunning(false);
    }
  };

  const clearTestHistory = async () => {
    Alert.alert('Clear Test History', 'Are you sure you want to clear all test results?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear',
        style: 'destructive',
        onPress: async () => {
          await apiTestService.clearTestHistory();
          await loadTestData();
        },
      },
    ]);
  };

  const getStatusColor = (success: boolean) => {
    return success ? Colors.success : Colors.error;
  };

  const getStatusIcon = (success: boolean) => {
    return success ? 'check-circle' : 'error';
  };

  const renderHealthTab = () => {
    const health = apiTestService.getAPIHealthSummary();

    return (
      <View style={styles.tabContent}>
        <View style={styles.healthCard}>
          <Text style={styles.cardTitle}>API Health Summary</Text>

          <View style={styles.healthRow}>
            <Text style={styles.healthLabel}>Total Tests:</Text>
            <Text style={styles.healthValue}>{health.totalTests}</Text>
          </View>

          <View style={styles.healthRow}>
            <Text style={styles.healthLabel}>Successful:</Text>
            <Text style={[styles.healthValue, { color: Colors.success }]}>
              {health.successfulTests}
            </Text>
          </View>

          <View style={styles.healthRow}>
            <Text style={styles.healthLabel}>Failed:</Text>
            <Text style={[styles.healthValue, { color: Colors.error }]}>{health.failedTests}</Text>
          </View>

          <View style={styles.healthRow}>
            <Text style={styles.healthLabel}>Success Rate:</Text>
            <Text
              style={[
                styles.healthValue,
                { color: health.successRate > 80 ? Colors.success : Colors.error },
              ]}
            >
              {health.successRate.toFixed(1)}%
            </Text>
          </View>

          {health.lastTestTime && (
            <View style={styles.healthRow}>
              <Text style={styles.healthLabel}>Last Test:</Text>
              <Text style={styles.healthValue}>{health.lastTestTime.toLocaleTimeString()}</Text>
            </View>
          )}
        </View>

        <View style={styles.quickTestsCard}>
          <Text style={styles.cardTitle}>Quick Tests</Text>

          <TouchableOpacity
            style={styles.testButton}
            onPress={() => testIndividualEndpoint('/health')}
            disabled={isRunning}
          >
            <Icon name="healing" size={20} color={Colors.white} />
            <Text style={styles.testButtonText}>Test Backend Health</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.testButton}
            onPress={() => testIndividualEndpoint('/api/v1/products/mobile')}
            disabled={isRunning}
          >
            <Icon name="restaurant-menu" size={20} color={Colors.white} />
            <Text style={styles.testButtonText}>Test Products API</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.testButton}
            onPress={() => testIndividualEndpoint('/api/v1/pos/sessions/current')}
            disabled={isRunning}
          >
            <Icon name="point-of-sale" size={20} color={Colors.white} />
            <Text style={styles.testButtonText}>Test POS Sessions</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderResultsTab = () => {
    return (
      <View style={styles.tabContent}>
        {testResults.length === 0 ? (
          <View style={styles.emptyState}>
            <Icon name="science" size={64} color={Colors.textSecondary} />
            <Text style={styles.emptyText}>No test results yet</Text>
            <Text style={styles.emptySubtext}>Run some API tests to see results here</Text>
          </View>
        ) : (
          testResults
            .slice()
            .reverse()
            .map((result, index) => (
              <View key={index} style={styles.resultCard}>
                <View style={styles.resultHeader}>
                  <View style={styles.resultMethod}>
                    <Text style={styles.methodText}>{result.method}</Text>
                  </View>
                  <Text style={styles.resultEndpoint}>{result.endpoint}</Text>
                  <Icon
                    name={getStatusIcon(result.success)}
                    size={24}
                    color={getStatusColor(result.success)}
                  />
                </View>

                <View style={styles.resultDetails}>
                  <Text style={styles.resultTime}>
                    {result.timestamp.toLocaleTimeString()}
                    {result.responseTime && ` • ${result.responseTime}ms`}
                  </Text>

                  {result.status && (
                    <Text
                      style={[
                        styles.resultStatus,
                        { color: result.success ? Colors.success : Colors.error },
                      ]}
                    >
                      Status: {result.status}
                    </Text>
                  )}

                  {result.error && <Text style={styles.resultError}>{result.error}</Text>}
                </View>
              </View>
            ))
        )}
      </View>
    );
  };

  const renderSuitesTab = () => {
    return (
      <View style={styles.tabContent}>
        {testSuites.length === 0 ? (
          <View style={styles.emptyState}>
            <Icon name="assessment" size={64} color={Colors.textSecondary} />
            <Text style={styles.emptyText}>No test suites run yet</Text>
            <Text style={styles.emptySubtext}>
              Run the full test suite to see comprehensive results
            </Text>
          </View>
        ) : (
          testSuites
            .slice()
            .reverse()
            .map((suite, index) => (
              <View key={index} style={styles.suiteCard}>
                <View style={styles.suiteHeader}>
                  <Text style={styles.suiteName}>{suite.name}</Text>
                  <Icon
                    name={getStatusIcon(suite.overallSuccess)}
                    size={24}
                    color={getStatusColor(suite.overallSuccess)}
                  />
                </View>

                <Text style={styles.suiteTime}>{suite.timestamp.toLocaleString()}</Text>

                <Text style={styles.suiteStats}>
                  {suite.tests.filter((t) => t.success).length}/{suite.tests.length} tests passed
                </Text>

                {suite.tests.map((test, testIndex) => (
                  <View key={testIndex} style={styles.suiteTest}>
                    <Icon
                      name={getStatusIcon(test.success)}
                      size={16}
                      color={getStatusColor(test.success)}
                    />
                    <Text style={styles.suiteTestText}>
                      {test.method} {test.endpoint}
                    </Text>
                  </View>
                ))}
              </View>
            ))
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>API Testing</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={clearTestHistory}
            disabled={isRunning}
          >
            <Icon name="clear-all" size={24} color={Colors.primary} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.mainActions}>
        <TouchableOpacity
          style={[styles.mainActionButton, isRunning && styles.disabledButton]}
          onPress={runFullTestSuite}
          disabled={isRunning}
        >
          {isRunning ? (
            <ActivityIndicator color={Colors.white} />
          ) : (
            <Icon name="play-arrow" size={24} color={Colors.white} />
          )}
          <Text style={styles.mainActionText}>
            {isRunning ? 'Running Tests...' : 'Run Full Test Suite'}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, selectedTab === 'health' && styles.activeTab]}
          onPress={() => setSelectedTab('health')}
        >
          <Text style={[styles.tabText, selectedTab === 'health' && styles.activeTabText]}>
            Health
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, selectedTab === 'results' && styles.activeTab]}
          onPress={() => setSelectedTab('results')}
        >
          <Text style={[styles.tabText, selectedTab === 'results' && styles.activeTabText]}>
            Results ({testResults.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, selectedTab === 'suites' && styles.activeTab]}
          onPress={() => setSelectedTab('suites')}
        >
          <Text style={[styles.tabText, selectedTab === 'suites' && styles.activeTabText]}>
            Suites ({testSuites.length})
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
      >
        {selectedTab === 'health' && renderHealthTab()}
        {selectedTab === 'results' && renderResultsTab()}
        {selectedTab === 'suites' && renderSuitesTab()}
      </ScrollView>
    </SafeAreaView>
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
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  title: {
    ...Typography.heading2,
    color: Colors.text,
  },
  headerActions: {
    flexDirection: 'row',
  },
  headerButton: {
    padding: 8,
  },
  mainActions: {
    padding: 20,
  },
  mainActionButton: {
    backgroundColor: Colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    gap: 8,
  },
  disabledButton: {
    opacity: 0.6,
  },
  mainActionText: {
    ...Typography.bodyLarge,
    color: Colors.white,
    fontWeight: '600',
  },
  tabs: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  tab: {
    flex: 1,
    paddingVertical: 16,
    alignItems: 'center',
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: Colors.primary,
  },
  tabText: {
    ...Typography.body,
    color: Colors.textSecondary,
  },
  activeTabText: {
    color: Colors.primary,
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  tabContent: {
    padding: 20,
  },
  healthCard: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
  },
  cardTitle: {
    ...Typography.heading3,
    color: Colors.text,
    marginBottom: 16,
  },
  healthRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  healthLabel: {
    ...Typography.body,
    color: Colors.textSecondary,
  },
  healthValue: {
    ...Typography.bodyLarge,
    color: Colors.text,
    fontWeight: '600',
  },
  quickTestsCard: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 20,
  },
  testButton: {
    backgroundColor: Colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginBottom: 12,
    gap: 8,
  },
  testButtonText: {
    ...Typography.body,
    color: Colors.white,
    fontWeight: '500',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    ...Typography.heading3,
    color: Colors.textSecondary,
    marginTop: 16,
  },
  emptySubtext: {
    ...Typography.body,
    color: Colors.textSecondary,
    marginTop: 8,
    textAlign: 'center',
  },
  resultCard: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  resultHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  resultMethod: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginRight: 12,
  },
  methodText: {
    ...Typography.caption,
    color: Colors.white,
    fontWeight: '600',
  },
  resultEndpoint: {
    ...Typography.body,
    color: Colors.text,
    flex: 1,
    fontFamily: 'monospace',
  },
  resultDetails: {
    paddingLeft: 8,
  },
  resultTime: {
    ...Typography.caption,
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  resultStatus: {
    ...Typography.caption,
    fontWeight: '500',
    marginBottom: 4,
  },
  resultError: {
    ...Typography.caption,
    color: Colors.error,
    fontStyle: 'italic',
  },
  suiteCard: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  suiteHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  suiteName: {
    ...Typography.bodyLarge,
    color: Colors.text,
    fontWeight: '600',
  },
  suiteTime: {
    ...Typography.caption,
    color: Colors.textSecondary,
    marginBottom: 8,
  },
  suiteStats: {
    ...Typography.body,
    color: Colors.text,
    marginBottom: 12,
  },
  suiteTest: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    paddingLeft: 8,
  },
  suiteTestText: {
    ...Typography.caption,
    color: Colors.textSecondary,
    marginLeft: 8,
    fontFamily: 'monospace',
  },
});

export default APITestScreen;
