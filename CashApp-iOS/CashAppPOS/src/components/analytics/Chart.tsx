import React from 'react';

import { View, Text, StyleSheet, Dimensions } from 'react-native';

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

const { width: screenWidth } = Dimensions.get('window');

interface DataPoint {
  label: string;
  value: number;
  color?: string;
}

interface ChartProps {
  data: DataPoint[];
  type?: 'line' | 'bar' | 'pie';
  title?: string;
  height?: number;
  showValues?: boolean;
}

const Chart: React.FC<ChartProps> = ({
  data,
  type = 'bar',
  title,
  height = 200,
  showValues = true,
}) => {
  const chartWidth = screenWidth - 80;
  const maxValue = Math.max(...data.map((d) => d.value));

  const renderBarChart = () => {
    const barWidth = chartWidth / data.length - 10;

    return (
      <View style={styles.chartContainer}>
        <View style={[styles.barsContainer, { height }]}>
          {data.map((item, index) => {
            const barHeight = (item.value / maxValue) * (height - 40);
            const color = item.color || Colors.primary;

            return (
              <View key={index} style={styles.barWrapper}>
                <View style={styles.barContainer}>
                  {showValues && (
                    <Text style={styles.barValue}>
                      {typeof item.value === 'number' && item.value > 1000
                        ? item.value.toLocaleString()
                        : item.value}
                    </Text>
                  )}
                  <View
                    style={[
                      styles.bar,
                      {
                        height: barHeight,
                        width: barWidth,
                        backgroundColor: color,
                      },
                    ]}
                  />
                </View>
                <Text style={styles.barLabel} numberOfLines={2}>
                  {item.label}
                </Text>
              </View>
            );
          })}
        </View>
      </View>
    );
  };

  const renderLineChart = () => {
    const pointRadius = 4;
    const lineHeight = height - 60;
    const stepWidth = chartWidth / (data.length - 1);

    return (
      <View style={styles.chartContainer}>
        <View style={[styles.lineContainer, { height }]}>
          <View style={styles.lineChartArea}>
            {/* Grid lines */}
            {[0.25, 0.5, 0.75, 1].map((ratio, index) => (
              <View
                key={index}
                style={[
                  styles.gridLine,
                  {
                    bottom: ratio * lineHeight,
                    width: chartWidth,
                  },
                ]}
              />
            ))}

            {/* Data points and line */}
            <View style={styles.lineWrapper}>
              {data.map((item, index) => {
                const pointHeight = (item.value / maxValue) * lineHeight;
                const pointX = index * stepWidth;

                return (
                  <View key={index}>
                    {/* Line segment */}
                    {index < data.length - 1 && (
                      <View
                        style={[
                          styles.lineSegment,
                          {
                            left: pointX,
                            bottom: pointHeight,
                            width: stepWidth,
                            transform: [
                              {
                                rotate: `${Math.atan2(
                                  (data[index + 1].value / maxValue) * lineHeight - pointHeight,
                                  stepWidth
                                )}rad`,
                              },
                            ],
                          },
                        ]}
                      />
                    )}

                    {/* Data point */}
                    <View
                      style={[
                        styles.dataPoint,
                        {
                          left: pointX - pointRadius,
                          bottom: pointHeight - pointRadius,
                        },
                      ]}
                    >
                      {showValues && (
                        <Text style={styles.pointValue}>
                          {typeof item.value === 'number' && item.value > 1000
                            ? item.value.toLocaleString()
                            : item.value}
                        </Text>
                      )}
                    </View>
                  </View>
                );
              })}
            </View>
          </View>

          {/* X-axis labels */}
          <View style={styles.xAxisLabels}>
            {data.map((item, index) => (
              <Text key={index} style={styles.axisLabel} numberOfLines={1}>
                {item.label}
              </Text>
            ))}
          </View>
        </View>
      </View>
    );
  };

  const renderPieChart = () => {
    const total = data.reduce((sum, item) => sum + item.value, 0);
    const radius = Math.min(chartWidth, height) / 3;
    const centerX = chartWidth / 2;
    const centerY = height / 2;

    return (
      <View style={styles.chartContainer}>
        <View style={[styles.pieContainer, { height }]}>
          <View style={styles.pieChart}>
            {/* Simple pie representation with rectangles */}
            {data.map((item, index) => {
              const percentage = (item.value / total) * 100;
              const color = item.color || `hsl(${(index * 360) / data.length}, 70%, 50%)`;

              return (
                <View key={index} style={styles.pieSegment}>
                  <View
                    style={[styles.pieColor, { backgroundColor: color, width: `${percentage}%` }]}
                  />
                  <Text style={styles.pieLabel}>
                    {item.label}: {percentage.toFixed(1)}%
                  </Text>
                </View>
              );
            })}
          </View>
        </View>
      </View>
    );
  };

  const renderChart = () => {
    switch (type) {
      case 'line':
        return renderLineChart();
      case 'pie':
        return renderPieChart();
      case 'bar':
      default:
        return renderBarChart();
    }
  };

  return (
    <View style={styles.container}>
      {title && <Text style={styles.title}>{title}</Text>}
      {renderChart()}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 16,
    marginVertical: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 16,
    textAlign: 'center',
  },
  chartContainer: {
    alignItems: 'center',
  },
  barsContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-around',
    width: '100%',
  },
  barWrapper: {
    alignItems: 'center',
    flex: 1,
  },
  barContainer: {
    alignItems: 'center',
    justifyContent: 'flex-end',
    height: '80%',
  },
  bar: {
    borderRadius: 4,
    minHeight: 4,
  },
  barValue: {
    fontSize: 12,
    fontWeight: '500',
    color: Colors.text,
    marginBottom: 4,
  },
  barLabel: {
    fontSize: 10,
    color: Colors.lightText,
    textAlign: 'center',
    marginTop: 8,
  },
  lineContainer: {
    width: '100%',
  },
  lineChartArea: {
    position: 'relative',
    height: '80%',
    width: '100%',
  },
  gridLine: {
    position: 'absolute',
    height: 1,
    backgroundColor: Colors.lightGray,
  },
  lineWrapper: {
    position: 'relative',
    width: '100%',
    height: '100%',
  },
  lineSegment: {
    position: 'absolute',
    height: 2,
    backgroundColor: Colors.primary,
    transformOrigin: 'left center',
  },
  dataPoint: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.primary,
    borderWidth: 2,
    borderColor: Colors.white,
  },
  pointValue: {
    position: 'absolute',
    top: -20,
    left: -10,
    fontSize: 10,
    fontWeight: '500',
    color: Colors.text,
    textAlign: 'center',
    minWidth: 20,
  },
  xAxisLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
    height: '20%',
  },
  axisLabel: {
    fontSize: 10,
    color: Colors.lightText,
    textAlign: 'center',
    flex: 1,
  },
  pieContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  pieChart: {
    width: '100%',
  },
  pieSegment: {
    marginVertical: 4,
  },
  pieColor: {
    height: 20,
    borderRadius: 4,
    marginBottom: 4,
  },
  pieLabel: {
    fontSize: 12,
    color: Colors.text,
    fontWeight: '500',
  },
});

export default Chart;
