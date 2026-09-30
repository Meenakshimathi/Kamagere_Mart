const express = require('express');
const { z } = require('zod');
const db = require('../db');
const { HttpError } = require('../errors');
const { requireAdmin } = require('../middleware/auth');
const { ORDER_STATUSES, productOut, orderOut, setOrderStatus } = require('../services');

const router = express.Router();
router.use(requireAdmin);

const productSchema = z.object({
  name: z.string().trim().min(2).max(120),
  category: z.string().trim().min(2).max(60),
  unit: z.string().trim().max(30).default(''),
  price: z.coerce.number().int().min(0),
  oldPrice: z.coerce.number().int().min(0).nullish(),
  discount: z.coerce.number().int().min(0).max(100).nullish(),
  image: z.string().trim().max(300).default(''),
  description: z.string().trim().max(2000).default(''),
  stock: z.coerce.number().int().min(0).default(0),
  active: z.boolean().default(true)
});

router.get('/stats', (_req, res) => {
  const one = sql => db.prepare(sql).get();
  res.json({
    ok: true,
    stats: {
      customers: one("SELECT COUNT(*) n FROM users WHERE role = 'customer'").n,
      orders: one('SELECT COUNT(*) n FROM orders').n,
      pendingOrders: one("SELECT COUNT(*) n FROM orders WHERE status IN ('Confirmed','Packed','Out for Delivery')").n,
      revenue: one("SELECT COALESCE(SUM(total),0) n FROM orders WHERE status != 'Cancelled'").n,
      lowStock: db.prepare('SELECT id, name, stock FROM products WHERE active = 1 AND stock <= 10 ORDER BY stock').all()
    }
  });
});

// ---- products ----
router.get('/products', (_req, res) => {
  res.json({ ok: true, products: db.prepare('SELECT * FROM products ORDER BY id').all().map(productOut) });
});

router.post('/products', (req, res) => {
  const d = productSchema.parse(req.body);
  const { lastInsertRowid } = db.prepare(`
    INSERT INTO products (name, category, unit, price, old_price, discount, image, description, stock, active)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(d.name, d.category, d.unit, d.price, d.oldPrice ?? null, d.discount ?? null, d.image, d.description, d.stock, d.active ? 1 : 0);
  res.status(201).json({ ok: true, product: productOut(db.prepare('SELECT * FROM products WHERE id = ?').get(lastInsertRowid)) });
});

router.put('/products/:id', (req, res) => {
  const id = Number(req.params.id);
  if (!db.prepare('SELECT 1 FROM products WHERE id = ?').get(id)) throw new HttpError(404, 'Product not found');
  const d = productSchema.parse(req.body);
  db.prepare(`
    UPDATE products SET name=?, category=?, unit=?, price=?, old_price=?, discount=?, image=?, description=?, stock=?, active=?
    WHERE id = ?`
  ).run(d.name, d.category, d.unit, d.price, d.oldPrice ?? null, d.discount ?? null, d.image, d.description, d.stock, d.active ? 1 : 0, id);
  res.json({ ok: true, product: productOut(db.prepare('SELECT * FROM products WHERE id = ?').get(id)) });
});

router.patch('/products/:id/stock', (req, res) => {
  const { stock } = z.object({ stock: z.coerce.number().int().min(0) }).parse(req.body);
  const r = db.prepare('UPDATE products SET stock = ? WHERE id = ?').run(stock, Number(req.params.id));
  if (!r.changes) throw new HttpError(404, 'Product not found');
  res.json({ ok: true, product: productOut(db.prepare('SELECT * FROM products WHERE id = ?').get(Number(req.params.id))) });
});

// Soft delete so past orders keep working
router.delete('/products/:id', (req, res) => {
  const r = db.prepare('UPDATE products SET active = 0 WHERE id = ?').run(Number(req.params.id));
  if (!r.changes) throw new HttpError(404, 'Product not found');
  res.json({ ok: true });
});

// ---- orders ----
router.get('/orders', (req, res) => {
  const { status } = req.query;
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 25));
  const where = status ? 'WHERE status = ?' : '';
  const params = status ? [String(status)] : [];
  const total = db.prepare(`SELECT COUNT(*) n FROM orders ${where}`).get(...params).n;
  const rows = db.prepare(`SELECT * FROM orders ${where} ORDER BY id DESC LIMIT ? OFFSET ?`)
    .all(...params, limit, (page - 1) * limit);
  res.json({ ok: true, page, limit, total, orders: rows.map(orderOut) });
});

router.patch('/orders/:code/status', (req, res) => {
  const { status, note } = z.object({ status: z.enum(ORDER_STATUSES), note: z.string().max(200).optional() }).parse(req.body);
  const order = db.prepare('SELECT * FROM orders WHERE code = ?').get(req.params.code);
  if (!order) throw new HttpError(404, 'Order not found');
  res.json({ ok: true, order: orderOut(setOrderStatus(order, status, note || `Status changed to ${status}`)) });
});

router.patch('/orders/:code/payment', (req, res) => {
  const { paymentStatus } = z.object({ paymentStatus: z.enum(['PENDING', 'PAID', 'FAILED', 'REFUNDED']) }).parse(req.body);
  const r = db.prepare('UPDATE orders SET payment_status = ? WHERE code = ?').run(paymentStatus, req.params.code);
  if (!r.changes) throw new HttpError(404, 'Order not found');
  res.json({ ok: true, order: orderOut(db.prepare('SELECT * FROM orders WHERE code = ?').get(req.params.code)) });
});

// ---- customers ----
router.get('/customers', (_req, res) => {
  const rows = db.prepare(`
    SELECT u.id, u.name, u.email, u.phone, u.address, u.created_at AS joined,
           COUNT(o.id) AS orders, COALESCE(SUM(CASE WHEN o.status != 'Cancelled' THEN o.total END), 0) AS spent
    FROM users u LEFT JOIN orders o ON o.user_id = u.id
    WHERE u.role = 'customer' GROUP BY u.id ORDER BY u.id DESC`).all();
  res.json({ ok: true, customers: rows });
});

module.exports = router;
