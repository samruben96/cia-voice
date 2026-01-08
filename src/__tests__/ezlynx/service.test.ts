import assert from 'node:assert';
import { describe, it, beforeEach, afterEach } from 'node:test';
import { EZLynxService } from '../../ezlynx/service.js';
import type { EZLynxLookupRequest, EZLynxWebhookResponse } from '../../ezlynx/types.js';

/**
 * EZLynx Service Tests
 *
 * Tests the EZLynxService class for customer lookups.
 *
 * Test Strategy:
 * - Mock mode behavior (returns test customer)
 * - Unknown phone returns not found
 * - Disabled service behavior
 * - Enabled but no URL behavior
 * - Phone number normalization
 * - Correlation ID generation
 * - Response structure validation
 */
describe('EZLynxService', () => {
  // Store original environment variables
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    // Save original environment
    originalEnv = { ...process.env };

    // Clear all EZLynx env vars for clean tests
    delete process.env.EZLYNX_WEBHOOK_URL;
    delete process.env.EZLYNX_API_KEY;
    delete process.env.EZLYNX_TIMEOUT_MS;
    delete process.env.EZLYNX_ENABLED;
    delete process.env.EZLYNX_USE_MOCK;
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
  });

  describe('Service Initialization', () => {
    it('should create service with default config', () => {
      const service = new EZLynxService();

      assert.ok(service, 'Service should be created');
      assert.strictEqual(service.isEnabled(), false, 'Should be disabled by default');
    });

    it('should create service with provided config override', () => {
      const service = new EZLynxService({
        webhookUrl: 'https://test.example.com/webhook',
        enabled: true,
      });

      assert.strictEqual(service.isEnabled(), true, 'Should be enabled with config override');
    });

    it('should merge provided config with environment config', () => {
      process.env.EZLYNX_ENABLED = 'true';
      process.env.EZLYNX_WEBHOOK_URL = 'https://env.example.com/webhook';

      const service = new EZLynxService({
        useMockData: true,
      });

      // Should have both env config and override
      assert.strictEqual(service.isEnabled(), true, 'Should use env enabled');
    });
  });

  describe('isEnabled', () => {
    it('should return false when not enabled', () => {
      const service = new EZLynxService({
        enabled: false,
        webhookUrl: 'https://test.example.com/webhook',
      });

      assert.strictEqual(service.isEnabled(), false);
    });

    it('should return false when enabled but no webhook URL', () => {
      const service = new EZLynxService({
        enabled: true,
        webhookUrl: '',
      });

      assert.strictEqual(service.isEnabled(), false, 'Should require webhook URL');
    });

    it('should return true when enabled with webhook URL', () => {
      const service = new EZLynxService({
        enabled: true,
        webhookUrl: 'https://test.example.com/webhook',
      });

      assert.strictEqual(service.isEnabled(), true);
    });
  });

  describe('lookupCustomer - Mock Mode', () => {
    let service: EZLynxService;

    beforeEach(() => {
      service = new EZLynxService({
        enabled: true,
        webhookUrl: 'https://test.example.com/webhook',
        useMockData: true,
        timeoutMs: 5000,
      });
    });

    it('should return mock customer for known phone number +17145551234', async () => {
      const request: EZLynxLookupRequest = {
        phoneNumber: '+17145551234',
        timestamp: new Date().toISOString(),
        sessionId: 'test-session-1',
      };

      const response = await service.lookupCustomer(request);

      assert.strictEqual(response.success, true, 'Should succeed');
      assert.ok(response.data, 'Should have data');
      assert.strictEqual(response.data.found, true, 'Should find customer');
      assert.strictEqual(response.data.fullName, 'John Smith', 'Should return mock customer name');
      assert.strictEqual(response.data.customerId, 'MOCK-001', 'Should return mock customer ID');
    });

    it('should find customer with normalized phone number 7145551234', async () => {
      const request: EZLynxLookupRequest = {
        phoneNumber: '7145551234', // Without +1
        timestamp: new Date().toISOString(),
        sessionId: 'test-session-2',
      };

      const response = await service.lookupCustomer(request);

      assert.strictEqual(response.success, true, 'Should succeed');
      assert.ok(response.data, 'Should have data');
      assert.strictEqual(response.data.found, true, 'Should find customer with normalized phone');
    });

    it('should find customer with formatted phone (714) 555-1234', async () => {
      const request: EZLynxLookupRequest = {
        phoneNumber: '(714) 555-1234',
        timestamp: new Date().toISOString(),
        sessionId: 'test-session-3',
      };

      const response = await service.lookupCustomer(request);

      assert.strictEqual(response.success, true, 'Should succeed');
      assert.ok(response.data, 'Should have data');
      assert.strictEqual(response.data.found, true, 'Should find customer with formatted phone');
    });

    it('should return not found for unknown phone number', async () => {
      const request: EZLynxLookupRequest = {
        phoneNumber: '+19995551234',
        timestamp: new Date().toISOString(),
        sessionId: 'test-session-4',
      };

      const response = await service.lookupCustomer(request);

      assert.strictEqual(response.success, true, 'Should succeed (lookup worked)');
      assert.ok(response.data, 'Should have data');
      assert.strictEqual(response.data.found, false, 'Should not find unknown customer');
    });

    it('should include policies in mock customer data', async () => {
      const request: EZLynxLookupRequest = {
        phoneNumber: '+17145551234',
        timestamp: new Date().toISOString(),
        sessionId: 'test-session-5',
      };

      const response = await service.lookupCustomer(request);

      assert.ok(response.data?.policies, 'Should have policies array');
      assert.strictEqual(response.data?.policies?.length, 2, 'Should have 2 mock policies');

      // Check first policy (auto)
      const autoPolicy = response.data?.policies?.find((p) => p.policyType === 'auto');
      assert.ok(autoPolicy, 'Should have auto policy');
      assert.strictEqual(autoPolicy?.carrier, 'Progressive', 'Auto policy should be Progressive');

      // Check second policy (home)
      const homePolicy = response.data?.policies?.find((p) => p.policyType === 'home');
      assert.ok(homePolicy, 'Should have home policy');
      assert.strictEqual(homePolicy?.carrier, 'State Farm', 'Home policy should be State Farm');
    });

    it('should include preferred agent in mock customer data', async () => {
      const request: EZLynxLookupRequest = {
        phoneNumber: '+17145551234',
        timestamp: new Date().toISOString(),
        sessionId: 'test-session-6',
      };

      const response = await service.lookupCustomer(request);

      assert.strictEqual(response.data?.preferredAgent, 'Cherry', 'Should have preferred agent');
    });

    it('should include correlation ID in response', async () => {
      const request: EZLynxLookupRequest = {
        phoneNumber: '+17145551234',
        timestamp: new Date().toISOString(),
        sessionId: 'test-session-7',
      };

      const response = await service.lookupCustomer(request);

      assert.ok(response.correlationId, 'Should have correlation ID');
      assert.ok(response.correlationId.startsWith('ezl-'), 'Correlation ID should start with ezl-');
    });

    it('should include response timestamp', async () => {
      const request: EZLynxLookupRequest = {
        phoneNumber: '+17145551234',
        timestamp: new Date().toISOString(),
        sessionId: 'test-session-8',
      };

      const response = await service.lookupCustomer(request);

      assert.ok(response.responseTimestamp, 'Should have response timestamp');

      // Verify it's a valid ISO date
      const date = new Date(response.responseTimestamp);
      assert.ok(!isNaN(date.getTime()), 'Timestamp should be valid date');
    });
  });

  describe('lookupCustomer - Disabled Service', () => {
    it('should return appropriate response when service is disabled', async () => {
      const service = new EZLynxService({
        enabled: false,
        webhookUrl: 'https://test.example.com/webhook',
      });

      const request: EZLynxLookupRequest = {
        phoneNumber: '+17145551234',
        timestamp: new Date().toISOString(),
        sessionId: 'test-session-disabled',
      };

      const response = await service.lookupCustomer(request);

      assert.strictEqual(response.success, true, 'Should succeed (graceful degradation)');
      assert.ok(response.data, 'Should have data');
      assert.strictEqual(response.data.found, false, 'Should return not found');
    });
  });

  describe('lookupCustomer - Enabled but No URL', () => {
    it('should return not found when enabled but no webhook URL', async () => {
      const service = new EZLynxService({
        enabled: true,
        webhookUrl: '', // Empty URL
      });

      const request: EZLynxLookupRequest = {
        phoneNumber: '+17145551234',
        timestamp: new Date().toISOString(),
        sessionId: 'test-session-no-url',
      };

      const response = await service.lookupCustomer(request);

      // Service.isEnabled() returns false when no URL, so it returns placeholder
      assert.strictEqual(response.success, true, 'Should succeed with placeholder');
      assert.ok(response.data, 'Should have data');
      assert.strictEqual(response.data.found, false, 'Should return not found');
    });
  });

  describe('lookupCustomer - Real API (Placeholder)', () => {
    it('should return placeholder response when not in mock mode', async () => {
      const service = new EZLynxService({
        enabled: true,
        webhookUrl: 'https://real-api.example.com/webhook',
        useMockData: false, // Real mode, but API not implemented
        timeoutMs: 5000,
      });

      const request: EZLynxLookupRequest = {
        phoneNumber: '+17145551234',
        timestamp: new Date().toISOString(),
        sessionId: 'test-session-real',
      };

      const response = await service.lookupCustomer(request);

      // Real API is not implemented, so returns placeholder
      assert.strictEqual(response.success, true, 'Should succeed with placeholder');
      assert.ok(response.data, 'Should have data');
      assert.strictEqual(response.data.found, false, 'Should return not found (placeholder)');
    });
  });

  describe('Response Structure Validation', () => {
    let service: EZLynxService;

    beforeEach(() => {
      service = new EZLynxService({
        enabled: true,
        webhookUrl: 'https://test.example.com/webhook',
        useMockData: true,
      });
    });

    it('should have all required fields in successful response', async () => {
      const request: EZLynxLookupRequest = {
        phoneNumber: '+17145551234',
        timestamp: new Date().toISOString(),
        sessionId: 'test-validation-1',
      };

      const response = await service.lookupCustomer(request);

      assert.ok('success' in response, 'Should have success field');
      assert.ok('responseTimestamp' in response, 'Should have responseTimestamp');
      assert.ok('correlationId' in response, 'Should have correlationId');
      assert.ok('data' in response, 'Should have data field');
    });

    it('should have customer details when found', async () => {
      const request: EZLynxLookupRequest = {
        phoneNumber: '+17145551234',
        timestamp: new Date().toISOString(),
        sessionId: 'test-validation-2',
      };

      const response = await service.lookupCustomer(request);

      assert.ok(response.data?.found, 'Should be found');
      assert.ok(response.data?.customerId, 'Should have customer ID');
      assert.ok(response.data?.fullName, 'Should have full name');
      assert.ok(response.data?.firstName, 'Should have first name');
      assert.ok(response.data?.lastName, 'Should have last name');
      assert.ok(response.data?.email, 'Should have email');
      assert.ok(response.data?.phone, 'Should have phone');
    });

    it('should have address details when found', async () => {
      const request: EZLynxLookupRequest = {
        phoneNumber: '+17145551234',
        timestamp: new Date().toISOString(),
        sessionId: 'test-validation-3',
      };

      const response = await service.lookupCustomer(request);

      assert.ok(response.data?.address, 'Should have address');
      assert.ok(response.data?.address?.street, 'Should have street');
      assert.ok(response.data?.address?.city, 'Should have city');
      assert.ok(response.data?.address?.state, 'Should have state');
      assert.ok(response.data?.address?.zipCode, 'Should have zip code');
    });

    it('should have policy details when found', async () => {
      const request: EZLynxLookupRequest = {
        phoneNumber: '+17145551234',
        timestamp: new Date().toISOString(),
        sessionId: 'test-validation-4',
      };

      const response = await service.lookupCustomer(request);

      assert.ok(Array.isArray(response.data?.policies), 'Should have policies array');
      assert.ok(response.data!.policies!.length > 0, 'Should have at least one policy');

      const policy = response.data!.policies![0]!;
      assert.ok(policy.policyNumber, 'Policy should have number');
      assert.ok(policy.policyType, 'Policy should have type');
      assert.ok(policy.carrier, 'Policy should have carrier');
      assert.ok(policy.effectiveDate, 'Policy should have effective date');
      assert.ok(policy.expirationDate, 'Policy should have expiration date');
      assert.ok(policy.status, 'Policy should have status');
    });
  });

  describe('Phone Number Normalization', () => {
    let service: EZLynxService;

    beforeEach(() => {
      service = new EZLynxService({
        enabled: true,
        webhookUrl: 'https://test.example.com/webhook',
        useMockData: true,
      });
    });

    it('should normalize phone with dashes', async () => {
      const request: EZLynxLookupRequest = {
        phoneNumber: '714-555-1234',
        timestamp: new Date().toISOString(),
        sessionId: 'test-normalize-1',
      };

      const response = await service.lookupCustomer(request);

      assert.strictEqual(response.data?.found, true, 'Should find with dashed phone');
    });

    it('should normalize phone with dots', async () => {
      const request: EZLynxLookupRequest = {
        phoneNumber: '714.555.1234',
        timestamp: new Date().toISOString(),
        sessionId: 'test-normalize-2',
      };

      const response = await service.lookupCustomer(request);

      assert.strictEqual(response.data?.found, true, 'Should find with dotted phone');
    });

    it('should normalize phone with spaces', async () => {
      const request: EZLynxLookupRequest = {
        phoneNumber: '714 555 1234',
        timestamp: new Date().toISOString(),
        sessionId: 'test-normalize-3',
      };

      const response = await service.lookupCustomer(request);

      assert.strictEqual(response.data?.found, true, 'Should find with spaced phone');
    });

    it('should normalize phone with country code prefix', async () => {
      const request: EZLynxLookupRequest = {
        phoneNumber: '1-714-555-1234',
        timestamp: new Date().toISOString(),
        sessionId: 'test-normalize-4',
      };

      const response = await service.lookupCustomer(request);

      assert.strictEqual(response.data?.found, true, 'Should find with country code');
    });
  });

  describe('Optional Request Fields', () => {
    let service: EZLynxService;

    beforeEach(() => {
      service = new EZLynxService({
        enabled: true,
        webhookUrl: 'https://test.example.com/webhook',
        useMockData: true,
      });
    });

    it('should accept request with callerName', async () => {
      const request: EZLynxLookupRequest = {
        phoneNumber: '+17145551234',
        callerName: 'John Smith',
        timestamp: new Date().toISOString(),
        sessionId: 'test-caller-name',
      };

      const response = await service.lookupCustomer(request);

      assert.strictEqual(response.success, true, 'Should succeed with caller name');
    });

    it('should accept request with address', async () => {
      const request: EZLynxLookupRequest = {
        phoneNumber: '+19995559999',
        address: '123 Test St',
        timestamp: new Date().toISOString(),
        sessionId: 'test-address',
      };

      const response = await service.lookupCustomer(request);

      assert.strictEqual(response.success, true, 'Should succeed with address');
    });

    it('should accept request with zipCode', async () => {
      const request: EZLynxLookupRequest = {
        phoneNumber: '+19995559999',
        zipCode: '92626',
        timestamp: new Date().toISOString(),
        sessionId: 'test-zip',
      };

      const response = await service.lookupCustomer(request);

      assert.strictEqual(response.success, true, 'Should succeed with zip code');
    });
  });

  describe('Correlation ID Generation', () => {
    let service: EZLynxService;

    beforeEach(() => {
      service = new EZLynxService({
        enabled: true,
        webhookUrl: 'https://test.example.com/webhook',
        useMockData: true,
      });
    });

    it('should generate unique correlation IDs for each request', async () => {
      const request1: EZLynxLookupRequest = {
        phoneNumber: '+17145551234',
        timestamp: new Date().toISOString(),
        sessionId: 'test-correlation-1',
      };

      const request2: EZLynxLookupRequest = {
        phoneNumber: '+17145551234',
        timestamp: new Date().toISOString(),
        sessionId: 'test-correlation-2',
      };

      const response1 = await service.lookupCustomer(request1);
      const response2 = await service.lookupCustomer(request2);

      assert.notStrictEqual(
        response1.correlationId,
        response2.correlationId,
        'Correlation IDs should be unique',
      );
    });

    it('should format correlation ID correctly', async () => {
      const request: EZLynxLookupRequest = {
        phoneNumber: '+17145551234',
        timestamp: new Date().toISOString(),
        sessionId: 'test-correlation-format',
      };

      const response = await service.lookupCustomer(request);

      // Format: ezl-{timestamp}-{random}
      const parts = response.correlationId.split('-');
      assert.strictEqual(parts[0], 'ezl', 'Should start with ezl');
      assert.ok(parts.length >= 2, 'Should have multiple parts');
    });
  });
});
