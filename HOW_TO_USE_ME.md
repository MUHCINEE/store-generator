# Maison Verde — the little shop

A mobile-first storefront and private owner dashboard, backed by an Express API and a persistent SQLite catalog. The shop is available at `/store/<STORE_SLUG>`; the owner signs in at `/login` and manages products at `/admin`.

## What is in this project

| File | Responsibility |
|---|---|
| `package.json` | Runtime and development dependencies, Node version, and start/build scripts. |
| `package-lock.json` | Exact dependency versions installed for reproducible npm installs. |
| `index.html` | Browser entry point, page title, viewport, and font preconnects. |
| `README.md` | Brief project overview and pointer to the full setup guide. |
| `source.txt` | Empty, unused starter file; it is not read by the application. |
| `public/favicon.svg` | Lightweight vector favicon matching the store identity. |
| `vite.config.js` | React JSX transform and development proxy for same-origin API requests. |
| `server.js` | Express API, SQLite schema and starter catalog, file-based owner sign-in/session cookies, rate limiting, product validation and CRUD, live catalog events, health endpoint, and production static-file serving. |
| `data/users.txt` | Private, Git-ignored plain-text login database. Add one `username,password` pair per line. |
| `.env.example` | Example local configuration; copy it to `.env` and set your store details and optional `USERS_FILE` path. |
| `.gitignore` | Keeps dependencies, build output, local secrets, and the SQLite database out of version control. |
| `src/main.jsx` | React entry point and router setup. |
| `src/App.jsx` | Routes, session check, login protection, and sign-out handling. |
| `src/index.css` | Storefront, dashboard, login, cart, responsive layouts, and accessible motion/interaction styling. |
| `src/utils/storage.js` | Same-origin API client with surfaced request errors, shared price formatting, and bounded canvas JPEG compression. SQLite on the server is the catalog persistence source; credentials are not stored in browser localStorage. |
| `src/components/Navbar.jsx` | Store/admin header and cart controls. |
| `src/components/ProtectdRoute.jsx` | Reusable client-side route guard; the admin API also enforces authentication on the server. |
| `src/components/ImageCaptureModal.jsx` | Live camera access and canvas-based photo resizing/JPEG compression. |
| `src/pages/StoreFront.jsx` | Public product collection, category filters, cart drawer, quantity controls, checkout validation, and WhatsApp order handoff. |
| `src/pages/Login.jsx` | Owner sign-in form and error feedback. |
| `src/pages/AdminDashboard.jsx` | Protected inventory overview, search/filter, availability controls, create/edit/delete, upload compression, and live product preview. |
| `data/store.db` | Created automatically at first server start; holds products and hashed session tokens. This local runtime file is intentionally ignored by Git. |
| `dist/` | Created by the production build and served by Express. |

## Requirements and configuration

- Node.js **20.19 or newer** and npm.
- On Windows PowerShell, if the `npm` script is blocked by the execution policy, use `npm.cmd` in place of `npm` in the commands below.
- The project uses React, React Router, Vite, Express, `better-sqlite3`, `lucide-react`, and `concurrently`. `npm install` installs them from `package.json`.
- Copy `.env.example` to `.env` in the project root and configure your store details.
- Add at least one account to `data/users.txt`, one per line in `username,password` format. Keep this file private; it is ignored by Git. Set `USERS_FILE` if you want to use a different file path.
- The default users file stores passwords as plain text. This is intended only for simple local use; use a proper identity provider or securely hashed credentials for production, and restrict file access.
- Set `WHATSAPP_NUMBER` to the shop number including country code, digits only (for example `14155550123`). Leave it blank to disable WhatsApp checkout until configured.
- The database defaults to `./data/store.db`. Set `DB_PATH` to a persistent writable location on a deployed host. Back up this file; it contains the product catalog.
- To use a non-USD currency, update the currency code in `src/utils/storage.js` and the matching price/message labels.

## Run locally

1. Open a terminal in this project directory.
2. Copy `.env.example` to `.env` and configure your store settings. Add your login username and password to `data/users.txt` in `username,password` format.
3. Install packages: `npm install`.
4. Start the API and frontend together: `npm run dev`.
5. Open the Vite URL printed in the terminal (normally `http://localhost:5173`). The dev server proxies `/api` requests to Express on port `3000`.
6. Browse the public collection at `/store/<STORE_SLUG>`, `/storefront`, or `/` (each resolves the configured store where appropriate).
7. Open `/login`, use the configured owner credentials, and manage pieces at `/admin`. Product changes are stored in SQLite and immediately appear in the public collection.
8. Use **Add a piece** to upload an image or capture one with a camera. Camera access is available on localhost and HTTPS; grant browser permission when prompted.
9. Add a product to the bag, adjust quantities, enter customer details, and continue to WhatsApp to prepare the order message. The customer sends the message to confirm; this app does not take payment or automatically reserve stock.

## Build and run the production server

```sh
npm run build
npm start
```

Express serves the compiled app and API from `PORT` (default `3000`). Run behind HTTPS in production; secure session cookies are enabled when `NODE_ENV=production`. Persist and back up the configured `DB_PATH`, keep `users.txt` private, and provision a writable database directory. Plain-text password storage is not appropriate for production. Camera capture also requires HTTPS outside localhost.

## Verify the app

- `npm run build` checks and compiles the React/Vite client.
- `GET /api/health` returns `{ "ok": true }` when the API is available.
- Visiting `/admin` without a valid session redirects to `/login`; product API routes return `401`.
- Keep a storefront open while changing a product in the dashboard to verify live catalog updates arrive through server-sent events.
- Sign in, add or edit a product, toggle its visibility, and confirm the public `/store/<STORE_SLUG>` reflects the change.
- Test cart quantity limits against available stock and complete checkout with a configured WhatsApp number.

## Security and operating notes

- Admin product endpoints are protected on the server. The login API reads credentials from `users.txt`, rate-limits failed sign-in attempts, and stores only SHA-256 digests of random session tokens. Session cookies are HttpOnly, SameSite Strict, and Secure in production. The users file itself contains plain-text passwords; restrict file access and do not use this authentication scheme for a production deployment.
- Serve the app and API from the same origin. Use TLS, a persistent private SQLite volume, and regular backups in production. The in-memory login rate limit is per server process; use an edge/proxy rate limiter if deploying multiple instances.
- Live catalog notifications use in-process server-sent events. Run one application process for immediate cross-customer updates; if you scale to multiple API instances, relay catalog events with shared pub/sub.
- Uploaded photos are resized to at most 1200 pixels on the longest side and stored as JPEG data URLs in SQLite. Keep an eye on database growth; for a larger catalog, move images to managed object storage and serve them through a CDN.
- WhatsApp handoff opens a prefilled message in a new tab; it does not transmit customer data to this server, create a paid order, or process payments.
