import crypto from 'node:crypto';
import fs from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import Database from 'better-sqlite3';

const root = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(root, '.env');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (match && process.env[match[1]] === undefined) {
      process.env[match[1]] = match[2].replace(/^(['"])(.*)\1$/, '$2');
    }
  }
}

const app = express();
const port = Number(process.env.PORT || 3000);
const usersFilePath = process.env.USERS_FILE
  ? path.resolve(root, process.env.USERS_FILE)
  : path.join(root, 'data', 'users.txt');
const storeSlug = (process.env.STORE_SLUG || 'maison-verde').toLowerCase();
const storeName = process.env.STORE_NAME || 'Maison Verde';
const whatsappNumber = (process.env.WHATSAPP_NUMBER || '').replace(/\D/g, '');
const sessionLifetime = 1000 * 60 * 60 * 24 * 7;
const maxImageBytes = 2_500_000;

if (!/^[a-z0-9-]{2,50}$/.test(storeSlug)) {
  console.error('STORE_SLUG must be 2–50 lowercase letters, numbers, or hyphens.');
  process.exit(1);
}

const databasePath = path.resolve(root, process.env.DB_PATH || './data/store.db');
fs.mkdirSync(path.dirname(databasePath), { recursive: true });
const db = new Database(databasePath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
db.exec(`
  CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    price REAL NOT NULL,
    description TEXT NOT NULL,
    ingredients TEXT NOT NULL DEFAULT '',
    category TEXT NOT NULL,
    image TEXT NOT NULL DEFAULT '',
    available INTEGER NOT NULL DEFAULT 1,
    stock INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT PRIMARY KEY,
    expires_at INTEGER NOT NULL
  );
`);

const initialProducts = [
  {
    id: 'seed-citrus-soap',
    name: 'Citrus Grove Soap',
    price: 14,
    description: 'A creamy, small-batch bar with a bright little burst of citrus.',
    ingredients: 'Olive oil, shea butter, sweet orange, calendula',
    category: 'Body care',
    image: 'https://images.unsplash.com/photo-1600428853876-fb5a850b444f?auto=format&fit=crop&w=960&q=85',
    stock: 18
  },
  {
    id: 'seed-ceramic-vase',
    name: 'Everyday Bud Vase',
    price: 32,
    description: 'Hand-finished stoneware that makes even one garden stem feel special.',
    ingredients: 'Hand-thrown stoneware · satin glaze',
    category: 'Home',
    image: 'https://images.unsplash.com/photo-1578500494198-246f612d3b3d?auto=format&fit=crop&w=960&q=85',
    stock: 7
  },
  {
    id: 'seed-linen-tote',
    name: 'Market Day Tote',
    price: 28,
    description: 'A sturdy, soft-washed companion for the market, the beach, and everything.',
    ingredients: '100% European flax linen · made to last',
    category: 'Accessories',
    image: 'https://images.unsplash.com/photo-1590874103328-eac38a683ce7?auto=format&fit=crop&w=960&q=85',
    stock: 12
  },
  {
    id: 'seed-herbal-oil',
    name: 'Sunday Herbal Oil',
    price: 36,
    description: 'A lightweight botanical blend for an unhurried evening ritual.',
    ingredients: 'Jojoba, rosehip, lavender, vitamin E',
    category: 'Body care',
    image: 'https://images.unsplash.com/photo-1608571423902-eed4a5ad8108?auto=format&fit=crop&w=960&q=85',
    stock: 9
  },
  {
    id: 'seed-ceramic-mug',
    name: 'Soft Morning Mug',
    price: 38,
    description: 'A comfortable, one-of-a-kind mug for slow coffee and longer mornings.',
    ingredients: 'Wheel-thrown stoneware · food-safe glaze',
    category: 'Home',
    image: 'https://images.unsplash.com/photo-1514228742587-6b1558fcca3d?auto=format&fit=crop&w=960&q=85',
    stock: 5
  },
  {
    id: 'seed-wildflower',
    name: 'Wildflower Candle',
    price: 30,
    description: 'A gentle floral fragrance poured by hand for golden-hour evenings.',
    ingredients: 'Coconut-soy wax, cotton wick, botanical fragrance',
    category: 'Home',
    image: 'https://images.unsplash.com/photo-1603006905003-be475563bc59?auto=format&fit=crop&w=960&q=85',
    stock: 15
  }
];
const insertProduct = db.prepare(`
  INSERT OR IGNORE INTO products (id, name, price, description, ingredients, category, image, available, stock, created_at, updated_at)
  VALUES (@id, @name, @price, @description, @ingredients, @category, @image, 1, @stock, @now, @now)
`);
const seed = db.transaction(() => {
  const now = new Date().toISOString();
  for (const product of initialProducts) insertProduct.run({ ...product, now });
});
seed();

const digestToken = (token) => crypto.createHash('sha256').update(token).digest('hex');
const loginAttempts = new Map();
const attemptLimit = 5;
const attemptWindow = 15 * 60 * 1000;

app.disable('x-powered-by');
app.set('trust proxy', process.env.NODE_ENV === 'production' ? 1 : false);
app.use(express.json({ limit: '3mb', strict: true }));
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-Frame-Options', 'DENY');
  next();
});

function requireOwner(req, res, next) {
  const token = sessionToken(req);
  if (!token) return res.status(401).json({ error: 'Please sign in to continue.' });
  const tokenHash = digestToken(token);
  const session = db.prepare('SELECT expires_at FROM sessions WHERE token_hash = ?').get(tokenHash);
  if (!session || session.expires_at < Date.now()) {
    if (session) db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(tokenHash);
    res.clearCookie('atelier_session', cookieOptions());
    return res.status(401).json({ error: 'Your session has expired. Please sign in again.' });
  }
  next();
}

function sessionToken(req) {
  const token = req.headers.cookie?.match(/(?:^|;\s*)atelier_session=([A-Za-z0-9_-]+)/)?.[1];
  return token?.length === 43 ? token : null;
}

function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    path: '/'
  };
}

function parseUsers(contents) {
  const users = [];
  let malformedLines = 0;
  const lines = contents.replace(/^\uFEFF/, '').split(/\r\n|\n|\r/);
  for (const line of lines) {
    const entry = line.trim();
    if (!entry || entry.startsWith('#')) continue;
    const fields = entry.split(',');
    if (fields.length !== 2) {
      malformedLines += 1;
      continue;
    }
    const username = fields[0].trim();
    const password = fields[1].trim();
    if (!username || !password) {
      malformedLines += 1;
      continue;
    }
    users.push({ username, password });
  }
  return { users, malformedLines };
}

function credentialsMatch(submittedUsername, submittedPassword, users) {
  const submittedUsernameBuffer = Buffer.from(submittedUsername);
  const submittedPasswordBuffer = Buffer.from(submittedPassword);
  return users.some(({ username, password }) => {
    const usernameBuffer = Buffer.from(username);
    const passwordBuffer = Buffer.from(password);
    const usernameMatches = submittedUsernameBuffer.length === usernameBuffer.length
      && crypto.timingSafeEqual(submittedUsernameBuffer, usernameBuffer);
    const passwordMatches = submittedPasswordBuffer.length === passwordBuffer.length
      && crypto.timingSafeEqual(submittedPasswordBuffer, passwordBuffer);
    return usernameMatches && passwordMatches;
  });
}

function validText(value, maxLength) {
  return typeof value === 'string' && value.trim().length > 0 && value.trim().length <= maxLength;
}

function parseProduct(body, existing = null) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new Error('Product details must be sent as an object.');
  }
  const source = existing ?? {};
  const name = typeof body.name === 'string' ? body.name.trim() : typeof source.name === 'string' ? source.name.trim() : '';
  const category = typeof body.category === 'string' ? body.category.trim() : typeof source.category === 'string' ? source.category.trim() : '';
  const description = typeof body.description === 'string' ? body.description.trim() : typeof source.description === 'string' ? source.description.trim() : '';
  if (body.ingredients !== undefined && typeof body.ingredients !== 'string') {
    throw new Error('Materials or ingredients must be text.');
  }
  if (body.image !== undefined && typeof body.image !== 'string') {
    throw new Error('Choose a valid product image.');
  }
  const ingredients = typeof body.ingredients === 'string' ? body.ingredients.trim() : typeof source.ingredients === 'string' ? source.ingredients.trim() : '';
  const image = typeof body.image === 'string' ? body.image.trim() : typeof source.image === 'string' ? source.image.trim() : '';
  const rawPrice = body.price ?? source.price ?? Number.NaN;
  const rawStock = body.stock ?? source.stock ?? Number.NaN;
  const price = typeof rawPrice === 'number'
    ? rawPrice
    : typeof rawPrice === 'string' && rawPrice.trim() ? Number(rawPrice) : Number.NaN;
  const stock = typeof rawStock === 'number'
    ? rawStock
    : typeof rawStock === 'string' && rawStock.trim() ? Number(rawStock) : Number.NaN;
  if (body.available !== undefined && typeof body.available !== 'boolean') {
    throw new Error('Product availability must be true or false.');
  }
  const available = body.available ?? (existing ? Boolean(existing.available) : true);
  const validImage = !image || /^https:\/\/[^\s]+$/i.test(image) || /^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/i.test(image);
  if (!validText(name, 100)) throw new Error('Add a product name (up to 100 characters).');
  if (!Number.isFinite(price) || price < 0 || price > 1_000_000) throw new Error('Enter a valid price.');
  if (!validText(category, 60)) throw new Error('Choose a category (up to 60 characters).');
  if (!validText(description, 500)) throw new Error('Add a short description (up to 500 characters).');
  if (ingredients.length > 300) throw new Error('Ingredients must be 300 characters or fewer.');
  if (!Number.isInteger(stock) || stock < 0 || stock > 1_000_000) throw new Error('Enter a valid stock count.');
  if (!validImage || Buffer.byteLength(image, 'utf8') > maxImageBytes) throw new Error('Choose a valid HTTPS image or a compressed image under 2.5 MB.');
  return { name, price: Math.round(price * 100) / 100, category, description, ingredients, image, available, stock };
}

function serializeProduct(row) {
  return { ...row, available: Boolean(row.available) };
}

app.get('/api/health', (_req, res) => res.json({ ok: true }));

function sendPublicStore(res, requestedSlug) {
  if (requestedSlug !== storeSlug) return res.status(404).json({ error: 'This store could not be found.' });
  const products = db.prepare('SELECT * FROM products WHERE available = 1 ORDER BY created_at DESC').all().map(serializeProduct);
  res.json({ store: { name: storeName, slug: storeSlug, whatsappNumber }, products });
}

app.get('/api/store', (_req, res) => sendPublicStore(res, storeSlug));
app.get('/api/store/:slug', (req, res) => sendPublicStore(res, req.params.slug));

app.get('/api/store/:slug/events', (req, res) => {
  if (req.params.slug !== storeSlug) return res.status(404).json({ error: 'This store could not be found.' });
  res.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no'
  });
  res.flushHeaders();
  res.write('event: connected\ndata: {}\n\n');
  catalogSubscribers.add(res);
  const heartbeat = setInterval(() => {
    if (!res.destroyed && !res.writableEnded) res.write(': keep-alive\n\n');
  }, 25_000);
  res.on('close', () => {
    clearInterval(heartbeat);
    catalogSubscribers.delete(res);
  });
});

app.get('/api/auth/session', (req, res) => {
  const token = sessionToken(req);
  if (!token) return res.json({ authenticated: false });
  const session = db.prepare('SELECT expires_at FROM sessions WHERE token_hash = ?').get(digestToken(token));
  const authenticated = Boolean(session && session.expires_at >= Date.now());
  if (!authenticated) res.clearCookie('atelier_session', cookieOptions());
  res.json({ authenticated });
});

app.post('/api/auth/login', async (req, res) => {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  const attempts = loginAttempts.get(ip);
  if (attempts && attempts.resetAt > now && attempts.count >= attemptLimit) {
    res.setHeader('Retry-After', Math.ceil((attempts.resetAt - now) / 1000));
    return res.status(429).json({ error: 'Too many attempts. Please wait a few minutes and try again.' });
  }
  const submittedUsername = typeof req.body?.username === 'string' ? req.body.username.trim() : '';
  const submittedPassword = typeof req.body?.password === 'string' ? req.body.password.trim() : '';
  if (!submittedUsername || !submittedPassword) {
    return res.status(400).json({ error: 'Username and password are required.' });
  }
  let users;
  try {
    const parsedUsers = parseUsers(await readFile(usersFilePath, 'utf8'));
    users = parsedUsers.users;
    if (parsedUsers.malformedLines) {
      console.warn(`[auth] Ignored ${parsedUsers.malformedLines} malformed line(s) in ${usersFilePath}. Expected username,password.`);
    }
  } catch (error) {
    if (error.code === 'ENOENT') {
      console.warn(`[auth] Users file not found: ${usersFilePath}`);
      return res.status(503).json({ error: 'Authentication is not configured. Create the users.txt file with at least one username,password entry.' });
    }
    console.warn(`[auth] Could not read or parse the users file at ${usersFilePath}: ${error.message}`);
    return res.status(500).json({ error: 'Could not read the users file. Check the server file permissions and try again.' });
  }
  if (!users.length) {
    console.warn(`[auth] No valid accounts found in ${usersFilePath}.`);
    return res.status(503).json({ error: 'No accounts are configured. Add at least one username,password entry to users.txt.' });
  }
  if (!credentialsMatch(submittedUsername, submittedPassword, users)) {
    const current = attempts && attempts.resetAt > now ? attempts : { count: 0, resetAt: now + attemptWindow };
    current.count += 1;
    loginAttempts.set(ip, current);
    return res.status(401).json({ error: 'Invalid username or password.' });
  }
  loginAttempts.delete(ip);
  const token = crypto.randomBytes(32).toString('base64url');
  db.prepare('INSERT INTO sessions (token_hash, expires_at) VALUES (?, ?)').run(digestToken(token), now + sessionLifetime);
  res.cookie('atelier_session', token, { ...cookieOptions(), maxAge: sessionLifetime });
  res.json({ authenticated: true });
});

app.post('/api/auth/logout', (req, res) => {
  const token = sessionToken(req);
  if (token) db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(digestToken(token));
  res.clearCookie('atelier_session', cookieOptions());
  res.json({ authenticated: false });
});

app.use('/api/admin', requireOwner);

app.get('/api/admin/products', (_req, res) => {
  const products = db.prepare('SELECT * FROM products ORDER BY created_at DESC').all().map(serializeProduct);
  res.json({ products });
});

app.post('/api/admin/products', (req, res) => {
  let product;
  try {
    product = parseProduct(req.body);
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  db.prepare(`
    INSERT INTO products (id, name, price, description, ingredients, category, image, available, stock, created_at, updated_at)
    VALUES (@id, @name, @price, @description, @ingredients, @category, @image, @available, @stock, @now, @now)
  `).run({ id, ...product, available: Number(product.available), now });
  publishCatalogUpdate();
  res.status(201).json({ product: serializeProduct(db.prepare('SELECT * FROM products WHERE id = ?').get(id)) });
});

app.put('/api/admin/products/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'That product no longer exists.' });
  let product;
  try {
    product = parseProduct(req.body, existing);
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
  db.prepare(`
    UPDATE products SET name=@name, price=@price, description=@description, ingredients=@ingredients,
      category=@category, image=@image, available=@available, stock=@stock, updated_at=@updated_at WHERE id=@id
  `).run({ id: req.params.id, ...product, available: Number(product.available), updated_at: new Date().toISOString() });
  publishCatalogUpdate();
  res.json({ product: serializeProduct(db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id)) });
});

app.delete('/api/admin/products/:id', (req, res) => {
  const result = db.prepare('DELETE FROM products WHERE id = ?').run(req.params.id);
  if (!result.changes) return res.status(404).json({ error: 'That product no longer exists.' });
  publishCatalogUpdate();
  res.status(204).end();
});

app.use('/api', (_req, res) => res.status(404).json({ error: 'API route not found.' }));
app.use((error, _req, res, _next) => {
  const status = Number.isInteger(error.status) && error.status >= 400 && error.status < 500 ? error.status : 500;
  if (status >= 500) console.error(error);
  res.status(status).json({
    error: status === 413
      ? 'Request is too large. Please use a smaller image.'
      : status < 500
        ? 'Request could not be processed. Check the submitted data and try again.'
        : 'Something went wrong. Please try again.'
  });
});

const distPath = path.join(root, 'dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath, { index: false }));
  app.get('*splat', (_req, res) => res.sendFile(path.join(distPath, 'index.html')));
} else {
  app.get('/', (_req, res) => res.status(200).send('Atelier store API is running. Start the frontend with npm run dev.'));
}

const catalogSubscribers = new Set();
function publishCatalogUpdate() {
  for (const response of catalogSubscribers) {
    if (response.destroyed || response.writableEnded) {
      catalogSubscribers.delete(response);
      continue;
    }
    response.write('event: catalog\ndata: {}\n\n');
  }
};

const cleanup = setInterval(() => {
  db.prepare('DELETE FROM sessions WHERE expires_at < ?').run(Date.now());
  for (const [ip, attempt] of loginAttempts) if (attempt.resetAt < Date.now()) loginAttempts.delete(ip);
}, 60 * 60 * 1000);
cleanup.unref();
app.listen(port,'0.0.0.0', () => console.log(`Store API listening on http://localhost:${port}`));
