/**
 * PlatformPaymentService - Enhanced payment service that integrates platform-controlled fees
 * Extends existing PaymentService patterns while adding platform fee management
 */

// TODO: Unused import - import AsyncStorage from '@react-native-async-storage/async-storage';

import PaymentService from './PaymentService';
import PlatformService from './PlatformService';

import type { PaymentFee, FeeCalculation } from './PlatformService';

export interface PlatformPaymentMethod {
  id: string;
  name: string;
  icon: string;
  color: string;
  enabled: boolean;
  requiresAuth: boolean;
  feeInfo: string;
  platformFee: PaymentFee;
  effectiveFee?: FeeCalculation;
}

export interface PaymentFeeDisplayInfo {
  shortDescription: string;
  detailedDescription: string;
  feeAmount: number;
  feePercentage: number;
  currency: string;
  isOptimal: boolean;
  hasRestaurantMarkup: boolean;
}

class PlatformPaymentService {
  private static instance: PlatformPaymentService;
  private platformService: PlatformService;
  private paymentService: PaymentService;
  private cachedFees: Record<string, PaymentFee> | null = null;
  private cacheExpiry: number = 0;
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  private constructor() {
    this.platformService = PlatformService.getInstance();
    this.paymentService = PaymentService.getInstance();
  }

  static getInstance(): PlatformPaymentService {
    if (!PlatformPaymentService.instance) {
      PlatformPaymentService.instance = new PlatformPaymentService();
    }
    return PlatformPaymentService.instance;
  }

  /**
   * Get payment methods with current platform fees
   */
  async getPaymentMethodsWithFees(
    amount: number,
    restaurantId?: string
  ): Promise<PlatformPaymentMethod[]> {
    try {
      // Get base payment methods from existing service
      const baseMethods = await this.paymentService.getAvailablePaymentMethods();

      // Get platform fees
      const platformFees = await this.getPlatformFees();

      // Calculate effective fees for each method
      const methodsWithFees: PlatformPaymentMethod[] = [];

      for (const method of baseMethods) {
        const platformFee = platformFees[method.id];
        if (!platformFee) continue;

        // Calculate effective fee for this amount
        let effectiveFee: FeeCalculation | undefined;
        try {
          effectiveFee = await this.platformService.calculatePaymentFee(
            method.id,
            amount,
            restaurantId
          );
        } catch (error) {
          logger.warn(`Failed to calculate fee for ${method.id}:`, error);
          // Fall back to basic calculation
          effectiveFee = this.calculateBasicFee(method.id, amount, platformFee);
        }

        methodsWithFees.push({
          ...method,
          platformFee,
          effectiveFee,
          feeInfo: this.generateFeeInfo(effectiveFee),
        });
      }

      // Sort by effective fee (lowest first)
      methodsWithFees.sort((a, b) => {
        const feeA = a.effectiveFee?.effective_fee || 0;
        const feeB = b.effectiveFee?.effective_fee || 0;
        return feeA - feeB;
      });

      return methodsWithFees;
    } catch (error) {
      logger.error('Failed to get payment methods with fees:', error);
      // Fall back to basic payment methods
      return this.getFallbackPaymentMethods();
    }
  }

  /**
   * Get optimal payment method for given amount
   */
  async getOptimalPaymentMethod(amount: number, restaurantId?: string): Promise<string> {
    try {
      const methods = await this.getPaymentMethodsWithFees(amount, restaurantId);
      const enabledMethods = methods.filter((m) => m.enabled);

      if (enabledMethods.length === 0) {
        return 'sumup'; // Default to SumUp
      }

      // Prefer SumUp if it's available and enabled
      const sumupMethod = enabledMethods.find((m) => m.id === 'sumup');
      if (sumupMethod) {
        return 'sumup';
      }

      // Return method with lowest effective fee if SumUp not available
      return enabledMethods[0].id;
    } catch (error) {
      logger.error('Failed to determine optimal payment method:', error);
      return 'sumup'; // Default to SumUp
    }
  }

  /**
   * Get detailed fee information for display
   */
  async getPaymentFeeInfo(
    paymentMethod: string,
    amount: number,
    restaurantId?: string
  ): Promise<PaymentFeeDisplayInfo> {
    try {
      const feeCalculation = await this.platformService.calculatePaymentFee(
        paymentMethod,
        amount,
        restaurantId
      );

      const allMethods = await this.getPaymentMethodsWithFees(amount, restaurantId);
      const _currentMethod = allMethods.find((m) => m.id === paymentMethod);
      const lowestFee = Math.min(...allMethods.map((m) => m.effectiveFee?.effective_fee || 0));

      return {
        shortDescription: this.generateShortFeeDescription(feeCalculation),
        detailedDescription: this.generateDetailedFeeDescription(feeCalculation),
        feeAmount: feeCalculation.effective_fee,
        feePercentage: feeCalculation.fee_percentage,
        currency: feeCalculation.currency,
        isOptimal: feeCalculation.effective_fee === lowestFee,
        hasRestaurantMarkup: feeCalculation.restaurant_markup > 0,
      };
    } catch (error) {
      logger.error('Failed to get fee info:', error);
      return {
        shortDescription: 'Fee information unavailable',
        detailedDescription: 'Unable to calculate processing fee at this time.',
        feeAmount: 0,
        feePercentage: 0,
        currency: 'GBP',
        isOptimal: false,
        hasRestaurantMarkup: false,
      };
    }
  }

  /**
   * Check if restaurant has payment fee overrides
   */
  async hasRestaurantFeeOverrides(restaurantId: string): Promise<boolean> {
    try {
      const effectiveSettings = await this.platformService.getRestaurantEffectiveSettings(
        restaurantId,
        'payment_fees'
      );

      // Check if any payment fee settings come from restaurant level
      return Object.values(effectiveSettings).some(
        (setting: unknown) => setting.source === 'restaurant'
      );
    } catch (error) {
      logger.error('Failed to check restaurant overrides:', error);
      return false;
    }
  }

  /**
   * Update restaurant payment fee markup (if allowed)
   */
  async updateRestaurantFeeMarkup(
    restaurantId: string,
    paymentMethod: string,
    markupPercentage: number
  ): Promise<boolean> {
    try {
      const markupConfig = {
        percentage: markupPercentage,
        applied_at: new Date().toISOString(),
      };

      return await this.platformService.setRestaurantOverride(
        restaurantId,
        `payment.markup.${paymentMethod}`,
        markupConfig,
        markupPercentage > 0.5 // Require approval for markups > 0.5%
      );
    } catch (error) {
      logger.error('Failed to update restaurant fee markup:', error);
      return false;
    }
  }

  /**
   * Get platform fees with caching
   */
  private async getPlatformFees(): Promise<Record<string, PaymentFee>> {
    const now = Date.now();

    if (this.cachedFees && now < this.cacheExpiry) {
      return this.cachedFees;
    }

    try {
      this.cachedFees = await this.platformService.getPaymentFees();
      this.cacheExpiry = now + this.CACHE_DURATION;
      return this.cachedFees;
    } catch (error) {
      logger.error('Failed to fetch platform fees:', error);
      // Return cached fees if available, otherwise empty
      return this.cachedFees || {};
    }
  }

  /**
   * Calculate basic fee when platform calculation fails
   */
  private calculateBasicFee(
    paymentMethod: string,
    amount: number,
    platformFee: PaymentFee
  ): FeeCalculation {
    const feeAmount = (amount * platformFee.percentage) / 100 + (platformFee.fixed_fee || 0);

    return {
      payment_method: paymentMethod,
      amount,
      platform_fee: feeAmount,
      restaurant_markup: 0,
      effective_fee: feeAmount,
      fee_percentage: (feeAmount / amount) * 100,
      currency: platformFee.currency,
    };
  }

  /**
   * Generate user-friendly fee information
   */
  private generateFeeInfo(feeCalculation?: FeeCalculation): string {
    if (!feeCalculation) {
      return 'Fee information unavailable';
    }

    const { effective_fee, currency, fee_percentage } = feeCalculation;

    if (effective_fee === 0) {
      return 'No processing fee';
    }

    return `${fee_percentage.toFixed(2)}% (${currency}${effective_fee.toFixed(2)})`;
  }

  /**
   * Generate short fee description for UI
   */
  private generateShortFeeDescription(feeCalculation: FeeCalculation): string {
    const { effective_fee, _currency, fee_percentage } = feeCalculation;

    if (effective_fee === 0) {
      return 'No fee';
    }

    return `${fee_percentage.toFixed(1)}% fee`;
  }

  /**
   * Generate detailed fee description
   */
  private generateDetailedFeeDescription(feeCalculation: FeeCalculation): string {
    const { effective_fee, platform_fee, restaurant_markup, currency, fee_percentage } =
      feeCalculation;

    if (effective_fee === 0) {
      return 'This payment method has no processing fees.';
    }

    let description = `Processing fee: ${fee_percentage.toFixed(
      2
    )}% (${currency}${effective_fee.toFixed(2)})`;

    if (restaurant_markup > 0) {
      description += `\nPlatform fee: ${currency}${platform_fee.toFixed(2)}`;
      description += `\nRestaurant markup: ${restaurant_markup.toFixed(2)}%`;
    }

    return description;
  }

  /**
   * Fallback payment methods when platform service fails
   */
  private getFallbackPaymentMethods(): PlatformPaymentMethod[] {
    return [
      {
        id: 'sumup',
        name: 'SumUp',
        icon: 'credit-card',
        color: '#00D4AA',
        enabled: true,
        requiresAuth: true,
        feeInfo: '0.69% (High volume) • 1.69% (Standard)',
        platformFee: { percentage: 0.69, currency: 'GBP' },
      },
      {
        id: 'qr_code',
        name: 'QR Code',
        icon: 'qr-code-scanner',
        color: '#0066CC',
        enabled: true,
        requiresAuth: false,
        feeInfo: '1.2%',
        platformFee: { percentage: 1.2, currency: 'GBP' },
      },
      {
        id: 'cash',
        name: 'Cash',
        icon: 'money',
        color: '#00A651',
        enabled: true,
        requiresAuth: false,
        feeInfo: 'No processing fee',
        platformFee: { percentage: 0, currency: 'GBP' },
      },
      {
        id: 'stripe',
        name: 'Card (Stripe)',
        icon: 'credit-card',
        color: '#635BFF',
        enabled: true,
        requiresAuth: true,
        feeInfo: '1.4% + 20p',
        platformFee: { percentage: 1.4, fixed_fee: 0.2, currency: 'GBP' },
      },
      {
        id: 'square',
        name: 'Square',
        icon: 'crop-square',
        color: '#3E4348',
        enabled: true,
        requiresAuth: true,
        feeInfo: '1.75%',
        platformFee: { percentage: 1.75, currency: 'GBP' },
      },
    ];
  }

  /**
   * Clear fee cache (useful when settings change)
   */
  clearFeeCache(): void {
    this.cachedFees = null;
    this.cacheExpiry = 0;
  }

  /**
   * Get fee summary for analytics/reporting
   */
  async getFeeSummary(
    restaurantId?: string,
    _dateRange?: { start: Date; end: Date }
  ): Promise<{
    totalFees: number;
    feesByMethod: Record<string, number>;
    currency: string;
    period: string;
  }> {
    // This would integrate with analytics service to provide fee summaries
    // For now, return a placeholder
    return {
      totalFees: 0,
      feesByMethod: {},
      currency: 'GBP',
      period: 'current',
    };
  }
}

export default PlatformPaymentService;
