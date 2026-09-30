const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const db = require('./db');
const config = require('./config');

function seed() {
  if (db.prepare('SELECT COUNT(*) n FROM products').get().n === 0) {
    const products = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'seed', 'products.json'), 'utf8'));
    const ins = db.prepare(`
      INSERT INTO products (id, name, category, unit, price, old_price, discount, image, description, stock)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 100)`);
    db.transaction(() => {
      for (const p of products) {
        ins.run(p.id, p.name, p.category, p.unit, p.price, p.oldPrice ?? null, p.discount ?? null, p.image, p.description || '');
      }
    })();
    console.log(`[seed] inserted ${products.length} products`);
  }

  const { phone, email, password, name } = config.admin;
  if (phone && email && password && !db.prepare("SELECT 1 FROM users WHERE role = 'admin'").get()) {
    db.prepare("INSERT INTO users (name, email, phone, password_hash, role) VALUES (?, ?, ?, ?, 'admin')")
      .run(name, email, phone, bcrypt.hashSync(password, 10));
    console.log(`[seed] created admin account (${phone})`);
  }
}

module.exports = seed;
if (require.main === module) seed();
