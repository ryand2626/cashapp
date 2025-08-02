import React, { useState, useEffect } from 'react';

import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  Dimensions,
} from 'react-native';

import { useNavigation } from '@react-navigation/native';
import { LineChart, _BarChart, PieChart } from 'react-native-chart-kit';
import Icon from 'react-native-vector-icons/MaterialIcons';

import { logger } from '../../utils/logger';

const { width: screenWidth } = Dimensions.get('window');

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

interface ProviderPerformance {
  transaction_count: number;
  total_volume: number;
  total_fees: number;
  avg_transaction_size: number;
  fee_percentage: number;
}

interface AnalyticsData {
  overall_metrics: {
    total_volume: number;
    total_fees: number;
    avg_fee_percentage: number;
    transaction_count: number;
  };
  provider_performance: Record<string, ProviderPerformance>;
  cost_savings: {
    potential_savings: number;
    savings_percentage: number;
    optimal_mix: Record<string, unknown>;
  };
  recommendations: Array<{
    type: string;
    priority: string;
    title: string;
    description: string;
    estimated_savings?: number;
    action?: string;
  }>;
}

interface VolumeData {
  daily_trends: Array<{
    date: string;
    total_volume: number;
    total_transactions: number;
    total_fees: number;
    providers: Record<string, unknown>;
  }>;
  growth_metrics: {
    volume_growth: number;
    transaction_growth: number;
    trend: string;
  };
}

interface HealthScores {
  health_scores: Record<
    string,
    {
      overall_score: number;
      factors: {
        success_rate: number;
        cost_efficiency: number;
        volume_trend: number;
        reliability: number;
        avg_processing_time: number;
      };
      status: string;
    }
  >;
  overall_system_health: number;
}

const PaymentAnalyticsScreen: React.FC = () => {
  const navigation = useNavigation();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState('30');
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null);
  const [volumeData, setVolumeData] = useState<VolumeData | null>(null);
  const [healthScores, setHealthScores] = useState<HealthScores | null>(null);
  const [_error, setError] = useState<string>('');

  useEffect(() => {
    loadAnalyticsData();
  }, [selectedPeriod]);

  const loadAnalyticsData = async () => {
    try {
      setError('');

      // Simulate API calls (replace with actual API endpoints)
      const [performanceResponse, volumeResponse, healthResponse] = await Promise.all([
        fetchProviderPerformance(),
        fetchVolumeData(),
        fetchHealthScores(),
      ]);

      setAnalyticsData(performanceResponse);
      setVolumeData(volumeResponse);
      setHealthScores(healthResponse);
    } catch (err) {
      setError('Failed to load analytics data');
      logger.error('Analytics loading error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Mock API calls - replace with actual API integration
  const fetchProviderPerformance = async (): Promise<AnalyticsData> => {
    // Simulate API delay
    await new Promise((resolve) => setTimeout(resolve, 1000));

    return {
      overall_metrics: {
        total_volume: 15420.5,
        total_fees: 185.25,
        avg_fee_percentage: 1.2,
        transaction_count: 342,
      },
      provider_performance: {
        qr_code: {
          transaction_count: 156,
          total_volume: 6850.25,
          total_fees: 82.2,
          avg_transaction_size: 43.91,
          fee_percentage: 1.2,
        },
        stripe: {
          transaction_count: 124,
          total_volume: 5920.15,
          avg_transaction_size: 47.74,
          total_fees: 86.88,
          fee_percentage: 1.47,
        },
        sumup: {
          transaction_count: 62,
          total_volume: 2650.1,
          total_fees: 16.17,
          avg_transaction_size: 42.74,
          fee_percentage: 0.61,
        },
      },
      cost_savings: {
        potential_savings: 45.3,
        savings_percentage: 24.5,
        optimal_mix: {
          sumup: { percentage: 60, volume: 9252.3, fees: 63.82 },
          qr_code: { percentage: 40, volume: 6168.2, fees: 74.02 },
        },
      },
      recommendations: [
        {
          type: 'provider_switch',
          priority: 'high',
          title: 'Switch to SumUp for high volume',
          description: "Your monthly volume qualifies for SumUp's 0.69% + £19/month plan",
          estimated_savings: 45.3,
          action: 'Configure SumUp integration',
        },
        {
          type: 'payment_method',
          priority: 'medium',
          title: 'Promote QR code payments',
          description: 'QR payments have lower fees (1.2%) and could reduce costs',
          action: 'Add QR payment incentives',
        },
      ],
    };
  };

  const fetchVolumeData = async (): Promise<VolumeData> => {
    await new Promise((resolve) => setTimeout(resolve, 800));

    const today = new Date();
    const trends = [];

    for (let i = 29; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);

      trends.push({
        date: date.toISOString().split('T')[0],
        total_volume: 400 + Math.random() * 200,
        total_transactions: 8 + Math.floor(Math.random() * 6),
        total_fees: 4.5 + Math.random() * 3,
        providers: {},
      });
    }

    return {
      daily_trends: trends,
      growth_metrics: {
        volume_growth: 12.5,
        transaction_growth: 8.3,
        trend: 'growth',
      },
    };
  };

  const fetchHealthScores = async (): Promise<HealthScores> => {
    await new Promise((resolve) => setTimeout(resolve, 600));

    return {
      health_scores: {
        qr_code: {
          overall_score: 92.5,
          factors: {
            success_rate: 98.5,
            cost_efficiency: 95.0,
            volume_trend: 88.2,
            reliability: 94.1,
            avg_processing_time: 86.5,
          },
          status: 'excellent',
        },
        stripe: {
          overall_score: 87.3,
          factors: {
            success_rate: 99.2,
            cost_efficiency: 78.5,
            volume_trend: 85.1,
            reliability: 96.8,
            avg_processing_time: 92.0,
          },
          status: 'good',
        },
        sumup: {
          overall_score: 94.8,
          factors: {
            success_rate: 97.1,
            cost_efficiency: 98.5,
            volume_trend: 92.4,
            reliability: 93.2,
            avg_processing_time: 89.8,
          },
          status: 'excellent',
        },
      },
      overall_system_health: 91.5,
    };
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadAnalyticsData();
  };

  const renderMetricCard = (title: string, value: string, subtitle?: string, trend?: number) => (
    <View style={styles.metricCard}>
      <Text style={styles.metricTitle}>{title}</Text>
      <Text style={styles.metricValue}>{value}</Text>
      {subtitle && <Text style={styles.metricSubtitle}>{subtitle}</Text>}
      {trend !== undefined && (
        <View
          style={[styles.trendContainer, trend >= 0 ? styles.trendPositive : styles.trendNegative]}
        >
          <Icon
            name={trend >= 0 ? 'trending-up' : 'trending-down'}
            size={16}
            color={trend >= 0 ? Colors.success : Colors.danger}
          />
          <Text
            style={[
              styles.trendText,
              trend >= 0 ? styles.trendPositiveText : styles.trendNegativeText,
            ]}
          >
            {Math.abs(trend).toFixed(1)}%
          </Text>
        </View>
      )}
    </View>
  );

  const renderProviderHealth = (provider: string, health: unknown) => {
    const getStatusColor = (status: string) => {
      switch (status) {
        case 'excellent':
          return Colors.success;
        case 'good':
          return Colors.primary;
        case 'needs_attention':
          return Colors.warning;
        default:
          return Colors.danger;
      }
    };

    return (
      <View key={provider} style={styles.healthCard}>
        <View style={styles.healthHeader}>
          <Text style={styles.healthProvider}>{provider.replace('_', ' ').toUpperCase()}</Text>
          <View style={[styles.healthScore, { borderColor: getStatusColor(health.status) }]}>
            <Text style={[styles.healthScoreText, { color: getStatusColor(health.status) }]}>
              {health.overall_score.toFixed(1)}
            </Text>
          </View>
        </View>

        <View style={styles.healthFactors}>
          {Object.entries(health.factors).map(([factor, score]: [string, any]) => (
            <View key={factor} style={styles.factorRow}>
              <Text style={styles.factorName}>
                {factor.replace('_', ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
              </Text>
              <View style={styles.factorBar}>
                <View
                  style={[
                    styles.factorProgress,
                    {
                      width: `${score}%`,
                      backgroundColor:
                        score >= 80 ? Colors.success : score >= 60 ? Colors.warning : Colors.danger,
                    },
                  ]}
                />
              </View>
              <Text style={styles.factorScore}>{score.toFixed(0)}</Text>
            </View>
          ))}
        </View>
      </View>
    );
  };

  const renderVolumeChart = () => {
    if (!volumeData?.daily_trends) return null;

    const chartData = {
      labels: volumeData.daily_trends.slice(-7).map((d) => {
        const date = new Date(d.date);
        return date.getDate().toString();
      }),
      datasets: [
        {
          data: volumeData.daily_trends.slice(-7).map((d) => d.total_volume),
          color: (opacity = 1) => `rgba(0, 166, 81, ${opacity})`,
          strokeWidth: 2,
        },
      ],
    };

    return (
      <View style={styles.chartContainer}>
        <Text style={styles.chartTitle}>7-Day Volume Trend</Text>
        <LineChart
          data={chartData}
          width={screenWidth - 32}
          height={200}
          chartConfig={{
            backgroundColor: Colors.white,
            backgroundGradientFrom: Colors.white,
            backgroundGradientTo: Colors.white,
            decimalPlaces: 0,
            color: (opacity = 1) => `rgba(0, 166, 81, ${opacity})`,
            labelColor: (opacity = 1) => `rgba(51, 51, 51, ${opacity})`,
            style: { borderRadius: 16 },
            propsForDots: {
              r: '4',
              strokeWidth: '2',
              stroke: Colors.primary,
            },
          }}
          bezier
          style={styles.chart}
        />
      </View>
    );
  };

  const renderProviderDistribution = () => {
    if (!analyticsData?.provider_performance) return null;

    const providers = Object.entries(analyticsData.provider_performance);
    const colors = [Colors.primary, Colors.secondary, Colors.warning, Colors.success];

    const pieData = providers.map(([provider, data], index) => ({
      name: provider.replace('_', ' ').toUpperCase(),
      population: data.total_volume,
      color: colors[index % colors.length],
      legendFontColor: Colors.text,
      legendFontSize: 12,
    }));

    return (
      <View style={styles.chartContainer}>
        <Text style={styles.chartTitle}>Volume by Provider</Text>
        <PieChart
          data={pieData}
          width={screenWidth - 32}
          height={220}
          chartConfig={{
            color: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
          }}
          accessor="population"
          backgroundColor="transparent"
          paddingLeft="15"
          absolute
        />
      </View>
    );
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Loading Analytics...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Icon name="arrow-back" size={24} color={Colors.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Payment Analytics</Text>
        <TouchableOpacity style={styles.settingsButton}>
          <Icon name="settings" size={24} color={Colors.white} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Period Selection */}
        <View style={styles.periodSelector}>
          {['7', '30', '90'].map((period) => (
            <TouchableOpacity
              key={period}
              style={[styles.periodButton, selectedPeriod === period && styles.periodButtonActive]}
              onPress={() => setSelectedPeriod(period)}
            >
              <Text
                style={[styles.periodText, selectedPeriod === period && styles.periodTextActive]}
              >
                {period} Days
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Overview Metrics */}
        {analyticsData && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Overview</Text>
            <View style={styles.metricsGrid}>
              {renderMetricCard(
                'Total Volume',
                `£${analyticsData.overall_metrics.total_volume.toLocaleString()}`,
                'Last 30 days',
                volumeData?.growth_metrics.volume_growth
              )}
              {renderMetricCard(
                'Total Fees',
                `£${analyticsData.overall_metrics.total_fees.toFixed(2)}`,
                `${analyticsData.overall_metrics.avg_fee_percentage.toFixed(2)}% avg rate`
              )}
              {renderMetricCard(
                'Transactions',
                analyticsData.overall_metrics.transaction_count.toString(),
                'Completed payments'
              )}
              {renderMetricCard(
                'Potential Savings',
                `£${analyticsData.cost_savings.potential_savings.toFixed(2)}`,
                `${analyticsData.cost_savings.savings_percentage.toFixed(1)}% opportunity`
              )}
            </View>
          </View>
        )}

        {/* Volume Chart */}
        {renderVolumeChart()}

        {/* Provider Distribution */}
        {renderProviderDistribution()}

        {/* Provider Health Scores */}
        {healthScores && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Provider Health</Text>
              <View style={styles.overallHealth}>
                <Text style={styles.overallHealthText}>
                  System Health: {healthScores.overall_system_health.toFixed(1)}%
                </Text>
              </View>
            </View>
            {Object.entries(healthScores.health_scores).map(([provider, health]) =>
              renderProviderHealth(provider, health)
            )}
          </View>
        )}

        {/* Recommendations */}
        {analyticsData?.recommendations && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Recommendations</Text>
            {analyticsData.recommendations.map((rec, index) => (
              <View key={index} style={styles.recommendationCard}>
                <View style={styles.recommendationHeader}>
                  <View
                    style={[
                      styles.priorityBadge,
                      rec.priority === 'high' ? styles.priorityHigh : styles.priorityMedium,
                    ]}
                  >
                    <Text style={styles.priorityText}>{rec.priority.toUpperCase()}</Text>
                  </View>
                  {rec.estimated_savings && (
                    <Text style={styles.savingsText}>Save £{rec.estimated_savings.toFixed(2)}</Text>
                  )}
                </View>
                <Text style={styles.recommendationTitle}>{rec.title}</Text>
                <Text style={styles.recommendationDescription}>{rec.description}</Text>
                {rec.action && (
                  <TouchableOpacity style={styles.actionButton}>
                    <Text style={styles.actionButtonText}>{rec.action}</Text>
                    <Icon name="arrow-forward" size={16} color={Colors.primary} />
                  </TouchableOpacity>
                )}
              </View>
            ))}
          </View>
        )}

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
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
  settingsButton: {
    padding: 8,
  },
  loadingText: {
    fontSize: 16,
    color: Colors.lightText,
    marginTop: 12,
  },
  content: {
    flex: 1,
  },
  periodSelector: {
    flexDirection: 'row',
    backgroundColor: Colors.white,
    marginVertical: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  periodButton: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    marginHorizontal: 4,
    borderRadius: 8,
    backgroundColor: Colors.background,
  },
  periodButtonActive: {
    backgroundColor: Colors.primary,
  },
  periodText: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.text,
  },
  periodTextActive: {
    color: Colors.white,
  },
  section: {
    backgroundColor: Colors.white,
    marginVertical: 8,
    paddingVertical: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text,
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  overallHealth: {
    backgroundColor: Colors.background,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  overallHealthText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.primary,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    gap: 12,
  },
  metricCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: Colors.background,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  metricTitle: {
    fontSize: 12,
    color: Colors.lightText,
    marginBottom: 4,
  },
  metricValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 4,
  },
  metricSubtitle: {
    fontSize: 11,
    color: Colors.lightText,
  },
  trendContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  trendPositive: {},
  trendNegative: {},
  trendText: {
    fontSize: 11,
    fontWeight: '600',
    marginLeft: 2,
  },
  trendPositiveText: {
    color: Colors.success,
  },
  trendNegativeText: {
    color: Colors.danger,
  },
  chartContainer: {
    backgroundColor: Colors.white,
    marginVertical: 8,
    paddingVertical: 16,
    alignItems: 'center',
  },
  chartTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 16,
  },
  chart: {
    marginVertical: 8,
    borderRadius: 16,
  },
  healthCard: {
    backgroundColor: Colors.background,
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 12,
    padding: 16,
  },
  healthHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  healthProvider: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
  },
  healthScore: {
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 3,
    justifyContent: 'center',
    alignItems: 'center',
  },
  healthScoreText: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  healthFactors: {
    gap: 8,
  },
  factorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  factorName: {
    fontSize: 12,
    color: Colors.lightText,
    width: 80,
  },
  factorBar: {
    flex: 1,
    height: 6,
    backgroundColor: Colors.lightGray,
    borderRadius: 3,
  },
  factorProgress: {
    height: '100%',
    borderRadius: 3,
  },
  factorScore: {
    fontSize: 12,
    fontWeight: '500',
    color: Colors.text,
    width: 30,
    textAlign: 'right',
  },
  recommendationCard: {
    backgroundColor: Colors.background,
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 12,
    padding: 16,
  },
  recommendationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  priorityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  priorityHigh: {
    backgroundColor: Colors.danger,
  },
  priorityMedium: {
    backgroundColor: Colors.warning,
  },
  priorityText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: Colors.white,
  },
  savingsText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.success,
  },
  recommendationTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 4,
  },
  recommendationDescription: {
    fontSize: 14,
    color: Colors.lightText,
    lineHeight: 20,
    marginBottom: 12,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.primary,
  },
  bottomSpacer: {
    height: 20,
  },
});

export default PaymentAnalyticsScreen;
