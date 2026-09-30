/**
 * Optional Razorpay integration for UPI / online payments.
 * Enabled only when RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET are set.
 * Flow: create order (POST /api/orders, payment=UPI) -> POST /:code/create -> open Razorpay Checkout in the
 * browser with the returned data -> POST /:code/verify with the three values Razorpay gives back.
 */
const express = require('express');
const crypto = require('crypto');
const { z } = require('zod');
const config = require('../config');
const db = require('../db');
const { HttpError, asyncHandler } = require('../errors');
const { requireAuth } = require('../middleware/auth');
const { orderOut } = require('../services');

const router = express.Router();
router.use(requireAuth);

const enabled = () => Boolean(config.razorpay.keyId && config.razorpay.keySecret);

function ownPendingOrder(req) {
  const order = db.prepare('SELECT * FROM orders WHERE code = ? AND user_id = ?').get(req.params.code, req.user.id);
  if (!order) throw new HttpError(404, 'Order not found');
  if (order.payment_method !== 'UPI') throw new HttpError(400, 'This order is not a UPI order');
  if (order.status === 'Cancelled') throw new HttpError(409, 'Order is cancelled');
  if (order.payment_status === 'PAID') throw new HttpError(409, 'Order is already paid');
  return order;
}

router.get('/config', (_req, res) => res.json({ ok: true, razorpayEnabled: enabled() }));

router.post('/:code/create', asyncHandler(async (req, res) => {
  if (!enabled()) throw new HttpError(503, 'Online payments are not configured');
  const order = ownPendingOrder(req);
  const auth = Buffer.from(`${config.razorpay.keyId}:${config.razorpay.keySecret}`).toString('base64');
  const r = await fetch('https://api.razorpay.com/v1/orders', {
    method: 'POST',
    headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ amount: order.total * 100, currency: 'INR', receipt: order.code })
  });
  const body = await r.json();
  if (!r.ok) throw new HttpError(502, body?.error?.description || 'Payment gateway error');
  db.prepare('UPDATE orders SET razorpay_order_id = ? WHERE id = ?').run(body.id, order.id);
  res.json({ ok: true, keyId: config.razorpay.keyId, razorpayOrderId: body.id, amount: body.amount, currency: body.currency });
}));

router.post('/:code/verify', (req, res) => {
  if (!enabled()) throw new HttpError(503, 'Online payments are not configured');
  const order = ownPendingOrder(req);
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = z.object({
    razorpay_order_id: z.string(), razorpay_payment_id: z.string(), razorpay_signature: z.string()
  }).parse(req.body);

  if (razorpay_order_id !== order.razorpay_order_id) throw new HttpError(400, 'Payment does not match this order');
  const expected = crypto.createHmac('sha256', config.razorpay.keySecret)
    .update(`${razorpay_order_id}|${razorpay_payment_id}`).digest('hex');
  const a = Buffer.from(expected), b = Buffer.from(razorpay_signature);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) throw new HttpError(400, 'Payment verification failed');

  db.prepare("UPDATE orders SET payment_status = 'PAID', razorpay_payment_id = ? WHERE id = ?")
    .run(razorpay_payment_id, order.id);
  db.prepare('INSERT INTO order_history (order_id, status, note) VALUES (?, ?, ?)')
    .run(order.id, order.status, 'Payment received (Razorpay)');
  res.json({ ok: true, order: orderOut(db.prepare('SELECT * FROM orders WHERE id = ?').get(order.id)) });
});

module.exports = router;
