/**
 * Xtreme Machines – Server
 * Serverer hjemmesiden, API og adminpanel
 */

require('dotenv').config();

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const express = require('express');
const session = require('express-session');
const multer = require('multer');
const sharp = require('sharp');

const ROOT = path.join(__dirname, '..');
const STORAGE_ROOT = process.env.STORAGE_ROOT || path.join(ROOT, 'data');
const DATA_FILE = path.join(STORAGE_ROOT, 'products.json');
const REPO_DATA_FILE = path.join(ROOT, 'data', 'products.json');
const BIKES_DIR = path.join(STORAGE_ROOT, 'bikes');
const PORT = process.env.PORT || 8765;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'xtreme2026';
const SESSION_SECRET = process.env.SESSION_SECRET || 'xtreme-dev-secret-change-me';

const app = express();

if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

app.use(express.json({ limit: '2mb' }));
app.use(session({
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  },
}));

// ---- Data helpers ----

function readProducts() {
  const raw = fs.readFileSync(DATA_FILE, 'utf8');
  return JSON.parse(raw);
}

function writeProducts(products) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(products, null, 2) + '\n', 'utf8');
}

function migrateProducts(products) {
  let changed = false;
  const base = Date.now() - products.length * 86400000;

  const migrated = products.map((p, index) => {
    const next = { ...p };
    if (!next.status) {
      next.status = 'available';
      changed = true;
    }
    if (!next.createdAt) {
      next.createdAt = new Date(base + index * 86400000).toISOString();
      changed = true;
    }
    if (!next.updatedAt) {
      next.updatedAt = next.createdAt;
      changed = true;
    }
    if (next.status === 'sold' && !next.badge) {
      next.badge = 'Solgt';
      changed = true;
    }
    return next;
  });

  if (changed) writeProducts(migrated);
  return migrated;
}

function nextProductId(products) {
  const max = products.reduce((m, p) => Math.max(m, parseInt(p.id, 10) || 0), 0);
  return String(max + 1);
}

function normalizePrice(value) {
  if (value == null || value === '') return null;
  const cleaned = String(value).replace(/\s/g, '').replace(/\./g, '').replace(',', '.');
  const num = parseFloat(cleaned);
  if (Number.isNaN(num)) return null;
  return Math.round(num).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

function sanitizeProductInput(body) {
  const title = String(body.title || '').trim();
  const description = String(body.description || '').trim();
  const price = normalizePrice(body.price);
  const downPayment = body.downPayment ? normalizePrice(body.downPayment) : null;
  const monthly = body.monthly ? normalizePrice(body.monthly) : null;
  const note = body.note ? String(body.note).trim() : null;
  const images = Array.isArray(body.images) ? body.images.filter(Boolean) : [];
  const image = body.image || images[0] || '';

  if (!title) throw new Error('Titel er påkrævet');
  if (!description) throw new Error('Beskrivelse er påkrævet');
  if (!price) throw new Error('Pris er påkrævet');
  if (!images.length) throw new Error('Mindst ét billede er påkrævet');
  if (!image || !images.includes(image)) throw new Error('Hovedbillede skal være valgt');

  return { title, description, price, downPayment, monthly, note, images, image };
}

function getPublicProducts(products) {
  return products
    .filter(p => p.status === 'available')
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

// ---- Auth ----

function safeEqual(a, b) {
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

function requireAuth(req, res, next) {
  if (req.session?.admin) return next();
  res.status(401).json({ error: 'Ikke logget ind' });
}

// ---- Image upload ----

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024, files: 20 },
  fileFilter(_req, file, cb) {
    if (/^image\/(jpeg|jpg|png|webp|gif)$/i.test(file.mimetype)) cb(null, true);
    else cb(new Error('Kun billedfiler er tilladt'));
  },
});

async function optimizeAndSaveImage(buffer, productId, originalName) {
  const dir = path.join(BIKES_DIR, productId);
  fs.mkdirSync(dir, { recursive: true });

  const base = path.basename(originalName, path.extname(originalName))
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '') || 'billede';

  const filename = `${base}-${Date.now()}.jpg`;
  const filepath = path.join(dir, filename);

  await sharp(buffer)
    .rotate()
    .resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 85, mozjpeg: true })
    .toFile(filepath);

  return `/assets/images/bikes/${productId}/${filename}`;
}

// ---- Public API ----

app.get('/api/products', (_req, res) => {
  try {
    const products = migrateProducts(readProducts());
    res.json(getPublicProducts(products));
  } catch (err) {
    res.status(500).json({ error: 'Kunne ikke hente motorcykler' });
  }
});

app.get('/api/products/:id', (req, res) => {
  try {
    const products = migrateProducts(readProducts());
    const product = products.find(p => p.id === req.params.id);
    if (!product || product.status === 'draft') return res.status(404).json({ error: 'Ikke fundet' });
    res.json(product);
  } catch {
    res.status(500).json({ error: 'Kunne ikke hente motorcykel' });
  }
});

// ---- Admin auth API ----

app.post('/api/admin/login', (req, res) => {
  const { password } = req.body || {};
  if (!password || !safeEqual(password, ADMIN_PASSWORD)) {
    return res.status(401).json({ error: 'Forkert adgangskode' });
  }
  req.session.admin = true;
  res.json({ ok: true });
});

app.post('/api/admin/logout', (req, res) => {
  req.session.destroy(() => {
    res.json({ ok: true });
  });
});

app.get('/api/admin/me', (req, res) => {
  res.json({ loggedIn: !!req.session?.admin });
});

// ---- Admin products API ----

app.get('/api/admin/products', requireAuth, (_req, res) => {
  try {
    const products = migrateProducts(readProducts());
    products.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    res.json(products);
  } catch {
    res.status(500).json({ error: 'Kunne ikke hente motorcykler' });
  }
});

app.get('/api/admin/products/:id', requireAuth, (req, res) => {
  try {
    const products = migrateProducts(readProducts());
    const product = products.find(p => p.id === req.params.id);
    if (!product) return res.status(404).json({ error: 'Ikke fundet' });
    res.json(product);
  } catch {
    res.status(500).json({ error: 'Kunne ikke hente motorcykel' });
  }
});

app.post('/api/admin/products/draft', requireAuth, (req, res) => {
  try {
    const products = migrateProducts(readProducts());
    const title = String(req.body.title || 'Ny motorcykel').trim();
    const now = new Date().toISOString();
    const product = {
      id: nextProductId(products),
      title,
      description: String(req.body.description || 'Udfyld specifikationer').trim(),
      price: normalizePrice(req.body.price) || '0',
      downPayment: req.body.downPayment ? normalizePrice(req.body.downPayment) : null,
      monthly: req.body.monthly ? normalizePrice(req.body.monthly) : null,
      note: req.body.note ? String(req.body.note).trim() : null,
      images: [],
      image: '',
      status: 'draft',
      createdAt: now,
      updatedAt: now,
    };
    products.unshift(product);
    writeProducts(products);
    res.status(201).json(product);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/admin/products', requireAuth, (req, res) => {
  try {
    const products = migrateProducts(readProducts());
    const data = sanitizeProductInput(req.body);
    const now = new Date().toISOString();
    const product = {
      id: nextProductId(products),
      ...data,
      status: 'available',
      createdAt: now,
      updatedAt: now,
    };
    products.unshift(product);
    writeProducts(products);
    res.status(201).json(product);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.put('/api/admin/products/:id', requireAuth, (req, res) => {
  try {
    const products = migrateProducts(readProducts());
    const index = products.findIndex(p => p.id === req.params.id);
    if (index === -1) return res.status(404).json({ error: 'Ikke fundet' });

    const data = sanitizeProductInput(req.body);
    const existing = products[index];
    products[index] = {
      ...existing,
      ...data,
      id: existing.id,
      status: existing.status === 'sold' ? 'sold' : 'available',
      badge: existing.status === 'sold' ? 'Solgt' : undefined,
      createdAt: existing.createdAt,
      updatedAt: new Date().toISOString(),
    };
    if (products[index].status !== 'sold') delete products[index].badge;

    writeProducts(products);
    res.json(products[index]);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.patch('/api/admin/products/:id/sold', requireAuth, (req, res) => {
  try {
    const products = migrateProducts(readProducts());
    const index = products.findIndex(p => p.id === req.params.id);
    if (index === -1) return res.status(404).json({ error: 'Ikke fundet' });

    const sold = req.body?.sold !== false;
    products[index].status = sold ? 'sold' : 'available';
    products[index].badge = sold ? 'Solgt' : undefined;
    if (!sold) delete products[index].badge;
    products[index].updatedAt = new Date().toISOString();

    writeProducts(products);
    res.json(products[index]);
  } catch {
    res.status(500).json({ error: 'Kunne ikke opdatere status' });
  }
});

app.delete('/api/admin/products/:id', requireAuth, (req, res) => {
  try {
    const products = migrateProducts(readProducts());
    const index = products.findIndex(p => p.id === req.params.id);
    if (index === -1) return res.status(404).json({ error: 'Ikke fundet' });

    const [removed] = products.splice(index, 1);
    writeProducts(products);

    const localDir = path.join(BIKES_DIR, removed.id);
    if (fs.existsSync(localDir)) {
      fs.rmSync(localDir, { recursive: true, force: true });
    }

    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Kunne ikke slette motorcykel' });
  }
});

app.post('/api/admin/products/:id/images', requireAuth, upload.array('images', 20), async (req, res) => {
  try {
    const productId = req.params.id;
    const products = migrateProducts(readProducts());
    if (!products.find(p => p.id === productId)) {
      return res.status(404).json({ error: 'Motorcykel ikke fundet' });
    }
    if (!req.files?.length) {
      return res.status(400).json({ error: 'Ingen billeder modtaget' });
    }

    const urls = [];
    for (const file of req.files) {
      const url = await optimizeAndSaveImage(file.buffer, productId, file.originalname);
      urls.push(url);
    }

    const index = products.findIndex(p => p.id === productId);
    products[index].images = [...(products[index].images || []), ...urls];
    if (!products[index].image) products[index].image = urls[0];
    products[index].updatedAt = new Date().toISOString();
    writeProducts(products);

    res.json({ urls });
  } catch (err) {
    res.status(400).json({ error: err.message || 'Upload fejlede' });
  }
});

// ---- Admin static (beskyttet) ----

app.use('/admin', (req, res, next) => {
  if (req.path === '/index.html' || req.path === '/' || req.path === '/login.html') return next();
  if (req.path.endsWith('.css') || req.path.endsWith('.js')) return next();
  if (!req.session?.admin) {
    return res.redirect('/admin/');
  }
  next();
});

app.use('/admin', express.static(path.join(ROOT, 'admin')));

app.get('/admin', (_req, res) => {
  res.sendFile(path.join(ROOT, 'admin', 'index.html'));
});

// ---- Forside med indlejrede karuseldata ----

function getNewestPublicProducts(limit = 5) {
  const products = migrateProducts(readProducts());
  return getPublicProducts(products).slice(0, limit);
}

function serveIndex(_req, res) {
  try {
    let html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
    const products = getNewestPublicProducts(5);
    const bootstrap = `<script>window.__CAROUSEL_PRODUCTS__=${JSON.stringify(products)};</script>`;
    html = html.replace('<!-- carousel-bootstrap -->', bootstrap);
    res.type('html').send(html);
  } catch {
    res.sendFile(path.join(ROOT, 'index.html'));
  }
}

app.get('/', serveIndex);
app.get('/index.html', serveIndex);

// ---- Public static site ----

app.use(express.static(ROOT, { index: false }));

// ---- Start ----

function initStorage() {
  fs.mkdirSync(STORAGE_ROOT, { recursive: true });
  fs.mkdirSync(BIKES_DIR, { recursive: true });

  if (!fs.existsSync(DATA_FILE) && fs.existsSync(REPO_DATA_FILE)) {
    fs.copyFileSync(REPO_DATA_FILE, DATA_FILE);
  }
}

initStorage();
migrateProducts(readProducts());

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Xtreme Machines kører på port ${PORT}`);
  console.log(`Adminpanel: /admin`);
});
