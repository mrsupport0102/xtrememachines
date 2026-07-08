/**
 * Netlify build – karusellen henter live data fra /api/products
 */

const fs = require('fs');
const path = require('path');

const indexPath = path.join(__dirname, '..', 'index.html');
let html = fs.readFileSync(indexPath, 'utf8');
const bootstrap = '<script>window.__CAROUSEL_PRODUCTS__=[];</script>';

if (html.includes('<!-- carousel-bootstrap -->')) {
  html = html.replace('<!-- carousel-bootstrap -->', bootstrap);
  fs.writeFileSync(indexPath, html);
}

console.log('Netlify build: karusel bruger live API-data');
