const express = require('express');
const { z } = require('zod');
const db = require('../db');
const { HttpError } = require('../errors');
const { requireAuth } = require('../middleware/auth');
const { createOrder, setOrderStatus, orderOut } = require('../services');

const router = express.Router();
router.use(requireAuth);

const orderSchema = z.object({
  items: z.array(z.object({
    id: z.coerce.number().int().positive(),
    qty: z.coerce.number().int().min(1).max(99)
  })).min(1, 'No items to checkout').max(100),
  address: z.string().trim().min(5, 'Please enter a complete delivery address').max(500),
  payment: z.enum(['COD', 'UPI']).default('COD'),
  source: z.enum(['Cart', 'Buy Now']).default('Cart')
});

router.post('/', (req, res) => {
  const data = orderSchema.parse(req.body);
  const order = createOrder(req.user, data);
  // remember the address for next time
  db.prepare('UPDATE users SET address = ? WHERE id = ?').run(data.address, req.user.id);
  res.status(201).json({ ok: true, order: orderOut(order) });
});

router.get('/', (req, res) => {
  const rows = db.prepare('SELECT * FROM orders WHERE user_id = ? ORDER BY id DESC').all(req.user.id);
  res.json({ ok: true, orders: rows.map(orderOut) });
});

function ownOrder(req) {
  const order = db.prepare('SELECT * FROM orders WHERE code = ? AND user_id = ?').get(req.params.code, req.user.id);
  if (!order) throw new HttpError(404, 'Order not found');
  return order;
}

router.get('/:code', (req, res) => res.json({ ok: true, order: orderOut(ownOrder(req)) }));

router.post('/:code/cancel', (req, res) => {
  const order = ownOrder(req);
  if (!['Confirmed', 'Packed'].includes(order.status)) {
    throw new HttpError(409, 'This order can no longer be cancelled');
  }
  res.json({ ok: true, order: orderOut(setOrderStatus(order, 'Cancelled', 'Cancelled by customer')) });
});

module.exports = router;
