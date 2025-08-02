import { Platform, Alert } from 'react-native';

export interface SumUpCompatibilityResult {
  isSupported: boolean;
  hasEntitlements: boolean;
  requiresApproval: boolean;
  fallbackMessage: string;
  actionRequired: string[];
}

class SumUpCompatibilityService {
  private static instance: SumUpCompatibilityService;

  public static getInstance(): SumUpCompatibilityService {
    if (!SumUpCompatibilityService.instance) {
      SumUpCompatibilityService.instance = new SumUpCompatibilityService();
    }
    return SumUpCompatibilityService.instance;
  }

  /**
   * Check if SumUp Tap to Pay is supported on this device and app configuration
   */
  public async checkCompatibility(): Promise<SumUpCompatibilityResult> {
    const result: SumUpCompatibilityResult = {
      isSupported: false,
      hasEntitlements: false,
      requiresApproval: true,
      fallbackMessage: '',
      actionRequired: [],
    };

    // Check platform
    if (Platform.OS !== 'ios') {
      result.fallbackMessage = 'Tap to Pay on iPhone is only available on iOS devices.';
      result.actionRequired.push('Use an iPhone to access Tap to Pay features');
      return result;
    }

    // Check iOS version (Tap to Pay requires iOS 15.4+)
    const iosVersion = parseFloat(Platform.Version as string);
    if (iosVersion < 15.4) {
      result.fallbackMessage = `Tap to Pay requires iOS 15.4 or later. Current version: ${Platform.Version}`;
      result.actionRequired.push('Update to iOS 15.4 or later');
      return result;
    }

    // Check device compatibility (iPhone XS or later for Tap to Pay)
    const deviceSupported = await this.checkDeviceCompatibility();
    if (!deviceSupported) {
      result.fallbackMessage = 'Tap to Pay requires iPhone XS or later with NFC capability.';
      result.actionRequired.push('Use a compatible iPhone (XS or newer)');
      return result;
    }

    // The main issue: Check for Apple entitlements
    result.hasEntitlements = false; // We know we don't have approval yet
    result.requiresApproval = true;
    result.fallbackMessage = 'Tap to Pay on iPhone requires Apple approval and entitlements.';
    result.actionRequired = [
      '1. Apply for Tap to Pay entitlement at https://developer.apple.com/contact/request/tap-to-pay-on-iphone/',
      '2. Wait for Apple approval (can take weeks)',
      '3. Update app with approved entitlements',
      '4. Submit app for App Store review',
    ];

    result.isSupported = false; // Not supported until Apple approval
    return result;
  }

  /**
   * Check if the device supports Tap to Pay hardware requirements
   */
  private async checkDeviceCompatibility(): Promise<boolean> {
    // This is a simplified check - in reality, you'd need to check device model
    // For now, assume modern iOS devices support it if they have NFC
    try {
      // Note: There's no direct way to check NFC support via React Native
      // This would require native iOS code to check device capabilities
      return true; // Assume compatible for now
    } catch (error) {
      console.error('Device compatibility check failed:', error);
      return false;
    }
  }

  /**
   * Show user-friendly error message about SumUp compatibility
   */
  public showCompatibilityError(result: SumUpCompatibilityResult): void {
    const title = 'Tap to Pay Not Available';
    const message = `${result.fallbackMessage}\n\nRequired actions:\n${result.actionRequired.join(
      '\n'
    )}`;

    Alert.alert(title, message, [
      {
        text: 'Use Alternative Payment',
        style: 'default',
      },
      {
        text: 'Learn More',
        onPress: () => {
          Alert.alert(
            'About Tap to Pay on iPhone',
            'Tap to Pay on iPhone allows merchants to accept contactless payments using just their iPhone. ' +
              'However, it requires:\n\n' +
              '• Apple Developer Program membership\n' +
              '• Approval from Apple\n' +
              '• Special entitlements\n' +
              '• App Store review\n\n' +
              'For now, you can use alternative payment methods like QR codes or external card readers.',
            [{ text: 'OK' }]
          );
        },
      },
    ]);
  }

  /**
   * Get fallback payment options when SumUp isn't available
   */
  public getFallbackPaymentMethods(): Array<{
    id: string;
    name: string;
    description: string;
    available: boolean;
  }> {
    return [
      {
        id: 'qr',
        name: 'QR Code Payment',
        description: 'Customer scans QR code to pay via mobile app',
        available: true,
      },
      {
        id: 'cash',
        name: 'Cash Payment',
        description: 'Traditional cash payment',
        available: true,
      },
      {
        id: 'stripe',
        name: 'Stripe Terminal',
        description: 'Use Stripe card reader hardware',
        available: true,
      },
      {
        id: 'square',
        name: 'Square Reader',
        description: 'Use Square card reader hardware',
        available: false, // Temporarily disabled
      },
    ];
  }

  /**
   * Check if SumUp initialization should be attempted
   */
  public async shouldAttemptSumUp(): Promise<boolean> {
    const compatibility = await this.checkCompatibility();
    return compatibility.isSupported;
  }
}

export default SumUpCompatibilityService;
