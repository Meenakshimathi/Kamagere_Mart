require('dotenv').config();
const path = require('path');

const env = process.env.NODE_ENV || 'development';
const isProd = env === 'production';

if (isProd && (!process.env.JWT_SECRET || process.env.JWT_SECRET === 'change-me')) {
  throw new Error('JWT_SECRET must be set to a strong random value in production');
}
if (!process.env.JWT_SECRET && !isProd) {
  console.warn('[config] JWT_SECRET not set - using an insecure development secret');
}

module.exports = {
  env,
  isProd,
  port: Number(process.env.PORT) || 3000,
  jwtSecret: process.env.JWT_SECRET || 'dev-only-insecure-secret',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  dbPath: process.env.DB_PATH || path.join(__dirname, '..', 'data', 'kamagere.db'),
  corsOrigins: (process.env.CORS_ORIGINS || 'http://localhost:5500,http://127.0.0.1:5500')
    .split(',').map(s => s.trim()).filter(Boolean),
  frontendDir: path.resolve(process.env.FRONTEND_DIR || path.join(__dirname, '..', '..')),
  deliveryFee: Number(process.env.DELIVERY_FEE ?? 25),
  freeDeliveryThreshold: Number(process.env.FREE_DELIVERY_THRESHOLD ?? 199),
  admin: {
    name: process.env.ADMIN_NAME || 'Store Admin',
    phone: process.env.ADMIN_PHONE,
    email: process.env.ADMIN_EMAIL,
    password: process.env.ADMIN_PASSWORD
  },
  razorpay: {
    keyId: process.env.RAZORPAY_KEY_ID || '',
    keySecret: process.env.RAZORPAY_KEY_SECRET || ''
  }
};
