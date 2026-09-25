import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

function req(name: string, fallback?: string): string {
  const v = process.env[name] ?? fallback;
  if (v === undefined || v === '') {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return v;
}

const isTest = process.env.NODE_ENV === 'test';

export const env = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  isProd: process.env.NODE_ENV === 'production',
  isTest,
  PORT: parseInt(process.env.PORT || '5000', 10),

  MONGODB_URI: req(
    'MONGODB_URI',
    'mongodb://127.0.0.1:27017/amwali'
  ),

  JWT_SECRET: req(
    'JWT_SECRET',
    isTest ? 'test-secret-do-not-use' : 'dev-only-insecure-secret-change-me'
  ),

  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '12h',

  PUBLIC_APP_URL:
    process.env.PUBLIC_APP_URL || 'http://localhost:5173',

  CORS_ORIGINS: (process.env.CORS_ORIGINS || '*')
    .split(',')
    .map((s) => s.trim()),

  UPLOAD_DIR: process.env.UPLOAD_DIR || 'uploads',

  MAX_UPLOAD_MB: parseInt(
    process.env.MAX_UPLOAD_MB || '5',
    10
  ),

  OTP_TTL_MINUTES: parseInt(
    process.env.OTP_TTL_MINUTES || '10',
    10
  ),

  OTP_MAX_ATTEMPTS: parseInt(
    process.env.OTP_MAX_ATTEMPTS || '5',
    10
  ),

  // Development mode: returns the OTP in the API response.
  // MUST remain false in production.
  OTP_DEV_MODE:
    (process.env.OTP_DEV_MODE || 'true') === 'true',

  // Temporary testing option: allows showing the OTP code
  // without enabling OTP_DEV_MODE in production.
  OTP_SHOW_CODE:
    (process.env.OTP_SHOW_CODE || 'false') === 'true',
};

if (env.isProd) {
  if (
    env.JWT_SECRET.includes('change-me') ||
    env.JWT_SECRET.length < 32
  ) {
    throw new Error(
      'JWT_SECRET is not configured for production'
    );
  }

  if (env.OTP_DEV_MODE) {
    throw new Error(
      'OTP_DEV_MODE must be false in production'
    );
  }
}
