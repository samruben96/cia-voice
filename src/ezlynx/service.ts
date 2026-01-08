// ============================================================================
// EZLynx Webhook Service - Placeholder Implementation
// ============================================================================
import { type EZLynxConfig, loadEZLynxConfig, validateEZLynxConfig } from './config.js';
import type { EZLynxCustomerRecord, EZLynxLookupRequest, EZLynxWebhookResponse } from './types.js';

/**
 * EZLynx webhook service for customer lookups
 */
export class EZLynxService {
  private config: EZLynxConfig;

  constructor(config?: Partial<EZLynxConfig>) {
    const envConfig = loadEZLynxConfig();
    this.config = { ...envConfig, ...config };

    // Validate configuration on instantiation
    const validation = validateEZLynxConfig(this.config);
    if (!validation.valid && this.config.enabled) {
      console.warn('[EZLynx] Configuration warnings:', validation.errors);
    }
  }

  /**
   * Check if EZLynx integration is available
   */
  isEnabled(): boolean {
    return this.config.enabled && !!this.config.webhookUrl;
  }

  /**
   * Look up a customer by phone number and optional additional info
   */
  async lookupCustomer(request: EZLynxLookupRequest): Promise<EZLynxWebhookResponse> {
    const correlationId = `ezl-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

    // If not enabled or using mock data, return placeholder response
    if (!this.isEnabled()) {
      console.log('[EZLynx] Integration not enabled, returning placeholder response');
      return this.createPlaceholderResponse(correlationId, 'Integration not enabled');
    }

    if (this.config.useMockData) {
      console.log('[EZLynx] Using mock data for lookup');
      return this.createMockResponse(request, correlationId);
    }

    // TODO: Implement actual webhook call when EZLynx integration goes live
    // This is the placeholder for the real implementation
    try {
      console.log('[EZLynx] Would call webhook:', {
        url: this.config.webhookUrl,
        request,
        correlationId,
      });

      // Placeholder: Return "not found" until integration is live
      return this.createPlaceholderResponse(correlationId, 'Webhook not yet implemented');

      // FUTURE IMPLEMENTATION:
      // const response = await fetch(this.config.webhookUrl, {
      //   method: 'POST',
      //   headers: {
      //     'Content-Type': 'application/json',
      //     'Authorization': `Bearer ${this.config.apiKey}`,
      //     'X-Correlation-ID': correlationId,
      //   },
      //   body: JSON.stringify(request),
      //   signal: AbortSignal.timeout(this.config.timeoutMs),
      // });
      //
      // if (!response.ok) {
      //   throw new Error(`EZLynx API error: ${response.status}`);
      // }
      //
      // const data = await response.json() as EZLynxWebhookResponse;
      // return { ...data, correlationId };
    } catch (error) {
      console.error('[EZLynx] Lookup failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        errorCode: 'SERVER_ERROR',
        responseTimestamp: new Date().toISOString(),
        correlationId,
      };
    }
  }

  /**
   * Create a placeholder response when integration is not active
   */
  private createPlaceholderResponse(
    correlationId: string,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _reason: string,
  ): EZLynxWebhookResponse {
    return {
      success: true,
      data: {
        found: false,
      },
      responseTimestamp: new Date().toISOString(),
      correlationId,
    };
  }

  /**
   * Create mock response for development/testing
   */
  private createMockResponse(
    request: EZLynxLookupRequest,
    correlationId: string,
  ): EZLynxWebhookResponse {
    // Simulate finding a customer for certain phone numbers (for testing)
    const mockCustomers: Record<string, EZLynxCustomerRecord> = {
      '+17145551234': {
        found: true,
        customerId: 'MOCK-001',
        fullName: 'John Smith',
        firstName: 'John',
        lastName: 'Smith',
        email: 'john.smith@example.com',
        phone: '+17145551234',
        address: {
          street: '123 Main St',
          city: 'Costa Mesa',
          state: 'CA',
          zipCode: '92626',
        },
        policies: [
          {
            policyNumber: 'AUTO-123456',
            policyType: 'auto',
            carrier: 'Progressive',
            effectiveDate: '2024-01-01',
            expirationDate: '2025-01-01',
            status: 'active',
            premium: 150,
            premiumFrequency: 'monthly',
          },
          {
            policyNumber: 'HOME-789012',
            policyType: 'home',
            carrier: 'State Farm',
            effectiveDate: '2024-03-15',
            expirationDate: '2025-03-15',
            status: 'active',
            premium: 1200,
            premiumFrequency: 'annual',
          },
        ],
        preferredAgent: 'Cherry',
        isPriority: false,
      },
    };

    // Normalize phone number for lookup (strip non-digits and optional leading 1)
    let normalizedPhone = request.phoneNumber.replace(/\D/g, '');
    // If 11 digits starting with 1, remove the country code
    if (normalizedPhone.length === 11 && normalizedPhone.startsWith('1')) {
      normalizedPhone = normalizedPhone.slice(1);
    }
    const matchKey = Object.keys(mockCustomers).find((key) => {
      let keyDigits = key.replace(/\D/g, '');
      // Also normalize the key in case it has country code
      if (keyDigits.length === 11 && keyDigits.startsWith('1')) {
        keyDigits = keyDigits.slice(1);
      }
      return keyDigits === normalizedPhone;
    });

    if (matchKey) {
      return {
        success: true,
        data: mockCustomers[matchKey],
        responseTimestamp: new Date().toISOString(),
        correlationId,
      };
    }

    return {
      success: true,
      data: { found: false },
      responseTimestamp: new Date().toISOString(),
      correlationId,
    };
  }
}

// Singleton instance for use across the application
let serviceInstance: EZLynxService | null = null;

export function getEZLynxService(): EZLynxService {
  if (!serviceInstance) {
    serviceInstance = new EZLynxService();
  }
  return serviceInstance;
}
