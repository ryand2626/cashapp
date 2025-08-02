import React, { useEffect, useRef } from 'react';

import { View, StyleSheet, Animated, Dimensions } from 'react-native';

// Clover POS Color Scheme
const Colors = {
  background: '#F5F5F5',
  lightGray: '#E5E5E5',
  mediumGray: '#999999',
  border: '#DDDDDD',
};

const { width: screenWidth } = Dimensions.get('window');

interface SkeletonLoaderProps {
  width?: number | string;
  height?: number;
  borderRadius?: number;
  style?: any;
}

const SkeletonLoader: React.FC<SkeletonLoaderProps> = ({
  width = '100%',
  height = 20,
  borderRadius = 4,
  style,
}) => {
  const animatedValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const shimmerAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(animatedValue, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: false,
        }),
        Animated.timing(animatedValue, {
          toValue: 0,
          duration: 1000,
          useNativeDriver: false,
        }),
      ])
    );

    shimmerAnimation.start();

    return () => shimmerAnimation.stop();
  }, [animatedValue]);

  const translateX = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [-screenWidth, screenWidth],
  });

  return (
    <View
      style={[
        styles.container,
        {
          width,
          height,
          borderRadius,
        },
        style,
      ]}
    >
      <Animated.View
        style={[
          styles.shimmer,
          {
            transform: [{ translateX }],
          },
        ]}
      />
    </View>
  );
};

// Pre-built skeleton components for common use cases
export const MenuItemSkeleton: React.FC = () => (
  <View style={styles.menuItemSkeleton}>
    <SkeletonLoader width="100%" height={120} borderRadius={8} style={{ marginBottom: 8 }} />
    <SkeletonLoader width="80%" height={16} style={{ marginBottom: 4 }} />
    <SkeletonLoader width="60%" height={14} style={{ marginBottom: 8 }} />
    <SkeletonLoader width="40%" height={18} />
  </View>
);

export const OrderItemSkeleton: React.FC = () => (
  <View style={styles.orderItemSkeleton}>
    <SkeletonLoader width={50} height={50} borderRadius={25} style={{ marginRight: 12 }} />
    <View style={styles.orderItemContent}>
      <SkeletonLoader width="70%" height={16} style={{ marginBottom: 4 }} />
      <SkeletonLoader width="50%" height={14} style={{ marginBottom: 4 }} />
      <SkeletonLoader width="30%" height={16} />
    </View>
  </View>
);

export const TableSkeleton: React.FC = () => (
  <View style={styles.tableSkeleton}>
    <SkeletonLoader width={60} height={60} borderRadius={30} style={{ marginBottom: 8 }} />
    <SkeletonLoader width="80%" height={14} style={{ marginBottom: 4 }} />
    <SkeletonLoader width="60%" height={12} />
  </View>
);

export const ReportCardSkeleton: React.FC = () => (
  <View style={styles.reportCardSkeleton}>
    <SkeletonLoader width="100%" height={16} style={{ marginBottom: 8 }} />
    <SkeletonLoader width="40%" height={24} style={{ marginBottom: 8 }} />
    <SkeletonLoader width="60%" height={14} />
  </View>
);

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.lightGray,
    overflow: 'hidden',
    position: 'relative',
  },
  shimmer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.6)',
    width: '100%',
  },
  menuItemSkeleton: {
    backgroundColor: Colors.background,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  orderItemSkeleton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background,
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  orderItemContent: {
    flex: 1,
  },
  tableSkeleton: {
    alignItems: 'center',
    backgroundColor: Colors.background,
    borderRadius: 12,
    padding: 16,
    margin: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  reportCardSkeleton: {
    backgroundColor: Colors.background,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
});

export default SkeletonLoader;
