import React from 'react';

import type { ViewStyle } from 'react-native';
import { View, StyleSheet } from 'react-native';

import { useTheme } from '../../design-system/ThemeProvider';
import { useResponsiveColumns, useResponsiveSpacing } from '../../hooks/useResponsive';

import type { Theme, spacing } from '../../design-system/theme';

// Grid props interface
export interface ResponsiveGridProps {
  children: React.ReactNode;
  columns?: {
    xs?: number;
    sm?: number;
    md?: number;
    lg?: number;
    xl?: number;
    xxl?: number;
  };
  spacing?: {
    xs?: keyof typeof spacing;
    sm?: keyof typeof spacing;
    md?: keyof typeof spacing;
    lg?: keyof typeof spacing;
    xl?: keyof typeof spacing;
    xxl?: keyof typeof spacing;
  };
  style?: ViewStyle;
  testID?: string;
}

// Grid item props interface
export interface GridItemProps {
  children: React.ReactNode;
  span?: {
    xs?: number;
    sm?: number;
    md?: number;
    lg?: number;
    xl?: number;
    xxl?: number;
  };
  style?: ViewStyle;
}

const ResponsiveGrid: React.FC<ResponsiveGridProps> = ({
  children,
  columns = { xs: 1, sm: 2, md: 3, lg: 4, xl: 5, xxl: 6 },
  spacing: spacingProp = { xs: 2, sm: 3, md: 4 },
  style,
  testID,
}) => {
  const { theme } = useTheme();
  const currentColumns = useResponsiveColumns(columns, 1);
  const currentSpacing = useResponsiveSpacing(spacingProp, 4);
  const spacingValue = theme.spacing[currentSpacing];

  // Create dynamic styles based on current values
  const dynamicStyles = createDynamicStyles(theme, currentColumns, spacingValue);

  // Convert children to array for processing
  const childArray = React.Children.toArray(children);

  // Group children into rows
  const rows: React.ReactNode[][] = [];
  for (let i = 0; i < childArray.length; i += currentColumns) {
    rows.push(childArray.slice(i, i + currentColumns));
  }

  return (
    <View style={[dynamicStyles.grid, style]} testID={testID}>
      {rows.map((row, rowIndex) => (
        <View key={rowIndex} style={[dynamicStyles.row, dynamicStyles.rowWithMargin]}>
          {row.map((child, itemIndex) => {
            const isFirstItem = itemIndex === 0;
            const isLastItem = itemIndex === row.length - 1;

            return (
              <View
                key={itemIndex}
                style={[
                  dynamicStyles.item,
                  !isFirstItem && dynamicStyles.itemWithLeftPadding,
                  !isLastItem && dynamicStyles.itemWithRightPadding,
                ]}
              >
                {child}
              </View>
            );
          })}
          {/* Fill empty columns in the last row */}
          {row.length < currentColumns &&
            Array.from({ length: currentColumns - row.length }).map((_, emptyIndex) => {
              const isLastEmpty = emptyIndex === currentColumns - row.length - 1;

              return (
                <View
                  key={`empty-${emptyIndex}`}
                  style={[
                    dynamicStyles.item,
                    dynamicStyles.itemWithLeftPadding,
                    !isLastEmpty && dynamicStyles.itemWithRightPadding,
                  ]}
                />
              );
            })}
        </View>
      ))}
    </View>
  );
};

// Grid Item Component with span support
export const GridItem: React.FC<GridItemProps> = ({ children, _span, style }) => {
  // Note: Span functionality would require more complex layout calculations
  // For now, this is a simple wrapper that can be extended
  return <View style={style}>{children}</View>;
};

const createDynamicStyles = (_theme: Theme, columns: number, spacing: number) => {
  const itemWidth = `${100 / columns}%`;
  const halfSpacing = spacing / 2;

  return StyleSheet.create({
    grid: {
      // Base grid container
    },
    row: {
      flexDirection: 'row',
      alignItems: 'stretch',
    },
    rowWithMargin: {
      marginBottom: spacing,
    },
    item: {
      width: itemWidth,
    },
    itemWithLeftPadding: {
      paddingLeft: halfSpacing,
    },
    itemWithRightPadding: {
      paddingRight: halfSpacing,
    },
  });
};

export default ResponsiveGrid;
