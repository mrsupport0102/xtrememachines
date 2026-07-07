/**
 * Xtreme Machines – Express app (lokal server + Netlify Functions)
 */

require('dotenv').config();

const fs = require('fs');
const path = require('path');
const express = require('express');
const multer = require('multer');
const { createStorage } = require('./storage');
const {
  isAuthenticated,
  setAuthCookie,
  clearAuthCookie,
  safeEqual,
} = require('./auth');

const ROOT = path.join(__dirname, '..');
const STORAGE_ROOT = process.env.STORAGE_ROOT || path.join(ROOT, 'data');
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'xtreme2026';
const SESSION_SECRET = process.env.SESSION_SECRET || 'xtreme-dev-secret-change-me';
const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const IS_NETLIFY = process.env.NETLIFY === 'true' || Boolean(process.env.AWS_LAMBDA_FUNCTION_NAME);

const storage = createStorage({ root: ROOT, storageRoot: STORAGE_ROOT });

function createApp({ serveStatic = true } = {}) {
  const app = express();

  if (IS_PRODUCTION) {
    app.set('trust proxy', 1);
  }

  app.use(express.json({ limit: '12mb' }));

  function requireAuth(req, res, next) {
    if (isAuthenticated(req, SESSION_SECRET)) return next();
    res.status(401).json({ error: 'Ikke logget ind' });
  }

  async function readAndMigrateProducts() {
    const products = await storage.readProducts();
    return migrateProducts(products);
  }

  async function migrateProducts(products) {
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

    if (changed) {
      try {
        await storage.writeProducts(migrated);
      } catch (err) {
        console.error('migrateProducts write skipped:', err.message);
      }
    }
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

  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 15 * 1024 * 1024, files: 20 },
    fileFilter(_req, file, cb) {
      if (/^image\/(jpeg|jpg|png|webp|gif)$/i.test(file.mimetype)) cb(null, true);
      else cb(new Error('Kun billedfiler er tilladt'));
    },
  });

  // ---- Public API ----

  app.get('/api/products', async (_req, res) => {
    try {
      const products = await readAndMigrateProducts();
      res.json(getPublicProducts(products));
    } catch {
      res.status(500).json({ error: 'Kunne ikke hente motorcykler' });
    }
  });

  app.get('/api/products/:id', async (req, res) => {
    try {
      const products = await readAndMigrateProducts();
      const product = products.find(p => p.id === req.params.id);
      if (!product || product.status === 'draft') return res.status(404).json({ error: 'Ikke fundet' });
      res.json(product);
    } catch {
      res.status(500).json({ error: 'Kunne ikke hente motorcykel' });
    }
  });

  app.get('/assets/images/bikes/:productId/:filename', async (req, res) => {
    try {
      const data = await storage.getImage(req.params.productId, req.params.filename);
      if (!data) return res.status(404).end();
      res.type('image/jpeg').send(Buffer.from(data));
    } catch {
      res.status(404).end();
    }
  });

  // ---- Admin auth ----

  app.post('/api/admin/login', (req, res) => {
    const { password } = req.body || {};
    if (!password || !safeEqual(password, ADMIN_PASSWORD)) {
      return res.status(401).json({ error: 'Forkert adgangskode' });
    }
    setAuthCookie(res, SESSION_SECRET, IS_PRODUCTION);
    res.json({ ok: true });
  });

  app.post('/api/admin/logout', (req, res) => {
    clearAuthCookie(res, IS_PRODUCTION);
    res.json({ ok: true });
  });

  app.get('/api/admin/me', (req, res) => {
    res.json({ loggedIn: isAuthenticated(req, SESSION_SECRET) });
  });

  // ---- Admin products ----

  app.get('/api/admin/products', requireAuth, async (_req, res) => {
    try {
      const products = await readAndMigrateProducts();
      products.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      res.json(products);
    } catch {
      res.status(500).json({ error: 'Kunne ikke hente motorcykler' });
    }
  });

  app.get('/api/admin/products/:id', requireAuth, async (req, res) => {
    try {
      const products = await readAndMigrateProducts();
      const product = products.find(p => p.id === req.params.id);
      if (!product) return res.status(404).json({ error: 'Ikke fundet' });
      res.json(product);
    } catch {
      res.status(500).json({ error: 'Kunne ikke hente motorcykel' });
    }
  });

  async function saveProductRecord(products, product) {
    if (typeof storage.writeProduct === 'function') {
      await storage.writeProduct(product);
      return;
    }
    await storage.writeProducts(products);
  }

  app.post('/api/admin/products/draft', requireAuth, async (req, res) => {
    try {
      const products = await readAndMigrateProducts();
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
      await saveProductRecord(products, product);
      res.status(201).json(product);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  app.post('/api/admin/products', requireAuth, async (req, res) => {
    try {
      const products = await readAndMigrateProducts();
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
      await saveProductRecord(products, product);
      res.status(201).json(product);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  app.put('/api/admin/products/:id', requireAuth, async (req, res) => {
    try {
      const products = await readAndMigrateProducts();
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

      await saveProductRecord(products, products[index]);
      res.json(products[index]);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  app.patch('/api/admin/products/:id/sold', requireAuth, async (req, res) => {
    try {
      const products = await readAndMigrateProducts();
      const index = products.findIndex(p => p.id === req.params.id);
      if (index === -1) return res.status(404).json({ error: 'Ikke fundet' });

      const sold = req.body?.sold !== false;
      products[index].status = sold ? 'sold' : 'available';
      products[index].badge = sold ? 'Solgt' : undefined;
      if (!sold) delete products[index].badge;
      products[index].updatedAt = new Date().toISOString();

      await saveProductRecord(products, products[index]);
      res.json(products[index]);
    } catch {
      res.status(500).json({ error: 'Kunne ikke opdatere status' });
    }
  });

  app.delete('/api/admin/products/:id', requireAuth, async (req, res) => {
    try {
      const products = await readAndMigrateProducts();
      const index = products.findIndex(p => p.id === req.params.id);
      if (index === -1) return res.status(404).json({ error: 'Ikke fundet' });

      const [removed] = products.splice(index, 1);
      await storage.writeProducts(products);
      await storage.deleteProductImages(removed.id);

      res.json({ ok: true });
    } catch {
      res.status(500).json({ error: 'Kunne ikke slette motorcykel' });
    }
  });

  function parseUploadedImages(req) {
    if (req.files?.length) {
      return req.files.map(file => ({
        buffer: file.buffer,
        originalname: file.originalname,
      }));
    }

    if (Array.isArray(req.body?.images)) {
      return req.body.images
        .map(img => {
          const raw = String(img.data || '').replace(/^data:[^;]+;base64,/, '');
          if (!raw) return null;
          return {
            buffer: Buffer.from(raw, 'base64'),
            originalname: img.name || 'billede.jpg',
          };
        })
        .filter(Boolean);
    }

    return [];
  }

  app.post('/api/admin/products/:id/images', requireAuth, (req, res, next) => {
    if (req.is('multipart/form-data')) {
      return upload.array('images', 20)(req, res, next);
    }
    next();
  }, async (req, res) => {
    try {
      const productId = req.params.id;
      const products = await readAndMigrateProducts();
      if (!products.find(p => p.id === productId)) {
        return res.status(404).json({ error: 'Motorcykel ikke fundet' });
      }

      const uploads = parseUploadedImages(req);
      if (!uploads.length) {
        return res.status(400).json({ error: 'Ingen billeder modtaget' });
      }

      const urls = [];
      for (const file of uploads) {
        const url = await storage.saveImage(file.buffer, productId, file.originalname);
        urls.push(url);
      }

      const index = products.findIndex(p => p.id === productId);
      const updated = {
        ...products[index],
        images: [...(products[index].images || []), ...urls],
        image: products[index].image || urls[0],
        updatedAt: new Date().toISOString(),
      };
      products[index] = updated;

      if (typeof storage.writeProduct === 'function') {
        await storage.writeProduct(updated);
      } else {
        await storage.writeProducts(products);
      }

      res.json({ urls });
    } catch (err) {
      console.error('Billedupload fejlede:', err);
      res.status(400).json({ error: err.message || 'Upload fejlede' });
    }
  });

  if (!serveStatic || IS_NETLIFY) {
    return app;
  }

  // ---- Kun lokal server: statiske filer ----

  app.use('/admin', (req, res, next) => {
    if (req.path === '/index.html' || req.path === '/' || req.path === '/login.html') return next();
    if (req.path.endsWith('.css') || req.path.endsWith('.js')) return next();
    if (!isAuthenticated(req, SESSION_SECRET)) {
      return res.redirect('/admin/');
    }
    next();
  });

  app.use('/admin', express.static(path.join(ROOT, 'admin')));

  app.get('/admin', (_req, res) => {
    res.sendFile(path.join(ROOT, 'admin', 'index.html'));
  });

  async function serveIndex(_req, res) {
    try {
      let html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
      const products = getPublicProducts(await readAndMigrateProducts()).slice(0, 5);
      const bootstrap = `<script>window.__CAROUSEL_PRODUCTS__=${JSON.stringify(products)};</script>`;
      html = html.replace('<!-- carousel-bootstrap -->', bootstrap);
      res.type('html').send(html);
    } catch {
      res.sendFile(path.join(ROOT, 'index.html'));
    }
  }

  app.get('/', serveIndex);
  app.get('/index.html', serveIndex);
  app.use(express.static(ROOT, { index: false }));

  return app;
}

module.exports = { createApp };
