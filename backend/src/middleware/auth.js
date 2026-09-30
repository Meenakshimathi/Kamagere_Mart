const jwt = require('jsonwebtoken');
const config = require('../config');
const db = require('../db');
const { HttpError } = require('../errors');

function signToken(user) {
  return jwt.sign({ sub: user.id, role: user.role }, config.jwtSecret, { expiresIn: config.jwtExpiresIn });
}

function loadUser(req) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return null;
  try {
    const payload = jwt.verify(token, config.jwtSecret);
    // Re-read from DB so deleted users / role changes take effect immediately.
    return db.prepare('SELECT id, name, email, phone, address, role FROM users WHERE id = ?').get(payload.sub) || null;
  } catch {
    return null;
  }
}

function requireAuth(req, _res, next) {
  const user = loadUser(req);
  if (!user) return next(new HttpError(401, 'Please log in to continue'));
  req.user = user;
  next();
}

function requireAdmin(req, _res, next) {
  requireAuth(req, _res, err => {
    if (err) return next(err);
    if (req.user.role !== 'admin') return next(new HttpError(403, 'Admin access required'));
    next();
  });
}

module.exports = { signToken, requireAuth, requireAdmin };
