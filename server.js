import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import express from 'express';
import mysql from 'mysql2/promise';

const root = path.dirname(fileURLToPath(import.meta.url));
const distPath = path.join(root, 'dist');
const envPath = path.join(root, '.env');
const schemaPath = path.join(root, 'schema.sql');
const scrypt = promisify(crypto.scrypt);
const sessionCookie = 'store_session';
const sessionLifetime = 30 * 24 * 60 * 60 * 1000;

if (fs.existsSync(envPath)) {
  for (const rawLine of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const separator = line.indexOf('=');
    if (separator < 1) continue;
    const key = line.slice(0, separator).trim();
    const value = line.slice(separator + 1).trim().replace(/^(['"])(.*)\1$/, '$2');
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

class HttpError extends Error {
  constructor(status, message, code) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

let pool;
let databaseReady = false;
let databaseInitialization;

function getPool() {
  if (pool) return pool;
  const { DB_HOST, DB_USER, DB_NAME } = process.env;
  if (!DB_HOST || !DB_USER || !DB_NAME) {
    throw new Error('MySQL is not configured. Set DB_HOST, DB_USER, DB_PASSWORD, and DB_NAME in the project .env file.');
  }
  if (!/^[A-Za-z0-9_]+$/.test(DB_NAME)) {
    throw new Error('DB_NAME may contain only letters, numbers, and underscores.');
  }
  pool = mysql.createPool({
    host: DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    user: DB_USER,
    password: process.env.DB_PASSWORD || '',
    database: DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    charset: 'utf8mb4'
  });
  return pool;
}

async function ensureDatabase() {
  if (databaseReady) return getPool();
  if (!databaseInitialization) {
    databaseInitialization = (async () => {
      const database = getPool();
      await database.query('SELECT 1');
      console.log('Connected to MySQL Database successfully!');
      const schema = fs.readFileSync(schemaPath, 'utf8');
      const statements = schema.split(';').map((statement) => statement.trim()).filter(Boolean);
      for (const statement of statements) await database.query(statement);
      databaseReady = true;
      console.log('MySQL store schema is ready.');
      return database;
    })();
  }
  try {
    return await databaseInitialization;
  } catch (error) {
    databaseInitialization = null;
    const unavailable = new HttpError(
      503,
      'Local MySQL is not available. Start MySQL and verify DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, and DB_NAME.',
      'DB_UNAVAILABLE'
    );
    unavailable.cause = error;
    throw unavailable;
  }
}

function apiError(error) {
  if (error instanceof HttpError) return error;
  if (error?.code === 'ER_DUP_ENTRY') {
    return new HttpError(409, 'That email address or username is already registered.', 'ALREADY_EXISTS');
  }
  console.error('Local API request failed.', error);
  return new HttpError(500, 'The server could not complete this request. Please try again.');
}

function route(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

function parseCookies(header = '') {
  return Object.fromEntries(header.split(';').flatMap((part) => {
    const separator = part.indexOf('=');
    if (separator < 0) return [];
    const name = part.slice(0, separator).trim();
    try {
      return [[name, decodeURIComponent(part.slice(separator + 1).trim())]];
    } catch {
      return [];
    }
  }));
}

function setSessionCookie(res, token) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  res.setHeader('Set-Cookie', `${sessionCookie}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${sessionLifetime / 1000}${secure}`);
}

function clearSessionCookie(res) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  res.setHeader('Set-Cookie', `${sessionCookie}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`);
}

function sessionHash(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function publicUser(row) {
  return {
    uid: row.id,
    fullName: row.full_name,
    origin: row.origin,
    age: Number(row.age),
    email: row.email,
    phoneNumber: row.phone_number,
    projectType: row.project_type,
    username: row.username,
    usernameLower: row.username,
    storeSlug: row.username
  };
}

function validString(value, maxLength) {
  return typeof value === 'string' && value.trim().length > 0 && value.trim().length <= maxLength;
}

function normalizeProduct(input) {
  const price = Number(input?.price);
  const stock = Number(input?.stock);
  if (!validString(input?.name, 100)) throw new HttpError(400, 'Enter a product name up to 100 characters.');
  if (!Number.isFinite(price) || price < 0 || price > 1000000) throw new HttpError(400, 'Enter a valid product price.');
  if (!validString(input?.description, 500)) throw new HttpError(400, 'Enter a product description up to 500 characters.');
  if (!validString(input?.category, 60)) throw new HttpError(400, 'Enter a product category up to 60 characters.');
  if (!Number.isInteger(stock) || stock < 0 || stock > 1000000) throw new HttpError(400, 'Enter a valid stock quantity.');
  if (typeof input?.image !== 'string' || input.image.length > 1500000) throw new HttpError(400, 'Product images must be smaller than 1.5 MB.');
  return {
    name: input.name.trim(),
    price,
    description: input.description.trim(),
    ingredients: typeof input.ingredients === 'string' ? input.ingredients.trim().slice(0, 300) : '',
    category: input.category.trim(),
    image: input.image,
    stock,
    available: Boolean(input.available)
  };
}

function productFromRow(row) {
  return {
    id: row.id,
    name: row.name,
    price: Number(row.price),
    description: row.description,
    ingredients: row.ingredients,
    category: row.category,
    image: row.image,
    stock: Number(row.stock),
    available: Boolean(row.available),
    storeSlug: row.store_slug,
    createdAt: row.created_at
  };
}

function orderFromRow(row) {
  return {
    id: row.id,
    customerName: row.customer_name,
    phoneNumber: row.phone_number,
    location: row.location,
    items: typeof row.items === 'string' ? JSON.parse(row.items) : row.items,
    total: Number(row.total),
    storeSlug: row.store_slug,
    timestamp: row.created_at,
    status: row.status
  };
}

async function findSession(req) {
  const token = parseCookies(req.headers.cookie)[sessionCookie];
  if (!token || token.length > 200) return null;
  const database = await ensureDatabase();
  const [rows] = await database.execute(
    `SELECT u.* FROM sessions s
     JOIN users u ON u.id = s.user_id
     WHERE s.token_hash = ? AND s.expires_at > CURRENT_TIMESTAMP
     LIMIT 1`,
    [sessionHash(token)]
  );
  return rows[0] || null;
}

async function requireUser(req, _res, next) {
  try {
    req.account = await findSession(req);
    if (!req.account) throw new HttpError(401, 'Please sign in to continue.', 'AUTH_REQUIRED');
    next();
  } catch (error) {
    next(error);
  }
}

async function createSession(connection, userId) {
  const token = crypto.randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + sessionLifetime);
  await connection.execute(
    'INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)',
    [sessionHash(token), userId, expiresAt]
  );
  return token;
}

const app = express();
const port = Number(process.env.PORT || 3000);
app.disable('x-powered-by');
app.use(express.json({ limit: '10mb' }));

app.get('/api/health', route(async (_req, res) => {
  await ensureDatabase();
  res.json({ ok: true, database: 'mysql' });
}));

app.use('/api', route(async (_req, _res, next) => {
  await ensureDatabase();
  next();
}));

app.get('/api/auth/me', route(async (req, res) => {
  const account = await findSession(req);
  res.json({ user: account ? publicUser(account) : null });
}));

app.get('/api/auth/username-available', route(async (req, res) => {
  const username = String(req.query.username || '').trim().toLowerCase();
  if (!/^[a-z0-9_-]{3,24}$/.test(username)) throw new HttpError(400, 'Use 3–24 letters, numbers, hyphens, or underscores.');
  const [rows] = await getPool().execute('SELECT id FROM users WHERE username = ? LIMIT 1', [username]);
  res.json({ available: rows.length === 0 });
}));

app.post('/api/auth/register', route(async (req, res) => {
  const form = req.body || {};
  const fullName = typeof form.fullName === 'string' ? form.fullName.trim() : '';
  const origin = typeof form.origin === 'string' ? form.origin.trim() : '';
  const age = Number(form.age);
  const email = typeof form.email === 'string' ? form.email.trim().toLowerCase() : '';
  const phoneNumber = typeof form.phoneNumber === 'string' ? form.phoneNumber.trim() : '';
  const projectType = typeof form.projectType === 'string' ? form.projectType.trim() : '';
  const username = typeof form.username === 'string' ? form.username.trim().toLowerCase() : '';
  const password = typeof form.password === 'string' ? form.password : '';

  if (!validString(fullName, 100) || !validString(origin, 100) || !validString(phoneNumber, 40)) {
    throw new HttpError(400, 'Complete your name, origin or city, and phone number.');
  }
  if (!Number.isInteger(age) || age < 13 || age > 120) throw new HttpError(400, 'Age must be a whole number between 13 and 120.');
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new HttpError(400, 'Enter a valid email address.');
  if (!validString(projectType, 100)) throw new HttpError(400, 'Choose a project type.');
  if (!/^[a-z0-9_-]{3,24}$/.test(username)) throw new HttpError(400, 'Use 3–24 letters, numbers, hyphens, or underscores for your username.');
  if (password.length < 10 || password.length > 128 || !/\d/.test(password) || !/[^A-Za-z0-9]/.test(password)) {
    throw new HttpError(400, 'Use at least 10 characters, including a number and a special character.');
  }

  const salt = crypto.randomBytes(16);
  const derivedPassword = await scrypt(password, salt, 64);
  const passwordHash = `${salt.toString('hex')}:${derivedPassword.toString('hex')}`;
  const userId = crypto.randomUUID();
  const connection = await getPool().getConnection();
  try {
    await connection.beginTransaction();
    await connection.execute(
      `INSERT INTO users (id, full_name, origin, age, email, phone_number, project_type, username, password_hash)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [userId, fullName, origin, age, email, phoneNumber, projectType, username, passwordHash]
    );
    const token = await createSession(connection, userId);
    await connection.commit();
    setSessionCookie(res, token);
  } catch (error) {
    await connection.rollback();
    if (error?.code === 'ER_DUP_ENTRY') {
      throw new HttpError(409, 'That email address or username is already registered.', 'ALREADY_EXISTS');
    }
    throw error;
  } finally {
    connection.release();
  }

  const [rows] = await getPool().execute('SELECT * FROM users WHERE id = ?', [userId]);
  res.status(201).json({ user: publicUser(rows[0]) });
}));

app.post('/api/auth/login', route(async (req, res) => {
  const identifier = typeof req.body?.identifier === 'string' ? req.body.identifier.trim().toLowerCase() : '';
  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  if (!identifier || !password) throw new HttpError(400, 'Enter your email or username and password.');
  const [rows] = await getPool().execute(
    'SELECT * FROM users WHERE email = ? OR username = ? LIMIT 1',
    [identifier, identifier]
  );
  const account = rows[0];
  let validPassword = false;
  if (account) {
    const [saltHex, hashHex] = account.password_hash.split(':');
    const salt = Buffer.from(saltHex, 'hex');
    const expected = Buffer.from(hashHex, 'hex');
    const actual = await scrypt(password, salt, expected.length);
    validPassword = expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
  }
  if (!account || !validPassword) throw new HttpError(401, 'That email/username and password combination did not match.', 'INVALID_CREDENTIALS');

  const connection = await getPool().getConnection();
  try {
    await connection.beginTransaction();
    await connection.execute('DELETE FROM sessions WHERE user_id = ? AND expires_at <= CURRENT_TIMESTAMP', [account.id]);
    const token = await createSession(connection, account.id);
    await connection.commit();
    setSessionCookie(res, token);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
  res.json({ user: publicUser(account) });
}));

app.post('/api/auth/logout', route(async (req, res) => {
  const token = parseCookies(req.headers.cookie)[sessionCookie];
  if (token) await getPool().execute('DELETE FROM sessions WHERE token_hash = ?', [sessionHash(token)]);
  clearSessionCookie(res);
  res.json({ ok: true });
}));

app.get('/api/users/me', requireUser, (req, res) => res.json(publicUser(req.account)));

app.get('/api/stores/:slug', route(async (req, res) => {
  const slug = req.params.slug.toLowerCase();
  const [rows] = await getPool().execute(
    'SELECT id, full_name, username FROM users WHERE username = ? LIMIT 1',
    [slug]
  );
  if (!rows.length) throw new HttpError(404, 'We couldn’t find a store with that link.');
  res.json({
    ownerId: rows[0].id,
    name: rows[0].full_name,
    username: rows[0].username,
    storeSlug: rows[0].username
  });
}));

app.get('/api/stores/:slug/products', route(async (req, res) => {
  const slug = req.params.slug.toLowerCase();
  const [owners] = await getPool().execute('SELECT id FROM users WHERE username = ? LIMIT 1', [slug]);
  if (!owners.length) throw new HttpError(404, 'We couldn’t find a store with that link.');
  const [rows] = await getPool().execute(
    'SELECT * FROM products WHERE user_id = ? AND available = TRUE ORDER BY created_at DESC',
    [owners[0].id]
  );
  res.json(rows.map(productFromRow));
}));

app.get('/api/products', requireUser, route(async (req, res) => {
  const [rows] = await getPool().execute('SELECT * FROM products WHERE user_id = ? ORDER BY created_at DESC', [req.account.id]);
  res.json(rows.map(productFromRow));
}));

app.post('/api/products', requireUser, route(async (req, res) => {
  const product = normalizeProduct(req.body);
  const id = crypto.randomUUID();
  await getPool().execute(
    `INSERT INTO products
     (id, user_id, store_slug, name, price, description, ingredients, category, image, stock, available)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, req.account.id, req.account.username, product.name, product.price, product.description, product.ingredients, product.category, product.image, product.stock, product.available]
  );
  const [rows] = await getPool().execute('SELECT * FROM products WHERE id = ?', [id]);
  res.status(201).json({ product: productFromRow(rows[0]) });
}));

app.patch('/api/products/:id', requireUser, route(async (req, res) => {
  const product = normalizeProduct(req.body);
  const [result] = await getPool().execute(
    `UPDATE products SET name = ?, price = ?, description = ?, ingredients = ?, category = ?,
     image = ?, stock = ?, available = ? WHERE id = ? AND user_id = ?`,
    [product.name, product.price, product.description, product.ingredients, product.category, product.image, product.stock, product.available, req.params.id, req.account.id]
  );
  if (!result.affectedRows) throw new HttpError(404, 'That product no longer exists in your store.');
  res.json({ ok: true });
}));

app.delete('/api/products/:id', requireUser, route(async (req, res) => {
  const [result] = await getPool().execute('DELETE FROM products WHERE id = ? AND user_id = ?', [req.params.id, req.account.id]);
  if (!result.affectedRows) throw new HttpError(404, 'That product no longer exists in your store.');
  res.json({ ok: true });
}));

app.get('/api/orders', requireUser, route(async (req, res) => {
  const [rows] = await getPool().execute('SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC', [req.account.id]);
  res.json(rows.map(orderFromRow));
}));

app.post('/api/orders', route(async (req, res) => {
  const { customerName, phoneNumber, location, storeSlug, items } = req.body || {};
  if (!validString(customerName, 100) || !validString(phoneNumber, 40) || !validString(location, 300)) {
    throw new HttpError(400, 'Add your name, phone number, and delivery location to continue.');
  }
  if (typeof storeSlug !== 'string' || !/^[a-z0-9_-]{3,24}$/.test(storeSlug)) throw new HttpError(400, 'The store link is invalid.');
  if (!Array.isArray(items) || items.length < 1 || items.length > 30) throw new HttpError(400, 'Your order must contain between 1 and 30 products.');
  const productIds = [...new Set(items.map((item) => item?.productId).filter((id) => typeof id === 'string'))];
  if (productIds.length !== items.length) throw new HttpError(400, 'The order contains an invalid product.');
  const quantities = new Map();
  for (const item of items) {
    const quantity = Number(item.quantity);
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 100) throw new HttpError(400, 'Choose a valid quantity for each product.');
    quantities.set(item.productId, quantity);
  }

  const connection = await getPool().getConnection();
  let orderId;
  try {
    await connection.beginTransaction();
    const [owners] = await connection.execute('SELECT id FROM users WHERE username = ? LIMIT 1', [storeSlug]);
    if (!owners.length) throw new HttpError(404, 'We couldn’t find that store.');
    const ownerId = owners[0].id;
    const placeholders = productIds.map(() => '?').join(', ');
    const [products] = await connection.execute(
      `SELECT * FROM products WHERE user_id = ? AND store_slug = ? AND id IN (${placeholders}) AND available = TRUE FOR UPDATE`,
      [ownerId, storeSlug, ...productIds]
    );
    if (products.length !== productIds.length) throw new HttpError(400, 'One or more products are no longer available.');
    const orderItems = products.map((product) => {
      const quantity = quantities.get(product.id);
      if (quantity > Number(product.stock)) throw new HttpError(400, `${product.name} does not have enough stock for that quantity.`);
      return {
        name: product.name,
        image: product.image,
        price: Number(product.price),
        quantity
      };
    });
    const total = orderItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
    orderId = crypto.randomUUID();
    await connection.execute(
      `INSERT INTO orders (id, user_id, store_slug, customer_name, phone_number, location, items, total)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [orderId, ownerId, storeSlug, customerName.trim(), phoneNumber.trim(), location.trim(), JSON.stringify(orderItems), total]
    );
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
  res.status(201).json({ id: orderId });
}));

app.patch('/api/orders/:id/complete', requireUser, route(async (req, res) => {
  const [result] = await getPool().execute(
    'UPDATE orders SET status = ? WHERE id = ? AND user_id = ? AND status = ?',
    ['completed', req.params.id, req.account.id, 'pending']
  );
  if (!result.affectedRows) throw new HttpError(404, 'That pending order could not be found.');
  res.json({ ok: true });
}));

app.delete('/api/orders/:id', requireUser, route(async (req, res) => {
  const [result] = await getPool().execute('DELETE FROM orders WHERE id = ? AND user_id = ?', [req.params.id, req.account.id]);
  if (!result.affectedRows) throw new HttpError(404, 'That order could not be found.');
  res.json({ ok: true });
}));

app.use('/api', (_req, _res, next) => next(new HttpError(404, 'API route not found.')));
app.use('/api', (error, _req, res, _next) => {
  const normalized = apiError(error);
  res.status(normalized.status || 500).json({ error: normalized.message, code: normalized.code });
});

app.use(express.static(distPath, { index: false }));
app.get('*splat', (_req, res) => {
  res.sendFile(path.join(distPath, 'index.html'), (error) => {
    if (error && !res.headersSent) {
      res.status(503).send('Build the application with npm run build before starting the production server.');
    }
  });
});

const server = app.listen(port, () => {
  console.log(`Storefront and local API listening on http://localhost:${port}`);
  ensureDatabase().catch((error) => {
    console.error(`MySQL is not ready: ${error.cause?.message || error.message}`);
    console.error('The web server will stay available and retry database setup when an API request arrives.');
  });
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    server.close(async () => {
      if (pool) await pool.end();
      process.exit(0);
    });
  });
}
