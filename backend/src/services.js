const crypto = require('crypto');
const db = require('./db');
const config = require('./config');
const { HttpError } = require('./errors');

const ORDER_STATUSES = ['Confirmed', 'Packed', 'Out for Delivery', 'Delivered', 'Cancelled'];

const productOut = p => ({
  id: p.id,
  name: p.name,
  category: p.category,
  unit: p.unit,
  price: p.price,
  oldPrice: p.old_price,
  discount: p.discount,
  image: p.image,
  description: p.description,
  stock: p.stock,
  inStock: p.stock > 0,
  active: !!p.active
});

const userOut = u => ({ id: u.id, name: u.name, email: u.email, phone: u.phone, address: u.address, role: u.role });

function deliveryFor(subtotal) {
  if (subtotal <= 0) return 0;
  return subtotal < config.freeDeliveryThreshold ? config.deliveryFee : 0;
}

function orderOut(order) {
  const items = db.prepare(
    'SELECT product_id AS id, name, category, unit, image, price, qty FROM order_items WHERE order_id = ?'
  ).all(order.id);
  const history = db.prepare(
    'SELECT status, note, created_at AS at FROM order_history WHERE order_id = ? ORDER BY id'
  ).all(order.id);
  return {
    id: order.code,
    date: order.created_at,
    items,
    subtotal: order.subtotal,
    delivery: order.delivery,
    total: order.total,
    address: order.address,
    payment: order.payment_method,
    paymentStatus: order.payment_status,
    status: order.status,
    source: order.source,
    customer: { name: order.customer_name, phone: order.customer_phone },
    history
  };
}

function newOrderCode() {
  for (let i = 0; i < 10; i++) {
    const code = 'KM' + String(crypto.randomInt(0, 10_000_000)).padStart(7, '0');
    if (!db.prepare('SELECT 1 FROM orders WHERE code = ?').get(code)) return code;
  }
  throw new HttpError(500, 'Could not generate order id, please retry');
}

/** Prices, stock and totals are always computed here - never trusted from the client. */
const createOrder = db.transaction((user, { items, address, payment, source }) => {
  // Merge duplicate product lines
  const wanted = new Map();
  for (const { id, qty } of items) wanted.set(id, (wanted.get(id) || 0) + qty);

  const lines = [];
  for (const [id, qty] of wanted) {
    const p = db.prepare('SELECT * FROM products WHERE id = ? AND active = 1').get(id);
    if (!p) throw new HttpError(400, `Product ${id} is no longer available`);
    if (qty > 99) throw new HttpError(400, `Maximum 99 units of ${p.name} per order`);
    const res = db.prepare('UPDATE products SET stock = stock - ? WHERE id = ? AND stock >= ?').run(qty, id, qty);
    if (res.changes === 0) {
      throw new HttpError(409, p.stock > 0
        ? `Only ${p.stock} left of ${p.name}`
        : `${p.name} is out of stock`);
    }
    lines.push({ p, qty });
  }

  const subtotal = lines.reduce((s, l) => s + l.p.price * l.qty, 0);
  const delivery = deliveryFor(subtotal);
  const total = subtotal + delivery;
  const code = newOrderCode();

  const { lastInsertRowid: orderId } = db.prepare(`
    INSERT INTO orders (code, user_id, customer_name, customer_phone, subtotal, delivery, total,
                        address, payment_method, payment_status, status, source)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', 'Confirmed', ?)`
  ).run(code, user.id, user.name, user.phone, subtotal, delivery, total, address, payment, source);

  const insItem = db.prepare(`
    INSERT INTO order_items (order_id, product_id, name, category, unit, image, price, qty)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
  for (const { p, qty } of lines) insItem.run(orderId, p.id, p.name, p.category, p.unit, p.image, p.price, qty);

  db.prepare('INSERT INTO order_history (order_id, status, note) VALUES (?, ?, ?)')
    .run(orderId, 'Confirmed', `Order placed (${payment})`);

  // Cart checkout empties the server cart; Buy Now leaves it untouched (same as the frontend rule).
  if (source === 'Cart') db.prepare('DELETE FROM cart_items WHERE user_id = ?').run(user.id);

  return db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
});

const setOrderStatus = db.transaction((order, status, note = '') => {
  if (status === order.status) return order;
  if (order.status === 'Cancelled' || order.status === 'Delivered') {
    throw new HttpError(409, `Order is already ${order.status.toLowerCase()}`);
  }
  if (status === 'Cancelled') {
    // return stock
    const items = db.prepare('SELECT product_id, qty FROM order_items WHERE order_id = ?').all(order.id);
    const restock = db.prepare('UPDATE products SET stock = stock + ? WHERE id = ?');
    for (const it of items) restock.run(it.qty, it.product_id);
    if (order.payment_status === 'PAID') {
      db.prepare("UPDATE orders SET payment_status = 'REFUND_PENDING' WHERE id = ?").run(order.id);
    }
  }
  if (status === 'Delivered' && order.payment_method === 'COD') {
    db.prepare("UPDATE orders SET payment_status = 'PAID' WHERE id = ?").run(order.id);
  }
  db.prepare('UPDATE orders SET status = ? WHERE id = ?').run(status, order.id);
  db.prepare('INSERT INTO order_history (order_id, status, note) VALUES (?, ?, ?)').run(order.id, status, note);
  return db.prepare('SELECT * FROM orders WHERE id = ?').get(order.id);
});

module.exports = { ORDER_STATUSES, productOut, userOut, orderOut, deliveryFor, createOrder, setOrderStatus };
