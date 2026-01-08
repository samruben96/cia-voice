/**
 * Phone number validation utilities for voice agent
 */

export interface PhoneValidationResult {
  isValid: boolean;
  normalized: string | null;
  digits: string;
  error: string | null;
}

/**
 * Validates and normalizes a phone number
 * @param phone - Phone number in any format
 * @returns Validation result with normalized E.164 format for US numbers
 */
export function validatePhone(phone: string): PhoneValidationResult {
  // Check for empty input
  if (!phone || phone.trim() === '') {
    return {
      isValid: false,
      normalized: null,
      digits: '',
      error: 'Phone number is required',
    };
  }

  // Extract only digits from the input
  const digits = phone.replace(/\D/g, '');

  // Check for valid characters (allow digits, spaces, dashes, parentheses, dots, plus)
  const validCharsPattern = /^[\d\s\-().+]+$/;
  if (!validCharsPattern.test(phone.trim())) {
    return {
      isValid: false,
      normalized: null,
      digits,
      error: 'Phone number contains invalid characters',
    };
  }

  // Check digit count (10-15 digits for international numbers)
  if (digits.length < 10) {
    return {
      isValid: false,
      normalized: null,
      digits,
      error: `Phone number is too short. Expected at least 10 digits, got ${digits.length}`,
    };
  }

  if (digits.length > 15) {
    return {
      isValid: false,
      normalized: null,
      digits,
      error: `Phone number is too long. Expected at most 15 digits, got ${digits.length}`,
    };
  }

  // Normalize to E.164 format
  let normalized: string;

  if (digits.length === 10) {
    // US number without country code - add +1
    normalized = `+1${digits}`;
  } else if (digits.length === 11 && digits.startsWith('1')) {
    // US number with country code 1 - add +
    normalized = `+${digits}`;
  } else {
    // International number - assume it needs + prefix
    normalized = `+${digits}`;
  }

  return {
    isValid: true,
    normalized,
    digits,
    error: null,
  };
}

/**
 * Quick check if a string looks like a phone number
 * This is a lenient check for initial screening
 * @param value - String to check
 * @returns true if the value appears to be a phone number
 */
export function looksLikePhone(value: string): boolean {
  if (!value || typeof value !== 'string') {
    return false;
  }

  // Extract digits
  const digits = value.replace(/\D/g, '');

  // Must have at least 7 digits to look like a phone number
  if (digits.length < 7) {
    return false;
  }

  // Should be mostly digits and common phone characters
  const phoneChars = value.replace(/[\d\s\-().+]/g, '');
  const nonPhoneCharRatio = phoneChars.length / value.length;

  // If more than 20% of characters are non-phone characters, probably not a phone
  if (nonPhoneCharRatio > 0.2) {
    return false;
  }

  return true;
}
