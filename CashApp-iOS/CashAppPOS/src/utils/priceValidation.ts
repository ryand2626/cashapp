/**
 * Price Validation Utilities
 * Comprehensive validation and error handling for price calculations
 */

import ErrorTrackingService from '../services/ErrorTrackingService';

export interface PriceValidationResult {
  isValid: boolean;
  value: number;
  error?: string;
}

export interface CalculationContext {
  operation: string;
  inputValues: Record<string, unknown>;
  screenName?: string;
  component?: string;
}

/**
 * Validates a price value and returns a safe number or 0
 */
export const validatePrice = (
  value: unknown,
  context?: CalculationContext
): PriceValidationResult => {
  try {
    // Handle null/undefined
    if (value === null || value === undefined) {
      return {
        isValid: false,
        value: 0,
        error: 'Price value is null or undefined',
      };
    }

    // Handle string conversion
    let numValue: number;
    if (typeof value === 'string') {
      numValue = parseFloat(value);
    } else if (typeof value === 'number') {
      numValue = value;
    } else {
      return {
        isValid: false,
        value: 0,
        error: `Invalid price type: ${typeof value}`,
      };
    }

    // Check for NaN
    if (isNaN(numValue)) {
      const errorTrackingService = ErrorTrackingService.getInstance();
      errorTrackingService.trackPricingError(
        new Error(`NaN detected in price validation: ${value}`),
        { originalValue: value, type: typeof value },
        context
      );

      return {
        isValid: false,
        value: 0,
        error: `Price resulted in NaN: ${value}`,
      };
    }

    // Check for negative values
    if (numValue < 0) {
      const errorTrackingService = ErrorTrackingService.getInstance();
      errorTrackingService.trackPricingError(
        new Error(`Negative price detected: ${numValue}`),
        { originalValue: value },
        context
      );

      return {
        isValid: false,
        value: 0,
        error: `Negative price not allowed: ${numValue}`,
      };
    }

    // Check for infinity
    if (!Number.isFinite(numValue)) {
      const errorTrackingService = ErrorTrackingService.getInstance();
      errorTrackingService.trackPricingError(
        new Error(`Infinite price detected: ${numValue}`),
        { originalValue: value },
        context
      );

      return {
        isValid: false,
        value: 0,
        error: `Price is not finite: ${numValue}`,
      };
    }

    // Check for extremely large values (over £1 million)
    if (numValue > 1000000) {
      const errorTrackingService = ErrorTrackingService.getInstance();
      errorTrackingService.trackPricingError(
        new Error(`Unrealistic price detected: ${numValue}`),
        { originalValue: value },
        context
      );

      return {
        isValid: false,
        value: 0,
        error: `Price too large: ${numValue}`,
      };
    }

    return {
      isValid: true,
      value: Number(numValue.toFixed(2)), // Ensure 2 decimal places
    };
  } catch (error) {
    const errorTrackingService = ErrorTrackingService.getInstance();
    errorTrackingService.trackPricingError(
      error instanceof Error ? error : new Error(`Price validation error: ${error}`),
      { originalValue: value },
      context
    );

    return {
      isValid: false,
      value: 0,
      error: `Price validation failed: ${error}`,
    };
  }
};

/**
 * Safely multiplies price by quantity with validation
 */
export const calculateItemTotal = (
  price: unknown,
  quantity: unknown,
  context?: CalculationContext
): PriceValidationResult => {
  const priceValidation = validatePrice(price, context);
  const quantityValidation = validatePrice(quantity, context);

  if (!priceValidation.isValid || !quantityValidation.isValid) {
    return {
      isValid: false,
      value: 0,
      error: `Invalid price (${priceValidation.error}) or quantity (${quantityValidation.error})`,
    };
  }

  try {
    const total = priceValidation.value * quantityValidation.value;
    return validatePrice(total, {
      ...context,
      operation: 'item_total_calculation',
      inputValues: { price: priceValidation.value, quantity: quantityValidation.value },
    });
  } catch (error) {
    const errorTrackingService = ErrorTrackingService.getInstance();
    errorTrackingService.trackPricingError(
      error instanceof Error ? error : new Error(`Item total calculation error: ${error}`),
      { price, quantity },
      context
    );

    return {
      isValid: false,
      value: 0,
      error: `Item total calculation failed: ${error}`,
    };
  }
};

/**
 * Safely calculates percentage-based fees (tax, service charge, etc.)
 */
export const calculatePercentageFee = (
  subtotal: unknown,
  percentage: unknown,
  context?: CalculationContext
): PriceValidationResult => {
  const subtotalValidation = validatePrice(subtotal, context);
  const percentageValidation = validatePrice(percentage, context);

  if (!subtotalValidation.isValid || !percentageValidation.isValid) {
    return {
      isValid: false,
      value: 0,
      error: `Invalid subtotal (${subtotalValidation.error}) or percentage (${percentageValidation.error})`,
    };
  }

  try {
    const fee = subtotalValidation.value * (percentageValidation.value / 100);
    return validatePrice(fee, {
      ...context,
      operation: 'percentage_fee_calculation',
      inputValues: { subtotal: subtotalValidation.value, percentage: percentageValidation.value },
    });
  } catch (error) {
    const errorTrackingService = ErrorTrackingService.getInstance();
    errorTrackingService.trackPricingError(
      error instanceof Error ? error : new Error(`Percentage fee calculation error: ${error}`),
      { subtotal, percentage },
      context
    );

    return {
      isValid: false,
      value: 0,
      error: `Percentage fee calculation failed: ${error}`,
    };
  }
};

/**
 * Safely sums an array of price values
 */
export const calculateSum = (
  values: unknown[],
  context?: CalculationContext
): PriceValidationResult => {
  try {
    let total = 0;
    const invalidValues: unknown[] = [];

    for (let i = 0; i < values.length; i++) {
      const validation = validatePrice(values[i], context);
      if (validation.isValid) {
        total += validation.value;
      } else {
        invalidValues.push({ index: i, value: values[i], error: validation.error });
      }
    }

    if (invalidValues.length > 0) {
      const errorTrackingService = ErrorTrackingService.getInstance();
      errorTrackingService.trackPricingError(
        new Error(`Invalid values found in sum calculation`),
        { invalidValues, totalValues: values.length },
        context
      );
    }

    return validatePrice(total, {
      ...context,
      operation: 'sum_calculation',
      inputValues: { valuesCount: values.length, invalidValuesCount: invalidValues.length },
    });
  } catch (error) {
    const errorTrackingService = ErrorTrackingService.getInstance();
    errorTrackingService.trackPricingError(
      error instanceof Error ? error : new Error(`Sum calculation error: ${error}`),
      { values },
      context
    );

    return {
      isValid: false,
      value: 0,
      error: `Sum calculation failed: ${error}`,
    };
  }
};

/**
 * Safely formats a price for display
 */
export const formatPrice = (
  value: unknown,
  currency: string = '£',
  context?: CalculationContext
): string => {
  const validation = validatePrice(value, context);

  if (!validation.isValid) {
    const errorTrackingService = ErrorTrackingService.getInstance();
    errorTrackingService.trackPricingError(
      new Error(`Price formatting failed: ${validation.error}`),
      { originalValue: value, currency },
      context
    );

    return `${currency}0.00`;
  }

  try {
    return `${currency}${validation.value.toFixed(2)}`;
  } catch (error) {
    const errorTrackingService = ErrorTrackingService.getInstance();
    errorTrackingService.trackPricingError(
      error instanceof Error ? error : new Error(`Price formatting error: ${error}`),
      { value: validation.value, currency },
      context
    );

    return `${currency}0.00`;
  }
};

/**
 * Validates cart total calculations with detailed error context
 */
export const validateCartCalculation = (
  cartItems: unknown[],
  taxRate?: number,
  serviceChargeRate?: number,
  context?: CalculationContext
): {
  subtotal: PriceValidationResult;
  tax: PriceValidationResult;
  serviceCharge: PriceValidationResult;
  total: PriceValidationResult;
  hasErrors: boolean;
} => {
  // Calculate subtotal
  const itemTotals = cartItems.map((item, index) => {
    const itemContext = {
      ...context,
      operation: 'cart_item_calculation',
      component: `cart_item_${index}`,
      inputValues: { itemId: item.id, itemName: item.name },
    };

    const itemTotal = calculateItemTotal(item.price, item.quantity, itemContext);
    return itemTotal.value;
  });

  const subtotal = calculateSum(itemTotals, {
    ...context,
    operation: 'cart_subtotal_calculation',
  });

  // Calculate tax
  const tax = taxRate
    ? calculatePercentageFee(subtotal.value, taxRate, {
        ...context,
        operation: 'tax_calculation',
      })
    : { isValid: true, value: 0 };

  // Calculate service charge
  const serviceCharge = serviceChargeRate
    ? calculatePercentageFee(subtotal.value, serviceChargeRate, {
        ...context,
        operation: 'service_charge_calculation',
      })
    : { isValid: true, value: 0 };

  // Calculate total
  const total = calculateSum([subtotal.value, tax.value, serviceCharge.value], {
    ...context,
    operation: 'cart_total_calculation',
  });

  const hasErrors = !subtotal.isValid || !tax.isValid || !serviceCharge.isValid || !total.isValid;

  return {
    subtotal,
    tax,
    serviceCharge,
    total,
    hasErrors,
  };
};
