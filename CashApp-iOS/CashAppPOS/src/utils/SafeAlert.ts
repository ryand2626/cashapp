import type { AlertButton, AlertOptions } from 'react-native';
import { Alert } from 'react-native';

/**
 * SafeAlert - Prevents modal presentation conflicts by queuing alerts
 */
class SafeAlertManager {
  private isShowingAlert = false;
  private alertQueue: Array<{
    title: string;
    message?: string;
    buttons?: AlertButton[];
    options?: AlertOptions;
  }> = [];

  alert(title: string, message?: string, buttons?: AlertButton[], options?: AlertOptions) {
    // Add to queue
    this.alertQueue.push({ title, message, buttons, options });

    // Process queue if not already showing an alert
    if (!this.isShowingAlert) {
      this.processQueue();
    }
  }

  private processQueue() {
    if (this.alertQueue.length === 0) {
      this.isShowingAlert = false;
      return;
    }

    const alert = this.alertQueue.shift();
    if (!alert) return;

    this.isShowingAlert = true;

    // Wrap button callbacks to process next alert after dismissal
    const wrappedButtons = alert.buttons?.map((button) => ({
      ...button,
      onPress: (...args: any[]) => {
        // Call original onPress if exists
        if (button.onPress) {
          button.onPress(...args);
        }

        // Process next alert in queue after a small delay
        setTimeout(() => {
          this.isShowingAlert = false;
          this.processQueue();
        }, 100);
      },
    })) || [
      {
        text: 'OK',
        onPress: () => {
          setTimeout(() => {
            this.isShowingAlert = false;
            this.processQueue();
          }, 100);
        },
      },
    ];

    // Show the alert
    Alert.alert(alert.title, alert.message, wrappedButtons, alert.options);
  }

  // Clear the queue (useful for cleanup)
  clearQueue() {
    this.alertQueue = [];
    this.isShowingAlert = false;
  }
}

// Export singleton instance
export const SafeAlert = new SafeAlertManager();
