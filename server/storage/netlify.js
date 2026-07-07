const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

let bundledSeed = null;
try {
  bundledSeed = require('../../data/products.json');
} catch {
  // Ignoreres – prøver filsti ved runtime
}

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

function createNetlifyStorage({ repoDataFile }) {
  let productsStore;
  let imagesStore;

  function getStores() {
    if (!productsStore || !imagesStore) {
      const { getStore } = require('@netlify/blobs');
      productsStore = getStore({ name: 'xtreme-products', consistency: 'strong' });
      imagesStore = getStore({ name: 'xtreme-bike-images', consistency: 'strong' });
    }
    return { productsStore, imagesStore };
  }

  async function readProducts() {
    try {
      const { productsStore } = getStores();
      const stored = await productsStore.get('products', { type: 'json' });

      if (Array.isArray(stored) && stored.length > 0) {
        return stored;
      }

      const seed = getSeedProducts(repoDataFile);
      if (Array.isArray(seed) && seed.length > 0) {
        await productsStore.setJSON('products', seed);
        return seed;
      }

      return Array.isArray(stored) ? stored : [];
    } catch (err) {
      console.error('Netlify Blobs readProducts fejlede:', err.message);
      const seed = getSeedProducts(repoDataFile);
      return Array.isArray(seed) ? seed : [];
    }
  }

  async function writeProducts(products) {
    try {
      const { productsStore } = getStores();
      await productsStore.setJSON('products', products);
    } catch (err) {
      console.error('Netlify Blobs writeProducts fejlede:', err.message);
      throw new Error('Kunne ikke gemme data – prøv igen om et øjeblik');
    }
  }

  async function saveImage(buffer, productId, originalName) {
    const { imagesStore } = getStores();

    const base = path.basename(originalName, path.extname(originalName))
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '') || 'billede';

    const filename = `${base}-${Date.now()}.jpg`;
    const key = `${productId}/${filename}`;

    const optimized = await sharp(buffer)
      .rotate()
      .resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 85, mozjpeg: true })
      .toBuffer();

    await imagesStore.set(key, optimized, { metadata: { contentType: 'image/jpeg' } });
    return `/assets/images/bikes/${productId}/${filename}`;
  }

  async function deleteProductImages(productId) {
    const { imagesStore } = getStores();
    const { blobs } = await imagesStore.list({ prefix: `${productId}/` });
    await Promise.all(blobs.map(blob => imagesStore.delete(blob.key)));
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
    saveImage,
    deleteProductImages,
    getImage,
  };
}

module.exports = { createNetlifyStorage };
