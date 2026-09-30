const express = require('express');
const db = require('../db');
const { HttpError } = require('../errors');
const { productOut } = require('../services');

const router = express.Router();

router.get('/categories', (_req, res) => {
  const rows = db.prepare('SELECT DISTINCT category FROM products WHERE active = 1 ORDER BY category').all();
  res.json({ ok: true, categories: ['All', ...rows.map(r => r.category)] });
});

router.get('/', (req, res) => {
  const { category, search } = req.query;
  const where = ['active = 1'];
  const params = [];
  if (category && category !== 'All') { where.push('category = ?'); params.push(String(category)); }
  if (search) {
    const like = `%${String(search).toLowerCase().replace(/[%_]/g, m => '\\' + m)}%`;
    where.push("(LOWER(name) LIKE ? ESCAPE '\\' OR LOWER(category) LIKE ? ESCAPE '\\')");
    params.push(like, like);
  }
  const rows = db.prepare(`SELECT * FROM products WHERE ${where.join(' AND ')} ORDER BY id`).all(...params);
  res.json({ ok: true, products: rows.map(productOut) });
});

router.get('/:id', (req, res) => {
  const p = db.prepare('SELECT * FROM products WHERE id = ? AND active = 1').get(Number(req.params.id));
  if (!p) throw new HttpError(404, 'Product not found');
  res.json({ ok: true, product: productOut(p) });
});

module.exports = router;
