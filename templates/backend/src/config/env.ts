import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

export interface EnvironmentConfig {
  PORT: number;
  NODE_ENV: 'development' | 'production' | 'test';
  MONGODB_URI: string;
  CLIENT_URL: string;
  JWT_SECRET: string;
  JWT_EXPIRES_IN: string;
  EMAIL_PROVIDER: 'smtp' | 'console';
  SMTP_HOST?: string;
  SMTP_PORT?: number;
  SMTP_USER?: string;
  SMTP_PASS?: string;
  EMAIL_FROM: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  GOOGLE_CALLBACK_URL?: string;
  IS_GOOGLE_AUTH_CONFIGURED: boolean;
}

/**
 * Validates and extracts typed environment variables.
 * Throws a sanitized Error if required variables are missing or invalid.
 */
function validateEnv(): EnvironmentConfig {
  const errors: string[] = [];

  // Validate PORT
  const rawPort = process.env.PORT || '5000';
  const port = parseInt(rawPort, 10);
  if (isNaN(port) || port < 1 || port > 65535) {
    errors.push(`Invalid PORT "${rawPort}". Must be a valid TCP port number between 1 and 65535.`);
  }

  // Validate NODE_ENV
  const rawEnv = (process.env.NODE_ENV || 'development').toLowerCase();
  const validEnvironments = ['development', 'production', 'test'];
  const nodeEnv = (validEnvironments.includes(rawEnv) ? rawEnv : 'development') as
    | 'development'
    | 'production'
    | 'test';

  // Validate MONGODB_URI (required)
  const rawMongoUri = process.env.MONGODB_URI?.trim();
  if (!rawMongoUri) {
    errors.push('Missing required environment variable: MONGODB_URI.');
  }

  // Validate CLIENT_URL
  const clientUrl = process.env.CLIENT_URL?.trim() || 'http://localhost:3000';

  // Validate JWT_SECRET
  // In development and production, JWT_SECRET is strictly required and must have at least 32 characters.
  // In test mode, an isolated test fallback is permitted if omitted to preserve standalone test execution.
  let jwtSecret = process.env.JWT_SECRET?.trim();
  if (!jwtSecret && nodeEnv === 'test') {
    jwtSecret = 'devlaunch_test_jwt_secret_min_32_chars_long';
  }

  if (!jwtSecret) {
    errors.push('Missing required environment variable: JWT_SECRET.');
  } else if (jwtSecret.length < 32) {
    errors.push('Invalid JWT_SECRET. Secret must be at least 32 characters long.');
  }

  // Validate JWT_EXPIRES_IN (defaults to '7d')
  const jwtExpiresIn = process.env.JWT_EXPIRES_IN?.trim() || '7d';
  const validExpiryPattern = /^(\d+[smhd]|\d+)$/;
  if (!validExpiryPattern.test(jwtExpiresIn)) {
    errors.push(
      `Invalid JWT_EXPIRES_IN "${jwtExpiresIn}". Format must be a number with unit (e.g., "7d", "24h", "60m", "3600s") or raw seconds.`
    );
  }

  // Validate EMAIL_PROVIDER and SMTP settings
  const rawEmailProvider = (
    process.env.EMAIL_PROVIDER || (nodeEnv === 'production' ? 'smtp' : 'console')
  )
    .trim()
    .toLowerCase();
  const validEmailProviders = ['smtp', 'console'];
  const emailProvider = (validEmailProviders.includes(rawEmailProvider)
    ? rawEmailProvider
    : 'console') as 'smtp' | 'console';

  if (nodeEnv === 'production' && emailProvider === 'console') {
    errors.push('Console email provider is not permitted in production mode. Configure EMAIL_PROVIDER=smtp.');
  }

  const smtpHost = process.env.SMTP_HOST?.trim();
  const rawSmtpPort = process.env.SMTP_PORT?.trim();
  const smtpPort = rawSmtpPort ? parseInt(rawSmtpPort, 10) : 587;
  const smtpUser = process.env.SMTP_USER?.trim();
  const smtpPass = process.env.SMTP_PASS?.trim();
  const emailFrom = process.env.EMAIL_FROM?.trim() || 'DevLaunch <no-reply@devlaunch.local>';

  if (emailProvider === 'smtp') {
    if (!smtpHost) {
      errors.push('Missing required environment variable for SMTP: SMTP_HOST.');
    }
    if (isNaN(smtpPort) || smtpPort < 1 || smtpPort > 65535) {
      errors.push(`Invalid SMTP_PORT "${rawSmtpPort}". Must be a valid TCP port number between 1 and 65535.`);
    }
    if (!smtpUser) {
      errors.push('Missing required environment variable for SMTP: SMTP_USER.');
    }
    if (!smtpPass) {
      errors.push('Missing required environment variable for SMTP: SMTP_PASS.');
    }
  }

  // Validate Google OAuth configuration (Optional, but if any variable is set, all must be present and valid)
  const rawGoogleClientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const rawGoogleClientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  const rawGoogleCallbackUrl = process.env.GOOGLE_CALLBACK_URL?.trim();

  const anyGoogleSet = Boolean(rawGoogleClientId || rawGoogleClientSecret || rawGoogleCallbackUrl);
  const isGoogleAuthConfigured = Boolean(rawGoogleClientId && rawGoogleClientSecret && rawGoogleCallbackUrl);

  if (anyGoogleSet && !isGoogleAuthConfigured) {
    if (!rawGoogleClientId) {
      errors.push('Incomplete Google OAuth configuration: missing GOOGLE_CLIENT_ID.');
    }
    if (!rawGoogleClientSecret) {
      errors.push('Incomplete Google OAuth configuration: missing GOOGLE_CLIENT_SECRET.');
    }
    if (!rawGoogleCallbackUrl) {
      errors.push('Incomplete Google OAuth configuration: missing GOOGLE_CALLBACK_URL.');
    }
  }

  if (rawGoogleCallbackUrl) {
    try {
      new URL(rawGoogleCallbackUrl);
    } catch {
      errors.push(`Invalid GOOGLE_CALLBACK_URL "${rawGoogleCallbackUrl}". Must be a valid absolute URL.`);
    }
  }

  if (errors.length > 0) {
    // Provide a sanitized error message that never reveals secrets
    throw new Error(
      `[DevLaunch Config Error] Configuration validation failed:\n - ${errors.join('\n - ')}`
    );
  }

  return {
    PORT: port,
    NODE_ENV: nodeEnv,
    MONGODB_URI: rawMongoUri as string,
    CLIENT_URL: clientUrl,
    JWT_SECRET: jwtSecret as string,
    JWT_EXPIRES_IN: jwtExpiresIn,
    EMAIL_PROVIDER: emailProvider,
    SMTP_HOST: smtpHost,
    SMTP_PORT: smtpPort,
    SMTP_USER: smtpUser,
    SMTP_PASS: smtpPass,
    EMAIL_FROM: emailFrom,
    GOOGLE_CLIENT_ID: rawGoogleClientId,
    GOOGLE_CLIENT_SECRET: rawGoogleClientSecret,
    GOOGLE_CALLBACK_URL: rawGoogleCallbackUrl,
    IS_GOOGLE_AUTH_CONFIGURED: isGoogleAuthConfigured,
  };
}

export const env = validateEnv();
