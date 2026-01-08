// ============================================================================
// EZLynx Webhook Types - Request/Response Schemas
// ============================================================================

/**
 * Caller information sent TO EZLynx for customer lookup
 */
export interface EZLynxLookupRequest {
  /** Caller's phone number (E.164 format preferred, e.g., +17144648080) */
  phoneNumber: string;
  /** Caller's name if provided during conversation */
  callerName?: string | undefined;
  /** Street address if provided */
  address?: string | undefined;
  /** ZIP code if provided */
  zipCode?: string | undefined;
  /** Timestamp of the lookup request */
  timestamp: string;
  /** Unique session/call identifier for correlation */
  sessionId: string;
}

/**
 * Individual policy information returned from EZLynx
 */
export interface EZLynxPolicy {
  /** Policy number (e.g., "POL-12345") */
  policyNumber: string;
  /** Type of insurance */
  policyType: 'auto' | 'home' | 'business' | 'life' | 'renters' | 'flood' | 'specialty' | 'other';
  /** Insurance carrier name (e.g., "Progressive", "State Farm") */
  carrier: string;
  /** Policy effective date (ISO 8601) */
  effectiveDate: string;
  /** Policy expiration date (ISO 8601) */
  expirationDate: string;
  /** Current policy status */
  status: 'active' | 'pending' | 'expired' | 'cancelled';
  /** Premium amount if available */
  premium?: number;
  /** Premium payment frequency */
  premiumFrequency?: 'monthly' | 'quarterly' | 'semi-annual' | 'annual';
}

/**
 * Customer record returned FROM EZLynx
 */
export interface EZLynxCustomerRecord {
  /** Whether a matching customer was found */
  found: boolean;
  /** EZLynx internal customer ID */
  customerId?: string;
  /** Customer's full name */
  fullName?: string;
  /** Customer's first name */
  firstName?: string;
  /** Customer's last name */
  lastName?: string;
  /** Primary email address */
  email?: string;
  /** Primary phone number */
  phone?: string;
  /** Full address */
  address?: {
    street?: string;
    city?: string;
    state?: string;
    zipCode?: string;
  };
  /** List of policies associated with this customer */
  policies?: EZLynxPolicy[];
  /** Preferred/assigned agent at Chrysalis */
  preferredAgent?: 'Eric' | 'Cherry' | 'Bryce' | 'Glen' | 'Melissa' | 'Riley';
  /** Customer notes or tags from CRM */
  notes?: string;
  /** VIP or priority customer flag */
  isPriority?: boolean;
}

/**
 * Full webhook response wrapper
 */
export interface EZLynxWebhookResponse {
  /** Whether the API call succeeded */
  success: boolean;
  /** Error message if success is false */
  error?: string | undefined;
  /** Error code for programmatic handling */
  errorCode?: 'NOT_FOUND' | 'TIMEOUT' | 'AUTH_FAILED' | 'RATE_LIMITED' | 'SERVER_ERROR' | undefined;
  /** Customer data if found */
  data?: EZLynxCustomerRecord | undefined;
  /** Response timestamp */
  responseTimestamp: string;
  /** Request correlation ID */
  correlationId: string;
}

/**
 * Session context for tracking customer data during a call
 */
export interface CustomerContext {
  /** Whether EZLynx lookup has been attempted */
  lookupAttempted: boolean;
  /** Whether lookup was successful */
  lookupSuccessful: boolean;
  /** Customer record if found */
  customer?: EZLynxCustomerRecord;
  /** When the lookup was performed */
  lookupTimestamp?: string;
  /** Caller-provided information collected during call */
  collectedInfo: {
    phoneNumber?: string;
    name?: string;
    address?: string;
    zipCode?: string;
  };
}
