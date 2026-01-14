/**
 * Environment Configuration
 *
 * Centralized, type-safe access to environment variables
 * with validation and sensible defaults
 */

import { Platform } from 'react-native';

/**
 * App Environment
 */
export type AppEnvironment = 'development' | 'staging' | 'production';

/**
 * Environment Configuration
 */
export const env = {
  /**
   * Current app environment
   */
  APP_ENV: (process.env.EXPO_PUBLIC_APP_ENV || 'development') as AppEnvironment,

  /**
   * Is development mode
   */
  get isDevelopment(): boolean {
    return this.APP_ENV === 'development' || __DEV__;
  },

  /**
   * Is production mode
   */
  get isProduction(): boolean {
    return this.APP_ENV === 'production' && !__DEV__;
  },

  /**
   * Supabase Configuration
   */
  SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL || '',
  SUPABASE_ANON_KEY: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '',

  /**
   * RevenueCat Configuration
   */
  REVENUECAT_IOS_KEY: process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY || '',
  REVENUECAT_ANDROID_KEY: process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY || '',

  /**
   * Get RevenueCat key for current platform
   */
  get REVENUECAT_KEY(): string {
    return Platform.OS === 'ios'
      ? this.REVENUECAT_IOS_KEY
      : this.REVENUECAT_ANDROID_KEY;
  },

  /**
   * Google Maps API Key (for Android map)
   */
  GOOGLE_MAPS_API_KEY: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || '',

  /**
   * Sentry DSN for error tracking
   */
  SENTRY_DSN: process.env.EXPO_PUBLIC_SENTRY_DSN || '',

  /**
   * Identity Verification API Configuration
   * Supports: Onfido, Jumio, or AWS Rekognition
   */
  VERIFICATION_PROVIDER: (process.env.EXPO_PUBLIC_VERIFICATION_PROVIDER || 'onfido') as 'onfido' | 'jumio' | 'aws',
  ONFIDO_API_TOKEN: process.env.EXPO_PUBLIC_ONFIDO_API_TOKEN || '',
  JUMIO_API_TOKEN: process.env.EXPO_PUBLIC_JUMIO_API_TOKEN || '',
  JUMIO_API_SECRET: process.env.EXPO_PUBLIC_JUMIO_API_SECRET || '',
  AWS_ACCESS_KEY_ID: process.env.EXPO_PUBLIC_AWS_ACCESS_KEY_ID || '',
  AWS_SECRET_ACCESS_KEY: process.env.EXPO_PUBLIC_AWS_SECRET_ACCESS_KEY || '',
  AWS_REGION: process.env.EXPO_PUBLIC_AWS_REGION || 'us-east-1',
} as const;

/**
 * Required environment variables for production
 */
const REQUIRED_PROD_VARS = [
  'SUPABASE_URL',
  'SUPABASE_ANON_KEY',
] as const;

/**
 * Optional but recommended environment variables
 */
const OPTIONAL_VARS = [
  'REVENUECAT_IOS_KEY',
  'REVENUECAT_ANDROID_KEY',
  'GOOGLE_MAPS_API_KEY',
  'SENTRY_DSN',
] as const;

/**
 * Validate environment configuration
 * Call this on app startup to catch missing configs early
 */
export function validateEnv(): { isValid: boolean; warnings: string[]; errors: string[] } {
  const warnings: string[] = [];
  const errors: string[] = [];

  // Check required variables
  for (const varName of REQUIRED_PROD_VARS) {
    const value = env[varName];
    if (!value || value.includes('placeholder') || value.includes('your-')) {
      if (env.isProduction) {
        errors.push(`Missing required environment variable: ${varName}`);
      } else {
        warnings.push(`Missing environment variable: ${varName} (required in production)`);
      }
    }
  }

  // Check optional variables
  for (const varName of OPTIONAL_VARS) {
    const value = env[varName as keyof typeof env];
    if (!value) {
      warnings.push(`Optional environment variable not set: ${varName}`);
    }
  }

  // Log warnings in development
  if (env.isDevelopment) {
    warnings.forEach((w) => console.warn(`[ENV] ${w}`));
    errors.forEach((e) => console.error(`[ENV] ${e}`));
  }

  return {
    isValid: errors.length === 0,
    warnings,
    errors,
  };
}

/**
 * Check if Supabase is configured
 */
export function isSupabaseConfigured(): boolean {
  return Boolean(
    env.SUPABASE_URL &&
    env.SUPABASE_ANON_KEY &&
    !env.SUPABASE_URL.includes('placeholder') &&
    !env.SUPABASE_URL.includes('your-')
  );
}

/**
 * Check if RevenueCat is configured
 */
export function isRevenueCatConfigured(): boolean {
  return Boolean(env.REVENUECAT_KEY);
}

/**
 * Check if Google Maps is configured
 */
export function isGoogleMapsConfigured(): boolean {
  return Boolean(env.GOOGLE_MAPS_API_KEY);
}

/**
 * Check if Sentry is configured
 */
export function isSentryConfigured(): boolean {
  return Boolean(env.SENTRY_DSN);
}

/**
 * Check if identity verification is configured
 */
export function isVerificationConfigured(): boolean {
  const provider = env.VERIFICATION_PROVIDER;
  switch (provider) {
    case 'onfido':
      return Boolean(env.ONFIDO_API_TOKEN);
    case 'jumio':
      return Boolean(env.JUMIO_API_TOKEN && env.JUMIO_API_SECRET);
    case 'aws':
      return Boolean(env.AWS_ACCESS_KEY_ID && env.AWS_SECRET_ACCESS_KEY);
    default:
      return false;
  }
}
