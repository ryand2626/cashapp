import React from 'react';

import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

import Icon from 'react-native-vector-icons/MaterialIcons';

import { useTheme } from '../../design-system/ThemeProvider';

interface Props {
  count: number;
  onPress?: () => void;
  testID?: string;
  size?: number;
  // fill prop is removed as color logic is internal and based on itemCount
}

const CartIcon: React.FC<Props> = ({ count, onPress, testID, size = 40 }) => {
  const { theme } = useTheme();
  const styles = createStyles(theme);

  const iconColor = count > 0 ? theme.colors.danger[500] : theme.colors.text;
  const hitSlop = { top: 10, bottom: 10, left: 10, right: 10 };

  const accessibilityLabel =
    count > 0
      ? `Shopping cart with ${count} ${count === 1 ? 'item' : 'items'}`
      : 'Shopping cart, empty';

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint="Double tap to view your cart"
      testID={testID}
      hitSlop={hitSlop}
    >
      <View style={styles.iconContainer}>
        <Icon name="shopping-cart" size={size} color={iconColor} />
        {count > 0 && (
          <View style={styles.badge} testID="cart-badge">
            <Text style={styles.badgeTxt}>{count > 99 ? '99+' : count}</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
};

const createStyles = (theme: any) =>
  StyleSheet.create({
    container: {
      padding: 8,
      minWidth: 44,
      minHeight: 44,
      alignItems: 'center',
      justifyContent: 'center',
    },
    iconContainer: {
      position: 'relative',
      alignItems: 'center',
      justifyContent: 'center',
    },
    badge: {
      position: 'absolute',
      top: -8,
      right: -8,
      backgroundColor: theme.colors.danger[500],
      borderRadius: 10,
      minWidth: 20,
      height: 20,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 4,
      borderWidth: 2,
      borderColor: theme.colors.white,
    },
    badgeTxt: {
      color: theme.colors.white,
      fontSize: 14,
      fontWeight: '600',
      lineHeight: 16,
    },
  });

export default CartIcon;
