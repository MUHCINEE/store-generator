# Maison Verde — the little shop

A mobile-first storefront and owner dashboard built with React, Vite, Firebase Authentication, and Cloud Firestore.

- Public storefront: `/`, `/storefront`, or `/store/<STORE_SLUG>`
- Owner sign-in: `/login`
- Product management: `/admin`

## Requirements and Firebase setup

- Node.js **20.19 or newer** and npm.
- A Firebase project with **Email/Password Authentication** enabled and **Cloud Firestore** created.
- Copy `.env.example` to `.env` and fill in the web app configuration from Firebase Console → Project settings → Your apps. The `apiKey`, `authDomain`, `projectId`, and `appId` values are required. Store name and slug can also be set in `.env`.
- Create owner accounts in Firebase Console → Authentication → Users. The app has no sign-up route; only accounts created in the Firebase project can sign in.
- Publish the rules in [`firestore.rules`](./firestore.rules) to the project's Firestore database. They allow public product reads and customer order submissions, while requiring Firebase Authentication for product writes and order management. Restrict account creation in Firebase to trusted owners.
- The frontend Firebase configuration is included in the browser bundle. Firebase API keys identify the project; use Firestore security rules to protect data and never put service-account credentials in frontend configuration.

Products and customer orders are stored in the `products` and `orders` collections. The storefront listens to products in real time; dashboard additions, edits, and deletions appear without a manual refresh. Customer checkout creates a pending order, and the dashboard listens for new orders and lets authenticated owners complete or delete them.

## Run locally

1. Copy `.env.example` to `.env` and fill in the Firebase web app values.
2. Install dependencies with `npm install`.
3. Start Vite with `npm run dev`.
4. Open the URL printed by Vite (normally `http://localhost:5173`), then sign in at `/login` with an account created in Firebase Authentication.
5. Add and manage products at `/admin`. The public collection is available at `/` and `/storefront`.

The `.env` file is local configuration and must not be committed. Firebase reads and writes require an internet connection and correctly published Firestore rules.

## Build and production hosting

```sh
npm run build
npm start
```

The production server serves the Vite build from `dist/` on `PORT` (default `3000`). Alternatively, deploy `dist/` to a static host with SPA fallback enabled. Set the `VITE_FIREBASE_*` and `VITE_STORE_*` values in the build environment before running the production build.

Firebase Auth and Firestore require the deployed site domain to be authorized in Firebase Authentication settings. Use HTTPS for production.

## Security and data notes

- `/admin` is guarded by Firebase Authentication in the client. Firestore security rules are the actual access-control boundary: product writes and order reads/updates/deletes require authentication, while order creation is public so customers can check out.
- Only create trusted owner accounts in Firebase Authentication. If the Firebase project allows public account creation, any new account will be able to write products under the supplied rules.
- Product images are compressed into JPEG data URLs before being stored in Firestore documents. Keep them below Firestore's 1 MiB per-document size limit; larger image catalogs should use Firebase Storage instead.
- Customer order documents contain the name, phone, delivery location, item names/images/prices/quantities, total, store slug, server timestamp, and pending/completed status. Public order creation is necessary for guest checkout; do not put sensitive payment information in an order.
- Existing products in the old SQLite database are not automatically copied to Firestore. Export/import them separately if they need to be retained in the new catalog.
- Checkout records an order request; it does not process payments or reserve stock. Confirm availability and delivery with the customer separately.
