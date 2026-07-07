const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

function createFilesystemStorage({ storageRoot, repoDataFile }) {
  const dataFile = path.join(storageRoot, 'products.json');
  const bikesDir = path.join(storageRoot, 'bikes');

  function initStorage() {
    fs.mkdirSync(storageRoot, { recursive: true });
    fs.mkdirSync(bikesDir, { recursive: true });
    if (!fs.existsSync(dataFile) && fs.existsSync(repoDataFile)) {
      fs.copyFileSync(repoDataFile, dataFile);
    }
  }

  async function readProducts() {
    initStorage();
    const raw = fs.readFileSync(dataFile, 'utf8');
    return JSON.parse(raw);
  }

  async function writeProducts(products) {
    initStorage();
    fs.writeFileSync(dataFile, JSON.stringify(products, null, 2) + '\n', 'utf8');
  }

  async function saveImage(buffer, productId, originalName) {
    initStorage();
    const dir = path.join(bikesDir, productId);
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

  async function deleteProductImages(productId) {
    initStorage();
    const localDir = path.join(bikesDir, productId);
    if (fs.existsSync(localDir)) {
      fs.rmSync(localDir, { recursive: true, force: true });
    }
  }

  async function getImage(productId, filename) {
    initStorage();
    const filepath = path.join(bikesDir, productId, filename);
    if (!fs.existsSync(filepath)) return null;
    return fs.readFileSync(filepath);
  }

  async function deleteImage(productId, filename) {
    initStorage();
    const filepath = path.join(bikesDir, productId, filename);
    if (fs.existsSync(filepath)) {
      fs.unlinkSync(filepath);
    }
  }

  return {
    initStorage,
    readProducts,
    writeProducts,
    saveImage,
    deleteProductImages,
    deleteImage,
    getImage,
  };
}

module.exports = { createFilesystemStorage };
