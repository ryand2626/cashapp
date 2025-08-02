import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';

import {
  View,
  Text,
  StyleSheet,
  Animated,
  TouchableOpacity,
  Dimensions,
  Platform,
  StatusBar,
} from 'react-native';

import Icon from 'react-native-vector-icons/MaterialIcons';

// Clover POS Color Scheme
const Colors = {
  primary: '#00A651',
  secondary: '#0066CC',
  success: '#00A651',
  warning: '#FF6B35',
  danger: '#E74C3C',
  info: '#3498DB',
  background: '#F5F5F5',
  white: '#FFFFFF',
  lightGray: '#E5E5E5',
  mediumGray: '#999999',
  darkGray: '#666666',
  text: '#333333',
  lightText: '#666666',
  border: '#DDDDDD',
};

export interface Notification {
  id: string;
  title: string;
  message: string;
  type: NotificationType;
  duration?: number;
  action?: NotificationAction;
  persistent?: boolean;
  position?: NotificationPosition;
}

export enum NotificationType {
  SUCCESS = 'success',
  ERROR = 'error',
  WARNING = 'warning',
  INFO = 'info',
  LOADING = 'loading',
}

export enum NotificationPosition {
  TOP = 'top',
  BOTTOM = 'bottom',
  CENTER = 'center',
}

export interface NotificationAction {
  label: string;
  onPress: () => void;
  style?: 'default' | 'primary' | 'danger';
}

interface NotificationContextType {
  showNotification: (notification: Omit<Notification, 'id'>) => string;
  hideNotification: (id: string) => void;
  clearAllNotifications: () => void;
  showSuccess: (title: string, message?: string, duration?: number) => string;
  showError: (title: string, message?: string, duration?: number) => string;
  showWarning: (title: string, message?: string, duration?: number) => string;
  showInfo: (title: string, message?: string, duration?: number) => string;
  showLoading: (title: string, message?: string) => string;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
const statusBarHeight = Platform.OS === 'ios' ? 44 : StatusBar.currentHeight || 0;

interface NotificationItemProps {
  notification: Notification;
  onHide: (id: string) => void;
  index: number;
}

const NotificationItem: React.FC<NotificationItemProps> = ({ notification, onHide, index }) => {
  const [animation] = useState(new Animated.Value(0));
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    // Slide in animation
    Animated.spring(animation, {
      toValue: 1,
      useNativeDriver: true,
      tension: 100,
      friction: 8,
    }).start();

    // Auto hide after duration
    if (!notification.persistent && notification.duration !== 0) {
      const timer = setTimeout(() => {
        hideNotification();
      }, notification.duration || 4000);

      return () => clearTimeout(timer);
    }
  }, []);

  const hideNotification = useCallback(() => {
    Animated.timing(animation, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true,
    }).start(() => {
      setVisible(false);
      onHide(notification.id);
    });
  }, [notification.id, onHide]);

  const getNotificationStyle = () => {
    switch (notification.type) {
      case NotificationType.SUCCESS:
        return { backgroundColor: Colors.success, iconName: 'check-circle' };
      case NotificationType.ERROR:
        return { backgroundColor: Colors.danger, iconName: 'error' };
      case NotificationType.WARNING:
        return { backgroundColor: Colors.warning, iconName: 'warning' };
      case NotificationType.INFO:
        return { backgroundColor: Colors.info, iconName: 'info' };
      case NotificationType.LOADING:
        return { backgroundColor: Colors.primary, iconName: 'hourglass-empty' };
      default:
        return { backgroundColor: Colors.mediumGray, iconName: 'notifications' };
    }
  };

  const getContainerStyle = () => {
    const baseTransform = [
      {
        translateY: animation.interpolate({
          inputRange: [0, 1],
          outputRange: notification.position === NotificationPosition.BOTTOM ? [100, 0] : [-100, 0],
        }),
      },
      {
        scale: animation.interpolate({
          inputRange: [0, 1],
          outputRange: [0.9, 1],
        }),
      },
    ];

    let positionStyle = {};
    const margin = 8;

    switch (notification.position) {
      case NotificationPosition.TOP:
        positionStyle = {
          top: statusBarHeight + margin + index * 80,
          left: margin,
          right: margin,
        };
        break;
      case NotificationPosition.BOTTOM:
        positionStyle = {
          bottom: margin + index * 80,
          left: margin,
          right: margin,
        };
        break;
      case NotificationPosition.CENTER:
        positionStyle = {
          top: screenHeight / 2 - 40 + index * 80,
          left: margin,
          right: margin,
        };
        break;
      default:
        positionStyle = {
          top: statusBarHeight + margin + index * 80,
          left: margin,
          right: margin,
        };
    }

    return {
      ...positionStyle,
      transform: baseTransform,
    };
  };

  const { backgroundColor, iconName } = getNotificationStyle();

  if (!visible) return null;

  return (
    <Animated.View style={[styles.notificationContainer, getContainerStyle()]}>
      <View style={[styles.notification, { backgroundColor }]}>
        <View style={styles.notificationContent}>
          <Icon name={iconName} size={24} color={Colors.white} style={styles.notificationIcon} />

          <View style={styles.notificationText}>
            <Text style={styles.notificationTitle} numberOfLines={1}>
              {notification.title}
            </Text>
            {notification.message && (
              <Text style={styles.notificationMessage} numberOfLines={2}>
                {notification.message}
              </Text>
            )}
          </View>

          {!notification.persistent && (
            <TouchableOpacity onPress={hideNotification} style={styles.closeButton}>
              <Icon name="close" size={20} color={Colors.white} />
            </TouchableOpacity>
          )}
        </View>

        {notification.action && (
          <TouchableOpacity
            style={[
              styles.actionButton,
              notification.action.style === 'primary' && styles.actionButtonPrimary,
              notification.action.style === 'danger' && styles.actionButtonDanger,
            ]}
            onPress={() => {
              notification.action?.onPress();
              if (!notification.persistent) {
                hideNotification();
              }
            }}
          >
            <Text style={styles.actionButtonText}>{notification.action.label}</Text>
          </TouchableOpacity>
        )}
      </View>
    </Animated.View>
  );
};

interface NotificationProviderProps {
  children: React.ReactNode;
  maxNotifications?: number;
}

export const NotificationProvider: React.FC<NotificationProviderProps> = ({
  children,
  maxNotifications = 5,
}) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const showNotification = useCallback(
    (notificationData: Omit<Notification, 'id'>): string => {
      const id = `notification_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const notification: Notification = {
        id,
        position: NotificationPosition.TOP,
        duration: 4000,
        ...notificationData,
      };

      setNotifications((prev) => {
        const newNotifications = [notification, ...prev];
        // Limit the number of notifications
        return newNotifications.slice(0, maxNotifications);
      });

      return id;
    },
    [maxNotifications]
  );

  const hideNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const clearAllNotifications = useCallback(() => {
    setNotifications([]);
  }, []);

  const showSuccess = useCallback(
    (title: string, message?: string, duration?: number): string => {
      return showNotification({
        title,
        message,
        type: NotificationType.SUCCESS,
        duration,
      });
    },
    [showNotification]
  );

  const showError = useCallback(
    (title: string, message?: string, duration?: number): string => {
      return showNotification({
        title,
        message,
        type: NotificationType.ERROR,
        duration: duration || 6000, // Longer duration for errors
      });
    },
    [showNotification]
  );

  const showWarning = useCallback(
    (title: string, message?: string, duration?: number): string => {
      return showNotification({
        title,
        message,
        type: NotificationType.WARNING,
        duration,
      });
    },
    [showNotification]
  );

  const showInfo = useCallback(
    (title: string, message?: string, duration?: number): string => {
      return showNotification({
        title,
        message,
        type: NotificationType.INFO,
        duration,
      });
    },
    [showNotification]
  );

  const showLoading = useCallback(
    (title: string, message?: string): string => {
      return showNotification({
        title,
        message,
        type: NotificationType.LOADING,
        persistent: true,
        duration: 0,
      });
    },
    [showNotification]
  );

  const contextValue: NotificationContextType = {
    showNotification,
    hideNotification,
    clearAllNotifications,
    showSuccess,
    showError,
    showWarning,
    showInfo,
    showLoading,
  };

  return (
    <NotificationContext.Provider value={contextValue}>
      {children}
      <View style={styles.notificationContainer} pointerEvents="box-none">
        {notifications.map((notification, index) => (
          <NotificationItem
            key={notification.id}
            notification={notification}
            onHide={hideNotification}
            index={index}
          />
        ))}
      </View>
    </NotificationContext.Provider>
  );
};

export const useNotification = (): NotificationContextType => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotification must be used within a NotificationProvider');
  }
  return context;
};

// Progress indicator component for long operations
interface ProgressNotificationProps {
  title: string;
  progress: number; // 0-100
  message?: string;
  onCancel?: () => void;
}

export const ProgressNotification: React.FC<ProgressNotificationProps> = ({
  title,
  progress,
  message,
  onCancel,
}) => {
  const [animation] = useState(new Animated.Value(0));

  useEffect(() => {
    Animated.timing(animation, {
      toValue: progress / 100,
      duration: 300,
      useNativeDriver: false,
    }).start();
  }, [progress]);

  return (
    <View style={styles.progressNotification}>
      <View style={styles.progressHeader}>
        <Text style={styles.progressTitle}>{title}</Text>
        {onCancel && (
          <TouchableOpacity onPress={onCancel}>
            <Icon name="close" size={20} color={Colors.text} />
          </TouchableOpacity>
        )}
      </View>

      {message && <Text style={styles.progressMessage}>{message}</Text>}

      <View style={styles.progressBarContainer}>
        <Animated.View
          style={[
            styles.progressBar,
            {
              width: animation.interpolate({
                inputRange: [0, 1],
                outputRange: ['0%', '100%'],
              }),
            },
          ]}
        />
      </View>

      <Text style={styles.progressText}>{Math.round(progress)}%</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  notificationContainer: {
    position: 'absolute',
    zIndex: 9999,
  },
  notification: {
    borderRadius: 12,
    padding: 16,
    marginVertical: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  notificationContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  notificationIcon: {
    marginRight: 12,
  },
  notificationText: {
    flex: 1,
  },
  notificationTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.white,
    marginBottom: 2,
  },
  notificationMessage: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.9)',
    lineHeight: 18,
  },
  closeButton: {
    padding: 4,
    marginLeft: 8,
  },
  actionButton: {
    marginTop: 12,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignSelf: 'flex-start',
  },
  actionButtonPrimary: {
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  actionButtonDanger: {
    backgroundColor: 'rgba(231, 76, 60, 0.3)',
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.white,
  },
  progressNotification: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 16,
    margin: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  progressTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
  },
  progressMessage: {
    fontSize: 14,
    color: Colors.lightText,
    marginBottom: 12,
  },
  progressBarContainer: {
    height: 6,
    backgroundColor: Colors.lightGray,
    borderRadius: 3,
    marginBottom: 8,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: Colors.primary,
    borderRadius: 3,
  },
  progressText: {
    fontSize: 12,
    color: Colors.lightText,
    textAlign: 'right',
  },
});

export default NotificationProvider;
