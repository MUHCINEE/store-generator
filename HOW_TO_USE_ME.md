# Store Generator

A React/Vite storefront and Express API backed by a local MySQL database.

## Requirements

- Node.js 20.19 or newer and npm.
- MySQL Server 8.0 or newer, running locally.

## Configure MySQL

1. Copy `.env.example` to `.env` if you do not already have a local environment file.
2. Set `DB_HOST`, `DB_PORT`, `DB_USER`, and `DB_PASSWORD` for your MySQL server. Choose a database name with letters, numbers, and underscores for `DB_NAME`.
3. Create the database once in MySQL:

   ```sql
   CREATE DATABASE store_generator
     CHARACTER SET utf8mb4
     COLLATE utf8mb4_unicode_ci;
   ```

   If you changed `DB_NAME`, use that name instead. The API automatically creates the required tables and indexes the first time it connects. The schema is also available in [`schema.sql`](./schema.sql).
4. Install Node dependencies with `npm install`.
5. Run `npm run dev`. This starts both the Vite frontend and Express API. Open the Vite URL (normally `http://localhost:5173`) and create an owner account.

The Express API listens on `PORT` (default `3000`); Vite proxies `/api` requests to it. For production, run `npm run build` followed by `npm start`; Express then serves the built app and API from one origin.

## App routes

- `/register` — create an owner account and a unique public store username.
- `/login` — sign in with email or username.
- `/admin` — manage your own products and customer orders.
- `/store/<username>` — public storefront with checkout.
- `/` and `/storefront` — storefront selected by `VITE_STORE_SLUG`.

## MySQL tables

- `users`: owner profile, unique email/username, and a salted scrypt password hash.
- `sessions`: expiring server-side sessions; only a random session token is sent in an HttpOnly, SameSite=Lax cookie.
- `products`: each product belongs to a user and their store.
- `orders`: customer details, server-verified product/price snapshots, total, status, and owner.

Passwords are never stored in plaintext. Product and order endpoints scope private operations to the authenticated session owner. Public order creation verifies the store, products, availability, quantities, and total on the server rather than trusting browser-supplied prices.

The dashboard order feed polls the local API periodically. Product image data is stored in MySQL `LONGTEXT`; for larger catalogs, use a dedicated file/object store.

## Troubleshooting

- If the app opens but data operations report MySQL is unavailable, confirm MySQL is running, the database exists, and the `.env` credentials are correct.
- `npm run dev` starts both the API and frontend. If the API port is busy, set `PORT` and `API_PROXY_TARGET` to the same available port, for example `PORT=3001` and `API_PROXY_TARGET=http://127.0.0.1:3001`.
- If an account cannot be created, check that the database user can create tables and has read/write permissions on `DB_NAME`.
- Existing remote database data is not copied into MySQL. Export it separately if you need to preserve it.
