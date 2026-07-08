const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

let bundledSeed = null;
try {
  bundledSeed = require('../../data/products.json');
} catch {
  // Ignoreres
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

function isValidJpeg(buf) {
  return Buffer.isBuffer(buf) && buf.length > 100 && buf[0] === 0xff && buf[1] === 0xd8;
}

function decodeBase64Image(value) {
  if (!value || typeof value !== 'string') return null;
  const cleaned = value.replace(/^data:[^;]+;base64,/, '').replace(/\s/g, '');
  if (!cleaned) return null;
  try {
    const buf = Buffer.from(cleaned, 'base64');
    return isValidJpeg(buf) ? buf : null;
  } catch {
    return null;
  }
}

function imagePublicPath(productId, filename) {
  return `/api/images/bikes/${productId}/${filename}`;
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
      const base = path.basename(originalName, path.extname(originalName))
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '') || 'billede';

      const filename = `${base}-${Date.now()}.jpg`;

      let optimized = Buffer.from(buffer);
      if (isValidJpeg(optimized)) {
        try {
          optimized = await sharp(optimized)
            .rotate()
            .resize({ width: 1400, height: 1400, fit: 'inside', withoutEnlargement: true })
            .jpeg({ quality: 82, mozjpeg: true })
            .toBuffer();
        } catch (err) {
          console.warn('Sharp komprimering sprunget over:', err.message);
        }
      } else {
        try {
          optimized = await sharp(buffer)
            .rotate()
            .resize({ width: 1400, height: 1400, fit: 'inside', withoutEnlargement: true })
            .jpeg({ quality: 82, mozjpeg: true })
            .toBuffer();
        } catch (err) {
          console.warn('Sharp konvertering fejlede:', err.message);
        }
      }

      if (!isValidJpeg(optimized)) {
        throw new Error('Kunne ikke behandle billedet – prøv et andet billede');
      }

      // Gemmes i product.imageData ved upload – returnerer base64 til createApp
      return {
        url: imagePublicPath(productId, filename),
        filename,
        base64: optimized.toString('base64'),
      };
    } catch (err) {
      console.error('Netlify saveImage fejlede:', err.message);
      throw new Error(`Billedupload fejlede: ${err.message}`);
    }
  }

  async function getImage(productId, filename) {
    try {
      const { productsStore } = getStores();
      const product = await productsStore.get(productKey(productId), { type: 'json' });
      if (product?.imageData?.[filename]) {
        const buf = decodeBase64Image(product.imageData[filename]);
        if (buf) return buf;
      }
    } catch (err) {
      console.warn('getImage fra product.imageData fejlede:', err.message);
    }

    // Legacy: ældre separate blob-lager (ofte korrupt – springes over hvis ugyldigt)
    try {
      const { imagesStore } = getStores();
      const key = `${productId}/${filename}`;

      const json = await imagesStore.get(key, { type: 'json' });
      if (json?.data) {
        const buf = decodeBase64Image(json.data);
        if (buf) return buf;
      }

      const asText = await imagesStore.get(key, { type: 'text' });
      const bufFromText = decodeBase64Image(asText);
      if (bufFromText) return bufFromText;

      const data = await imagesStore.get(key, { type: 'arrayBuffer' });
      if (data) {
        const buf = Buffer.isBuffer(data) ? data : Buffer.from(data);
        if (isValidJpeg(buf)) return buf;
      }
    } catch {
      // Ignorer legacy fejl
    }

    return null;
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

  async function deleteImage(_productId, _filename) {
    // Billeder gemmes i product.imageData – slettes via createApp
  }

  function initStorage() {}

  return {
    initStorage,
    readProducts,
    writeProducts,
    writeProduct,
    saveImage,
    deleteProductImages,
    deleteImage,
    getImage,
  };
}

module.exports = { createNetlifyStorage };
