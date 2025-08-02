import React from 'react';

import { StyleSheet, _View, TouchableOpacity, Animated, Easing } from 'react-native';

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

interface ToggleSwitchProps {
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
  size?: 'small' | 'medium' | 'large';
  activeColor?: string;
  inactiveColor?: string;
  thumbColor?: string;
}

const ToggleSwitch: React.FC<ToggleSwitchProps> = ({
  value,
  onValueChange,
  disabled = false,
  size = 'medium',
  activeColor = Colors.primary,
  inactiveColor = Colors.lightGray,
  thumbColor = Colors.white,
}) => {
  const animatedValue = React.useRef(new Animated.Value(value ? 1 : 0)).current;

  // Size configurations
  const sizeConfig = {
    small: { width: 40, height: 24, thumbSize: 20, padding: 2 },
    medium: { width: 48, height: 28, thumbSize: 24, padding: 2 },
    large: { width: 56, height: 32, thumbSize: 28, padding: 2 },
  };

  const config = sizeConfig[size];

  React.useEffect(() => {
    Animated.timing(animatedValue, {
      toValue: value ? 1 : 0,
      duration: 200,
      easing: Easing.bezier(0.4, 0.0, 0.2, 1),
      useNativeDriver: false,
    }).start();
  }, [value, animatedValue]);

  const handlePress = () => {
    if (!disabled) {
      onValueChange(!value);
    }
  };

  const trackColor = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [inactiveColor, activeColor],
  });

  const thumbTranslate = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0, config.width - config.thumbSize - config.padding * 2],
  });

  const thumbScale = animatedValue.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [1, 1.1, 1],
  });

  const dynamicStyles = React.useMemo(
    () => createDynamicStyles(config, disabled),
    [config, disabled]
  );

  return (
    <TouchableOpacity
      onPress={handlePress}
      disabled={disabled}
      activeOpacity={0.8}
      style={[styles.container, dynamicStyles.container, disabled && styles.containerDisabled]}
    >
      <Animated.View
        style={[
          styles.track,
          dynamicStyles.track,
          {
            backgroundColor: trackColor,
          },
        ]}
      />
      <Animated.View
        style={[
          styles.thumb,
          dynamicStyles.thumb,
          {
            backgroundColor: thumbColor,
            transform: [{ translateX: thumbTranslate }, { scale: thumbScale }],
          },
        ]}
      />
    </TouchableOpacity>
  );
};

const createDynamicStyles = (config: any, disabled: boolean) =>
  StyleSheet.create({
    container: {
      width: config.width,
      height: config.height,
    },
    track: {
      width: config.width,
      height: config.height,
    },
    thumb: {
      width: config.thumbSize,
      height: config.thumbSize,
      top: config.padding,
      left: config.padding,
    },
  });

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    justifyContent: 'center',
  },
  containerDisabled: {
    opacity: 0.5,
  },
  track: {
    borderRadius: 100,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  thumb: {
    position: 'absolute',
    borderRadius: 100,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
});

export default ToggleSwitch;
