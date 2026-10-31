import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';

const root = path.dirname(fileURLToPath(import.meta.url));
const distPath = path.join(root, 'dist');
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

app.disable('x-powered-by');
app.get('/api/health', (_req, res) => res.json({ ok: true }));
app.use(express.static(distPath, { index: false }));
app.get('/api/*splat', (_req, res) => res.status(404).json({ error: 'API route not found.' }));
app.get('*splat', (_req, res) => {
  res.sendFile(path.join(distPath, 'index.html'), (error) => {
    if (error && !res.headersSent) {
      res.status(503).send('Build the application with npm run build before starting the production server.');
    }
  });
});

app.listen(port, () => console.log(`Storefront listening on http://localhost:${port}`));
