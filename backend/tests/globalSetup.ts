export default function setup() {
  process.env.NODE_ENV = 'test';
  process.env.MONGODB_URI = process.env.TEST_MONGODB_URI || 'mongodb://127.0.0.1:27017/amwali_test';
  process.env.JWT_SECRET = 'test-secret-do-not-use-in-production';
  process.env.JWT_EXPIRES_IN = '1h';
  process.env.PUBLIC_APP_URL = 'http://localhost:5173';
  process.env.OTP_DEV_MODE = 'true';
  process.env.UPLOAD_DIR = 'tests/.uploads';
  process.env.CORS_ORIGINS = '*';
}
