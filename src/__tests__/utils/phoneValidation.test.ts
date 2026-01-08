import assert from 'node:assert';
import { describe, it } from 'node:test';
import { validatePhone, looksLikePhone, type PhoneValidationResult } from '../../utils/phoneValidation.js';

/**
 * Phone Number Validation Tests
 *
 * Tests the validatePhone and looksLikePhone utilities for handling
 * various phone number formats commonly encountered in voice agent calls.
 *
 * Test Strategy:
 * - Valid format acceptance (10-digit, 11-digit with country code)
 * - Various formatting styles (parentheses, dashes, dots, spaces)
 * - Boundary value analysis (too short, too long)
 * - Invalid character detection
 * - E.164 normalization verification
 */
describe('validatePhone', () => {
  describe('Valid 10-digit Numbers', () => {
    it('should accept plain 10-digit number', () => {
      const result = validatePhone('1234567890');

      assert.strictEqual(result.isValid, true, 'Should be valid');
      assert.strictEqual(result.normalized, '+11234567890', 'Should normalize to E.164 with +1');
      assert.strictEqual(result.error, null, 'Should have no error');
      assert.strictEqual(result.digits, '1234567890', 'Should extract all digits');
    });

    it('should accept (123) 456-7890 format', () => {
      const result = validatePhone('(123) 456-7890');

      assert.strictEqual(result.isValid, true, 'Should be valid');
      assert.strictEqual(result.normalized, '+11234567890', 'Should normalize correctly');
    });

    it('should accept 123-456-7890 format', () => {
      const result = validatePhone('123-456-7890');

      assert.strictEqual(result.isValid, true, 'Should be valid');
      assert.strictEqual(result.normalized, '+11234567890', 'Should normalize correctly');
    });

    it('should accept 123.456.7890 format', () => {
      const result = validatePhone('123.456.7890');

      assert.strictEqual(result.isValid, true, 'Should be valid');
      assert.strictEqual(result.normalized, '+11234567890', 'Should normalize correctly');
    });

    it('should accept 123 456 7890 format (with spaces)', () => {
      const result = validatePhone('123 456 7890');

      assert.strictEqual(result.isValid, true, 'Should be valid');
      assert.strictEqual(result.normalized, '+11234567890', 'Should normalize correctly');
    });
  });

  describe('Valid 11-digit Numbers with Country Code', () => {
    it('should accept 11234567890 format', () => {
      const result = validatePhone('11234567890');

      assert.strictEqual(result.isValid, true, 'Should be valid');
      assert.strictEqual(result.normalized, '+11234567890', 'Should normalize to E.164');
    });

    it('should accept +11234567890 format', () => {
      const result = validatePhone('+11234567890');

      assert.strictEqual(result.isValid, true, 'Should be valid');
      assert.strictEqual(result.normalized, '+11234567890', 'Should normalize to E.164');
    });

    it('should accept +1 123 456 7890 format', () => {
      const result = validatePhone('+1 123 456 7890');

      assert.strictEqual(result.isValid, true, 'Should be valid');
      assert.strictEqual(result.normalized, '+11234567890', 'Should normalize to E.164');
    });

    it('should accept +1 (123) 456-7890 format', () => {
      const result = validatePhone('+1 (123) 456-7890');

      assert.strictEqual(result.isValid, true, 'Should be valid');
      assert.strictEqual(result.normalized, '+11234567890', 'Should normalize to E.164');
    });

    it('should accept 1-123-456-7890 format', () => {
      const result = validatePhone('1-123-456-7890');

      assert.strictEqual(result.isValid, true, 'Should be valid');
      assert.strictEqual(result.normalized, '+11234567890', 'Should normalize to E.164');
    });
  });

  describe('Too Short Numbers', () => {
    it('should reject 9-digit number', () => {
      const result = validatePhone('123456789');

      assert.strictEqual(result.isValid, false, 'Should be invalid');
      assert.strictEqual(result.normalized, null, 'Should have no normalized value');
      assert.ok(result.error?.includes('too short'), `Error should mention too short: "${result.error}"`);
    });

    it('should reject 7-digit number', () => {
      const result = validatePhone('1234567');

      assert.strictEqual(result.isValid, false, 'Should be invalid');
      assert.ok(result.error?.includes('too short'), `Error should mention too short: "${result.error}"`);
    });

    it('should reject 5-digit number', () => {
      const result = validatePhone('12345');

      assert.strictEqual(result.isValid, false, 'Should be invalid');
      assert.ok(result.error?.includes('too short'), `Error should mention too short: "${result.error}"`);
    });

    it('should reject formatted short number (123) 456-789', () => {
      const result = validatePhone('(123) 456-789');

      assert.strictEqual(result.isValid, false, 'Should be invalid');
      assert.strictEqual(result.digits, '123456789', 'Should extract 9 digits');
      assert.ok(result.error?.includes('9'), 'Error should mention digit count');
    });
  });

  describe('Too Long Numbers', () => {
    it('should reject 16-digit number', () => {
      const result = validatePhone('1234567890123456');

      assert.strictEqual(result.isValid, false, 'Should be invalid');
      assert.strictEqual(result.normalized, null, 'Should have no normalized value');
      assert.ok(result.error?.includes('too long'), `Error should mention too long: "${result.error}"`);
    });

    it('should accept 15-digit number (maximum international)', () => {
      // 15 digits is the maximum for international numbers per E.164
      const result = validatePhone('123456789012345');

      assert.strictEqual(result.isValid, true, 'Should be valid (15 is max for E.164)');
    });

    it('should reject 20-digit number', () => {
      const result = validatePhone('12345678901234567890');

      assert.strictEqual(result.isValid, false, 'Should be invalid');
      assert.ok(result.error?.includes('too long'), `Error should mention too long: "${result.error}"`);
    });
  });

  describe('Invalid Characters', () => {
    it('should reject phone with letters', () => {
      const result = validatePhone('123-ABC-7890');

      assert.strictEqual(result.isValid, false, 'Should be invalid');
      assert.ok(result.error?.includes('invalid characters'), `Error should mention invalid characters: "${result.error}"`);
    });

    it('should reject phone with special characters', () => {
      const result = validatePhone('123#456@7890');

      assert.strictEqual(result.isValid, false, 'Should be invalid');
      assert.ok(result.error?.includes('invalid characters'), `Error should mention invalid characters: "${result.error}"`);
    });

    it('should reject phone with emoji', () => {
      const result = validatePhone('123-456-7890📱');

      assert.strictEqual(result.isValid, false, 'Should be invalid');
    });

    it('should accept phone with only valid separators', () => {
      // Valid separators: spaces, dashes, parentheses, dots, plus
      const result = validatePhone('+1 (123) 456-7890');

      assert.strictEqual(result.isValid, true, 'Should be valid');
    });
  });

  describe('Empty and Null Inputs', () => {
    it('should reject empty string', () => {
      const result = validatePhone('');

      assert.strictEqual(result.isValid, false, 'Should be invalid');
      assert.ok(result.error?.includes('required'), `Error should mention required: "${result.error}"`);
    });

    it('should reject whitespace-only string', () => {
      const result = validatePhone('   ');

      assert.strictEqual(result.isValid, false, 'Should be invalid');
    });

    it('should handle undefined gracefully', () => {
      // @ts-expect-error Testing undefined input
      const result = validatePhone(undefined);

      assert.strictEqual(result.isValid, false, 'Should be invalid');
      assert.ok(result.error !== null, 'Should have an error');
    });

    it('should handle null gracefully', () => {
      // @ts-expect-error Testing null input
      const result = validatePhone(null);

      assert.strictEqual(result.isValid, false, 'Should be invalid');
      assert.ok(result.error !== null, 'Should have an error');
    });
  });

  describe('Various Formatting Styles', () => {
    it('should accept phone with multiple spaces', () => {
      const result = validatePhone('123  456  7890');

      assert.strictEqual(result.isValid, true, 'Should be valid');
      assert.strictEqual(result.normalized, '+11234567890', 'Should normalize correctly');
    });

    it('should accept phone with leading/trailing spaces', () => {
      const result = validatePhone('  1234567890  ');

      assert.strictEqual(result.isValid, true, 'Should be valid');
      assert.strictEqual(result.normalized, '+11234567890', 'Should normalize correctly');
    });

    it('should accept mixed format (123)456.7890', () => {
      const result = validatePhone('(123)456.7890');

      assert.strictEqual(result.isValid, true, 'Should be valid');
      assert.strictEqual(result.normalized, '+11234567890', 'Should normalize correctly');
    });
  });

  describe('Result Structure', () => {
    it('should always return all expected fields', () => {
      const validResult = validatePhone('1234567890');
      const invalidResult = validatePhone('123');

      // Valid result
      assert.ok('isValid' in validResult, 'Should have isValid field');
      assert.ok('normalized' in validResult, 'Should have normalized field');
      assert.ok('digits' in validResult, 'Should have digits field');
      assert.ok('error' in validResult, 'Should have error field');

      // Invalid result
      assert.ok('isValid' in invalidResult, 'Should have isValid field');
      assert.ok('normalized' in invalidResult, 'Should have normalized field');
      assert.ok('digits' in invalidResult, 'Should have digits field');
      assert.ok('error' in invalidResult, 'Should have error field');
    });
  });
});

describe('looksLikePhone', () => {
  describe('Phone-like Strings', () => {
    it('should return true for 10-digit number', () => {
      assert.strictEqual(looksLikePhone('1234567890'), true);
    });

    it('should return true for formatted phone number', () => {
      assert.strictEqual(looksLikePhone('(123) 456-7890'), true);
    });

    it('should return true for phone with country code', () => {
      assert.strictEqual(looksLikePhone('+1 123 456 7890'), true);
    });
  });

  describe('Non-Phone Strings', () => {
    it('should return false for short number (less than 7 digits)', () => {
      assert.strictEqual(looksLikePhone('12345'), false);
    });

    it('should return false for text with some numbers', () => {
      assert.strictEqual(looksLikePhone('Call me at number 123'), false);
    });

    it('should return false for empty string', () => {
      assert.strictEqual(looksLikePhone(''), false);
    });

    it('should return false for null', () => {
      // @ts-expect-error Testing null input
      assert.strictEqual(looksLikePhone(null), false);
    });

    it('should return false for undefined', () => {
      // @ts-expect-error Testing undefined input
      assert.strictEqual(looksLikePhone(undefined), false);
    });

    it('should return false for pure text', () => {
      assert.strictEqual(looksLikePhone('Hello World'), false);
    });
  });

  describe('Edge Cases', () => {
    it('should return true for 7-digit number (minimum)', () => {
      assert.strictEqual(looksLikePhone('1234567'), true);
    });

    it('should return true for number with acceptable non-digit ratio', () => {
      // (123) 456-7890 has punctuation but mostly digits
      assert.strictEqual(looksLikePhone('(123) 456-7890'), true);
    });

    it('should return false when non-phone character ratio is too high', () => {
      // More letters than allowed
      assert.strictEqual(looksLikePhone('abc123defg4567890'), false);
    });
  });
});
