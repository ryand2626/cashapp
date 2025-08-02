/**
 * Error Handler Service
 * Maps backend errors to user-friendly messages
 * Ensures no sensitive information is exposed to users
 */

import { Alert } from 'react-native';

import type { NavigationProp } from '@react-navigation/native';

// Error codes from backend
export const ErrorCodes = {
  // Authentication
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',

  // Validation
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  MISSING_REQUIRED_FIELD: 'MISSING_REQUIRED_FIELD',
  INVALID_FORMAT: 'INVALID_FORMAT',

  // Business Logic
  INSUFFICIENT_STOCK: 'INSUFFICIENT_STOCK',
  INVALID_ORDER_STATE: 'INVALID_ORDER_STATE',
  ORDER_CANNOT_BE_MODIFIED: 'ORDER_CANNOT_BE_MODIFIED',
  PAYMENT_FAILED: 'PAYMENT_FAILED',

  // Resources
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',

  // System
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
  RATE_LIMITED: 'RATE_LIMITED',
} as const;

export interface UserFriendlyError {
  title: string;
  message: string;
  action?: 'retry' | 'logout' | 'contact_support' | 'navigate_back';
  requestId?: string;
}

export interface BackendError {
  success?: boolean;
  message?: string;
  error?: string;
  error_code?: string;
  details?: unknown;
  error_id?: string;
  request_id?: string;
  status_code?: number;
}

class ErrorHandler {
  private static instance: ErrorHandler;
  private navigation: NavigationProp<unknown> | null = null;

  static getInstance(): ErrorHandler {
    if (!ErrorHandler.instance) {
      ErrorHandler.instance = new ErrorHandler();
    }
    return ErrorHandler.instance;
  }

  setNavigation(navigation: NavigationProp<unknown>) {
    this.navigation = navigation;
  }

  /**
   * Maps backend errors to user-friendly messages
   * Never exposes technical details in production
   */
  handle(error: unknown): UserFriendlyError {
    // Log full error for debugging (in dev only)
    if (__DEV__) {
      logger.error('Full error:', error);
    }

    // Extract error information safely
    const errorData = this.extractErrorData(error);
    const errorCode = errorData.error_code || errorData.error;
    const requestId = errorData.error_id || errorData.request_id;

    // Map to user-friendly message based on error code
    switch (errorCode) {
      // Authentication errors
      case ErrorCodes.INVALID_CREDENTIALS:
        return {
          title: 'Login Failed',
          message: 'Please check your email and password and try again.',
          action: 'retry',
          requestId,
        };

      case ErrorCodes.TOKEN_EXPIRED:
        return {
          title: 'Session Expired',
          message: 'Please log in again to continue.',
          action: 'logout',
          requestId,
        };

      case ErrorCodes.UNAUTHORIZED:
      case ErrorCodes.FORBIDDEN:
        return {
          title: 'Access Denied',
          message:
            "You don't have permission to perform this action. Contact your manager if you need access.",
          action: 'navigate_back',
          requestId,
        };

      // Validation errors
      case ErrorCodes.VALIDATION_ERROR:
      case ErrorCodes.MISSING_REQUIRED_FIELD:
      case ErrorCodes.INVALID_FORMAT:
        return {
          title: 'Invalid Input',
          message: 'Please check your input and try again.',
          action: 'retry',
          requestId,
        };

      // Business logic errors
      case ErrorCodes.INSUFFICIENT_STOCK:
        return {
          title: 'Item Unavailable',
          message: 'This item is currently out of stock. Please choose an alternative.',
          action: 'navigate_back',
          requestId,
        };

      case ErrorCodes.INVALID_ORDER_STATE:
      case ErrorCodes.ORDER_CANNOT_BE_MODIFIED:
        return {
          title: 'Order Cannot Be Changed',
          message:
            'This order has already been sent to the kitchen. Contact staff if changes are needed.',
          action: 'navigate_back',
          requestId,
        };

      case ErrorCodes.PAYMENT_FAILED:
        return {
          title: 'Payment Failed',
          message: 'Unable to process payment. Please try again or use a different payment method.',
          action: 'retry',
          requestId,
        };

      // Resource errors
      case ErrorCodes.NOT_FOUND:
        return {
          title: 'Not Found',
          message: 'The requested item could not be found.',
          action: 'navigate_back',
          requestId,
        };

      case ErrorCodes.CONFLICT:
        return {
          title: 'Update Conflict',
          message: 'This item has been modified. Please refresh and try again.',
          action: 'retry',
          requestId,
        };

      // Rate limiting
      case ErrorCodes.RATE_LIMITED:
        return {
          title: 'Too Many Requests',
          message: 'Please slow down and try again in a moment.',
          action: 'retry',
          requestId,
        };

      // Network errors
      default:
        if (this.isNetworkError(error)) {
          return {
            title: 'Connection Error',
            message: 'Please check your internet connection and try again.',
            action: 'retry',
            requestId,
          };
        }

        // Generic fallback - never expose technical details
        return {
          title: 'Something Went Wrong',
          message:
            'An unexpected error occurred. Please try again or contact support if the issue persists.',
          action: 'contact_support',
          requestId,
        };
    }
  }

  /**
   * Shows user-friendly error alert
   */
  showError(error: unknown, customTitle?: string) {
    const userError = this.handle(error);
    const title = customTitle || userError.title;

    const buttons: unknown[] = [];

    // Add action button based on error type
    switch (userError.action) {
      case 'retry':
        buttons.push({ text: 'Try Again', style: 'default' });
        break;

      case 'logout':
        buttons.push({
          text: 'Log In',
          onPress: () => this.handleLogout(),
        });
        break;

      case 'navigate_back':
        buttons.push({
          text: 'Go Back',
          onPress: () => this.navigation?.goBack(),
        });
        break;

      case 'contact_support':
        buttons.push({
          text: 'Contact Support',
          onPress: () => this.showSupportInfo(userError.requestId),
        });
        break;
    }

    // Always add dismiss button
    buttons.push({ text: 'Dismiss', style: 'cancel' });

    Alert.alert(title, userError.message, buttons);
  }

  /**
   * Extracts error data from various error formats
   */
  private extractErrorData(error: unknown): BackendError {
    // API response error
    if (error?.response?.data) {
      return error.response.data;
    }

    // Direct error object
    if (error?.error_code || error?.error) {
      return error;
    }

    // Axios error
    if (error?.response?.status) {
      return {
        status_code: error.response.status,
        message: error.message,
      };
    }

    // Network error
    if (error?.code === 'NETWORK_ERROR' || error?.message?.includes('Network')) {
      return {
        error: 'NETWORK_ERROR',
        message: 'Network request failed',
      };
    }

    // Unknown error
    return {
      error: 'UNKNOWN_ERROR',
      message: error?.message || 'Unknown error occurred',
    };
  }

  /**
   * Checks if error is network-related
   */
  private isNetworkError(error: unknown): boolean {
    const errorData = this.extractErrorData(error);
    return (
      errorData.error === 'NETWORK_ERROR' ||
      errorData.status_code === 0 ||
      error?.code === 'ECONNABORTED' ||
      error?.message?.toLowerCase().includes('network') ||
      error?.message?.toLowerCase().includes('connection')
    );
  }

  /**
   * Handles logout action
   */
  private handleLogout() {
    // This should be implemented based on your auth context
    // For now, navigate to login
    this.navigation?.navigate('Login' as unknown);
  }

  /**
   * Shows support contact information
   */
  private showSupportInfo(requestId?: string) {
    const message = requestId
      ? `Please contact support with reference ID: ${requestId}`
      : 'Please contact support at support@fynlo.co.uk';

    Alert.alert('Contact Support', message, [{ text: 'OK', style: 'default' }]);
  }

  /**
   * Formats error for logging (dev only)
   */
  formatForLogging(error: unknown): string {
    if (!__DEV__) {
      return '[Error logging disabled in production]';
    }

    const errorData = this.extractErrorData(error);
    return JSON.stringify(
      {
        error_code: errorData.error_code,
        message: errorData.message,
        error_id: errorData.error_id,
        timestamp: new Date().toISOString(),
      },
      null,
      2
    );
  }
}

// Export singleton instance
export const errorHandler = ErrorHandler.getInstance();

// Export error boundary component
export { default as ErrorBoundary } from '../components/ErrorBoundary';
