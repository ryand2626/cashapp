/**
 * NFCService - Handles NFC device capabilities and proximity detection
 * Provides utilities for checking NFC availability and managing contactless payments
 */

import { Platform } from 'react-native';

import { logger } from '../utils/logger';

export interface NFCCapabilities {
  isSupported: boolean;
  isEnabled: boolean;
  canMakePayments: boolean;
  supportedMethods: string[];
}

export interface NFCProximityEvent {
  detected: boolean;
  deviceType?: 'card' | 'phone' | 'watch' | 'unknown';
  signal?: 'weak' | 'moderate' | 'strong';
}

class NFCServiceClass {
  private static instance: NFCServiceClass;
  private proximityCallback: ((event: NFCProximityEvent) => void) | null = null;

  private constructor() {}

  static getInstance(): NFCServiceClass {
    if (!NFCServiceClass.instance) {
      NFCServiceClass.instance = new NFCServiceClass();
    }
    return NFCServiceClass.instance;
  }

  /**
   * Check if NFC is supported on this device
   */
  async isNFCSupported(): Promise<boolean> {
    try {
      if (Platform.OS === 'ios') {
        // iOS devices since iPhone 6 support NFC for payments
        return true;
      } else if (Platform.OS === 'android') {
        // Most modern Android devices support NFC
        // This would typically use NativeModules to check actual NFC hardware
        return true;
      }
      return false;
    } catch (error) {
      console.error('Failed to check NFC support:', error);
      return false;
    }
  }

  /**
   * Check if NFC is currently enabled
   */
  async isNFCEnabled(): Promise<boolean> {
    try {
      // This would typically check device settings
      // For now, assume NFC is enabled if supported
      const isSupported = await this.isNFCSupported();
      return isSupported;
    } catch (error) {
      console.error('Failed to check NFC status:', error);
      return false;
    }
  }

  /**
   * Get complete NFC capabilities
   */
  async getNFCCapabilities(): Promise<NFCCapabilities> {
    try {
      const isSupported = await this.isNFCSupported();
      const isEnabled = await this.isNFCEnabled();

      const supportedMethods: string[] = [];

      if (isSupported && isEnabled) {
        if (Platform.OS === 'ios') {
          supportedMethods.push('apple_pay', 'contactless_card');
        } else if (Platform.OS === 'android') {
          supportedMethods.push('google_pay', 'contactless_card');
        }
      }

      return {
        isSupported,
        isEnabled,
        canMakePayments: isSupported && isEnabled,
        supportedMethods,
      };
    } catch (error) {
      console.error('Failed to get NFC capabilities:', error);
      return {
        isSupported: false,
        isEnabled: false,
        canMakePayments: false,
        supportedMethods: [],
      };
    }
  }

  /**
   * Start monitoring for NFC proximity events
   */
  startProximityDetection(callback: (event: NFCProximityEvent) => void): void {
    this.proximityCallback = callback;

    // This would typically start native NFC proximity monitoring
    // For now, we'll simulate proximity detection for demo purposes
    logger.info('Started NFC proximity detection');
  }

  /**
   * Stop monitoring for NFC proximity events
   */
  stopProximityDetection(): void {
    this.proximityCallback = null;
    logger.info('Stopped NFC proximity detection');
  }

  /**
   * Simulate device proximity (for development/testing)
   */
  simulateDeviceProximity(deviceType: 'card' | 'phone' | 'watch' = 'card'): void {
    if (this.proximityCallback) {
      // Simulate detection
      this.proximityCallback({
        detected: true,
        deviceType,
        signal: 'strong',
      });

      // Simulate device removal after 3 seconds
      setTimeout(() => {
        if (this.proximityCallback) {
          this.proximityCallback({
            detected: false,
          });
        }
      }, 3000);
    }
  }

  /**
   * Check if Apple Pay is available
   */
  async isApplePayAvailable(): Promise<boolean> {
    if (Platform.OS !== 'ios') {
      return false;
    }

    try {
      // This would typically use Apple Pay SDK to check availability
      return true;
    } catch (error) {
      console.error('Failed to check Apple Pay availability:', error);
      return false;
    }
  }

  /**
   * Check if Google Pay is available
   */
  async isGooglePayAvailable(): Promise<boolean> {
    if (Platform.OS !== 'android') {
      return false;
    }

    try {
      // This would typically use Google Pay SDK to check availability
      return true;
    } catch (error) {
      console.error('Failed to check Google Pay availability:', error);
      return false;
    }
  }

  /**
   * Get optimal payment method based on device capabilities
   */
  async getOptimalPaymentMethod(): Promise<'apple_pay' | 'google_pay' | 'nfc' | 'none'> {
    try {
      if (Platform.OS === 'ios') {
        const applePayAvailable = await this.isApplePayAvailable();
        if (applePayAvailable) {
          return 'apple_pay';
        }
      } else if (Platform.OS === 'android') {
        const googlePayAvailable = await this.isGooglePayAvailable();
        if (googlePayAvailable) {
          return 'google_pay';
        }
      }

      const nfcSupported = await this.isNFCSupported();
      if (nfcSupported) {
        return 'nfc';
      }

      return 'none';
    } catch (error) {
      console.error('Failed to get optimal payment method:', error);
      return 'none';
    }
  }

  /**
   * Guide user to enable NFC if disabled
   */
  getEnableNFCInstructions(): string {
    if (Platform.OS === 'ios') {
      return 'NFC is automatically enabled on iOS devices. Ensure you have Face ID/Touch ID set up for contactless payments.';
    } else if (Platform.OS === 'android') {
      return 'Go to Settings > Connected devices > Connection preferences > NFC and turn on NFC.';
    }
    return 'NFC is not supported on this device.';
  }

  /**
   * Get troubleshooting tips for NFC issues
   */
  getTroubleshootingTips(): string[] {
    const tips = [
      'Remove any phone case or thick cover',
      'Hold the card flat against the back of your device',
      'Wait for the NFC icon to pulse before bringing the card close',
      'Ensure NFC is enabled in your device settings',
    ];

    if (Platform.OS === 'ios') {
      tips.push('Make sure Face ID or Touch ID is set up and working');
      tips.push('Check that Apple Pay is set up in Wallet app');
    } else if (Platform.OS === 'android') {
      tips.push('Ensure Google Pay is installed and set up');
      tips.push('Check that your default payment app is configured');
    }

    return tips;
  }
}

export const NFCService = NFCServiceClass.getInstance();
export default NFCService;
