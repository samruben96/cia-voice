import assert from 'node:assert';
import { describe, it, beforeEach, afterEach } from 'node:test';
import {
  loadEZLynxConfig,
  validateEZLynxConfig,
  DEFAULT_EZLYNX_CONFIG,
  type EZLynxConfig,
} from '../../ezlynx/config.js';

/**
 * EZLynx Configuration Tests
 *
 * Tests the EZLynx configuration loading and validation functions.
 *
 * Test Strategy:
 * - Environment variable loading
 * - Configuration validation rules
 * - URL format validation (must be HTTPS)
 * - Timeout range validation (1000-30000ms)
 * - Required fields when enabled
 * - Default configuration values
 */
describe('EZLynx Configuration', () => {
  // Store original environment variables
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    // Save original environment
    originalEnv = { ...process.env };
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
  });

  describe('loadEZLynxConfig', () => {
    describe('Default Values', () => {
      it('should return default config when no env vars set', () => {
        // Clear relevant env vars
        delete process.env.EZLYNX_WEBHOOK_URL;
        delete process.env.EZLYNX_API_KEY;
        delete process.env.EZLYNX_TIMEOUT_MS;
        delete process.env.EZLYNX_ENABLED;
        delete process.env.EZLYNX_USE_MOCK;

        const config = loadEZLynxConfig();

        assert.strictEqual(config.webhookUrl, '', 'webhookUrl should default to empty string');
        assert.strictEqual(config.apiKey, undefined, 'apiKey should default to undefined');
        assert.strictEqual(config.timeoutMs, 5000, 'timeoutMs should default to 5000');
        assert.strictEqual(config.enabled, false, 'enabled should default to false');
        assert.strictEqual(config.useMockData, false, 'useMockData should default to false');
      });
    });

    describe('Environment Variable Loading', () => {
      it('should load webhookUrl from EZLYNX_WEBHOOK_URL', () => {
        process.env.EZLYNX_WEBHOOK_URL = 'https://api.example.com/webhook';

        const config = loadEZLynxConfig();

        assert.strictEqual(config.webhookUrl, 'https://api.example.com/webhook');
      });

      it('should load apiKey from EZLYNX_API_KEY', () => {
        process.env.EZLYNX_API_KEY = 'test-api-key-123';

        const config = loadEZLynxConfig();

        assert.strictEqual(config.apiKey, 'test-api-key-123');
      });

      it('should parse timeoutMs from EZLYNX_TIMEOUT_MS', () => {
        process.env.EZLYNX_TIMEOUT_MS = '10000';

        const config = loadEZLynxConfig();

        assert.strictEqual(config.timeoutMs, 10000);
      });

      it('should set enabled to true when EZLYNX_ENABLED is "true"', () => {
        process.env.EZLYNX_ENABLED = 'true';

        const config = loadEZLynxConfig();

        assert.strictEqual(config.enabled, true);
      });

      it('should set enabled to false for any value other than "true"', () => {
        process.env.EZLYNX_ENABLED = 'false';
        assert.strictEqual(loadEZLynxConfig().enabled, false);

        process.env.EZLYNX_ENABLED = 'TRUE';
        assert.strictEqual(loadEZLynxConfig().enabled, false, 'Should be case-sensitive');

        process.env.EZLYNX_ENABLED = '1';
        assert.strictEqual(loadEZLynxConfig().enabled, false);

        process.env.EZLYNX_ENABLED = 'yes';
        assert.strictEqual(loadEZLynxConfig().enabled, false);
      });

      it('should set useMockData to true when EZLYNX_USE_MOCK is "true"', () => {
        process.env.EZLYNX_USE_MOCK = 'true';

        const config = loadEZLynxConfig();

        assert.strictEqual(config.useMockData, true);
      });

      it('should handle invalid timeout gracefully', () => {
        process.env.EZLYNX_TIMEOUT_MS = 'not-a-number';

        const config = loadEZLynxConfig();

        // parseInt returns NaN for invalid input
        assert.ok(Number.isNaN(config.timeoutMs), 'Should result in NaN for invalid timeout');
      });
    });

    describe('Complete Configuration', () => {
      it('should load all configuration values together', () => {
        process.env.EZLYNX_WEBHOOK_URL = 'https://api.ezlynx.com/webhook';
        process.env.EZLYNX_API_KEY = 'secret-key';
        process.env.EZLYNX_TIMEOUT_MS = '8000';
        process.env.EZLYNX_ENABLED = 'true';
        process.env.EZLYNX_USE_MOCK = 'true';

        const config = loadEZLynxConfig();

        assert.strictEqual(config.webhookUrl, 'https://api.ezlynx.com/webhook');
        assert.strictEqual(config.apiKey, 'secret-key');
        assert.strictEqual(config.timeoutMs, 8000);
        assert.strictEqual(config.enabled, true);
        assert.strictEqual(config.useMockData, true);
      });
    });
  });

  describe('validateEZLynxConfig', () => {
    describe('Valid Configurations', () => {
      it('should pass validation for valid enabled config', () => {
        const config: EZLynxConfig = {
          webhookUrl: 'https://api.example.com/webhook',
          apiKey: 'test-key',
          timeoutMs: 5000,
          enabled: true,
          useMockData: false,
        };

        const result = validateEZLynxConfig(config);

        assert.strictEqual(result.valid, true, 'Should be valid');
        assert.strictEqual(result.errors.length, 0, 'Should have no errors');
      });

      it('should pass validation for disabled config without URL', () => {
        const config: EZLynxConfig = {
          webhookUrl: '',
          apiKey: undefined,
          timeoutMs: 5000,
          enabled: false,
          useMockData: false,
        };

        const result = validateEZLynxConfig(config);

        assert.strictEqual(result.valid, true, 'Should be valid when disabled');
        assert.strictEqual(result.errors.length, 0, 'Should have no errors');
      });

      it('should pass validation for mock mode without real URL', () => {
        const config: EZLynxConfig = {
          webhookUrl: 'https://mock.local/webhook',
          apiKey: undefined,
          timeoutMs: 5000,
          enabled: true,
          useMockData: true,
        };

        const result = validateEZLynxConfig(config);

        assert.strictEqual(result.valid, true, 'Should be valid in mock mode');
      });

      it('should pass validation at minimum timeout (1000ms)', () => {
        const config: EZLynxConfig = {
          webhookUrl: 'https://api.example.com/webhook',
          apiKey: undefined,
          timeoutMs: 1000,
          enabled: true,
          useMockData: false,
        };

        const result = validateEZLynxConfig(config);

        assert.strictEqual(result.valid, true, 'Should be valid at minimum timeout');
      });

      it('should pass validation at maximum timeout (30000ms)', () => {
        const config: EZLynxConfig = {
          webhookUrl: 'https://api.example.com/webhook',
          apiKey: undefined,
          timeoutMs: 30000,
          enabled: true,
          useMockData: false,
        };

        const result = validateEZLynxConfig(config);

        assert.strictEqual(result.valid, true, 'Should be valid at maximum timeout');
      });
    });

    describe('Missing Required Fields', () => {
      it('should fail when enabled but webhookUrl is empty', () => {
        const config: EZLynxConfig = {
          webhookUrl: '',
          apiKey: undefined,
          timeoutMs: 5000,
          enabled: true,
          useMockData: false,
        };

        const result = validateEZLynxConfig(config);

        assert.strictEqual(result.valid, false, 'Should be invalid');
        assert.ok(
          result.errors.some((e) => e.includes('EZLYNX_WEBHOOK_URL')),
          'Should mention missing webhook URL',
        );
      });
    });

    describe('Invalid URL Format', () => {
      it('should fail for HTTP URL (non-HTTPS)', () => {
        const config: EZLynxConfig = {
          webhookUrl: 'http://api.example.com/webhook',
          apiKey: undefined,
          timeoutMs: 5000,
          enabled: true,
          useMockData: false,
        };

        const result = validateEZLynxConfig(config);

        assert.strictEqual(result.valid, false, 'Should be invalid for HTTP');
        assert.ok(
          result.errors.some((e) => e.includes('HTTPS')),
          'Should mention HTTPS requirement',
        );
      });

      it('should fail for malformed URL', () => {
        const config: EZLynxConfig = {
          webhookUrl: 'not-a-valid-url',
          apiKey: undefined,
          timeoutMs: 5000,
          enabled: true,
          useMockData: false,
        };

        const result = validateEZLynxConfig(config);

        assert.strictEqual(result.valid, false, 'Should be invalid for malformed URL');
        assert.ok(
          result.errors.some((e) => e.includes('valid')),
          'Should mention URL validity',
        );
      });

      it('should fail for FTP URL', () => {
        const config: EZLynxConfig = {
          webhookUrl: 'ftp://files.example.com/webhook',
          apiKey: undefined,
          timeoutMs: 5000,
          enabled: true,
          useMockData: false,
        };

        const result = validateEZLynxConfig(config);

        assert.strictEqual(result.valid, false, 'Should be invalid for FTP');
      });

      it('should fail for file:// URL', () => {
        const config: EZLynxConfig = {
          webhookUrl: 'file:///etc/passwd',
          apiKey: undefined,
          timeoutMs: 5000,
          enabled: true,
          useMockData: false,
        };

        const result = validateEZLynxConfig(config);

        assert.strictEqual(result.valid, false, 'Should be invalid for file:// URL');
      });
    });

    describe('Timeout Out of Range', () => {
      it('should fail for timeout below 1000ms', () => {
        const config: EZLynxConfig = {
          webhookUrl: 'https://api.example.com/webhook',
          apiKey: undefined,
          timeoutMs: 999,
          enabled: true,
          useMockData: false,
        };

        const result = validateEZLynxConfig(config);

        assert.strictEqual(result.valid, false, 'Should be invalid for low timeout');
        assert.ok(
          result.errors.some((e) => e.includes('1000')),
          'Should mention minimum timeout',
        );
      });

      it('should fail for timeout above 30000ms', () => {
        const config: EZLynxConfig = {
          webhookUrl: 'https://api.example.com/webhook',
          apiKey: undefined,
          timeoutMs: 30001,
          enabled: true,
          useMockData: false,
        };

        const result = validateEZLynxConfig(config);

        assert.strictEqual(result.valid, false, 'Should be invalid for high timeout');
        assert.ok(
          result.errors.some((e) => e.includes('30000')),
          'Should mention maximum timeout',
        );
      });

      it('should fail for zero timeout', () => {
        const config: EZLynxConfig = {
          webhookUrl: 'https://api.example.com/webhook',
          apiKey: undefined,
          timeoutMs: 0,
          enabled: true,
          useMockData: false,
        };

        const result = validateEZLynxConfig(config);

        assert.strictEqual(result.valid, false, 'Should be invalid for zero timeout');
      });

      it('should fail for negative timeout', () => {
        const config: EZLynxConfig = {
          webhookUrl: 'https://api.example.com/webhook',
          apiKey: undefined,
          timeoutMs: -1000,
          enabled: true,
          useMockData: false,
        };

        const result = validateEZLynxConfig(config);

        assert.strictEqual(result.valid, false, 'Should be invalid for negative timeout');
      });
    });

    describe('Multiple Errors', () => {
      it('should report multiple validation errors', () => {
        const config: EZLynxConfig = {
          webhookUrl: 'http://api.example.com/webhook', // HTTP instead of HTTPS
          apiKey: undefined,
          timeoutMs: 100, // Below minimum
          enabled: true,
          useMockData: false,
        };

        const result = validateEZLynxConfig(config);

        assert.strictEqual(result.valid, false, 'Should be invalid');
        assert.ok(result.errors.length >= 2, 'Should have multiple errors');
      });
    });

    describe('Edge Cases', () => {
      it('should handle NaN timeout', () => {
        const config: EZLynxConfig = {
          webhookUrl: 'https://api.example.com/webhook',
          apiKey: undefined,
          timeoutMs: NaN,
          enabled: true,
          useMockData: false,
        };

        const result = validateEZLynxConfig(config);

        assert.strictEqual(result.valid, false, 'Should be invalid for NaN timeout');
      });

      it('should accept HTTPS URL with port', () => {
        const config: EZLynxConfig = {
          webhookUrl: 'https://api.example.com:8443/webhook',
          apiKey: undefined,
          timeoutMs: 5000,
          enabled: true,
          useMockData: false,
        };

        const result = validateEZLynxConfig(config);

        assert.strictEqual(result.valid, true, 'Should accept HTTPS URL with port');
      });

      it('should accept HTTPS URL with query params', () => {
        const config: EZLynxConfig = {
          webhookUrl: 'https://api.example.com/webhook?key=value',
          apiKey: undefined,
          timeoutMs: 5000,
          enabled: true,
          useMockData: false,
        };

        const result = validateEZLynxConfig(config);

        assert.strictEqual(result.valid, true, 'Should accept HTTPS URL with query params');
      });

      it('should accept localhost HTTPS URL', () => {
        const config: EZLynxConfig = {
          webhookUrl: 'https://localhost:3000/webhook',
          apiKey: undefined,
          timeoutMs: 5000,
          enabled: true,
          useMockData: false,
        };

        const result = validateEZLynxConfig(config);

        assert.strictEqual(result.valid, true, 'Should accept localhost HTTPS');
      });
    });
  });

  describe('DEFAULT_EZLYNX_CONFIG', () => {
    it('should have expected default values', () => {
      assert.strictEqual(DEFAULT_EZLYNX_CONFIG.webhookUrl, '', 'Default webhookUrl should be empty');
      assert.strictEqual(DEFAULT_EZLYNX_CONFIG.apiKey, undefined, 'Default apiKey should be undefined');
      assert.strictEqual(DEFAULT_EZLYNX_CONFIG.timeoutMs, 5000, 'Default timeout should be 5000ms');
      assert.strictEqual(DEFAULT_EZLYNX_CONFIG.enabled, false, 'Default enabled should be false');
      assert.strictEqual(DEFAULT_EZLYNX_CONFIG.useMockData, false, 'Default useMockData should be false');
    });

    it('should be valid (as disabled config)', () => {
      const result = validateEZLynxConfig(DEFAULT_EZLYNX_CONFIG);

      assert.strictEqual(result.valid, true, 'Default config should be valid');
    });
  });
});
