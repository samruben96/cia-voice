/**
 * PII Masking Utility
 *
 * Provides functions to mask personally identifiable information (PII)
 * in objects before logging or displaying.
 */

// Fields that contain PII data requiring masking
const PII_FIELDS = new Set([
  'phonenumber',
  'phone',
  'email',
  'ssn',
  'dob',
  'dateofbirth',
  'address',
  'street',
]);

// Name fields that should show first initial only
const NAME_FIELDS = new Set(['callername', 'fullname', 'firstname', 'lastname', 'name']);

/**
 * Masks a phone number, showing only the last N digits
 * @param phone - The phone number to mask
 * @param showLast - Number of digits to show at the end (default: 4)
 * @returns Masked phone number
 */
export function maskPhone(phone: string, showLast: number = 4): string {
  if (!phone || typeof phone !== 'string') {
    return phone;
  }

  // Extract only digits
  const digits = phone.replace(/\D/g, '');

  if (digits.length <= showLast) {
    return phone; // Not enough digits to mask
  }

  // Create mask with asterisks
  const maskedPart = '*'.repeat(digits.length - showLast);
  const visiblePart = digits.slice(-showLast);

  // Format as (***) ***-XXXX if it looks like a US phone number
  if (digits.length === 10) {
    return `(***) ***-${visiblePart}`;
  } else if (digits.length === 11 && digits.startsWith('1')) {
    return `+1 (***) ***-${visiblePart}`;
  }

  return `${maskedPart}${visiblePart}`;
}

/**
 * Masks an email address, showing first character and domain
 * @param email - The email address to mask
 * @returns Masked email address
 */
function maskEmail(email: string): string {
  if (!email || typeof email !== 'string' || !email.includes('@')) {
    return email;
  }

  const [localPart, domain] = email.split('@');
  if (!localPart || localPart.length <= 1) {
    return `*@${domain}`;
  }

  return `${localPart[0]}${'*'.repeat(localPart.length - 1)}@${domain}`;
}

/**
 * Masks a name field, showing only the first initial
 * @param name - The name to mask
 * @returns Masked name showing first initial
 */
function maskName(name: string): string {
  if (!name || typeof name !== 'string') {
    return name;
  }

  const trimmed = name.trim();
  if (trimmed.length === 0) {
    return name;
  }

  // Handle multi-word names (e.g., "John Smith" -> "J. S.")
  const words = trimmed.split(/\s+/);
  return words.map((word) => (word.length > 0 ? `${word[0]}.` : '')).join(' ');
}

/**
 * Masks an address field
 * @param address - The address to mask
 * @returns Masked address
 */
function maskAddress(address: string): string {
  if (!address || typeof address !== 'string') {
    return address;
  }

  // Show only the state/zip portion if present, otherwise show "[REDACTED]"
  // Look for state abbreviation and zip code pattern at the end
  const stateZipMatch = address.match(/,?\s*([A-Z]{2})\s*(\d{5}(?:-\d{4})?)\s*$/i);
  if (stateZipMatch && stateZipMatch[1] && stateZipMatch[2]) {
    return `[REDACTED], ${stateZipMatch[1].toUpperCase()} ${stateZipMatch[2]}`;
  }

  return '[REDACTED ADDRESS]';
}

/**
 * Masks SSN or similar sensitive numbers
 * @param ssn - The SSN to mask
 * @returns Masked SSN showing last 4 digits
 */
function maskSSN(ssn: string): string {
  if (!ssn || typeof ssn !== 'string') {
    return ssn;
  }

  const digits = ssn.replace(/\D/g, '');
  if (digits.length < 4) {
    return '***-**-****';
  }

  return `***-**-${digits.slice(-4)}`;
}

/**
 * Masks date of birth
 * @param dob - The date of birth to mask
 * @returns Masked DOB showing only year
 */
function maskDOB(dob: string): string {
  if (!dob || typeof dob !== 'string') {
    return dob;
  }

  // Try to extract year from various date formats
  const yearMatch = dob.match(/\b(19|20)\d{2}\b/);
  if (yearMatch) {
    return `**/**/` + yearMatch[0];
  }

  return '[REDACTED DOB]';
}

/**
 * Determines if a field name is a PII field
 * @param fieldName - The field name to check
 * @returns True if the field contains PII
 */
function isPIIField(fieldName: string): boolean {
  const normalized = fieldName.toLowerCase().replace(/[_-]/g, '');
  return PII_FIELDS.has(normalized);
}

/**
 * Determines if a field name is a name field
 * @param fieldName - The field name to check
 * @returns True if the field is a name field
 */
function isNameField(fieldName: string): boolean {
  const normalized = fieldName.toLowerCase().replace(/[_-]/g, '');
  return NAME_FIELDS.has(normalized);
}

/**
 * Masks a single PII value based on field type
 * @param fieldName - The name of the field
 * @param value - The value to mask
 * @returns Masked value
 */
function maskPIIValue(fieldName: string, value: string): string {
  const normalized = fieldName.toLowerCase().replace(/[_-]/g, '');

  if (normalized === 'email') {
    return maskEmail(value);
  }

  if (normalized === 'phonenumber' || normalized === 'phone') {
    return maskPhone(value);
  }

  if (normalized === 'ssn') {
    return maskSSN(value);
  }

  if (normalized === 'dob' || normalized === 'dateofbirth') {
    return maskDOB(value);
  }

  if (normalized === 'address' || normalized === 'street') {
    return maskAddress(value);
  }

  // Default masking for unknown PII fields
  return '[REDACTED]';
}

/**
 * Recursively masks PII fields in an object
 * @param obj - The object to mask
 * @returns A new object with PII fields masked
 */
export function maskPII<T>(obj: T): T {
  if (obj === null || obj === undefined) {
    return obj;
  }

  // Handle primitive types
  if (typeof obj !== 'object') {
    return obj;
  }

  // Handle arrays
  if (Array.isArray(obj)) {
    return obj.map((item) => maskPII(item)) as T;
  }

  // Handle objects
  const masked: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    if (value === null || value === undefined) {
      masked[key] = value;
    } else if (typeof value === 'string') {
      if (isNameField(key)) {
        masked[key] = maskName(value);
      } else if (isPIIField(key)) {
        masked[key] = maskPIIValue(key, value);
      } else {
        masked[key] = value;
      }
    } else if (typeof value === 'object') {
      masked[key] = maskPII(value);
    } else {
      masked[key] = value;
    }
  }

  return masked as T;
}

/**
 * Logs data with PII masked
 * @param prefix - Log prefix/label
 * @param data - Data to log with PII masked
 */
export function safeLog(prefix: string, data: unknown): void {
  const maskedData = maskPII(data);
  console.log(prefix, JSON.stringify(maskedData, null, 2));
}
