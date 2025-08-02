import React, { useState, useEffect, useCallback } from 'react';

import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Linking,
  RefreshControl,
} from 'react-native';

import { useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialIcons';

import { Colors } from '../../design-system/theme';
import XeroApiClient from '../../services/XeroApiClient';
import XeroAuthService from '../../services/XeroAuthService';

interface ConnectionStatus {
  isConnected: boolean;
  organization?: any;
  lastSync?: number;
  error?: string;
}

interface SyncStatus {
  inProgress: boolean;
  lastSync?: number;
  error?: string;
}

const XeroSettingsScreen: React.FC = () => {
  const navigation = useNavigation();
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>({
    isConnected: false,
  });
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({ inProgress: false });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const authService = XeroAuthService.getInstance();
  const apiClient = XeroApiClient.getInstance();

  /**
   * Check connection status
   */
  const checkConnectionStatus = useCallback(async () => {
    try {
      const isConnected = await authService.isConnected();

      if (isConnected) {
        try {
          const orgData = await apiClient.getOrganisation();
          setConnectionStatus({
            isConnected: true,
            organization: orgData?.Organisations?.[0],
            lastSync: Date.now(),
          });
        } catch (error) {
          console.error('Error fetching organization:', error);
          setConnectionStatus({
            isConnected: true,
            error: 'Connected but unable to fetch organization data',
          });
        }
      } else {
        setConnectionStatus({ isConnected: false });
      }
    } catch (error) {
      console.error('Error checking connection:', error);
      setConnectionStatus({
        isConnected: false,
        error: 'Unable to check connection status',
      });
    }
  }, [authService, apiClient]);

  /**
   * Handle OAuth connection flow
   */
  const handleConnectToXero = async () => {
    try {
      setLoading(true);

      Alert.alert(
        'Connect to Xero',
        'You will be redirected to Xero to authorize the connection. Please return to the app after completing the authorization.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Continue',
            onPress: async () => {
              try {
                await authService.openAuthUrl();

                // Listen for app returning from OAuth flow
                const handleURL = (url: string) => {
                  if (url.includes('oauth/xero/callback')) {
                    handleOAuthCallback(url);
                  }
                };

                const subscription = Linking.addEventListener('url', handleURL);

                // Clean up listener after 5 minutes
                setTimeout(() => {
                  subscription?.remove();
                }, 300000);
              } catch (error) {
                console.error('OAuth error:', error);
                Alert.alert('Error', 'Failed to open Xero authorization. Please try again.');
              }
            },
          },
        ]
      );
    } catch (error) {
      console.error('Connection error:', error);
      Alert.alert('Error', 'Failed to initiate connection to Xero');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Handle OAuth callback
   */
  const handleOAuthCallback = async (url: string) => {
    try {
      const urlParams = new URLSearchParams(url.split('?')[1]);
      const code = urlParams.get('code');
      const state = urlParams.get('state');
      const error = urlParams.get('error');

      if (error) {
        Alert.alert('Authorization Failed', `Error: ${error}`);
        return;
      }

      if (!code || !state) {
        Alert.alert('Authorization Failed', 'Invalid authorization response');
        return;
      }

      setLoading(true);
      const tokens = await authService.exchangeCodeForTokens(code, state);

      if (tokens) {
        Alert.alert('Success', 'Successfully connected to Xero!');
        await checkConnectionStatus();
      }
    } catch (error) {
      console.error('OAuth callback error:', error);
      Alert.alert('Error', 'Failed to complete Xero authorization');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Handle disconnection
   */
  const handleDisconnect = () => {
    Alert.alert(
      'Disconnect from Xero',
      'Are you sure you want to disconnect from Xero? This will stop all data synchronization.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Disconnect',
          style: 'destructive',
          onPress: async () => {
            try {
              setLoading(true);
              await authService.revokeToken();
              setConnectionStatus({ isConnected: false });
              Alert.alert('Disconnected', 'Successfully disconnected from Xero');
            } catch (error) {
              console.error('Disconnect error:', error);
              Alert.alert('Error', 'Failed to disconnect from Xero');
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  /**
   * Test connection
   */
  const handleTestConnection = async () => {
    try {
      setLoading(true);
      const isConnected = await apiClient.testConnection();

      if (isConnected) {
        Alert.alert('Success', 'Connection to Xero is working properly');
      } else {
        Alert.alert('Failed', 'Unable to connect to Xero API');
      }
    } catch (error) {
      console.error('Test connection error:', error);
      Alert.alert('Error', 'Connection test failed');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Manual sync trigger
   */
  const handleManualSync = async () => {
    try {
      setSyncStatus({ inProgress: true });

      // This is a placeholder - actual sync implementation would go here
      await new Promise((resolve) => setTimeout(resolve, 2000));

      setSyncStatus({
        inProgress: false,
        lastSync: Date.now(),
      });

      Alert.alert('Success', 'Manual sync completed');
    } catch (error) {
      console.error('Manual sync error:', error);
      setSyncStatus({
        inProgress: false,
        error: 'Sync failed',
      });
      Alert.alert('Error', 'Manual sync failed');
    }
  };

  /**
   * Refresh data
   */
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await checkConnectionStatus();
    setRefreshing(false);
  }, [checkConnectionStatus]);

  /**
   * Format date for display
   */
  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString();
  };

  /**
   * Get rate limit info
   */
  const getRateLimitInfo = () => {
    return apiClient.getRateLimitInfo();
  };

  useEffect(() => {
    const initializeScreen = async () => {
      await checkConnectionStatus();
      setLoading(false);
    };

    initializeScreen();
  }, [checkConnectionStatus]);

  if (loading && !refreshing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Loading Xero settings...</Text>
      </View>
    );
  }

  const rateLimitInfo = getRateLimitInfo();

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Icon name="arrow-back" size={24} color={Colors.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Xero Integration</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Connection Status Card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Icon
              name={connectionStatus.isConnected ? 'check-circle' : 'error'}
              size={24}
              color={connectionStatus.isConnected ? Colors.success : Colors.error}
            />
            <Text style={styles.cardTitle}>
              {connectionStatus.isConnected ? 'Connected to Xero' : 'Not Connected'}
            </Text>
          </View>

          {connectionStatus.isConnected && connectionStatus.organization && (
            <View style={styles.orgInfo}>
              <Text style={styles.orgName}>{connectionStatus.organization.Name}</Text>
              <Text style={styles.orgDetails}>
                {connectionStatus.organization.CountryCode} •{' '}
                {connectionStatus.organization.BaseCurrency}
              </Text>
            </View>
          )}

          {connectionStatus.error && <Text style={styles.errorText}>{connectionStatus.error}</Text>}

          <View style={styles.buttonContainer}>
            {connectionStatus.isConnected ? (
              <>
                <TouchableOpacity style={styles.button} onPress={handleTestConnection}>
                  <Icon name="wifi" size={20} color={Colors.white} />
                  <Text style={styles.buttonText}>Test Connection</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.button, styles.disconnectButton]}
                  onPress={handleDisconnect}
                >
                  <Icon name="link-off" size={20} color={Colors.white} />
                  <Text style={styles.buttonText}>Disconnect</Text>
                </TouchableOpacity>
              </>
            ) : (
              <TouchableOpacity style={styles.button} onPress={handleConnectToXero}>
                <Icon name="link" size={20} color={Colors.white} />
                <Text style={styles.buttonText}>Connect to Xero</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Sync Status Card */}
        {connectionStatus.isConnected && (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Icon name="sync" size={24} color={Colors.primary} />
              <Text style={styles.cardTitle}>Synchronization</Text>
            </View>

            {syncStatus.inProgress && (
              <View style={styles.syncProgress}>
                <ActivityIndicator size="small" color={Colors.primary} />
                <Text style={styles.syncText}>Syncing data...</Text>
              </View>
            )}

            {syncStatus.lastSync && (
              <Text style={styles.lastSyncText}>Last sync: {formatDate(syncStatus.lastSync)}</Text>
            )}

            {syncStatus.error && <Text style={styles.errorText}>{syncStatus.error}</Text>}

            <View style={styles.buttonRow}>
              <TouchableOpacity
                style={[styles.button, syncStatus.inProgress && styles.disabledButton]}
                onPress={handleManualSync}
                disabled={syncStatus.inProgress}
              >
                <Icon name="sync" size={20} color={Colors.white} />
                <Text style={styles.buttonText}>Manual Sync</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.button, styles.dashboardButton]}
                onPress={() => navigation.navigate('XeroSyncDashboard' as never)}
              >
                <Icon name="dashboard" size={20} color={Colors.white} />
                <Text style={styles.buttonText}>Dashboard</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Rate Limit Info Card */}
        {connectionStatus.isConnected && (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Icon name="speed" size={24} color={Colors.primary} />
              <Text style={styles.cardTitle}>API Usage</Text>
            </View>

            <View style={styles.rateLimitInfo}>
              <View style={styles.rateLimitItem}>
                <Text style={styles.rateLimitLabel}>Remaining Requests</Text>
                <Text style={styles.rateLimitValue}>{rateLimitInfo.remainingRequests}</Text>
              </View>
              <View style={styles.rateLimitItem}>
                <Text style={styles.rateLimitLabel}>Daily Limit</Text>
                <Text style={styles.rateLimitValue}>{rateLimitInfo.dailyLimit}</Text>
              </View>
              <View style={styles.rateLimitItem}>
                <Text style={styles.rateLimitLabel}>Minute Limit</Text>
                <Text style={styles.rateLimitValue}>{rateLimitInfo.minuteLimit}</Text>
              </View>
            </View>
          </View>
        )}

        {/* Information Card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Icon name="info" size={24} color={Colors.primary} />
            <Text style={styles.cardTitle}>About Xero Integration</Text>
          </View>

          <Text style={styles.infoText}>Connect your Fynlo POS to Xero to automatically sync:</Text>

          <View style={styles.featureList}>
            <View style={styles.featureItem}>
              <Icon name="check" size={16} color={Colors.success} />
              <Text style={styles.featureText}>Sales transactions as invoices</Text>
            </View>
            <View style={styles.featureItem}>
              <Icon name="check" size={16} color={Colors.success} />
              <Text style={styles.featureText}>Customer information</Text>
            </View>
            <View style={styles.featureItem}>
              <Icon name="check" size={16} color={Colors.success} />
              <Text style={styles.featureText}>Product catalog</Text>
            </View>
            <View style={styles.featureItem}>
              <Icon name="check" size={16} color={Colors.success} />
              <Text style={styles.featureText}>Payment records</Text>
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.primary,
    paddingTop: 50,
    paddingBottom: 15,
    paddingHorizontal: 16,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    color: Colors.white,
    fontSize: 18,
    fontWeight: '600',
  },
  headerSpacer: {
    width: 40,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: Colors.textSecondary,
  },
  card: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text,
    marginLeft: 12,
  },
  orgInfo: {
    marginBottom: 16,
    paddingLeft: 36,
  },
  orgName: {
    fontSize: 16,
    fontWeight: '500',
    color: Colors.text,
  },
  orgDetails: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  errorText: {
    color: Colors.error,
    fontSize: 14,
    marginBottom: 16,
    paddingLeft: 36,
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  button: {
    flex: 1,
    backgroundColor: Colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  disconnectButton: {
    backgroundColor: Colors.error,
  },
  disabledButton: {
    backgroundColor: Colors.disabled,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
  },
  dashboardButton: {
    backgroundColor: Colors.secondary,
  },
  buttonText: {
    color: Colors.white,
    fontSize: 14,
    fontWeight: '500',
  },
  syncProgress: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    paddingLeft: 36,
  },
  syncText: {
    marginLeft: 12,
    fontSize: 14,
    color: Colors.textSecondary,
  },
  lastSyncText: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: 16,
    paddingLeft: 36,
  },
  rateLimitInfo: {
    paddingLeft: 36,
  },
  rateLimitItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  rateLimitLabel: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  rateLimitValue: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.text,
  },
  infoText: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: 16,
    paddingLeft: 36,
  },
  featureList: {
    paddingLeft: 36,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  featureText: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginLeft: 8,
  },
});

export default XeroSettingsScreen;
