/**
 * Netlify build – indlejrer karuseldata direkte i index.html
 */

const fs = require('fs');
const path = require('path');

const products = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', 'data', 'products.json'), 'utf8')
);

const newest = products
  .filter(p => !p.status || p.status === 'available')
  .sort((a, b) => {
    const da = a.createdAt || a.id;
    const db = b.createdAt || b.id;
    return da > db ? -1 : da < db ? 1 : 0;
  })
  .slice(0, 5);

const indexPath = path.join(__dirname, '..', 'index.html');
let html = fs.readFileSync(indexPath, 'utf8');
const bootstrap = `<script>window.__CAROUSEL_PRODUCTS__=${JSON.stringify(newest)};</script>`;

if (!html.includes('<!-- carousel-bootstrap -->')) {
  console.warn('carousel-bootstrap placeholder not found in index.html');
} else {
  html = html.replace('<!-- carousel-bootstrap -->', bootstrap);
  fs.writeFileSync(indexPath, html);
}

console.log(`Netlify build: indlejrede ${newest.length} motorcykler i forsiden`);
