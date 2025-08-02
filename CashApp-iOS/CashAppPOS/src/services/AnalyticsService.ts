interface AnalyticsData {
  revenue: RevenueData;
  transactions: TransactionData;
  performance: PerformanceData;
  trends: TrendData;
}

interface RevenueData {
  total: number;
  commission: number;
  avgCommissionRate: number;
  growth: number;
  byPeriod: PeriodData[];
  byRestaurant: RestaurantRevenue[];
}

interface TransactionData {
  total: number;
  avgValue: number;
  growth: number;
  byPeriod: PeriodData[];
  byPaymentMethod: PaymentMethodData[];
}

interface PerformanceData {
  rankings: RestaurantRanking[];
  metrics: RestaurantMetrics[];
  comparisons: ComparisonData[];
}

interface TrendData {
  daily: PeriodData[];
  weekly: PeriodData[];
  monthly: PeriodData[];
  yearly: PeriodData[];
}

interface PeriodData {
  period: string;
  value: number;
  change?: number;
}

interface RestaurantRevenue {
  restaurantId: string;
  name: string;
  revenue: number;
  commission: number;
  growth: number;
}

interface RestaurantRanking {
  rank: number;
  restaurantId: string;
  name: string;
  revenue: number;
  growth: number;
  score: number;
}

interface RestaurantMetrics {
  restaurantId: string;
  name: string;
  avgOrderValue: number;
  transactionCount: number;
  customerSatisfaction: number;
  uptime: number;
}

interface ComparisonData {
  metric: string;
  values: { restaurantId: string; name: string; value: number }[];
}

interface PaymentMethodData {
  method: string;
  count: number;
  value: number;
  percentage: number;
}

class AnalyticsService {
  private static instance: AnalyticsService;
  private analyticsData: AnalyticsData | null = null;
  private lastUpdated: Date | null = null;

  static getInstance(): AnalyticsService {
    if (!AnalyticsService.instance) {
      AnalyticsService.instance = new AnalyticsService();
    }
    return AnalyticsService.instance;
  }

  async getAnalyticsData(
    period: 'today' | 'week' | 'month' | 'year' = 'month'
  ): Promise<AnalyticsData> {
    // Simulate API call delay
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Generate mock analytics data based on period
    return this.generateMockAnalyticsData(period);
  }

  async getRevenueAnalytics(
    period: 'today' | 'week' | 'month' | 'year' = 'month'
  ): Promise<RevenueData> {
    const data = await this.getAnalyticsData(period);
    return data.revenue;
  }

  async getTransactionAnalytics(
    period: 'today' | 'week' | 'month' | 'year' = 'month'
  ): Promise<TransactionData> {
    const data = await this.getAnalyticsData(period);
    return data.transactions;
  }

  async getPerformanceAnalytics(): Promise<PerformanceData> {
    const data = await this.getAnalyticsData();
    return data.performance;
  }

  async getTrendAnalytics(
    period: 'today' | 'week' | 'month' | 'year' = 'month'
  ): Promise<TrendData> {
    const data = await this.getAnalyticsData(period);
    return data.trends;
  }

  async exportData(
    format: 'csv' | 'json' | 'pdf',
    period: string
  ): Promise<{ url: string; filename: string }> {
    // Simulate export generation
    await new Promise((resolve) => setTimeout(resolve, 2000));

    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `fynlo-analytics-${period}-${timestamp}.${format}`;

    return {
      url: `https://api.fynlopos.com/exports/${filename}`,
      filename,
    };
  }

  async generateCustomReport(
    metrics: string[],
    restaurants: string[],
    period: { start: Date; end: Date }
  ): Promise<any> {
    // Simulate custom report generation
    await new Promise((resolve) => setTimeout(resolve, 1500));

    return {
      reportId: `custom-${Date.now()}`,
      metrics,
      restaurants,
      period,
      data: this.generateCustomReportData(metrics, restaurants),
      generatedAt: new Date(),
    };
  }

  private generateMockAnalyticsData(period: 'today' | 'week' | 'month' | 'year'): AnalyticsData {
    const multiplier = this.getPeriodMultiplier(period);

    return {
      revenue: this.generateRevenueData(multiplier, period),
      transactions: this.generateTransactionData(multiplier, period),
      performance: this.generatePerformanceData(),
      trends: this.generateTrendData(period),
    };
  }

  private getPeriodMultiplier(period: 'today' | 'week' | 'month' | 'year'): number {
    switch (period) {
      case 'today':
        return 0.033; // 1/30th of month
      case 'week':
        return 0.23; // ~1/4 of month
      case 'month':
        return 1;
      case 'year':
        return 12;
      default:
        return 1;
    }
  }

  private generateRevenueData(multiplier: number, period: string): RevenueData {
    const baseRevenue = 125400;
    const total = Math.round(baseRevenue * multiplier);
    const commission = Math.round(total * 0.026); // 2.6% avg commission

    return {
      total,
      commission,
      avgCommissionRate: 2.6,
      growth: 12.5,
      byPeriod: this.generatePeriodData(period, total),
      byRestaurant: [
        {
          restaurantId: '1',
          name: 'Fynlo Coffee Shop',
          revenue: Math.round(total * 0.36),
          commission: Math.round(total * 0.36 * 0.025),
          growth: 15.2,
        },
        {
          restaurantId: '2',
          name: 'Fynlo Burger Bar',
          revenue: Math.round(total * 0.31),
          commission: Math.round(total * 0.31 * 0.027),
          growth: 8.7,
        },
        {
          restaurantId: '3',
          name: 'Fynlo Pizza Palace',
          revenue: Math.round(total * 0.26),
          commission: Math.round(total * 0.26 * 0.024),
          growth: 5.3,
        },
        {
          restaurantId: '4',
          name: 'Fynlo Taco Stand',
          revenue: Math.round(total * 0.07),
          commission: Math.round(total * 0.07 * 0.028),
          growth: -2.1,
        },
      ],
    };
  }

  private generateTransactionData(multiplier: number, period: string): TransactionData {
    const baseTransactions = 28473;
    const total = Math.round(baseTransactions * multiplier);
    const avgValue = 44.3;

    return {
      total,
      avgValue,
      growth: 8.2,
      byPeriod: this.generatePeriodData(period, total),
      byPaymentMethod: [
        {
          method: 'Card',
          count: Math.round(total * 0.65),
          value: Math.round(total * 0.65 * avgValue),
          percentage: 65,
        },
        {
          method: 'Contactless',
          count: Math.round(total * 0.25),
          value: Math.round(total * 0.25 * avgValue),
          percentage: 25,
        },
        {
          method: 'Mobile Pay',
          count: Math.round(total * 0.08),
          value: Math.round(total * 0.08 * avgValue),
          percentage: 8,
        },
        {
          method: 'Cash',
          count: Math.round(total * 0.02),
          value: Math.round(total * 0.02 * avgValue),
          percentage: 2,
        },
      ],
    };
  }

  private generatePerformanceData(): PerformanceData {
    return {
      rankings: [
        {
          rank: 1,
          restaurantId: '1',
          name: 'Fynlo Coffee Shop',
          revenue: 45200,
          growth: 15.2,
          score: 92,
        },
        {
          rank: 2,
          restaurantId: '2',
          name: 'Fynlo Burger Bar',
          revenue: 38900,
          growth: 8.7,
          score: 87,
        },
        {
          rank: 3,
          restaurantId: '3',
          name: 'Fynlo Pizza Palace',
          revenue: 32800,
          growth: 5.3,
          score: 81,
        },
        {
          rank: 4,
          restaurantId: '4',
          name: 'Fynlo Taco Stand',
          revenue: 8500,
          growth: -2.1,
          score: 73,
        },
      ],
      metrics: [
        {
          restaurantId: '1',
          name: 'Fynlo Coffee Shop',
          avgOrderValue: 12.5,
          transactionCount: 3616,
          customerSatisfaction: 4.8,
          uptime: 99.2,
        },
        {
          restaurantId: '2',
          name: 'Fynlo Burger Bar',
          avgOrderValue: 18.75,
          transactionCount: 2075,
          customerSatisfaction: 4.6,
          uptime: 98.8,
        },
        {
          restaurantId: '3',
          name: 'Fynlo Pizza Palace',
          avgOrderValue: 25.3,
          transactionCount: 1296,
          customerSatisfaction: 4.7,
          uptime: 97.5,
        },
        {
          restaurantId: '4',
          name: 'Fynlo Taco Stand',
          avgOrderValue: 8.9,
          transactionCount: 955,
          customerSatisfaction: 4.4,
          uptime: 96.1,
        },
      ],
      comparisons: [
        {
          metric: 'Average Order Value',
          values: [
            { restaurantId: '3', name: 'Fynlo Pizza Palace', value: 25.3 },
            { restaurantId: '2', name: 'Fynlo Burger Bar', value: 18.75 },
            { restaurantId: '1', name: 'Fynlo Coffee Shop', value: 12.5 },
            { restaurantId: '4', name: 'Fynlo Taco Stand', value: 8.9 },
          ],
        },
        {
          metric: 'Customer Satisfaction',
          values: [
            { restaurantId: '1', name: 'Fynlo Coffee Shop', value: 4.8 },
            { restaurantId: '3', name: 'Fynlo Pizza Palace', value: 4.7 },
            { restaurantId: '2', name: 'Fynlo Burger Bar', value: 4.6 },
            { restaurantId: '4', name: 'Fynlo Taco Stand', value: 4.4 },
          ],
        },
      ],
    };
  }

  private generateTrendData(period: string): TrendData {
    return {
      daily: this.generatePeriodData('daily', 4200),
      weekly: this.generatePeriodData('weekly', 29400),
      monthly: this.generatePeriodData('monthly', 125400),
      yearly: this.generatePeriodData('yearly', 1504800),
    };
  }

  private generatePeriodData(period: string, baseValue: number): PeriodData[] {
    const periods: PeriodData[] = [];
    let pointCount = 12;
    let labelFormat = '';

    switch (period) {
      case 'today':
        pointCount = 24;
        labelFormat = 'hour';
        break;
      case 'week':
        pointCount = 7;
        labelFormat = 'day';
        break;
      case 'month':
        pointCount = 30;
        labelFormat = 'day';
        break;
      case 'year':
        pointCount = 12;
        labelFormat = 'month';
        break;
      case 'daily':
        pointCount = 30;
        labelFormat = 'day';
        break;
      case 'weekly':
        pointCount = 12;
        labelFormat = 'week';
        break;
      case 'monthly':
        pointCount = 12;
        labelFormat = 'month';
        break;
      case 'yearly':
        pointCount = 5;
        labelFormat = 'year';
        break;
    }

    for (let i = 0; i < pointCount; i++) {
      const variation = 0.8 + Math.random() * 0.4; // Random between 0.8 and 1.2
      const value = Math.round((baseValue / pointCount) * variation);
      const change = -10 + Math.random() * 20; // Random between -10% and +10%

      let label = '';
      if (labelFormat === 'hour') {
        label = `${i}:00`;
      } else if (labelFormat === 'day') {
        label = `Day ${i + 1}`;
      } else if (labelFormat === 'week') {
        label = `Week ${i + 1}`;
      } else if (labelFormat === 'month') {
        const months = [
          'Jan',
          'Feb',
          'Mar',
          'Apr',
          'May',
          'Jun',
          'Jul',
          'Aug',
          'Sep',
          'Oct',
          'Nov',
          'Dec',
        ];
        label = months[i];
      } else if (labelFormat === 'year') {
        label = `${2020 + i}`;
      }

      periods.push({ period: label, value, change });
    }

    return periods;
  }

  private generateCustomReportData(metrics: string[], restaurants: string[]): any {
    // Generate sample custom report data
    return {
      summary: {
        totalRevenue: 125400,
        totalTransactions: 28473,
        avgOrderValue: 44.3,
      },
      breakdown: restaurants.map((restaurantId) => ({
        restaurantId,
        metrics: metrics.reduce((acc, metric) => {
          acc[metric] = Math.round(Math.random() * 10000);
          return acc;
        }, {} as any),
      })),
    };
  }
}

export { AnalyticsService };
export type {
  AnalyticsData,
  RevenueData,
  TransactionData,
  PerformanceData,
  TrendData,
  PeriodData,
  RestaurantRevenue,
  RestaurantRanking,
  RestaurantMetrics,
  ComparisonData,
  PaymentMethodData,
};
