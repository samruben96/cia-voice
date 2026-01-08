// ============================================================================
// EZLynx Configuration
// ============================================================================

export interface EZLynxConfig {
  /** Webhook URL for EZLynx customer lookup */
  webhookUrl: string;
  /** API key for authentication (if required) */
  apiKey?: string | undefined;
  /** Request timeout in milliseconds */
  timeoutMs: number;
  /** Whether EZLynx integration is enabled */
  enabled: boolean;
  /** Use mock data instead of real API calls (for development) */
  useMockData: boolean;
}

/**
 * Load EZLynx configuration from environment variables
 */
export function loadEZLynxConfig(): EZLynxConfig {
  return {
    webhookUrl: process.env.EZLYNX_WEBHOOK_URL ?? '',
    apiKey: process.env.EZLYNX_API_KEY,
    timeoutMs: parseInt(process.env.EZLYNX_TIMEOUT_MS ?? '5000', 10),
    enabled: process.env.EZLYNX_ENABLED === 'true',
    useMockData: process.env.EZLYNX_USE_MOCK === 'true',
  };
}

/**
 * Validate the EZLynx configuration
 */
export function validateEZLynxConfig(config: EZLynxConfig): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (config.enabled && !config.webhookUrl) {
    errors.push('EZLYNX_WEBHOOK_URL is required when EZLYNX_ENABLED=true');
  }

  if (config.webhookUrl && !isValidUrl(config.webhookUrl)) {
    errors.push('EZLYNX_WEBHOOK_URL must be a valid HTTPS URL');
  }

  if (isNaN(config.timeoutMs) || config.timeoutMs < 1000 || config.timeoutMs > 30000) {
    errors.push('EZLYNX_TIMEOUT_MS must be between 1000 and 30000');
  }

  return { valid: errors.length === 0, errors };
}

function isValidUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Default configuration for when EZLynx is not configured
 */
export const DEFAULT_EZLYNX_CONFIG: EZLynxConfig = {
  webhookUrl: '',
  apiKey: undefined,
  timeoutMs: 5000,
  enabled: false,
  useMockData: false,
};
