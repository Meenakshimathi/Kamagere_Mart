# Kamagere Mart – Backend

Node.js + Express + SQLite. One process serves both the **API** (`/api/*`) and the **storefront** (the HTML/CSS/JS in the parent folder).

## Run it

```bash
cd backend
npm install
cp .env.example .env        # then edit .env (set JWT_SECRET, admin login)
npm start
```

Open **http://localhost:3000**. On first start it creates `backend/data/kamagere.db`, seeds the 12 products from the frontend, and creates the admin account from `.env`.

Using VS Code Live Server (port 5500) instead? Keep the backend running too – `js/api.js` automatically calls `http://localhost:3000/api`, and CORS already allows `localhost:5500` / `127.0.0.1:5500`.

Run the tests: `npm test`

## What the backend does

- Register / login (bcrypt hashes, JWT, rate-limited), profile update, change password
- Product catalog from the database (frontend falls back to `data.js` if the API is down)
- Server-side cart per user; guest cart is merged on login
- Orders: **prices, stock and delivery fee (₹25 below ₹199, else free) are calculated on the server**; stock is decremented atomically; cancel restocks; Cart vs Buy Now behaviour is preserved
- Admin API: stats, product CRUD/stock, all orders + status updates, payment status, customers
- Optional Razorpay endpoints for UPI (see below)

## API summary

`Authorization: Bearer <token>` for everything except products/health/register/login. Responses are `{ ok: true, ... }` or `{ ok: false, error }`.

| Method | Path | Notes |
|---|---|---|
| GET | `/api/health` | |
| POST | `/api/auth/register` | `name, email, phone (10-digit), password (8+), address?` |
| POST | `/api/auth/login` | `phone` (or `email`), `password` |
| GET/PUT | `/api/auth/me` | PUT: `name?, address?` |
| POST | `/api/auth/change-password` | `currentPassword, newPassword` |
| GET | `/api/products?category=&search=` | public |
| GET | `/api/products/categories`, `/api/products/:id` | public |
| GET/PUT | `/api/cart` | `{ cart: { "productId": qty } }` |
| POST | `/api/cart/merge` | keeps max qty per product |
| POST | `/api/orders` | `items:[{id,qty}], address, payment: COD\|UPI, source: Cart\|Buy Now` |
| GET | `/api/orders`, `/api/orders/:code` | own orders only |
| POST | `/api/orders/:code/cancel` | only while Confirmed/Packed |
| GET | `/api/payments/config` | is Razorpay enabled |
| POST | `/api/payments/:code/create`, `/verify` | Razorpay (optional) |
| GET | `/api/admin/stats`, `/products`, `/orders`, `/customers` | admin only |
| POST/PUT/DELETE | `/api/admin/products[/:id]` | DELETE = deactivate |
| PATCH | `/api/admin/products/:id/stock` | `{ stock }` |
| PATCH | `/api/admin/orders/:code/status` | `Confirmed, Packed, Out for Delivery, Delivered, Cancelled` |
| PATCH | `/api/admin/orders/:code/payment` | `PENDING, PAID, FAILED, REFUNDED` |

Example (make an admin change):
```bash
TOKEN=$(curl -s localhost:3000/api/auth/login -H 'Content-Type: application/json' \
  -d '{"phone":"9999999999","password":"YourAdminPassword"}' | node -pe 'JSON.parse(require("fs").readFileSync(0)).token')
curl -X PATCH localhost:3000/api/admin/orders/KM1234567/status -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' -d '{"status":"Out for Delivery"}'
```

## Frontend changes made

- New `js/api.js` (API client, `esc()` HTML-escaper) added to every page.
- `js/app.js`: login/register/profile/orders/checkout now call the API; placing an order requires login; orders page has a Cancel button; user-controlled text is HTML-escaped.
- `js/product.js`: waits for the live catalog; cart changes sync to the server when logged in.

## Deploying

- Set `NODE_ENV=production` and a long random `JWT_SECRET` (the server refuses to start without it).
- Put it behind HTTPS (Nginx/Caddy, or a host like Render/Railway/Fly with a persistent disk for `backend/data/`). SQLite is fine for a single small store; for multiple instances move to Postgres.
- Back up `backend/data/kamagere.db`.
- If the frontend is hosted on a different domain, set `CORS_ORIGINS` and `window.KM_API_BASE` in the pages.

## Not included / known limits

- **UPI checkout in the browser is not wired.** UPI orders are saved with payment `PENDING` (mark paid via the admin endpoint). The Razorpay endpoints (`/api/payments/*`) are implemented but untested against the live gateway and have no frontend button yet.
- No email/SMS OTP or password-reset flow (needs an email/SMS provider).
- No admin web UI (admin is API-only) and no image upload (product `image` is a path under `assets/products/`).
- The JWT is kept in `localStorage` (simple, works cross-origin). It is exposed to any XSS; the frontend escapes user text, but for stricter security move to httpOnly cookies + CSRF protection.
- Helmet's Content-Security-Policy is disabled because the frontend uses inline `onclick` handlers.
