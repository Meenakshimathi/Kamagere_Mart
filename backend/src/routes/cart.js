const express = require('express');
const { z } = require('zod');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

// Frontend cart format: { "productId": qty }
const cartSchema = z.object({ cart: z.record(z.string().regex(/^\d+$/), z.coerce.number().int().min(0).max(99)) });

function readCart(userId) {
  const rows = db.prepare('SELECT product_id, qty FROM cart_items WHERE user_id = ?').all(userId);
  return Object.fromEntries(rows.map(r => [String(r.product_id), r.qty]));
}

function writeCart(userId, cart) {
  const valid = new Set(db.prepare('SELECT id FROM products WHERE active = 1').all().map(r => r.id));
  db.transaction(() => {
    db.prepare('DELETE FROM cart_items WHERE user_id = ?').run(userId);
    const ins = db.prepare('INSERT INTO cart_items (user_id, product_id, qty) VALUES (?, ?, ?)');
    for (const [id, qty] of Object.entries(cart)) {
      if (qty > 0 && valid.has(Number(id))) ins.run(userId, Number(id), qty);
    }
  })();
  return readCart(userId);
}

router.get('/', (req, res) => res.json({ ok: true, cart: readCart(req.user.id) }));

router.put('/', (req, res) => {
  const { cart } = cartSchema.parse(req.body);
  res.json({ ok: true, cart: writeCart(req.user.id, cart) });
});

// Used right after login: keeps the larger quantity per product so repeated logins never double up.
router.post('/merge', (req, res) => {
  const { cart: local } = cartSchema.parse(req.body);
  const merged = readCart(req.user.id);
  for (const [id, qty] of Object.entries(local)) merged[id] = Math.max(merged[id] || 0, qty);
  res.json({ ok: true, cart: writeCart(req.user.id, merged) });
});

module.exports = router;
