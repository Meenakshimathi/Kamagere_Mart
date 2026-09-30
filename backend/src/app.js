const path = require('path');
const fs = require('fs');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const { ZodError } = require('zod');
const config = require('./config');
const { HttpError } = require('./errors');

function createApp() {
  const app = express();
  app.set('trust proxy', 1);

  // CSP is off because the existing frontend relies on inline onclick handlers.
  app.use(helmet({ contentSecurityPolicy: false, crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(cors({ origin: config.corsOrigins, allowedHeaders: ['Content-Type', 'Authorization'] }));
  app.use(express.json({ limit: '100kb' }));
  if (config.env !== 'test') app.use(morgan(config.isProd ? 'combined' : 'dev'));

  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, limit: config.env === 'test' ? 1000 : 30,
    standardHeaders: true, legacyHeaders: false,
    message: { ok: false, error: 'Too many attempts, please try again later' }
  });

  app.get('/api/health', (_req, res) => res.json({ ok: true, service: 'Kamagere Mart API' }));
  app.use('/api/auth/login', authLimiter);
  app.use('/api/auth/register', authLimiter);
  app.use('/api/auth', require('./routes/auth'));
  app.use('/api/products', require('./routes/products'));
  app.use('/api/cart', require('./routes/cart'));
  app.use('/api/orders', require('./routes/orders'));
  app.use('/api/payments', require('./routes/payments'));
  app.use('/api/admin', require('./routes/admin'));
  app.use('/api', (_req, _res, next) => next(new HttpError(404, 'Not found')));

  // Serve the storefront. Only whitelisted folders/files - never the backend/ directory (it holds the DB and .env).
  const root = config.frontendDir;
  for (const dir of ['css', 'js', 'assets', 'pages']) {
    app.use('/' + dir, express.static(path.join(root, dir)));
  }
  app.get('/', (_req, res) => res.sendFile(path.join(root, 'index.html')));
  app.get('/index.html', (_req, res) => res.sendFile(path.join(root, 'index.html')));

  app.use((err, _req, res, _next) => {
    if (err instanceof ZodError) {
      return res.status(400).json({ ok: false, error: err.issues[0]?.message || 'Invalid input' });
    }
    if (err.type === 'entity.parse.failed') return res.status(400).json({ ok: false, error: 'Invalid JSON' });
    if (err instanceof HttpError) return res.status(err.status).json({ ok: false, error: err.message });
    console.error(err);
    res.status(500).json({ ok: false, error: 'Something went wrong' });
  });

  return app;
}

module.exports = createApp;
