/**
 * Produkt-specifikationer og URL-hjælpere
 */

function buildDescription({ cc, gears, km, specs = [] }) {
  const parts = [];

  if (cc) parts.push(`${String(cc).trim()} CC`);
  if (gears) parts.push(`${String(gears).trim()} GEAR`);
  if (km) parts.push(`KM. ${String(km).trim().replace(/\./g, '')}`);

  specs
    .map(s => String(s || '').trim())
    .filter(Boolean)
    .forEach(spec => parts.push(spec.toUpperCase()));

  if (!parts.length) return '';
  return `${parts.join(' - ')}.`;
}

function parseDescription(description = '') {
  const parts = String(description)
    .split(' - ')
    .map(s => s.trim().replace(/\.$/, ''))
    .filter(Boolean);

  let cc = '';
  let gears = '';
  let km = '';
  const specs = [];

  for (const part of parts) {
    const ccMatch = part.match(/^(\d+)\s*CC$/i);
    if (ccMatch) {
      cc = ccMatch[1];
      continue;
    }

    const gearMatch = part.match(/^(\d+)\s*GEAR$/i);
    if (gearMatch) {
      gears = gearMatch[1];
      continue;
    }

    const kmMatch = part.match(/^KM\.?\s*(.+)$/i);
    if (kmMatch) {
      km = kmMatch[1].replace(/\./g, '').trim();
      continue;
    }

    specs.push(part);
  }

  return { cc, gears, km, specs };
}

function getSiteBaseUrl(req) {
  if (process.env.URL) return process.env.URL.replace(/\/$/, '');
  if (process.env.DEPLOY_PRIME_URL) return process.env.DEPLOY_PRIME_URL.replace(/\/$/, '');
  if (req) return `${req.protocol}://${req.get('host')}`;
  return '';
}

function absoluteUrl(url, baseUrl) {
  if (!url || !baseUrl) return url;
  if (/^https?:\/\//i.test(url)) return url;
  return `${baseUrl}${url.startsWith('/') ? url : `/${url}`}`;
}

function toRelativeUrl(url, baseUrl) {
  if (!url) return '';
  const value = String(url).trim();

  if (baseUrl && value.startsWith(baseUrl)) {
    const relative = value.slice(baseUrl.length);
    return relative.startsWith('/') ? relative : `/${relative}`;
  }

  if (value.startsWith('/assets/images/bikes/')) return value;

  try {
    const parsed = new URL(value);
    if (parsed.pathname.startsWith('/assets/images/bikes/')) {
      return parsed.pathname;
    }
  } catch {
    // Behold oprindelig værdi
  }

  return value;
}

function normalizeStoredImages(images, image, baseUrl) {
  const relImages = (images || [])
    .map(url => toRelativeUrl(url, baseUrl))
    .filter(Boolean);

  let relImage = toRelativeUrl(image, baseUrl) || relImages[0] || '';
  if (relImage && !relImages.includes(relImage)) {
    relImages.unshift(relImage);
  }

  return { images: relImages, image: relImage };
}

function normalizeProduct(product, baseUrl) {
  if (!product || !baseUrl) return product;

  return {
    ...product,
    image: absoluteUrl(product.image, baseUrl),
    images: (product.images || []).map(url => absoluteUrl(url, baseUrl)),
  };
}

function normalizeProducts(products, baseUrl) {
  return products.map(p => normalizeProduct(p, baseUrl));
}

function sanitizeSpecsInput(body) {
  const cc = body.cc != null ? String(body.cc).trim() : '';
  const gears = body.gears != null ? String(body.gears).trim() : '';
  const km = body.km != null ? String(body.km).trim() : '';
  const specs = Array.isArray(body.specs)
    ? body.specs.map(s => String(s || '').trim()).filter(Boolean)
    : [];

  const built = buildDescription({ cc, gears, km, specs });
  const description = built || String(body.description || '').trim();

  return { cc, gears, km, specs, description };
}

module.exports = {
  buildDescription,
  parseDescription,
  getSiteBaseUrl,
  absoluteUrl,
  toRelativeUrl,
  normalizeStoredImages,
  normalizeProduct,
  normalizeProducts,
  sanitizeSpecsInput,
};
