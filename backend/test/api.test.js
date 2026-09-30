process.env.NODE_ENV = 'test';
process.env.DB_PATH = ':memory:';
process.env.JWT_SECRET = 'test-secret';
process.env.ADMIN_PHONE = '9000000000';
process.env.ADMIN_EMAIL = 'admin@test.com';
process.env.ADMIN_PASSWORD = 'AdminPass123';

const test = require('node:test');
const assert = require('node:assert/strict');
require('../src/db');
require('../src/seed')();
const app = require('../src/app')();

let server, base;
test.before(async () => {
  await new Promise(r => { server = app.listen(0, r); });
  base = `http://localhost:${server.address().port}`;
});
test.after(() => server.close());

async function api(method, path, { body, token } = {}) {
  const res = await fetch(base + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined
  });
  return { status: res.status, data: await res.json().catch(() => null) };
}

let token;
const creds = { name: 'Test User', email: 'test@example.com', phone: '9876543210', password: 'secret123', address: '12 MG Road, Chennai 600001' };

test('products are public and seeded', async () => {
  const { status, data } = await api('GET', '/api/products');
  assert.equal(status, 200);
  assert.equal(data.products.length, 12);
  const search = await api('GET', '/api/products?search=milk');
  assert.equal(search.data.products.length, 1);
  assert.equal((await api('GET', '/api/products/999')).status, 404);
});

test('register, duplicate, login, me', async () => {
  let r = await api('POST', '/api/auth/register', { body: creds });
  assert.equal(r.status, 201);
  token = r.data.token;
  assert.equal(r.data.user.password_hash, undefined);

  r = await api('POST', '/api/auth/register', { body: creds });
  assert.equal(r.status, 409);

  r = await api('POST', '/api/auth/register', { body: { ...creds, phone: '123', email: 'x@y.com' } });
  assert.equal(r.status, 400);

  r = await api('POST', '/api/auth/login', { body: { phone: creds.phone, password: 'wrongpass' } });
  assert.equal(r.status, 401);
  r = await api('POST', '/api/auth/login', { body: { phone: creds.phone, password: creds.password } });
  assert.equal(r.status, 200);

  r = await api('GET', '/api/auth/me', { token });
  assert.equal(r.data.user.phone, creds.phone);
  assert.equal((await api('GET', '/api/auth/me')).status, 401);
});

test('cart merge keeps max and never doubles', async () => {
  let r = await api('POST', '/api/cart/merge', { token, body: { cart: { 1: 2, 3: 1 } } });
  assert.deepEqual(r.data.cart, { 1: 2, 3: 1 });
  r = await api('POST', '/api/cart/merge', { token, body: { cart: { 1: 2, 3: 1 } } });
  assert.deepEqual(r.data.cart, { 1: 2, 3: 1 });
  r = await api('PUT', '/api/cart', { token, body: { cart: { 1: 3, 9999: 1 } } }); // unknown product dropped
  assert.deepEqual(r.data.cart, { 1: 3 });
});

test('order: server computes prices, delivery rule, stock, cart vs buy-now', async () => {
  // below 199 -> +25 delivery  (Tata Salt 28 x2 = 56)
  let r = await api('POST', '/api/orders', { token, body: { items: [{ id: 5, qty: 2 }], address: creds.address, payment: 'COD', source: 'Buy Now' } });
  assert.equal(r.status, 201);
  assert.equal(r.data.order.subtotal, 56);
  assert.equal(r.data.order.delivery, 25);
  assert.equal(r.data.order.total, 81);
  assert.match(r.data.order.id, /^KM\d{7}$/);
  // Buy Now must not touch server cart
  assert.deepEqual((await api('GET', '/api/cart', { token })).data.cart, { 1: 3 });

  // >= 199 -> free  (Atta 285)
  r = await api('POST', '/api/orders', { token, body: { items: [{ id: 1, qty: 1 }], address: creds.address, payment: 'UPI', source: 'Cart' } });
  assert.equal(r.data.order.delivery, 0);
  assert.equal(r.data.order.total, 285);
  assert.equal(r.data.order.paymentStatus, 'PENDING');
  // Cart checkout clears cart
  assert.deepEqual((await api('GET', '/api/cart', { token })).data.cart, {});

  // client-supplied price is ignored
  r = await api('POST', '/api/orders', { token, body: { items: [{ id: 5, qty: 1, price: 1 }], address: creds.address } });
  assert.equal(r.data.order.subtotal, 28);

  // stock enforcement (only 97 left of item 5 at this point)
  r = await api('POST', '/api/orders', { token, body: { items: [{ id: 5, qty: 99 }], address: creds.address } });
  assert.equal(r.status, 409);
  assert.equal((await api('GET', '/api/products/5')).data.product.stock, 97);

  // validation + auth
  assert.equal((await api('POST', '/api/orders', { token, body: { items: [], address: creds.address } })).status, 400);
  assert.equal((await api('POST', '/api/orders', { body: { items: [{ id: 1, qty: 1 }], address: creds.address } })).status, 401);
});

test('list, get, cancel restocks; other users cannot see orders', async () => {
  const list = await api('GET', '/api/orders', { token });
  assert.ok(list.data.orders.length >= 3);
  const before = (await api('GET', '/api/products/1')).data.product.stock;
  const order = list.data.orders.find(o => o.items[0].id === 1);
  const cancel = await api('POST', `/api/orders/${order.id}/cancel`, { token });
  assert.equal(cancel.data.order.status, 'Cancelled');
  assert.equal((await api('GET', '/api/products/1')).data.product.stock, before + 1);
  assert.equal((await api('POST', `/api/orders/${order.id}/cancel`, { token })).status, 409);

  const other = await api('POST', '/api/auth/register', { body: { ...creds, email: 'o@example.com', phone: '9123456780' } });
  assert.equal((await api('GET', `/api/orders/${order.id}`, { token: other.data.token })).status, 404);
});

test('admin: forbidden for customers, works for admin, delivery marks COD paid', async () => {
  assert.equal((await api('GET', '/api/admin/stats', { token })).status, 403);
  const login = await api('POST', '/api/auth/login', { body: { phone: '9000000000', password: 'AdminPass123' } });
  const admin = login.data.token;
  assert.equal((await api('GET', '/api/admin/stats', { token: admin })).status, 200);

  const orders = (await api('GET', '/api/admin/orders', { token: admin })).data.orders;
  const cod = orders.find(o => o.payment === 'COD' && o.status === 'Confirmed');
  let r = await api('PATCH', `/api/admin/orders/${cod.id}/status`, { token: admin, body: { status: 'Delivered' } });
  assert.equal(r.data.order.status, 'Delivered');
  assert.equal(r.data.order.paymentStatus, 'PAID');

  r = await api('POST', '/api/admin/products', { token: admin, body: { name: 'Test Item', category: 'Snacks', unit: '1 pc', price: 10, stock: 5 } });
  assert.equal(r.status, 201);
  const id = r.data.product.id;
  assert.equal((await api('DELETE', `/api/admin/products/${id}`, { token: admin })).status, 200);
  assert.equal((await api('GET', `/api/products/${id}`)).status, 404);
});

test('backend folder is not served statically', async () => {
  for (const p of ['/backend/.env', '/backend/package.json', '/backend/data/kamagere.db']) {
    const res = await fetch(base + p);
    assert.equal(res.status, 404);
  }
  assert.equal((await fetch(base + '/')).status, 200);
  assert.equal((await fetch(base + '/js/app.js')).status, 200);
});
