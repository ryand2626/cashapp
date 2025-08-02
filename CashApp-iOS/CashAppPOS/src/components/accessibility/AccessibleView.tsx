import React from 'react';

import type {
  ViewProps,
  AccessibilityRole,
  AccessibilityState,
  AccessibilityProps,
} from 'react-native';
import { View, StyleSheet } from 'react-native';

import { createAccessibilityState } from '../../utils/accessibility';

// Enhanced accessibility props
export interface AccessibleViewProps extends ViewProps, Omit<AccessibilityProps, 'accessible'> {
  children: React.ReactNode;
  // Enhanced accessibility options
  accessibilityLabel?: string;
  accessibilityHint?: string;
  accessibilityRole?: AccessibilityRole;
  accessibilityState?:
    | AccessibilityState
    | {
        selected?: boolean;
        disabled?: boolean;
        checked?: boolean;
        expanded?: boolean;
        busy?: boolean;
      };
  // Semantic options
  semanticRole?: 'header' | 'main' | 'navigation' | 'section' | 'footer' | 'article';
  focusable?: boolean;
  importantForAccessibility?: 'auto' | 'yes' | 'no' | 'no-hide-descendants';
  // Screen reader optimizations
  screenReaderOnly?: boolean;
  // Custom accessibility announcements
  accessibilityAnnouncement?: string;
}

const AccessibleView: React.FC<AccessibleViewProps> = ({
  children,
  accessibilityLabel,
  accessibilityHint,
  accessibilityRole,
  accessibilityState,
  semanticRole,
  focusable = false,
  importantForAccessibility = 'auto',
  screenReaderOnly = false,
  accessibilityAnnouncement,
  style,
  ...viewProps
}) => {
  // Convert semantic role to accessibility role
  const getAccessibilityRole = (): AccessibilityRole | undefined => {
    if (accessibilityRole) return accessibilityRole;

    switch (semanticRole) {
      case 'header':
        return 'header';
      case 'navigation':
        return 'menu';
      case 'main':
      case 'section':
      case 'article':
      case 'footer':
        return 'none'; // Use 'none' for structural elements
      default:
        return undefined;
    }
  };

  // Normalize accessibility state
  const normalizedAccessibilityState = accessibilityState
    ? 'selected' in accessibilityState || 'disabled' in accessibilityState
      ? createAccessibilityState(accessibilityState as unknown)
      : (accessibilityState as AccessibilityState)
    : undefined;

  // Screen reader only styles
  const screenReaderOnlyStyle = screenReaderOnly
    ? {
        position: 'absolute' as const,
        left: -10000,
        width: 1,
        height: 1,
        overflow: 'hidden' as const,
      }
    : {};

  const accessibilityProps: AccessibilityProps = {
    accessible: !!(accessibilityLabel || accessibilityHint || accessibilityRole),
    accessibilityLabel,
    accessibilityHint,
    accessibilityRole: getAccessibilityRole(),
    accessibilityState: normalizedAccessibilityState,
    importantForAccessibility,
    ...(focusable && { focusable: true }),
  };

  return (
    <View style={[style, screenReaderOnlyStyle]} {...accessibilityProps} {...viewProps}>
      {children}
    </View>
  );
};

// Skip Links Component for keyboard navigation
export interface SkipLinksProps {
  links: Array<{
    label: string;
    target: string;
    onPress: () => void;
  }>;
}

export const SkipLinks: React.FC<SkipLinksProps> = ({ links }) => {
  return (
    <AccessibleView
      semanticRole="navigation"
      accessibilityLabel="Skip navigation"
      screenReaderOnly
      style={styles.skipLinksContainer}
    >
      {links.map((link, index) => (
        <AccessibleView
          key={index}
          accessibilityRole="link"
          accessibilityLabel={link.label}
          focusable
          onTouchEnd={link.onPress}
          style={styles.skipLink}
        >
          {/* Skip link content would go here */}
        </AccessibleView>
      ))}
    </AccessibleView>
  );
};

// Landmark component for page structure
export interface LandmarkProps {
  children: React.ReactNode;
  role: 'banner' | 'main' | 'navigation' | 'complementary' | 'contentinfo' | 'search' | 'form';
  label?: string;
  style?: ViewProps['style'];
}

export const Landmark: React.FC<LandmarkProps> = ({ children, role, label, style }) => {
  const getAccessibilityRole = (): AccessibilityRole => {
    switch (role) {
      case 'banner':
        return 'header';
      case 'navigation':
        return 'menu';
      case 'search':
        return 'search';
      case 'main':
      case 'complementary':
      case 'contentinfo':
      case 'form':
      default:
        return 'none';
    }
  };

  return (
    <AccessibleView
      accessibilityRole={getAccessibilityRole()}
      accessibilityLabel={label}
      style={style}
    >
      {children}
    </AccessibleView>
  );
};

// Live Region for dynamic content announcements
export interface LiveRegionProps {
  children: React.ReactNode;
  politeness?: 'polite' | 'assertive' | 'off';
  atomic?: boolean;
  style?: ViewProps['style'];
}

export const LiveRegion: React.FC<LiveRegionProps> = ({
  children,
  politeness = 'polite',
  atomic = false,
  style,
}) => {
  return (
    <AccessibleView
      accessibilityLiveRegion={politeness}
      accessibilityLabel={atomic ? 'Live region' : undefined}
      style={style}
    >
      {children}
    </AccessibleView>
  );
};

// Focus Trap for modals and overlays
export interface FocusTrapProps {
  children: React.ReactNode;
  active: boolean;
  onEscape?: () => void;
  style?: ViewProps['style'];
}

export const FocusTrap: React.FC<FocusTrapProps> = ({ children, active, _onEscape, style }) => {
  // In a real implementation, this would manage focus trapping
  // For now, it's a semantic wrapper

  return (
    <AccessibleView
      importantForAccessibility={active ? 'yes' : 'no-hide-descendants'}
      accessibilityViewIsModal={active}
      style={style}
    >
      {children}
    </AccessibleView>
  );
};

const styles = StyleSheet.create({
  skipLinksContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    zIndex: 9999,
  },
  skipLink: {
    backgroundColor: '#000',
    color: '#fff',
    padding: 8,
    textDecorationLine: 'underline',
  },
});

export default AccessibleView;
