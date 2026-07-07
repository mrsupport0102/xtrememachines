const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

let bundledSeed = null;
try {
  bundledSeed = require('../../data/products.json');
} catch {
  // Ignoreres – prøver filsti ved runtime
}

const MANIFEST_KEY = 'manifest';

function loadSeedFromDisk(repoDataFile) {
  const candidates = [
    repoDataFile,
    path.join(process.cwd(), 'data', 'products.json'),
    path.join(__dirname, '../../data/products.json'),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return JSON.parse(fs.readFileSync(candidate, 'utf8'));
    }
  }

  return null;
}

function getSeedProducts(repoDataFile) {
  if (Array.isArray(bundledSeed) && bundledSeed.length) return bundledSeed;
  return loadSeedFromDisk(repoDataFile);
}

function productKey(id) {
  return `product:${id}`;
}

function createNetlifyStorage({ repoDataFile }) {
  function getStores() {
    const { getStore } = require('@netlify/blobs');
    return {
      productsStore: getStore('xtreme-products'),
      imagesStore: getStore('xtreme-bike-images'),
    };
  }

  async function readManifest(store) {
    const manifest = await store.get(MANIFEST_KEY, { type: 'json' });
    return Array.isArray(manifest) ? manifest : [];
  }

  async function writeManifest(store, ids) {
    await store.setJSON(MANIFEST_KEY, ids);
  }

  async function seedStore(store, products) {
    const ids = products.map(p => p.id);
    await writeManifest(store, ids);
    await Promise.all(products.map(product => store.setJSON(productKey(product.id), product)));
  }

  async function readLegacyProducts(store) {
    const legacy = await store.get('products', { type: 'json' });
    if (!Array.isArray(legacy) || !legacy.length) return null;

    await seedStore(store, legacy);
    await store.delete('products');
    return legacy;
  }

  async function readProducts() {
    try {
      const { productsStore } = getStores();
      let manifest = await readManifest(productsStore);

      if (!manifest.length) {
        const legacy = await readLegacyProducts(productsStore);
        if (legacy) return legacy;
      }

      if (manifest.length) {
        const products = await Promise.all(
          manifest.map(id => productsStore.get(productKey(id), { type: 'json' }))
        );
        const valid = products.filter(Boolean);
        if (valid.length) return valid;
      }

      const seed = getSeedProducts(repoDataFile);
      if (Array.isArray(seed) && seed.length > 0) {
        await seedStore(productsStore, seed);
        return seed;
      }

      return [];
    } catch (err) {
      console.error('Netlify Blobs readProducts fejlede:', err.message);
      const seed = getSeedProducts(repoDataFile);
      return Array.isArray(seed) ? seed : [];
    }
  }

  async function writeProducts(products) {
    try {
      const { productsStore } = getStores();
      const ids = products.map(p => p.id);
      for (const product of products) {
        await productsStore.setJSON(productKey(product.id), product);
      }
      await writeManifest(productsStore, ids);
    } catch (err) {
      console.error('Netlify Blobs writeProducts fejlede:', err.message);
      throw new Error(`Kunne ikke gemme data: ${err.message}`);
    }
  }

  async function writeProduct(product) {
    try {
      const { productsStore } = getStores();
      await productsStore.setJSON(productKey(product.id), product);
      const manifest = await readManifest(productsStore);
      if (!manifest.includes(product.id)) {
        await writeManifest(productsStore, [product.id, ...manifest]);
      }
    } catch (err) {
      console.error('Netlify Blobs writeProduct fejlede:', err.message);
      throw new Error(`Kunne ikke gemme data: ${err.message}`);
    }
  }

  async function saveImage(buffer, productId, originalName) {
    try {
      const { imagesStore } = getStores();

      const base = path.basename(originalName, path.extname(originalName))
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '') || 'billede';

      const filename = `${base}-${Date.now()}.jpg`;
      const key = `${productId}/${filename}`;

      let optimized = buffer;
      try {
        optimized = await sharp(buffer)
          .rotate()
          .resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
          .jpeg({ quality: 85, mozjpeg: true })
          .toBuffer();
      } catch (err) {
        console.warn('Sharp komprimering sprunget over:', err.message);
      }

      await imagesStore.set(key, optimized);
      return `/assets/images/bikes/${productId}/${filename}`;
    } catch (err) {
      console.error('Netlify Blobs saveImage fejlede:', err.message);
      throw new Error(`Billedupload fejlede: ${err.message}`);
    }
  }

  async function deleteProductImages(productId) {
    try {
      const { imagesStore } = getStores();
      const { blobs } = await imagesStore.list({ prefix: `${productId}/` });
      await Promise.all(blobs.map(blob => imagesStore.delete(blob.key)));
    } catch (err) {
      console.error('Netlify Blobs deleteProductImages fejlede:', err.message);
    }
  }

  async function getImage(productId, filename) {
    const { imagesStore } = getStores();
    return imagesStore.get(`${productId}/${filename}`, { type: 'arrayBuffer' });
  }

  function initStorage() {}

  return {
    initStorage,
    readProducts,
    writeProducts,
    writeProduct,
    saveImage,
    deleteProductImages,
    getImage,
  };
}

module.exports = { createNetlifyStorage };
