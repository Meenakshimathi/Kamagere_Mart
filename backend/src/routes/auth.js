const express = require('express');
const bcrypt = require('bcryptjs');
const { z } = require('zod');
const db = require('../db');
const { HttpError, asyncHandler } = require('../errors');
const { signToken, requireAuth } = require('../middleware/auth');
const { userOut } = require('../services');

const router = express.Router();

const phone = z.string().trim().regex(/^[6-9]\d{9}$/, 'Enter a valid 10-digit Indian mobile number');
const password = z.string().min(8, 'Password must be at least 8 characters').max(72);

const registerSchema = z.object({
  name: z.string().trim().min(2, 'Enter your full name').max(80),
  email: z.string().trim().email('Enter a valid email').max(120),
  phone,
  password,
  address: z.string().trim().max(500).optional().default('')
});

const loginSchema = z.object({
  phone: z.string().trim().optional(),
  email: z.string().trim().optional(),
  password: z.string().min(1, 'Enter your password')
}).refine(v => v.phone || v.email, { message: 'Enter phone number' });

// A real hash to compare against when the user doesn't exist, so response time doesn't reveal accounts.
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 10);

router.post('/register', asyncHandler(async (req, res) => {
  const data = registerSchema.parse(req.body);
  const dup = db.prepare('SELECT phone, email FROM users WHERE phone = ? OR email = ?').get(data.phone, data.email);
  if (dup) {
    throw new HttpError(409, dup.phone === data.phone
      ? 'An account with this phone number already exists'
      : 'An account with this email already exists');
  }
  const hash = await bcrypt.hash(data.password, 10);
  const { lastInsertRowid } = db.prepare(
    'INSERT INTO users (name, email, phone, password_hash, address) VALUES (?, ?, ?, ?, ?)'
  ).run(data.name, data.email, data.phone, hash, data.address);
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(lastInsertRowid);
  res.status(201).json({ ok: true, token: signToken(user), user: userOut(user) });
}));

router.post('/login', asyncHandler(async (req, res) => {
  const { phone: ph, email, password: pw } = loginSchema.parse(req.body);
  const user = ph
    ? db.prepare('SELECT * FROM users WHERE phone = ?').get(ph)
    : db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  const valid = await bcrypt.compare(pw, user ? user.password_hash : DUMMY_HASH);
  if (!user || !valid) throw new HttpError(401, 'Incorrect phone number or password');
  res.json({ ok: true, token: signToken(user), user: userOut(user) });
}));

router.get('/me', requireAuth, (req, res) => res.json({ ok: true, user: userOut(req.user) }));

router.put('/me', requireAuth, (req, res) => {
  const data = z.object({
    name: z.string().trim().min(2).max(80).optional(),
    address: z.string().trim().max(500).optional()
  }).parse(req.body);
  db.prepare('UPDATE users SET name = COALESCE(?, name), address = COALESCE(?, address) WHERE id = ?')
    .run(data.name ?? null, data.address ?? null, req.user.id);
  const user = db.prepare('SELECT id, name, email, phone, address, role FROM users WHERE id = ?').get(req.user.id);
  res.json({ ok: true, user: userOut(user) });
});

router.post('/change-password', requireAuth, asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = z.object({
    currentPassword: z.string().min(1),
    newPassword: password
  }).parse(req.body);
  const row = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(req.user.id);
  if (!(await bcrypt.compare(currentPassword, row.password_hash))) {
    throw new HttpError(400, 'Current password is incorrect');
  }
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(await bcrypt.hash(newPassword, 10), req.user.id);
  res.json({ ok: true });
}));

module.exports = router;
