/**
 * Input validation utilities for forms
 */

/**
 * Parse numeric input safely, preventing NaN errors
 */
export const parseNumericInput = (value: string | number | undefined | null): number => {
  if (value === undefined || value === null || value === '') {
    return 0;
  }

  // If already a number, return it
  if (typeof value === 'number' && !isNaN(value)) {
    return value;
  }

  // Convert to string and clean
  const stringValue = String(value);
  const cleaned = stringValue.replace(/[^0-9.-]/g, '');

  // Handle empty or invalid strings
  if (!cleaned || cleaned === '-' || cleaned === '.') {
    return 0;
  }

  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : parsed;
};

/**
 * Parse currency input (removes currency symbols and commas)
 */
export const parseCurrencyInput = (value: string | number | undefined | null): number => {
  if (value === undefined || value === null || value === '') {
    return 0;
  }

  // If already a number, return it
  if (typeof value === 'number' && !isNaN(value)) {
    return value;
  }

  // Convert to string and clean
  const stringValue = String(value);
  const cleaned = stringValue.replace(/[£$€,]/g, '').trim();

  return parseNumericInput(cleaned);
};

/**
 * Parse percentage input (removes % symbol)
 */
export const parsePercentageInput = (value: string | number | undefined | null): number => {
  if (value === undefined || value === null || value === '') {
    return 0;
  }

  // If already a number, return it
  if (typeof value === 'number' && !isNaN(value)) {
    return value;
  }

  // Convert to string and clean
  const stringValue = String(value);
  const cleaned = stringValue.replace(/%/g, '').trim();

  return parseNumericInput(cleaned);
};

/**
 * Validate UK phone number
 */
export const validateUKPhone = (phone: string): boolean => {
  // Remove all non-numeric characters
  const cleaned = phone.replace(/\D/g, '');

  // UK phone numbers should be 10 or 11 digits
  // Starting with 0 for landlines or 07 for mobiles
  // Or +44 for international format
  const ukPattern = /^(0[0-9]{9,10}|44[0-9]{9,10})$/;

  return ukPattern.test(cleaned);
};

/**
 * Format UK phone number for display
 */
export const formatUKPhone = (phone: string): string => {
  const cleaned = phone.replace(/\D/g, '');

  // Handle +44 format
  if (cleaned.startsWith('44')) {
    const number = cleaned.substring(2);
    return `+44 ${number.substring(0, 4)} ${number.substring(4)}`;
  }

  // Handle UK format
  if (cleaned.startsWith('0')) {
    if (cleaned.length === 11) {
      return `${cleaned.substring(0, 5)} ${cleaned.substring(5)}`;
    }
    return cleaned;
  }

  return phone;
};

/**
 * Validate UK sort code
 */
export const validateSortCode = (sortCode: string): boolean => {
  const cleaned = sortCode.replace(/[^0-9]/g, '');
  return cleaned.length === 6;
};

/**
 * Format UK sort code for display
 */
export const formatSortCode = (sortCode: string): string => {
  const cleaned = sortCode.replace(/[^0-9]/g, '').slice(0, 6);
  if (cleaned.length <= 2) return cleaned;
  if (cleaned.length <= 4) return `${cleaned.slice(0, 2)}-${cleaned.slice(2)}`;
  return `${cleaned.slice(0, 2)}-${cleaned.slice(2, 4)}-${cleaned.slice(4, 6)}`;
};

/**
 * Validate UK bank account number
 */
export const validateAccountNumber = (accountNumber: string): boolean => {
  const cleaned = accountNumber.replace(/[^0-9]/g, '');
  return cleaned.length === 8;
};

/**
 * Validate email address
 */
export const validateEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * Validate postcode (UK format)
 */
export const validatePostcode = (postcode: string): boolean => {
  // UK postcode regex pattern
  const pattern = /^[A-Z]{1,2}[0-9]{1,2}[A-Z]?\s?[0-9][A-Z]{2}$/i;
  return pattern.test(postcode.trim());
};

/**
 * Format postcode for display
 */
export const formatPostcode = (postcode: string): string => {
  const cleaned = postcode.toUpperCase().replace(/\s/g, '');
  if (cleaned.length > 3) {
    return `${cleaned.slice(0, -3)} ${cleaned.slice(-3)}`;
  }
  return cleaned;
};

/**
 * Sanitize string input to prevent XSS and injection
 */
export const sanitizeInput = (input: string, maxLength: number = 255): string => {
  if (!input || typeof input !== 'string') return '';

  return input
    .replace(/[<>\"'();`\\]/g, '') // Remove dangerous characters
    .trim()
    .slice(0, maxLength);
};

/**
 * Validate required field
 */
export const isRequired = (value: unknown): boolean => {
  if (value === undefined || value === null) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  if (typeof value === 'number') return !isNaN(value);
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'object') return Object.keys(value).length > 0;
  return Boolean(value);
};

/**
 * Validate IBAN
 */
export const validateIBAN = (iban: string): boolean => {
  // Basic IBAN validation - can be enhanced with country-specific rules
  const cleaned = iban.replace(/\s/g, '').toUpperCase();
  const ibanRegex = /^[A-Z]{2}[0-9]{2}[A-Z0-9]+$/;

  if (!ibanRegex.test(cleaned)) return false;

  // Length varies by country, but GB (UK) should be 22 characters
  if (cleaned.startsWith('GB') && cleaned.length !== 22) return false;

  return true;
};

/**
 * Validate SWIFT/BIC code
 */
export const validateSWIFT = (swift: string): boolean => {
  const cleaned = swift.replace(/\s/g, '').toUpperCase();
  // SWIFT code is 8 or 11 characters
  const swiftRegex = /^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$/;
  return swiftRegex.test(cleaned);
};

/**
 * Create a debounced validation function
 */
export const debounceValidation = (
  fn: (...args: unknown[]) => any,
  delay: number = 300
): ((...args: unknown[]) => void) => {
  let timeoutId: NodeJS.Timeout;

  return (...args: unknown[]) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
};
